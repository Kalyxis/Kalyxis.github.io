import { Emitter } from '../util/Emitter'

export type RuntimeState = 'idle' | 'loading' | 'ready'
export type OutputKind = 'stdout' | 'stderr' | 'info' | 'clear'

export interface OutputSink {
  write(kind: OutputKind, text: string): void
}

export interface RunRequest {
  fileName: string
  code: string
  stdin: string
  timeoutMs: number
  /** Reads a file next to the one being run (used by the HTML preview for linked css and js). */
  readRelative?: (path: string) => Promise<string | null>
}

export type RunFailure = 'timeout' | 'load' | 'stopped' | 'runtime'

export interface RunOutcome {
  ms: number
  error?: string
  failure?: RunFailure
  /** Set by runners that render a document instead of printing to the console. */
  previewHtml?: string
}

/** Base class for everything that can execute a file. Subclasses decide how and where. */
export abstract class Runner {
  abstract readonly id: string
  abstract readonly label: string
  abstract readonly kind: 'console' | 'preview'
  abstract readonly languages: readonly string[]

  readonly runtimeChanged = new Emitter<RuntimeState>()
  private runtimeState: RuntimeState = 'ready'

  get runtime(): RuntimeState {
    return this.runtimeState
  }

  protected setRuntime(state: RuntimeState): void {
    if (state === this.runtimeState) return
    this.runtimeState = state
    this.runtimeChanged.emit(state)
  }

  /** Starts downloading or booting the runtime ahead of the first run. */
  warmUp(): void {}

  abstract run(request: RunRequest, sink: OutputSink): Promise<RunOutcome>
  abstract cancel(): void
}
