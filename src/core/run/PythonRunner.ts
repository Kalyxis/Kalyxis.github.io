import { Runner, type OutputSink, type RunOutcome, type RunRequest } from './Runner'
import type { PyIn, PyOut } from './python.worker'

const LOAD_LIMIT_MS = 120_000

interface Pending {
  id: number
  sink: OutputSink
  timer: number
  limit: number
  resolve: (o: RunOutcome) => void
}

/** Runs Python with Pyodide (WebAssembly) in a worker. Stopping terminates the worker. */
export class PythonRunner extends Runner {
  readonly id = 'python'
  readonly label = 'Python'
  readonly kind = 'console' as const
  readonly languages = ['python'] as const

  private worker: Worker | null = null
  private pending: Pending | null = null
  private nextId = 1

  constructor() {
    super()
    this.setRuntime('idle')
  }

  override warmUp(): void {
    if (this.runtime !== 'idle') return
    this.setRuntime('loading')
    this.spawn().postMessage({ type: 'warm' } satisfies PyIn)
  }

  run(request: RunRequest, sink: OutputSink): Promise<RunOutcome> {
    if (this.pending) this.kill({ ms: 0, failure: 'stopped' })
    if (this.runtime === 'idle') this.setRuntime('loading')
    const worker = this.spawn()
    return new Promise<RunOutcome>((resolve) => {
      const id = this.nextId++
      const timer = window.setTimeout(() => this.kill({ ms: LOAD_LIMIT_MS, failure: 'load', error: 'Python could not load. Check your connection and run again.' }), LOAD_LIMIT_MS)
      this.pending = { id, sink, timer, limit: request.timeoutMs, resolve }
      worker.postMessage({ type: 'exec', id, code: request.code, stdin: request.stdin, fileName: request.fileName } satisfies PyIn)
    })
  }

  cancel(): void {
    if (this.pending) this.kill({ ms: 0, failure: 'stopped' })
  }

  private kill(outcome: RunOutcome): void {
    this.worker?.terminate()
    this.worker = null
    this.setRuntime('idle')
    const p = this.pending
    if (p) {
      window.clearTimeout(p.timer)
      this.pending = null
      p.resolve(outcome)
    }
  }

  private spawn(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<PyOut>) => this.onMessage(e.data)
    worker.onerror = () => this.kill({ ms: 0, failure: 'load', error: 'Python could not start in this browser.' })
    this.worker = worker
    return worker
  }

  private onMessage(m: PyOut): void {
    if (m.type === 'ready') {
      this.setRuntime('ready')
      return
    }
    const p = this.pending
    if (!p || m.id !== p.id) return
    if (m.type === 'running') {
      window.clearTimeout(p.timer)
      p.timer = window.setTimeout(
        () => this.kill({ ms: p.limit, failure: 'timeout', error: `Stopped after ${Math.round(p.limit / 1000)} seconds. Check for a loop that never ends.` }),
        p.limit,
      )
      return
    }
    if (m.type === 'out') {
      p.sink.write(m.kind, m.text)
      return
    }
    window.clearTimeout(p.timer)
    this.pending = null
    if (m.type === 'done') p.resolve({ ms: m.ms, error: m.error, failure: m.error ? 'runtime' : undefined })
    else {
      const offline = /Failed to fetch|NetworkError|Load failed|import/i.test(m.message)
      p.resolve({
        ms: 0,
        failure: 'load',
        error: offline ? 'Could not download the Python runtime. Connect to the internet once and try again. After that it works offline.' : m.message,
      })
    }
  }
}
