import { FilePlus, FolderOpen, Sparkles, Terminal, Upload, Command } from 'lucide-react'
import { app } from '../app/container'
import { Platform } from '../core/util/platform'
import { shortcutLabel } from '../core/services/ShortcutService'
import { useAppStore } from '../store/useAppStore'
import { Logo } from './Logo'

export function Welcome() {
  const lastFolder = useAppStore((s) => s.lastFolderName)
  const workspaceKind = useAppStore((s) => s.workspace.kind)
  return (
    <div className="v-welcome">
      <div className="v-welcome-inner">
        <div className="v-welcome-mark"><Logo size={72} /></div>
        <h1>Kalyxis</h1>
        <p className="v-welcome-tag">A quiet place to write code, on any screen.</p>
        <div className="v-welcome-actions">
          <button type="button" className="v-btn v-btn-primary" onClick={() => void app.actions.newFile()}>
            <FilePlus size={17} strokeWidth={1.4} /> New file
          </button>
          <button type="button" className="v-btn" onClick={() => useAppStore.getState().patchUi({ examplesOpen: true })}>
            <Sparkles size={17} strokeWidth={1.4} /> Start from an example
          </button>
          <button type="button" className="v-btn" onClick={() => useAppStore.getState().patchUi({ terminalOpen: true })}>
            <Terminal size={17} strokeWidth={1.4} /> Terminal
          </button>
          <button type="button" className="v-btn" onClick={() => app.actions.openFromDevice()}>
            <Upload size={17} strokeWidth={1.4} /> Open files
          </button>
          {Platform.canPickDirectory ? (
            <button type="button" className="v-btn" onClick={() => void app.actions.openFolder()}>
              <FolderOpen size={17} strokeWidth={1.4} /> Open folder
            </button>
          ) : null}
          {Platform.canPickDirectory && lastFolder && workspaceKind === 'local' ? (
            <button type="button" className="v-btn" onClick={() => void app.workspace.reopenLastFolder()}>
              <FolderOpen size={17} strokeWidth={1.4} /> Reopen {lastFolder}
            </button>
          ) : null}
        </div>
        <button type="button" className="v-welcome-hint" onClick={() => app.actions.openPalette('all')}>
          <Command size={14} strokeWidth={1.4} /> Command palette <kbd>{shortcutLabel('Mod+Shift+KeyP')}</kbd>
        </button>
      </div>
    </div>
  )
}
