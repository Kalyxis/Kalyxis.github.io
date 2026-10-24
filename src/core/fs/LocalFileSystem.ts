import { basename, dirname, joinPath, normalizePath, ROOT, segments } from '../util/paths'
import { FsError } from './errors'
import { FileSystemProvider, type FsEntry } from './FileSystemProvider'
import { NODES, openDb, request, transactionDone } from './idb'

interface NodeRecord {
  path: string
  parent: string
  name: string
  kind: 'file' | 'directory'
  data?: Uint8Array
  size: number
  modified: number
}

const toEntry = (r: NodeRecord): FsEntry => ({ name: r.name, path: r.path, kind: r.kind, size: r.size, modified: r.modified })

/** Workspace stored in the browser (IndexedDB). It works on every phone, offline, with no permissions. */
export class LocalFileSystem extends FileSystemProvider {
  readonly id = 'local'
  readonly label = 'On this device'
  readonly rootName = 'Kalyxis'

  async list(dir: string): Promise<FsEntry[]> {
    const db = await openDb()
    const records = await request(
      db.transaction(NODES, 'readonly').objectStore(NODES).index('parent').getAll(normalizePath(dir)),
    )
    return this.sort((records as NodeRecord[]).filter((r) => r.path !== ROOT).map(toEntry))
  }

  async stat(path: string): Promise<FsEntry | null> {
    const p = normalizePath(path)
    if (p === ROOT) return { name: '', path: ROOT, kind: 'directory' }
    const db = await openDb()
    const record = (await request(db.transaction(NODES, 'readonly').objectStore(NODES).get(p))) as NodeRecord | undefined
    return record ? toEntry(record) : null
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const p = normalizePath(path)
    const db = await openDb()
    const record = (await request(db.transaction(NODES, 'readonly').objectStore(NODES).get(p))) as NodeRecord | undefined
    if (!record) throw new FsError('ENOENT', `"${basename(p)}" no longer exists`)
    if (record.kind === 'directory') throw new FsError('EISDIR', `"${basename(p)}" is a folder`)
    return record.data ?? new Uint8Array(0)
  }

  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    const p = normalizePath(path)
    if (p === ROOT) throw new FsError('EINVAL', 'Cannot write to the root folder')
    const parent = dirname(p)
    const parentInfo = await this.stat(parent)
    if (!parentInfo) await this.mkdirp(parent)
    else if (parentInfo.kind !== 'directory') throw new FsError('ENOTDIR', `"${basename(parent)}" is a file`)
    const existing = await this.stat(p)
    if (existing?.kind === 'directory') throw new FsError('EISDIR', `"${basename(p)}" is a folder`)
    const record: NodeRecord = { path: p, parent, name: basename(p), kind: 'file', data, size: data.byteLength, modified: Date.now() }
    const db = await openDb()
    const tx = db.transaction(NODES, 'readwrite')
    tx.objectStore(NODES).put(record)
    await transactionDone(tx)
  }

  async createDirectory(path: string): Promise<void> {
    const p = normalizePath(path)
    if (p === ROOT) throw new FsError('EINVAL', 'The root folder already exists')
    const parent = dirname(p)
    const parentInfo = await this.stat(parent)
    if (!parentInfo) throw new FsError('ENOENT', `"${basename(parent)}" does not exist`)
    if (parentInfo.kind !== 'directory') throw new FsError('ENOTDIR', `"${basename(parent)}" is a file`)
    if (await this.stat(p)) throw new FsError('EEXIST', `"${basename(p)}" already exists`)
    const record: NodeRecord = { path: p, parent, name: basename(p), kind: 'directory', size: 0, modified: Date.now() }
    const db = await openDb()
    const tx = db.transaction(NODES, 'readwrite')
    tx.objectStore(NODES).put(record)
    await transactionDone(tx)
  }

  async remove(path: string): Promise<void> {
    const p = normalizePath(path)
    if (p === ROOT) throw new FsError('EINVAL', 'The root folder cannot be removed')
    const db = await openDb()
    const tx = db.transaction(NODES, 'readwrite')
    const store = tx.objectStore(NODES)
    store.delete(p)
    store.delete(IDBKeyRange.bound(`${p}/`, `${p}/\uffff`))
    await transactionDone(tx)
  }

  /** Renames a file or folder in one transaction, rewriting the paths of everything inside. */
  override async rename(path: string, newName: string): Promise<string> {
    const from = normalizePath(path)
    const to = joinPath(dirname(from), newName)
    if (to === from) return from
    if (await this.stat(to)) throw new FsError('EEXIST', `"${newName}" already exists`)
    const db = await openDb()
    const tx = db.transaction(NODES, 'readwrite')
    const store = tx.objectStore(NODES)
    const done = transactionDone(tx)
    const self = (await request(store.get(from))) as NodeRecord | undefined
    if (!self) {
      tx.abort()
      await done.catch(() => undefined)
      throw new FsError('ENOENT', `"${basename(from)}" no longer exists`)
    }
    const descendants = (await request(store.getAll(IDBKeyRange.bound(`${from}/`, `${from}/\uffff`)))) as NodeRecord[]
    store.delete(from)
    for (const d of descendants) store.delete(d.path)
    store.put({ ...self, path: to, name: basename(to), modified: Date.now() })
    for (const d of descendants) {
      const next = to + d.path.slice(from.length)
      store.put({ ...d, path: next, parent: dirname(next) })
    }
    await done
    return to
  }

  async isEmpty(): Promise<boolean> {
    const db = await openDb()
    return (await request(db.transaction(NODES, 'readonly').objectStore(NODES).count())) === 0
  }

  /** Exposed for the importer: creates parents for every segment of a relative path. */
  async ensureParent(path: string): Promise<void> {
    const parts = segments(path)
    parts.pop()
    if (parts.length) await this.mkdirp(`/${parts.join('/')}`)
  }
}
