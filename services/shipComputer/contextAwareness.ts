/**
 * Context Awareness Service — Friday's Intuition
 * Proactive monitoring: app switching, errors, idle, late night,
 * battery, meetings. Friday observes and comments.
 */

import { getActiveApp, getWindowTitle } from './screenVision'
import * as appControl from './appControl'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface AwarenessState {
  currentApp: string
  currentWindow: string
  lastAppSwitch: number
  lastActivity: number
  isMonitoring: boolean
  batteryLevel: number | null
  isCharging: boolean
  lastCheck: number
}

export interface AwarenessEvent {
  type: 'app_switch' | 'error_detected' | 'idle' | 'late_night' | 'battery_low' | 'battery_critical' | 'system_info'
  message: string
  timestamp: number
  data?: Record<string, any>
}

type AwarenessListener = (event: AwarenessEvent) => void

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════

let state: AwarenessState = {
  currentApp: '',
  currentWindow: '',
  lastAppSwitch: 0,
  lastActivity: Date.now(),
  isMonitoring: false,
  batteryLevel: null,
  isCharging: false,
  lastCheck: 0,
}

let monitorInterval: ReturnType<typeof setInterval> | null = null
const listeners: AwarenessListener[] = []
const CHECK_INTERVAL = 10000 // 10 seconds
let lateNightWarned = false

// ═══════════════════════════════════════════════════════════
// EVENT SYSTEM
// ═══════════════════════════════════════════════════════════

function emit(event: AwarenessEvent): void {
  console.log(`[Awareness] ${event.type}: ${event.message}`)
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (err) {
      console.error('[Awareness] Listener error:', err)
    }
  }
}

export function onAwarenessEvent(listener: AwarenessListener): () => void {
  listeners.push(listener)
  return () => {
    const idx = listeners.indexOf(listener)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

// ═══════════════════════════════════════════════════════════
// MONITORING
// ═══════════════════════════════════════════════════════════

async function checkLoop(): Promise<void> {
  if (!state.isMonitoring) return

  try {
    // Get current app context
    const [newApp, newWindow] = await Promise.all([
      getActiveApp().catch(() => state.currentApp),
      getWindowTitle().catch(() => state.currentWindow),
    ])

    // Detect app switch
    if (newApp && newApp !== state.currentApp && state.currentApp !== '') {
      const oldApp = state.currentApp
      state.lastAppSwitch = Date.now()
      emit({
        type: 'app_switch',
        message: `Switched from ${oldApp} to ${newApp}`,
        timestamp: Date.now(),
        data: { oldApp, newApp },
      })
    }

    state.currentApp = newApp || state.currentApp
    state.currentWindow = newWindow || state.currentWindow

    // Check battery
    await checkBattery()

    // Check late night
    checkLateNight()

    // Check idle
    checkIdle()

    state.lastCheck = Date.now()
  } catch (err) {
    console.warn('[Awareness] Check loop error:', err)
  }
}

async function checkBattery(): Promise<void> {
  try {
    const battResult = await appControl.system.getBatteryLevel()
    if (battResult.success && battResult.output) {
      const level = parseInt(battResult.output.replace('%', ''), 10)
      if (!isNaN(level)) {
        const prevLevel = state.batteryLevel

        const chargeResult = await appControl.system.isCharging()
        state.isCharging = chargeResult.output.trim() === '1'
        state.batteryLevel = level

        // Only warn if not charging
        if (!state.isCharging) {
          if (level <= 10 && (prevLevel === null || prevLevel > 10)) {
            emit({
              type: 'battery_critical',
              message: `Battery critical at ${level}%! Plug in now.`,
              timestamp: Date.now(),
              data: { level },
            })
          } else if (level <= 20 && (prevLevel === null || prevLevel > 20)) {
            emit({
              type: 'battery_low',
              message: `Battery's at ${level}%. You might want to plug in.`,
              timestamp: Date.now(),
              data: { level },
            })
          }
        }
      }
    }
  } catch {
    // Battery check failed, not critical
  }
}

function checkLateNight(): void {
  const hour = new Date().getHours()
  if (hour >= 23 && !lateNightWarned) {
    lateNightWarned = true
    emit({
      type: 'late_night',
      message: "It's getting late. Maybe wrap up soon?",
      timestamp: Date.now(),
    })
  }
  // Reset for next day
  if (hour < 23) {
    lateNightWarned = false
  }
}

function checkIdle(): void {
  // Idle detection is approximated — if the app hasn't changed in 30 minutes
  const idleMinutes = (Date.now() - state.lastAppSwitch) / 60000
  if (idleMinutes > 30 && state.lastAppSwitch > 0) {
    // Only emit once per idle period
    const lastIdleEmit = state.lastActivity
    if (Date.now() - lastIdleEmit > 30 * 60000) {
      state.lastActivity = Date.now()
      emit({
        type: 'idle',
        message: "You've been away for a while. Everything's running fine.",
        timestamp: Date.now(),
        data: { idleMinutes: Math.round(idleMinutes) },
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

/**
 * Start background monitoring.
 */
export function startMonitoring(): void {
  if (state.isMonitoring) return

  state.isMonitoring = true
  state.lastActivity = Date.now()
  state.lastAppSwitch = Date.now()
  lateNightWarned = false

  console.log('[Awareness] Monitoring started')

  // Initial check
  checkLoop()

  // Periodic checks
  monitorInterval = setInterval(checkLoop, CHECK_INTERVAL)
}

/**
 * Stop background monitoring.
 */
export function stopMonitoring(): void {
  state.isMonitoring = false
  if (monitorInterval) {
    clearInterval(monitorInterval)
    monitorInterval = null
  }
  console.log('[Awareness] Monitoring stopped')
}

/**
 * Get current awareness state.
 */
export function getState(): AwarenessState {
  return { ...state }
}

/**
 * Get a quick system status report.
 */
export async function getSystemStatus(): Promise<string> {
  const parts: string[] = []

  // Battery
  try {
    const batt = await appControl.system.getBatteryLevel()
    if (batt.success) parts.push(`Battery: ${batt.output}`)
  } catch {}

  // WiFi
  try {
    const wifi = await appControl.system.getWifiName()
    if (wifi.success && wifi.output) parts.push(`WiFi: ${wifi.output}`)
  } catch {}

  // Disk
  try {
    const disk = await appControl.system.getDiskSpace()
    if (disk.success) parts.push(`Disk: ${disk.output}`)
  } catch {}

  // Uptime
  try {
    const up = await appControl.system.getUptime()
    if (up.success) parts.push(`Uptime: ${up.output}`)
  } catch {}

  // Current app
  if (state.currentApp) {
    parts.push(`Active app: ${state.currentApp}`)
  }

  // Dark mode
  try {
    const dm = await appControl.system.getDarkMode()
    if (dm.success) parts.push(`Dark mode: ${dm.output}`)
  } catch {}

  return parts.length > 0
    ? parts.join('\n')
    : 'Unable to retrieve system status.'
}

/**
 * Mark user activity (resets idle timer).
 */
export function markActivity(): void {
  state.lastActivity = Date.now()
}

/**
 * Check if monitoring is active.
 */
export function isMonitoring(): boolean {
  return state.isMonitoring
}
