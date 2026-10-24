import { Emitter } from '../util/Emitter'
import { Platform } from '../util/platform'
import { useAppStore } from '../../store/useAppStore'
import { persistSettings, type Settings } from './settings'

/** Owns user preferences: validation, persistence and applying the theme to the document. */
export class SettingsService {
  readonly themeChanged = new Emitter<'dark' | 'light'>()
  private mediaQuery: MediaQueryList | null = null

  get(): Settings {
    return useAppStore.getState().settings
  }

  update(patch: Partial<Settings>): void {
    const next = { ...this.get(), ...patch }
    useAppStore.setState({ settings: next })
    persistSettings(next)
    if (patch.theme !== undefined) this.applyTheme()
  }

  resolvedTheme(): 'dark' | 'light' {
    const { theme } = this.get()
    if (theme === 'system') return Platform.prefersDark ? 'dark' : 'light'
    return theme
  }

  /** Sets data-theme on the root element and keeps the browser chrome colour in sync. */
  applyTheme(): void {
    const resolved = this.resolvedTheme()
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.style.colorScheme = resolved
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#08090c' : '#f4f2ec')
    this.themeChanged.emit(resolved)
  }

  /** Applies the saved theme and follows the system theme while "System" is selected. */
  start(): void {
    this.applyTheme()
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    this.mediaQuery.addEventListener('change', () => {
      if (this.get().theme === 'system') this.applyTheme()
    })
  }
}
