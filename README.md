# Kalyxis

A mobile first code editor with a built in console. Write and run Python, JavaScript and HTML on an iPhone, an Android phone, a tablet or a desktop. Everything runs in the browser, works offline after the first visit, and installs to the home screen.

Kalyxis keeps the visual atmosphere of the Abyssal Liturgy editor (dusk ink, bone type, silver hairlines, Cormorant, Jost and JetBrains Mono, 2px corners) and adds one new element: an evening star gold used only for emphasis (caret, Run, unsaved marks).

## What is inside

**Editor** (CodeMirror 6, built for touch)

- Auto closing brackets, quotes and HTML or JSX tags, with Backspace removing the pair
- Autocomplete (language aware plus words from the file), bracket matching, colored brackets
- Syntax checking from the language parser, with a Problems list you can tap to jump
- Find and replace with case, whole word and regex options and a live match count
- Multiple cursors, select next occurrence, move, duplicate and delete line, toggle comment, indent and outdent, sort lines, trim trailing whitespace, fold and unfold, go to line
- Format document with Prettier (JavaScript, TypeScript, JSON, CSS, SCSS, Less, HTML, Vue, Markdown, YAML, GraphQL)
- 34 language modes loaded on demand, per tab undo history, per tab scroll position, LF or CRLF line endings preserved
- Tabs, command palette (commands and quick open), light and dark themes, font size, indent size, word wrap, whitespace display

**Made for phones**

- Key bar above the keyboard: Tab, outdent, undo, redo, cursor keys (hold to repeat), a selection mode, and every symbol code needs
- Layout follows the visual viewport, so nothing hides behind the on screen keyboard on iOS or Android
- 44 pixel touch targets, bottom sheets instead of tiny menus, a file drawer, safe area support
- Auto save, also when the app goes to the background
- Installable PWA with offline support and iOS splash screens

**Sandbox** (ported from Noctiluca and extended)

- Console with streamed output, error text, Run and Stop, a time limit, copy and clear
- Input tab (standard input), one value per line, read by `input()` in Python or `prompt()` in JavaScript
- Python through Pyodide in a worker (packages such as numpy load automatically from imports)
- JavaScript as an ES module in a worker (top level await, imports from URLs, timers, `console.*`)
- HTML preview in a sandboxed frame with its console forwarded to the Console tab, and linked relative CSS and JS files inlined
- Example library for Python, JavaScript and HTML

**Files**

- On device workspace (IndexedDB): works on every phone with no permissions
- Import files, folders and zip archives, export the workspace as a zip, share single files
- Desktop Chromium can open a real folder and edit in place, and open single files with the file picker

## Architecture

The domain logic is object oriented TypeScript. React components are thin views over it.

```
src/
  core/
    fs/          FileSystemProvider (abstract) -> LocalFileSystem (IndexedDB), NativeFileSystem (File System Access)
    documents/   DocumentSource (abstract) -> WorkspaceSource, HandleSource, MemorySource
                 DocumentSession (one open file), DocumentManager (tabs, save, close)
    editor/      EditorController (wraps CodeMirror), theme, rainbow brackets, syntax lint
    languages/   catalog, LanguageRegistry (lazy loading), GraphQL mode
    run/         Runner (abstract) -> PythonRunner, JavaScriptRunner, HtmlRunner, RunnerRegistry, RunService
    services/    Settings, Dialog, Toast, Workspace, AutoSave, Session, Viewport, Install, Archive, Share,
                 Formatter, CommandRegistry, ShortcutService
    templates/   example programs
  app/           container.ts (composition root), actions.ts (user actions), commands.ts (palette commands)
  store/         zustand store that mirrors state for React
  ui/            React components
  styles/        tokens.css (design system), base.css, app.css
```

To add a language, add it to `core/languages/catalog.ts` and register a loader in `LanguageRegistry`. To add a runner, extend `Runner` and add it to `RunnerRegistry`.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
npm run build      # type check and production build into dist/
npm run preview
```

`npm run assets` regenerates the icons and splash screens from the mark (only needed after a design change).

## Deploy to GitHub Pages

1. Create a repository named `kalyxis.github.io` under the `kalyxis` GitHub account and push this project to the `main` branch.
2. In the repository open Settings, then Pages, and set Source to **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` lints, builds and deploys on every push. The app appears at `https://kalyxis.github.io/`.

The build uses relative asset paths, so it also works from a project repository (`https://YOUR-USERNAME.github.io/repo-name/`) with no configuration.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Save, Save as | Cmd or Ctrl + S, Shift + S |
| Run, Stop | Cmd or Ctrl + Enter, Cmd or Ctrl + . |
| Command palette, Go to file | Cmd or Ctrl + Shift + P, Cmd or Ctrl + P |
| Find, Replace, Go to line | Cmd or Ctrl + F, H, G |
| Format document | Alt + Shift + F |
| Toggle files, Toggle panel | Cmd or Ctrl + B, Cmd or Ctrl + ` |
| Next or previous tab | Alt + ] and Alt + [ |
| Close tab | Alt + W |
| Select next occurrence | Cmd or Ctrl + D |
| Toggle comment, Move line | Cmd or Ctrl + /, Alt + Up or Down |

## Notes and limits

- The editor engine is CodeMirror 6 instead of Monaco. Monaco does not support touch input, so it cannot edit code on a phone. The result is smaller (about 150 KB gzipped for the app shell) and fully touch ready. Monaco's type aware TypeScript IntelliSense and minimap have no CodeMirror equivalent, so they are not included. Syntax checking and completion come from each language grammar.
- Python downloads the Pyodide runtime from jsDelivr the first time it runs, then works offline from the cache.
- Interactive input mid run is not possible in the browser without special server headers, so programs read their input from the Input tab.
- HTML previews run in a sandbox without access to the editor's storage, so `localStorage` inside a preview page is unavailable.
- Opening a real folder needs the File System Access API (desktop Chrome, Edge). iOS and Android use the on device workspace, import and export.
