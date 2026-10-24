export type LanguageId =
  | 'plaintext' | 'javascript' | 'jsx' | 'typescript' | 'tsx' | 'json' | 'jsonc'
  | 'html' | 'css' | 'scss' | 'less' | 'markdown' | 'python' | 'ruby' | 'php'
  | 'java' | 'c' | 'cpp' | 'csharp' | 'go' | 'rust' | 'swift' | 'kotlin' | 'sql'
  | 'shell' | 'yaml' | 'xml' | 'toml' | 'ini' | 'dockerfile' | 'graphql' | 'vue'
  | 'lua' | 'r'

export type IconKind = 'code' | 'data' | 'text' | 'markup' | 'style' | 'shell' | 'config'

export interface LanguageInfo {
  id: LanguageId
  label: string
  /** Two or three letter badge for compact UI such as tabs. */
  badge: string
  icon: IconKind
  extensions: readonly string[]
  filenames?: readonly string[]
}

export const LANGUAGES: readonly LanguageInfo[] = [
  { id: 'plaintext', label: 'Plain text', badge: 'TXT', icon: 'text', extensions: ['txt', 'text', 'log'], filenames: ['.gitignore', '.env', '.npmrc', '.editorconfig', 'license', 'readme'] },
  { id: 'javascript', label: 'JavaScript', badge: 'JS', icon: 'code', extensions: ['js', 'mjs', 'cjs'] },
  { id: 'jsx', label: 'JavaScript React', badge: 'JSX', icon: 'code', extensions: ['jsx'] },
  { id: 'typescript', label: 'TypeScript', badge: 'TS', icon: 'code', extensions: ['ts', 'mts', 'cts'] },
  { id: 'tsx', label: 'TypeScript React', badge: 'TSX', icon: 'code', extensions: ['tsx'] },
  { id: 'json', label: 'JSON', badge: 'JSON', icon: 'data', extensions: ['json', 'map', 'webmanifest'] },
  { id: 'jsonc', label: 'JSON with comments', badge: 'JSONC', icon: 'data', extensions: ['jsonc'] },
  { id: 'html', label: 'HTML', badge: 'HTML', icon: 'markup', extensions: ['html', 'htm'] },
  { id: 'css', label: 'CSS', badge: 'CSS', icon: 'style', extensions: ['css'] },
  { id: 'scss', label: 'SCSS', badge: 'SCSS', icon: 'style', extensions: ['scss', 'sass'] },
  { id: 'less', label: 'Less', badge: 'LESS', icon: 'style', extensions: ['less'] },
  { id: 'markdown', label: 'Markdown', badge: 'MD', icon: 'text', extensions: ['md', 'markdown', 'mdx'] },
  { id: 'python', label: 'Python', badge: 'PY', icon: 'code', extensions: ['py', 'pyw', 'pyi'] },
  { id: 'ruby', label: 'Ruby', badge: 'RB', icon: 'code', extensions: ['rb', 'rake', 'gemspec'], filenames: ['gemfile', 'rakefile'] },
  { id: 'php', label: 'PHP', badge: 'PHP', icon: 'code', extensions: ['php'] },
  { id: 'java', label: 'Java', badge: 'JAVA', icon: 'code', extensions: ['java'] },
  { id: 'c', label: 'C', badge: 'C', icon: 'code', extensions: ['c', 'h'] },
  { id: 'cpp', label: 'C++', badge: 'C++', icon: 'code', extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx'] },
  { id: 'csharp', label: 'C#', badge: 'C#', icon: 'code', extensions: ['cs'] },
  { id: 'go', label: 'Go', badge: 'GO', icon: 'code', extensions: ['go'] },
  { id: 'rust', label: 'Rust', badge: 'RS', icon: 'code', extensions: ['rs'] },
  { id: 'swift', label: 'Swift', badge: 'SWIFT', icon: 'code', extensions: ['swift'] },
  { id: 'kotlin', label: 'Kotlin', badge: 'KT', icon: 'code', extensions: ['kt', 'kts'] },
  { id: 'sql', label: 'SQL', badge: 'SQL', icon: 'data', extensions: ['sql'] },
  { id: 'shell', label: 'Shell', badge: 'SH', icon: 'shell', extensions: ['sh', 'bash', 'zsh'], filenames: ['.bashrc', '.zshrc', '.profile'] },
  { id: 'yaml', label: 'YAML', badge: 'YAML', icon: 'config', extensions: ['yml', 'yaml'] },
  { id: 'xml', label: 'XML', badge: 'XML', icon: 'markup', extensions: ['xml', 'svg', 'xsd', 'xsl', 'plist'] },
  { id: 'toml', label: 'TOML', badge: 'TOML', icon: 'config', extensions: ['toml'] },
  { id: 'ini', label: 'INI', badge: 'INI', icon: 'config', extensions: ['ini', 'cfg', 'conf', 'properties'] },
  { id: 'dockerfile', label: 'Dockerfile', badge: 'DOCK', icon: 'config', extensions: ['dockerfile'], filenames: ['dockerfile'] },
  { id: 'graphql', label: 'GraphQL', badge: 'GQL', icon: 'data', extensions: ['graphql', 'gql'] },
  { id: 'vue', label: 'Vue', badge: 'VUE', icon: 'markup', extensions: ['vue'] },
  { id: 'lua', label: 'Lua', badge: 'LUA', icon: 'code', extensions: ['lua'] },
  { id: 'r', label: 'R', badge: 'R', icon: 'code', extensions: ['r'] },
]

const BY_ID = new Map<LanguageId, LanguageInfo>(LANGUAGES.map((l) => [l.id, l]))
const BY_EXT = new Map<string, LanguageId>()
const BY_FILENAME = new Map<string, LanguageId>()
for (const lang of LANGUAGES) {
  for (const ext of lang.extensions) BY_EXT.set(ext, lang.id)
  for (const name of lang.filenames ?? []) BY_FILENAME.set(name, lang.id)
}

/** Extensions that are never edited as text. */
export const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'icns', 'heic', 'avif', 'tiff',
  'pdf', 'zip', 'gz', 'tar', 'tgz', 'bz2', '7z', 'rar', 'jar', 'war',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'wav', 'ogg', 'flac', 'm4a', 'mp4', 'mov', 'webm', 'avi', 'mkv',
  'exe', 'dll', 'so', 'dylib', 'bin', 'wasm', 'class', 'o', 'a', 'pyc', 'sqlite', 'db', 'psd', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
])

export function getLanguageInfo(id: LanguageId): LanguageInfo {
  return BY_ID.get(id) ?? (BY_ID.get('plaintext') as LanguageInfo)
}

export function detectLanguage(filename: string): LanguageId {
  const lower = filename.toLowerCase()
  const byName = BY_FILENAME.get(lower)
  if (byName) return byName
  const dot = lower.lastIndexOf('.')
  if (dot <= 0) return 'plaintext'
  return BY_EXT.get(lower.slice(dot + 1)) ?? 'plaintext'
}

/** The most common file extension for a language, used when naming new files. */
export function defaultExtension(id: LanguageId): string {
  return getLanguageInfo(id).extensions[0] ?? 'txt'
}
