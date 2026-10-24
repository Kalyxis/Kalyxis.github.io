import { Check, FilePlus, FolderInput, FolderOpen, FolderPlus, HardDrive, RefreshCw, Sparkles, Trash2, Upload, Copy, Pencil, FileText, FileArchive, Share2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { app } from '../app/container'
import { getLanguageInfo, LANGUAGES, type LanguageId } from '../core/languages/catalog'
import { EXAMPLES } from '../core/templates/examples'
import { Platform } from '../core/util/platform'
import { activeTabSelector, useAppStore } from '../store/useAppStore'
import { FileIcon } from './FileIcon'
import { Sheet } from './Sheet'

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  hint?: string
  danger?: boolean
  onClick: () => void
}

function MenuItem({ icon, label, hint, danger, onClick }: MenuItemProps) {
  return (
    <button type="button" className={`v-menu-item ${danger ? 'is-danger' : ''}`} onClick={onClick}>
      <span className="v-menu-icon">{icon}</span>
      <span className="v-menu-text">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </span>
    </button>
  )
}

const icon = { size: 19, strokeWidth: 1.4 }

/** Menu behind the plus button in the tab bar. */
export function NewMenu() {
  const open = useAppStore((s) => s.ui.newMenuOpen)
  const patchUi = useAppStore((s) => s.patchUi)
  const close = () => patchUi({ newMenuOpen: false })
  const run = (fn: () => void) => () => {
    close()
    window.setTimeout(fn, 30)
  }
  return (
    <Sheet open={open} title="New" onClose={close} size="sm">
      <MenuItem icon={<FilePlus {...icon} />} label="New file" hint="Create a file in the current folder" onClick={run(() => void app.actions.newFile())} />
      <MenuItem icon={<FileText {...icon} />} label="Scratch buffer" hint="A temporary file you can save later" onClick={run(() => app.actions.newScratch())} />
      <MenuItem icon={<Sparkles {...icon} />} label="From an example" hint="Python, JavaScript and HTML starters" onClick={run(() => patchUi({ examplesOpen: true }))} />
      <MenuItem icon={<Upload {...icon} />} label="Import files" hint="Pick files or a zip from your device" onClick={run(() => document.getElementById('kalyxis-import-files')?.click())} />
      {typeof window.showOpenFilePicker === 'function' ? (
        <MenuItem icon={<FolderOpen {...icon} />} label="Open file from disk" onClick={run(() => void app.documents.openWithPicker())} />
      ) : null}
    </Sheet>
  )
}

/** Actions for one file or folder in the explorer. */
export function EntryMenu() {
  const entry = useAppStore((s) => s.ui.entryMenu)
  const patchUi = useAppStore((s) => s.patchUi)
  const close = () => patchUi({ entryMenu: null })
  if (!entry) return null
  const isDir = entry.kind === 'directory'
  const run = (fn: () => void) => () => {
    close()
    window.setTimeout(fn, 30)
  }
  return (
    <Sheet open title={entry.name} onClose={close} size="sm">
      {isDir ? (
        <>
          <MenuItem icon={<FilePlus {...icon} />} label="New file here" onClick={run(() => void app.actions.newFile(entry.path))} />
          <MenuItem icon={<FolderPlus {...icon} />} label="New folder here" onClick={run(() => void app.actions.newFolder(entry.path))} />
        </>
      ) : (
        <>
          <MenuItem icon={<FolderOpen {...icon} />} label="Open" onClick={run(() => void app.actions.openEntry(entry))} />
          <MenuItem icon={<Share2 {...icon} />} label="Export or share" hint="Save a copy to your device" onClick={run(() => void app.workspace.downloadFile(entry))} />
        </>
      )}
      <MenuItem icon={<Pencil {...icon} />} label="Rename" onClick={run(() => void app.workspace.promptRename(entry))} />
      <MenuItem icon={<Copy {...icon} />} label="Duplicate" onClick={run(() => void app.workspace.duplicate(entry))} />
      <MenuItem icon={<Trash2 {...icon} />} label="Delete" danger onClick={run(() => void app.workspace.promptRemove(entry))} />
    </Sheet>
  )
}

/** Workspace level actions behind the dots button in the explorer header. */
export function ExplorerMenu() {
  const open = useAppStore((s) => s.ui.explorerMenuOpen)
  const workspace = useAppStore((s) => s.workspace)
  const lastFolder = useAppStore((s) => s.lastFolderName)
  const patchUi = useAppStore((s) => s.patchUi)
  const close = () => patchUi({ explorerMenuOpen: false })
  const run = (fn: () => void) => () => {
    close()
    window.setTimeout(fn, 30)
  }
  return (
    <Sheet open={open} title="Workspace" onClose={close} size="sm">
      <MenuItem icon={<RefreshCw {...icon} />} label="Refresh" onClick={run(() => void app.workspace.refresh())} />
      <MenuItem icon={<FileArchive {...icon} />} label="Export workspace as zip" hint="A backup you can keep in Files or Drive" onClick={run(() => void app.workspace.exportWorkspace())} />
      <MenuItem icon={<FolderInput {...icon} />} label="Import a folder" hint="Copies a whole folder into this workspace" onClick={run(() => document.getElementById('kalyxis-import-folder')?.click())} />
      {Platform.canPickDirectory ? (
        <MenuItem icon={<FolderOpen {...icon} />} label="Open folder from disk" hint="Edit files in place" onClick={run(() => void app.actions.openFolder())} />
      ) : null}
      {Platform.canPickDirectory && lastFolder && workspace.kind === 'local' ? (
        <MenuItem icon={<FolderOpen {...icon} />} label={`Reopen ${lastFolder}`} onClick={run(() => void app.workspace.reopenLastFolder())} />
      ) : null}
      {workspace.kind === 'disk' ? (
        <MenuItem icon={<HardDrive {...icon} />} label="Back to on device storage" onClick={run(() => void app.workspace.useLocal())} />
      ) : null}
    </Sheet>
  )
}

export function ExamplesSheet() {
  const open = useAppStore((s) => s.ui.examplesOpen)
  const close = () => useAppStore.getState().patchUi({ examplesOpen: false })
  const groups = useMemo(() => {
    const order: { id: LanguageId; label: string }[] = [
      { id: 'python', label: 'Python' },
      { id: 'javascript', label: 'JavaScript' },
      { id: 'html', label: 'HTML' },
      { id: 'plaintext', label: 'Other' },
    ]
    return order.map((g) => ({ ...g, items: EXAMPLES.filter((e) => e.languageId === g.id) })).filter((g) => g.items.length)
  }, [])
  return (
    <Sheet open={open} title="Start from an example" onClose={close} size="lg">
      {groups.map((group) => (
        <section key={group.id} className="v-group">
          <h3 className="v-eyebrow">{group.label}</h3>
          {group.items.map((example) => (
            <button key={example.id} type="button" className="v-menu-item" onClick={() => void app.actions.createFromExample(example)}>
              <span className="v-menu-icon"><FileIcon languageId={example.languageId} size={19} /></span>
              <span className="v-menu-text">
                <span>{example.title}</span>
                <small>{example.blurb}</small>
              </span>
            </button>
          ))}
        </section>
      ))}
    </Sheet>
  )
}

export function LanguageSheet() {
  const open = useAppStore((s) => s.ui.languageSheetOpen)
  const tab = useAppStore(activeTabSelector)
  const [query, setQuery] = useState('')
  const close = () => {
    useAppStore.getState().patchUi({ languageSheetOpen: false })
    setQuery('')
  }
  const list = LANGUAGES.filter((l) => !query || l.label.toLowerCase().includes(query.toLowerCase()) || l.id.includes(query.toLowerCase()))
  const session = tab ? app.documents.byId(tab.id) : undefined
  const overridden = session?.languageOverrideId ?? null
  return (
    <Sheet open={open && !!tab} title="Language mode" onClose={close} size="md">
      <div className="v-palette-input">
        <Search size={18} strokeWidth={1.4} aria-hidden />
        <input className="v-input v-input-bare" value={query} placeholder="Search languages" aria-label="Search languages" autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="v-palette-list">
        {tab ? (
          <button type="button" className="v-menu-item" onClick={() => { app.documents.setLanguage(tab.id, null); close() }}>
            <span className="v-menu-icon">{overridden === null ? <Check size={18} strokeWidth={1.6} /> : null}</span>
            <span className="v-menu-text"><span>Detect from file name</span></span>
          </button>
        ) : null}
        {list.map((l) => (
          <button key={l.id} type="button" className="v-menu-item" onClick={() => { if (tab) app.documents.setLanguage(tab.id, l.id); close() }}>
            <span className="v-menu-icon">{tab && tab.languageId === l.id ? <Check size={18} strokeWidth={1.6} /> : null}</span>
            <span className="v-menu-text"><span>{getLanguageInfo(l.id).label}</span></span>
            <span className="v-palette-hint">{l.badge}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

