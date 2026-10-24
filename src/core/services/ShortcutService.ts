import { Platform } from '../util/platform'
import { useAppStore } from '../../store/useAppStore'
import type { CommandRegistry } from './CommandRegistry'

/** key combo -> command id. "Mod" is Cmd on Apple devices and Ctrl elsewhere. */
export const SHORTCUTS: Record<string, string> = {
  'Mod+KeyO': 'file.open',
  'Mod+KeyS': 'file.save',
  'Mod+Shift+KeyS': 'file.saveAs',
  'Mod+Enter': 'edit.lineBelow',
  'Mod+Shift+Enter': 'run.run',
  'Mod+Period': 'run.stop',
  'Mod+KeyP': 'go.quickOpen',
  'Mod+Shift+KeyP': 'go.palette',
  'Mod+KeyB': 'view.sidebar',
  'Mod+Backquote': 'view.panel',
  'Mod+KeyF': 'edit.find',
  'Mod+KeyH': 'edit.replace',
  'Mod+KeyG': 'edit.gotoLine',
  'Alt+Shift+KeyF': 'edit.format',
  'Alt+KeyW': 'file.close',
  'Alt+BracketRight': 'go.nextTab',
  'Alt+BracketLeft': 'go.prevTab',
  'Mod+Comma': 'view.settings',
}

/** Pretty label for a shortcut, for example "Mod+Shift+KeyS" becomes "Cmd Shift S". */
export function shortcutLabel(combo: string): string {
  return combo
    .split('+')
    .map((part) => {
      if (part === 'Mod') return Platform.isMac ? '\u2318' : 'Ctrl'
      if (part === 'Shift') return Platform.isMac ? '\u21e7' : 'Shift'
      if (part === 'Alt') return Platform.isMac ? '\u2325' : 'Alt'
      if (part.startsWith('Key')) return part.slice(3)
      const names: Record<string, string> = { Enter: '\u21b5', Period: '.', Backquote: '`', BracketRight: ']', BracketLeft: '[', Comma: ',' }
      return names[part] ?? part
    })
    .join(Platform.isMac ? '' : '+')
}

export function shortcutFor(commandId: string): string | undefined {
  return Object.entries(SHORTCUTS).find(([, id]) => id === commandId)?.[0]
}

/** Global keyboard shortcuts for hardware keyboards (desktop, iPad and Android keyboards). */
export class ShortcutService {
  private readonly commands: CommandRegistry

  constructor(commands: CommandRegistry) {
    this.commands = commands
  }

  start(): void {
    window.addEventListener('keydown', (event) => this.onKeyDown(event), { capture: true })
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing || event.repeat) return
    if (useAppStore.getState().ui.terminalOpen) return
    // Ctrl+Enter inserts a line below on every platform, including Apple keyboards.
    const mod = Platform.isMac ? event.metaKey || (event.ctrlKey && event.code === 'Enter') : event.ctrlKey
    const parts: string[] = []
    if (mod) parts.push('Mod')
    if (event.altKey) parts.push('Alt')
    if (event.shiftKey) parts.push('Shift')
    if (!parts.length) return
    // Mod+Alt+Shift keeps its CodeMirror meaning (multiple cursors and so on).
    parts.sort((a, b) => ['Mod', 'Alt', 'Shift'].indexOf(a) - ['Mod', 'Alt', 'Shift'].indexOf(b))
    const combo = [...parts, event.code].join('+')
    const id = SHORTCUTS[combo]
    if (!id) return
    if (useAppStore.getState().dialog) return
    event.preventDefault()
    event.stopPropagation()
    void this.commands.execute(id)
  }
}
