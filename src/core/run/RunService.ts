import type { DocumentManager } from '../documents/DocumentManager'
import { WorkspaceSource } from '../documents/DocumentSource'
import type { SettingsService } from '../services/SettingsService'
import type { ToastService } from '../services/ToastService'
import { dirname, joinPath } from '../util/paths'
import { useAppStore, type ConsoleChunk, type RunStatus } from '../../store/useAppStore'
import type { OutputKind, OutputSink } from './Runner'
import type { RunnerRegistry } from './RunnerRegistry'

const FLUSH_MS = 40
const MAX_CHARS = 400_000

/** Collects streamed output and pushes it to the store a few times per second instead of per line. */
class ConsoleBuffer implements OutputSink {
  private chunks: ConsoleChunk[] = []
  private chars = 0
  private timer = 0

  reset(): void {
    window.clearTimeout(this.timer)
    this.timer = 0
    this.chunks = []
    this.chars = 0
    this.push()
  }

  write(kind: OutputKind, text: string): void {
    if (kind === 'clear') {
      this.chunks = []
      this.chars = 0
      this.schedule()
      return
    }
    if (!text || this.chars >= MAX_CHARS) return
    this.append(kind, text)
    this.schedule()
  }

  append(kind: 'stdout' | 'stderr' | 'info', text: string): void {
    this.chars += text.length
    const last = this.chunks[this.chunks.length - 1]
    if (last && last.kind === kind) this.chunks[this.chunks.length - 1] = { kind, text: last.text + text }
    else this.chunks.push({ kind, text })
  }

  flush(): void {
    window.clearTimeout(this.timer)
    this.timer = 0
    this.push()
  }

  private schedule(): void {
    if (this.timer) return
    this.timer = window.setTimeout(() => {
      this.timer = 0
      this.push()
    }, FLUSH_MS)
  }

  private push(): void {
    const chunks = this.chunks.slice()
    useAppStore.setState((s) => ({ run: { ...s.run, chunks, chars: this.chars } }))
  }
}

interface Deps {
  documents: DocumentManager
  runners: RunnerRegistry
  settings: SettingsService
  toasts: ToastService
}

/** Runs the active document, streams output to the console and handles stop and timeouts. */
export class RunService {
  private readonly buffer = new ConsoleBuffer()
  private token = 0
  private readonly deps: Deps

  constructor(deps: Deps) {
    this.deps = deps
    for (const runner of deps.runners.runners) {
      runner.runtimeChanged.subscribe(() => this.syncRuntime())
    }
    deps.documents.edited.subscribe(() => this.syncRuntime())
  }

  canRun(): boolean {
    const session = this.deps.documents.active
    return !!session && this.deps.runners.forLanguage(session.languageId) !== null
  }

  /** Mirrors the state of the active file's runtime (for example "Python is loading") into the store. */
  syncRuntime(): void {
    const session = this.deps.documents.active
    const runner = session ? this.deps.runners.forLanguage(session.languageId) : null
    const runtime = runner?.runtime ?? 'ready'
    if (useAppStore.getState().run.runtime !== runtime) useAppStore.setState((s) => ({ run: { ...s.run, runtime } }))
  }

  /** Begins downloading the runtime for the active file so the first run starts quickly. */
  warmUp(): void {
    const session = this.deps.documents.active
    if (session) this.deps.runners.forLanguage(session.languageId)?.warmUp()
  }

  async run(): Promise<void> {
    const session = this.deps.documents.active
    if (!session) return
    const runner = this.deps.runners.forLanguage(session.languageId)
    if (!runner) {
      this.deps.toasts.show('Run works with Python, JavaScript and HTML files.')
      return
    }
    const token = ++this.token
    for (const r of this.deps.runners.runners) if (r !== runner) r.cancel()
    runner.cancel()
    this.buffer.reset()
    const ui = useAppStore.getState().ui
    useAppStore.setState((s) => ({
      run: { ...s.run, status: 'running', ms: null, error: null, runner: runner.label },
      ui: { ...ui, panelOpen: true, panelTab: runner.kind === 'preview' ? 'preview' : 'console' },
    }))
    this.syncRuntime()

    const source = session.source
    const outcome = await runner.run(
      {
        fileName: session.name,
        code: session.getText(),
        stdin: session.stdin,
        timeoutMs: this.deps.settings.get().runTimeoutSec * 1000,
        readRelative:
          source instanceof WorkspaceSource
            ? async (rel) => {
                try {
                  const clean = rel.split(/[?#]/)[0]
                  return await source.provider.readText(joinPath(dirname(source.path), clean))
                } catch {
                  return null
                }
              }
            : undefined,
      },
      this.buffer,
    )
    if (token !== this.token) return

    let status: RunStatus = 'done'
    if (outcome.failure === 'stopped') status = 'stopped'
    else if (outcome.error) status = 'error'
    if (outcome.error && outcome.failure !== 'stopped') {
      this.buffer.append('stderr', `${outcome.error}\n`)
      if (/EOF when reading a line/.test(outcome.error) && !session.stdin.trim()) {
        this.buffer.append('info', '\nThis program asks for input. Add values in the Input tab, one per line, then run again.\n')
      }
    }
    this.buffer.flush()
    if (outcome.previewHtml !== undefined) {
      useAppStore.setState((s) => ({ preview: { html: outcome.previewHtml ?? null, key: s.preview.key + 1 } }))
    }
    useAppStore.setState((s) => ({ run: { ...s.run, status, ms: outcome.ms, error: outcome.error ?? null } }))
    this.syncRuntime()
  }

  stop(): void {
    const session = this.deps.documents.active
    const runner = session ? this.deps.runners.forLanguage(session.languageId) : null
    if (useAppStore.getState().run.status !== 'running' && runner?.kind !== 'preview') return
    if (runner?.kind === 'preview') {
      runner.cancel()
      useAppStore.setState((s) => ({ preview: { html: null, key: s.preview.key + 1 }, run: { ...s.run, status: 'stopped' }, ui: { ...s.ui, previewFullscreen: false } }))
      return
    }
    for (const r of this.deps.runners.runners) r.cancel()
  }

  clear(): void {
    this.buffer.reset()
    useAppStore.setState((s) => ({ run: { ...s.run, status: s.run.status === 'running' ? 'running' : 'idle', ms: null, error: null } }))
  }

  /** Text of the console, for the copy button. */
  consoleText(): string {
    return useAppStore.getState().run.chunks.map((c) => c.text).join('')
  }
}
