import { Platform } from '../util/platform'
import { useAppStore } from '../../store/useAppStore'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const KEY = 'kalyxis.install.dismissed'
const QUIET_DAYS = 14

/** Offers "add to home screen" on phones, with the right instructions for iOS. */
export class InstallService {
  private deferred: InstallPromptEvent | null = null

  start(): void {
    if (Platform.isStandalone || this.recentlyDismissed()) return
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault()
      this.deferred = event as InstallPromptEvent
      window.setTimeout(() => useAppStore.setState({ installHint: 'prompt' }), 6000)
    })
    window.addEventListener('appinstalled', () => this.hide())
    if (Platform.isIOS) window.setTimeout(() => useAppStore.setState({ installHint: 'ios' }), 9000)
  }

  async install(): Promise<void> {
    const event = this.deferred
    if (!event) return
    await event.prompt()
    await event.userChoice.catch(() => undefined)
    this.deferred = null
    this.hide()
  }

  dismiss(): void {
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      // ignore
    }
    this.hide()
  }

  private hide(): void {
    useAppStore.setState({ installHint: null })
  }

  private recentlyDismissed(): boolean {
    try {
      const at = Number(localStorage.getItem(KEY) ?? 0)
      return at > 0 && Date.now() - at < QUIET_DAYS * 86_400_000
    } catch {
      return false
    }
  }
}
