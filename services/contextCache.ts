/**
 * Context Cache Service (Pattern 6: Claude Code context.ts)
 *
 * TTL-based caching for expensive or frequently-accessed values:
 * location, voice profile, config, service health checks.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class ContextCache {
  private cache = new Map<string, CacheEntry<any>>()
  private defaultTTL: number

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTL
  }

  /**
   * Get a cached value, or fetch it if missing/expired.
   */
  async get<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    const now = Date.now()

    if (entry && entry.expiresAt > now) {
      return entry.data
    }

    const data = await fetcher()
    this.cache.set(key, {
      data,
      expiresAt: now + (ttl ?? this.defaultTTL),
    })
    return data
  }

  /**
   * Get a cached value synchronously (returns undefined if not cached).
   */
  peek<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data
    }
    return undefined
  }

  /**
   * Set a value directly.
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    })
  }

  /**
   * Invalidate a specific key or all keys.
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Check if a key is cached and not expired.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    return !!entry && entry.expiresAt > Date.now()
  }

  /**
   * Get cache stats for diagnostics.
   */
  stats(): { keys: number; entries: string[] } {
    const now = Date.now()
    const entries: string[] = []
    for (const [key, entry] of this.cache) {
      const ttlRemaining = Math.max(0, Math.round((entry.expiresAt - now) / 1000))
      entries.push(`${key}: ${ttlRemaining}s remaining`)
    }
    return { keys: this.cache.size, entries }
  }
}

/** Singleton context cache */
export const contextCache = new ContextCache()

// ─── Convenience cache keys ───

export const CacheKeys = {
  OLLAMA_HEALTH: 'ollama_health',
  OLLAMA_MODELS: 'ollama_models',
  CONNECTION_STATUS: 'connection_status',
  PROJECT_CONTEXT: 'project_context',
  MEMORY_HEADERS: 'memory_headers',
  DREAM_INSIGHT: 'dream_insight',
} as const
