import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, IndentDecrease, Play, Redo2, TextSelect, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { app } from '../app/container'
import type { Direction } from '../core/editor/EditorController'
import { useAppStore } from '../store/useAppStore'

const SYMBOLS = ['(', ')', '{', '}', '[', ']', '<', '>', '"', "'", '`', '=', ';', ':', '.', ',', '/', '\\', '|', '&', '!', '?', '_', '-', '+', '*', '#', '$', '%', '@', '~', '^']

/** Keeps the editor focused (and the keyboard open) when a key is pressed. */
const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault()

interface KeyProps {
  label: string
  onPress: () => void
  children: ReactNode
  wide?: boolean
  active?: boolean
  repeat?: boolean
}

/** One key. With `repeat`, holding it repeats the action, which makes cursor keys practical. */
function Key({ label, onPress, children, wide, active, repeat }: KeyProps) {
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
      className={`v-key ${wide ? 'v-key-wide' : ''} ${active ? 'is-active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={keepFocus}
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

export function AccessoryBar() {
  const [selecting, setSelecting] = useState(false)
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const runnable = tab ? app.runners.forLanguage(tab.languageId) !== null : false

  const move = (direction: Direction) => app.editor.move(direction, selecting)

  return (
    <div className="v-accessory" role="toolbar" aria-label="Editing keys">
      <div className="v-accessory-scroll">
        <Key label="Tab" wide onPress={() => app.editor.exec('tab')}>Tab</Key>
        <Key label="Outdent" onPress={() => app.editor.exec('indentLess')}><IndentDecrease size={18} strokeWidth={1.4} /></Key>
        <Key label="Undo" repeat onPress={() => app.editor.exec('undo')}><Undo2 size={18} strokeWidth={1.4} /></Key>
        <Key label="Redo" repeat onPress={() => app.editor.exec('redo')}><Redo2 size={18} strokeWidth={1.4} /></Key>
        <span className="v-key-sep" />
        <Key label="Cursor left" repeat onPress={() => move('left')}><ArrowLeft size={18} strokeWidth={1.4} /></Key>
        <Key label="Cursor up" repeat onPress={() => move('up')}><ArrowUp size={18} strokeWidth={1.4} /></Key>
        <Key label="Cursor down" repeat onPress={() => move('down')}><ArrowDown size={18} strokeWidth={1.4} /></Key>
        <Key label="Cursor right" repeat onPress={() => move('right')}><ArrowRight size={18} strokeWidth={1.4} /></Key>
        <Key label="Extend selection with cursor keys" active={selecting} onPress={() => setSelecting((v) => !v)}><TextSelect size={18} strokeWidth={1.4} /></Key>
        <span className="v-key-sep" />
        {SYMBOLS.map((symbol) => (
          <Key key={symbol} label={`Insert ${symbol}`} onPress={() => app.editor.insertText(symbol)}>
            <span className="v-key-sym">{symbol}</span>
          </Key>
        ))}
      </div>
      <div className="v-accessory-pinned">
        {runnable ? (
          <Key label="Run" onPress={() => void app.actions.run()}><Play size={16} strokeWidth={1.6} fill="currentColor" /></Key>
        ) : null}
        <Key label="Hide keyboard" onPress={() => app.editor.blur()}><ChevronDown size={20} strokeWidth={1.4} /></Key>
      </div>
    </div>
  )
}
