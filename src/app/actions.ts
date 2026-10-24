import type { EditorController } from '../core/editor/EditorController'
import type { DocumentManager } from '../core/documents/DocumentManager'
import type { FsEntry } from '../core/fs/FileSystemProvider'
import { getLanguageInfo, type LanguageId } from '../core/languages/catalog'
import type { RunService } from '../core/run/RunService'
import type { DialogService } from '../core/services/DialogService'
import type { Formatter } from '../core/services/Formatter'
import type { SettingsService } from '../core/services/SettingsService'
import type { ToastService } from '../core/services/ToastService'
import type { WorkspaceService } from '../core/services/WorkspaceService'
import type { Example } from '../core/templates/examples'
import { BINARY_EXTENSIONS } from '../core/languages/catalog'
import { extname, joinPath, uniqueName } from '../core/util/paths'
import { Platform } from '../core/util/platform'
import { clamp } from '../core/util/timing'
import { useAppStore, type PanelTab } from '../store/useAppStore'

export interface ActionDeps {
  editor: EditorController
  documents: DocumentManager
  workspace: WorkspaceService
  runs: RunService
  dialogs: DialogService
  toasts: ToastService
  settings: SettingsService
  formatter: Formatter
}

/** Higher level user actions that combine several services. UI components and commands call these. */
export class AppActions {
  private readonly d: ActionDeps

  constructor(deps: ActionDeps) {
    this.d = deps
  }

  private get ui() {
    return useAppStore.getState().ui
  }

  private closeDrawerOnPhone(): void {
    if (!this.ui.wide) useAppStore.getState().patchUi({ sidebarOpen: false })
  }

  /* ---------------------------------- files ---------------------------------- */

  async openEntry(entry: FsEntry): Promise<void> {
    if (entry.kind === 'directory') {
      await this.d.workspace.toggle(entry.path)
      return
    }
    this.d.workspace.select(entry.path)
    const session = await this.d.documents.openFile(entry.path)
    if (session) {
      this.closeDrawerOnPhone()
      if (this.ui.wide) this.d.editor.focus()
    }
  }

  async newFile(dir?: string): Promise<void> {
    const path = await this.d.workspace.promptNewFile(dir)
    if (!path) return
    await this.d.documents.openFile(path)
    this.closeDrawerOnPhone()
  }

  async newFolder(dir?: string): Promise<void> {
    await this.d.workspace.promptNewFolder(dir)
  }

  newScratch(languageId: LanguageId = 'plaintext'): void {
    this.d.documents.openUntitled(languageId)
    this.closeDrawerOnPhone()
  }

  async createFromExample(example: Example): Promise<void> {
    const { workspace, documents } = this.d
    const dir = workspace.currentDir()
    const taken = new Set((await workspace.provider.list(dir)).map((e) => e.name))
    const name = uniqueName(example.fileName, taken)
    const path = await workspace.createFile(dir, name, example.code)
    if (!path) return
    const session = await documents.openFile(path)
    if (session && example.stdin) documents.setStdin(session.id, example.stdin)
    useAppStore.getState().patchUi({ examplesOpen: false })
    this.closeDrawerOnPhone()
  }

  /** Starts the "open from device" flow. Call it straight from a tap so iOS allows the picker. */
  openFromDevice(): void {
    if (Platform.canPickFiles) void this.d.documents.openWithPicker()
    else document.getElementById('kalyxis-import-files')?.click()
  }

  /**
   * Loads files picked from the device (Files app, iCloud Drive, drag and drop) and opens them in tabs.
   * Zip archives are extracted into a folder. A file whose name already exists asks to replace it, so
   * the round trip open, edit, save to Files, open again does not pile up copies.
   */
  async openFiles(files: File[]): Promise<void> {
    if (!files.length) return
    const { workspace, documents, dialogs } = this.d
    const dir = workspace.currentDir()
    const plain = files.filter((f) => !/\.zip$/i.test(f.name))
    const zips = files.filter((f) => /\.zip$/i.test(f.name))
    const toOpen: string[] = []
    const keepBoth: File[] = []

    for (const file of plain) {
      const path = joinPath(dir, file.name)
      if (!(await workspace.provider.exists(path))) {
        keepBoth.push(file)
        continue
      }
      const choice = await dialogs.choose({
        title: `"${file.name}" is already here`,
        message: 'Replace the copy in the workspace with the file you picked, or keep both?',
        options: [
          { id: 'replace', label: 'Replace', tone: 'danger' },
          { id: 'both', label: 'Keep both', tone: 'primary' },
          { id: 'skip', label: 'Skip this file' },
        ],
      })
      if (choice === 'both') keepBoth.push(file)
      else if (choice === 'replace') {
        const open = documents.all.find((s) => s.source.key === `${workspace.provider.id}:${path}`)
        if (open) await documents.close(open.id, { force: true })
        await workspace.provider.writeBytes(path, new Uint8Array(await file.arrayBuffer()))
        toOpen.push(path)
      }
    }

    if (keepBoth.length) toOpen.push(...(await workspace.importFiles(keepBoth, dir)))
    if (zips.length) await workspace.importFiles(zips, dir)
    await workspace.refresh()

    const editable = toOpen.filter((p) => !BINARY_EXTENSIONS.has(extname(p)))
    for (const path of editable.slice(0, 8)) await documents.openFile(path)
    if (editable.length > 8) this.d.toasts.show(`Opened 8 of ${editable.length} files. The rest are in the file list.`)
    if (editable.length) this.closeDrawerOnPhone()
  }

  async importFiles(files: File[]): Promise<void> {
    await this.openFiles(files)
  }

  async importFolder(files: File[]): Promise<void> {
    await this.d.workspace.importFolder(files)
  }

  async openFolder(): Promise<void> {
    if (await this.d.workspace.openDiskFolder()) this.closeDrawerOnPhone()
  }

  async closeTab(id: string): Promise<void> {
    await this.d.documents.close(id)
  }

  /* ---------------------------------- editing ---------------------------------- */

  async gotoLine(): Promise<void> {
    const total = this.d.editor.lineCount
    if (!total) return
    const value = await this.d.dialogs.prompt({
      title: 'Go to line',
      label: `Line number, 1 to ${total}. Add a column like 12:5 if you want.`,
      placeholder: '42',
      confirmLabel: 'Go',
      validate: (v) => (/^\s*\d+\s*(:\s*\d+\s*)?$/.test(v) ? null : 'Enter a line number such as 42 or 42:7.'),
    })
    if (value === null) return
    const [line, col] = value.split(':').map((n) => parseInt(n.trim(), 10))
    this.d.editor.gotoLine(line, Number.isFinite(col) ? col : 1)
  }

  async format(): Promise<void> {
    const { documents, formatter, toasts, editor, settings } = this.d
    const session = documents.active
    if (!session) return
    const id = session.languageId
    if (!formatter.canFormat(id)) {
      toasts.show(`Formatting is not available for ${getLanguageInfo(id).label}.`)
      return
    }
    try {
      const { tabSize, useTabs } = settings.get()
      const output = await formatter.format(session.getText(), id, { tabSize, useTabs })
      if (documents.active !== session) return
      editor.replaceDocument(output.replace(/\r\n/g, '\n'))
      toasts.success('Formatted')
    } catch (error) {
      const first = String((error as Error)?.message ?? error).split('\n')[0]
      toasts.error(`Could not format: ${first}`)
    }
  }

  toggleEol(): void {
    const session = this.d.documents.active
    if (!session) return
    this.d.documents.setEol(session.id, session.eol === 'LF' ? 'CRLF' : 'LF')
    this.d.toasts.show(`Line endings: ${session.eol}`)
  }

  zoom(delta: number): void {
    const next = clamp(this.d.settings.get().fontSize + delta, 11, 26)
    this.d.settings.update({ fontSize: next })
  }

  toggleTheme(): void {
    this.d.settings.update({ theme: this.d.settings.resolvedTheme() === 'dark' ? 'light' : 'dark' })
  }

  /* ------------------------------------ find ------------------------------------ */

  openFind(replace = false): void {
    if (!this.d.documents.active) return
    this.d.editor.openFind()
    useAppStore.getState().patchUi({ findOpen: true, findReplace: replace })
  }

  closeFind(): void {
    this.d.editor.closeFind()
    useAppStore.getState().patchUi({ findOpen: false })
  }

  /* ------------------------------------ run ------------------------------------ */

  async run(): Promise<void> {
    if (!this.d.documents.active) return
    this.d.editor.blur()
    await this.d.runs.run()
  }

  stop(): void {
    this.d.runs.stop()
  }

  /* ------------------------------------- ui ------------------------------------- */

  toggleSidebar(): void {
    useAppStore.getState().patchUi({ sidebarOpen: !this.ui.sidebarOpen })
  }

  togglePanel(): void {
    useAppStore.getState().patchUi({ panelOpen: !this.ui.panelOpen })
  }

  openPanel(tab: PanelTab): void {
    useAppStore.getState().patchUi({ panelOpen: true, panelTab: tab })
  }

  openPalette(mode: 'all' | 'files' = 'all'): void {
    this.d.editor.blur()
    useAppStore.getState().patchUi({ paletteOpen: true, paletteMode: mode })
  }
}
