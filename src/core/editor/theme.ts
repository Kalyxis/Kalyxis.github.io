import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

/**
 * Every colour comes from a CSS variable defined in styles/tokens.css, so switching between
 * the dusk and vellum themes needs no editor reconfiguration, and the editor can never drift
 * away from the rest of the design system.
 */
export const kalyxisTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text)',
    fontSize: 'var(--editor-font-size, 15px)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.7',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
  },
  '.cm-content': { caretColor: 'var(--star)', padding: '14px 0' },
  '.cm-line': { padding: '0 16px 0 6px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--star)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--selection)',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--text-4)',
    border: 'none',
    paddingLeft: '2px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 10px 0 8px',
    minWidth: '32px',
    fontVariantNumeric: 'tabular-nums',
  },
  '.cm-foldGutter .cm-gutterElement': { padding: '0 6px', cursor: 'pointer', color: 'var(--text-4)' },
  '.cm-activeLine': { backgroundColor: 'var(--bg-hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text)' },
  '&.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--star-dim)',
    outline: '1px solid var(--star-line)',
  },
  '&.cm-focused .cm-nonmatchingBracket': { backgroundColor: 'var(--danger-dim)' },
  '.cm-searchMatch': { backgroundColor: 'var(--star-dim)', outline: '1px solid var(--star-line)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--star-strong)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--accent-dim)' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--bg-4)',
    border: '1px solid var(--border-hover)',
    color: 'var(--text-3)',
    padding: '0 6px',
    margin: '0 2px',
  },
  '.cm-specialChar': { color: 'var(--text-4)' },
  '.cm-highlightSpace': { backgroundImage: 'radial-gradient(circle at 50% 55%, var(--text-4) 12%, transparent 24%)' },
  '.cm-highlightTab': { backgroundSize: 'auto 100%', backgroundRepeat: 'no-repeat' },
  '.cm-panels': { display: 'none' },

  '.cm-tooltip': {
    backgroundColor: 'var(--bg-3)',
    border: '1px solid var(--border-hover)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    boxShadow: 'var(--shadow)',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-mono)',
    maxHeight: '32vh',
    minWidth: '160px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '7px 12px',
    minHeight: '34px',
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-2)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--bg-selected)',
    color: 'var(--text)',
  },
  '.cm-completionIcon': { display: 'none' },
  '.cm-completionDetail': { color: 'var(--text-3)', fontStyle: 'normal', marginLeft: '10px' },
  '.cm-completionMatchedText': { textDecoration: 'none', color: 'var(--star)' },
  '.cm-tooltip-lint': { padding: '6px 10px' },
  '.cm-diagnostic': { padding: '4px 8px', fontFamily: 'var(--font-body)', fontSize: '13px' },
  '.cm-diagnostic-error': { borderLeft: '3px solid var(--danger)' },
  '.cm-diagnostic-warning': { borderLeft: '3px solid var(--star)' },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--danger)',
    textUnderlineOffset: '3px',
  },
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--star)',
    textUnderlineOffset: '3px',
  },

  '.cm-rb0': { color: 'var(--rb-0)' },
  '.cm-rb1': { color: 'var(--rb-1)' },
  '.cm-rb2': { color: 'var(--rb-2)' },
  '.cm-rb3': { color: 'var(--rb-3)' },
})

const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword], color: 'var(--syn-keyword)' },
  { tag: [t.self, t.special(t.variableName)], color: 'var(--syn-keyword)', fontStyle: 'italic' },
  { tag: [t.string, t.special(t.string), t.character], color: 'var(--syn-string)' },
  { tag: [t.regexp, t.escape], color: 'var(--syn-regex)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: 'var(--syn-function)' },
  { tag: [t.className, t.typeName, t.namespace, t.labelName], color: 'var(--syn-type)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--syn-property)' },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], color: 'var(--text)' },
  { tag: t.variableName, color: 'var(--text)' },
  { tag: [t.operator, t.derefOperator, t.compareOperator, t.logicOperator, t.arithmeticOperator], color: 'var(--syn-operator)' },
  { tag: [t.punctuation, t.separator, t.bracket, t.angleBracket, t.squareBracket, t.paren, t.brace], color: 'var(--syn-punct)' },
  { tag: t.tagName, color: 'var(--syn-tag)' },
  { tag: [t.meta, t.processingInstruction, t.documentMeta], color: 'var(--syn-meta)' },
  { tag: t.heading, color: 'var(--text)', fontWeight: '600' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--syn-function)', textDecoration: 'underline' },
  { tag: t.quote, color: 'var(--syn-comment)' },
  { tag: t.inserted, color: 'var(--syn-string)' },
  { tag: t.deleted, color: 'var(--danger)' },
  { tag: t.invalid, color: 'var(--danger)' },
])

export const kalyxisHighlighting = syntaxHighlighting(highlightStyle)
