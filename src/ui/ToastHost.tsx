import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { useEffect } from 'react'
import { app } from '../app/container'
import { useAppStore } from '../store/useAppStore'

export function ToastHost() {
  const toast = useAppStore((s) => s.toast)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => app.toasts.dismiss(toast.id), toast.action ? 6000 : toast.kind === 'error' ? 5000 : 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  if (!toast) return null
  const Icon = toast.kind === 'error' ? CircleAlert : toast.kind === 'success' ? CircleCheck : Info
  return (
    <div className="v-toast-wrap">
      <div className={`v-toast is-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} key={toast.id}>
        <Icon size={18} strokeWidth={1.5} aria-hidden />
        <span className="v-toast-msg">{toast.message}</span>
        {toast.action ? (
          <button type="button" className="v-toast-action" onClick={() => { toast.action?.run(); app.toasts.dismiss(toast.id) }}>
            {toast.action.label}
          </button>
        ) : null}
      </div>
    </div>
  )
}
