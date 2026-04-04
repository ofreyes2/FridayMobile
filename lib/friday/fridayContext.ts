/**
 * Friday Context Builder - Dynamic Prompt Composition
 * Pattern: Composable sections from Claude Code prompts.ts
 */

import type { FridayMemory, FridayPersonality, UserSettings } from './types'

/**
 * Detect if user is asking a question that requires deep reasoning
 */
function isDeepReasoningTopic(input: string): boolean {
  const deepTopics = [
    'physics', 'math', 'astronomy', 'black hole', 'quantum',
    'theory', 'equation', 'calculate', 'prove', 'derive',
    'relativity', 'thermodynamics', 'quantum mechanics',
    'philosophy', 'proof', 'theorem'
  ]
  const lowerInput = input.toLowerCase()
  return deepTopics.some(topic => lowerInput.includes(topic))
}

/**
 * Build Friday's system prompt dynamically with personality and context
 * Pattern: Dynamic prompt composition from Claude Code
 */
export function buildFridaySystemPrompt(
  basePrompt: string,
  personality: FridayPersonality,
  recentMemories: FridayMemory[],
  userSettings: UserSettings,
  ollamaModel: string,
  interactionCount: number = 0,
  userInput?: string
): string {
  const sections = [
    // Base behavior with dynamic username
    basePrompt.replace(/Oscar/g, userSettings.name || 'friend'),

    // Personality section
    buildPersonalitySection(personality, interactionCount),

    // Memory section
    buildMemorySection(recentMemories),

    // User context section
    buildUserContextSection(userSettings),

    // Reasoning mode section (if topic detected)
    ...(userInput && isDeepReasoningTopic(userInput)
      ? [buildDeepReasoningSection()]
      : []),

    // Model capabilities note
    buildModelCapabilitiesSection(ollamaModel),
  ]

  return sections.filter(s => s.length > 0).join('\n\n')
}

/**
 * Deep reasoning section for complex topics
 */
function buildDeepReasoningSection(): string {
  return `## Reasoning Mode

This appears to be a complex topic. Please:
- Think step by step through your reasoning
- Show your work and logic
- Don't worry about being too verbose - depth is valued here
- Explain concepts clearly even if it takes longer
- Use analogies and examples to clarify complex ideas`
}

/**
 * Friday's personality section: Dynamic based on configuration and warmth
 */
function buildPersonalitySection(personality: FridayPersonality, interactionCount: number): string {
  // Adjust warmth based on interaction count
  const warmthLevel = getWarmthLevel(interactionCount)

  return `## Your Personality

Name: ${personality.name}

Traits:
${personality.traits.map(t => `- ${t}`).join('\n')}

Communication Style: ${personality.communicationStyle.charAt(0).toUpperCase() + personality.communicationStyle.slice(1)}

Warmth Level: ${warmthLevel} (based on ${interactionCount} interactions - grow warmer over time)

Interests:
${personality.interests.map(i => `- ${i}`).join('\n')}`
}

/**
 * Memory section: Include recent interactions for context
 * Pattern: Runtime context from Claude Code
 */
function buildMemorySection(memories: FridayMemory[]): string {
  if (memories.length === 0) return ''

  const grouped = groupMemoriesByType(memories)

  return `## Context from Previous Interactions

${Object.entries(grouped)
  .map(([type, mems]) => {
    const title = type.charAt(0).toUpperCase() + type.slice(1)
    return `### ${title}s\n${mems.map(m => `- ${m.content}`).join('\n')}`
  })
  .join('\n\n')}`
}

/**
 * User context: Personalize based on user settings
 */
function buildUserContextSection(settings: UserSettings): string {
  return `## User Context

Name: ${settings.name}
Timezone: ${settings.timezone}

Preferences:
${Object.entries(settings.preferences)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}`
}

/**
 * Model capabilities: Document what Friday can and cannot do
 */
function buildModelCapabilitiesSection(modelName: string): string {
  return `## Model: ${modelName}

You are running locally via Ollama. Remember:
- You have no internet access
- You cannot execute code or run commands
- You can help with analysis, writing, and problem-solving
- You can maintain conversation history and learn from interactions`
}

/**
 * Group memories by type for better readability
 */
function groupMemoriesByType(
  memories: FridayMemory[]
): Record<string, FridayMemory[]> {
  return memories.reduce(
    (acc, mem) => {
      if (!acc[mem.type]) acc[mem.type] = []
      acc[mem.type].push(mem)
      return acc
    },
    {} as Record<string, FridayMemory[]>
  )
}

/**
 * Extract learnings from conversation for memory storage
 * Pattern: Context extraction from Claude Code
 */
export function extractLearningsFromResponse(
  userInput: string,
  assistantResponse: string,
  personality: FridayPersonality
): { type: 'preference' | 'fact' | 'learning'; content: string; score: number }[] {
  const learnings: { type: 'preference' | 'fact' | 'learning'; content: string; score: number }[] = []

  // Detect preference mentions (simple heuristic)
  if (
    userInput.toLowerCase().includes('prefer') ||
    userInput.toLowerCase().includes('like') ||
    userInput.toLowerCase().includes('dislike')
  ) {
    learnings.push({
      type: 'preference',
      content: `User expressed preference: "${userInput}"`,
      score: 0.7,
    })
  }

  // Detect factual information in response
  if (
    assistantResponse.toLowerCase().includes('remember:') ||
    assistantResponse.toLowerCase().includes('note:')
  ) {
    const firstLine = assistantResponse.split('\n')[0]
    learnings.push({
      type: 'fact',
      content: firstLine,
      score: 0.8,
    })
  }

  // Detect learning from complex questions
  if (userInput.length > 50 && userInput.includes('?')) {
    learnings.push({
      type: 'learning',
      content: `Answered question: "${userInput.substring(0, 100)}..."`,
      score: 0.6,
    })
  }

  return learnings
}

/**
 * Get warmth level description based on interaction count
 * Friday gets warmer over time as trust builds
 */
function getWarmthLevel(count: number): string {
  if (count === 0) return 'Cool & Professional (First Interaction)'
  if (count < 5) return 'Warming Up (Building Rapport)'
  if (count < 15) return 'Friendly (Established Relationship)'
  if (count < 30) return 'Warm (Close Collaboration)'
  return 'Very Warm (Deep Trust)'
}

/**
 * Check if Friday should add warmer language based on interaction count
 */
export function shouldAddWarmth(interactionCount: number): boolean {
  return interactionCount >= 5
}

/**
 * Get warmth-adjusted response prefix
 */
export function getWarmthPrefix(interactionCount: number): string {
  if (interactionCount < 5) {
    return '' // Professional, no extra warmth
  } else if (interactionCount < 15) {
    return '' // Slightly warmer, but still professional
  } else {
    return '' // Can be more personable
  }
}
