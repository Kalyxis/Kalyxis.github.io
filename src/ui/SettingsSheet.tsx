import { app } from '../app/container'
import { Platform } from '../core/util/platform'
import { useAppStore } from '../store/useAppStore'
import { Segmented, Stepper, Toggle } from './Controls'
import { Sheet } from './Sheet'

export function SettingsSheet() {
  const open = useAppStore((s) => s.ui.settingsOpen)
  const settings = useAppStore((s) => s.settings)
  const close = () => useAppStore.getState().patchUi({ settingsOpen: false })
  const set = app.settings.update.bind(app.settings)

  return (
    <Sheet open={open} title="Settings" onClose={close} size="lg">
      <section className="v-group">
        <h3 className="v-eyebrow">Appearance</h3>
        <div className="v-row">
          <span className="v-row-text"><span className="v-row-title">Theme</span><span className="v-row-hint">Dusk is dark, Vellum is light.</span></span>
          <Segmented
            label="Theme"
            value={settings.theme}
            options={[{ value: 'dark', label: 'Dusk' }, { value: 'light', label: 'Vellum' }, { value: 'system', label: 'Auto' }]}
            onChange={(theme) => set({ theme })}
          />
        </div>
        <Stepper label="Font size" value={settings.fontSize} min={11} max={26} unit=" px" onChange={(fontSize) => set({ fontSize })} />
      </section>

      <section className="v-group">
        <h3 className="v-eyebrow">Editor</h3>
        <div className="v-row">
          <span className="v-row-text"><span className="v-row-title">Indent size</span></span>
          <Segmented label="Indent size" value={settings.tabSize} options={[{ value: 2, label: '2' }, { value: 4, label: '4' }, { value: 8, label: '8' }]} onChange={(tabSize) => set({ tabSize })} />
        </div>
        <Toggle label="Indent with tabs" hint="Insert a tab character instead of spaces." checked={settings.useTabs} onChange={(useTabs) => set({ useTabs })} />
        <Toggle label="Word wrap" checked={settings.wordWrap} onChange={(wordWrap) => set({ wordWrap })} />
        <Toggle label="Line numbers" checked={settings.lineNumbers} onChange={(lineNumbers) => set({ lineNumbers })} />
        <Toggle label="Fold gutter" hint="Collapse blocks of code." checked={settings.foldGutter} onChange={(foldGutter) => set({ foldGutter })} />
        <Toggle label="Highlight current line" checked={settings.activeLine} onChange={(activeLine) => set({ activeLine })} />
        <Toggle label="Colored brackets" checked={settings.rainbowBrackets} onChange={(rainbowBrackets) => set({ rainbowBrackets })} />
        <Toggle label="Auto close brackets and tags" hint="Typing ( adds ) and typing a tag adds its closing tag." checked={settings.autoClose} onChange={(autoClose) => set({ autoClose })} />
        <Toggle label="Autocomplete" checked={settings.autocomplete} onChange={(autocomplete) => set({ autocomplete })} />
        <Toggle label="Syntax checking" hint="Underline parse errors as you type." checked={settings.syntaxCheck} onChange={(syntaxCheck) => set({ syntaxCheck })} />
        <Toggle label="Show whitespace" checked={settings.showWhitespace} onChange={(showWhitespace) => set({ showWhitespace })} />
        {Platform.isTouch ? <Toggle label="Key bar above the keyboard" hint="Brackets, Tab, undo and cursor keys." checked={settings.keyBar} onChange={(keyBar) => set({ keyBar })} /> : null}
      </section>

      <section className="v-group">
        <h3 className="v-eyebrow">Files and running</h3>
        <Toggle label="Auto save" hint="Save shortly after you stop typing and when the app is hidden." checked={settings.autoSave} onChange={(autoSave) => set({ autoSave })} />
        <div className="v-row">
          <span className="v-row-text"><span className="v-row-title">Run time limit</span><span className="v-row-hint">Long running programs are stopped.</span></span>
          <Segmented label="Run time limit" value={settings.runTimeoutSec} options={[{ value: 10, label: '10s' }, { value: 30, label: '30s' }, { value: 60, label: '60s' }]} onChange={(runTimeoutSec) => set({ runTimeoutSec })} />
        </div>
      </section>

      <section className="v-group">
        <h3 className="v-eyebrow">About</h3>
        <p className="v-about">Kalyxis 1.0. Python runs with Pyodide, JavaScript runs in a worker, and everything stays on this device.</p>
      </section>
    </Sheet>
  )
}
