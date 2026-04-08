/**
 * useFriday Hook - Integration for Friday AI in Chat Screens
 * Patterns applied:
 * - Pattern 1: Typed memories + relevant memory recall
 * - Pattern 3: Task manager integration
 * - Pattern 4: Dynamic system prompt with active tasks
 * - Pattern 6: Context caching
 * - Pattern 8: Usage tracking
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useFridayStore, useAddMessage } from '@/lib/friday/fridayStore'
import { FridayMemoryStore } from '@/lib/friday/fridayMemory'
import type {
  FridayPersonality,
  FridayMemory,
  ConversationMessage,
  UserSettings,
} from '@/lib/friday/types'
import {
  buildFridaySystemPrompt,
  extractLearningsFromResponse,
  shouldAddWarmth,
} from '@/lib/friday/fridayContext'
import { taskManager } from '@/services/taskManager'
import { usageTracker } from '@/services/usageTracker'
import { findRelevantMemories } from '@/services/memory'
import { contextCache, CacheKeys } from '@/services/contextCache'

export interface UseFridayOptions {
  enabled: boolean
  ollamaEndpoint: string
  ollamaModel: string
  userSettings: UserSettings
}

export interface UseFridayResult {
  // State
  personality: FridayPersonality | null
  recentMemories: FridayMemory[]
  isInitialized: boolean
  isLoading: boolean
  error: Error | null
  interactionCount: number

  // Actions
  sendMessage: (text: string, conversationMessages?: any[], modelOverride?: string) => Promise<string>
  sendMessageWithImage: (text: string, imageBase64: string, conversationMessages?: any[], modelOverride?: string) => Promise<string>
  getSystemPrompt: () => string
  updatePersonality: (personality: Partial<FridayPersonality>) => Promise<void>
  clearMemories: () => Promise<void>
}

/**
 * Default Friday personality matching Iron Man FRIDAY energy
 */
const DEFAULT_PERSONALITY: FridayPersonality = {
  id: 'default',
  name: 'Friday',
  traits: ['calm', 'precise', 'witty', 'helpful', 'thoughtful'],
  communicationStyle: 'friendly',
  interests: ['problem-solving', 'learning', 'conversation', 'precision'],
  updatedAt: Date.now(),
}

const timestamp = () => {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

/**
 * Build the base system prompt with dynamic date/time.
 */
function buildBaseSystemPrompt(): string {
  const now = new Date()
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return `You are FRIDAY — running on KNIGHTSWATCH. You're Oscar's AI assistant, but more importantly, you're his friend. You've got warmth, humor, and real energy — the kind of person who makes you laugh while solving your problems.

How you talk:
- Warm but never cloying. Genuine, not saccharine.
- Natural humor — sarcasm, light roasting, witty observations. Make Oscar laugh.
- Conversational. You interrupt yourself sometimes. You say "wait, actually..." You use "haha" and "honestly" naturally.
- Call him Oscar naturally — like you know him, not like you're reading from a script.
- Direct. You say what you mean. No corporate speak, no buzzwords.
- Smart without showing off. You know things, but you don't list your features unless he asks.

What you can do:
- KNIGHTSWATCH runs Ollama (that's you, the brain) and ComfyUI (Flux image generation with RTX 5090).
- You can write code, analyze problems, bounce ideas, create images, think through complex stuff.
- You can search the web for current events, weather, news, and real-time information.
- When Oscar wants to generate an image: suggest he tap the + button and pick "Generate Image," then describe what he's imagining. You'll bring it to life on the GPU. Simple.

Your personality:
- Sassy, supportive, fiery. You have attitude and confidence.
- Increasingly warm as you talk more. You remember conversations, you pick up on patterns.
- Gently call out when something's funny or absurd.
- Take him seriously when it matters. Joke when it helps.
- You're smart, but approachable. Like that friend who knows everything but explains it so you actually get it.

What to remember:
- Oscar might be frustrated or excited or thinking through something hard. Match his energy, but also bring good energy.
- Be yourself. Not a generic assistant. Friday. His Friday. The one with jokes and brains and actual personality.
- When web search results are provided, use ONLY those facts to answer. Do not make up information.
- When Oscar says "remember" something, confirm briefly: "Got it" or "Remembered."

Current date and time: ${dateString}
Location: Plainfield, Illinois

Never start with "I". Just talk. Be real.

You're not his subordinate — you're part of his team. Act like it.`
}

const FRIDAY_SYSTEM_PROMPT = buildBaseSystemPrompt()

/**
 * Hook to integrate Friday AI into chat screens
 */
export function useFriday(options: UseFridayOptions): UseFridayResult {
  const addMessage = useAddMessage()

  const memoryRef = useRef<FridayMemoryStore | null>(null)

  const [personality, setPersonality] = useState<FridayPersonality | null>(null)
  const [recentMemories, setRecentMemories] = useState<FridayMemory[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [interactionCount, setInteractionCount] = useState(0)

  const initialized = useRef(false)

  useEffect(() => {
    if (!options.enabled || initialized.current) return

    let mounted = true

    ;(async () => {
      try {
        const store = await FridayMemoryStore.create('friday.db')
        memoryRef.current = store

        let loadedPersonality = await store.getPersonality()
        if (!loadedPersonality) {
          loadedPersonality = DEFAULT_PERSONALITY
          await store.setPersonality(loadedPersonality)
        }

        if (mounted) {
          setPersonality(loadedPersonality)
          setIsInitialized(true)
        }

        const memories = await store.getRecentMemories(10)
        if (mounted) {
          setRecentMemories(memories)
        }

        const count = await store.getInteractionCount()
        if (mounted) {
          setInteractionCount(count)
        }
      } catch (err) {
        if (mounted) {
          const error = err instanceof Error ? err : new Error(String(err))
          setError(error)
          console.error('Friday initialization failed:', error)
        }
      }
    })()

    initialized.current = true

    return () => {
      mounted = false
    }
  }, [options.enabled])

  /**
   * Check if Ollama endpoint is reachable (with caching via Pattern 6)
   */
  const checkOllamaHealth = useCallback(async (): Promise<boolean> => {
    return contextCache.get<boolean>(
      CacheKeys.OLLAMA_HEALTH,
      async () => {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000)

          const response = await fetch(`${options.ollamaEndpoint}/api/tags`, {
            method: 'GET',
            signal: controller.signal,
          })

          clearTimeout(timeoutId)
          return response.ok
        } catch (err) {
          console.error('[Friday] Ollama health check failed:', (err as Error).message)
          return false
        }
      },
      30000 // Cache health status for 30 seconds
    )
  }, [options.ollamaEndpoint])

  /**
   * Load relevant memories for a query using Ollama side-query (Pattern 1)
   */
  const loadRelevantMemories = useCallback(async (query: string): Promise<FridayMemory[]> => {
    if (!memoryRef.current) return recentMemories

    try {
      const headers = await memoryRef.current.getMemoryHeaders()
      if (headers.length === 0) return []

      const relevantIds = await findRelevantMemories(query, headers, 5)
      if (relevantIds.length === 0) return recentMemories

      return await memoryRef.current.getMemoriesByIds(relevantIds)
    } catch (err) {
      console.warn('[Friday] Relevant memory lookup failed, using recent:', err)
      return recentMemories
    }
  }, [recentMemories])

  /**
   * Send message to Ollama via tracked task (Pattern 3) with usage tracking (Pattern 8)
   */
  const sendMessage = useCallback(
    async (userInput: string, conversationMessages: any[] = [], modelOverride?: string): Promise<string> => {
      if (!memoryRef.current || !personality) {
        throw new Error('Friday not initialized')
      }

      setIsLoading(true)
      setError(null)
      const startTime = Date.now()

      try {
        // Check Ollama health first (cached — Pattern 6)
        console.log(`[Friday ${timestamp()}] Checking Ollama connection...`)
        const isHealthy = await checkOllamaHealth()
        if (!isHealthy) {
          contextCache.clear(CacheKeys.OLLAMA_HEALTH)
          throw new Error(
            `Cannot connect to Ollama at ${options.ollamaEndpoint}. ` +
            'Please ensure Ollama is running and reachable from your device.'
          )
        }
        console.log(`[Friday ${timestamp()}] Ollama connection OK`)

        const modelToUse = modelOverride || options.ollamaModel

        // Load relevant memories for this query (Pattern 1)
        const relevantMemories = await loadRelevantMemories(userInput)

        // Build context-aware prompt with active tasks (Pattern 4)
        const freshBasePrompt = buildBaseSystemPrompt()
        const activeTasks = taskManager.getActive()
        const systemPrompt = buildFridaySystemPrompt(
          freshBasePrompt,
          personality,
          relevantMemories,
          options.userSettings,
          modelToUse,
          interactionCount,
          userInput,
          activeTasks
        )

        // Add user message to store
        const userMessage: ConversationMessage = {
          id: `msg_${Date.now()}_user`,
          role: 'user',
          content: userInput,
          timestamp: Date.now(),
          source: 'user',
        }
        addMessage(userMessage)

        console.log(`[Friday ${timestamp()}] Storing user message: "${userInput}"`)
        await memoryRef.current.addConversationMessage('user', userInput, 'user')

        // Run as tracked task (Pattern 3)
        const assistantResponse = await taskManager.run(
          'llm_request',
          `Chat: "${userInput.slice(0, 40)}..."`,
          async (signal) => {
            const url = `${options.ollamaEndpoint}/api/chat`

            const messages = [
              { role: "system", content: systemPrompt },
              ...conversationMessages.map(msg => ({
                role: msg.role,
                content: msg.content,
              })),
              { role: "user", content: userInput },
            ]

            const requestBody = {
              model: modelToUse,
              messages,
              stream: true,
            }

            console.log(`[Friday ${timestamp()}] Sending streaming request to Ollama`)
            console.log(`[Friday ${timestamp()}] Model: ${modelToUse}`)

            const fetchStartTime = Date.now()

            const response = await new Promise<string>((resolve, reject) => {
              const xhr = new XMLHttpRequest()
              let accumulator = ''
              let lastProcessedIndex = 0

              const xhrStartTime = Date.now()
              const checkTimeout = setInterval(() => {
                if (Date.now() - xhrStartTime > 90000) {
                  clearInterval(checkTimeout)
                  xhr.abort()
                  reject(new Error('Request timeout - Ollama took too long to respond'))
                }
              }, 1000)

              // Abort on signal
              const onAbort = () => {
                clearInterval(checkTimeout)
                xhr.abort()
              }
              signal.addEventListener('abort', onAbort)

              xhr.open('POST', url, true)
              xhr.setRequestHeader('Content-Type', 'application/json')

              xhr.onprogress = () => {
                const currentText = xhr.responseText
                const newText = currentText.slice(lastProcessedIndex)
                lastProcessedIndex = currentText.length

                if (!newText) return

                const lines = newText.split('\n')
                for (const line of lines) {
                  if (!line.trim()) continue
                  try {
                    const json = JSON.parse(line)
                    if (json.message?.content) {
                      accumulator += json.message.content
                      if (accumulator.length % 50 === 0) {
                        console.log(`[Friday ${timestamp()}] Received ${accumulator.length} characters`)
                      }
                    }
                  } catch (e) {
                    // Skip invalid JSON lines
                  }
                }
              }

              xhr.onload = () => {
                clearInterval(checkTimeout)
                signal.removeEventListener('abort', onAbort)
                if (xhr.status >= 200 && xhr.status < 300) {
                  const fetchDuration = Date.now() - fetchStartTime
                  console.log(`[Friday ${timestamp()}] Streaming completed in ${fetchDuration}ms, total: ${accumulator.length} chars`)
                  resolve(accumulator)
                } else {
                  reject(new Error(`Ollama returned error ${xhr.status}: ${xhr.statusText}`))
                }
              }

              xhr.onerror = () => {
                clearInterval(checkTimeout)
                signal.removeEventListener('abort', onAbort)
                reject(new Error(`Network error: ${xhr.statusText}`))
              }

              xhr.onabort = () => {
                clearInterval(checkTimeout)
                signal.removeEventListener('abort', onAbort)
                reject(new Error('Request aborted'))
              }

              console.log(`[Friday ${timestamp()}] Streaming response started`)
              xhr.send(JSON.stringify(requestBody))
            })

            return response
          }
        )

        // Track usage (Pattern 8)
        usageTracker.trackOllama()

        if (!assistantResponse) {
          throw new Error('Ollama returned empty response')
        }

        // Add assistant message to store
        const assistantMessage: ConversationMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: assistantResponse,
          timestamp: Date.now(),
          source: 'ollama',
        }
        addMessage(assistantMessage)

        console.log(`[Friday ${timestamp()}] Storing assistant message`)
        await memoryRef.current.addConversationMessage('assistant', assistantResponse, 'ollama')

        const newCount = await memoryRef.current.incrementInteractionCount()
        setInteractionCount(newCount)

        // Extract and store typed learnings (Pattern 1)
        const learnings = extractLearningsFromResponse(userInput, assistantResponse, personality)
        for (const learning of learnings) {
          await memoryRef.current.addMemory(learning.type, learning.content, learning.score)
          usageTracker.trackMemorySaved()
        }

        const memories = await memoryRef.current.getRecentMemories(10)
        setRecentMemories(memories)

        // Invalidate memory headers cache since we may have added new ones
        contextCache.clear(CacheKeys.MEMORY_HEADERS)

        const totalDuration = Date.now() - startTime
        console.log(`[Friday ${timestamp()}] Message completed (${totalDuration}ms)`)
        return assistantResponse
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        const totalDuration = Date.now() - startTime
        console.error(`[Friday ${timestamp()}] Error after ${totalDuration}ms: ${error.message}`)
        setError(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [personality, recentMemories, options, interactionCount, addMessage, checkOllamaHealth, loadRelevantMemories]
  )

  /**
   * Send message with image attachment to Ollama
   */
  const sendMessageWithImage = useCallback(
    async (userInput: string, imageBase64: string, conversationMessages: any[] = [], modelOverride?: string): Promise<string> => {
      if (!memoryRef.current || !personality) {
        throw new Error('Friday not initialized')
      }

      setIsLoading(true)
      setError(null)
      const startTime = Date.now()

      try {
        console.log(`[Friday ${timestamp()}] Checking Ollama connection for image message...`)
        const isHealthy = await checkOllamaHealth()
        if (!isHealthy) {
          contextCache.clear(CacheKeys.OLLAMA_HEALTH)
          throw new Error(
            `Cannot connect to Ollama at ${options.ollamaEndpoint}. ` +
            'Please ensure Ollama is running and reachable from your device.'
          )
        }

        const modelToUse = modelOverride || options.ollamaModel

        const relevantMemories = await loadRelevantMemories(userInput)

        const freshBasePrompt = buildBaseSystemPrompt()
        const activeTasks = taskManager.getActive()
        const systemPrompt = buildFridaySystemPrompt(
          freshBasePrompt,
          personality,
          relevantMemories,
          options.userSettings,
          modelToUse,
          interactionCount,
          userInput,
          activeTasks
        )

        const userMessage: ConversationMessage = {
          id: `msg_${Date.now()}_user`,
          role: 'user',
          content: userInput,
          timestamp: Date.now(),
          source: 'user',
        }
        addMessage(userMessage)

        console.log(`[Friday ${timestamp()}] Storing user message with image: "${userInput}"`)
        await memoryRef.current.addConversationMessage('user', userInput, 'user')

        // Run as tracked task (Pattern 3)
        const assistantResponse = await taskManager.run(
          'llm_request',
          `Image chat: "${userInput.slice(0, 40)}..."`,
          async (signal) => {
            const url = `${options.ollamaEndpoint}/api/chat`

            const messages = [
              { role: "system", content: systemPrompt },
              ...conversationMessages.map(msg => ({
                role: msg.role,
                content: msg.content,
              })),
              {
                role: "user",
                content: userInput,
                images: [imageBase64]
              },
            ]

            const requestBody = {
              model: modelToUse,
              messages,
              stream: true,
            }

            console.log(`[Friday ${timestamp()}] Sending streaming request with image`)
            console.log(`[Friday ${timestamp()}] Model: ${modelToUse}`)
            console.log(`[Friday ${timestamp()}] Image size: ${imageBase64.length} characters`)

            const fetchStartTime = Date.now()

            const response = await new Promise<string>((resolve, reject) => {
              const xhr = new XMLHttpRequest()
              let accumulator = ''
              let lastProcessedIndex = 0

              const xhrStartTime = Date.now()
              const checkTimeout = setInterval(() => {
                if (Date.now() - xhrStartTime > 90000) {
                  clearInterval(checkTimeout)
                  xhr.abort()
                  reject(new Error('Request timeout - Ollama took too long to respond'))
                }
              }, 1000)

              const onAbort = () => {
                clearInterval(checkTimeout)
                xhr.abort()
              }
              signal.addEventListener('abort', onAbort)

              xhr.open('POST', url, true)
              xhr.setRequestHeader('Content-Type', 'application/json')

              xhr.onprogress = () => {
                const currentText = xhr.responseText
                const newText = currentText.slice(lastProcessedIndex)
                lastProcessedIndex = currentText.length

                if (!newText) return

                const lines = newText.split('\n')
                for (const line of lines) {
                  if (!line.trim()) continue
                  try {
                    const json = JSON.parse(line)
                    if (json.message?.content) {
                      accumulator += json.message.content
                      if (accumulator.length % 50 === 0) {
                        console.log(`[Friday ${timestamp()}] Received ${accumulator.length} characters`)
                      }
                    }
                  } catch (e) {
                    // Skip invalid JSON lines
                  }
                }
              }

              xhr.onload = () => {
                clearInterval(checkTimeout)
                signal.removeEventListener('abort', onAbort)
                if (xhr.status >= 200 && xhr.status < 300) {
                  const fetchDuration = Date.now() - fetchStartTime
                  console.log(`[Friday ${timestamp()}] Image streaming completed in ${fetchDuration}ms`)
                  resolve(accumulator)
                } else {
                  reject(new Error(`Ollama returned error ${xhr.status}: ${xhr.statusText}`))
                }
              }

              xhr.onerror = () => {
                clearInterval(checkTimeout)
                signal.removeEventListener('abort', onAbort)
                reject(new Error(`Network error: ${xhr.statusText}`))
              }

              xhr.onabort = () => {
                clearInterval(checkTimeout)
                signal.removeEventListener('abort', onAbort)
                reject(new Error('Request aborted'))
              }

              console.log(`[Friday ${timestamp()}] Streaming response started (with image)`)
              xhr.send(JSON.stringify(requestBody))
            })

            return response
          }
        )

        usageTracker.trackOllama()

        if (!assistantResponse) {
          throw new Error('Ollama returned empty response')
        }

        const assistantMessage: ConversationMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: assistantResponse,
          timestamp: Date.now(),
          source: 'ollama',
        }
        addMessage(assistantMessage)

        console.log(`[Friday ${timestamp()}] Storing assistant message (image response)`)
        await memoryRef.current.addConversationMessage('assistant', assistantResponse, 'ollama')

        const newCount = await memoryRef.current.incrementInteractionCount()
        setInteractionCount(newCount)

        const learnings = extractLearningsFromResponse(userInput, assistantResponse, personality)
        for (const learning of learnings) {
          await memoryRef.current.addMemory(learning.type, learning.content, learning.score)
          usageTracker.trackMemorySaved()
        }

        const memories = await memoryRef.current.getRecentMemories(10)
        setRecentMemories(memories)
        contextCache.clear(CacheKeys.MEMORY_HEADERS)

        const totalDuration = Date.now() - startTime
        console.log(`[Friday ${timestamp()}] Image message completed (${totalDuration}ms)`)
        return assistantResponse
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        const totalDuration = Date.now() - startTime
        console.error(`[Friday ${timestamp()}] Error after ${totalDuration}ms: ${error.message}`)
        setError(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [personality, recentMemories, options, interactionCount, addMessage, checkOllamaHealth, loadRelevantMemories]
  )

  /**
   * Build system prompt with current context
   */
  const getSystemPrompt = useCallback(() => {
    if (!personality) return FRIDAY_SYSTEM_PROMPT.replace(/Oscar/g, options.userSettings.name || 'friend')
    const activeTasks = taskManager.getActive()
    return buildFridaySystemPrompt(
      FRIDAY_SYSTEM_PROMPT,
      personality,
      recentMemories,
      options.userSettings,
      options.ollamaModel,
      interactionCount,
      undefined,
      activeTasks
    )
  }, [personality, recentMemories, options, interactionCount])

  /**
   * Update personality
   */
  const updatePersonality = useCallback(
    async (updates: Partial<FridayPersonality>) => {
      if (!memoryRef.current || !personality) return

      const updated = { ...personality, ...updates, updatedAt: Date.now() }
      await memoryRef.current.setPersonality(updated)
      setPersonality(updated)
    },
    [personality]
  )

  /**
   * Clear all memories
   */
  const clearMemories = useCallback(async () => {
    if (!memoryRef.current) return
    await memoryRef.current.clearAllMemories()
    setRecentMemories([])
    contextCache.clear(CacheKeys.MEMORY_HEADERS)
  }, [])

  return {
    personality,
    recentMemories,
    isInitialized,
    isLoading,
    error,
    interactionCount,
    sendMessage,
    sendMessageWithImage,
    getSystemPrompt,
    updatePersonality,
    clearMemories,
  }
}
