import type { EditorState, StateEffect, Text } from '@codemirror/state'
import { uid } from '../util/id'
import type { LanguageId } from '../languages/catalog'
import { detectLanguage } from '../languages/catalog'
import type { DocumentSource } from './DocumentSource'

export type Eol = 'LF' | 'CRLF'

/**
 * One open document. It owns the CodeMirror state (so each tab keeps its own undo history,
 * selection and scroll position) and remembers which text was last saved.
 */
export class DocumentSession {
  readonly id = uid('doc')
  source: DocumentSource
  state: EditorState
  stdin = ''
  eol: Eol
  dirty = false
  scroll: StateEffect<unknown> | null = null
  /** Cache key of the editor configuration last applied to `state`. */
  appliedConfig = ''
  private savedDoc: Text
  private savedEol: Eol
  private languageOverride: LanguageId | null

  constructor(source: DocumentSource, state: EditorState, eol: Eol, languageOverride: LanguageId | null = null) {
    this.source = source
    this.state = state
    this.eol = eol
    this.savedDoc = state.doc
    this.savedEol = eol
    this.languageOverride = languageOverride
  }

  get name(): string {
    return this.source.name
  }

  get path(): string {
    return this.source.path
  }

  get untitled(): boolean {
    return this.source.kind === 'memory'
  }

  get languageId(): LanguageId {
    return this.languageOverride ?? detectLanguage(this.source.name)
  }

  setLanguage(id: LanguageId | null): void {
    this.languageOverride = id
  }

  get languageOverrideId(): LanguageId | null {
    return this.languageOverride
  }

  /** Current text with the file's original line endings restored. */
  getText(): string {
    return this.state.doc.sliceString(0, this.state.doc.length, this.eol === 'CRLF' ? '\r\n' : '\n')
  }

  /** Recomputes the dirty flag. Returns true when it changed. */
  refreshDirty(): boolean {
    const next = !this.state.doc.eq(this.savedDoc) || this.eol !== this.savedEol
    const changed = next !== this.dirty
    this.dirty = next
    return changed
  }

  /** Records that `doc` (the text that was actually written) is now on disk. */
  markSaved(doc: Text = this.state.doc, eol: Eol = this.eol): void {
    this.savedDoc = doc
    this.savedEol = eol
    this.refreshDirty()
  }
}
