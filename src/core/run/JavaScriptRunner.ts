import { Runner, type OutputSink, type RunOutcome, type RunRequest } from './Runner'
import type { JsIn, JsOut } from './js.worker'

/** Runs JavaScript as an ES module in a fresh worker, so top level await and imports from URLs work. */
export class JavaScriptRunner extends Runner {
  readonly id = 'javascript'
  readonly label = 'JavaScript'
  readonly kind = 'console' as const
  readonly languages = ['javascript'] as const

  private worker: Worker | null = null
  private finish: ((o: RunOutcome) => void) | null = null
  private timer = 0

  run(request: RunRequest, sink: OutputSink): Promise<RunOutcome> {
    this.cancel()
    return new Promise<RunOutcome>((resolve) => {
      const started = performance.now()
      const worker = new Worker(new URL('./js.worker.ts', import.meta.url), { type: 'module' })
      this.worker = worker
      const done = (outcome: RunOutcome) => {
        window.clearTimeout(this.timer)
        worker.terminate()
        if (this.worker === worker) this.worker = null
        this.finish = null
        resolve(outcome)
      }
      this.finish = done
      this.timer = window.setTimeout(
        () => done({ ms: request.timeoutMs, failure: 'timeout', error: `Stopped after ${Math.round(request.timeoutMs / 1000)} seconds. Check for a loop that never ends.` }),
        request.timeoutMs,
      )
      worker.onmessage = (e: MessageEvent<JsOut>) => {
        const m = e.data
        if (m.type === 'out') sink.write(m.kind, m.text)
        else done({ ms: Math.round(performance.now() - started), error: m.error, failure: m.error ? 'runtime' : undefined })
      }
      worker.onerror = (e) => done({ ms: Math.round(performance.now() - started), error: e.message || 'The script could not start.', failure: 'runtime' })
      worker.postMessage({ type: 'run', code: request.code, stdin: request.stdin, fileName: request.fileName } satisfies JsIn)
    })
  }

  cancel(): void {
    this.finish?.({ ms: 0, failure: 'stopped' })
  }
}
