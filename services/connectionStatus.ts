/**
 * Connection Status Service
 * Monitors connectivity to KNIGHTSWATCH and Ollama via the knightswatch connection manager.
 */

import { ollamaUrl, getConnectionMethod } from '@/services/knightswatch';

export type ConnectionStatus = 'green' | 'yellow' | 'red';

/**
 * Check connection status to KNIGHTSWATCH and Ollama.
 * Uses the knightswatch connection manager's active IP.
 */
export async function checkConnectionStatus(): Promise<ConnectionStatus> {
  if (getConnectionMethod() === 'Disconnected') {
    return 'red';
  }

  const endpoint = ollamaUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (resp.ok) {
      return 'green';
    }
    return 'yellow';
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
