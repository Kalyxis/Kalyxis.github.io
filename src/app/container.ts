import { DocumentManager } from '../core/documents/DocumentManager'
import { EditorController } from '../core/editor/EditorController'
import { LanguageRegistry } from '../core/languages/LanguageRegistry'
import { RunnerRegistry } from '../core/run/RunnerRegistry'
import { RunService } from '../core/run/RunService'
import { ArchiveService } from '../core/services/ArchiveService'
import { AutoSaveService } from '../core/services/AutoSaveService'
import { CommandRegistry } from '../core/services/CommandRegistry'
import { DialogService } from '../core/services/DialogService'
import { Formatter } from '../core/services/Formatter'
import { InstallService } from '../core/services/InstallService'
import { SessionService } from '../core/services/SessionService'
import { SettingsService } from '../core/services/SettingsService'
import { ShareService } from '../core/services/ShareService'
import { ShortcutService } from '../core/services/ShortcutService'
import { ToastService } from '../core/services/ToastService'
import { ViewportService } from '../core/services/ViewportService'
import { WorkspaceService } from '../core/services/WorkspaceService'
import { useAppStore } from '../store/useAppStore'
import { AppActions } from './actions'
import { registerCommands } from './commands'

export interface Services {
  settings: SettingsService
  toasts: ToastService
  dialogs: DialogService
  share: ShareService
  archive: ArchiveService
  languages: LanguageRegistry
  editor: EditorController
  workspace: WorkspaceService
  documents: DocumentManager
  runners: RunnerRegistry
  runs: RunService
  formatter: Formatter
  commands: CommandRegistry
  actions: AppActions
  viewport: ViewportService
  install: InstallService
  autosave: AutoSaveService
  session: SessionService
  shortcuts: ShortcutService
}

/** Composition root: builds every service once and wires them together. */
function build(): Services {
  const settings = new SettingsService()
  const toasts = new ToastService()
  const dialogs = new DialogService()
  const share = new ShareService()
  const archive = new ArchiveService()
  const languages = new LanguageRegistry()
  const editor = new EditorController(languages, settings.get())
  const workspace = new WorkspaceService({ dialogs, toasts, archive, share })
  const documents = new DocumentManager({ workspace, editor, dialogs, toasts, share })
  const runners = new RunnerRegistry()
  const runs = new RunService({ documents, runners, settings, toasts })
  const formatter = new Formatter()
  const commands = new CommandRegistry()
  const actions = new AppActions({ editor, documents, workspace, runs, dialogs, toasts, settings, formatter })
  const services: Services = {
    settings, toasts, dialogs, share, archive, languages, editor, workspace, documents, runners, runs, formatter, commands, actions,
    viewport: new ViewportService(),
    install: new InstallService(),
    autosave: new AutoSaveService(documents, settings),
    session: new SessionService(documents, workspace),
    shortcuts: new ShortcutService(commands),
  }
  registerCommands(services)
  return services
}

export const app: Services = build()

const WELCOMED_KEY = 'kalyxis.welcomed.v1'
let bootPromise: Promise<void> | null = null

/** Starts services, loads the workspace and restores the previous session. Safe to call more than once. */
export function boot(): Promise<void> {
  bootPromise ??= start()
  return bootPromise
}

async function start(): Promise<void> {
  const { settings, editor, viewport, shortcuts, autosave, session, install, workspace, documents, runs } = app

  settings.themeChanged.subscribe((theme) => editor.setDark(theme === 'dark'))
  settings.start()
  editor.applySettings(settings.get(), settings.resolvedTheme() === 'dark')
  useAppStore.subscribe((state, prev) => {
    if (state.settings !== prev.settings) editor.applySettings(state.settings, settings.resolvedTheme() === 'dark')
    if (state.activeTabId !== prev.activeTabId) {
      runs.syncRuntime()
      const active = documents.active
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
      if (active && !saveData) window.setTimeout(() => runs.warmUp(), 1500)
    }
  })
  editor.events.cursor.subscribe((cursor) => useAppStore.setState({ cursor }))
  editor.events.problems.subscribe((problems) => useAppStore.setState({ problems }))
  editor.events.focus.subscribe((focused) => useAppStore.getState().patchUi({ editorFocused: focused }))
  viewport.keyboardChanged.subscribe(() => window.setTimeout(() => editor.revealCursor(), 120))

  viewport.start()
  shortcuts.start()
  autosave.start()
  session.start()
  install.start()

  await workspace.init()
  await session.restore()
  if (documents.all.length === 0) {
    let welcomed = false
    try {
      welcomed = localStorage.getItem(WELCOMED_KEY) === '1'
      localStorage.setItem(WELCOMED_KEY, '1')
    } catch {
      welcomed = true
    }
    if (!welcomed && (await workspace.local.exists('/welcome.md'))) await documents.openFile('/welcome.md')
  }
  window.addEventListener('beforeunload', (event) => {
    if (documents.all.some((d) => d.dirty && (!d.source.writable || !settings.get().autoSave))) {
      event.preventDefault()
    }
  })
}
