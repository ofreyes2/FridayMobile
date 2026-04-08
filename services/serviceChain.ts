/**
 * Service Chain — Graceful Degradation (Pattern 9: Claude Code error handling)
 *
 * Try primary -> fallback -> local, never crash.
 * Each service method cascades through tiers automatically.
 */

import type { ServiceResult, ServiceTier } from '@/lib/friday/types'

interface ServiceOption<T> {
  tier: ServiceTier
  label: string
  fn: () => Promise<T>
}

/**
 * Run through a chain of service options in order.
 * Returns the first successful result with its tier info.
 */
export async function runChain<T>(
  serviceName: string,
  options: ServiceOption<T>[]
): Promise<ServiceResult<T>> {
  let lastError: Error | null = null

  for (const option of options) {
    const start = Date.now()
    try {
      const data = await option.fn()
      const latencyMs = Date.now() - start
      console.log(`[ServiceChain] ${serviceName} succeeded via ${option.label} (${latencyMs}ms)`)
      return { data, tier: option.tier, latencyMs }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[ServiceChain] ${serviceName} ${option.label} failed: ${lastError.message}`)
    }
  }

  throw lastError ?? new Error(`${serviceName}: all tiers exhausted`)
}

/**
 * Helper to create a service option with a timeout.
 */
export function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): () => Promise<T> {
  return () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    return fn(controller.signal).finally(() => clearTimeout(timeoutId))
  }
}
