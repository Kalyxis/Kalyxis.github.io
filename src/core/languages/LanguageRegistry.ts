import { LanguageDescription, LanguageSupport, StreamLanguage, type StreamParser } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { LANGUAGES, type LanguageId } from './catalog'

type Loader = () => Promise<LanguageSupport>

const legacy = (parser: StreamParser<unknown>): LanguageSupport => new LanguageSupport(StreamLanguage.define(parser))

/**
 * Loads CodeMirror language packs on demand so the first paint stays small on phones.
 * Every pack is a separate chunk, and a loaded pack is cached for the rest of the session.
 */
export class LanguageRegistry {
  private readonly loaders = new Map<LanguageId, Loader>()
  private readonly supports = new Map<LanguageId, LanguageSupport>()
  private readonly extras = new Map<LanguageId, Extension>()
  private readonly inflight = new Map<LanguageId, Promise<LanguageSupport | null>>()

  constructor() {
    this.register()
  }

  /** Synchronous lookup, only returns packs that have already been loaded. */
  getCached(id: LanguageId): Extension | null {
    const support = this.supports.get(id)
    if (!support) return null
    const extra = this.extras.get(id)
    return extra ? [support, extra] : support
  }

  /** Loads a language pack. Resolves to null for plain text or when the pack fails to load. */
  load(id: LanguageId): Promise<LanguageSupport | null> {
    const cached = this.supports.get(id)
    if (cached) return Promise.resolve(cached)
    const running = this.inflight.get(id)
    if (running) return running
    const loader = this.loaders.get(id)
    if (!loader) return Promise.resolve(null)
    const promise = loader()
      .then((support) => {
        this.supports.set(id, support)
        return support
      })
      .catch(() => null)
      .finally(() => {
        this.inflight.delete(id)
      })
    this.inflight.set(id, promise)
    return promise
  }

  /** Loads the pack plus its extras (such as JSX tag auto closing). */
  async loadExtension(id: LanguageId): Promise<Extension> {
    const support = await this.load(id)
    if (!support) return []
    if (id === 'jsx' || id === 'tsx') {
      if (!this.extras.has(id)) {
        const { autoCloseTags } = await import('@codemirror/lang-javascript')
        this.extras.set(id, autoCloseTags)
      }
    }
    return this.getCached(id) ?? []
  }

  /** Descriptions used by the Markdown pack to highlight fenced code blocks. */
  fenceLanguages(): LanguageDescription[] {
    return LANGUAGES.filter((l) => this.loaders.has(l.id) && l.id !== 'markdown').map((l) =>
      LanguageDescription.of({
        name: l.label,
        alias: [l.id, ...l.extensions],
        load: async () => {
          const support = await this.load(l.id)
          if (!support) throw new Error(`Language ${l.id} is not available`)
          return support
        },
      }),
    )
  }

  private add(ids: LanguageId[], loader: Loader): void {
    for (const id of ids) this.loaders.set(id, loader)
  }

  private register(): void {
    this.loaders.set('javascript', async () => (await import('@codemirror/lang-javascript')).javascript())
    this.loaders.set('jsx', async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true }))
    this.loaders.set('typescript', async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: true }))
    this.loaders.set('tsx', async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: true, jsx: true }))
    this.add(['json', 'jsonc'], async () => (await import('@codemirror/lang-json')).json())
    this.loaders.set('html', async () => (await import('@codemirror/lang-html')).html())
    this.loaders.set('css', async () => (await import('@codemirror/lang-css')).css())
    this.loaders.set('scss', async () => (await import('@codemirror/lang-sass')).sass({ indented: false }))
    this.loaders.set('less', async () => (await import('@codemirror/lang-less')).less())
    this.loaders.set('markdown', async () => {
      const { markdown } = await import('@codemirror/lang-markdown')
      return markdown({ codeLanguages: this.fenceLanguages() })
    })
    this.loaders.set('python', async () => (await import('@codemirror/lang-python')).python())
    this.loaders.set('php', async () => (await import('@codemirror/lang-php')).php())
    this.loaders.set('java', async () => (await import('@codemirror/lang-java')).java())
    this.add(['c', 'cpp'], async () => (await import('@codemirror/lang-cpp')).cpp())
    this.loaders.set('go', async () => (await import('@codemirror/lang-go')).go())
    this.loaders.set('rust', async () => (await import('@codemirror/lang-rust')).rust())
    this.loaders.set('sql', async () => (await import('@codemirror/lang-sql')).sql())
    this.loaders.set('yaml', async () => (await import('@codemirror/lang-yaml')).yaml())
    this.loaders.set('xml', async () => (await import('@codemirror/lang-xml')).xml())
    this.loaders.set('vue', async () => (await import('@codemirror/lang-vue')).vue())

    this.loaders.set('ruby', async () => legacy((await import('@codemirror/legacy-modes/mode/ruby')).ruby))
    this.loaders.set('swift', async () => legacy((await import('@codemirror/legacy-modes/mode/swift')).swift))
    this.loaders.set('kotlin', async () => legacy((await import('@codemirror/legacy-modes/mode/clike')).kotlin))
    this.loaders.set('csharp', async () => legacy((await import('@codemirror/legacy-modes/mode/clike')).csharp))
    this.loaders.set('shell', async () => legacy((await import('@codemirror/legacy-modes/mode/shell')).shell))
    this.loaders.set('toml', async () => legacy((await import('@codemirror/legacy-modes/mode/toml')).toml))
    this.loaders.set('ini', async () => legacy((await import('@codemirror/legacy-modes/mode/properties')).properties))
    this.loaders.set('dockerfile', async () => legacy((await import('@codemirror/legacy-modes/mode/dockerfile')).dockerFile))
    this.loaders.set('lua', async () => legacy((await import('@codemirror/legacy-modes/mode/lua')).lua))
    this.loaders.set('r', async () => legacy((await import('@codemirror/legacy-modes/mode/r')).r))
    this.loaders.set('graphql', async () => new LanguageSupport((await import('./graphql')).graphqlLanguage))
  }
}
