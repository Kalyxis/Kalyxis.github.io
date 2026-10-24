import { Download, Share, SquarePlus, X } from 'lucide-react'
import { app } from '../app/container'
import { useAppStore } from '../store/useAppStore'
import { Logo } from './Logo'

export function InstallBanner() {
  const hint = useAppStore((s) => s.installHint)
  if (!hint) return null
  return (
    <aside className="v-install" role="region" aria-label="Install Kalyxis">
      <Logo size={30} />
      <div className="v-install-text">
        <strong>Install Kalyxis</strong>
        {hint === 'ios' ? (
          <span>
            Tap <Share size={14} strokeWidth={1.5} aria-label="Share" /> then <SquarePlus size={14} strokeWidth={1.5} aria-hidden /> Add to Home Screen for a full screen editor that works offline.
          </span>
        ) : (
          <span>Add it to your home screen for a full screen editor that works offline.</span>
        )}
      </div>
      {hint === 'prompt' ? (
        <button type="button" className="v-btn v-btn-sm v-btn-primary" onClick={() => void app.install.install()}>
          <Download size={15} strokeWidth={1.5} /> Install
        </button>
      ) : null}
      <button type="button" className="v-icon-btn" aria-label="Dismiss" onClick={() => app.install.dismiss()}>
        <X size={18} strokeWidth={1.4} />
      </button>
    </aside>
  )
}
