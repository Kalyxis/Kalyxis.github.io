import { shortcutFor } from '../core/services/ShortcutService'
import type { EditorCommandId } from '../core/editor/EditorController'
import { useAppStore } from '../store/useAppStore'
import type { Services } from './container'

/** Registers every command shown in the palette and bound to shortcuts. */
export function registerCommands(s: Services): void {
  const { commands, actions, documents, editor, runs, workspace, settings } = s
  const ui = (patch: Parameters<ReturnType<typeof useAppStore.getState>['patchUi']>[0]) => useAppStore.getState().patchUi(patch)
  const hasDoc = () => documents.active !== null
  const add = (
    id: string,
    title: string,
    category: Parameters<typeof commands.register>[0]['category'],
    run: () => void | Promise<void>,
    extra: { keywords?: string; enabled?: () => boolean } = {},
  ) => commands.register({ id, title, category, run, shortcut: shortcutFor(id), ...extra })
  const edit = (id: string, title: string, command: EditorCommandId, category: 'Edit' | 'Selection' = 'Edit', keywords?: string) =>
    add(id, title, category, () => void editor.exec(command), { enabled: hasDoc, keywords })

  // File
  add('file.new', 'New file', 'File', () => actions.newFile(), { keywords: 'create' })
  add('file.newFolder', 'New folder', 'File', () => actions.newFolder(), { keywords: 'create directory' })
  add('file.newScratch', 'New scratch buffer', 'File', () => actions.newScratch(), { keywords: 'untitled temporary' })
  add('file.fromExample', 'New from example', 'File', () => ui({ examplesOpen: true }), { keywords: 'template sample' })
  add('file.open', 'Open files', 'File', () => actions.openFromDevice(), { keywords: 'load import upload files zip' })
  add('file.export', 'Save to Files or download a copy', 'File', () => documents.exportToDevice(), { enabled: hasDoc, keywords: 'export share download icloud' })
  add('file.save', 'Save', 'File', () => void documents.save(), { enabled: hasDoc })
  add('file.saveAs', 'Save as', 'File', () => {
    const a = documents.active
    if (a) void documents.saveAs(a.id)
  }, { enabled: hasDoc })
  add('file.saveAll', 'Save all', 'File', () => documents.saveDirty())
  add('file.close', 'Close tab', 'File', () => {
    const a = documents.active
    if (a) void documents.close(a.id)
  }, { enabled: hasDoc })
  add('file.closeOthers', 'Close other tabs', 'File', () => {
    const a = documents.active
    if (a) void documents.closeOthers(a.id)
  }, { enabled: () => documents.all.length > 1 })
  add('file.closeAll', 'Close all tabs', 'File', () => documents.closeAll(), { enabled: () => documents.all.length > 0 })
  add('file.exportWorkspace', 'Export workspace as zip', 'Workspace', () => workspace.exportWorkspace(), { keywords: 'download backup' })

  // Edit
  edit('edit.lineBelow', 'Insert line below (new line)', 'insertBlankLine', 'Edit', 'enter next line')
  edit('edit.undo', 'Undo', 'undo')
  edit('edit.redo', 'Redo', 'redo')
  add('edit.find', 'Find', 'Edit', () => actions.openFind(false), { enabled: hasDoc })
  add('edit.replace', 'Find and replace', 'Edit', () => actions.openFind(true), { enabled: hasDoc })
  add('edit.gotoLine', 'Go to line', 'Go', () => actions.gotoLine(), { enabled: hasDoc })
  add('edit.format', 'Format document', 'Edit', () => actions.format(), { enabled: hasDoc, keywords: 'prettier beautify' })
  edit('edit.toggleComment', 'Toggle comment', 'toggleComment', 'Edit', 'uncomment')
  edit('edit.duplicateLine', 'Duplicate line', 'duplicateLine')
  edit('edit.deleteLine', 'Delete line', 'deleteLine')
  edit('edit.moveLineUp', 'Move line up', 'moveLineUp')
  edit('edit.moveLineDown', 'Move line down', 'moveLineDown')
  edit('edit.indent', 'Indent', 'indentMore')
  edit('edit.outdent', 'Outdent', 'indentLess')
  edit('edit.sortLines', 'Sort lines', 'sortLines')
  edit('edit.trim', 'Trim trailing whitespace', 'trimTrailing')
  edit('edit.foldAll', 'Fold all', 'foldAll')
  edit('edit.unfoldAll', 'Unfold all', 'unfoldAll')
  edit('sel.all', 'Select all', 'selectAll', 'Selection')
  edit('sel.line', 'Select line', 'selectLine', 'Selection')
  edit('sel.next', 'Select next occurrence', 'selectNextOccurrence', 'Selection', 'multiple cursors')
  edit('sel.cursorAbove', 'Add cursor above', 'addCursorAbove', 'Selection', 'multi cursor')
  edit('sel.cursorBelow', 'Add cursor below', 'addCursorBelow', 'Selection', 'multi cursor')
  edit('sel.upper', 'Transform to uppercase', 'upperCase', 'Selection')
  edit('sel.lower', 'Transform to lowercase', 'lowerCase', 'Selection')
  add('edit.eol', 'Toggle line endings (LF or CRLF)', 'Edit', () => actions.toggleEol(), { enabled: hasDoc })
  add('edit.language', 'Change language mode', 'Edit', () => ui({ languageSheetOpen: true }), { enabled: hasDoc, keywords: 'syntax highlighting' })

  // Run
  add('run.terminal', 'Open Terminal (Python sandbox)', 'Run', () => ui({ terminalOpen: true }), { keywords: 'python sandbox scratchpad free play console' })
  add('run.run', 'Run', 'Run', () => actions.run(), { enabled: () => runs.canRun() })
  add('run.stop', 'Stop', 'Run', () => actions.stop(), { enabled: () => useAppStore.getState().run.status === 'running' })
  add('run.clear', 'Clear console', 'Run', () => runs.clear())
  add('run.console', 'Show console', 'Run', () => actions.openPanel('console'))
  add('run.input', 'Show input (stdin)', 'Run', () => actions.openPanel('input'), { keywords: 'stdin' })
  add('run.problems', 'Show problems', 'Run', () => actions.openPanel('problems'), { keywords: 'errors warnings' })

  // View
  add('view.sidebar', 'Toggle file explorer', 'View', () => actions.toggleSidebar())
  add('view.panel', 'Toggle bottom panel', 'View', () => actions.togglePanel())
  add('view.settings', 'Open settings', 'View', () => ui({ settingsOpen: true }), { keywords: 'preferences' })
  add('view.theme', 'Toggle dark and light theme', 'View', () => actions.toggleTheme())
  add('view.zoomIn', 'Increase font size', 'View', () => actions.zoom(1))
  add('view.zoomOut', 'Decrease font size', 'View', () => actions.zoom(-1))
  add('view.wrap', 'Toggle word wrap', 'View', () => settings.update({ wordWrap: !settings.get().wordWrap }))
  add('view.whitespace', 'Toggle whitespace characters', 'View', () => settings.update({ showWhitespace: !settings.get().showWhitespace }))

  // Go
  add('go.quickOpen', 'Go to file', 'Go', () => actions.openPalette('files'), { keywords: 'open quick' })
  add('go.palette', 'Command palette', 'Go', () => actions.openPalette('all'))
  add('go.nextTab', 'Next tab', 'Go', () => documents.next(1), { enabled: () => documents.all.length > 1 })
  add('go.prevTab', 'Previous tab', 'Go', () => documents.next(-1), { enabled: () => documents.all.length > 1 })

  // Workspace
  add('ws.import', 'Import files', 'Workspace', () => document.getElementById('kalyxis-import-files')?.click(), { keywords: 'upload zip' })
  add('ws.openFolder', 'Open folder from disk', 'Workspace', () => actions.openFolder(), {
    enabled: () => typeof window.showDirectoryPicker === 'function',
  })
  add('ws.local', 'Switch to on device storage', 'Workspace', () => workspace.useLocal(), {
    enabled: () => useAppStore.getState().workspace.kind === 'disk',
  })

}
