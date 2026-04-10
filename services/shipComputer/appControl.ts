/**
 * App Control Layer — Friday's Hands
 * Controls Mac applications via AppleScript through KNIGHTSWATCH.
 * Universal controls + app-specific handlers.
 */

import { getActiveIp } from '@/services/knightswatch'

const KNIGHTSWATCH_API = () => `http://${getActiveIp()}:8765`

export interface CommandResult {
  success: boolean
  output: string
  error?: string
}

/**
 * Execute a command on KNIGHTSWATCH.
 */
async function run(command: string, timeout = 10000): Promise<CommandResult> {
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

    if (!resp.ok) {
      return { success: false, output: '', error: `HTTP ${resp.status}` }
    }

    const data = await resp.json()
    const success = (data.returncode ?? 0) === 0
    return {
      success,
      output: (data.stdout || '').trim(),
      error: success ? undefined : (data.stderr || '').trim(),
    }
  } catch (err) {
    clearTimeout(timeoutId)
    return {
      success: false,
      output: '',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Run an AppleScript command on KNIGHTSWATCH.
 */
async function osascript(script: string, timeout = 10000): Promise<CommandResult> {
  // Escape single quotes in the script for shell safety
  const escaped = script.replace(/'/g, "'\\''")
  return run(`osascript -e '${escaped}'`, timeout)
}

// ═══════════════════════════════════════════════════════════
// UNIVERSAL CONTROLS — work in any app
// ═══════════════════════════════════════════════════════════

export const universal = {
  async openApp(name: string): Promise<CommandResult> {
    console.log(`[AppControl] Opening ${name}...`)
    return osascript(`tell application "${name}" to activate`)
  },

  async closeApp(name: string): Promise<CommandResult> {
    console.log(`[AppControl] Closing ${name}...`)
    return osascript(`tell application "${name}" to quit`)
  },

  async typeText(text: string): Promise<CommandResult> {
    const escaped = text.replace(/"/g, '\\"')
    return osascript(`tell application "System Events" to keystroke "${escaped}"`)
  },

  async keyCombo(key: string, modifiers: string[] = []): Promise<CommandResult> {
    const modStr = modifiers.map(m => `${m} down`).join(', ')
    if (modStr) {
      return osascript(
        `tell application "System Events" to keystroke "${key}" using {${modStr}}`
      )
    }
    return osascript(`tell application "System Events" to keystroke "${key}"`)
  },

  async keyCode(code: number, modifiers: string[] = []): Promise<CommandResult> {
    const modStr = modifiers.map(m => `${m} down`).join(', ')
    if (modStr) {
      return osascript(
        `tell application "System Events" to key code ${code} using {${modStr}}`
      )
    }
    return osascript(`tell application "System Events" to key code ${code}`)
  },

  async clickMenu(appName: string, menu: string, item: string): Promise<CommandResult> {
    return osascript(
      `tell application "System Events" to tell process "${appName}" to click menu item "${item}" of menu "${menu}" of menu bar 1`
    )
  },
}

// ═══════════════════════════════════════════════════════════
// EXCEL HANDLER
// ═══════════════════════════════════════════════════════════

export const excel = {
  async createWorkbook(): Promise<CommandResult> {
    console.log('[AppControl] Creating Excel workbook...')
    return osascript('tell application "Microsoft Excel" to make new workbook')
  },

  async setCell(cell: string, value: string): Promise<CommandResult> {
    const escaped = value.replace(/"/g, '\\"')
    return osascript(
      `tell application "Microsoft Excel" to set value of cell "${cell}" of active sheet to "${escaped}"`
    )
  },

  async getCell(cell: string): Promise<CommandResult> {
    return osascript(
      `tell application "Microsoft Excel" to get value of cell "${cell}" of active sheet`
    )
  },

  async setFormula(cell: string, formula: string): Promise<CommandResult> {
    const escaped = formula.replace(/"/g, '\\"')
    return osascript(
      `tell application "Microsoft Excel" to set formula of cell "${cell}" of active sheet to "${escaped}"`
    )
  },

  async createSheet(name: string): Promise<CommandResult> {
    return osascript(
      `tell application "Microsoft Excel"\nmake new worksheet at end of active workbook\nset name of active sheet to "${name}"\nend tell`
    )
  },

  async formatBold(range: string): Promise<CommandResult> {
    return osascript(
      `tell application "Microsoft Excel" to set bold of font object of range "${range}" of active sheet to true`
    )
  },

  async save(): Promise<CommandResult> {
    return osascript('tell application "Microsoft Excel" to save active workbook')
  },

  async sortRange(range: string, column: string, ascending = true): Promise<CommandResult> {
    const order = ascending ? 'sort normal order' : 'sort descending order'
    return osascript(
      `tell application "Microsoft Excel"\nsort range "${range}" of active sheet key1 range "${column}" of active sheet order1 ${order}\nend tell`
    )
  },
}

// ═══════════════════════════════════════════════════════════
// WORD HANDLER
// ═══════════════════════════════════════════════════════════

export const word = {
  async createDocument(): Promise<CommandResult> {
    console.log('[AppControl] Creating Word document...')
    return osascript('tell application "Microsoft Word" to make new document')
  },

  async insertText(text: string): Promise<CommandResult> {
    const escaped = text.replace(/"/g, '\\"')
    return osascript(
      `tell application "Microsoft Word" to insert text "${escaped}" at end of text object of active document`
    )
  },

  async setHeading(text: string, level = 1): Promise<CommandResult> {
    const escaped = text.replace(/"/g, '\\"')
    // Insert text then apply heading style
    return osascript(
      `tell application "Microsoft Word"\ninsert text "${escaped}" & return at end of text object of active document\nset style of paragraph -2 of text object of active document to "Heading ${level}"\nend tell`
    )
  },

  async formatBold(): Promise<CommandResult> {
    return osascript(
      'tell application "Microsoft Word" to set bold of font object of selection to true'
    )
  },

  async formatItalic(): Promise<CommandResult> {
    return osascript(
      'tell application "Microsoft Word" to set italic of font object of selection to true'
    )
  },

  async findReplace(find: string, replace: string): Promise<CommandResult> {
    const f = find.replace(/"/g, '\\"')
    const r = replace.replace(/"/g, '\\"')
    return osascript(
      `tell application "Microsoft Word"\ntell find object of selection\nset content to "${f}"\nset replacement text of replace object to "${r}"\nexecute find replace replace all\nend tell\nend tell`
    )
  },

  async save(): Promise<CommandResult> {
    return osascript('tell application "Microsoft Word" to save active document')
  },
}

// ═══════════════════════════════════════════════════════════
// POWERPOINT HANDLER
// ═══════════════════════════════════════════════════════════

export const powerpoint = {
  async createPresentation(): Promise<CommandResult> {
    console.log('[AppControl] Creating PowerPoint presentation...')
    return osascript('tell application "Microsoft PowerPoint" to make new presentation')
  },

  async addSlide(): Promise<CommandResult> {
    return osascript(
      `tell application "Microsoft PowerPoint"\ntell active presentation\nmake new slide at end\nend tell\nend tell`
    )
  },

  async setTitle(text: string): Promise<CommandResult> {
    const escaped = text.replace(/"/g, '\\"')
    return osascript(
      `tell application "Microsoft PowerPoint"\ntell slide 1 of active presentation\nset content of text range of text frame of placeholder 1 to "${escaped}"\nend tell\nend tell`
    )
  },

  async setBody(text: string): Promise<CommandResult> {
    const escaped = text.replace(/"/g, '\\"')
    return osascript(
      `tell application "Microsoft PowerPoint"\ntell slide 1 of active presentation\nset content of text range of text frame of placeholder 2 to "${escaped}"\nend tell\nend tell`
    )
  },

  async startSlideshow(): Promise<CommandResult> {
    return osascript(
      'tell application "Microsoft PowerPoint" to run slide show of active presentation'
    )
  },

  async nextSlide(): Promise<CommandResult> {
    return osascript(
      'tell application "Microsoft PowerPoint" to go to next slide of slide show view of slide show window 1'
    )
  },

  async previousSlide(): Promise<CommandResult> {
    return osascript(
      'tell application "Microsoft PowerPoint" to go to previous slide of slide show view of slide show window 1'
    )
  },

  async endSlideshow(): Promise<CommandResult> {
    return osascript(
      'tell application "Microsoft PowerPoint" to exit slide show of slide show view of slide show window 1'
    )
  },

  async save(): Promise<CommandResult> {
    return osascript('tell application "Microsoft PowerPoint" to save active presentation')
  },
}

// ═══════════════════════════════════════════════════════════
// SAFARI HANDLER
// ═══════════════════════════════════════════════════════════

export const safari = {
  async openUrl(url: string): Promise<CommandResult> {
    console.log(`[AppControl] Opening URL: ${url}`)
    return osascript(`tell application "Safari" to open location "${url}"`)
  },

  async getCurrentUrl(): Promise<CommandResult> {
    return osascript(
      'tell application "Safari" to get URL of current tab of front window'
    )
  },

  async getPageText(): Promise<CommandResult> {
    return osascript(
      'tell application "Safari" to get text of current tab of front window',
      15000
    )
  },

  async search(query: string): Promise<CommandResult> {
    const encoded = encodeURIComponent(query)
    return osascript(
      `tell application "Safari" to open location "https://www.google.com/search?q=${encoded}"`
    )
  },

  async newTab(): Promise<CommandResult> {
    return osascript(
      'tell application "Safari" to tell front window to make new tab'
    )
  },

  async closeTab(): Promise<CommandResult> {
    return osascript(
      'tell application "Safari" to close current tab of front window'
    )
  },

  async goBack(): Promise<CommandResult> {
    return osascript(
      'tell application "Safari" to set URL of current tab of front window to do JavaScript "history.back()" in current tab of front window'
    )
  },

  async goForward(): Promise<CommandResult> {
    return osascript(
      'tell application "Safari" to set URL of current tab of front window to do JavaScript "history.forward()" in current tab of front window'
    )
  },

  async reload(): Promise<CommandResult> {
    // Cmd+R
    return universal.keyCombo('r', ['command'])
  },
}

// ═══════════════════════════════════════════════════════════
// MESSAGES HANDLER
// ═══════════════════════════════════════════════════════════

export const messages = {
  async send(contact: string, text: string): Promise<CommandResult> {
    const escaped = text.replace(/"/g, '\\"')
    console.log(`[AppControl] Sending message to ${contact}...`)
    return osascript(
      `tell application "Messages" to send "${escaped}" to buddy "${contact}"`,
      15000
    )
  },

  async readRecent(): Promise<CommandResult> {
    return osascript(
      `tell application "Messages"\nset recentChats to every chat\nset output to ""\nrepeat with c in (items 1 thru (min of {5, count of recentChats}) of recentChats)\nset output to output & name of c & ": " & (get content of last message of c) & return\nend repeat\nreturn output\nend tell`,
      10000
    )
  },
}

// ═══════════════════════════════════════════════════════════
// SYSTEM CONTROLS
// ═══════════════════════════════════════════════════════════

export const system = {
  async setVolume(level: number): Promise<CommandResult> {
    const clamped = Math.max(0, Math.min(100, level))
    console.log(`[AppControl] Setting volume to ${clamped}%`)
    return osascript(`set volume output volume ${clamped}`)
  },

  async getVolume(): Promise<CommandResult> {
    return osascript('output volume of (get volume settings)')
  },

  async mute(): Promise<CommandResult> {
    console.log('[AppControl] Muting audio')
    return osascript('set volume with output muted')
  },

  async unmute(): Promise<CommandResult> {
    console.log('[AppControl] Unmuting audio')
    return osascript('set volume without output muted')
  },

  async setBrightness(level: number): Promise<CommandResult> {
    // Uses brightness command if available, falls back to AppleScript
    const normalized = Math.max(0, Math.min(100, level)) / 100
    return run(`brightness ${normalized} 2>/dev/null || osascript -e 'tell application "System Preferences" to quit'`)
  },

  async darkMode(enable = true): Promise<CommandResult> {
    const mode = enable ? 'true' : 'false'
    console.log(`[AppControl] ${enable ? 'Enabling' : 'Disabling'} dark mode`)
    return osascript(
      `tell application "System Events" to tell appearance preferences to set dark mode to ${mode}`
    )
  },

  async getDarkMode(): Promise<CommandResult> {
    return osascript(
      'tell application "System Events" to tell appearance preferences to get dark mode'
    )
  },

  async lockScreen(): Promise<CommandResult> {
    console.log('[AppControl] Locking screen')
    return run(
      '/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend'
    )
  },

  async sleep(): Promise<CommandResult> {
    console.log('[AppControl] Putting Mac to sleep')
    return osascript('tell application "System Events" to sleep')
  },

  async screenshot(path = '~/Desktop/screenshot.png'): Promise<CommandResult> {
    return run(`screencapture -x ${path}`)
  },

  async emptyTrash(): Promise<CommandResult> {
    console.log('[AppControl] Emptying trash')
    return osascript('tell application "Finder" to empty trash')
  },

  async ejectAll(): Promise<CommandResult> {
    return osascript('tell application "Finder" to eject every disk')
  },

  async getWifiName(): Promise<CommandResult> {
    return run(
      "networksetup -getairportnetwork en0 | awk -F': ' '{print $2}'"
    )
  },

  async getBatteryLevel(): Promise<CommandResult> {
    return run(
      "pmset -g batt | grep -Eo '\\d+%' | head -1"
    )
  },

  async isCharging(): Promise<CommandResult> {
    return run(
      "pmset -g batt | grep -c 'AC Power'"
    )
  },

  async getUptime(): Promise<CommandResult> {
    return run('uptime')
  },

  async getMemoryUsage(): Promise<CommandResult> {
    return run(
      "memory_pressure | head -1"
    )
  },

  async getDiskSpace(): Promise<CommandResult> {
    return run("df -h / | tail -1 | awk '{print $4 \" available of \" $2}'")
  },

  async doNotDisturb(enable = true): Promise<CommandResult> {
    if (enable) {
      return run('shortcuts run "Focus On" 2>/dev/null || echo "DND shortcut not found"')
    }
    return run('shortcuts run "Focus Off" 2>/dev/null || echo "DND shortcut not found"')
  },

  async openSystemPreferences(pane?: string): Promise<CommandResult> {
    if (pane) {
      return osascript(
        `tell application "System Settings" to activate\ndelay 0.5\ntell application "System Events" to tell process "System Settings" to click menu item "${pane}" of menu "View" of menu bar 1`
      )
    }
    return osascript('tell application "System Settings" to activate')
  },
}

// ═══════════════════════════════════════════════════════════
// FINDER HANDLER
// ═══════════════════════════════════════════════════════════

export const finder = {
  async openFolder(path: string): Promise<CommandResult> {
    return run(`open "${path}"`)
  },

  async revealFile(path: string): Promise<CommandResult> {
    return run(`open -R "${path}"`)
  },

  async newFinderWindow(): Promise<CommandResult> {
    return osascript('tell application "Finder" to make new Finder window')
  },

  async getSelectedFiles(): Promise<CommandResult> {
    return osascript(
      'tell application "Finder" to get name of every item of (get selection)'
    )
  },
}

// ═══════════════════════════════════════════════════════════
// MUSIC HANDLER
// ═══════════════════════════════════════════════════════════

export const music = {
  async play(): Promise<CommandResult> {
    return osascript('tell application "Music" to play')
  },

  async pause(): Promise<CommandResult> {
    return osascript('tell application "Music" to pause')
  },

  async next(): Promise<CommandResult> {
    return osascript('tell application "Music" to next track')
  },

  async previous(): Promise<CommandResult> {
    return osascript('tell application "Music" to previous track')
  },

  async getNowPlaying(): Promise<CommandResult> {
    return osascript(
      'tell application "Music"\nif player state is playing then\nreturn name of current track & " by " & artist of current track\nelse\nreturn "Nothing playing"\nend if\nend tell'
    )
  },

  async setVolume(level: number): Promise<CommandResult> {
    return osascript(`tell application "Music" to set sound volume to ${level}`)
  },

  async searchAndPlay(query: string): Promise<CommandResult> {
    const escaped = query.replace(/"/g, '\\"')
    return osascript(
      `tell application "Music"\nactivate\nset searchResults to search playlist "Library" for "${escaped}"\nif (count of searchResults) > 0 then\nplay item 1 of searchResults\nreturn "Playing: " & name of item 1 of searchResults\nelse\nreturn "No results found for: ${escaped}"\nend if\nend tell`,
      15000
    )
  },
}
