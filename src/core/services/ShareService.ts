import { isAbort } from '../fs/errors'

/** Hands a file to the user: the share sheet on phones, a normal download elsewhere. */
export class ShareService {
  async saveBlob(blob: Blob, fileName: string): Promise<void> {
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' })
    if (typeof navigator.canShare === 'function' && typeof navigator.share === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName })
        return
      } catch (error) {
        if (isAbort(error)) return
        // Safari rejects shares that are not tied to a tap, so fall through to a download.
      }
    }
    this.download(blob, fileName)
  }

  download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob)
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
