import { BINARY_EXTENSIONS } from '../languages/catalog'
import { FsError } from '../fs/errors'
import type { FileSystemProvider } from '../fs/FileSystemProvider'
import { basename, extname } from '../util/paths'
import { uid } from '../util/id'
import { decodeText, encodeText, formatBytes, looksBinary } from '../util/text'

export type SourceKind = 'workspace' | 'handle' | 'memory'

export const MAX_EDITABLE_BYTES = 5 * 1024 * 1024

/** Turns raw bytes into editable text, or explains why the file cannot be edited. */
export function readEditable(bytes: Uint8Array, name: string): string {
  if (bytes.byteLength > MAX_EDITABLE_BYTES) {
    throw new FsError('ETOOBIG', `"${name}" is ${formatBytes(bytes.byteLength)}, which is too large to edit here.`)
  }
  if (BINARY_EXTENSIONS.has(extname(name)) || looksBinary(bytes)) {
    throw new FsError('EINVAL', `"${name}" is a binary file and cannot be edited as text.`)
  }
  return decodeText(bytes)
}

/** Where the text of an open document comes from and where saving writes it back. */
export abstract class DocumentSource {
  abstract readonly kind: SourceKind
  /** Unique identity, used to avoid opening the same file twice. */
  abstract readonly key: string
  abstract readonly name: string
  /** Human readable location shown in the UI. */
  abstract readonly path: string
  abstract readonly writable: boolean
  abstract read(): Promise<string>
  abstract write(text: string): Promise<void>
}

/** A file inside the active workspace (on device storage or an opened disk folder). */
export class WorkspaceSource extends DocumentSource {
  readonly kind = 'workspace' as const
  readonly writable = true
  readonly provider: FileSystemProvider
  private filePath: string

  constructor(provider: FileSystemProvider, filePath: string) {
    super()
    this.provider = provider
    this.filePath = filePath
  }

  get key(): string {
    return `${this.provider.id}:${this.filePath}`
  }

  get name(): string {
    return basename(this.filePath)
  }

  get path(): string {
    return this.filePath
  }

  relocate(path: string): void {
    this.filePath = path
  }

  async read(): Promise<string> {
    return readEditable(await this.provider.readBytes(this.filePath), this.name)
  }

  async write(text: string): Promise<void> {
    await this.provider.writeText(this.filePath, text)
  }
}

/** A single file picked from disk with the File System Access API. Saves go straight back to it. */
export class HandleSource extends DocumentSource {
  readonly kind = 'handle' as const
  readonly writable = true
  readonly key: string
  private readonly handle: FileSystemFileHandle

  constructor(handle: FileSystemFileHandle) {
    super()
    this.handle = handle
    this.key = uid('handle')
  }

  get name(): string {
    return this.handle.name
  }

  get path(): string {
    return this.handle.name
  }

  async read(): Promise<string> {
    const file = await this.handle.getFile()
    return readEditable(new Uint8Array(await file.arrayBuffer()), this.name)
  }

  async write(text: string): Promise<void> {
    const writable = await this.handle.createWritable()
    await writable.write(encodeText(text))
    await writable.close()
  }
}

/** A scratch buffer that has never been saved anywhere. */
export class MemorySource extends DocumentSource {
  readonly kind = 'memory' as const
  readonly writable = false
  readonly key = uid('memory')
  readonly name: string
  private readonly initial: string

  constructor(name: string, initial = '') {
    super()
    this.name = name
    this.initial = initial
  }

  get path(): string {
    return 'Unsaved'
  }

  async read(): Promise<string> {
    return this.initial
  }

  async write(): Promise<void> {
    throw new FsError('EPERM', 'Choose where to save this file first.')
  }
}
