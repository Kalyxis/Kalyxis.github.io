import { SearchQuery } from '@codemirror/search'
import { CaseSensitive, ChevronDown, ChevronRight, ChevronUp, Regex, WholeWord, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { app } from '../app/container'
import type { FindSpec } from '../core/editor/EditorController'
import { useAppStore } from '../store/useAppStore'
import { IconButton } from './Controls'

const EMPTY: FindSpec = { search: '', replace: '', caseSensitive: false, wholeWord: false, regexp: false }

export function FindBar() {
  const open = useAppStore((s) => s.ui.findOpen)
  return open ? <FindBarBody /> : null
}

/** Mounted only while find is open. Its initial state is read from the editor's search state. */
function FindBarBody() {
  const replaceOpen = useAppStore((s) => s.ui.findReplace)
  const activeId = useAppStore((s) => s.activeTabId)
  const cursor = useAppStore((s) => s.cursor)
  const patchUi = useAppStore((s) => s.patchUi)
  const [spec, setSpec] = useState<FindSpec>(() => app.editor.readQuery() ?? EMPTY)
  const [revision, setRevision] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const specRef = useRef<FindSpec>(spec)

  useEffect(() => {
    specRef.current = spec
  }, [spec])

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 30)
    return () => window.clearTimeout(id)
  }, [])

  // Each document has its own search state, so re-apply the query after switching tabs.
  useEffect(() => {
    app.editor.openFind()
    app.editor.setQuery(specRef.current)
  }, [activeId])

  // Match counts are derived from the editor, and recomputed after edits, moves and option changes.
  const stats = useMemo(() => {
    void [revision, cursor.line, cursor.col, cursor.selected, activeId, spec]
    return app.editor.findStats()
  }, [revision, cursor.line, cursor.col, cursor.selected, activeId, spec])

  const apply = (next: FindSpec) => {
    specRef.current = next
    app.editor.setQuery(next)
    setSpec(next)
  }
  const bump = () => setRevision((n) => n + 1)
  const invalid = spec.regexp && spec.search.length > 0 && !new SearchQuery(spec).valid
  const countLabel = invalid ? 'Invalid' : spec.search ? (stats.total ? `${stats.current || '?'}/${stats.total}${stats.capped ? '+' : ''}` : 'None') : ''
  const next = () => {
    app.editor.findNext()
    bump()
  }
  const previous = () => {
    app.editor.findPrevious()
    bump()
  }

  return (
    <div className="v-find" role="search">
      <div className="v-find-row">
        <button
          type="button"
          className="v-find-expand"
          aria-label={replaceOpen ? 'Hide replace' : 'Show replace'}
          aria-expanded={replaceOpen}
          onClick={() => patchUi({ findReplace: !replaceOpen })}
        >
          {replaceOpen ? <ChevronDown size={18} strokeWidth={1.4} /> : <ChevronRight size={18} strokeWidth={1.4} />}
        </button>
        <input
          ref={inputRef}
          className={`v-input ${invalid ? 'is-invalid' : ''}`}
          value={spec.search}
          placeholder="Find"
          aria-label="Find"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(e) => apply({ ...spec, search: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (e.shiftKey) previous()
              else next()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              app.actions.closeFind()
            }
          }}
        />
        <span className="v-find-count" aria-live="polite">{countLabel}</span>
        <IconButton label="Previous match" onClick={previous}><ChevronUp size={19} strokeWidth={1.4} /></IconButton>
        <IconButton label="Next match" onClick={next}><ChevronDown size={19} strokeWidth={1.4} /></IconButton>
        <IconButton label="Close find" onClick={() => app.actions.closeFind()}><X size={19} strokeWidth={1.4} /></IconButton>
      </div>
      <div className="v-find-row v-find-options">
        <button type="button" className={`v-chip ${spec.caseSensitive ? 'is-on' : ''}`} aria-pressed={spec.caseSensitive} onClick={() => apply({ ...spec, caseSensitive: !spec.caseSensitive })}>
          <CaseSensitive size={17} strokeWidth={1.4} /> Case
        </button>
        <button type="button" className={`v-chip ${spec.wholeWord ? 'is-on' : ''}`} aria-pressed={spec.wholeWord} onClick={() => apply({ ...spec, wholeWord: !spec.wholeWord })}>
          <WholeWord size={17} strokeWidth={1.4} /> Word
        </button>
        <button type="button" className={`v-chip ${spec.regexp ? 'is-on' : ''}`} aria-pressed={spec.regexp} onClick={() => apply({ ...spec, regexp: !spec.regexp })}>
          <Regex size={17} strokeWidth={1.4} /> Regex
        </button>
      </div>
      {replaceOpen ? (
        <div className="v-find-row">
          <span className="v-find-indent" />
          <input
            className="v-input"
            value={spec.replace}
            placeholder="Replace with"
            aria-label="Replace with"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => apply({ ...spec, replace: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                app.editor.replaceNext()
                bump()
              }
            }}
          />
          <button type="button" className="v-btn v-btn-sm" onClick={() => { app.editor.replaceNext(); bump() }}>Replace</button>
          <button type="button" className="v-btn v-btn-sm" onClick={() => { app.editor.replaceAll(); bump() }}>All</button>
        </div>
      ) : null}
    </div>
  )
}
