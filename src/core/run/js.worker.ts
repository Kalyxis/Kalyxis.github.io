/// <reference lib="webworker" />
export type JsIn = { type: 'run'; code: string; stdin: string; fileName: string }
export type JsOut =
  | { type: 'out'; kind: 'stdout' | 'stderr' | 'clear'; text: string }
  | { type: 'done'; error?: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope & Record<string, unknown>
const post = (m: JsOut) => ctx.postMessage(m)

function inspect(value: unknown, depth = 0, seen = new WeakSet<object>()): string {
  if (typeof value === 'string') return depth === 0 ? value : JSON.stringify(value)
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'function') return `[Function${value.name ? `: ${value.name}` : ''}]`
  if (value === null || typeof value !== 'object') return String(value)
  if (seen.has(value)) return '[Circular]'
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`
  if (depth > 3) return Array.isArray(value) ? '[Array]' : '[Object]'
  seen.add(value)
  try {
    if (value instanceof Map) return `Map(${value.size}) {${[...value].slice(0, 50).map(([k, v]) => `${inspect(k, depth + 1, seen)} => ${inspect(v, depth + 1, seen)}`).join(', ')}}`
    if (value instanceof Set) return `Set(${value.size}) {${[...value].slice(0, 50).map((v) => inspect(v, depth + 1, seen)).join(', ')}}`
    if (Array.isArray(value)) {
      const items = value.slice(0, 100).map((v) => inspect(v, depth + 1, seen))
      if (value.length > 100) items.push(`... ${value.length - 100} more items`)
      return `[${items.join(', ')}]`
    }
    if (value instanceof Date) return value.toISOString()
    const keys = Object.keys(value).slice(0, 100)
    const body = keys.map((k) => `${k}: ${inspect((value as Record<string, unknown>)[k], depth + 1, seen)}`).join(', ')
    return body ? `{ ${body} }` : '{}'
  } finally {
    seen.delete(value)
  }
}

const OUTPUT_CAP = 200_000
let written = 0
let capped = false
function write(kind: 'stdout' | 'stderr', text: string): void {
  if (capped) return
  written += text.length
  if (written > OUTPUT_CAP) {
    capped = true
    post({ type: 'out', kind: 'stderr', text: '\n(output truncated)\n' })
    return
  }
  post({ type: 'out', kind, text })
}

ctx.onmessage = async (event: MessageEvent<JsIn>) => {
  const { code, stdin, fileName } = event.data
  const lines = stdin ? stdin.replace(/\r/g, '').replace(/\n$/, '').split('\n') : []
  let indent = ''
  const counts = new Map<string, number>()
  const clocks = new Map<string, number>()
  const fmt = (args: unknown[]) => indent + args.map((a) => inspect(a)).join(' ').replace(/\n/g, `\n${indent}`) + '\n'

  const consoleApi = {
    log: (...a: unknown[]) => write('stdout', fmt(a)),
    info: (...a: unknown[]) => write('stdout', fmt(a)),
    debug: (...a: unknown[]) => write('stdout', fmt(a)),
    warn: (...a: unknown[]) => write('stderr', fmt(a)),
    error: (...a: unknown[]) => write('stderr', fmt(a)),
    trace: (...a: unknown[]) => write('stderr', fmt(['Trace:', ...a])),
    dir: (v: unknown) => write('stdout', `${indent}${inspect(v, 1)}\n`),
    table: (v: unknown) => write('stdout', fmt([v])),
    assert: (ok: unknown, ...a: unknown[]) => { if (!ok) write('stderr', fmt(['Assertion failed:', ...a])) },
    group: (...a: unknown[]) => { if (a.length) write('stdout', fmt(a)); indent += '  ' },
    groupCollapsed: (...a: unknown[]) => { if (a.length) write('stdout', fmt(a)); indent += '  ' },
    groupEnd: () => { indent = indent.slice(2) },
    count: (label = 'default') => { const n = (counts.get(label) ?? 0) + 1; counts.set(label, n); write('stdout', fmt([`${label}: ${n}`])) },
    countReset: (label = 'default') => { counts.delete(label) },
    time: (label = 'default') => { clocks.set(label, performance.now()) },
    timeEnd: (label = 'default') => { const t = clocks.get(label); if (t !== undefined) { write('stdout', fmt([`${label}: ${(performance.now() - t).toFixed(2)}ms`])); clocks.delete(label) } },
    timeLog: (label = 'default') => { const t = clocks.get(label); if (t !== undefined) write('stdout', fmt([`${label}: ${(performance.now() - t).toFixed(2)}ms`])) },
    clear: () => post({ type: 'out', kind: 'clear', text: '' }),
  }

  const ask = (message?: unknown): string | null => {
    if (message !== undefined && message !== '') write('stdout', String(message))
    if (!lines.length) { write('stdout', '\n'); return null }
    const answer = lines.shift() as string
    write('stdout', `${answer}\n`)
    return answer
  }

  // Track timers so the run ends when nothing is left to wait for.
  let active = 0
  const timeouts = new Set<number>()
  const intervals = new Set<number>()
  const realSetTimeout = ctx.setTimeout.bind(ctx)
  const realSetInterval = ctx.setInterval.bind(ctx)
  const realClearTimeout = ctx.clearTimeout.bind(ctx)
  const realClearInterval = ctx.clearInterval.bind(ctx)
  ctx.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => {
    active++
    const id = realSetTimeout(() => { timeouts.delete(id); active--; if (typeof fn === 'function') (fn as (...a: unknown[]) => void)(...args) }, ms)
    timeouts.add(id)
    return id
  }) as typeof ctx.setTimeout
  ctx.setInterval = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => {
    active++
    const id = realSetInterval(() => { if (typeof fn === 'function') (fn as (...a: unknown[]) => void)(...args) }, ms)
    intervals.add(id)
    return id
  }) as typeof ctx.setInterval
  ctx.clearTimeout = ((id?: number) => { if (id !== undefined && timeouts.delete(id)) active--; realClearTimeout(id) }) as typeof ctx.clearTimeout
  ctx.clearInterval = ((id?: number) => { if (id !== undefined && intervals.delete(id)) active--; realClearInterval(id) }) as typeof ctx.clearInterval

  Object.assign(ctx, {
    console: consoleApi,
    prompt: ask,
    input: ask,
    readline: ask,
    alert: (m: unknown) => write('stdout', `${String(m)}\n`),
  })

  const fixStack = (text: string) =>
    text.replace(/blob:[^\s)]+?:(\d+):(\d+)/g, `${fileName}:$1:$2`).replace(/blob:[^\s)]+/g, fileName)
  let failed: string | undefined
  ctx.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    e.preventDefault()
    const r = e.reason
    failed = fixStack(r instanceof Error ? r.stack || r.message : String(r))
    write('stderr', `Uncaught (in promise) ${failed}\n`)
  })

  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  try {
    await import(/* @vite-ignore */ url)
    while (active > 0) await new Promise<void>((r) => realSetTimeout(r, 25))
  } catch (e) {
    failed = fixStack(e instanceof Error ? e.stack || `${e.name}: ${e.message}` : String(e))
  } finally {
    URL.revokeObjectURL(url)
    for (const id of intervals) realClearInterval(id)
  }
  post({ type: 'done', error: failed })
}
