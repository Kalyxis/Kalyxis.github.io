import { syntaxTree } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { linter, type Diagnostic } from '@codemirror/lint'
import type { LanguageId } from '../languages/catalog'

const STRICT = new Set<LanguageId>(['json', 'python', 'javascript', 'jsx', 'typescript', 'tsx', 'css', 'scss', 'less', 'yaml'])
const MAX_DIAGNOSTICS = 40

/**
 * Reports parse errors from the language parser. It does not need a language server, so it
 * works offline for every language that has a real grammar.
 */
export function syntaxLint(languageId: LanguageId): Extension {
  const severity = STRICT.has(languageId) ? 'error' : 'warning'
  return linter(
    (view) => {
      const found: Diagnostic[] = []
      const doc = view.state.doc
      syntaxTree(view.state).iterate({
        enter: (node) => {
          if (found.length >= MAX_DIAGNOSTICS) return false
          if (node.type.isError) {
            let from = node.from
            let to = node.to
            if (to <= from) {
              to = Math.min(doc.length, from + 1)
              if (to <= from) from = Math.max(0, to - 1)
            }
            found.push({ from, to, severity, message: 'Syntax error. Check brackets, quotes and punctuation here.' })
          }
          return undefined
        },
      })
      return found
    },
    { delay: 500 },
  )
}
