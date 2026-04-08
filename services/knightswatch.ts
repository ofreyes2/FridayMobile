/**
 * KNIGHTSWATCH Connection Manager
 * Tries local network first (192.168.1.219), falls back to Tailscale (100.112.253.127).
 * Caches the working IP. Re-checks on failure.
 * All services use this — no hardcoded IPs anywhere else.
 */

const LOCAL_IP = '192.168.1.219';
const TAILSCALE_IP = '100.112.253.127';
const OLLAMA_PORT = 11434;
const TTS_PORT = 8082;
const MEMORY_PORT = 8081;
const COMFYUI_PORT = 8188;
const PROBE_TIMEOUT = 3000;

export type ConnectionMethod = 'Local Network' | 'Tailscale' | 'Disconnected';

interface ConnectionState {
  activeIp: string;
  method: ConnectionMethod;
  lastChecked: number;
}

let state: ConnectionState = {
  activeIp: TAILSCALE_IP, // default until probed
  method: 'Disconnected',
  lastChecked: 0,
};

let detecting = false;
let listeners: Array<(state: ConnectionState) => void> = [];

/**
 * Probe a single IP by hitting Ollama's /api/tags endpoint.
 */
async function probe(ip: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
    const resp = await fetch(`http://${ip}:${OLLAMA_PORT}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Detect the best route to KNIGHTSWATCH.
 * Tries local IP first, then Tailscale. Caches result.
 */
export async function detect(): Promise<ConnectionState> {
  if (detecting) {
    // Already running — return current state
    return state;
  }
  detecting = true;

  try {
    // Try local network first
    if (await probe(LOCAL_IP)) {
      state = { activeIp: LOCAL_IP, method: 'Local Network', lastChecked: Date.now() };
      console.log(`[KNIGHTSWATCH] Connected via Local Network (${LOCAL_IP})`);
      notifyListeners();
      return state;
    }

    // Fall back to Tailscale
    if (await probe(TAILSCALE_IP)) {
      state = { activeIp: TAILSCALE_IP, method: 'Tailscale', lastChecked: Date.now() };
      console.log(`[KNIGHTSWATCH] Connected via Tailscale (${TAILSCALE_IP})`);
      notifyListeners();
      return state;
    }

    // Neither available
    state = { activeIp: TAILSCALE_IP, method: 'Disconnected', lastChecked: Date.now() };
    console.warn('[KNIGHTSWATCH] Unreachable on both local and Tailscale');
    notifyListeners();
    return state;
  } finally {
    detecting = false;
  }
}

/**
 * Re-check connection (call this when a request fails).
 */
export async function recheck(): Promise<ConnectionState> {
  const oldMethod = state.method;
  await detect();
  if (state.method !== oldMethod) {
    console.log(`[KNIGHTSWATCH] Failover: ${oldMethod} -> ${state.method}`);
  }
  return state;
}

/**
 * Get the current active IP (cached, no network call).
 */
export function getActiveIp(): string {
  return state.activeIp;
}

/**
 * Get the current connection method.
 */
export function getConnectionMethod(): ConnectionMethod {
  return state.method;
}

/**
 * Get the full connection state.
 */
export function getConnectionState(): ConnectionState {
  return { ...state };
}

// ─── URL builders ───

export function ollamaUrl(): string {
  return `http://${state.activeIp}:${OLLAMA_PORT}`;
}

export function ttsUrl(): string {
  return `http://${state.activeIp}:${TTS_PORT}`;
}

export function memoryUrl(): string {
  return `http://${state.activeIp}:${MEMORY_PORT}`;
}

export function comfyuiUrl(): string {
  return `http://${state.activeIp}:${COMFYUI_PORT}`;
}

// ─── Listeners ───

export function addConnectionListener(listener: (state: ConnectionState) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener({ ...state });
    } catch (e) {
      console.error('[KNIGHTSWATCH] Listener error:', e);
    }
  }
}
