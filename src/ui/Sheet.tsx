import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  hideHeader?: boolean
}

/** Bottom sheet on phones, centered dialog on wide screens. */
export function Sheet({ open, title, onClose, children, size = 'md', hideHeader }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Keep the latest onClose without re-running the focus effect on every parent render.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    const previous = document.activeElement as HTMLElement | null
    if (ref.current && !ref.current.contains(document.activeElement)) ref.current.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return (
    <div className="v-sheet-root">
      <div className="v-scrim v-scrim-sheet" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className={`v-sheet v-sheet-${size}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="v-sheet-grip" aria-hidden="true" />
        {hideHeader ? null : (
          <header className="v-sheet-head">
            <h2>{title}</h2>
            <button type="button" className="v-icon-btn" onClick={onClose} aria-label="Close">
              <X size={20} strokeWidth={1.4} />
            </button>
          </header>
        )}
        <div className="v-sheet-body">{children}</div>
      </div>
    </div>
  )
}
