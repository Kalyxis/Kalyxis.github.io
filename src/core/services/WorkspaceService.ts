import { errorMessage, isAbort } from '../fs/errors'
import type { FileSystemProvider, FsEntry } from '../fs/FileSystemProvider'
import { LocalFileSystem } from '../fs/LocalFileSystem'
import { NativeFileSystem } from '../fs/NativeFileSystem'
import { detectLanguage } from '../languages/catalog'
import { STARTER_HTML, STARTER_JS, STARTER_PY, WELCOME_MD } from '../templates/examples'
import { Emitter } from '../util/Emitter'
import { basename, dirname, isInside, joinPath, normalizePath, rebase, ROOT, segments, uniqueName, validateName } from '../util/paths'
import { Platform } from '../util/platform'
import { useAppStore } from '../../store/useAppStore'
import type { ArchiveService } from './ArchiveService'
import type { DialogService } from './DialogService'
import type { ShareService } from './ShareService'
import type { ToastService } from './ToastService'

export type PathChange = { type: 'rename'; from: string; to: string; providerId: string } | { type: 'remove'; path: string; providerId: string }

const SEEDED_KEY = 'kalyxis.seeded.v1'
const IMPORT_LIMIT = 4000
const SKIP_FOLDERS = new Set(['node_modules', '.git', '.DS_Store'])

interface Deps {
  dialogs: DialogService
  toasts: ToastService
  archive: ArchiveService
  share: ShareService
}

/** Owns the active file system provider and everything the explorer can do to it. */
export class WorkspaceService {
  readonly local = new LocalFileSystem()
  readonly pathChanged = new Emitter<PathChange>()
  private active: FileSystemProvider = this.local
  private lastHandle: FileSystemDirectoryHandle | null = null
  private readonly deps: Deps

  constructor(deps: Deps) {
    this.deps = deps
  }

  get provider(): FileSystemProvider {
    return this.active
  }

  async init(): Promise<void> {
    try {
      if (!localStorage.getItem(SEEDED_KEY) && (await this.local.isEmpty())) await this.seed()
      localStorage.setItem(SEEDED_KEY, '1')
    } catch (error) {
      this.deps.toasts.error(`Local storage is not available: ${errorMessage(error, 'unknown error')}`)
    }
    await this.activate(this.local)
    this.lastHandle = await NativeFileSystem.lastFolder()
    useAppStore.setState({ lastFolderName: this.lastHandle?.name ?? null })
  }

  private async seed(): Promise<void> {
    await this.local.writeText('/welcome.md', WELCOME_MD)
    await this.local.writeText('/main.py', STARTER_PY)
    await this.local.writeText('/main.js', STARTER_JS)
    await this.local.writeText('/index.html', STARTER_HTML)
  }

  /** Switches the explorer to a provider and loads its root. */
  private async activate(provider: FileSystemProvider): Promise<void> {
    this.active = provider
    useAppStore.setState({
      workspace: { kind: provider.id === 'disk' ? 'disk' : 'local', label: provider.label, rootName: provider.rootName },
      tree: {},
      expanded: {},
      selectedPath: null,
    })
    await this.loadDir(ROOT)
  }

  /* --------------------------------- tree state --------------------------------- */

  async loadDir(path: string): Promise<void> {
    const provider = this.active
    const key = normalizePath(path)
    useAppStore.setState((s) => ({ loadingDirs: { ...s.loadingDirs, [key]: true } }))
    try {
      const entries = await provider.list(key)
      if (provider !== this.active) return
      useAppStore.setState((s) => ({ tree: { ...s.tree, [key]: entries.filter((e) => !provider.isIgnored(e.name)) } }))
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, 'Could not read this folder.'))
    } finally {
      useAppStore.setState((s) => {
        const { [key]: _done, ...rest } = s.loadingDirs
        void _done
        return { loadingDirs: rest }
      })
    }
  }

  async toggle(path: string): Promise<void> {
    const state = useAppStore.getState()
    const open = !state.expanded[path]
    useAppStore.setState({ expanded: { ...state.expanded, [path]: open }, selectedPath: path })
    if (open) await this.loadDir(path)
  }

  select(path: string | null): void {
    useAppStore.setState({ selectedPath: path })
  }

  /** The folder new items should be created in. */
  currentDir(): string {
    const { selectedPath, tree } = useAppStore.getState()
    if (!selectedPath) return ROOT
    const parent = dirname(selectedPath)
    const isDir = Object.values(tree).some((list) => list.some((e) => e.path === selectedPath && e.kind === 'directory'))
    return isDir ? selectedPath : parent
  }

  async refresh(): Promise<void> {
    const dirs = [ROOT, ...Object.entries(useAppStore.getState().expanded).filter(([, open]) => open).map(([p]) => p)]
    await Promise.all(dirs.map((d) => this.loadDir(d)))
  }

  private async refreshDir(path: string): Promise<void> {
    await this.loadDir(path)
  }

  private async expandTo(path: string): Promise<void> {
    const state = useAppStore.getState()
    const expanded = { ...state.expanded }
    let current = ROOT
    for (const part of segments(dirname(path))) {
      current = joinPath(current, part)
      expanded[current] = true
    }
    useAppStore.setState({ expanded, selectedPath: path })
    for (const dir of Object.keys(expanded)) if (expanded[dir] && !useAppStore.getState().tree[dir]) await this.loadDir(dir)
  }

  /* --------------------------------- operations --------------------------------- */

  /** Asks for a name and creates a file. Resolves to the new path, or null when cancelled. */
  async promptNewFile(dir = this.currentDir(), initialName = ''): Promise<string | null> {
    const name = await this.deps.dialogs.prompt({
      title: 'New file',
      label: `In ${dir === ROOT ? this.active.rootName : dir}`,
      placeholder: 'main.py',
      initial: initialName,
      confirmLabel: 'Create',
      selectStem: true,
      validate: validateName,
    })
    if (name === null) return null
    return this.createFile(dir, name.trim())
  }

  async createFile(dir: string, name: string, content = ''): Promise<string | null> {
    try {
      const path = await this.active.createFile(dir, name, content)
      await this.expandTo(path)
      await this.refreshDir(dir)
      return path
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, 'Could not create the file.'))
      return null
    }
  }

  async promptNewFolder(dir = this.currentDir()): Promise<string | null> {
    const name = await this.deps.dialogs.prompt({
      title: 'New folder',
      label: `In ${dir === ROOT ? this.active.rootName : dir}`,
      placeholder: 'src',
      confirmLabel: 'Create',
      validate: validateName,
    })
    if (name === null) return null
    try {
      const path = await this.active.createFolder(dir, name.trim())
      await this.expandTo(path)
      await this.refreshDir(dir)
      return path
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, 'Could not create the folder.'))
      return null
    }
  }

  async promptRename(entry: FsEntry): Promise<void> {
    const name = await this.deps.dialogs.prompt({
      title: entry.kind === 'directory' ? 'Rename folder' : 'Rename file',
      initial: entry.name,
      confirmLabel: 'Rename',
      selectStem: entry.kind === 'file',
      validate: validateName,
    })
    if (name === null || name.trim() === entry.name) return
    try {
      const to = await this.active.rename(entry.path, name.trim())
      this.pathChanged.emit({ type: 'rename', from: entry.path, to, providerId: this.active.id })
      useAppStore.setState((s) => {
        const expanded: Record<string, boolean> = {}
        for (const [p, open] of Object.entries(s.expanded)) expanded[isInside(p, entry.path) ? rebase(p, entry.path, to) : p] = open
        return { expanded, selectedPath: to }
      })
      await this.refresh()
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, 'Could not rename.'))
    }
  }

  async promptRemove(entry: FsEntry): Promise<void> {
    const ok = await this.deps.dialogs.confirm({
      title: entry.kind === 'directory' ? 'Delete folder?' : 'Delete file?',
      message: entry.kind === 'directory' ? `"${entry.name}" and everything inside it will be deleted.` : `"${entry.name}" will be deleted.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await this.active.remove(entry.path)
      this.pathChanged.emit({ type: 'remove', path: entry.path, providerId: this.active.id })
      useAppStore.setState((s) => {
        const expanded = Object.fromEntries(Object.entries(s.expanded).filter(([p]) => !isInside(p, entry.path)))
        return { expanded, selectedPath: s.selectedPath && isInside(s.selectedPath, entry.path) ? null : s.selectedPath }
      })
      await this.refresh()
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, 'Could not delete.'))
    }
  }

  async duplicate(entry: FsEntry): Promise<void> {
    try {
      const siblings = await this.active.list(dirname(entry.path))
      const name = uniqueName(entry.name, new Set(siblings.map((e) => e.name)))
      await this.active.copy(entry.path, joinPath(dirname(entry.path), name))
      await this.refreshDir(dirname(entry.path))
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, 'Could not duplicate.'))
    }
  }

  async downloadFile(entry: FsEntry): Promise<void> {
    try {
      const bytes = await this.active.readBytes(entry.path)
      await this.deps.share.saveBlob(new Blob([bytes as Uint8Array<ArrayBuffer>]), entry.name)
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, 'Could not export the file.'))
    }
  }

  async exportWorkspace(): Promise<void> {
    try {
      const blob = await this.deps.archive.zipWorkspace(this.active)
      await this.deps.share.saveBlob(blob, `${this.active.rootName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || 'workspace'}.zip`)
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, 'Could not create the zip file.'))
    }
  }

  /** Copies picked files into a folder. Zip files are extracted into a folder named after them. */
  async importFiles(files: File[], dir = this.currentDir()): Promise<string[]> {
    const imported: string[] = []
    try {
      const taken = new Set((await this.active.list(dir)).map((e) => e.name))
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (/\.zip$/i.test(file.name)) {
          const items = this.deps.archive
            .extract(bytes)
            .filter((item) => !segments(item.path).some((s) => SKIP_FOLDERS.has(s)))
          // A zip that already wraps everything in one folder is extracted as that folder.
          const tops = new Set(items.map((item) => segments(item.path)[0]))
          const wrapped = tops.size === 1 && items.every((item) => segments(item.path).length > 1)
          const folder = uniqueName(wrapped ? [...tops][0] : file.name.replace(/\.zip$/i, ''), taken)
          taken.add(folder)
          const base = joinPath(dir, folder)
          await this.active.mkdirp(base)
          for (const item of items) {
            const relative = wrapped ? segments(item.path).slice(1).join('/') : item.path
            const target = joinPath(base, relative)
            await this.active.mkdirp(dirname(target))
            await this.active.writeBytes(target, item.data)
            imported.push(target)
          }
          continue
        }
        const name = uniqueName(file.name, taken)
        taken.add(name)
        const target = joinPath(dir, name)
        await this.active.writeBytes(target, bytes)
        imported.push(target)
      }
      await this.refresh()
      if (imported.length) this.deps.toasts.success(`Imported ${imported.length} ${imported.length === 1 ? 'file' : 'files'}`)
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, 'Import failed.'))
    }
    return imported
  }

  /** Imports a folder chosen through an <input webkitdirectory> element. */
  async importFolder(files: File[], dir = this.currentDir()): Promise<void> {
    const usable = files.filter((f) => f.webkitRelativePath && !segments(f.webkitRelativePath).some((s) => SKIP_FOLDERS.has(s)))
    if (!usable.length) return
    if (usable.length > IMPORT_LIMIT) {
      this.deps.toasts.error(`That folder has ${usable.length} files. Import up to ${IMPORT_LIMIT} at a time.`)
      return
    }
    try {
      const rootName = segments(usable[0].webkitRelativePath)[0] ?? 'folder'
      const taken = new Set((await this.active.list(dir)).map((e) => e.name))
      const folder = uniqueName(rootName, taken)
      const base = joinPath(dir, folder)
      await this.active.mkdirp(base)
      for (const file of usable) {
        const rest = segments(file.webkitRelativePath).slice(1).join('/')
        const target = joinPath(base, rest)
        await this.active.mkdirp(dirname(target))
        await this.active.writeBytes(target, new Uint8Array(await file.arrayBuffer()))
      }
      await this.refresh()
      this.deps.toasts.success(`Imported ${usable.length} files into ${folder}`)
    } catch (error) {
      this.deps.toasts.error(errorMessage(error, 'Import failed.'))
    }
  }

  /* ------------------------------- disk folders ------------------------------- */

  async openDiskFolder(): Promise<boolean> {
    if (!Platform.canPickDirectory) return false
    try {
      const provider = await NativeFileSystem.pick()
      await this.activate(provider)
      this.lastHandle = null
      useAppStore.setState({ lastFolderName: provider.rootName })
      return true
    } catch (error) {
      if (!isAbort(error)) this.deps.toasts.error(errorMessage(error, 'Could not open the folder.'))
      return false
    }
  }

  /** Reopens the last disk folder. Needs a tap, because browsers ask for permission again. */
  async reopenLastFolder(): Promise<boolean> {
    const handle = this.lastHandle ?? (await NativeFileSystem.lastFolder())
    if (!handle) return false
    try {
      const provider = await NativeFileSystem.reopen(handle)
      if (!provider) {
        this.deps.toasts.error('Permission to open that folder was not granted.')
        return false
      }
      await this.activate(provider)
      return true
    } catch (error) {
      if (!isAbort(error)) this.deps.toasts.error(errorMessage(error, 'Could not reopen the folder.'))
      return false
    }
  }

  async useLocal(): Promise<void> {
    if (this.active === this.local) return
    await this.activate(this.local)
  }

  /** Handles files or a folder dropped on the explorer (desktop). */
  async handleDrop(transfer: DataTransfer): Promise<string[]> {
    const items = Array.from(transfer.items)
    if (Platform.canPickDirectory && items.length === 1 && items[0].getAsFileSystemHandle) {
      const handle = await items[0].getAsFileSystemHandle()
      if (handle?.kind === 'directory') {
        await this.activate(NativeFileSystem.fromHandle(handle as FileSystemDirectoryHandle))
        return []
      }
    }
    const files = Array.from(transfer.files)
    if (!files.length) return []
    return this.importFiles(files)
  }

  languageOf(path: string) {
    return detectLanguage(basename(path))
  }
}
