import {
  closeBrackets,
  closeBracketsKeymap,
  autocompletion,
  completeAnyWord,
  completionKeymap,
} from '@codemirror/autocomplete'
import {
  addCursorAbove,
  addCursorBelow,
  copyLineDown,
  cursorCharLeft,
  cursorCharRight,
  cursorDocEnd,
  cursorDocStart,
  cursorLineDown,
  cursorLineEnd,
  cursorLineStart,
  cursorLineUp,
  defaultKeymap,
  deleteLine,
  history,
  historyKeymap,
  indentLess,
  indentMore,
  insertBlankLine,
  moveLineDown,
  moveLineUp,
  redo,
  selectAll,
  selectCharLeft,
  selectCharRight,
  selectLine,
  selectLineDown,
  selectLineEnd,
  selectLineStart,
  selectLineUp,
  toggleComment,
  undo,
} from '@codemirror/commands'
import {
  bracketMatching,
  foldAll,
  foldCode,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  unfoldAll,
  unfoldCode,
} from '@codemirror/language'
import { forEachDiagnostic, setDiagnosticsEffect } from '@codemirror/lint'
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  highlightSelectionMatches,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  SearchQuery,
  selectNextOccurrence,
  setSearchQuery,
} from '@codemirror/search'
import {
  Compartment,
  countColumn,
  EditorState,
  Transaction,
  type ChangeSpec,
  type Extension,
} from '@codemirror/state'
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  highlightWhitespace,
  keymap,
  lineNumbers,
  rectangularSelection,
  scrollPastEnd,
  type Command,
  type ViewUpdate,
} from '@codemirror/view'
import type { DocumentSession, Eol } from '../documents/DocumentSession'
import type { LanguageId } from '../languages/catalog'
import type { LanguageRegistry } from '../languages/LanguageRegistry'
import type { Settings } from '../services/settings'
import { Emitter } from '../util/Emitter'
import { debounce } from '../util/timing'
import type { CursorState, Problem } from '../../store/useAppStore'
import { rainbowBrackets } from './rainbowBrackets'
import { syntaxLint } from './syntaxLint'
import { kalyxisHighlighting, kalyxisTheme } from './theme'

export type EditorCommandId =
  | 'undo' | 'redo' | 'indentMore' | 'indentLess' | 'tab' | 'selectAll' | 'selectLine'
  | 'deleteLine' | 'duplicateLine' | 'moveLineUp' | 'moveLineDown' | 'toggleComment'
  | 'addCursorAbove' | 'addCursorBelow' | 'selectNextOccurrence'
  | 'foldAll' | 'unfoldAll' | 'foldHere' | 'unfoldHere'
  | 'cursorLineStart' | 'cursorLineEnd' | 'cursorDocStart' | 'cursorDocEnd'
  | 'insertBlankLine' | 'trimTrailing' | 'upperCase' | 'lowerCase' | 'sortLines'

export type Direction = 'left' | 'right' | 'up' | 'down'

export interface FindSpec {
  search: string
  replace: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

export interface FindStats {
  total: number
  current: number
  capped: boolean
}

const MATCH_COUNT_LIMIT = 2000

const tabCommand: Command = (view) => {
  const { state } = view
  if (state.readOnly) return false
  if (state.selection.ranges.some((r) => !r.empty)) return indentMore(view)
  const unit = state.facet(indentUnit)
  let insert = unit
  if (unit !== '\t') {
    const head = state.selection.main.head
    const line = state.doc.lineAt(head)
    const column = countColumn(line.text.slice(0, head - line.from), state.tabSize)
    insert = ' '.repeat(unit.length - (column % unit.length))
  }
  view.dispatch(state.update(state.replaceSelection(insert), { scrollIntoView: true, userEvent: 'input' }))
  return true
}

const mapSelectedText = (transform: (text: string) => string): Command => (view) => {
  const { state } = view
  if (state.readOnly) return false
  const changes: ChangeSpec[] = []
  for (const range of state.selection.ranges) {
    if (range.empty) continue
    const text = state.sliceDoc(range.from, range.to)
    const next = transform(text)
    if (next !== text) changes.push({ from: range.from, to: range.to, insert: next })
  }
  if (!changes.length) return false
  view.dispatch(state.update({ changes, userEvent: 'input' }))
  return true
}

const trimTrailing: Command = (view) => {
  const { state } = view
  if (state.readOnly) return false
  const changes: ChangeSpec[] = []
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n)
    const trimmed = line.text.replace(/[ \t]+$/, '')
    if (trimmed.length !== line.text.length) changes.push({ from: line.from + trimmed.length, to: line.to })
  }
  if (!changes.length) return false
  view.dispatch(state.update({ changes, userEvent: 'input' }))
  return true
}

const sortLines: Command = (view) => {
  const { state } = view
  if (state.readOnly) return false
  const main = state.selection.main
  const wholeDoc = main.empty
  const from = wholeDoc ? 0 : state.doc.lineAt(main.from).from
  const to = wholeDoc ? state.doc.length : state.doc.lineAt(main.to).to
  const lines = state.sliceDoc(from, to).split('\n')
  const sorted = [...lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  if (sorted.every((l, i) => l === lines[i])) return false
  view.dispatch(state.update({ changes: { from, to, insert: sorted.join('\n') }, userEvent: 'input' }))
  return true
}

const COMMANDS: Record<EditorCommandId, Command> = {
  undo,
  redo,
  indentMore,
  indentLess,
  tab: tabCommand,
  selectAll,
  selectLine,
  deleteLine,
  duplicateLine: copyLineDown,
  moveLineUp,
  moveLineDown,
  toggleComment,
  addCursorAbove,
  addCursorBelow,
  selectNextOccurrence: (view) => selectNextOccurrence(view),
  foldAll,
  unfoldAll,
  foldHere: foldCode,
  unfoldHere: unfoldCode,
  cursorLineStart,
  cursorLineEnd,
  cursorDocStart,
  cursorDocEnd,
  insertBlankLine,
  trimTrailing,
  upperCase: mapSelectedText((t) => t.toUpperCase()),
  lowerCase: mapSelectedText((t) => t.toLowerCase()),
  sortLines,
}

const MOVES: Record<Direction, { move: Command; select: Command }> = {
  left: { move: cursorCharLeft, select: selectCharLeft },
  right: { move: cursorCharRight, select: selectCharRight },
  up: { move: cursorLineUp, select: selectLineUp },
  down: { move: cursorLineDown, select: selectLineDown },
}
// Keep the line start/end selectors referenced for the key bar's long press actions.
export const SELECT_TO_LINE_EDGE = { start: selectLineStart, end: selectLineEnd }

/**
 * Wraps one CodeMirror EditorView and swaps documents in and out of it. Each DocumentSession
 * keeps its own EditorState, which preserves undo history and selection per tab.
 */
export class EditorController {
  readonly events = {
    change: new Emitter<DocumentSession>(),
    cursor: new Emitter<CursorState>(),
    focus: new Emitter<boolean>(),
    problems: new Emitter<Problem[]>(),
  }

  private view: EditorView | null = null
  private host: HTMLElement | null = null
  private current: DocumentSession | null = null
  private pending: DocumentSession | null = null
  private settings: Settings
  private dark = true
  private readonly dynamic = new Compartment()
  private readonly languages: LanguageRegistry
  private readonly emitCursor = debounce(() => this.publishCursor(), 40)
  private readonly emitProblems = debounce(() => this.publishProblems(), 350)

  constructor(languages: LanguageRegistry, settings: Settings) {
    this.languages = languages
    this.settings = settings
  }

  get hasView(): boolean {
    return this.view !== null
  }

  get activeSession(): DocumentSession | null {
    return this.current
  }

  /** Attaches CodeMirror to a DOM element. Safe to call again after unmount. */
  mount(host: HTMLElement): void {
    if (this.view) return
    this.host = host
    host.style.setProperty('--editor-font-size', `${this.settings.fontSize}px`)
    this.view = new EditorView({ parent: host, state: this.blankState() })
    const initial = this.pending
    this.pending = null
    this.show(initial ?? this.current)
  }

  unmount(): void {
    if (!this.view) return
    if (this.current) this.current.state = this.view.state
    this.view.destroy()
    this.view = null
    this.host = null
  }

  /** Builds the state for a new document. The language arrives asynchronously via show(). */
  createState(text: string, languageId: LanguageId): EditorState {
    void languageId
    return EditorState.create({ doc: text, extensions: this.baseExtensions() })
  }

  show(session: DocumentSession | null): void {
    if (!this.view) {
      this.pending = session
      this.current = session
      return
    }
    if (this.current && this.current !== session) {
      this.current.state = this.view.state
      this.current.scroll = this.view.scrollSnapshot()
    }
    this.current = session
    if (!session) {
      this.view.setState(this.blankState())
      this.publishCursor()
      this.events.problems.emit([])
      return
    }
    this.view.setState(session.state)
    session.appliedConfig = ''
    this.syncDynamic(session)
    this.ensureLanguage(session)
    if (session.scroll) this.view.dispatch({ effects: session.scroll })
    this.publishCursor()
    this.emitProblems()
  }

  /** Re-applies language and settings to the current document (after a language change, for example). */
  refresh(session: DocumentSession): void {
    if (this.current !== session || !this.view) return
    this.ensureLanguage(session)
    this.syncDynamic(session)
  }

  applySettings(settings: Settings, dark: boolean = this.dark): void {
    this.settings = settings
    this.dark = dark
    this.host?.style.setProperty('--editor-font-size', `${settings.fontSize}px`)
    if (this.current && this.view) this.syncDynamic(this.current)
  }

  setDark(dark: boolean): void {
    this.dark = dark
    if (this.current && this.view) this.syncDynamic(this.current)
  }

  focus(): void {
    this.view?.focus()
  }

  blur(): void {
    this.view?.contentDOM.blur()
  }

  hasFocus(): boolean {
    return this.view?.hasFocus ?? false
  }

  /** Keeps the caret visible after the on screen keyboard opens or the layout changes. */
  revealCursor(): void {
    const view = this.view
    if (!view || !view.hasFocus) return
    view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'nearest', yMargin: 28 }) })
  }

  /** Inserts text the way the keyboard would, so auto closing brackets and tags still apply. */
  insertText(text: string): void {
    const view = this.view
    if (!view || view.state.readOnly) return
    const { from, to } = view.state.selection.main
    const insert = () =>
      view.state.update({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        userEvent: 'input.type',
        scrollIntoView: true,
      })
    for (const handler of view.state.facet(EditorView.inputHandler)) {
      if (handler(view, from, to, text, insert)) {
        view.focus()
        return
      }
    }
    view.dispatch(insert())
    view.focus()
  }

  exec(id: EditorCommandId): boolean {
    const view = this.view
    if (!view) return false
    const ok = COMMANDS[id](view)
    view.focus()
    return ok
  }

  move(direction: Direction, extend: boolean): void {
    const view = this.view
    if (!view) return
    const entry = MOVES[direction]
    ;(extend ? entry.select : entry.move)(view)
    view.focus()
  }

  getSelectionText(): string {
    const view = this.view
    if (!view) return ''
    const { from, to } = view.state.selection.main
    return view.state.sliceDoc(from, to)
  }

  gotoLine(line: number, column = 1): void {
    const view = this.view
    if (!view) return
    const doc = view.state.doc
    const target = doc.line(Math.min(Math.max(1, Math.floor(line)), doc.lines))
    const pos = target.from + Math.min(Math.max(0, Math.floor(column) - 1), target.length)
    view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }), userEvent: 'select' })
    view.focus()
  }

  gotoPosition(pos: number): void {
    const view = this.view
    if (!view) return
    const clamped = Math.min(Math.max(0, pos), view.state.doc.length)
    view.dispatch({ selection: { anchor: clamped }, effects: EditorView.scrollIntoView(clamped, { y: 'center' }), userEvent: 'select' })
    view.focus()
  }

  get lineCount(): number {
    return this.view?.state.doc.lines ?? 0
  }

  /** Replaces the whole document (used by the formatter) as one undoable change. */
  replaceDocument(text: string): void {
    const view = this.view
    if (!view) return
    const current = view.state.doc.toString()
    if (current === text) return
    // Replace only the differing middle so the cursor and scroll position stay where they were.
    let start = 0
    const max = Math.min(current.length, text.length)
    while (start < max && current[start] === text[start]) start++
    let endA = current.length
    let endB = text.length
    while (endA > start && endB > start && current[endA - 1] === text[endB - 1]) {
      endA--
      endB--
    }
    view.dispatch({ changes: { from: start, to: endA, insert: text.slice(start, endB) }, userEvent: 'input' })
  }

  /* ------------------------------ find and replace ------------------------------ */

  openFind(): FindSpec | null {
    const view = this.view
    if (!view) return null
    openSearchPanel(view)
    return this.readQuery()
  }

  closeFind(): void {
    const view = this.view
    if (!view) return
    closeSearchPanel(view)
    view.focus()
  }

  readQuery(): FindSpec | null {
    const view = this.view
    if (!view) return null
    const q = getSearchQuery(view.state)
    return { search: q.search, replace: q.replace, caseSensitive: q.caseSensitive, wholeWord: q.wholeWord, regexp: q.regexp }
  }

  setQuery(spec: FindSpec): void {
    const view = this.view
    if (!view) return
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery(spec)) })
  }

  findNext(): void {
    if (this.view) findNext(this.view)
  }

  findPrevious(): void {
    if (this.view) findPrevious(this.view)
  }

  replaceNext(): void {
    if (this.view) replaceNext(this.view)
  }

  replaceAll(): void {
    if (this.view) replaceAll(this.view)
  }

  findStats(): FindStats {
    const view = this.view
    if (!view) return { total: 0, current: 0, capped: false }
    const query = getSearchQuery(view.state)
    if (!query.valid) return { total: 0, current: 0, capped: false }
    const { from, to } = view.state.selection.main
    const cursor = query.getCursor(view.state)
    let total = 0
    let current = 0
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      total += 1
      if (next.value.from === from && next.value.to === to) current = total
      if (total >= MATCH_COUNT_LIMIT) return { total, current, capped: true }
    }
    return { total, current, capped: false }
  }

  /* --------------------------------- internals --------------------------------- */

  private blankState(): EditorState {
    return EditorState.create({ doc: '', extensions: [...this.baseExtensions(), EditorState.readOnly.of(true)] })
  }

  private configKey(session: DocumentSession): string {
    const s = this.settings
    return [
      this.dark, session.languageId, this.languages.getCached(session.languageId) !== null,
      s.tabSize, s.useTabs, s.wordWrap, s.lineNumbers, s.foldGutter, s.activeLine, s.rainbowBrackets,
      s.autoClose, s.autocomplete, s.syntaxCheck, s.showWhitespace,
    ].join('|')
  }

  private syncDynamic(session: DocumentSession): void {
    const view = this.view
    if (!view || this.current !== session) return
    const key = this.configKey(session)
    if (session.appliedConfig === key) return
    session.appliedConfig = key
    view.dispatch({
      effects: this.dynamic.reconfigure(this.buildDynamic(session.languageId)),
      annotations: Transaction.addToHistory.of(false),
    })
  }

  private ensureLanguage(session: DocumentSession): void {
    const id = session.languageId
    if (id === 'plaintext' || this.languages.getCached(id)) return
    void this.languages.loadExtension(id).then(() => {
      if (this.current === session && session.languageId === id) this.syncDynamic(session)
    })
  }

  private buildDynamic(languageId: LanguageId): Extension {
    const s = this.settings
    const parts: Extension[] = [
      EditorView.darkTheme.of(this.dark),
      EditorState.tabSize.of(s.tabSize),
      indentUnit.of(s.useTabs ? '\t' : ' '.repeat(s.tabSize)),
    ]
    if (s.wordWrap) parts.push(EditorView.lineWrapping)
    if (s.lineNumbers) parts.push(lineNumbers())
    if (s.foldGutter) parts.push(foldGutter({ openText: '\u2304', closedText: '\u203a' }))
    if (s.activeLine) parts.push(highlightActiveLine(), highlightActiveLineGutter())
    if (s.autoClose) parts.push(closeBrackets(), keymap.of(closeBracketsKeymap))
    if (s.autocomplete) {
      parts.push(
        autocompletion({ activateOnTyping: true, icons: false, maxRenderedOptions: 60 }),
        keymap.of(completionKeymap),
        EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }]),
      )
    }
    if (s.rainbowBrackets) parts.push(rainbowBrackets())
    if (s.syntaxCheck && languageId !== 'plaintext') parts.push(syntaxLint(languageId))
    if (s.showWhitespace) parts.push(highlightWhitespace())
    const language = this.languages.getCached(languageId)
    if (language) parts.push(language)
    return parts
  }

  private baseExtensions(): Extension[] {
    return [
      this.dynamic.of([]),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),
      highlightSpecialChars(),
      scrollPastEnd(),
      search({ top: true, createPanel: () => ({ dom: document.createElement('div') }) }),
      kalyxisTheme,
      kalyxisHighlighting,
      EditorView.contentAttributes.of({
        autocapitalize: 'off',
        autocorrect: 'off',
        autocomplete: 'off',
        spellcheck: 'false',
        enterkeyhint: 'enter',
        'aria-label': 'Code editor',
        'data-gramm': 'false',
      }),
      keymap.of([
        { key: 'Tab', run: tabCommand, shift: indentLess },
        { key: 'Mod-d', run: (view) => selectNextOccurrence(view), preventDefault: true },
        ...foldKeymap,
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      EditorView.updateListener.of((update) => this.handleUpdate(update)),
    ]
  }

  private handleUpdate(update: ViewUpdate): void {
    const session = this.current
    if (!session) return
    session.state = update.state
    if (update.docChanged) {
      this.events.change.emit(session)
      this.emitProblems()
    } else if (update.transactions.some((tr) => tr.effects.some((e) => e.is(setDiagnosticsEffect)))) {
      this.emitProblems()
    }
    if (update.selectionSet || update.docChanged) this.emitCursor()
    if (update.focusChanged) this.events.focus.emit(update.view.hasFocus)
  }

  private publishCursor(): void {
    const view = this.view
    const session = this.current
    if (!view || !session) {
      this.events.cursor.emit({ line: 1, col: 1, selected: 0, lines: 1 })
      return
    }
    const state = view.state
    const head = state.selection.main.head
    const line = state.doc.lineAt(head)
    let selected = 0
    for (const r of state.selection.ranges) selected += r.to - r.from
    this.events.cursor.emit({ line: line.number, col: head - line.from + 1, selected, lines: state.doc.lines })
  }

  private publishProblems(): void {
    const view = this.view
    if (!view || !this.current) {
      this.events.problems.emit([])
      return
    }
    const state = view.state
    const found: Problem[] = []
    forEachDiagnostic(state, (d, from) => {
      if (found.length >= 200) return
      const line = state.doc.lineAt(Math.min(from, state.doc.length))
      found.push({ line: line.number, col: from - line.from + 1, from, severity: d.severity === 'hint' ? 'info' : d.severity, message: d.message })
    })
    found.sort((a, b) => a.from - b.from)
    this.events.problems.emit(found)
  }

  /** Line endings are stored on the session, so the controller only needs to know about the type. */
  static eolLabel(eol: Eol): string {
    return eol
  }
}
