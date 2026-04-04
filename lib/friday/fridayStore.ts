/**
 * Friday Store - Zustand-based Message State Management
 * Pattern: Minimal store from Claude Code store.ts adapted for Zustand
 */

import { create } from 'zustand'
import type { FridayState, ConversationMessage } from './types'

/**
 * Create Friday message store using Zustand
 * Pattern: Store with listener subscriptions (Claude Code pattern)
 */
export const useFridayStore = create<FridayState>((set, get) => ({
  messages: [],

  /**
   * Add a message to the store
   * Pattern: Immutable update from Claude Code
   */
  addMessage: (message: ConversationMessage) =>
    set(state => ({
      messages: [...state.messages, message],
    })),

  /**
   * Clear all messages
   */
  clearMessages: () =>
    set({
      messages: [],
    }),

  /**
   * Get all messages
   */
  getMessages: () => get().messages,
}))

/**
 * Hook to subscribe to message count changes
 * Useful for triggering side effects when new messages arrive
 */
export const useMessageCount = () =>
  useFridayStore(state => state.messages.length)

/**
 * Hook to get all messages
 */
export const useMessages = () => useFridayStore(state => state.messages)

/**
 * Hook to add a message
 */
export const useAddMessage = () => useFridayStore(state => state.addMessage)

/**
 * Hook to clear messages
 */
export const useClearMessages = () => useFridayStore(state => state.clearMessages)
