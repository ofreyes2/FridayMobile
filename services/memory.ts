/**
 * KNIGHTSWATCH Memory Service
 * Pattern 1: Relevant memory recall via Ollama side-query (Claude Code findRelevantMemories.ts)
 *
 * Save/recall conversations, find relevant memories, and check dreams.
 */

import { memoryUrl, ollamaUrl, recheck } from './knightswatch'
import type { FridayMemory, FridayMemoryType } from '@/lib/friday/types'

const TIMEOUT = 5000

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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

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
    })

    clearTimeout(timeoutId)

    if (resp.ok) {
      console.log('[Memory] Saved to KNIGHTSWATCH')
    } else {
      console.warn(`[Memory] Save status: ${resp.status}`)
    }
  } catch (error) {
    console.warn('[Memory] Save failed (local only):', error instanceof Error ? error.message : error)
    try { await recheck() } catch {}
  }
}

/**
 * Search memory for a query.
 */
export async function searchMemory(query: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

    const resp = await fetch(
      `${memoryUrl()}/memory/search?q=${encodeURIComponent(query)}`,
      { method: 'GET', signal: controller.signal }
    )

    clearTimeout(timeoutId)

    if (resp.ok) {
      const results = await resp.json()
      if (results && typeof results === 'object') {
        const matches = results.matches || []
        if (matches.length > 0) {
          let context = 'Relevant past conversations:\n'
          for (const match of matches.slice(0, 3)) {
            context += `- ${match.content || ''}\n`
          }
          return context
        }
      }
    }
  } catch (error) {
    console.warn('[Memory] Search failed:', error instanceof Error ? error.message : error)
  }
  return null
}

/**
 * Search for remembered items specifically.
 */
export async function searchRemembered(): Promise<string | null> {
  return searchMemory('remember')
}

/**
 * Check for dream insights on app launch.
 */
export async function getLatestDream(): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

    const resp = await fetch(`${memoryUrl()}/dream/latest`, {
      method: 'GET',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (resp.ok) {
      const data = await resp.json()
      const dreams = data.dreams || []
      if (dreams.length > 0) {
        return dreams[0].insight || null
      }
    }
  } catch (error) {
    console.warn('[Memory] Dream check failed:', error instanceof Error ? error.message : error)
  }
  return null
}

// ─── Pattern 1: Relevant Memory Recall (Claude Code findRelevantMemories.ts) ───

/**
 * Use a fast Ollama side-query to select the most relevant local memories
 * for a given user query. This keeps context small and responses fast.
 *
 * Flow:
 * 1. Get all memory headers (id + first-line summary)
 * 2. Send query + headers to Ollama (fast model)
 * 3. Ollama picks the top relevant memory IDs
 * 4. Load only those full memories
 */
export async function findRelevantMemories(
  query: string,
  headers: { id: string; type: FridayMemoryType; summary: string }[],
  maxResults: number = 5
): Promise<string[]> {
  if (headers.length === 0) return []

  // If fewer memories than max, just return all IDs
  if (headers.length <= maxResults) {
    return headers.map(h => h.id)
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const memoryList = headers
      .map((h, i) => `${i + 1}. [${h.type}] ${h.summary}`)
      .join('\n')

    const resp = await fetch(`${ollamaUrl()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b', // Fast model for side-queries
        prompt: `Given this user query: "${query}"

Which of these memories are most relevant? Return ONLY the numbers (comma-separated, max ${maxResults}):

${memoryList}

Relevant numbers:`,
        stream: false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!resp.ok) {
      console.warn('[Memory] Relevance query failed:', resp.status)
      // Fallback: return the most recent memories
      return headers.slice(0, maxResults).map(h => h.id)
    }

    const data = await resp.json()
    const response = data.response || ''

    // Parse numbers from response
    const numbers = response.match(/\d+/g)?.map(Number) || []
    const selectedIds = numbers
      .filter((n: number) => n >= 1 && n <= headers.length)
      .slice(0, maxResults)
      .map((n: number) => headers[n - 1].id)

    if (selectedIds.length === 0) {
      // Fallback: return the most recent
      return headers.slice(0, maxResults).map(h => h.id)
    }

    console.log(`[Memory] Selected ${selectedIds.length}/${headers.length} relevant memories`)
    return selectedIds
  } catch (error) {
    console.warn('[Memory] Relevance query error:', error instanceof Error ? error.message : error)
    // Fallback: return the most recent memories
    return headers.slice(0, maxResults).map(h => h.id)
  }
}

/**
 * Classify what type of memory should be saved from a conversation.
 * Uses heuristics — no LLM call needed.
 */
export function classifyMemoryType(userInput: string, assistantResponse: string): FridayMemoryType {
  const lower = userInput.toLowerCase()

  // Feedback: user corrections or preferences about Friday's behavior
  if (
    lower.includes('don\'t') || lower.includes('stop') ||
    lower.includes('prefer') || lower.includes('instead') ||
    lower.includes('not like that') || lower.includes('wrong')
  ) {
    return 'feedback'
  }

  // User: personal info about Oscar
  if (
    lower.includes('my name') || lower.includes('i am') ||
    lower.includes('i like') || lower.includes('i work') ||
    lower.includes('my job') || lower.includes('i live')
  ) {
    return 'user'
  }

  // Project: work, deadlines, tasks
  if (
    lower.includes('project') || lower.includes('deadline') ||
    lower.includes('working on') || lower.includes('build') ||
    lower.includes('deploy') || lower.includes('release')
  ) {
    return 'project'
  }

  // Default: reference (facts, how-tos)
  return 'reference'
}
