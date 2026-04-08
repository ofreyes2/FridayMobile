/**
 * Friday AI Assistant - Shared Type Definitions
 * Pattern: Typed system from Claude Code architecture
 */

// ─── Memory Types (Pattern 1: Claude Code memoryTypes.ts) ───

export type FridayMemoryType = 'user' | 'feedback' | 'project' | 'reference'

/** Legacy types kept for migration compatibility */
export type LegacyMemoryType = 'interaction' | 'preference' | 'fact' | 'learning'

export interface FridayMemory {
  id: string
  type: FridayMemoryType
  content: string
  timestamp: number
  relevanceScore: number
}

// ─── Dream Types (Pattern 2: Claude Code DreamTask.ts) ───

export type DreamState = 'starting' | 'updating' | 'completed' | 'failed' | 'killed'

export type DreamPhase = 'orient' | 'gather' | 'consolidate' | 'prune'

export interface DreamResult {
  id: string
  state: DreamState
  phase: DreamPhase
  startedAt: number
  completedAt: number | null
  sessionsReviewed: number
  memoriesCreated: number
  memoriesPruned: number
  insight: string | null
}

// ─── Task Types (Pattern 3: Claude Code Task.ts) ───

export type FridayTaskType =
  | 'web_search'
  | 'image_gen'
  | 'file_create'
  | 'dream'
  | 'memory_save'
  | 'tts'
  | 'llm_request'

export type FridayTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed'

export interface FridayTask {
  id: string
  type: FridayTaskType
  status: FridayTaskStatus
  description: string
  startTime: number
  endTime: number | null
  error: string | null
}

// ─── Usage Tracking Types (Pattern 8: Claude Code cost-tracker.ts) ───

export interface UsageStats {
  ollamaRequests: number
  ttsRequests: number
  webSearches: number
  memoriesSaved: number
  imageGenerations: number
  sessionStart: number
}

// ─── Personality Types ───

export interface FridayPersonality {
  id: string
  name: string
  traits: string[]
  communicationStyle: 'formal' | 'casual' | 'technical' | 'friendly'
  interests: string[]
  updatedAt: number
}

// ─── Conversation Types ───

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  source: 'user' | 'ollama' | 'system'
}

// ─── Settings Types ───

export interface UserSettings {
  name: string
  preferences: Record<string, string>
  timezone: string
}

// ─── Store Types ───

export interface FridayState {
  messages: ConversationMessage[]
  addMessage: (message: ConversationMessage) => void
  clearMessages: () => void
  getMessages: () => ConversationMessage[]
}

// ─── Service Chain Types (Pattern 9) ───

export type ServiceTier = 'local' | 'cloud' | 'fallback'

export interface ServiceResult<T> {
  data: T
  tier: ServiceTier
  latencyMs: number
}
