/**
 * KNIGHTSWATCH Memory Service
 * Save/recall conversations, remember items, and check dreams.
 */

import { memoryUrl, recheck } from './knightswatch';

const TIMEOUT = 5000;

/**
 * Save a conversation exchange to KNIGHTSWATCH memory.
 */
export async function saveToMemory(
  userMsg: string,
  fridayMsg: string,
  username: string = 'Oscar',
  location: string = 'Plainfield, Illinois'
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const resp = await fetch(`${memoryUrl()}/memory/save_batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'oscar-mobile',
        source: 'mobile',
        messages: [
          { role: 'user', content: `${userMsg} [Speaker: ${username}, Location: ${location}]` },
          { role: 'assistant', content: fridayMsg },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (resp.ok) {
      console.log('[Memory] Saved to KNIGHTSWATCH');
    } else {
      console.warn(`[Memory] Save status: ${resp.status}`);
    }
  } catch (error) {
    console.warn('[Memory] Save failed (local only):', error instanceof Error ? error.message : error);
    // Try failover
    try { await recheck(); } catch {}
  }
}

/**
 * Search memory for a query.
 */
export async function searchMemory(query: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const resp = await fetch(
      `${memoryUrl()}/memory/search?q=${encodeURIComponent(query)}`,
      { method: 'GET', signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (resp.ok) {
      const results = await resp.json();
      if (results && typeof results === 'object') {
        const matches = results.matches || [];
        if (matches.length > 0) {
          let context = 'Relevant past conversations:\n';
          for (const match of matches.slice(0, 3)) {
            context += `- ${match.content || ''}\n`;
          }
          return context;
        }
      }
    }
  } catch (error) {
    console.warn('[Memory] Search failed:', error instanceof Error ? error.message : error);
  }
  return null;
}

/**
 * Search for remembered items specifically.
 */
export async function searchRemembered(): Promise<string | null> {
  return searchMemory('remember');
}

/**
 * Check for dream insights on app launch.
 */
export async function getLatestDream(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const resp = await fetch(`${memoryUrl()}/dream/latest`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      const dreams = data.dreams || [];
      if (dreams.length > 0) {
        return dreams[0].insight || null;
      }
    }
  } catch (error) {
    console.warn('[Memory] Dream check failed:', error instanceof Error ? error.message : error);
  }
  return null;
}
