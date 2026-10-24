export interface Debounced<A extends unknown[]> {
  (...args: A): void
  cancel(): void
  flush(): void
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer = 0
  let lastArgs: A | null = null
  const debounced = ((...args: A) => {
    lastArgs = args
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      const a = lastArgs
      lastArgs = null
      if (a) fn(...a)
    }, ms)
  }) as Debounced<A>
  debounced.cancel = () => {
    window.clearTimeout(timer)
    lastArgs = null
  }
  debounced.flush = () => {
    window.clearTimeout(timer)
    const a = lastArgs
    lastArgs = null
    if (a) fn(...a)
  }
  return debounced
}

export const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
