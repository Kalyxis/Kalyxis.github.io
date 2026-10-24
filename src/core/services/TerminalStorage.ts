import { TERMINAL_STARTER } from '../templates/terminalExamples'

const KEY = 'kalyxis.terminal.v1'

export interface TerminalSnapshot {
  code: string
  stdin: string
}

/** The terminal scratchpad is remembered on this device between visits. */
export function loadTerminal(): TerminalSnapshot {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<TerminalSnapshot> | null
    if (raw && typeof raw.code === 'string') return { code: raw.code, stdin: typeof raw.stdin === 'string' ? raw.stdin : '' }
  } catch {
    // fall through to the starter
  }
  return { code: TERMINAL_STARTER, stdin: '' }
}

export function saveTerminal(snapshot: TerminalSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    // private mode or quota
  }
}
