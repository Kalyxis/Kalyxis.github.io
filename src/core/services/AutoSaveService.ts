import type { DocumentManager } from '../documents/DocumentManager'
import { debounce } from '../util/timing'
import type { SettingsService } from './SettingsService'

const DELAY_MS = 900

/** Saves changed documents shortly after typing stops, and again when the app is hidden. */
export class AutoSaveService {
  private readonly documents: DocumentManager
  private readonly settings: SettingsService
  private readonly run = debounce(() => {
    if (this.settings.get().autoSave) void this.documents.saveDirty()
  }, DELAY_MS)

  constructor(documents: DocumentManager, settings: SettingsService) {
    this.documents = documents
    this.settings = settings
  }

  start(): void {
    this.documents.edited.subscribe((session) => {
      if (session === null || session.dirty) this.run()
    })
    const flush = () => {
      if (this.settings.get().autoSave) {
        this.run.cancel()
        void this.documents.saveDirty()
      }
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
    window.addEventListener('pagehide', flush)
  }
}
