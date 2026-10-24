export type FsErrorCode = 'EEXIST' | 'ENOENT' | 'EINVAL' | 'EISDIR' | 'ENOTDIR' | 'EPERM' | 'ETOOBIG'

export class FsError extends Error {
  readonly code: FsErrorCode

  constructor(code: FsErrorCode, message: string) {
    super(message)
    this.name = 'FsError'
    this.code = code
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
