import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'

const OPEN = '([{'
const CLOSE = ')]}'
const MAX_DOC = 250_000
const SKIP = /string|comment|regexp|template|escape|^char/i
const TEXT = /^Text$|Text$/

const marks = [0, 1, 2, 3].map((n) => Decoration.mark({ class: `cm-rb${n}` }))

class RainbowPlugin {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.build(view)
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.viewportChanged ||
      syntaxTree(update.state) !== syntaxTree(update.startState)
    ) {
      this.decorations = this.build(update.view)
    }
  }

  private build(view: EditorView): DecorationSet {
    const { state } = view
    const doc = state.doc
    if (doc.length > MAX_DOC) return Decoration.none
    const tree = syntaxTree(state)
    // Skip documents that have no parser (plain text), where every bracket would be colourised.
    if (tree.length === 0 || tree.type.name === '') return Decoration.none
    const builder = new RangeSetBuilder<Decoration>()
    const { from: viewFrom, to: viewTo } = view.viewport
    const text = doc.sliceString(0, viewTo)
    let depth = 0
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      const isOpen = OPEN.includes(ch)
      const isClose = !isOpen && CLOSE.includes(ch)
      if (!isOpen && !isClose) continue
      const nodeName = tree.resolveInner(i, 1).name
      if (SKIP.test(nodeName) || TEXT.test(nodeName)) continue
      let level: number
      if (isOpen) {
        level = depth
        depth += 1
      } else {
        if (depth === 0) continue
        depth -= 1
        level = depth
      }
      if (i >= viewFrom) builder.add(i, i + 1, marks[level % marks.length])
    }
    return builder.finish()
  }
}

export function rainbowBrackets(): Extension {
  return ViewPlugin.fromClass(RainbowPlugin, { decorations: (plugin) => plugin.decorations })
}
