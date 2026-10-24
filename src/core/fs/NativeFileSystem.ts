import { basename, dirname, normalizePath, ROOT, segments } from '../util/paths'
import { FsError } from './errors'
import { FileSystemProvider, type FsEntry } from './FileSystemProvider'
import { metaGet, metaSet } from './idb'

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.DS_Store'])
const LAST_FOLDER_KEY = 'lastFolder'

/** A real folder on the user's disk, through the File System Access API (desktop Chromium). */
export class NativeFileSystem extends FileSystemProvider {
  readonly id = 'disk'
  readonly label: string
  readonly rootName: string
  private readonly root: FileSystemDirectoryHandle

  constructor(root: FileSystemDirectoryHandle) {
    super()
    this.root = root
    this.rootName = root.name
    this.label = root.name
  }

  /** Shows the folder picker and remembers the choice for the next visit. */
  static async pick(): Promise<NativeFileSystem> {
    if (!window.showDirectoryPicker) throw new FsError('EPERM', 'This browser cannot open folders')
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    await metaSet(LAST_FOLDER_KEY, handle).catch(() => undefined)
    return new NativeFileSystem(handle)
  }

  /** The folder opened last time, if the browser let us keep the handle. */
  static async lastFolder(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const handle = await metaGet<FileSystemDirectoryHandle>(LAST_FOLDER_KEY)
      return handle && handle.kind === 'directory' ? handle : null
    } catch {
      return null
    }
  }

  /** Must run inside a user gesture. Resolves to a provider when read and write access is granted. */
  static async reopen(handle: FileSystemDirectoryHandle): Promise<NativeFileSystem | null> {
    const options = { mode: 'readwrite' as const }
    let permission: PermissionState = 'prompt'
    if (handle.queryPermission) permission = await handle.queryPermission(options)
    if (permission !== 'granted' && handle.requestPermission) permission = await handle.requestPermission(options)
    if (permission !== 'granted') return null
    return new NativeFileSystem(handle)
  }

  static fromHandle(handle: FileSystemDirectoryHandle): NativeFileSystem {
    return new NativeFileSystem(handle)
  }

  override isIgnored(name: string): boolean {
    return IGNORED.has(name)
  }

  private async directory(path: string): Promise<FileSystemDirectoryHandle> {
    let current = this.root
    for (const part of segments(path)) {
      try {
        current = await current.getDirectoryHandle(part)
      } catch (error) {
        throw this.translate(error, part)
      }
    }
    return current
  }

  private translate(error: unknown, name: string): Error {
    if (error instanceof DOMException) {
      if (error.name === 'NotFoundError') return new FsError('ENOENT', `"${name}" no longer exists`)
      if (error.name === 'TypeMismatchError') return new FsError('ENOTDIR', `"${name}" is not the expected kind of item`)
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return new FsError('EPERM', 'Permission to use this folder was denied')
    }
    return error instanceof Error ? error : new Error(String(error))
  }

  async list(dir: string): Promise<FsEntry[]> {
    const handle = await this.directory(dir)
    const base = normalizePath(dir)
    const entries: FsEntry[] = []
    for await (const child of handle.values()) {
      if (this.isIgnored(child.name)) continue
      entries.push({ name: child.name, path: base === ROOT ? `/${child.name}` : `${base}/${child.name}`, kind: child.kind })
    }
    return this.sort(entries)
  }

  async stat(path: string): Promise<FsEntry | null> {
    const p = normalizePath(path)
    if (p === ROOT) return { name: this.rootName, path: ROOT, kind: 'directory' }
    const parent = await this.directory(dirname(p)).catch(() => null)
    if (!parent) return null
    const name = basename(p)
    try {
      const file = await (await parent.getFileHandle(name)).getFile()
      return { name, path: p, kind: 'file', size: file.size, modified: file.lastModified }
    } catch {
      // not a file, try a directory
    }
    try {
      await parent.getDirectoryHandle(name)
      return { name, path: p, kind: 'directory' }
    } catch {
      return null
    }
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const p = normalizePath(path)
    const parent = await this.directory(dirname(p))
    try {
      const file = await (await parent.getFileHandle(basename(p))).getFile()
      return new Uint8Array(await file.arrayBuffer())
    } catch (error) {
      throw this.translate(error, basename(p))
    }
  }

  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    const p = normalizePath(path)
    const parent = await this.directory(dirname(p))
    try {
      const handle = await parent.getFileHandle(basename(p), { create: true })
      const writable = await handle.createWritable()
      await writable.write(data as Uint8Array<ArrayBuffer>)
      await writable.close()
    } catch (error) {
      throw this.translate(error, basename(p))
    }
  }

  async createDirectory(path: string): Promise<void> {
    const p = normalizePath(path)
    const parent = await this.directory(dirname(p))
    if (await this.stat(p)) throw new FsError('EEXIST', `"${basename(p)}" already exists`)
    try {
      await parent.getDirectoryHandle(basename(p), { create: true })
    } catch (error) {
      throw this.translate(error, basename(p))
    }
  }

  async remove(path: string): Promise<void> {
    const p = normalizePath(path)
    if (p === ROOT) throw new FsError('EINVAL', 'The opened folder cannot be removed')
    const parent = await this.directory(dirname(p))
    try {
      await parent.removeEntry(basename(p), { recursive: true })
    } catch (error) {
      throw this.translate(error, basename(p))
    }
  }

  /** Handle of a file, used by tabs that want to write back through the same handle. */
  async fileHandle(path: string): Promise<FileSystemFileHandle> {
    const p = normalizePath(path)
    const parent = await this.directory(dirname(p))
    try {
      return await parent.getFileHandle(basename(p))
    } catch (error) {
      throw this.translate(error, basename(p))
    }
  }
}
