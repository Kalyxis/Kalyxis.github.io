import type { DocumentManager } from '../documents/DocumentManager'
import { MemorySource, WorkspaceSource } from '../documents/DocumentSource'
import type { LanguageId } from '../languages/catalog'
import { debounce } from '../util/timing'
import { useAppStore } from '../../store/useAppStore'
import type { WorkspaceService } from './WorkspaceService'

const KEY = 'kalyxis.session.v1'
const MAX_UNTITLED_CHARS = 300_000

type SavedTab =
  | { kind: 'workspace'; path: string; stdin: string; language: LanguageId | null }
  | { kind: 'memory'; name: string; text: string; stdin: string; language: LanguageId | null }

interface SavedSession {
  tabs: SavedTab[]
  active: number
  expanded: string[]
}

/** Remembers open tabs, scratch buffers and expanded folders between visits. */
export class SessionService {
  private readonly documents: DocumentManager
  private readonly workspace: WorkspaceService
  private readonly persist = debounce(() => this.write(), 600)

  constructor(documents: DocumentManager, workspace: WorkspaceService) {
    this.documents = documents
    this.workspace = workspace
  }

  start(): void {
    this.documents.edited.subscribe(() => this.persist())
    window.addEventListener('pagehide', () => this.persist.flush())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.persist.flush()
    })
  }

  async restore(): Promise<void> {
    let saved: SavedSession | null = null
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SavedSession | null
    } catch {
      saved = null
    }
    if (!saved || !Array.isArray(saved.tabs)) return
    const expanded: Record<string, boolean> = {}
    for (const p of saved.expanded ?? []) if (typeof p === 'string') expanded[p] = true
    useAppStore.setState({ expanded })
    await this.workspace.refresh()
    const opened = []
    for (const tab of saved.tabs) {
      if (tab.kind === 'memory') {
        this.documents.restoreUntitled(tab.name, tab.text, tab.stdin, tab.language)
        opened.push(true)
      } else if (tab.kind === 'workspace') {
        const exists = await this.workspace.local.exists(tab.path)
        if (!exists) continue
        const session = await this.documents.openSource(new WorkspaceSource(this.workspace.local, tab.path), {
          stdin: tab.stdin,
          languageId: tab.language ?? undefined,
          activate: false,
        })
        if (session) opened.push(true)
      }
    }
    const all = this.documents.all
    const target = all[Math.min(Math.max(0, saved.active), all.length - 1)]
    if (target) this.documents.activate(target.id)
  }

  private write(): void {
    try {
      const tabs: SavedTab[] = []
      let active = 0
      const activeId = this.documents.active?.id
      for (const s of this.documents.all) {
        const src = s.source
        if (src instanceof WorkspaceSource && src.provider.id === 'local') {
          if (s.id === activeId) active = tabs.length
          tabs.push({ kind: 'workspace', path: src.path, stdin: s.stdin, language: s.languageOverrideId })
        } else if (src instanceof MemorySource && s.state.doc.length <= MAX_UNTITLED_CHARS) {
          if (s.id === activeId) active = tabs.length
          tabs.push({ kind: 'memory', name: s.name, text: s.getText(), stdin: s.stdin, language: s.languageOverrideId })
        }
      }
      const expanded = Object.entries(useAppStore.getState().expanded).filter(([, open]) => open).map(([p]) => p)
      localStorage.setItem(KEY, JSON.stringify({ tabs, active, expanded } satisfies SavedSession))
    } catch {
      // Storage full or unavailable: nothing to do.
    }
  }
}
