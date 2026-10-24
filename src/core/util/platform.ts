/** Feature detection for the browser the editor is running in. Everything is evaluated lazily. */
export class Platform {
  static get isTouch(): boolean {
    return window.matchMedia('(pointer: coarse)').matches
  }

  static get isIOS(): boolean {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  }

  static get isAndroid(): boolean {
    return /android/i.test(navigator.userAgent)
  }

  static get isMac(): boolean {
    return /mac|iphone|ipad|ipod/i.test(navigator.platform) || /mac os/i.test(navigator.userAgent)
  }

  static get isStandalone(): boolean {
    const nav = navigator as Navigator & { standalone?: boolean }
    return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  }

  static get canPickDirectory(): boolean {
    return typeof window.showDirectoryPicker === 'function'
  }

  static get canPickFiles(): boolean {
    return typeof window.showOpenFilePicker === 'function'
  }

  static get canSavePicker(): boolean {
    return typeof window.showSaveFilePicker === 'function'
  }

  /** Label for the primary modifier key, for shortcut hints. */
  static get modKey(): string {
    return Platform.isMac ? '\u2318' : 'Ctrl'
  }

  static get prefersDark(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
}
