const textDecoder = new TextDecoder('utf-8')
const textEncoder = new TextEncoder()

export function decodeText(bytes: Uint8Array): string {
  // Strip a UTF-8 byte order mark so it never shows up as an invisible character.
  const start = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
  return textDecoder.decode(start ? bytes.subarray(start) : bytes)
}

export function encodeText(text: string): Uint8Array<ArrayBuffer> {
  return textEncoder.encode(text) as Uint8Array<ArrayBuffer>
}

/** Heuristic used by most editors: a NUL byte in the first 8 KB means the file is binary. */
export function looksBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8192)
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return true
  return false
}

export function detectEol(text: string): 'LF' | 'CRLF' {
  const i = text.indexOf('\n')
  return i > 0 && text[i - 1] === '\r' ? 'CRLF' : 'LF'
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Subsequence fuzzy score. Returns -1 when `query` does not match, higher is better. */
export function fuzzyScore(query: string, target: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let score = 0
  let ti = 0
  let streak = 0
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti)
    if (found === -1) return -1
    streak = found === ti ? streak + 1 : 0
    const boundary = found === 0 || /[\s/._-]/.test(t[found - 1])
    score += 1 + streak * 2 + (boundary ? 3 : 0) - Math.min(found - ti, 6) * 0.2
    ti = found + 1
  }
  return score - t.length * 0.01
}
