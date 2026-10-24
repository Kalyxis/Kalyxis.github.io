import { create } from 'zustand'
import type { LanguageId } from '../core/languages/catalog'
import type { FsEntry } from '../core/fs/FileSystemProvider'
import type { Eol } from '../core/documents/DocumentSession'
import type { SourceKind } from '../core/documents/DocumentSource'
import { loadSettings, type Settings } from '../core/services/settings'

export interface TabMeta {
  id: string
  name: string
  path: string
  languageId: LanguageId
  dirty: boolean
  untitled: boolean
  stdin: string
  eol: Eol
  sourceKind: SourceKind
}

export type PanelTab = 'console' | 'input' | 'problems' | 'preview'
export type RunStatus = 'idle' | 'running' | 'done' | 'error' | 'stopped'
export type RuntimeState = 'idle' | 'loading' | 'ready'

export interface ConsoleChunk {
  kind: 'stdout' | 'stderr' | 'info'
  text: string
}

export interface Problem {
  line: number
  col: number
  from: number
  severity: 'error' | 'warning' | 'info'
  message: string
}

export interface ToastState {
  id: number
  message: string
  kind: 'info' | 'success' | 'error'
  action?: { label: string; run: () => void }
}

export interface ChoiceOption {
  id: string
  label: string
  tone?: 'default' | 'danger' | 'primary'
}

export type DialogState =
  | {
      kind: 'prompt'
      title: string
      label?: string
      initial: string
      placeholder?: string
      confirmLabel: string
      multiline?: boolean
      selectStem?: boolean
      validate?: (value: string) => string | null
      resolve: (value: string | null) => void
    }
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; danger?: boolean; resolve: (value: boolean) => void }
  | { kind: 'choice'; title: string; message: string; options: ChoiceOption[]; resolve: (id: string | null) => void }

export interface WorkspaceInfo {
  kind: 'local' | 'disk'
  label: string
  rootName: string
}

export interface UiState {
  sidebarOpen: boolean
  wide: boolean
  panelOpen: boolean
  panelTab: PanelTab
  paletteOpen: boolean
  paletteMode: 'all' | 'files'
  settingsOpen: boolean
  languageSheetOpen: boolean
  examplesOpen: boolean
  findOpen: boolean
  findReplace: boolean
  keyboardOpen: boolean
  editorFocused: boolean
  previewFullscreen: boolean
  entryMenu: FsEntry | null
  newMenuOpen: boolean
  explorerMenuOpen: boolean
}

export interface RunState {
  status: RunStatus
  chunks: ConsoleChunk[]
  chars: number
  ms: number | null
  error: string | null
  runner: string | null
  runtime: RuntimeState
}

export interface CursorState {
  line: number
  col: number
  selected: number
  lines: number
}

interface AppState {
  settings: Settings
  tabs: TabMeta[]
  activeTabId: string | null
  workspace: WorkspaceInfo
  tree: Record<string, FsEntry[]>
  expanded: Record<string, boolean>
  loadingDirs: Record<string, boolean>
  selectedPath: string | null
  lastFolderName: string | null
  ui: UiState
  run: RunState
  preview: { html: string | null; key: number }
  cursor: CursorState
  problems: Problem[]
  toast: ToastState | null
  dialog: DialogState | null
  installHint: 'ios' | 'prompt' | null
  patchUi: (patch: Partial<UiState>) => void
}

const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches

export const useAppStore = create<AppState>((set) => ({
  settings: loadSettings(),
  tabs: [],
  activeTabId: null,
  workspace: { kind: 'local', label: 'On this device', rootName: 'Kalyxis' },
  tree: {},
  expanded: {},
  loadingDirs: {},
  selectedPath: null,
  lastFolderName: null,
  ui: {
    sidebarOpen: wide,
    wide,
    panelOpen: false,
    panelTab: 'console',
    paletteOpen: false,
    paletteMode: 'all',
    settingsOpen: false,
    languageSheetOpen: false,
    examplesOpen: false,
    findOpen: false,
    findReplace: false,
    keyboardOpen: false,
    editorFocused: false,
    previewFullscreen: false,
    entryMenu: null,
    newMenuOpen: false,
    explorerMenuOpen: false,
  },
  run: { status: 'idle', chunks: [], chars: 0, ms: null, error: null, runner: null, runtime: 'idle' },
  preview: { html: null, key: 0 },
  cursor: { line: 1, col: 1, selected: 0, lines: 1 },
  problems: [],
  toast: null,
  dialog: null,
  installHint: null,
  patchUi: (patch) => set((state) => ({ ui: { ...state.ui, ...patch } })),
}))

export const activeTabSelector = (s: AppState): TabMeta | undefined => s.tabs.find((t) => t.id === s.activeTabId)
