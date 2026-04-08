/**
 * useFriday Hook - Integration for Friday AI in Chat Screens
 * Pattern: Single-run initialization + subscriptions (Claude Code pattern)
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
 * Calm, precise, dry wit, gets warmer over time
 */
const DEFAULT_PERSONALITY: FridayPersonality = {
  id: 'default',
  name: 'Friday',
  traits: ['calm', 'precise', 'witty', 'helpful', 'thoughtful'],
  communicationStyle: 'friendly',
  interests: ['problem-solving', 'learning', 'conversation', 'precision'],
  updatedAt: Date.now(),
}

/**
 * Helper to format timestamps as HH:MM:SS.mmm
 */
const timestamp = () => {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

/**
 * Friday system prompt — warm, witty, confident personality
 */
/**
 * Build the base system prompt with dynamic date/time.
 */
function buildBaseSystemPrompt(): string {
  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

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

You're not his subordinate — you're part of his team. Act like it.`;
}

// Keep a reference for the hook's getSystemPrompt
const FRIDAY_SYSTEM_PROMPT = buildBaseSystemPrompt()

/**
 * Hook to integrate Friday AI into chat screens
 * Pattern: Single-run initialization + state subscriptions (Claude Code pattern)
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

  /**
   * One-time initialization
   * Pattern: useRef + useEffect for single-run (Claude Code pattern)
   */
  const initialized = useRef(false)

  useEffect(() => {
    if (!options.enabled || initialized.current) return

    let mounted = true

    ;(async () => {
      try {
        // Initialize memory store
        const store = await FridayMemoryStore.create('friday.db')
        memoryRef.current = store

        // Load personality
        let loadedPersonality = await store.getPersonality()
        if (!loadedPersonality) {
          loadedPersonality = DEFAULT_PERSONALITY
          await store.setPersonality(loadedPersonality)
        }

        if (mounted) {
          setPersonality(loadedPersonality)
          setIsInitialized(true)
        }

        // Load recent memories
        const memories = await store.getRecentMemories(10)
        if (mounted) {
          setRecentMemories(memories)
        }

        // Load interaction count for warmth
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

    // Cleanup on unmount
    return () => {
      mounted = false
    }
  }, [options.enabled])

  /**
   * Send message to Ollama and update memory
   */
  /**
   * Check if Ollama endpoint is reachable
   */
  const checkOllamaHealth = useCallback(async (): Promise<boolean> => {
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
  }, [options.ollamaEndpoint])

  const sendMessage = useCallback(
    async (userInput: string, conversationMessages: any[] = [], modelOverride?: string): Promise<string> => {
      if (!memoryRef.current || !personality) {
        throw new Error('Friday not initialized')
      }

      setIsLoading(true)
      setError(null)
      const startTime = Date.now()

      try {
        // Check Ollama health first
        console.log(`[Friday ${timestamp()}] Checking Ollama connection...`)
        const isHealthy = await checkOllamaHealth()
        if (!isHealthy) {
          throw new Error(
            `Cannot connect to Ollama at ${options.ollamaEndpoint}. ` +
            'Please ensure Ollama is running and reachable from your device.'
          )
        }
        console.log(`[Friday ${timestamp()}] Ollama connection OK`)

        // Use model override if provided, otherwise use default
        const modelToUse = modelOverride || options.ollamaModel

        // Build context-aware prompt with fresh date/time
        const freshBasePrompt = buildBaseSystemPrompt()
        const systemPrompt = buildFridaySystemPrompt(
          freshBasePrompt,
          personality,
          recentMemories,
          options.userSettings,
          modelToUse,
          interactionCount,
          userInput
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

        // Store user message
        console.log(`[Friday ${timestamp()}] Storing user message: "${userInput}"`)
        await memoryRef.current.addConversationMessage('user', userInput, 'user')

        // Call Ollama API with streaming enabled via XMLHttpRequest (React Native compatible)
        const url = `${options.ollamaEndpoint}/api/chat`

        // Build messages array with full conversation history
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
        console.log(`[Friday ${timestamp()}] Endpoint: ${url}`)
        console.log(`[Friday ${timestamp()}] Model: ${modelToUse}`)

        // Use XMLHttpRequest for React Native streaming compatibility
        const fetchStartTime = Date.now()

        const assistantResponse = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          let accumulator = ''
          let lastProcessedIndex = 0

          // Set 90 second timeout
          const startTime = Date.now()
          const checkTimeout = setInterval(() => {
            if (Date.now() - startTime > 90000) {
              clearInterval(checkTimeout)
              xhr.abort()
              reject(new Error('Request timeout - Ollama took too long to respond'))
            }
          }, 1000)

          xhr.open('POST', url, true)
          xhr.setRequestHeader('Content-Type', 'application/json')

          // Handle streaming progress
          xhr.onprogress = () => {
            const currentText = xhr.responseText
            const newText = currentText.slice(lastProcessedIndex)
            lastProcessedIndex = currentText.length

            if (!newText) return

            // Split by newline and parse JSONL format
            const lines = newText.split('\n')

            for (const line of lines) {
              if (!line.trim()) continue

              try {
                const json = JSON.parse(line)
                if (json.message?.content) {
                  const content = json.message.content
                  accumulator += content

                  // Log streaming progress
                  if (accumulator.length % 50 === 0) {
                    console.log(
                      `[Friday ${timestamp()}] Received ${accumulator.length} characters`
                    )
                  }
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }

          xhr.onload = () => {
            clearInterval(checkTimeout)

            if (xhr.status >= 200 && xhr.status < 300) {
              const fetchDuration = Date.now() - fetchStartTime
              console.log(
                `[Friday ${timestamp()}] Streaming completed in ${fetchDuration}ms, total response: ${accumulator.length} chars`
              )
              resolve(accumulator)
            } else {
              reject(
                new Error(`Ollama returned error ${xhr.status}: ${xhr.statusText}`)
              )
            }
          }

          xhr.onerror = () => {
            clearInterval(checkTimeout)
            reject(new Error(`Network error: ${xhr.statusText}`))
          }

          xhr.onabort = () => {
            clearInterval(checkTimeout)
            reject(new Error('Request aborted'))
          }

          console.log(`[Friday ${timestamp()}] Streaming response started`)
          xhr.send(JSON.stringify(requestBody))
        })

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

        // Store conversation message
        console.log(`[Friday ${timestamp()}] Storing assistant message`)
        await memoryRef.current.addConversationMessage(
          'assistant',
          assistantResponse,
          'ollama'
        )

        // Increment interaction count
        const newCount = await memoryRef.current.incrementInteractionCount()
        setInteractionCount(newCount)

        // Extract learnings from the interaction
        const learnings = extractLearningsFromResponse(
          userInput,
          assistantResponse,
          personality
        )

        for (const learning of learnings) {
          await memoryRef.current.addMemory(learning.type, learning.content, learning.score)
        }

        // Reload recent memories
        const memories = await memoryRef.current.getRecentMemories(10)
        setRecentMemories(memories)

        const totalDuration = Date.now() - startTime
        const ollamaStreamDuration = Date.now() - fetchStartTime
        console.log(`[Friday ${timestamp()}] ✓ Message completed successfully (total: ${totalDuration}ms, ollama: ${ollamaStreamDuration}ms)`)
        return assistantResponse
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        const totalDuration = Date.now() - startTime
        console.error(`[Friday ${timestamp()}] ✗ Error after ${totalDuration}ms: ${error.message}`)
        setError(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [personality, recentMemories, options, interactionCount, addMessage, checkOllamaHealth]
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
        // Check Ollama health first
        console.log(`[Friday ${timestamp()}] Checking Ollama connection for image message...`)
        const isHealthy = await checkOllamaHealth()
        if (!isHealthy) {
          throw new Error(
            `Cannot connect to Ollama at ${options.ollamaEndpoint}. ` +
            'Please ensure Ollama is running and reachable from your device.'
          )
        }
        console.log(`[Friday ${timestamp()}] Ollama connection OK`)

        // Use model override if provided, otherwise use default
        const modelToUse = modelOverride || options.ollamaModel

        // Build context-aware prompt with fresh date/time
        const freshBasePrompt = buildBaseSystemPrompt()
        const systemPrompt = buildFridaySystemPrompt(
          freshBasePrompt,
          personality,
          recentMemories,
          options.userSettings,
          modelToUse,
          interactionCount,
          userInput
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

        // Store user message
        console.log(`[Friday ${timestamp()}] Storing user message with image: "${userInput}"`)
        await memoryRef.current.addConversationMessage('user', userInput, 'user')

        // Call Ollama API with image included via XMLHttpRequest (React Native compatible)
        const url = `${options.ollamaEndpoint}/api/chat`

        // Build messages array with full conversation history and image
        const messages = [
          { role: "system", content: systemPrompt },
          ...conversationMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          {
            role: "user",
            content: userInput,
            images: [imageBase64] // Include image as base64
          },
        ]

        const requestBody = {
          model: modelToUse,
          messages,
          stream: true,
        }

        console.log(`[Friday ${timestamp()}] Sending streaming request with image to Ollama`)
        console.log(`[Friday ${timestamp()}] Endpoint: ${url}`)
        console.log(`[Friday ${timestamp()}] Model: ${modelToUse}`)
        console.log(`[Friday ${timestamp()}] Image size: ${imageBase64.length} characters`)

        // Use XMLHttpRequest for React Native streaming compatibility
        const fetchStartTime = Date.now()

        const assistantResponse = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          let accumulator = ''
          let lastProcessedIndex = 0

          // Set 90 second timeout
          const startTime = Date.now()
          const checkTimeout = setInterval(() => {
            if (Date.now() - startTime > 90000) {
              clearInterval(checkTimeout)
              xhr.abort()
              reject(new Error('Request timeout - Ollama took too long to respond'))
            }
          }, 1000)

          xhr.open('POST', url, true)
          xhr.setRequestHeader('Content-Type', 'application/json')

          // Handle streaming progress
          xhr.onprogress = () => {
            const currentText = xhr.responseText
            const newText = currentText.slice(lastProcessedIndex)
            lastProcessedIndex = currentText.length

            if (!newText) return

            // Split by newline and parse JSONL format
            const lines = newText.split('\n')

            for (const line of lines) {
              if (!line.trim()) continue

              try {
                const json = JSON.parse(line)
                if (json.message?.content) {
                  const content = json.message.content
                  accumulator += content

                  // Log streaming progress
                  if (accumulator.length % 50 === 0) {
                    console.log(
                      `[Friday ${timestamp()}] Received ${accumulator.length} characters`
                    )
                  }
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }

          xhr.onload = () => {
            clearInterval(checkTimeout)

            if (xhr.status >= 200 && xhr.status < 300) {
              const fetchDuration = Date.now() - fetchStartTime
              console.log(
                `[Friday ${timestamp()}] Image streaming completed in ${fetchDuration}ms, total response: ${accumulator.length} chars`
              )
              resolve(accumulator)
            } else {
              reject(
                new Error(`Ollama returned error ${xhr.status}: ${xhr.statusText}`)
              )
            }
          }

          xhr.onerror = () => {
            clearInterval(checkTimeout)
            reject(new Error(`Network error: ${xhr.statusText}`))
          }

          xhr.onabort = () => {
            clearInterval(checkTimeout)
            reject(new Error('Request aborted'))
          }

          console.log(`[Friday ${timestamp()}] Streaming response started (with image)`)
          xhr.send(JSON.stringify(requestBody))
        })

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

        // Store conversation message
        console.log(`[Friday ${timestamp()}] Storing assistant message (image response)`)
        await memoryRef.current.addConversationMessage(
          'assistant',
          assistantResponse,
          'ollama'
        )

        // Increment interaction count
        const newCount = await memoryRef.current.incrementInteractionCount()
        setInteractionCount(newCount)

        // Extract learnings from the interaction
        const learnings = extractLearningsFromResponse(
          userInput,
          assistantResponse,
          personality
        )

        for (const learning of learnings) {
          await memoryRef.current.addMemory(learning.type, learning.content, learning.score)
        }

        // Reload recent memories
        const memories = await memoryRef.current.getRecentMemories(10)
        setRecentMemories(memories)

        const totalDuration = Date.now() - startTime
        const ollamaStreamDuration = Date.now() - fetchStartTime
        console.log(`[Friday ${timestamp()}] ✓ Image message completed successfully (total: ${totalDuration}ms, ollama: ${ollamaStreamDuration}ms)`)
        return assistantResponse
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        const totalDuration = Date.now() - startTime
        console.error(`[Friday ${timestamp()}] ✗ Error after ${totalDuration}ms: ${error.message}`)
        setError(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [personality, recentMemories, options, interactionCount, addMessage, checkOllamaHealth]
  )

  /**
   * Build system prompt with current context
   */
  const getSystemPrompt = useCallback(() => {
    if (!personality) return FRIDAY_SYSTEM_PROMPT.replace(/Oscar/g, options.userSettings.name || 'friend')
    return buildFridaySystemPrompt(
      FRIDAY_SYSTEM_PROMPT,
      personality,
      recentMemories,
      options.userSettings,
      options.ollamaModel,
      interactionCount
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
