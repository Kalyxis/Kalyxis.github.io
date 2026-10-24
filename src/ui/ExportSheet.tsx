import { Copy, Download, Share2 } from 'lucide-react'
import { app } from '../app/container'
import { formatBytes } from '../core/util/text'
import { Platform } from '../core/util/platform'
import { useAppStore } from '../store/useAppStore'
import { Sheet } from './Sheet'
import '../styles/export.css'

/**
 * Save to Files / share / download. The Share button calls the share sheet directly from the tap,
 * because iOS Safari refuses it once any await has happened.
 */
export function ExportSheet() {
  const job = useAppStore((s) => s.ui.exportJob)
  const close = () => useAppStore.getState().patchUi({ exportJob: null })
  const canShare = job ? app.share.canShare(job.file) : false
  const ios = Platform.isIOS

  const share = () => {
    if (!job) return
    void app.share.shareFile(job.file).then((result) => {
      if (result === 'shared') close()
      else if (result === 'failed') app.toasts.error('The share sheet is not available here. Use Download instead.')
    })
  }

  const download = () => {
    if (!job) return
    app.share.download(job.file, job.name)
    close()
  }

  const copy = () => {
    if (!job?.text) return
    void app.share.copyText(job.text).then((ok) => (ok ? app.toasts.success('Copied') : app.toasts.error('Could not copy.')))
  }

  return (
    <Sheet open={!!job} title={ios ? 'Save to Files' : 'Save a copy'} onClose={close} size="sm">
      {job ? (
        <div className="v-export">
          <div className="v-export-file">
            <strong>{job.name}</strong>
            <span>{formatBytes(job.size)}</span>
          </div>
          <p className="v-export-hint">
            {canShare
              ? ios
                ? 'Tap Save to Files in the sheet that opens to keep it in iCloud Drive or On My iPhone. Choosing the same name again replaces the old copy.'
                : 'Send it to another app or save it to your device.'
              : 'Downloads the file to your device.'}
          </p>
          <div className="v-export-actions">
            {canShare ? (
              <button type="button" className="v-btn v-btn-primary" onClick={share}>
                <Share2 size={17} strokeWidth={1.4} /> {ios ? 'Save to Files or share' : 'Share'}
              </button>
            ) : null}
            <button type="button" className={`v-btn ${canShare ? '' : 'v-btn-primary'}`} onClick={download}>
              <Download size={17} strokeWidth={1.4} /> Download
            </button>
            {job.text !== null ? (
              <button type="button" className="v-btn" onClick={copy}>
                <Copy size={17} strokeWidth={1.4} /> Copy contents
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}
