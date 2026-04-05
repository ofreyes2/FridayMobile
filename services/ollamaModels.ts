/**
 * Ollama Models Service
 * Fetches available models from Ollama API with fallback endpoint support
 */

export interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
}

export interface OllamaModelsResponse {
  models: OllamaModel[]
}

const OLLAMA_ENDPOINTS = [
  'http://100.112.253.127:11434', // Tailscale (physical devices)
  'http://192.168.1.219:11434',    // Local network (simulator)
]

let cachedEndpoint: string | null = null

/**
 * Detect working Ollama endpoint by trying each one
 * Returns first endpoint that responds successfully
 * Increased timeout to 8 seconds for Tailscale connectivity on mobile
 */
export async function getOllamaEndpoint(): Promise<string> {
  // Return cached endpoint if already detected
  if (cachedEndpoint) {
    console.log('[Endpoint] Using cached endpoint:', cachedEndpoint)
    return cachedEndpoint
  }

  console.log('[Endpoint] Detecting working Ollama endpoint...')
  console.log('[Endpoint] Available endpoints:', OLLAMA_ENDPOINTS)

  for (const endpoint of OLLAMA_ENDPOINTS) {
    try {
      console.log('[Endpoint] Trying:', endpoint)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.log('[Endpoint] Timeout (8s) reached for:', endpoint)
        controller.abort()
      }, 8000) // Increased from 3000ms to 8000ms for Tailscale reliability

      const startTime = Date.now()
      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      })

      const duration = Date.now() - startTime
      clearTimeout(timeoutId)

      console.log('[Endpoint] Response status:', response.status, 'Duration:', duration + 'ms', 'Endpoint:', endpoint)

      if (response.ok) {
        cachedEndpoint = endpoint
        console.log('[Endpoint] ✓ Found working endpoint:', endpoint)
        return endpoint
      } else {
        console.warn('[Endpoint] Non-200 status from', endpoint, ':', response.status)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.warn('[Endpoint] Error trying', endpoint, ':', errorMsg)
      continue
    }
  }

  // Fallback to first endpoint if none respond
  cachedEndpoint = OLLAMA_ENDPOINTS[0]
  console.warn('[Endpoint] No endpoints responded, defaulting to:', cachedEndpoint)
  return cachedEndpoint
}

/**
 * Fetch available models from Ollama
 */
export async function fetchOllamaModels(): Promise<OllamaModel[]> {
  try {
    const endpoint = await getOllamaEndpoint()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('[OllamaModels] Failed to fetch models:', response.status)
      return []
    }

    const data: OllamaModelsResponse = await response.json()
    return data.models || []
  } catch (error) {
    console.error('[OllamaModels] Error fetching models:', error)
    return []
  }
}

/**
 * Get human-readable model size
 */
export function formatModelSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Get model family/type from name
 */
export function getModelFamily(modelName: string): string {
  if (modelName.includes('qwen')) return 'Qwen'
  if (modelName.includes('llama')) return 'Llama'
  if (modelName.includes('mistral')) return 'Mistral'
  if (modelName.includes('nomic')) return 'Nomic'
  if (modelName.includes('pantryiq')) return 'PantryIQ'
  return 'Unknown'
}

/**
 * Get display label for model
 */
export function getModelLabel(modelName: string): string {
  const family = getModelFamily(modelName)

  if (modelName.includes('70b')) return 'Powerful (70B)'
  if (modelName.includes('32b')) return 'Balanced (32B)'
  if (modelName.includes('7b')) return 'Fast (7B)'
  if (modelName.includes('q3_K_M')) return 'Quantized (Q3)'
  if (modelName.includes('q4_K_M')) return 'Optimized (Q4)'

  return family
}
