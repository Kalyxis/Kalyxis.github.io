import type { EditorController } from '../editor/EditorController'
import { errorMessage, isAbort } from '../fs/errors'
import { defaultExtension, detectLanguage, type LanguageId } from '../languages/catalog'
import type { DialogService } from '../services/DialogService'
import type { ShareService } from '../services/ShareService'
import type { ToastService } from '../services/ToastService'
import type { WorkspaceService } from '../services/WorkspaceService'
import { Emitter } from '../util/Emitter'
import { isInside, rebase, validateName } from '../util/paths'
import { Platform } from '../util/platform'
import { detectEol } from '../util/text'
import { useAppStore, type ChoiceOption, type TabMeta } from '../../store/useAppStore'
import { DocumentSession, type Eol } from './DocumentSession'
import { DocumentSource, HandleSource, MemorySource, WorkspaceSource } from './DocumentSource'

interface Deps {
  workspace: WorkspaceService
  editor: EditorController
  dialogs: DialogService
  toasts: ToastService
  share: ShareService
}

/** Owns every open document: opening, closing, switching tabs and saving. */
export class DocumentManager {
  /** Fires after any edit or structural change. Auto save and session persistence listen to it. */
  readonly edited = new Emitter<DocumentSession | null>()
  private readonly sessions = new Map<string, DocumentSession>()
  private order: string[] = []
  private activeId: string | null = null
  private readonly saving = new Set<string>()
  private readonly deps: Deps

  constructor(deps: Deps) {
    this.deps = deps
    deps.editor.events.change.subscribe((session) => this.handleChange(session))
    deps.workspace.pathChanged.subscribe((change) => this.handlePathChange(change))
  }

  get active(): DocumentSession | null {
    return this.activeId ? (this.sessions.get(this.activeId) ?? null) : null
  }

  get all(): DocumentSession[] {
    return this.order.map((id) => this.sessions.get(id)).filter((s): s is DocumentSession => !!s)
  }

  byId(id: string): DocumentSession | undefined {
    return this.sessions.get(id)
  }

  /* ---------------------------------- opening ---------------------------------- */

  async openFile(path: string): Promise<DocumentSession | null> {
    return this.openSource(new WorkspaceSource(this.deps.workspace.provider, path))
  }

  async openSource(source: DocumentSource, options: { stdin?: string; languageId?: LanguageId; activate?: boolean } = {}): Promise<DocumentSession | null> {
    const existing = this.all.find((s) => s.source.key === source.key)
    if (existing) {
      if (options.activate !== false) this.activate(existing.id)
      return existing
    }
    let text: string
    try {
      text = await source.read()
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, `Could not open "${source.name}".`))
      return null
    }
    const session = this.create(source, text, options.languageId ?? null)
    if (options.stdin) session.stdin = options.stdin
    if (options.activate !== false) this.activate(session.id)
    else this.publish()
    return session
  }

  openUntitled(languageId: LanguageId = 'plaintext', text = '', stdin = ''): DocumentSession {
    const ext = defaultExtension(languageId)
    const used = new Set(this.all.map((s) => s.name))
    let n = 1
    while (used.has(`Untitled-${n}.${ext}`)) n++
    const session = this.create(new MemorySource(`Untitled-${n}.${ext}`, text), text, languageId === detectLanguage(`x.${ext}`) ? null : languageId)
    session.stdin = stdin
    this.activate(session.id)
    return session
  }

  /** Restores a scratch buffer from a previous visit. */
  restoreUntitled(name: string, text: string, stdin: string, languageId: LanguageId | null): void {
    const session = this.create(new MemorySource(name, text), text, languageId)
    session.stdin = stdin
    this.publish()
  }

  async openWithPicker(): Promise<void> {
    if (!window.showOpenFilePicker) return
    try {
      const handles = await window.showOpenFilePicker({ multiple: true })
      for (const handle of handles) await this.openSource(new HandleSource(handle))
    } catch (error) {
      if (!isAbort(error)) this.deps.toasts.error(errorMessage(error, 'Could not open the file.'))
    }
  }

  private create(source: DocumentSource, text: string, languageOverride: LanguageId | null): DocumentSession {
    const languageId = languageOverride ?? detectLanguage(source.name)
    const state = this.deps.editor.createState(text, languageId)
    const session = new DocumentSession(source, state, detectEol(text), languageOverride)
    this.sessions.set(session.id, session)
    this.order.push(session.id)
    return session
  }

  /* --------------------------------- tab control --------------------------------- */

  activate(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    this.activeId = id
    this.deps.editor.show(session)
    this.publish()
  }

  next(step: 1 | -1): void {
    if (this.order.length < 2 || !this.activeId) return
    const i = this.order.indexOf(this.activeId)
    this.activate(this.order[(i + step + this.order.length) % this.order.length])
  }

  async close(id: string, options: { force?: boolean } = {}): Promise<boolean> {
    const session = this.sessions.get(id)
    if (!session) return true
    if (session.dirty && !options.force) {
      const choice = await this.deps.dialogs.choose({
        title: `Save changes to ${session.name}?`,
        message: 'Your changes will be lost if you do not save them.',
        options: [
          { id: 'save', label: 'Save', tone: 'primary' },
          { id: 'discard', label: "Don't save", tone: 'danger' },
          { id: 'cancel', label: 'Cancel' },
        ],
      })
      if (choice === null || choice === 'cancel') return false
      if (choice === 'save' && !(await this.save(id))) return false
    }
    this.remove(id)
    return true
  }

  async closeOthers(id: string): Promise<void> {
    for (const other of this.order.slice()) if (other !== id) await this.close(other)
  }

  async closeAll(): Promise<void> {
    for (const id of this.order.slice()) if (!(await this.close(id))) return
  }

  private remove(id: string): void {
    const index = this.order.indexOf(id)
    this.order = this.order.filter((x) => x !== id)
    this.sessions.delete(id)
    if (this.activeId === id) {
      this.activeId = this.order[Math.min(index, this.order.length - 1)] ?? null
      this.deps.editor.show(this.activeId ? (this.sessions.get(this.activeId) ?? null) : null)
    }
    this.publish()
  }

  /* ----------------------------------- editing ----------------------------------- */

  setStdin(id: string, stdin: string): void {
    const session = this.sessions.get(id)
    if (!session || session.stdin === stdin) return
    session.stdin = stdin
    this.publish()
    this.edited.emit(session)
  }

  setLanguage(id: string, languageId: LanguageId | null): void {
    const session = this.sessions.get(id)
    if (!session) return
    session.setLanguage(languageId)
    session.appliedConfig = ''
    this.deps.editor.refresh(session)
    this.publish()
  }

  setEol(id: string, eol: Eol): void {
    const session = this.sessions.get(id)
    if (!session || session.eol === eol) return
    session.eol = eol
    session.refreshDirty()
    this.publish()
    this.edited.emit(session)
  }

  private handleChange(session: DocumentSession): void {
    if (session.refreshDirty()) this.publish()
    this.edited.emit(session)
  }

  /* ----------------------------------- saving ----------------------------------- */

  async save(id: string | null = this.activeId, options: { silent?: boolean } = {}): Promise<boolean> {
    const session = id ? this.sessions.get(id) : null
    if (!session) return false
    if (!session.source.writable) return options.silent ? false : this.saveAs(session.id)
    if (this.saving.has(session.id)) return true
    this.saving.add(session.id)
    const written = session.state.doc
    const eol = session.eol
    try {
      await session.source.write(session.getText())
      session.markSaved(written, eol)
      this.publish()
      if (!options.silent) this.deps.toasts.success(`Saved ${session.name}`)
      return true
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, `Could not save "${session.name}".`))
      return false
    } finally {
      this.saving.delete(session.id)
      if (session.dirty && options.silent) this.edited.emit(session)
    }
  }

  /** Saves every document that has changes and a place to be saved to. */
  async saveDirty(): Promise<void> {
    await Promise.all(this.all.filter((s) => s.dirty && s.source.writable).map((s) => this.save(s.id, { silent: true })))
  }

  async saveAs(id: string): Promise<boolean> {
    const session = this.sessions.get(id)
    if (!session) return false
    const { workspace, dialogs, toasts, share } = this.deps
    const provider = workspace.provider
    const options: ChoiceOption[] = [{ id: 'workspace', label: `Save in ${provider.label}`, tone: 'primary' }]
    if (provider.id !== 'local') options.push({ id: 'device', label: 'Save on this device' })
    if (Platform.canSavePicker) options.push({ id: 'picker', label: 'Choose a location' })
    options.push({ id: 'download', label: Platform.isIOS ? 'Save to Files or share' : 'Download a copy' }, { id: 'cancel', label: 'Cancel' })
    const choice = await dialogs.choose({ title: 'Save file', message: `Where should "${session.name}" be saved?`, options })
    if (!choice || choice === 'cancel') return false

    const text = session.getText()
    if (choice === 'download') {
      share.saveText(session.name, text)
      return false
    }
    if (choice === 'picker') {
      try {
        const handle = await window.showSaveFilePicker?.({ suggestedName: session.name })
        if (!handle) return false
        const source = new HandleSource(handle)
        await source.write(text)
        this.adopt(session, source)
        return true
      } catch (error) {
        if (!isAbort(error)) toasts.error(errorMessage(error, 'Could not save the file.'))
        return false
      }
    }
    const target = choice === 'device' ? workspace.local : provider
    const name = await dialogs.prompt({ title: 'Save as', initial: session.name, confirmLabel: 'Save', selectStem: true, validate: validateName })
    if (name === null) return false
    const dir = target === provider ? workspace.currentDir() : '/'
    const path = `${dir === '/' ? '' : dir}/${name.trim()}`
    try {
      if (await target.exists(path)) {
        const ok = await dialogs.confirm({ title: 'Replace file?', message: `"${name.trim()}" already exists.`, confirmLabel: 'Replace', danger: true })
        if (!ok) return false
      }
      await target.writeText(path, text)
      this.adopt(session, new WorkspaceSource(target, path))
      if (target === provider) await workspace.loadDir(dir)
      return true
    } catch (error) {
      toasts.error(errorMessage(error, 'Could not save the file.'))
      return false
    }
  }

  /** Opens the Save sheet for a copy of a document: Save to Files on iPhone, a download elsewhere. */
  exportToDevice(id: string | null = this.activeId): void {
    const session = id ? this.sessions.get(id) : null
    if (session) this.deps.share.saveText(session.name, session.getText())
  }

  private adopt(session: DocumentSession, source: DocumentSource): void {
    session.source = source
    session.setLanguage(null)
    session.markSaved(session.state.doc, session.eol)
    session.appliedConfig = ''
    this.deps.editor.refresh(session)
    this.publish()
    this.deps.toasts.success(`Saved ${source.name}`)
  }

  /* ------------------------------ external changes ------------------------------ */

  private handlePathChange(change: { type: 'rename'; from: string; to: string; providerId: string } | { type: 'remove'; path: string; providerId: string }): void {
    for (const session of this.all) {
      const source = session.source
      if (!(source instanceof WorkspaceSource) || source.provider.id !== change.providerId) continue
      if (change.type === 'rename' && isInside(source.path, change.from)) {
        source.relocate(rebase(source.path, change.from, change.to))
        session.appliedConfig = ''
        this.deps.editor.refresh(session)
      } else if (change.type === 'remove' && isInside(source.path, change.path)) {
        this.remove(session.id)
      }
    }
    this.publish()
  }

  /** Pushes tab metadata to the store so React re-renders. */
  publish(): void {
    const tabs: TabMeta[] = this.all.map((s) => ({
      id: s.id,
      name: s.name,
      path: s.path,
      languageId: s.languageId,
      dirty: s.dirty,
      untitled: s.untitled,
      stdin: s.stdin,
      eol: s.eol,
      sourceKind: s.source.kind,
    }))
    useAppStore.setState({ tabs, activeTabId: this.activeId })
    this.edited.emit(null)
  }
}
