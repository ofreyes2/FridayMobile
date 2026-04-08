/**
 * Friday Context Builder - Dynamic Prompt Composition
 * Pattern 4: Dynamic system prompt builder (Claude Code systemPrompt.ts)
 *
 * Builds system prompts from multiple composable sections:
 * - Base personality
 * - Current context (date, location)
 * - Typed memories (dynamically selected)
 * - Active tasks
 * - User context
 * - Model capabilities
 * - Reasoning mode (topic-sensitive)
 */

import type { FridayMemory, FridayPersonality, UserSettings, FridayTask } from './types'

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
 * Pattern 4: Composable sections from Claude Code systemPrompt.ts
 */
export function buildFridaySystemPrompt(
  basePrompt: string,
  personality: FridayPersonality,
  recentMemories: FridayMemory[],
  userSettings: UserSettings,
  ollamaModel: string,
  interactionCount: number = 0,
  userInput?: string,
  activeTasks?: FridayTask[]
): string {
  const sections = [
    // Base behavior with dynamic username
    basePrompt.replace(/Oscar/g, userSettings.name || 'friend'),

    // Personality section
    buildPersonalitySection(personality, interactionCount),

    // Memory section (typed and grouped)
    buildMemorySection(recentMemories),

    // User context section
    buildUserContextSection(userSettings),

    // Active tasks section (Pattern 3)
    ...(activeTasks && activeTasks.length > 0
      ? [buildActiveTasksSection(activeTasks)]
      : []),

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
 * Memory section: Include recent interactions grouped by type
 * Pattern 1: Typed memories from Claude Code
 */
function buildMemorySection(memories: FridayMemory[]): string {
  if (memories.length === 0) return ''

  const grouped = groupMemoriesByType(memories)

  const typeLabels: Record<string, string> = {
    user: 'About Oscar',
    feedback: 'How to Behave',
    project: 'Active Projects',
    reference: 'Reference Info',
  }

  return `## Context from Memory

${Object.entries(grouped)
  .map(([type, mems]) => {
    const title = typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)
    return `### ${title}\n${mems.map(m => `- ${m.content}`).join('\n')}`
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
 * Active tasks section (Pattern 3: Task awareness in prompt)
 */
function buildActiveTasksSection(tasks: FridayTask[]): string {
  const lines = tasks.map(t => {
    const elapsed = Math.round((Date.now() - t.startTime) / 1000)
    return `- [${t.status}] ${t.description} (${elapsed}s elapsed)`
  })

  return `## Active Background Tasks

${lines.join('\n')}

You have tasks running in the background. You can mention their status if relevant.`
}

/**
 * Model capabilities: Document what Friday can and cannot do
 */
function buildModelCapabilitiesSection(modelName: string): string {
  return `## Model: ${modelName}

You are running locally on KNIGHTSWATCH via Ollama without internet access.

Capabilities:
- Analysis, writing, problem-solving, and coding
- Conversation history and learning from interactions
- Pattern matching and reasoning with your training knowledge

Current Limitations:
- You don't have access to real-time information, current events, or live web data
- If asked about recent information or current events, clearly explain that you're a local AI without internet access
- Feel free to suggest that the user can enable web search by connecting an external API if they need real-time data

Simply state your capabilities clearly and offer what help you can with your training knowledge.`
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
 * Now returns typed memories (Pattern 1)
 */
export function extractLearningsFromResponse(
  userInput: string,
  assistantResponse: string,
  _personality: FridayPersonality
): { type: 'user' | 'feedback' | 'project' | 'reference'; content: string; score: number }[] {
  const learnings: { type: 'user' | 'feedback' | 'project' | 'reference'; content: string; score: number }[] = []

  const lowerInput = userInput.toLowerCase()

  // Detect user preferences → feedback memory
  if (
    lowerInput.includes('prefer') ||
    lowerInput.includes('don\'t') ||
    lowerInput.includes('stop') ||
    lowerInput.includes('instead')
  ) {
    learnings.push({
      type: 'feedback',
      content: `User correction/preference: "${userInput}"`,
      score: 0.8,
    })
  }

  // Detect personal info → user memory
  if (
    lowerInput.includes('i like') ||
    lowerInput.includes('i am') ||
    lowerInput.includes('my name') ||
    lowerInput.includes('i work')
  ) {
    learnings.push({
      type: 'user',
      content: `Personal info shared: "${userInput}"`,
      score: 0.7,
    })
  }

  // Detect "remember" requests → reference memory
  if (
    lowerInput.includes('remember') ||
    assistantResponse.toLowerCase().includes('remember:') ||
    assistantResponse.toLowerCase().includes('noted')
  ) {
    learnings.push({
      type: 'reference',
      content: `Remember request: "${userInput}"`,
      score: 0.9,
    })
  }

  // Detect project work → project memory
  if (
    lowerInput.includes('working on') ||
    lowerInput.includes('project') ||
    lowerInput.includes('deadline') ||
    lowerInput.includes('deploy')
  ) {
    learnings.push({
      type: 'project',
      content: `Project mention: "${userInput.substring(0, 120)}"`,
      score: 0.7,
    })
  }

  return learnings
}

/**
 * Get warmth level description based on interaction count
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
