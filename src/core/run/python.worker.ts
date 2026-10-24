/// <reference lib="webworker" />
export const PYODIDE_VERSION = '0.29.5'
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

export type PyIn =
  | { type: 'warm' }
  | { type: 'exec'; id: number; code: string; stdin: string; fileName: string }
export type PyOut =
  | { type: 'ready' }
  | { type: 'running'; id: number }
  | { type: 'out'; id: number; kind: 'stdout' | 'stderr' | 'info'; text: string }
  | { type: 'done'; id: number; ms: number; error?: string }
  | { type: 'fail'; id: number; message: string }

interface PyodideApi {
  globals: { get(name: string): () => { destroy(): void } }
  setStdout(options: { write: (bytes: Uint8Array) => number }): void
  setStderr(options: { write: (bytes: Uint8Array) => number }): void
  setStdin(options: { stdin: () => string | undefined }): void
  runPythonAsync(code: string, options?: { globals?: unknown }): Promise<unknown>
  loadPackagesFromImports(code: string, options?: { messageCallback?: (m: string) => void; errorCallback?: (m: string) => void }): Promise<void>
}

const ctx = self as unknown as DedicatedWorkerGlobalScope
const post = (m: PyOut) => ctx.postMessage(m)

let runtime: Promise<PyodideApi> | null = null
const boot = (): Promise<PyodideApi> => {
  runtime ??= (async () => {
    const mod = (await import(/* @vite-ignore */ `${INDEX_URL}pyodide.mjs`)) as {
      loadPyodide: (options: { indexURL: string }) => Promise<PyodideApi>
    }
    return mod.loadPyodide({ indexURL: INDEX_URL })
  })().catch((e: unknown) => {
    runtime = null
    throw e
  })
  return runtime
}

/** Pyodide tracebacks start with its own frames. Keep only the user's frames. */
export function cleanTraceback(raw: string, fileName: string): string {
  const out: string[] = []
  let keep = true
  for (const line of raw.replace(/\s+$/, '').split('\n')) {
    const frame = /^\s+File "(.*)", line \d+/.exec(line)
    if (frame) {
      keep = !frame[1].includes('_pyodide') && !frame[1].startsWith('/lib/python')
      if (keep) out.push(line)
      continue
    }
    if (/^\s{4,}/.test(line)) {
      if (keep) out.push(line)
      continue
    }
    keep = true
    out.push(line)
  }
  if (/^(SyntaxError|IndentationError|TabError)/.test(out[out.length - 1] ?? '') && out[0]?.startsWith('Traceback')) out.shift()
  return out.join('\n').replace(/File "<exec>"/g, `File "${fileName}"`)
}

const OUTPUT_CAP = 200_000

async function execute(py: PyodideApi, id: number, source: string, stdin: string, fileName: string): Promise<string | undefined> {
  let total = 0
  let truncated = false
  const emit = (kind: 'stdout' | 'stderr' | 'info', text: string) => {
    if (!text || truncated) return
    total += text.length
    if (total > OUTPUT_CAP) {
      truncated = true
      post({ type: 'out', id, kind: 'info', text: '\n(output truncated)\n' })
      return
    }
    post({ type: 'out', id, kind, text })
  }
  const decOut = new TextDecoder()
  const decErr = new TextDecoder()
  py.setStdout({ write: (b) => (emit('stdout', decOut.decode(b, { stream: true })), b.length) })
  py.setStderr({ write: (b) => (emit('stderr', decErr.decode(b, { stream: true })), b.length) })
  const lines = stdin ? stdin.replace(/\r/g, '').replace(/\n$/, '').split('\n') : []
  py.setStdin({
    stdin: () => {
      if (!lines.length) return undefined
      const line = lines.shift() as string
      emit('stdout', `${line}\n`)
      return line
    },
  })
  try {
    await py.loadPackagesFromImports(source, {
      messageCallback: (m) => emit('info', `${m}\n`),
      errorCallback: (m) => emit('stderr', `${m}\n`),
    })
  } catch {
    // Not fatal: the import error is reported by Python itself when the code runs.
  }
  const ns = py.globals.get('dict')()
  try {
    await py.runPythonAsync(source, { globals: ns })
    return undefined
  } catch (e) {
    const raw = String((e as Error)?.message ?? e).replace(/^PythonError:\s*/, '')
    return cleanTraceback(raw, fileName)
  } finally {
    ns.destroy()
  }
}

ctx.onmessage = async (event: MessageEvent<PyIn>) => {
  const msg = event.data
  if (msg.type === 'warm') {
    try {
      await boot()
      post({ type: 'ready' })
    } catch {
      // Surfaced on the next run.
    }
    return
  }
  try {
    const py = await boot()
    post({ type: 'ready' })
    post({ type: 'running', id: msg.id })
    const t0 = performance.now()
    const error = await execute(py, msg.id, msg.code, msg.stdin, msg.fileName)
    post({ type: 'done', id: msg.id, ms: Math.round(performance.now() - t0), error })
  } catch (error) {
    post({ type: 'fail', id: msg.id, message: String((error as Error)?.message ?? error).split('\n').slice(-4).join('\n') })
  }
}
