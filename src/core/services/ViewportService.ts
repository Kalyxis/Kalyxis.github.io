import { Emitter } from '../util/Emitter'
import { Platform } from '../util/platform'
import { useAppStore } from '../../store/useAppStore'

const KEYBOARD_THRESHOLD = 120

/**
 * Tracks the visual viewport so the layout always fits the visible area, which shrinks when the
 * on screen keyboard opens on iOS and Android. It publishes --vv-h and --vv-top on the root element.
 */
export class ViewportService {
  readonly keyboardChanged = new Emitter<boolean>()
  private frame = 0

  start(): void {
    const schedule = () => {
      cancelAnimationFrame(this.frame)
      this.frame = requestAnimationFrame(() => this.update())
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    window.matchMedia('(min-width: 900px)').addEventListener('change', schedule)
    this.update()
  }

  private update(): void {
    const vv = window.visualViewport
    const height = vv?.height ?? window.innerHeight
    const top = vv?.offsetTop ?? 0
    const root = document.documentElement
    root.style.setProperty('--vv-h', `${Math.round(height)}px`)
    root.style.setProperty('--vv-top', `${Math.round(top)}px`)
    const keyboardOpen = Platform.isTouch && window.innerHeight - height > KEYBOARD_THRESHOLD
    const wide = window.matchMedia('(min-width: 900px)').matches
    const ui = useAppStore.getState().ui
    if (ui.keyboardOpen !== keyboardOpen || ui.wide !== wide) {
      useAppStore.getState().patchUi({ keyboardOpen, wide, sidebarOpen: ui.wide !== wide ? wide : ui.sidebarOpen })
      if (ui.keyboardOpen !== keyboardOpen) this.keyboardChanged.emit(keyboardOpen)
    }
    // iOS scrolls the page to reveal the caret. The layout is pinned to the visual viewport, so undo that.
    if (keyboardOpen && (window.scrollY !== 0 || window.scrollX !== 0)) window.scrollTo(0, 0)
  }
}
