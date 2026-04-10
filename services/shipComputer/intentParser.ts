/**
 * Ship Computer Intent Parser & Command Router
 * Maps natural language voice commands to Ship Computer actions.
 * "Friday, mute" → system.mute()
 * "Friday, what's on my screen?" → screenVision.analyzeScreen()
 * "Good morning Friday" → workflowEngine.runWorkflow('morning_briefing')
 */

import * as appControl from './appControl'
import { CommandResult } from './appControl'
import * as screenVision from './screenVision'
import * as workflowEngine from './workflowEngine'
import * as contextAwareness from './contextAwareness'
import { speakWithFriday } from '@/services/voice'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface ShipComputerResult {
  handled: boolean
  response: string
  action?: string
  speak?: boolean
}

// ═══════════════════════════════════════════════════════════
// PATTERN MATCHERS
// ═══════════════════════════════════════════════════════════

interface PatternHandler {
  patterns: RegExp[]
  handler: (input: string, match: RegExpMatchArray) => Promise<ShipComputerResult>
}

const COMMAND_HANDLERS: PatternHandler[] = [

  // ─── SCREEN VISION ───
  {
    patterns: [
      /what(?:'s| is) on my screen/i,
      /describe (?:my |the )?screen/i,
      /show me (?:my |the )?screen/i,
      /analyze (?:my |the )?screen/i,
    ],
    handler: async () => {
      const analysis = await screenVision.analyzeScreen()
      return {
        handled: true,
        response: `You're in ${analysis.activeApp}. ${analysis.description}`,
        action: 'screen_vision',
        speak: true,
      }
    },
  },
  {
    patterns: [
      /what app am i in/i,
      /what(?:'s| is) the (?:current |active )?app/i,
      /which app/i,
    ],
    handler: async () => {
      const app = await screenVision.getActiveApp()
      return {
        handled: true,
        response: `You're currently in ${app}.`,
        action: 'get_active_app',
        speak: true,
      }
    },
  },
  {
    patterns: [
      /what error/i,
      /is there an error/i,
      /any errors/i,
      /check for errors/i,
    ],
    handler: async () => {
      const result = await screenVision.detectErrors()
      return {
        handled: true,
        response: result,
        action: 'detect_errors',
        speak: true,
      }
    },
  },
  {
    patterns: [
      /read (?:my |the )?screen/i,
      /read this/i,
      /what does (?:it|this) say/i,
    ],
    handler: async () => {
      const text = await screenVision.readScreen()
      return {
        handled: true,
        response: text,
        action: 'read_screen',
        speak: false, // Reading back the entire screen text would be too long
      }
    },
  },

  // ─── SYSTEM CONTROLS ───
  {
    patterns: [/^mute$/i, /mute (?:the )?(?:audio|sound|volume)/i],
    handler: async () => {
      await appControl.system.mute()
      return { handled: true, response: 'Audio muted.', action: 'mute', speak: true }
    },
  },
  {
    patterns: [/^unmute$/i, /unmute (?:the )?(?:audio|sound|volume)/i],
    handler: async () => {
      await appControl.system.unmute()
      return { handled: true, response: 'Audio unmuted.', action: 'unmute', speak: true }
    },
  },
  {
    patterns: [
      /(?:set |change )?volume (?:to )?(\d+)/i,
      /turn (?:the )?volume (?:to |up to |down to )(\d+)/i,
    ],
    handler: async (_input, match) => {
      const level = parseInt(match[1], 10)
      await appControl.system.setVolume(level)
      return { handled: true, response: `Volume set to ${level}%.`, action: 'set_volume', speak: true }
    },
  },
  {
    patterns: [/turn up (?:the )?volume/i, /volume up/i, /louder/i],
    handler: async () => {
      const current = await appControl.system.getVolume()
      const level = Math.min(100, (parseInt(current.output, 10) || 50) + 15)
      await appControl.system.setVolume(level)
      return { handled: true, response: `Volume up to ${level}%.`, action: 'volume_up', speak: true }
    },
  },
  {
    patterns: [/turn down (?:the )?volume/i, /volume down/i, /quieter/i, /softer/i],
    handler: async () => {
      const current = await appControl.system.getVolume()
      const level = Math.max(0, (parseInt(current.output, 10) || 50) - 15)
      await appControl.system.setVolume(level)
      return { handled: true, response: `Volume down to ${level}%.`, action: 'volume_down', speak: true }
    },
  },
  {
    patterns: [/dark mode/i, /enable dark mode/i, /turn on dark mode/i],
    handler: async () => {
      await appControl.system.darkMode(true)
      return { handled: true, response: 'Dark mode enabled.', action: 'dark_mode', speak: true }
    },
  },
  {
    patterns: [/light mode/i, /disable dark mode/i, /turn off dark mode/i],
    handler: async () => {
      await appControl.system.darkMode(false)
      return { handled: true, response: 'Light mode enabled.', action: 'light_mode', speak: true }
    },
  },
  {
    patterns: [/lock (?:the )?screen/i, /lock (?:my )?(?:mac|computer)/i],
    handler: async () => {
      await speakWithFriday('Locking the screen.')
      await appControl.system.lockScreen()
      return { handled: true, response: 'Screen locked.', action: 'lock_screen', speak: false }
    },
  },
  {
    patterns: [/(?:go to )?sleep/i, /put (?:the )?(?:mac|computer) to sleep/i],
    handler: async () => {
      await speakWithFriday('Putting the Mac to sleep. Goodnight.')
      await new Promise(r => setTimeout(r, 2000))
      await appControl.system.sleep()
      return { handled: true, response: 'Mac is sleeping.', action: 'sleep', speak: false }
    },
  },
  {
    patterns: [/empty (?:the )?trash/i],
    handler: async () => {
      await appControl.system.emptyTrash()
      return { handled: true, response: 'Trash emptied.', action: 'empty_trash', speak: true }
    },
  },
  {
    patterns: [/take a screenshot/i, /screenshot/i, /capture (?:the )?screen/i],
    handler: async () => {
      await appControl.system.screenshot()
      return { handled: true, response: 'Screenshot saved to your Desktop.', action: 'screenshot', speak: true }
    },
  },
  {
    patterns: [/do not disturb ?(on)?/i, /(?:enable |turn on )?dnd/i, /focus mode/i],
    handler: async () => {
      await appControl.system.doNotDisturb(true)
      return { handled: true, response: 'Do Not Disturb enabled.', action: 'dnd_on', speak: true }
    },
  },
  {
    patterns: [/do not disturb off/i, /(?:disable |turn off )?dnd/i, /focus (?:mode )?off/i],
    handler: async () => {
      await appControl.system.doNotDisturb(false)
      return { handled: true, response: 'Do Not Disturb disabled.', action: 'dnd_off', speak: true }
    },
  },

  // ─── SYSTEM STATUS ───
  {
    patterns: [
      /system status/i,
      /status report/i,
      /how(?:'s| is) (?:the )?(?:system|mac|computer)/i,
      /diagnostics?/i,
      /self diagnostic/i,
      /all systems/i,
    ],
    handler: async () => {
      const status = await contextAwareness.getSystemStatus()
      return { handled: true, response: `System Status Report:\n${status}`, action: 'system_status', speak: true }
    },
  },
  {
    patterns: [/battery (?:level|status|life)/i, /how much battery/i, /how(?:'s| is) (?:the )?battery/i],
    handler: async () => {
      const batt = await appControl.system.getBatteryLevel()
      const charging = await appControl.system.isCharging()
      const isCharging = charging.output.trim() === '1'
      const msg = isCharging
        ? `Battery is at ${batt.output} and charging.`
        : `Battery is at ${batt.output}.`
      return { handled: true, response: msg, action: 'battery', speak: true }
    },
  },
  {
    patterns: [/what(?:'s| is) (?:the )?wifi/i, /(?:which |what )?network/i, /wifi (?:name|status)/i],
    handler: async () => {
      const wifi = await appControl.system.getWifiName()
      return {
        handled: true,
        response: wifi.output ? `Connected to ${wifi.output}.` : 'Not connected to WiFi.',
        action: 'wifi',
        speak: true,
      }
    },
  },

  // ─── APP CONTROL ───
  {
    patterns: [/open (.+)/i],
    handler: async (_input, match) => {
      const appName = normalizeAppName(match[1].trim())
      await appControl.universal.openApp(appName)
      return { handled: true, response: `Opening ${appName}.`, action: 'open_app', speak: true }
    },
  },
  {
    patterns: [/close (.+)/i, /quit (.+)/i],
    handler: async (_input, match) => {
      const appName = normalizeAppName(match[1].trim())
      await appControl.universal.closeApp(appName)
      return { handled: true, response: `Closing ${appName}.`, action: 'close_app', speak: true }
    },
  },
  {
    patterns: [/switch to (.+)/i, /go to (.+)/i],
    handler: async (_input, match) => {
      const target = match[1].trim().toLowerCase()
      // Could be an app or a URL
      if (target.includes('.com') || target.includes('.org') || target.includes('.io') || target.startsWith('http')) {
        const url = target.startsWith('http') ? target : `https://${target}`
        await appControl.safari.openUrl(url)
        return { handled: true, response: `Opening ${url} in Safari.`, action: 'open_url', speak: true }
      }
      const appName = normalizeAppName(target)
      await appControl.universal.openApp(appName)
      return { handled: true, response: `Switching to ${appName}.`, action: 'switch_app', speak: true }
    },
  },

  // ─── SAFARI / BROWSER ───
  {
    patterns: [/search (?:for |the web for |google for )?(.+)/i, /google (.+)/i],
    handler: async (_input, match) => {
      const query = match[1].trim()
      await appControl.safari.search(query)
      return { handled: true, response: `Searching for "${query}".`, action: 'web_search', speak: true }
    },
  },
  {
    patterns: [/new tab/i],
    handler: async () => {
      await appControl.safari.newTab()
      return { handled: true, response: 'New tab opened.', action: 'new_tab', speak: true }
    },
  },
  {
    patterns: [/close (?:this )?tab/i],
    handler: async () => {
      await appControl.safari.closeTab()
      return { handled: true, response: 'Tab closed.', action: 'close_tab', speak: true }
    },
  },
  {
    patterns: [/go back/i, /back a page/i],
    handler: async () => {
      await appControl.safari.goBack()
      return { handled: true, response: 'Going back.', action: 'go_back', speak: false }
    },
  },
  {
    patterns: [/go forward/i],
    handler: async () => {
      await appControl.safari.goForward()
      return { handled: true, response: 'Going forward.', action: 'go_forward', speak: false }
    },
  },
  {
    patterns: [/reload|refresh (?:the )?page/i],
    handler: async () => {
      await appControl.safari.reload()
      return { handled: true, response: 'Page refreshed.', action: 'reload', speak: false }
    },
  },

  // ─── EXCEL ───
  {
    patterns: [/create (?:a |new )?spreadsheet/i, /new (?:excel )?workbook/i],
    handler: async () => {
      await appControl.universal.openApp('Microsoft Excel')
      await new Promise(r => setTimeout(r, 2000))
      await appControl.excel.createWorkbook()
      return { handled: true, response: 'Created a new spreadsheet.', action: 'create_spreadsheet', speak: true }
    },
  },
  {
    patterns: [/(?:put|set|enter) (.+) in cell ([A-Za-z]+\d+)/i],
    handler: async (_input, match) => {
      const value = match[1].trim()
      const cell = match[2].toUpperCase()
      await appControl.excel.setCell(cell, value)
      return { handled: true, response: `Set cell ${cell} to "${value}".`, action: 'set_cell', speak: true }
    },
  },
  {
    patterns: [/what(?:'s| is) in cell ([A-Za-z]+\d+)/i, /get cell ([A-Za-z]+\d+)/i],
    handler: async (_input, match) => {
      const cell = match[1].toUpperCase()
      const result = await appControl.excel.getCell(cell)
      return { handled: true, response: `Cell ${cell} contains: ${result.output || '(empty)'}`, action: 'get_cell', speak: true }
    },
  },
  {
    patterns: [/save (?:the )?spreadsheet/i, /save (?:the )?workbook/i],
    handler: async () => {
      await appControl.excel.save()
      return { handled: true, response: 'Spreadsheet saved.', action: 'save_excel', speak: true }
    },
  },

  // ─── WORD ───
  {
    patterns: [/create (?:a |new )?document/i, /new (?:word )?doc/i],
    handler: async () => {
      await appControl.universal.openApp('Microsoft Word')
      await new Promise(r => setTimeout(r, 2000))
      await appControl.word.createDocument()
      return { handled: true, response: 'Created a new document.', action: 'create_document', speak: true }
    },
  },
  {
    patterns: [/save (?:the )?document/i, /save (?:the )?doc/i],
    handler: async () => {
      await appControl.word.save()
      return { handled: true, response: 'Document saved.', action: 'save_word', speak: true }
    },
  },

  // ─── POWERPOINT ───
  {
    patterns: [/create (?:a |new )?presentation/i, /new (?:powerpoint|ppt)/i],
    handler: async () => {
      await appControl.universal.openApp('Microsoft PowerPoint')
      await new Promise(r => setTimeout(r, 2000))
      await appControl.powerpoint.createPresentation()
      return { handled: true, response: 'Created a new presentation.', action: 'create_presentation', speak: true }
    },
  },
  {
    patterns: [/start (?:the )?slideshow/i, /start (?:the )?presentation/i, /play (?:the )?slides/i],
    handler: async () => {
      await appControl.powerpoint.startSlideshow()
      return { handled: true, response: 'Starting slideshow.', action: 'start_slideshow', speak: true }
    },
  },
  {
    patterns: [/next slide/i],
    handler: async () => {
      await appControl.powerpoint.nextSlide()
      return { handled: true, response: '', action: 'next_slide', speak: false }
    },
  },
  {
    patterns: [/previous slide/i, /go back a slide/i, /last slide/i],
    handler: async () => {
      await appControl.powerpoint.previousSlide()
      return { handled: true, response: '', action: 'previous_slide', speak: false }
    },
  },
  {
    patterns: [/end (?:the )?(?:slideshow|presentation)/i, /stop (?:the )?(?:slideshow|presentation)/i],
    handler: async () => {
      await appControl.powerpoint.endSlideshow()
      return { handled: true, response: 'Slideshow ended.', action: 'end_slideshow', speak: true }
    },
  },

  // ─── MUSIC ───
  {
    patterns: [/play music/i, /play (?:some )?(?:music|tunes|songs)/i, /resume music/i],
    handler: async () => {
      await appControl.music.play()
      return { handled: true, response: 'Playing music.', action: 'play_music', speak: true }
    },
  },
  {
    patterns: [/pause music/i, /stop music/i, /pause (?:the )?(?:music|song)/i],
    handler: async () => {
      await appControl.music.pause()
      return { handled: true, response: 'Music paused.', action: 'pause_music', speak: true }
    },
  },
  {
    patterns: [/next (?:song|track)/i, /skip (?:this )?(?:song|track)/i],
    handler: async () => {
      await appControl.music.next()
      return { handled: true, response: 'Next track.', action: 'next_track', speak: false }
    },
  },
  {
    patterns: [/previous (?:song|track)/i, /go back a (?:song|track)/i],
    handler: async () => {
      await appControl.music.previous()
      return { handled: true, response: 'Previous track.', action: 'previous_track', speak: false }
    },
  },
  {
    patterns: [/what(?:'s| is) playing/i, /what song is this/i, /now playing/i],
    handler: async () => {
      const result = await appControl.music.getNowPlaying()
      return { handled: true, response: result.output || 'Nothing is playing.', action: 'now_playing', speak: true }
    },
  },
  {
    patterns: [/play (.+) (?:by|from|in) music/i, /play (?:the song |track )?(.+)/i],
    handler: async (_input, match) => {
      const query = (match[1] || match[2] || '').trim()
      // Don't match if this looks like a workflow trigger
      if (query.toLowerCase() === 'music' || query.length < 2) {
        return { handled: false, response: '' }
      }
      const result = await appControl.music.searchAndPlay(query)
      return { handled: true, response: result.output || `Searching for "${query}"...`, action: 'play_song', speak: true }
    },
  },

  // ─── FINDER ───
  {
    patterns: [/open (?:the )?(?:downloads|download) folder/i],
    handler: async () => {
      await appControl.finder.openFolder('~/Downloads')
      return { handled: true, response: 'Opening Downloads folder.', action: 'open_downloads', speak: true }
    },
  },
  {
    patterns: [/open (?:the )?(?:desktop) folder/i],
    handler: async () => {
      await appControl.finder.openFolder('~/Desktop')
      return { handled: true, response: 'Opening Desktop folder.', action: 'open_desktop', speak: true }
    },
  },
  {
    patterns: [/open (?:the )?(?:documents) folder/i],
    handler: async () => {
      await appControl.finder.openFolder('~/Documents')
      return { handled: true, response: 'Opening Documents folder.', action: 'open_documents', speak: true }
    },
  },
  {
    patterns: [/open (?:the )?(?:home) folder/i, /open (?:my )?home/i],
    handler: async () => {
      await appControl.finder.openFolder('~')
      return { handled: true, response: 'Opening Home folder.', action: 'open_home', speak: true }
    },
  },

  // ─── KEYBOARD SHORTCUTS ───
  {
    patterns: [/save (?:the )?file/i, /save this/i, /^save$/i],
    handler: async () => {
      await appControl.universal.keyCombo('s', ['command'])
      return { handled: true, response: 'Saved.', action: 'save_file', speak: true }
    },
  },
  {
    patterns: [/^undo$/i, /undo (?:that|this|last)/i],
    handler: async () => {
      await appControl.universal.keyCombo('z', ['command'])
      return { handled: true, response: 'Undone.', action: 'undo', speak: false }
    },
  },
  {
    patterns: [/^redo$/i, /redo (?:that|this)/i],
    handler: async () => {
      await appControl.universal.keyCombo('z', ['command', 'shift'])
      return { handled: true, response: 'Redone.', action: 'redo', speak: false }
    },
  },
  {
    patterns: [/^copy$/i, /copy (?:that|this|selection)/i],
    handler: async () => {
      await appControl.universal.keyCombo('c', ['command'])
      return { handled: true, response: 'Copied.', action: 'copy', speak: false }
    },
  },
  {
    patterns: [/^paste$/i, /paste (?:that|this|it)/i],
    handler: async () => {
      await appControl.universal.keyCombo('v', ['command'])
      return { handled: true, response: 'Pasted.', action: 'paste', speak: false }
    },
  },
  {
    patterns: [/select all/i],
    handler: async () => {
      await appControl.universal.keyCombo('a', ['command'])
      return { handled: true, response: 'All selected.', action: 'select_all', speak: false }
    },
  },

  // ─── MONITORING ───
  {
    patterns: [/start monitoring/i, /watch (?:the )?(?:system|screen)/i, /awareness on/i],
    handler: async () => {
      contextAwareness.startMonitoring()
      return { handled: true, response: 'Context monitoring active. I\'ll keep an eye on things.', action: 'start_monitoring', speak: true }
    },
  },
  {
    patterns: [/stop monitoring/i, /stop watching/i, /awareness off/i],
    handler: async () => {
      contextAwareness.stopMonitoring()
      return { handled: true, response: 'Context monitoring stopped.', action: 'stop_monitoring', speak: true }
    },
  },

  // ─── WORKFLOW LIST ───
  {
    patterns: [/(?:list |show |what are (?:the |my )?)(?:available )?workflows/i, /what (?:workflows|commands) (?:do you|can you)/i],
    handler: async () => {
      const workflows = workflowEngine.listWorkflows()
      const list = workflows
        .map(w => `• "${w.trigger}" — ${w.description}`)
        .join('\n')
      return {
        handled: true,
        response: `Available workflows:\n${list}`,
        action: 'list_workflows',
        speak: false,
      }
    },
  },
]

// ═══════════════════════════════════════════════════════════
// APP NAME NORMALIZATION
// ═══════════════════════════════════════════════════════════

const APP_ALIASES: Record<string, string> = {
  'safari': 'Safari',
  'chrome': 'Google Chrome',
  'firefox': 'Firefox',
  'excel': 'Microsoft Excel',
  'word': 'Microsoft Word',
  'powerpoint': 'Microsoft PowerPoint',
  'ppt': 'Microsoft PowerPoint',
  'outlook': 'Microsoft Outlook',
  'teams': 'Microsoft Teams',
  'slack': 'Slack',
  'discord': 'Discord',
  'spotify': 'Spotify',
  'music': 'Music',
  'terminal': 'Terminal',
  'iterm': 'iTerm',
  'code': 'Visual Studio Code',
  'vscode': 'Visual Studio Code',
  'vs code': 'Visual Studio Code',
  'finder': 'Finder',
  'messages': 'Messages',
  'imessage': 'Messages',
  'facetime': 'FaceTime',
  'photos': 'Photos',
  'notes': 'Notes',
  'reminders': 'Reminders',
  'calendar': 'Calendar',
  'mail': 'Mail',
  'maps': 'Maps',
  'preview': 'Preview',
  'xcode': 'Xcode',
  'pages': 'Pages',
  'numbers': 'Numbers',
  'keynote': 'Keynote',
  'settings': 'System Settings',
  'system preferences': 'System Settings',
  'system settings': 'System Settings',
  'activity monitor': 'Activity Monitor',
  'tv': 'TV',
  'podcasts': 'Podcasts',
  'books': 'Books',
  'news': 'News',
  'stocks': 'Stocks',
  'weather': 'Weather',
  'cursor': 'Cursor',
}

function normalizeAppName(input: string): string {
  const lower = input.toLowerCase().replace(/^(the |my )/, '')
  return APP_ALIASES[lower] || input
}

// ═══════════════════════════════════════════════════════════
// MAIN PARSER
// ═══════════════════════════════════════════════════════════

/**
 * Parse user input and execute the matching Ship Computer command.
 * Returns null if the input doesn't match any Ship Computer command,
 * meaning it should be passed to Ollama for regular conversation.
 */
export async function parseAndExecute(input: string): Promise<ShipComputerResult | null> {
  const cleaned = input
    .replace(/^(?:hey |ok |yo )?friday[,:]?\s*/i, '')
    .replace(/^(?:computer[,:]?\s*)/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return null

  // 1. Check for workflow triggers first (exact phrase matches)
  const workflow = workflowEngine.matchWorkflow(cleaned)
  if (workflow) {
    console.log(`[ShipComputer] Workflow matched: ${workflow.name}`)
    try {
      const result = await workflowEngine.runWorkflow(
        workflow.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      )
      return {
        handled: true,
        response: `Workflow "${workflow.name}" complete. ${result.completed}/${result.steps} steps succeeded.`,
        action: 'workflow',
        speak: false, // Workflow steps handle their own speech
      }
    } catch (err) {
      return {
        handled: true,
        response: `Workflow "${workflow.name}" encountered an error: ${err instanceof Error ? err.message : String(err)}`,
        speak: true,
      }
    }
  }

  // 2. Check pattern-based commands
  for (const handler of COMMAND_HANDLERS) {
    for (const pattern of handler.patterns) {
      const match = cleaned.match(pattern)
      if (match) {
        console.log(`[ShipComputer] Command matched: ${pattern.source}`)
        try {
          const result = await handler.handler(cleaned, match)
          if (result.handled) {
            // Mark user activity for context awareness
            contextAwareness.markActivity()
            return result
          }
        } catch (err) {
          return {
            handled: true,
            response: `Command failed: ${err instanceof Error ? err.message : String(err)}`,
            speak: true,
          }
        }
      }
    }
  }

  // 3. No match — let it pass through to Ollama
  return null
}

/**
 * Check if input looks like a Ship Computer command (quick check without executing).
 */
export function looksLikeCommand(input: string): boolean {
  const cleaned = input
    .replace(/^(?:hey |ok |yo )?friday[,:]?\s*/i, '')
    .replace(/^(?:computer[,:]?\s*)/i, '')
    .trim()

  if (!cleaned) return false

  // Check workflow triggers
  if (workflowEngine.matchWorkflow(cleaned)) return true

  // Check command patterns
  for (const handler of COMMAND_HANDLERS) {
    for (const pattern of handler.patterns) {
      if (pattern.test(cleaned)) return true
    }
  }

  return false
}
