/**
 * Connection Status Service
 * Monitors connectivity to KNIGHTSWATCH and Ollama
 */

const ENDPOINTS = {
  tailscale: 'http://100.112.253.127',
  local: 'http://192.168.1.219',
};

const OLLAMA_PORT = 11434;

export type ConnectionStatus = 'green' | 'yellow' | 'red';

/**
 * Check connection status to KNIGHTSWATCH and Ollama
 * Returns 'green' if fully connected, 'yellow' if KNIGHTSWATCH up but Ollama down, 'red' if unreachable
 */
export async function checkConnectionStatus(): Promise<ConnectionStatus> {
  // Try Tailscale endpoint first
  const tailscaleStatus = await checkEndpoint(ENDPOINTS.tailscale);
  if (tailscaleStatus !== 'red') {
    return tailscaleStatus;
  }

  // Fall back to local endpoint
  const localStatus = await checkEndpoint(ENDPOINTS.local);
  return localStatus;
}

/**
 * Check a specific endpoint
 */
async function checkEndpoint(endpoint: string): Promise<ConnectionStatus> {
  try {
    // Step 1: Can we reach the endpoint at all?
    const pingController = new AbortController();
    const pingTimeoutId = setTimeout(() => pingController.abort(), 5000);

    const pingResp = await fetch(`${endpoint}:${OLLAMA_PORT}`, {
      method: 'HEAD',
      signal: pingController.signal,
    });

    clearTimeout(pingTimeoutId);

    if (!pingResp.ok && pingResp.status !== 0) {
      // KNIGHTSWATCH is reachable but gave a non-OK response
      // Try to check Ollama API specifically
      return checkOllamaApi(endpoint);
    }

    // Try checking Ollama API directly
    return checkOllamaApi(endpoint);
  } catch {
    // Endpoint unreachable
    return 'red';
  }
}

/**
 * Check if Ollama API is responding
 */
async function checkOllamaApi(endpoint: string): Promise<ConnectionStatus> {
  try {
    const apiController = new AbortController();
    const apiTimeoutId = setTimeout(() => apiController.abort(), 5000);

    const ollamaResp = await fetch(`${endpoint}:${OLLAMA_PORT}/api/tags`, {
      method: 'GET',
      signal: apiController.signal,
    });

    clearTimeout(apiTimeoutId);

    if (ollamaResp.ok) {
      return 'green'; // Full connection
    }
    return 'yellow'; // KNIGHTSWATCH reachable, Ollama not responding properly
  } catch {
    return 'yellow'; // KNIGHTSWATCH reachable, Ollama unreachable
  }
}

/**
 * Get human-readable message for connection status
 */
export function getConnectionMessage(
  status: ConnectionStatus,
  isVia: 'tailscale' | 'local' = 'tailscale'
): string {
  switch (status) {
    case 'green':
      const via = isVia === 'tailscale' ? 'Tailscale' : 'Local Network';
      return `Connected to KNIGHTSWATCH via ${via}`;
    case 'yellow':
      return 'KNIGHTSWATCH online but Ollama not responding.\nCheck if Ollama is running.';
    case 'red':
      return 'Cannot reach KNIGHTSWATCH.\nCheck Tailscale.';
  }
}
