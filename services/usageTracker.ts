/**
 * Usage Tracker Service (Pattern 8: Claude Code cost-tracker.ts)
 *
 * Tracks and displays session usage metrics.
 * Displayed on session end or via "Friday, status" command.
 */

import type { UsageStats } from '@/lib/friday/types'

class UsageTracker {
  private stats: UsageStats

  constructor() {
    this.stats = this.freshStats()
  }

  private freshStats(): UsageStats {
    return {
      ollamaRequests: 0,
      ttsRequests: 0,
      webSearches: 0,
      memoriesSaved: 0,
      imageGenerations: 0,
      sessionStart: Date.now(),
    }
  }

  trackOllama(): void {
    this.stats.ollamaRequests++
  }

  trackTTS(): void {
    this.stats.ttsRequests++
  }

  trackWebSearch(): void {
    this.stats.webSearches++
  }

  trackMemorySaved(): void {
    this.stats.memoriesSaved++
  }

  trackImageGeneration(): void {
    this.stats.imageGenerations++
  }

  getStats(): UsageStats {
    return { ...this.stats }
  }

  /**
   * Format a human-readable session summary.
   */
  summary(): string {
    const duration = Date.now() - this.stats.sessionStart
    return [
      `Session: ${formatDuration(duration)}`,
      `Ollama: ${this.stats.ollamaRequests} requests`,
      `TTS: ${this.stats.ttsRequests} requests`,
      `Searches: ${this.stats.webSearches}`,
      `Images: ${this.stats.imageGenerations}`,
      `Memories: ${this.stats.memoriesSaved} saved`,
    ].join('\n')
  }

  /**
   * Reset stats for a new session.
   */
  reset(): void {
    this.stats = this.freshStats()
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSecs = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSecs}s`
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  return `${hours}h ${remainingMins}m`
}

/** Singleton usage tracker instance */
export const usageTracker = new UsageTracker()
