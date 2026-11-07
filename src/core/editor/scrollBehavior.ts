import { EditorSelection, type Extension, type SelectionRange, type StateEffect } from '@codemirror/state'
import { EditorView, type Command } from '@codemirror/view'

/**
 * Everything that decides where the editor scrolls lives here, so the main editor and the
 * terminal editor behave the same and there is one place to tune it.
 *
 * Rules:
 *  1. Typing and cursor keys scroll only when the caret gets close to an edge, by the smallest amount.
 *  2. Find never moves the view while you type the query. Next and Previous start from what is on
 *     screen, and only scroll when the match is not already comfortably visible.
 *  3. Selecting lines scrolls to the lines that were selected, never to the line after them.
 *  4. Nothing scrolls while a finger or wheel is moving the document.
 */

/** Space kept between the caret and the top or bottom edge of the editor. */
export const SCROLL_MARGIN = { top: 12, bottom: 28 }

/** A match this close to an edge counts as "not comfortably visible". */
const COMFORT = 48

export const scrollMargins: Extension = EditorView.scrollMargins.of(() => SCROLL_MARGIN)

/** True when the position is on screen with some breathing room. */
export function isComfortablyVisible(view: EditorView, pos: number, margin = COMFORT): boolean {
  const caret = view.coordsAtPos(pos)
  if (!caret) return false
  const box = view.scrollDOM.getBoundingClientRect()
  return caret.top >= box.top + margin && caret.bottom <= box.bottom - margin
}

/** Scroll effect for a find match. Visible matches stay put, far matches are centred. */
export function scrollToMatch(range: SelectionRange, view: EditorView): StateEffect<unknown> {
  if (isComfortablyVisible(view, range.head)) return EditorView.scrollIntoView(range, { y: 'nearest', yMargin: 0 })
  return EditorView.scrollIntoView(range, { y: 'center' })
}

/**
 * Next and Previous continue from what the user is looking at. If the caret was left far away
 * from the visible area, the search starts at the top (or bottom) edge instead of jumping back.
 */
export function anchorSearchToViewport(view: EditorView, direction: 'forward' | 'backward'): void {
  const { head } = view.state.selection.main
  if (isComfortablyVisible(view, head, 0)) return
  const box = view.scrollDOM.getBoundingClientRect()
  const x = box.left + Math.min(48, box.width / 2)
  const y = direction === 'forward' ? box.top + 4 : box.bottom - 4
  const pos = view.posAtCoords({ x, y }, false)
  view.dispatch({ selection: EditorSelection.cursor(pos), userEvent: 'select' })
}

/**
 * Selects the whole line (including its line break) around each selection. Repeating it changes
 * nothing, so it is safe to tap twice. The view only scrolls if the selected lines are not already
 * visible, and it scrolls to the lines themselves. The default command leaves the caret at the start
 * of the next line, which pulled the document down whenever the selected line sat at the bottom edge.
 */
export const selectWholeLines: Command = (view) => {
  const { state } = view
  const doc = state.doc
  const ranges = state.selection.ranges.map((r) => {
    const first = doc.lineAt(r.from)
    // A selection that already ends at the start of a line includes the line break of the line before it.
    const end = !r.empty && r.to > first.from && doc.lineAt(r.to).from === r.to ? r.to - 1 : r.to
    const last = doc.lineAt(end)
    return EditorSelection.range(first.from, Math.min(last.to + 1, doc.length))
  })
  const main = state.selection.mainIndex
  const shown = EditorSelection.range(ranges[main].from, doc.lineAt(Math.max(ranges[main].from, ranges[main].to - 1)).to)
  view.dispatch({
    selection: EditorSelection.create(ranges, main),
    effects: EditorView.scrollIntoView(shown, { y: 'nearest' }),
    userEvent: 'select',
  })
  return true
}

/**
 * Remembers when a finger or wheel last moved the document. Automatic scrolling that is not a direct
 * answer to typing (for example after the keyboard opens) waits for the gesture to finish.
 */
export class GestureClock {
  private last = 0
  private detach: (() => void) | null = null

  /** Listens on the scroll container, which also covers touches that start on the gutters. */
  attach(dom: HTMLElement): void {
    this.detach?.()
    const mark = () => {
      this.last = performance.now()
    }
    const options = { passive: true } as const
    dom.addEventListener('touchstart', mark, options)
    dom.addEventListener('touchmove', mark, options)
    dom.addEventListener('wheel', mark, options)
    this.detach = () => {
      dom.removeEventListener('touchstart', mark)
      dom.removeEventListener('touchmove', mark)
      dom.removeEventListener('wheel', mark)
    }
  }

  dispose(): void {
    this.detach?.()
    this.detach = null
  }

  /** True while the user is dragging or flinging the document. */
  get active(): boolean {
    return performance.now() - this.last < 700
  }
}
