import { Plus, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { app } from '../app/container'
import { useAppStore } from '../store/useAppStore'

export function TabBar() {
  const tabs = useAppStore((s) => s.tabs)
  const activeId = useAppStore((s) => s.activeTabId)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [activeId, tabs.length])

  return (
    <div className="v-tabbar">
      <div className="v-tabs" role="tablist" aria-label="Open files" ref={listRef}>
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              className={`v-tab ${active ? 'is-active' : ''}`}
              onClick={() => app.documents.activate(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) void app.actions.closeTab(tab.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  app.documents.activate(tab.id)
                }
              }}
              title={tab.path}
            >
              <span className="v-tab-name">{tab.name}</span>
              <button
                type="button"
                className="v-tab-close"
                aria-label={`Close ${tab.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  void app.actions.closeTab(tab.id)
                }}
              >
                {tab.dirty ? <span className="v-dirty" /> : <X size={14} strokeWidth={1.6} />}
              </button>
            </div>
          )
        })}
      </div>
      <button type="button" className="v-tab-new" aria-label="New tab" onClick={() => useAppStore.getState().patchUi({ newMenuOpen: true })}>
        <Plus size={20} strokeWidth={1.4} />
      </button>
    </div>
  )
}
