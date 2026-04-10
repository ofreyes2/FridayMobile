/**
 * Workflow Engine — Chained Command Sequences
 * "Computer, red alert." → multiple actions fire in sequence.
 * Pre-built workflows + custom workflow creation.
 */

import { speakWithFriday } from '@/services/voice'
import { getActiveIp } from '@/services/knightswatch'
import * as appControl from './appControl'
import type { CommandResult } from './appControl'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type WorkflowStepAction =
  | 'speak'
  | 'open_app'
  | 'close_app'
  | 'system'
  | 'wait'
  | 'key_combo'
  | 'type_text'
  | 'run_command'

export interface WorkflowStep {
  action: WorkflowStepAction
  params: Record<string, any>
}

export interface Workflow {
  name: string
  trigger: string
  description: string
  steps: WorkflowStep[]
}

export interface WorkflowResult {
  workflow: string
  steps: number
  completed: number
  failed: number
  results: Array<{ step: number; action: string; success: boolean; output?: string }>
}

// ═══════════════════════════════════════════════════════════
// WORKFLOW REGISTRY
// ═══════════════════════════════════════════════════════════

const customWorkflows = new Map<string, Workflow>()

/**
 * Execute a single workflow step.
 */
async function executeStep(step: WorkflowStep): Promise<CommandResult> {
  const { action, params } = step

  switch (action) {
    case 'speak':
      await speakWithFriday(params.text || '')
      return { success: true, output: `Spoke: ${params.text}` }

    case 'open_app':
      return appControl.universal.openApp(params.name)

    case 'close_app':
      return appControl.universal.closeApp(params.name)

    case 'system': {
      const sysAction = params.action as string
      if (sysAction === 'set_volume') return appControl.system.setVolume(params.level)
      if (sysAction === 'mute') return appControl.system.mute()
      if (sysAction === 'unmute') return appControl.system.unmute()
      if (sysAction === 'dark_mode') return appControl.system.darkMode(params.enable)
      if (sysAction === 'set_brightness') return appControl.system.setBrightness(params.level)
      if (sysAction === 'lock_screen') return appControl.system.lockScreen()
      if (sysAction === 'sleep') return appControl.system.sleep()
      if (sysAction === 'dnd') return appControl.system.doNotDisturb(params.enable)
      return { success: false, output: '', error: `Unknown system action: ${sysAction}` }
    }

    case 'wait':
      await new Promise(resolve => setTimeout(resolve, (params.seconds || 1) * 1000))
      return { success: true, output: `Waited ${params.seconds}s` }

    case 'key_combo':
      return appControl.universal.keyCombo(params.key, params.modifiers || [])

    case 'type_text':
      return appControl.universal.typeText(params.text || '')

    case 'run_command': {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      try {
        const resp = await fetch(`http://${getActiveIp()}:8765/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: params.command }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        const data = await resp.json()
        return { success: (data.returncode ?? 0) === 0, output: data.stdout || '' }
      } catch (err) {
        clearTimeout(timeoutId)
        return { success: false, output: '', error: String(err) }
      }
    }

    default:
      return { success: false, output: '', error: `Unknown action: ${action}` }
  }
}

/**
 * Run a full workflow by name.
 */
export async function runWorkflow(name: string): Promise<WorkflowResult> {
  const workflow = getWorkflow(name)
  if (!workflow) {
    throw new Error(`Workflow not found: ${name}`)
  }

  console.log(`[Workflow] Running "${workflow.name}" (${workflow.steps.length} steps)`)

  const result: WorkflowResult = {
    workflow: workflow.name,
    steps: workflow.steps.length,
    completed: 0,
    failed: 0,
    results: [],
  }

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i]
    try {
      const stepResult = await executeStep(step)
      result.results.push({
        step: i + 1,
        action: step.action,
        success: stepResult.success,
        output: stepResult.output,
      })
      if (stepResult.success) {
        result.completed++
      } else {
        result.failed++
        console.warn(`[Workflow] Step ${i + 1} failed: ${stepResult.error}`)
      }
    } catch (err) {
      result.failed++
      result.results.push({
        step: i + 1,
        action: step.action,
        success: false,
        output: err instanceof Error ? err.message : String(err),
      })
    }

    // Brief pause between steps to let actions settle
    if (i < workflow.steps.length - 1 && step.action !== 'wait') {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  console.log(`[Workflow] "${workflow.name}" complete: ${result.completed}/${result.steps} steps`)
  return result
}

/**
 * Get a workflow by name (built-in or custom).
 */
export function getWorkflow(name: string): Workflow | undefined {
  const key = name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  return BUILTIN_WORKFLOWS[key] || customWorkflows.get(key)
}

/**
 * Register a custom workflow.
 */
export function registerWorkflow(workflow: Workflow): void {
  const key = workflow.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  customWorkflows.set(key, workflow)
  console.log(`[Workflow] Registered custom workflow: ${workflow.name}`)
}

/**
 * List all available workflows.
 */
export function listWorkflows(): Workflow[] {
  const builtIn = Object.values(BUILTIN_WORKFLOWS)
  const custom = Array.from(customWorkflows.values())
  return [...builtIn, ...custom]
}

/**
 * Match user input to a workflow trigger.
 */
export function matchWorkflow(input: string): Workflow | null {
  const lower = input.toLowerCase().trim()

  // Check built-in triggers
  for (const workflow of Object.values(BUILTIN_WORKFLOWS)) {
    if (lower.includes(workflow.trigger)) {
      return workflow
    }
  }

  // Check custom triggers
  for (const workflow of customWorkflows.values()) {
    if (lower.includes(workflow.trigger)) {
      return workflow
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════════
// BUILT-IN WORKFLOWS
// ═══════════════════════════════════════════════════════════

const BUILTIN_WORKFLOWS: Record<string, Workflow> = {
  morning_briefing: {
    name: 'Morning Briefing',
    trigger: 'good morning friday',
    description: 'Full morning update: weather, calendar, news, system status.',
    steps: [
      { action: 'speak', params: { text: 'Good morning Oscar. Let me get you set up.' } },
      { action: 'system', params: { action: 'unmute' } },
      { action: 'system', params: { action: 'set_volume', level: 50 } },
      { action: 'speak', params: { text: "All systems nominal. What would you like to tackle first?" } },
    ],
  },

  presentation_mode: {
    name: 'Presentation Mode',
    trigger: 'presentation mode',
    description: 'Set up for a presentation: DND, open PowerPoint, system check.',
    steps: [
      { action: 'speak', params: { text: 'Setting up for your presentation.' } },
      { action: 'system', params: { action: 'dnd', enable: true } },
      { action: 'system', params: { action: 'set_volume', level: 75 } },
      { action: 'open_app', params: { name: 'Microsoft PowerPoint' } },
      { action: 'speak', params: { text: "All set. You're going to crush it." } },
    ],
  },

  end_of_day: {
    name: 'End of Day',
    trigger: 'end of day friday',
    description: 'Wind down: save work, summarize, prepare for tomorrow.',
    steps: [
      { action: 'speak', params: { text: 'Wrapping up for the day.' } },
      { action: 'key_combo', params: { key: 's', modifiers: ['command'] } },
      { action: 'wait', params: { seconds: 1 } },
      { action: 'speak', params: { text: "Everything's saved. Get some rest, you earned it." } },
    ],
  },

  red_alert: {
    name: 'Red Alert',
    trigger: 'red alert',
    description: 'Full system diagnostic and status report.',
    steps: [
      { action: 'speak', params: { text: 'Red alert! All systems check.' } },
      { action: 'system', params: { action: 'set_volume', level: 80 } },
      { action: 'speak', params: { text: 'Running full diagnostic. Stand by.' } },
    ],
  },

  deep_work: {
    name: 'Deep Work Mode',
    trigger: 'deep work mode',
    description: 'Focus mode: DND on, distractions minimized.',
    steps: [
      { action: 'system', params: { action: 'dnd', enable: true } },
      { action: 'system', params: { action: 'set_volume', level: 30 } },
      { action: 'speak', params: { text: "Deep work mode active. I'll keep things quiet." } },
    ],
  },

  movie_night: {
    name: 'Movie Night',
    trigger: 'movie night',
    description: 'Entertainment mode: DND, dark mode, low brightness.',
    steps: [
      { action: 'speak', params: { text: 'Movie night! Let me set the mood.' } },
      { action: 'system', params: { action: 'dnd', enable: true } },
      { action: 'system', params: { action: 'dark_mode', enable: true } },
      { action: 'system', params: { action: 'set_brightness', level: 30 } },
      { action: 'speak', params: { text: 'Lights low, phone silent. Enjoy the show.' } },
    ],
  },

  leaving_house: {
    name: 'Leaving House',
    trigger: "i'm leaving",
    description: 'Quick status before heading out.',
    steps: [
      { action: 'speak', params: { text: "Have a good one! I'll keep an eye on KNIGHTSWATCH while you're out." } },
    ],
  },

  gaming_mode: {
    name: 'Gaming Mode',
    trigger: 'gaming mode',
    description: 'Game time: DND on, volume up.',
    steps: [
      { action: 'speak', params: { text: 'Game time! Let\'s go!' } },
      { action: 'system', params: { action: 'dnd', enable: true } },
      { action: 'system', params: { action: 'set_volume', level: 80 } },
      { action: 'speak', params: { text: 'DND is on, volume\'s up. Go get those dubs.' } },
    ],
  },

  goodnight: {
    name: 'Goodnight',
    trigger: 'goodnight friday',
    description: 'Shut down for the night: save all, DND, dim, sleep.',
    steps: [
      { action: 'speak', params: { text: 'Goodnight Oscar. Shutting things down.' } },
      { action: 'key_combo', params: { key: 's', modifiers: ['command'] } },
      { action: 'wait', params: { seconds: 1 } },
      { action: 'system', params: { action: 'dnd', enable: true } },
      { action: 'system', params: { action: 'dark_mode', enable: true } },
      { action: 'system', params: { action: 'set_volume', level: 0 } },
      { action: 'speak', params: { text: 'Everything is saved and secured. Sleep well.' } },
    ],
  },

  battle_stations: {
    name: 'Battle Stations',
    trigger: 'battle stations',
    description: 'All hands: full power, max performance, all systems online.',
    steps: [
      { action: 'speak', params: { text: 'All hands, battle stations! Powering up all systems.' } },
      { action: 'system', params: { action: 'unmute' } },
      { action: 'system', params: { action: 'set_volume', level: 70 } },
      { action: 'system', params: { action: 'dnd', enable: true } },
      { action: 'speak', params: { text: 'All stations manned and ready. Awaiting your orders, Captain.' } },
    ],
  },

  stand_down: {
    name: 'Stand Down',
    trigger: 'stand down',
    description: 'Return to normal operations.',
    steps: [
      { action: 'speak', params: { text: 'Standing down. Returning to normal operations.' } },
      { action: 'system', params: { action: 'dnd', enable: false } },
      { action: 'system', params: { action: 'set_volume', level: 50 } },
      { action: 'speak', params: { text: 'All clear. Back to standard operations.' } },
    ],
  },
}
