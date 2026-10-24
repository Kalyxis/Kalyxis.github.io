import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Code2, Keyboard, Play, Square, Terminal, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { app } from '../../app/container'
import type { OutputKind, OutputSink } from '../../core/run/Runner'
import type { RuntimeState } from '../../core/run/Runner'
import { loadTerminal, saveTerminal } from '../../core/services/TerminalStorage'
import { TERMINAL_EXAMPLES, type TerminalExample } from '../../core/templates/terminalExamples'
import { useAppStore } from '../../store/useAppStore'
import { AccessoryBar } from '../AccessoryBar'
import { Sheet } from '../Sheet'
import '../../styles/terminal.css'
import { TerminalEditor, type TerminalEditorHandle } from './TerminalEditor'

interface Chunk {
  kind: 'stdout' | 'stderr' | 'info'
  text: string
}
type RunState = 'idle' | 'running' | 'done' | 'error' | 'stopped'
interface Run {
  state: RunState
  chunks: Chunk[]
  ms?: number
  error?: string
}
interface UndoState {
  code: string
  stdin: string
  label: string
}

const IDLE: Run = { state: 'idle', chunks: [] }

/** True while the terminal editor has focus on a phone, which switches the screen into full bleed focus mode. */
function useFocusMode(root: React.RefObject<HTMLElement | null>): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const phone = window.matchMedia('(pointer: coarse) and (max-width: 820px)')
    let timer = 0
    const apply = () => setOn(phone.matches && !!document.activeElement?.closest('.t-cm'))
    const soon = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(apply, 80)
    }
    el.addEventListener('focusin', soon)
    el.addEventListener('focusout', soon)
    return () => {
      window.clearTimeout(timer)
      el.removeEventListener('focusin', soon)
      el.removeEventListener('focusout', soon)
    }
  }, [root])
  return on
}

/** A free scratchpad for Python. Write, feed input() lines, run, read the console. Nothing here touches your files. */
export function TerminalScreen() {
  const runner = app.runners.forLanguage('python')
  const saved = useMemo(loadTerminal, [])
  const [code, setCode] = useState(saved.code)
  const [stdin, setStdin] = useState(saved.stdin)
  const [run, setRun] = useState<Run>(IDLE)
  const [rt, setRt] = useState<RuntimeState>(runner?.runtime ?? 'idle')
  const [sheet, setSheet] = useState(false)
  const [inputOpen, setInputOpen] = useState(false)
  const [undo, setUndo] = useState<UndoState | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const editor = useRef<TerminalEditorHandle>(null)
  const consoleRef = useRef<HTMLDivElement>(null)
  const token = useRef(0)
  const pendingScroll = useRef(false)
  const editing = useFocusMode(root)
  const running = run.state === 'running'
  const needsInput = /\binput\s*\(/.test(code)
  const lines = code.trim() ? code.replace(/\s+$/, '').split('\n').length : 0
  const close = () => useAppStore.getState().patchUi({ terminalOpen: false })

  useEffect(() => {
    if (!runner) return
    setRt(runner.runtime)
    return runner.runtimeChanged.subscribe(setRt)
  }, [runner])
  // Open the Input panel once when the code starts asking for input(). After that it stays however the user leaves it.
  useEffect(() => {
    if (needsInput && !stdin.trim()) setInputOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsInput])
  useEffect(() => {
    runner?.warmUp()
  }, [runner])
  useEffect(() => {
    const t = window.setTimeout(() => saveTerminal({ code, stdin }), 400)
    return () => window.clearTimeout(t)
  }, [code, stdin])
  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => setUndo(null), 7000)
    return () => window.clearTimeout(t)
  }, [undo])
  useEffect(() => () => {
    token.current++
    runner?.cancel()
  }, [runner])
  useEffect(() => {
    if (!editing && pendingScroll.current) {
      pendingScroll.current = false
      const t = window.setTimeout(() => consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180)
      return () => window.clearTimeout(t)
    }
  }, [editing])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sheet && !document.activeElement?.closest('.t-cm')) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet])

  async function start() {
    if (running || !runner) return
    if (editing) pendingScroll.current = true
    else requestAnimationFrame(() => consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    editor.current?.blur()
    const t = ++token.current
    let chunks: Chunk[] = []
    let timer = 0
    const flush = () => {
      timer = 0
      if (t === token.current) setRun((r) => ({ ...r, chunks: chunks.slice() }))
    }
    const sink: OutputSink = {
      write(kind: OutputKind, text: string) {
        if (kind === 'clear') chunks = []
        else if (text) {
          const last = chunks[chunks.length - 1]
          if (last && last.kind === kind) chunks[chunks.length - 1] = { kind, text: last.text + text }
          else chunks.push({ kind, text })
        }
        if (!timer) timer = window.setTimeout(flush, 40)
      },
    }
    setRun({ state: 'running', chunks: [] })
    const outcome = await runner.run({ fileName: 'main.py', code, stdin, timeoutMs: app.settings.get().runTimeoutSec * 1000 }, sink)
    window.clearTimeout(timer)
    if (t !== token.current) return
    if (outcome.error && outcome.failure !== 'stopped') chunks = [...chunks, { kind: 'stderr', text: `${outcome.error}\n` }]
    setRun({ state: outcome.failure === 'stopped' ? 'stopped' : outcome.error ? 'error' : 'done', chunks, ms: outcome.ms, error: outcome.error })
  }

  function stop() {
    token.current++
    runner?.cancel()
    setRun({ state: 'stopped', chunks: [] })
  }

  const replace = (next: { code: string; stdin: string }, label: string) => {
    setUndo({ code, stdin, label })
    setCode(next.code)
    setStdin(next.stdin)
    setRun(IDLE)
  }
  const useExample = (e: TerminalExample) => {
    setSheet(false)
    replace({ code: e.code, stdin: e.stdin ?? '' }, `Loaded “${e.title}”`)
  }

  const status =
    run.state === 'running' ? 'RUNNING' : run.state === 'done' ? `DONE · ${run.ms} MS` : run.state === 'error' ? 'ERROR' : run.state === 'stopped' ? 'STOPPED' : 'READY'
  const eof = !!run.error && /EOFError|EOF when reading a line/.test(run.error)
  const hasOutput = run.chunks.some((c) => c.text)
  const stdinLines = stdin.trim() ? stdin.replace(/\n$/, '').split('\n').length : 0

  return (
    <div className={`t-screen ${editing ? 'is-editing' : ''}`} ref={root}>
      <div className="t-focusbar">
        <button type="button" className="t-done" onClick={() => editor.current?.blur()}>
          <ChevronDown size={18} strokeWidth={1.4} /> Done
        </button>
        <span className="t-focus-title"><Terminal size={14} strokeWidth={1.4} /> Terminal</span>
      </div>

      <header className="t-bar">
        <button type="button" className="t-back" onClick={close}>
          <ChevronLeft size={18} strokeWidth={1.4} /> Editor
        </button>
        <div className="t-bar-title">Sandbox</div>
        <div className="t-bar-end" aria-hidden="true" />
      </header>

      <div className="t-scroll">
        <div className="t-head">
          <div className="t-eyebrow">Free play</div>
          <h1>Terminal</h1>
          <p>Write any Python and run it. Your code is saved on this device and never touches your files.</p>
        </div>

        <section className="t-card t-editor-card">
          <div className="t-card-top">
            <span className="t-label"><Code2 size={14} strokeWidth={1.4} /> main.py</span>
            <span className={`t-rt t-rt-${rt}`}>{rt === 'ready' ? 'Python ready' : rt === 'loading' ? 'Python waking' : 'Python asleep'}</span>
            <span className="t-lines">{lines} {lines === 1 ? 'line' : 'lines'}</span>
            <button type="button" className="v-icon-btn" onClick={() => code && replace({ code: '', stdin }, 'Editor cleared')} aria-label="Clear editor" disabled={!code}>
              <Trash2 size={16} strokeWidth={1.4} />
            </button>
          </div>
          <div className="t-editor">
            <TerminalEditor ref={editor} value={code} onChange={setCode} onRun={() => void start()} onStop={stop} />
          </div>
        </section>

        <section className="t-card t-input-card">
          <button type="button" className="t-card-top t-toggle" onClick={() => setInputOpen((o) => !o)} aria-expanded={inputOpen}>
            <span className="t-label"><Keyboard size={14} strokeWidth={1.4} /> Input</span>
            <span className="t-hint">{needsInput && !stdin.trim() ? 'your code calls input()' : stdinLines ? `${stdinLines} line(s) ready` : 'optional'}</span>
            <ChevronRight size={16} strokeWidth={1.4} className={`t-chev ${inputOpen ? 'is-open' : ''}`} />
          </button>
          {inputOpen ? (
            <textarea
              className="t-stdin"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              rows={3}
              placeholder={'One line per input() call, in order.\nExample:\nAda\n30'}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Lines used to answer input() calls"
            />
          ) : null}
        </section>

        <section className="t-card t-output-card" ref={consoleRef}>
          <div className="t-card-top">
            <span className="t-label"><Terminal size={14} strokeWidth={1.4} /> Console</span>
            <span className={`t-status s-${run.state === 'error' ? 'error' : run.state === 'running' ? 'busy' : run.state === 'done' ? 'ok' : 'idle'}`}>{status}</span>
            <button type="button" className="v-icon-btn" onClick={() => setRun(IDLE)} aria-label="Clear console" disabled={run.state === 'idle' || running}>
              <Trash2 size={16} strokeWidth={1.4} />
            </button>
          </div>
          <pre className="t-console" aria-live="polite">
            {run.state === 'idle' ? <span className="t-muted">Run your code to see its output here.</span> : null}
            {running && !hasOutput ? <span className="t-muted">{rt === 'ready' ? 'Running…' : 'Waking Python up. First launch downloads the runtime…'}</span> : null}
            {run.state === 'stopped' ? <span className="t-muted">Stopped.</span> : null}
            {run.state !== 'idle' && run.state !== 'stopped'
              ? run.chunks.map((c, i) => (
                  <span key={i} className={c.kind === 'stderr' ? 't-err' : c.kind === 'info' ? 't-muted' : undefined}>{c.text}</span>
                ))
              : null}
            {run.state === 'done' && !hasOutput ? <span className="t-muted">(finished with no output)</span> : null}
          </pre>
          {eof ? (
            <div className="t-verdict">
              <b>input() ran out of lines.</b>
              <span>Add one line per input() call in the Input panel above, then run again.</span>
            </div>
          ) : null}
        </section>
      </div>

      {undo ? (
        <div className="t-toast" role="status">
          <span>{undo.label}</span>
          <button type="button" onClick={() => { setCode(undo.code); setStdin(undo.stdin); setUndo(null) }}>
            <Undo2 size={15} strokeWidth={1.4} /> Undo
          </button>
        </div>
      ) : null}

      <div className="t-dock">
        <button type="button" className="v-btn" onClick={() => setSheet(true)}>
          <BookOpen size={17} strokeWidth={1.4} /> Examples
        </button>
        {running ? (
          <button type="button" className="v-btn v-btn-danger t-run" onClick={stop}>
            <Square size={14} strokeWidth={1.6} fill="currentColor" /> Stop
          </button>
        ) : (
          <button type="button" className="v-btn v-btn-primary t-run" onClick={() => void start()}>
            <Play size={15} strokeWidth={1.6} fill="currentColor" /> Run code
          </button>
        )}
      </div>

      {editing ? (
        <div className="t-keys">
          <AccessoryBar target={editor.current ?? undefined} run={{ running, onRun: () => void start(), onStop: stop }} />
        </div>
      ) : null}

      <Sheet open={sheet} title="Examples" onClose={() => setSheet(false)} size="lg">
        {TERMINAL_EXAMPLES.map((e) => (
          <button key={e.id} type="button" className="v-menu-item" onClick={() => useExample(e)}>
            <span className="v-menu-text">
              <span>{e.title}</span>
              <small>{e.blurb}</small>
            </span>
            <ChevronRight size={18} strokeWidth={1.4} />
          </button>
        ))}
      </Sheet>
    </div>
  )
}
