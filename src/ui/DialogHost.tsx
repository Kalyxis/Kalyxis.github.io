import { useEffect, useRef, useState } from 'react'
import { useAppStore, type DialogState } from '../store/useAppStore'
import { Sheet } from './Sheet'

type Prompt = Extract<DialogState, { kind: 'prompt' }>

function PromptDialog({ dialog }: { dialog: Prompt }) {
  const [value, setValue] = useState(dialog.initial)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const dot = dialog.initial.lastIndexOf('.')
    if (dialog.selectStem && dot > 0) el.setSelectionRange(0, dot)
    else el.select()
  }, [dialog])

  const submit = () => {
    const problem = dialog.validate ? dialog.validate(value) : null
    if (problem) {
      setError(problem)
      return
    }
    dialog.resolve(value)
  }

  return (
    <Sheet open title={dialog.title} onClose={() => dialog.resolve(null)} size="sm">
      <form
        className="v-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {dialog.label ? <label className="v-hint" htmlFor="kalyxis-prompt">{dialog.label}</label> : null}
        <input
          id="kalyxis-prompt"
          ref={ref}
          className={`v-input ${error ? 'is-invalid' : ''}`}
          value={value}
          placeholder={dialog.placeholder}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError(null)
          }}
        />
        {error ? <p className="v-error" role="alert">{error}</p> : null}
        <div className="v-form-actions">
          <button type="button" className="v-btn" onClick={() => dialog.resolve(null)}>Cancel</button>
          <button type="submit" className="v-btn v-btn-primary">{dialog.confirmLabel}</button>
        </div>
      </form>
    </Sheet>
  )
}

export function DialogHost() {
  const dialog = useAppStore((s) => s.dialog)
  if (!dialog) return null
  if (dialog.kind === 'prompt') return <PromptDialog key={dialog.title + dialog.initial} dialog={dialog} />
  if (dialog.kind === 'confirm') {
    return (
      <Sheet open title={dialog.title} onClose={() => dialog.resolve(false)} size="sm">
        <div className="v-form">
          <p className="v-dialog-message">{dialog.message}</p>
          <div className="v-form-actions">
            <button type="button" className="v-btn" onClick={() => dialog.resolve(false)}>Cancel</button>
            <button type="button" className={`v-btn ${dialog.danger ? 'v-btn-danger' : 'v-btn-primary'}`} onClick={() => dialog.resolve(true)}>{dialog.confirmLabel}</button>
          </div>
        </div>
      </Sheet>
    )
  }
  return (
    <Sheet open title={dialog.title} onClose={() => dialog.resolve(null)} size="sm">
      <div className="v-form">
        <p className="v-dialog-message">{dialog.message}</p>
        <div className="v-choice-list">
          {dialog.options.map((o) => (
            <button key={o.id} type="button" className={`v-btn ${o.tone === 'primary' ? 'v-btn-primary' : ''} ${o.tone === 'danger' ? 'v-btn-danger' : ''}`} onClick={() => dialog.resolve(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
