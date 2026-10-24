import { ChevronDown, ChevronUp, Copy, Eye, Keyboard, Maximize2, Minimize2, RotateCw, Terminal, Trash2, TriangleAlert, CircleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { app } from '../app/container'
import { clamp } from '../core/util/timing'
import { activeTabSelector, useAppStore, type PanelTab } from '../store/useAppStore'
import { IconButton } from './Controls'

function StatusChip() {
  const run = useAppStore((s) => s.run)
  let label = 'Ready'
  let tone = 'idle'
  if (run.status === 'running') {
    label = run.runtime === 'loading' ? 'Loading runtime' : 'Running'
    tone = 'run'
  } else if (run.status === 'done') {
    label = run.ms !== null ? `Done in ${run.ms} ms` : 'Done'
    tone = 'ok'
  } else if (run.status === 'error') {
    label = 'Error'
    tone = 'err'
  } else if (run.status === 'stopped') {
    label = 'Stopped'
    tone = 'warn'
  }
  return (
    <span className={`v-status-chip is-${tone}`} role="status">
      <span className="v-status-dot" />
      <span className="v-status-label">{label}</span>
    </span>
  )
}

function ConsolePane() {
  const chunks = useAppStore((s) => s.run.chunks)
  const status = useAppStore((s) => s.run.status)
  const tab = useAppStore(activeTabSelector)
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    const el = ref.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [chunks])

  const runnable = tab ? app.runners.forLanguage(tab.languageId) !== null : false
  return (
    <div
      className="v-console"
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      }}
      tabIndex={0}
      aria-label="Console output"
    >
      {chunks.length === 0 ? (
        <div className="v-empty-small">
          <p>{status === 'running' ? 'Waiting for output.' : runnable ? 'Output appears here. Press Run to start.' : 'Open a Python, JavaScript or HTML file to run it.'}</p>
        </div>
      ) : (
        <pre>
          {chunks.map((chunk, i) => (
            <span key={i} className={`v-out v-out-${chunk.kind}`}>
              {chunk.text}
            </span>
          ))}
        </pre>
      )}
    </div>
  )
}

function InputPane() {
  const tab = useAppStore(activeTabSelector)
  if (!tab) return <div className="v-empty-small"><p>Open a file to give it input.</p></div>
  const lines = tab.stdin ? tab.stdin.split('\n').length : 0
  return (
    <div className="v-input-pane">
      <label htmlFor="kalyxis-stdin" className="v-hint">
        Standard input for {tab.name}. One value per line. Programs read it with input() in Python or prompt() in JavaScript.
      </label>
      <textarea
        id="kalyxis-stdin"
        className="v-textarea"
        value={tab.stdin}
        placeholder={'Ada\n30'}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => app.documents.setStdin(tab.id, e.target.value)}
      />
      <div className="v-hint v-hint-right">{lines} {lines === 1 ? 'line' : 'lines'}</div>
    </div>
  )
}

function ProblemsPane() {
  const problems = useAppStore((s) => s.problems)
  if (problems.length === 0) return <div className="v-empty-small"><p>No problems found in this file.</p></div>
  return (
    <ul className="v-problems">
      {problems.map((p, i) => (
        <li key={`${p.from}-${i}`}>
          <button type="button" onClick={() => app.editor.gotoPosition(p.from)}>
            {p.severity === 'error' ? <CircleAlert size={16} strokeWidth={1.5} className="v-problem-err" /> : <TriangleAlert size={16} strokeWidth={1.5} className="v-problem-warn" />}
            <span className="v-problem-msg">{p.message}</span>
            <span className="v-problem-loc">Ln {p.line}, Col {p.col}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function PreviewPane() {
  const preview = useAppStore((s) => s.preview)
  const full = useAppStore((s) => s.ui.previewFullscreen)
  const patchUi = useAppStore((s) => s.patchUi)
  if (!preview.html) {
    return <div className="v-empty-small"><p>Run an HTML file to preview it here.</p></div>
  }
  return (
    <div className={`v-preview ${full ? 'is-full' : ''}`}>
      <div className="v-preview-bar">
        <IconButton label="Reload preview" onClick={() => void app.actions.run()}><RotateCw size={18} strokeWidth={1.4} /></IconButton>
        <IconButton label={full ? 'Exit full screen' : 'Full screen'} onClick={() => patchUi({ previewFullscreen: !full })}>
          {full ? <Minimize2 size={18} strokeWidth={1.4} /> : <Maximize2 size={18} strokeWidth={1.4} />}
        </IconButton>
      </div>
      <iframe
        key={preview.key}
        title="HTML preview"
        className="v-preview-frame"
        sandbox="allow-scripts allow-modals allow-forms allow-popups allow-pointer-lock"
        srcDoc={preview.html}
      />
    </div>
  )
}

const TAB_DEFS: { id: PanelTab; label: string; icon: typeof Terminal }[] = [
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'input', label: 'Input', icon: Keyboard },
  { id: 'problems', label: 'Problems', icon: TriangleAlert },
  { id: 'preview', label: 'Preview', icon: Eye },
]

export function BottomPanel({ containerHeight }: { containerHeight: number }) {
  const open = useAppStore((s) => s.ui.panelOpen)
  const tabId = useAppStore((s) => s.ui.panelTab)
  const problemCount = useAppStore((s) => s.problems.length)
  const stdinLines = useAppStore((s) => activeTabSelector(s)?.stdin.trim().length ?? 0)
  const savedHeight = useAppStore((s) => s.settings.panelHeight)
  const patchUi = useAppStore((s) => s.patchUi)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const maxHeight = Math.max(140, Math.floor(containerHeight * 0.75))
  const height = clamp(dragHeight ?? savedHeight, 140, maxHeight)

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = height
    let latest = startHeight
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    const move = (e: PointerEvent) => {
      latest = clamp(startHeight + (startY - e.clientY), 140, maxHeight)
      setDragHeight(latest)
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      app.settings.update({ panelHeight: Math.round(latest) })
      setDragHeight(null)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const select = (id: PanelTab) => patchUi({ panelOpen: true, panelTab: id })

  return (
    <section className={`v-panel ${open ? 'is-open' : ''}`} style={open ? { height } : undefined} aria-label="Panel">
      {open ? <div className="v-panel-grip" onPointerDown={startDrag} role="separator" aria-orientation="horizontal" aria-label="Resize panel" /> : null}
      <div className="v-panel-head">
        <div className="v-panel-tabs" role="tablist">
          {TAB_DEFS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={open && tabId === id} className={`v-panel-tab ${open && tabId === id ? 'is-active' : ''}`} onClick={() => select(id)}>
              <Icon size={16} strokeWidth={1.4} />
              <span>{label}</span>
              {id === 'problems' && problemCount > 0 ? <span className="v-badge">{problemCount}</span> : null}
              {id === 'input' && stdinLines > 0 ? <span className="v-badge v-badge-dot" aria-label="Has input" /> : null}
            </button>
          ))}
        </div>
        <div className="v-panel-tools">
          <StatusChip />
          {open && tabId === 'console' ? (
            <>
              <IconButton label="Copy output" onClick={() => void app.share.copyText(app.runs.consoleText()).then((ok) => (ok ? app.toasts.success('Copied output') : app.toasts.error('Could not copy')))}>
                <Copy size={17} strokeWidth={1.4} />
              </IconButton>
              <IconButton label="Clear console" onClick={() => app.runs.clear()}>
                <Trash2 size={17} strokeWidth={1.4} />
              </IconButton>
            </>
          ) : null}
          <IconButton label={open ? 'Collapse panel' : 'Expand panel'} onClick={() => patchUi({ panelOpen: !open })}>
            {open ? <ChevronDown size={20} strokeWidth={1.4} /> : <ChevronUp size={20} strokeWidth={1.4} />}
          </IconButton>
        </div>
      </div>
      {open ? (
        <div className="v-panel-body">
          {tabId === 'console' ? <ConsolePane /> : null}
          {tabId === 'input' ? <InputPane /> : null}
          {tabId === 'problems' ? <ProblemsPane /> : null}
          {tabId === 'preview' ? <PreviewPane /> : null}
        </div>
      ) : null}
    </section>
  )
}
