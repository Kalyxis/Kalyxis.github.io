import { decodeText, encodeText } from '../util/text'
import { basename, dirname, joinPath, ROOT, segments } from '../util/paths'
import { FsError } from './errors'

export type EntryKind = 'file' | 'directory'

export interface FsEntry {
  name: string
  path: string
  kind: EntryKind
  size?: number
  modified?: number
}

/**
 * Abstract storage backend for a workspace. Concrete providers implement a handful of
 * primitives, and everything else (text helpers, copy, rename, walk) is built on top here.
 */
export abstract class FileSystemProvider {
  abstract readonly id: string
  abstract readonly label: string
  abstract readonly rootName: string

  abstract list(dir: string): Promise<FsEntry[]>
  abstract stat(path: string): Promise<FsEntry | null>
  abstract readBytes(path: string): Promise<Uint8Array>
  /** Creates or replaces a file. The parent directory must already exist. */
  abstract writeBytes(path: string, data: Uint8Array): Promise<void>
  /** Creates one directory. Fails with EEXIST when the path is taken. */
  abstract createDirectory(path: string): Promise<void>
  /** Removes a file or a directory with everything inside it. */
  abstract remove(path: string): Promise<void>

  /** Names that are hidden from the explorer. */
  isIgnored(_name: string): boolean {
    return false
  }

  async exists(path: string): Promise<boolean> {
    return (await this.stat(path)) !== null
  }

  async readText(path: string): Promise<string> {
    return decodeText(await this.readBytes(path))
  }

  async writeText(path: string, text: string): Promise<void> {
    await this.writeBytes(path, encodeText(text))
  }

  /** Creates every missing directory on the way to `path`. */
  async mkdirp(path: string): Promise<void> {
    let current = ROOT
    for (const part of segments(path)) {
      current = joinPath(current, part)
      const info = await this.stat(current)
      if (!info) await this.createDirectory(current)
      else if (info.kind !== 'directory') throw new FsError('ENOTDIR', `"${basename(current)}" is a file`)
    }
  }

  async createFile(dir: string, name: string, content = ''): Promise<string> {
    const path = joinPath(dir, name)
    if (await this.exists(path)) throw new FsError('EEXIST', `"${name}" already exists`)
    await this.writeText(path, content)
    return path
  }

  async createFolder(dir: string, name: string): Promise<string> {
    const path = joinPath(dir, name)
    if (await this.exists(path)) throw new FsError('EEXIST', `"${name}" already exists`)
    await this.createDirectory(path)
    return path
  }

  /** Copies a file or a whole directory tree. */
  async copy(from: string, to: string): Promise<void> {
    const info = await this.stat(from)
    if (!info) throw new FsError('ENOENT', `"${basename(from)}" no longer exists`)
    if (info.kind === 'file') {
      await this.writeBytes(to, await this.readBytes(from))
      return
    }
    await this.createDirectory(to)
    for (const child of await this.list(from)) await this.copy(child.path, joinPath(to, child.name))
  }

  /** Renames inside the same folder. Providers with a cheaper native rename override this. */
  async rename(path: string, newName: string): Promise<string> {
    const target = joinPath(dirname(path), newName)
    if (target === path) return path
    if (await this.exists(target)) throw new FsError('EEXIST', `"${newName}" already exists`)
    await this.copy(path, target)
    await this.remove(path)
    return target
  }

  /** Visits every file below `dir`, depth first. */
  async walkFiles(dir: string, visit: (entry: FsEntry) => void | Promise<void>): Promise<void> {
    for (const entry of await this.list(dir)) {
      if (entry.kind === 'directory') await this.walkFiles(entry.path, visit)
      else await visit(entry)
    }
  }

  protected sort(entries: FsEntry[]): FsEntry[] {
    return entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })
  }
}
