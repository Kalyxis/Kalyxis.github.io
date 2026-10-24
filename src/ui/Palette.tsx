import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { app } from '../app/container'
import { detectLanguage } from '../core/languages/catalog'
import type { AppCommand } from '../core/services/CommandRegistry'
import { shortcutLabel } from '../core/services/ShortcutService'
import { dirname, basename } from '../core/util/paths'
import { fuzzyScore } from '../core/util/text'
import { useAppStore } from '../store/useAppStore'
import { FileIcon } from './FileIcon'
import { Sheet } from './Sheet'

type Item =
  | { type: 'command'; key: string; title: string; hint: string; command: AppCommand; score: number }
  | { type: 'file'; key: string; title: string; hint: string; path: string; score: number }

const FILE_LIMIT = 1500

export function Palette() {
  const open = useAppStore((s) => s.ui.paletteOpen)
  const patchUi = useAppStore((s) => s.patchUi)
  const close = () => patchUi({ paletteOpen: false })
  return (
    <Sheet open={open} title="Command palette" onClose={close} size="lg" hideHeader>
      <PaletteBody close={close} />
    </Sheet>
  )
}

/** Mounted only while the palette is open, so its query and selection start fresh every time. */
function PaletteBody({ close }: { close: () => void }) {
  const mode = useAppStore((s) => s.ui.paletteMode)
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const collected: string[] = []
    void app.workspace.provider
      .walkFiles('/', (entry) => {
        if (collected.length < FILE_LIMIT && !app.workspace.provider.isIgnored(entry.name)) collected.push(entry.path)
      })
      .then(() => {
        if (!cancelled) setFiles(collected)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const items = useMemo<Item[]>(() => {
    const q = query.trim()
    const commandMode = q.startsWith('>')
    const needle = commandMode ? q.slice(1).trim() : q
    const out: Item[] = []
    if (mode === 'all' || commandMode) {
      for (const command of app.commands.list()) {
        const score = fuzzyScore(needle, `${command.category} ${command.title} ${command.keywords ?? ''}`)
        if (score < 0) continue
        out.push({ type: 'command', key: `c:${command.id}`, title: command.title, hint: command.shortcut ? shortcutLabel(command.shortcut) : command.category, command, score: score + 1 })
      }
    }
    if (!commandMode) {
      const openPaths = new Set(app.documents.all.map((d) => d.path))
      for (const path of files) {
        const score = fuzzyScore(needle, path.slice(1))
        if (score < 0) continue
        out.push({ type: 'file', key: `f:${path}`, title: basename(path), hint: dirname(path) === '/' ? '' : dirname(path).slice(1), path, score: score + (openPaths.has(path) ? 2 : 0) })
      }
    }
    out.sort((a, b) => b.score - a.score)
    return out.slice(0, 80)
  }, [query, mode, files])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const choose = (item: Item | undefined) => {
    if (!item) return
    close()
    if (item.type === 'command') {
      // Wait a frame so the sheet is gone before the command moves focus.
      window.setTimeout(() => void app.commands.execute(item.command.id), 30)
    } else {
      void app.actions.openEntry({ name: item.title, path: item.path, kind: 'file' })
    }
  }

  return (
    <>
      <div className="v-palette-input">
        <Search size={18} strokeWidth={1.4} aria-hidden />
        <input
          autoFocus
          className="v-input v-input-bare"
          value={query}
          placeholder={mode === 'files' ? 'Go to file' : 'Search commands and files'}
          aria-label="Search commands and files"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(items.length - 1, i + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(0, i - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(items[index])
            }
          }}
        />
      </div>
      <div className="v-palette-list" ref={listRef} role="listbox">
        {items.length === 0 ? <div className="v-empty-small"><p>Nothing matches "{query}".</p></div> : null}
        {items.map((item, i) => (
          <button
            key={item.key}
            type="button"
            role="option"
            aria-selected={i === index}
            data-index={i}
            className={`v-palette-item ${i === index ? 'is-active' : ''}`}
            onMouseMove={() => setIndex(i)}
            onClick={() => choose(item)}
          >
            {item.type === 'file' ? <FileIcon languageId={detectLanguage(item.title)} size={17} /> : <span className="v-palette-glyph">&gt;</span>}
            <span className="v-palette-title">{item.title}</span>
            <span className="v-palette-hint">{item.hint}</span>
          </button>
        ))}
      </div>
    </>
  )
}
