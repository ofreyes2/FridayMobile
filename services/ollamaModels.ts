/**
 * Ollama Models Service
 * Fetches available models from Ollama API
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

const OLLAMA_ENDPOINT = 'http://192.168.1.219:11434'

/**
 * Fetch available models from Ollama
 */
export async function fetchOllamaModels(): Promise<OllamaModel[]> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, {
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
