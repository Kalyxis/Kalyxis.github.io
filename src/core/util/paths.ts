/** POSIX style helpers for the virtual workspace. The root directory is "/". */

export const ROOT = '/'

export function normalizePath(input: string): string {
  const parts: string[] = []
  for (const part of input.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return ROOT + parts.join('/')
}

export function joinPath(dir: string, name: string): string {
  return normalizePath(`${dir}/${name}`)
}

export function dirname(path: string): string {
  const p = normalizePath(path)
  if (p === ROOT) return ROOT
  const i = p.lastIndexOf('/')
  return i <= 0 ? ROOT : p.slice(0, i)
}

export function basename(path: string): string {
  const p = normalizePath(path)
  if (p === ROOT) return ''
  return p.slice(p.lastIndexOf('/') + 1)
}

export function extname(name: string): string {
  const i = name.lastIndexOf('.')
  return i <= 0 ? '' : name.slice(i + 1).toLowerCase()
}

export function isInside(path: string, ancestor: string): boolean {
  const p = normalizePath(path)
  const a = normalizePath(ancestor)
  if (a === ROOT) return true
  return p === a || p.startsWith(`${a}/`)
}

/** Replaces the leading `from` directory of `path` with `to`. */
export function rebase(path: string, from: string, to: string): string {
  const p = normalizePath(path)
  const f = normalizePath(from)
  if (p === f) return normalizePath(to)
  return normalizePath(to + p.slice(f.length))
}

/** Splits a path into its non empty segments. */
export function segments(path: string): string[] {
  return normalizePath(path).split('/').filter(Boolean)
}

/** Returns an error message when `name` cannot be used as a single file or folder name. */
export function validateName(name: string): string | null {
  const n = name.trim()
  if (!n) return 'Enter a name.'
  if (n === '.' || n === '..') return 'That name is reserved.'
  if (/[\\/]/.test(n)) return 'Names cannot contain slashes.'
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(n)) return 'Names cannot contain control characters.'
  if (n.length > 200) return 'That name is too long.'
  return null
}

/** Picks "name copy.ext", "name copy 2.ext" and so on, avoiding every name in `taken`. */
export function uniqueName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let i = 1; ; i++) {
    const candidate = `${stem} copy${i > 1 ? ` ${i}` : ''}${ext}`
    if (!taken.has(candidate)) return candidate
  }
}
