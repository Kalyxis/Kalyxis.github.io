import { unzipSync, zipSync } from 'fflate'
import type { FileSystemProvider } from '../fs/FileSystemProvider'
import { normalizePath } from '../util/paths'

const MAX_UNZIPPED_BYTES = 150 * 1024 * 1024

export interface ExtractedFile {
  path: string
  data: Uint8Array
}

/** Zip import and export, shared by the explorer and the share sheet. */
export class ArchiveService {
  async zipWorkspace(provider: FileSystemProvider): Promise<Blob> {
    const files: Record<string, Uint8Array> = {}
    await provider.walkFiles('/', async (entry) => {
      files[entry.path.slice(1)] = await provider.readBytes(entry.path)
    })
    return new Blob([zipSync(files, { level: 6 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
  }

  extract(bytes: Uint8Array): ExtractedFile[] {
    const out: ExtractedFile[] = []
    let total = 0
    const entries = unzipSync(bytes, {
      filter: (file) => {
        total += file.originalSize
        if (total > MAX_UNZIPPED_BYTES) throw new Error('This archive is too large to extract here.')
        return !file.name.endsWith('/') && !file.name.startsWith('__MACOSX/')
      },
    })
    for (const [name, data] of Object.entries(entries)) out.push({ path: normalizePath(name), data })
    return out
  }
}
