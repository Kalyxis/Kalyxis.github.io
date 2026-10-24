import { useAppStore } from '../../store/useAppStore'
import { isAbort } from '../fs/errors'
import { BINARY_EXTENSIONS } from '../languages/catalog'
import { extname } from '../util/paths'

export type ShareResult = 'shared' | 'cancelled' | 'failed'

/**
 * Gets files off the device.
 *
 * iOS Safari only lets a page open the share sheet (which holds "Save to Files") while it is
 * handling a tap, and that permission is lost after an await. So callers never share directly.
 * They stage the file with `stage`, the Save sheet opens, and its button calls `shareFile`
 * straight from the tap.
 */
export class ShareService {
  /** Prepares a file and opens the Save sheet. Works for any blob, including zips. */
  async saveBlob(blob: Blob, fileName: string, text: string | null = null): Promise<void> {
    const fallback = BINARY_EXTENSIONS.has(extname(fileName)) ? 'application/octet-stream' : 'text/plain'
    this.stage(new File([blob], fileName, { type: blob.type || fallback }), text)
  }

  saveText(fileName: string, text: string): void {
    this.stage(new File([text], fileName, { type: 'text/plain' }), text)
  }

  private stage(file: File, text: string | null): void {
    useAppStore.getState().patchUi({ exportJob: { file, name: file.name, size: file.size, text } })
  }

  canShare(file: File): boolean {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  }

  /** Must be called directly from a tap handler, with nothing awaited before it. */
  async shareFile(file: File): Promise<ShareResult> {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    } catch (error) {
      return isAbort(error) ? 'cancelled' : 'failed'
    }
  }

  download(file: Blob, fileName: string): void {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  async copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }
}
