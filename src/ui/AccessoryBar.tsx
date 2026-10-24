import {
  ArrowDown, ArrowLeft, ArrowLeftToLine, ArrowRight, ArrowRightToLine, ArrowUp, ChevronDown, ChevronLeft, CopyPlus, CornerDownLeft,
  Hash, IndentDecrease, MoveDown, MoveUp, Play, Redo2, Search, Square, TextSelect, Trash2, Undo2, Wrench,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { app } from '../app/container'
import type { Direction, EditorCommandId } from '../core/editor/EditorController'
import { useAppStore } from '../store/useAppStore'
import '../styles/terminal.css'

const SYMBOLS = ['=', '(', ')', ':', '"', "'", '[', ']', '{', '}', ',', '.', '+', '-', '*', '/', '%', '#', '<', '>', '_', '!', '&', '|', '\\', ';', '`', '?', '$', '@', '~', '^']

/** Keeps the editor focused (and the keyboard open) when a key is pressed. */
const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault()

/** What the on screen keys act on. The main editor and the terminal editor both provide this. */
export interface KeyTarget {
  insertText(text: string): void
  exec(id: EditorCommandId): unknown
  move(direction: Direction, extend: boolean): void
  find(): void
  blur(): void
}

export interface RunKey {
  running: boolean
  onRun: () => void
  onStop: () => void
}

interface KeyProps {
  label: string
  onPress: () => void
  children: ReactNode
  wide?: boolean
  accent?: boolean
  active?: boolean
  repeat?: boolean
}

/** One key. With `repeat`, holding it repeats the action, which makes cursor keys practical. */
function Key({ label, onPress, children, wide, accent, active, repeat }: KeyProps) {
  const timers = useRef<{ start: number; tick: number }>({ start: 0, tick: 0 })
  const repeated = useRef(false)
  const stop = () => {
    window.clearTimeout(timers.current.start)
    window.clearInterval(timers.current.tick)
  }
  useEffect(() => stop, [])

  return (
    <button
      type="button"
      className={`v-key ${wide ? 'v-key-wide' : ''} ${accent ? 'v-key-accent' : ''} ${active ? 'is-active' : ''}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={keepFocus}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={
        repeat
          ? () => {
              repeated.current = false
              stop()
              timers.current.start = window.setTimeout(() => {
                repeated.current = true
                onPress()
                timers.current.tick = window.setInterval(onPress, 70)
              }, 380)
            }
          : undefined
      }
      onPointerUp={repeat ? stop : undefined}
      onPointerCancel={repeat ? stop : undefined}
      onPointerLeave={repeat ? stop : undefined}
      onClick={() => {
        if (repeat && repeated.current) {
          repeated.current = false
          return
        }
        onPress()
      }}
    >
      {children}
    </button>
  )
}

const mainTarget: KeyTarget = {
  insertText: (t) => app.editor.insertText(t),
  exec: (id) => app.editor.exec(id),
  move: (d, extend) => app.editor.move(d, extend),
  find: () => app.actions.openFind(false),
  blur: () => app.editor.blur(),
}

const ICON = { size: 18, strokeWidth: 1.4 }

/**
 * One slim row glued above the keyboard.
 * The Tools page opens first, ordered by what phone coders reach for most: Ctrl+Enter for a new line below,
 * Tab, undo, cursor keys, find, comment and line operations. The Symbols page holds the punctuation that
 * lives two taps deep on the phone keyboard. Run and Hide keyboard stay pinned on the right.
 */
export function AccessoryBar({ target = mainTarget, run }: { target?: KeyTarget; run?: RunKey | null }) {
  const [page, setPage] = useState<'tools' | 'symbols'>('tools')
  const [selecting, setSelecting] = useState(false)
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const mainRunnable = tab ? app.runners.forLanguage(tab.languageId) !== null : false
  const exec = (id: EditorCommandId) => () => void target.exec(id)
  const move = (direction: Direction) => () => target.move(direction, selecting)

  const runKey: RunKey | null = run ?? (mainRunnable ? { running: false, onRun: () => void app.actions.run(), onStop: () => app.actions.stop() } : null)

  return (
    <div className="v-accessory" role="toolbar" aria-label={page === 'tools' ? 'Editor tools' : 'Code symbols'}>
      <div className="v-accessory-scroll" key={page}>
        {page === 'tools' ? (
          <>
            <Key label="New line below (Ctrl+Enter)" wide accent onPress={exec('insertBlankLine')}>
              <span className="v-key-combo">Ctrl+<CornerDownLeft {...ICON} size={15} /></span>
            </Key>
            <Key label="Tab: indent" wide accent onPress={exec('tab')}>Tab</Key>
            <Key label="Undo" repeat onPress={exec('undo')}><Undo2 {...ICON} /></Key>
            <Key label="Cursor left" repeat onPress={move('left')}><ArrowLeft {...ICON} /></Key>
            <Key label="Cursor right" repeat onPress={move('right')}><ArrowRight {...ICON} /></Key>
            <Key label="Find" onPress={() => target.find()}><Search {...ICON} /></Key>
            <Key label="Comment or uncomment line" onPress={exec('toggleComment')}><Hash {...ICON} /></Key>
            <Key label="Outdent" onPress={exec('indentLess')}><IndentDecrease {...ICON} /></Key>
            <Key label="Redo" repeat onPress={exec('redo')}><Redo2 {...ICON} /></Key>
            <Key label="Duplicate line" onPress={exec('duplicateLine')}><CopyPlus {...ICON} /></Key>
            <Key label="Delete line" onPress={exec('deleteLine')}><Trash2 {...ICON} /></Key>
            <Key label="Move line up" repeat onPress={exec('moveLineUp')}><MoveUp {...ICON} /></Key>
            <Key label="Move line down" repeat onPress={exec('moveLineDown')}><MoveDown {...ICON} /></Key>
            <Key label="Select line" onPress={exec('selectLine')}><TextSelect {...ICON} /></Key>
            <Key label="Go to start of line" onPress={exec('cursorLineStart')}><ArrowLeftToLine {...ICON} /></Key>
            <Key label="Go to end of line" onPress={exec('cursorLineEnd')}><ArrowRightToLine {...ICON} /></Key>
            <span className="v-key-sep" />
            <Key label="Cursor up" repeat onPress={move('up')}><ArrowUp {...ICON} /></Key>
            <Key label="Cursor down" repeat onPress={move('down')}><ArrowDown {...ICON} /></Key>
            <Key label="Extend selection with cursor keys" active={selecting} onPress={() => setSelecting((v) => !v)}><TextSelect {...ICON} /></Key>
            <Key label="Show code symbols" wide onPress={() => setPage('symbols')}><span className="v-key-sym">( )</span></Key>
          </>
        ) : (
          <>
            <Key label="Back to editor tools" wide accent onPress={() => setPage('tools')}><span className="v-key-combo"><ChevronLeft size={16} strokeWidth={1.4} /><Wrench size={15} strokeWidth={1.4} /></span></Key>
            {SYMBOLS.map((symbol) => (
              <Key key={symbol} label={`Insert ${symbol}`} onPress={() => target.insertText(symbol)}>
                <span className="v-key-sym">{symbol}</span>
              </Key>
            ))}
          </>
        )}
      </div>
      <div className="v-accessory-pinned">
        {runKey ? (
          runKey.running ? (
            <Key label="Stop" onPress={runKey.onStop}><Square size={15} strokeWidth={1.6} fill="currentColor" /></Key>
          ) : (
            <Key label="Run" onPress={runKey.onRun}><Play size={16} strokeWidth={1.6} fill="currentColor" /></Key>
          )
        ) : null}
        <Key label="Hide keyboard" onPress={() => target.blur()}><ChevronDown size={20} strokeWidth={1.4} /></Key>
      </div>
    </div>
  )
}
