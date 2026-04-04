/**
 * Friday AI Assistant - Shared Type Definitions
 */

export type FridayMemoryType = 'interaction' | 'preference' | 'fact' | 'learning'

export interface FridayMemory {
  id: string
  type: FridayMemoryType
  content: string
  timestamp: number
  relevanceScore: number
}

export interface FridayPersonality {
  id: string
  name: string
  traits: string[]
  communicationStyle: 'formal' | 'casual' | 'technical' | 'friendly'
  interests: string[]
  updatedAt: number
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  source: 'user' | 'ollama' | 'system'
}

export interface UserSettings {
  name: string
  preferences: Record<string, string>
  timezone: string
}

export interface FridayState {
  messages: ConversationMessage[]
  addMessage: (message: ConversationMessage) => void
  clearMessages: () => void
  getMessages: () => ConversationMessage[]
}
