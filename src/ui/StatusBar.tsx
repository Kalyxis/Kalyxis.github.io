import { TriangleAlert } from 'lucide-react'
import { app } from '../app/container'
import { getLanguageInfo } from '../core/languages/catalog'
import { activeTabSelector, useAppStore } from '../store/useAppStore'

export function StatusBar() {
  const tab = useAppStore(activeTabSelector)
  const cursor = useAppStore((s) => s.cursor)
  const tabSize = useAppStore((s) => s.settings.tabSize)
  const useTabs = useAppStore((s) => s.settings.useTabs)
  const problems = useAppStore((s) => s.problems)
  const patchUi = useAppStore((s) => s.patchUi)

  return (
    <footer className="v-statusbar">
      {tab ? (
        <>
          <span className="v-status-item">
            Ln {cursor.line}, Col {cursor.col}
            {cursor.selected > 0 ? ` (${cursor.selected} selected)` : ''}
          </span>
          <button type="button" className="v-status-item v-status-btn" onClick={() => patchUi({ languageSheetOpen: true })} aria-label="Change language">
            {getLanguageInfo(tab.languageId).label}
          </button>
          <span className="v-status-spacer" />
          {problems.length > 0 ? (
            <button type="button" className="v-status-item v-status-btn v-status-warn" onClick={() => app.actions.openPanel('problems')} aria-label={`${problems.length} problems`}>
              <TriangleAlert size={13} strokeWidth={1.6} /> {problems.length}
            </button>
          ) : null}
          <span className="v-status-item v-status-hide-narrow">{useTabs ? 'Tabs' : `Spaces: ${tabSize}`}</span>
          <button type="button" className="v-status-item v-status-btn" onClick={() => app.actions.toggleEol()} aria-label="Toggle line endings">
            {tab.eol}
          </button>
          <span className={`v-status-item v-status-save ${tab.dirty ? 'is-dirty' : ''}`}>{tab.untitled ? 'Unsaved' : tab.dirty ? 'Editing' : 'Saved'}</span>
        </>
      ) : (
        <span className="v-status-item">Ready</span>
      )}
    </footer>
  )
}
