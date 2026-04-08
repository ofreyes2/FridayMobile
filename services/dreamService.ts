/**
 * Dream Service (Pattern 2: Claude Code DreamTask.ts)
 *
 * Background memory consolidation with 4-phase lifecycle:
 * 1. Orient  — Review recent conversation sessions
 * 2. Gather  — Read relevant memory entries
 * 3. Consolidate — Merge, update, or create memories
 * 4. Prune   — Remove outdated or redundant memories
 *
 * Dreams run as a background task via TaskManager and can be killed cleanly.
 */

import type { DreamResult, DreamPhase, DreamState } from '@/lib/friday/types'
import { taskManager } from './taskManager'
import { getAllSessions, type ConversationSession } from '@/services/fridayHistory'
import { memoryUrl, ollamaUrl } from '@/services/knightswatch'

const MAX_SESSIONS_TO_REVIEW = 5
const DREAM_TIMEOUT = 60000 // 60 seconds

type DreamListener = (result: DreamResult) => void

let currentDream: DreamResult | null = null
let listeners: DreamListener[] = []

function makeDreamResult(): DreamResult {
  return {
    id: `dream_${Date.now()}`,
    state: 'starting',
    phase: 'orient',
    startedAt: Date.now(),
    completedAt: null,
    sessionsReviewed: 0,
    memoriesCreated: 0,
    memoriesPruned: 0,
    insight: null,
  }
}

function updateDream(updates: Partial<DreamResult>): void {
  if (!currentDream) return
  Object.assign(currentDream, updates)
  for (const listener of listeners) {
    try {
      listener({ ...currentDream })
    } catch (e) {
      console.error('[Dream] Listener error:', e)
    }
  }
}

/**
 * Run the 4-phase dream cycle as a tracked background task.
 */
export async function startDream(): Promise<DreamResult> {
  if (currentDream && (currentDream.state === 'starting' || currentDream.state === 'updating')) {
    console.log('[Dream] Already dreaming, skipping')
    return currentDream
  }

  currentDream = makeDreamResult()
  updateDream({ state: 'starting' })

  try {
    const result = await taskManager.run('dream', 'Background memory consolidation', async (signal) => {
      // Phase 1: Orient — review recent sessions
      updateDream({ phase: 'orient', state: 'updating' })
      const sessions = await orientPhase(signal)
      updateDream({ sessionsReviewed: sessions.length })

      if (signal.aborted) throw new Error('Dream killed')
      if (sessions.length === 0) {
        updateDream({ state: 'completed', completedAt: Date.now(), insight: 'No recent sessions to review.' })
        return currentDream!
      }

      // Phase 2: Gather — collect memory context
      updateDream({ phase: 'gather' })
      const context = await gatherPhase(sessions, signal)

      if (signal.aborted) throw new Error('Dream killed')

      // Phase 3: Consolidate — ask Ollama to produce insights
      updateDream({ phase: 'consolidate' })
      const insight = await consolidatePhase(context, signal)
      updateDream({ insight })

      if (signal.aborted) throw new Error('Dream killed')

      // Phase 4: Prune — save insight to KNIGHTSWATCH memory
      updateDream({ phase: 'prune' })
      const saved = await prunePhase(insight, signal)
      updateDream({ memoriesCreated: saved ? 1 : 0 })

      updateDream({ state: 'completed', completedAt: Date.now() })
      return currentDream!
    })

    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'Dream killed') {
      updateDream({ state: 'killed', completedAt: Date.now() })
    } else {
      updateDream({ state: 'failed', completedAt: Date.now() })
      console.error('[Dream] Failed:', msg)
    }
    return currentDream!
  }
}

/**
 * Phase 1: Orient — get recent conversation sessions.
 */
async function orientPhase(signal: AbortSignal): Promise<ConversationSession[]> {
  try {
    const sessions = await getAllSessions()
    // Return the most recent N sessions
    return sessions
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, MAX_SESSIONS_TO_REVIEW)
  } catch (err) {
    console.warn('[Dream] Orient failed:', err)
    return []
  }
}

/**
 * Phase 2: Gather — build conversation context from sessions.
 */
async function gatherPhase(
  sessions: ConversationSession[],
  signal: AbortSignal
): Promise<string> {
  const summaries: string[] = []

  for (const session of sessions) {
    if (signal.aborted) break

    const lines = session.records
      .slice(-6) // Last 6 exchanges per session
      .map(r => `User: ${r.userMessage}\nFriday: ${r.fridayResponse}`)
      .join('\n')

    if (lines) {
      summaries.push(`Session ${session.id} (${new Date(session.startedAt).toLocaleDateString()}):\n${lines}`)
    }
  }

  return summaries.join('\n\n---\n\n')
}

/**
 * Phase 3: Consolidate — use Ollama to extract insights from conversations.
 */
async function consolidatePhase(context: string, signal: AbortSignal): Promise<string> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DREAM_TIMEOUT)

    // If parent signal aborts, abort our fetch too
    const onAbort = () => controller.abort()
    signal.addEventListener('abort', onAbort)

    const resp = await fetch(`${ollamaUrl()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.3:70b',
        prompt: `You are Friday's dream system. Review these recent conversations and extract 1-2 key insights about Oscar — preferences, ongoing projects, or patterns you notice. Be concise (2-3 sentences max).

${context}

Insights:`,
        stream: false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    signal.removeEventListener('abort', onAbort)

    if (!resp.ok) {
      console.warn('[Dream] Consolidate Ollama error:', resp.status)
      return 'Dream consolidation failed — Ollama unavailable.'
    }

    const data = await resp.json()
    return data.response || 'No insights generated.'
  } catch (err) {
    console.warn('[Dream] Consolidate failed:', err)
    return 'Dream consolidation interrupted.'
  }
}

/**
 * Phase 4: Prune — save dream insight to KNIGHTSWATCH memory service.
 */
async function prunePhase(insight: string, signal: AbortSignal): Promise<boolean> {
  if (!insight || insight.includes('failed') || insight.includes('interrupted')) {
    return false
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const onAbort = () => controller.abort()
    signal.addEventListener('abort', onAbort)

    const resp = await fetch(`${memoryUrl()}/memory/save_batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'dream',
        source: 'dream',
        messages: [
          { role: 'system', content: `Dream insight: ${insight}` },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    signal.removeEventListener('abort', onAbort)

    return resp.ok
  } catch (err) {
    console.warn('[Dream] Prune save failed:', err)
    return false
  }
}

/**
 * Get the current or most recent dream result.
 */
export function getCurrentDream(): DreamResult | null {
  return currentDream ? { ...currentDream } : null
}

/**
 * Subscribe to dream state changes.
 */
export function onDreamUpdate(listener: DreamListener): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}
