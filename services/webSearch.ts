/**
 * Web Search Service
 * Uses DuckDuckGo Instant Answer API for real-time information.
 */

const DDGS_API = 'https://api.duckduckgo.com';
const TIMEOUT = 8000;

/**
 * Keywords that trigger a web search.
 */
export const SEARCH_TRIGGERS = [
  'weather', 'news', 'score', 'today', 'current', 'latest',
  'what is', 'who is', 'when is', 'where is', 'search for', 'look up',
];

/**
 * Check if user text should trigger a web search.
 */
export function shouldSearch(text: string): boolean {
  const lower = text.toLowerCase();
  return SEARCH_TRIGGERS.some(trigger => lower.includes(trigger));
}

/**
 * Search DuckDuckGo for current information.
 * Returns formatted results string or null.
 */
export async function searchWeb(query: string): Promise<string | null> {
  try {
    // Add current year for freshness
    const year = new Date().getFullYear();
    const searchQuery = `${query} ${year}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    // DuckDuckGo Instant Answer API
    const url = `${DDGS_API}/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1`;
    const resp = await fetch(url, { signal: controller.signal });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn(`[Search] DuckDuckGo error: ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const parts: string[] = [];

    // Abstract (main answer)
    if (data.Abstract) {
      parts.push(`${data.Abstract} (Source: ${data.AbstractSource || 'DuckDuckGo'})`);
    }

    // Answer (quick fact)
    if (data.Answer) {
      parts.push(`Answer: ${data.Answer}`);
    }

    // Related topics (top 3)
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const topics = data.RelatedTopics
        .filter((t: any) => t.Text)
        .slice(0, 3)
        .map((t: any, i: number) => `${i + 1}. ${t.Text}`);
      if (topics.length > 0) {
        parts.push(topics.join('\n'));
      }
    }

    if (parts.length === 0) {
      console.log('[Search] No results from DuckDuckGo');
      return null;
    }

    return parts.join('\n\n');
  } catch (error) {
    console.warn('[Search] Error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Format search results for Ollama context injection.
 * Makes results impossible for the model to ignore.
 */
export function formatSearchContext(results: string, originalQuestion: string): string {
  return (
    `WEB SEARCH RESULTS (use these facts, do not make up information):\n` +
    `${results}\n\n` +
    `User question: ${originalQuestion}`
  );
}
