import { clamp } from '../util/timing'

export type ThemeChoice = 'dark' | 'light' | 'system'

export interface Settings {
  theme: ThemeChoice
  fontSize: number
  tabSize: 2 | 4 | 8
  useTabs: boolean
  wordWrap: boolean
  lineNumbers: boolean
  foldGutter: boolean
  activeLine: boolean
  rainbowBrackets: boolean
  autoClose: boolean
  autocomplete: boolean
  syntaxCheck: boolean
  showWhitespace: boolean
  autoSave: boolean
  keyBar: boolean
  runTimeoutSec: 10 | 30 | 60
  /** Height of the bottom panel in CSS pixels. */
  panelHeight: number
}

export const SETTINGS_KEY = 'kalyxis.settings.v1'

export function defaultSettings(): Settings {
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  return {
    theme: 'dark',
    fontSize: touch ? 15 : 14,
    tabSize: 2,
    useTabs: false,
    wordWrap: touch,
    lineNumbers: true,
    foldGutter: !touch,
    activeLine: true,
    rainbowBrackets: true,
    autoClose: true,
    autocomplete: true,
    syntaxCheck: true,
    showWhitespace: false,
    autoSave: true,
    keyBar: true,
    runTimeoutSec: 30,
    panelHeight: 260,
  }
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)
const pick = <T extends number>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback

/** Reads saved settings, repairing anything missing or invalid so a bad value can never break the app. */
export function loadSettings(): Settings {
  const d = defaultSettings()
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<Record<keyof Settings, unknown>> | null
    if (!raw || typeof raw !== 'object') return d
    return {
      theme: raw.theme === 'light' || raw.theme === 'system' || raw.theme === 'dark' ? raw.theme : d.theme,
      fontSize: typeof raw.fontSize === 'number' ? clamp(Math.round(raw.fontSize), 11, 26) : d.fontSize,
      tabSize: pick(raw.tabSize, [2, 4, 8] as const, d.tabSize),
      useTabs: bool(raw.useTabs, d.useTabs),
      wordWrap: bool(raw.wordWrap, d.wordWrap),
      lineNumbers: bool(raw.lineNumbers, d.lineNumbers),
      foldGutter: bool(raw.foldGutter, d.foldGutter),
      activeLine: bool(raw.activeLine, d.activeLine),
      rainbowBrackets: bool(raw.rainbowBrackets, d.rainbowBrackets),
      autoClose: bool(raw.autoClose, d.autoClose),
      autocomplete: bool(raw.autocomplete, d.autocomplete),
      syntaxCheck: bool(raw.syntaxCheck, d.syntaxCheck),
      showWhitespace: bool(raw.showWhitespace, d.showWhitespace),
      autoSave: bool(raw.autoSave, d.autoSave),
      keyBar: bool(raw.keyBar, d.keyBar),
      runTimeoutSec: pick(raw.runTimeoutSec, [10, 30, 60] as const, d.runTimeoutSec),
      panelHeight: typeof raw.panelHeight === 'number' ? clamp(Math.round(raw.panelHeight), 120, 900) : d.panelHeight,
    }
  } catch {
    return d
  }
}

export function persistSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Private mode or a full quota: settings simply last for this visit.
  }
}
