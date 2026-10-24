import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { python } from '@codemirror/lang-python'
import {
  copyLineDown, cursorLineEnd, cursorLineStart, cursorCharLeft, cursorCharRight, cursorLineDown, cursorLineUp,
  defaultKeymap, deleteLine, history, historyKeymap, indentLess, indentMore, insertBlankLine, moveLineDown, moveLineUp,
  redo, selectCharLeft, selectCharRight, selectLine, selectLineDown, selectLineUp, toggleComment, undo,
} from '@codemirror/commands'
import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language'
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from '@codemirror/search'
import { EditorState, type Extension } from '@codemirror/state'
import { drawSelection, EditorView, keymap, lineNumbers, type Command } from '@codemirror/view'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { app } from '../../app/container'
import type { Direction, EditorCommandId } from '../../core/editor/EditorController'
import { rainbowBrackets } from '../../core/editor/rainbowBrackets'
import { kalyxisHighlighting, kalyxisTheme } from '../../core/editor/theme'
import type { KeyTarget } from '../AccessoryBar'

export interface TerminalEditorHandle extends KeyTarget {
  focus(): void
}

interface Props {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  onStop: () => void
}

const tabCommand: Command = (view) => {
  if (view.state.selection.ranges.some((r) => !r.empty)) return indentMore(view)
  const unit = view.state.facet(indentUnit)
  const { from, to } = view.state.selection.main
  view.dispatch({ changes: { from, to, insert: unit }, selection: { anchor: from + unit.length }, scrollIntoView: true, userEvent: 'input.indent' })
  return true
}

const COMMANDS: Partial<Record<EditorCommandId, Command>> = {
  undo, redo, indentLess, indentMore, tab: tabCommand, selectLine, deleteLine,
  duplicateLine: copyLineDown, moveLineUp, moveLineDown, toggleComment,
  cursorLineStart, cursorLineEnd, insertBlankLine,
}

const MOVES: Record<Direction, { move: Command; select: Command }> = {
  left: { move: cursorCharLeft, select: selectCharLeft },
  right: { move: cursorCharRight, select: selectCharRight },
  up: { move: cursorLineUp, select: selectLineUp },
  down: { move: cursorLineDown, select: selectLineDown },
}

/** A small CodeMirror editor for the terminal. It shares the app theme and drives the same on screen keys as the main editor. */
export const TerminalEditor = forwardRef<TerminalEditorHandle, Props>(function TerminalEditor({ value, onChange, onRun, onStop }, ref) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const latest = useRef({ onChange, onRun, onStop })
  latest.current = { onChange, onRun, onStop }

  useEffect(() => {
    const el = host.current
    if (!el) return
    const { fontSize } = app.settings.get()
    el.style.setProperty('--editor-font-size', `${fontSize}px`)
    const extensions: Extension[] = [
      lineNumbers(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightSelectionMatches(),
      rainbowBrackets(),
      python(),
      kalyxisTheme,
      kalyxisHighlighting,
      indentUnit.of('    '),
      search({ top: true }),
      keymap.of([
        { key: 'Mod-Shift-Enter', run: () => (latest.current.onRun(), true) },
        { key: 'Mod-.', run: () => (latest.current.onStop(), true) },
        { key: 'Ctrl-Enter', run: insertBlankLine },
        { key: 'Tab', run: tabCommand, shift: indentLess },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
      ]),
      EditorState.phrases.of({ next: 'Next', previous: 'Prev', all: 'All', 'match case': 'Aa', 'by word': 'Word', replace: 'Replace', 'replace all': 'Replace all', Find: 'Find in code', Replace: 'Replace with' }),
      EditorView.contentAttributes.of({ autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'enter', 'aria-label': 'Python code editor' }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) latest.current.onChange(update.state.doc.toString())
      }),
    ]
    const editor = new EditorView({ parent: el, state: EditorState.create({ doc: value, extensions }) })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
    // The editor is created once. External value changes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const v = view.current
    if (!v || v.state.doc.toString() === value) return
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, selection: { anchor: Math.min(value.length, v.state.selection.main.head) } })
  }, [value])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => view.current?.focus(),
      blur: () => view.current?.contentDOM.blur(),
      find: () => {
        const v = view.current
        if (v) openSearchPanel(v)
      },
      insertText: (text) => {
        const v = view.current
        if (!v) return
        const { from, to } = v.state.selection.main
        const insert = () => v.state.update({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, userEvent: 'input.type', scrollIntoView: true })
        for (const handler of v.state.facet(EditorView.inputHandler)) {
          if (handler(v, from, to, text, insert)) {
            v.focus()
            return
          }
        }
        v.dispatch(insert())
        v.focus()
      },
      exec: (id) => {
        const v = view.current
        const command = COMMANDS[id]
        if (!v || !command) return false
        const ok = command(v)
        v.focus()
        return ok
      },
      move: (direction, extend) => {
        const v = view.current
        if (!v) return
        const entry = MOVES[direction]
        ;(extend ? entry.select : entry.move)(v)
        v.focus()
      },
    }),
    [],
  )

  return <div className="t-cm" ref={host} />
})
