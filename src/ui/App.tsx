import { useEffect, useRef, useState } from 'react'
import { app, boot } from '../app/container'
import { Platform } from '../core/util/platform'
import { useAppStore } from '../store/useAppStore'
import { AccessoryBar } from './AccessoryBar'
import { AppBar } from './AppBar'
import { BottomPanel } from './BottomPanel'
import { DialogHost } from './DialogHost'
import { EditorHost } from './EditorHost'
import { Explorer } from './Explorer'
import { FindBar } from './FindBar'
import { InstallBanner } from './InstallBanner'
import { Palette } from './Palette'
import { SettingsSheet } from './SettingsSheet'
import { EntryMenu, ExamplesSheet, ExplorerMenu, LanguageSheet, NewMenu } from './Sheets'
import { StatusBar } from './StatusBar'
import { TabBar } from './TabBar'
import { ToastHost } from './ToastHost'
import { Welcome } from './Welcome'

function useHeight(ref: React.RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => setHeight(el.clientHeight))
    observer.observe(el)
    setHeight(el.clientHeight)
    return () => observer.disconnect()
  }, [ref])
  return height
}

export function App() {
  const [ready, setReady] = useState(false)
  const wide = useAppStore((s) => s.ui.wide)
  const sidebarOpen = useAppStore((s) => s.ui.sidebarOpen)
  const focused = useAppStore((s) => s.ui.editorFocused)
  const keyboardOpen = useAppStore((s) => s.ui.keyboardOpen)
  const keyBar = useAppStore((s) => s.settings.keyBar)
  const hasTabs = useAppStore((s) => s.tabs.length > 0)
  const previewFull = useAppStore((s) => s.ui.previewFullscreen)
  const patchUi = useAppStore((s) => s.patchUi)
  const mainRef = useRef<HTMLElement>(null)
  const mainHeight = useHeight(mainRef)

  useEffect(() => {
    void boot().finally(() => {
      setReady(true)
      document.getElementById('boot')?.remove()
    })
  }, [])

  const touch = Platform.isTouch
  const showKeys = touch && keyBar && focused && hasTabs
  const editing = touch && focused && keyboardOpen && !wide

  return (
    <div className={`v-app ${wide ? 'is-wide' : 'is-narrow'} ${editing ? 'is-editing' : ''} ${ready ? 'is-ready' : ''}`}>
      <AppBar />
      <div className="v-body">
        <aside className={`v-sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label="File explorer" aria-hidden={!sidebarOpen}>
          <Explorer />
        </aside>
        {!wide && sidebarOpen ? <div className="v-scrim v-scrim-drawer" onClick={() => patchUi({ sidebarOpen: false })} aria-hidden="true" /> : null}
        <main className="v-main" ref={mainRef}>
          <TabBar />
          <FindBar />
          <div className="v-editor-wrap">
            <EditorHost hidden={!hasTabs} />
            {!hasTabs && ready ? <Welcome /> : null}
          </div>
          {!editing && hasTabs ? <BottomPanel containerHeight={mainHeight} /> : null}
        </main>
      </div>
      {showKeys ? <AccessoryBar /> : !editing ? <StatusBar /> : null}

      <Palette />
      <SettingsSheet />
      <NewMenu />
      <EntryMenu />
      <ExplorerMenu />
      <ExamplesSheet />
      <LanguageSheet />
      <DialogHost />
      <ToastHost />
      {!previewFull ? <InstallBanner /> : null}

      <input
        id="kalyxis-import-files"
        className="v-visually-hidden"
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          void app.actions.importFiles(files)
        }}
      />
      <input
        id="kalyxis-import-folder"
        className="v-visually-hidden"
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        {...({ webkitdirectory: '' } as Record<string, string>)}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          void app.actions.importFolder(files)
        }}
      />
    </div>
  )
}
