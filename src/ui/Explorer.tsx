import { ChevronDown, ChevronRight, Ellipsis, FilePlus, FolderPlus, HardDrive, RefreshCw, Upload } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { app } from '../app/container'
import type { FsEntry } from '../core/fs/FileSystemProvider'
import { detectLanguage } from '../core/languages/catalog'
import { ROOT } from '../core/util/paths'
import { useAppStore } from '../store/useAppStore'
import { IconButton } from './Controls'
import { FileIcon, FolderIcon } from './FileIcon'

const EMPTY: FsEntry[] = []

function TreeLevel({ dir, depth }: { dir: string; depth: number }) {
  const entries = useAppStore((s) => s.tree[dir]) ?? EMPTY
  return (
    <>
      {entries.map((entry) => (
        <TreeRow key={entry.path} entry={entry} depth={depth} />
      ))}
    </>
  )
}

function TreeRow({ entry, depth }: { entry: FsEntry; depth: number }) {
  const isDir = entry.kind === 'directory'
  const open = useAppStore((s) => !!s.expanded[entry.path])
  const selected = useAppStore((s) => s.selectedPath === entry.path)
  const active = useAppStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId)
    return !!tab && tab.sourceKind === 'workspace' && tab.path === entry.path && !isDir
  })
  const loading = useAppStore((s) => !!s.loadingDirs[entry.path])

  return (
    <>
      <div className={`v-row-tree ${active ? 'is-active' : ''} ${selected && !active ? 'is-selected' : ''}`} style={{ paddingLeft: 8 + depth * 16 }}>
        <button
          type="button"
          className="v-tree-main"
          onClick={() => void app.actions.openEntry(entry)}
          aria-expanded={isDir ? open : undefined}
          aria-current={active ? 'true' : undefined}
        >
          <span className="v-tree-chev" aria-hidden="true">
            {isDir ? open ? <ChevronDown size={15} strokeWidth={1.5} /> : <ChevronRight size={15} strokeWidth={1.5} /> : null}
          </span>
          <span className="v-tree-icon">{isDir ? <FolderIcon open={open} /> : <FileIcon languageId={detectLanguage(entry.name)} />}</span>
          <span className="v-tree-name">{entry.name}</span>
          {loading ? <RefreshCw size={13} strokeWidth={1.5} className="v-spin" /> : null}
        </button>
        <button type="button" className="v-tree-more" aria-label={`Actions for ${entry.name}`} onClick={() => useAppStore.getState().patchUi({ entryMenu: entry })}>
          <Ellipsis size={18} strokeWidth={1.4} />
        </button>
      </div>
      {isDir && open ? <TreeLevel dir={entry.path} depth={depth + 1} /> : null}
    </>
  )
}

export function Explorer() {
  const workspace = useAppStore((s) => s.workspace)
  const rootEntries = useAppStore((s) => s.tree[ROOT])
  const [dragging, setDragging] = useState(false)
  const patchUi = useAppStore((s) => s.patchUi)

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void app.workspace.handleDrop(event.dataTransfer)
  }

  return (
    <div
      className={`v-explorer ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="v-explorer-head">
        <span className="v-eyebrow">Files</span>
        <div className="v-explorer-actions">
          <IconButton label="New file" onClick={() => void app.actions.newFile(ROOT === app.workspace.currentDir() ? undefined : app.workspace.currentDir())}>
            <FilePlus size={19} strokeWidth={1.4} />
          </IconButton>
          <IconButton label="New folder" onClick={() => void app.actions.newFolder()}>
            <FolderPlus size={19} strokeWidth={1.4} />
          </IconButton>
          <IconButton label="Import files" onClick={() => document.getElementById('kalyxis-import-files')?.click()}>
            <Upload size={19} strokeWidth={1.4} />
          </IconButton>
          <IconButton label="More file actions" onClick={() => patchUi({ explorerMenuOpen: true })}>
            <Ellipsis size={19} strokeWidth={1.4} />
          </IconButton>
        </div>
      </div>

      <button type="button" className="v-root" onClick={() => app.workspace.select(null)}>
        <HardDrive size={16} strokeWidth={1.4} aria-hidden />
        <span className="v-root-name">{workspace.kind === 'local' ? 'Workspace' : workspace.rootName}</span>
        <span className="v-tag">{workspace.kind === 'local' ? 'On device' : 'Disk'}</span>
      </button>

      <div className="v-tree" role="tree" aria-label="Files">
        {rootEntries && rootEntries.length === 0 ? (
          <div className="v-empty-small">
            <p>This folder is empty.</p>
            <button type="button" className="v-btn" onClick={() => void app.actions.newFile()}>
              <FilePlus size={16} strokeWidth={1.4} /> New file
            </button>
          </div>
        ) : (
          <TreeLevel dir={ROOT} depth={0} />
        )}
      </div>

      <p className="v-explorer-foot">
        {workspace.kind === 'local' ? 'Stored privately in this browser. Export a zip to keep a backup.' : 'Edits are written straight to the folder on disk.'}
      </p>
    </div>
  )
}
