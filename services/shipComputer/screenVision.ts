/**
 * Screen Vision Service — Friday's Eyes
 * Captures and analyzes what's on Oscar's screen via KNIGHTSWATCH.
 * Uses screencapture + llava vision model for understanding.
 */

import { ollamaUrl, getActiveIp } from '@/services/knightswatch'

const KNIGHTSWATCH_API = () => `http://${getActiveIp()}:8765`
const TIMEOUT = 30000

export interface ScreenContext {
  activeApp: string
  windowTitle: string
  timestamp: number
}

export interface VisionAnalysis {
  description: string
  activeApp: string
  windowTitle: string
  timestamp: number
}

/**
 * Execute a command on KNIGHTSWATCH and return stdout.
 */
async function runRemote(command: string, timeout = 10000): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const resp = await fetch(`${KNIGHTSWATCH_API()}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!resp.ok) throw new Error(`Remote command failed: ${resp.status}`)
    const data = await resp.json()
    return (data.stdout || '').trim()
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

/**
 * Capture a full screenshot on KNIGHTSWATCH and return base64 PNG.
 */
export async function captureScreen(): Promise<string> {
  console.log('[ScreenVision] Capturing full screen...')
  // Capture to temp file, base64 encode, return
  const b64 = await runRemote(
    'screencapture -x /tmp/friday_screen.png && base64 -i /tmp/friday_screen.png',
    15000
  )
  console.log(`[ScreenVision] Screenshot captured (${b64.length} chars b64)`)
  return b64
}

/**
 * Capture a specific region of the screen.
 */
export async function captureRegion(x: number, y: number, w: number, h: number): Promise<string> {
  console.log(`[ScreenVision] Capturing region ${x},${y} ${w}x${h}...`)
  const b64 = await runRemote(
    `screencapture -x -R ${x},${y},${w},${h} /tmp/friday_region.png && base64 -i /tmp/friday_region.png`,
    15000
  )
  return b64
}

/**
 * Capture the frontmost window.
 */
export async function captureWindow(): Promise<string> {
  console.log('[ScreenVision] Capturing front window...')
  // Get window ID, then capture it
  const b64 = await runRemote(
    `screencapture -x -l $(osascript -e 'tell application "System Events" to get id of first window of (first application process whose frontmost is true)') /tmp/friday_window.png 2>/dev/null && base64 -i /tmp/friday_window.png || (screencapture -x /tmp/friday_window.png && base64 -i /tmp/friday_window.png)`,
    15000
  )
  return b64
}

/**
 * Get the currently active application name.
 */
export async function getActiveApp(): Promise<string> {
  try {
    return await runRemote(
      `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`
    )
  } catch {
    return 'Unknown'
  }
}

/**
 * Get the frontmost window title.
 */
export async function getWindowTitle(): Promise<string> {
  try {
    return await runRemote(
      `osascript -e 'tell application "System Events" to get title of front window of first application process whose frontmost is true'`
    )
  } catch {
    return 'Unknown'
  }
}

/**
 * Get current screen context (app + window) without a screenshot.
 */
export async function getScreenContext(): Promise<ScreenContext> {
  const [activeApp, windowTitle] = await Promise.all([
    getActiveApp(),
    getWindowTitle(),
  ])
  return { activeApp, windowTitle, timestamp: Date.now() }
}

/**
 * Analyze a screenshot using llava vision model on KNIGHTSWATCH.
 */
export async function analyzeImage(
  imageBase64: string,
  question: string = 'What do you see on this screen? Describe the active application, any visible content, and anything noteworthy.'
): Promise<string> {
  console.log('[ScreenVision] Analyzing image with llava...')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

  try {
    const resp = await fetch(`${ollamaUrl()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava',
        prompt: question,
        images: [imageBase64],
        stream: false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!resp.ok) throw new Error(`Vision analysis failed: ${resp.status}`)
    const data = await resp.json()
    const description = data.response || 'Could not analyze the screen.'
    console.log('[ScreenVision] Analysis complete')
    return description
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

/**
 * Full screen analysis: capture + analyze in one call.
 */
export async function analyzeScreen(
  question?: string
): Promise<VisionAnalysis> {
  const [screenshot, context] = await Promise.all([
    captureScreen(),
    getScreenContext(),
  ])

  const description = await analyzeImage(screenshot, question)

  return {
    description,
    activeApp: context.activeApp,
    windowTitle: context.windowTitle,
    timestamp: Date.now(),
  }
}

/**
 * Detect errors visible on screen.
 */
export async function detectErrors(): Promise<string> {
  const screenshot = await captureScreen()
  return analyzeImage(
    screenshot,
    'Look at this screen carefully. Are there any error messages, warnings, dialog boxes with errors, or crash reports visible? If yes, describe them in detail. If no errors are visible, say "No errors detected."'
  )
}

/**
 * Read/OCR the screen content.
 */
export async function readScreen(): Promise<string> {
  const screenshot = await captureScreen()
  return analyzeImage(
    screenshot,
    'Read all the text visible on this screen. Transcribe it as accurately as possible, preserving the layout.'
  )
}
