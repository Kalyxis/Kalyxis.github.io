import { Command, Loader, Menu, Play, Save, Settings as SettingsIcon, Square } from 'lucide-react'
import { app } from '../app/container'
import { getLanguageInfo } from '../core/languages/catalog'
import { dirname } from '../core/util/paths'
import { shortcutLabel } from '../core/services/ShortcutService'
import { activeTabSelector, useAppStore } from '../store/useAppStore'
import { IconButton } from './Controls'
import { Logo } from './Logo'

export function AppBar() {
  const tab = useAppStore(activeTabSelector)
  const wide = useAppStore((s) => s.ui.wide)
  const sidebarOpen = useAppStore((s) => s.ui.sidebarOpen)
  const status = useAppStore((s) => s.run.status)
  const runtime = useAppStore((s) => s.run.runtime)
  const runner = tab ? app.runners.forLanguage(tab.languageId) : null
  const running = status === 'running'
  const starting = running && runtime === 'loading'

  const subtitle = tab
    ? tab.untitled
      ? `Scratch buffer · ${getLanguageInfo(tab.languageId).label}`
      : `${tab.sourceKind === 'workspace' ? (dirname(tab.path) === '/' ? 'Workspace' : dirname(tab.path).slice(1)) : tab.path} · ${getLanguageInfo(tab.languageId).label}`
    : 'No file open'

  return (
    <header className="v-appbar">
      <IconButton label={sidebarOpen ? 'Hide files' : 'Show files'} active={sidebarOpen && wide} onClick={() => app.actions.toggleSidebar()}>
        <Menu size={20} strokeWidth={1.4} />
      </IconButton>
      <div className="v-brand" aria-hidden={!wide}>
        <Logo size={22} />
        <span>Kalyxis</span>
      </div>
      <div className="v-title">
        <div className="v-title-main">
          <span className="v-title-name">{tab ? tab.name : 'Kalyxis'}</span>
          {tab?.dirty ? <span className="v-dirty" title="Unsaved changes" aria-label="Unsaved changes" /> : null}
        </div>
        <div className="v-title-sub">{subtitle}</div>
      </div>
      <div className="v-appbar-actions">
        {wide && tab ? (
          <IconButton label={`Save (${shortcutLabel('Mod+KeyS')})`} onClick={() => void app.documents.save()} disabled={!tab.dirty && !tab.untitled}>
            <Save size={19} strokeWidth={1.4} />
          </IconButton>
        ) : null}
        <button
          type="button"
          className={`v-run ${running ? 'is-stop' : ''}`}
          disabled={!running && !runner}
          onClick={() => (running ? app.actions.stop() : void app.actions.run())}
          aria-label={running ? 'Stop' : 'Run'}
          title={runner ? (running ? 'Stop' : `Run ${runner.label} (${shortcutLabel('Mod+Shift+Enter')})`) : 'Run works with Python, JavaScript and HTML files'}
        >
          {starting ? <Loader size={16} strokeWidth={1.6} className="v-spin" /> : running ? <Square size={14} strokeWidth={1.6} fill="currentColor" /> : <Play size={15} strokeWidth={1.6} fill="currentColor" />}
          <span>{starting ? 'Loading' : running ? 'Stop' : 'Run'}</span>
        </button>
        <IconButton label={`Commands (${shortcutLabel('Mod+Shift+KeyP')})`} onClick={() => app.actions.openPalette('all')}>
          <Command size={19} strokeWidth={1.4} />
        </IconButton>
        {wide ? (
          <IconButton label="Settings" onClick={() => useAppStore.getState().patchUi({ settingsOpen: true })}>
            <SettingsIcon size={19} strokeWidth={1.4} />
          </IconButton>
        ) : null}
      </div>
    </header>
  )
}
