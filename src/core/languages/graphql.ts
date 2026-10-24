import { StreamLanguage, type StreamParser } from '@codemirror/language'

const KEYWORDS = new Set([
  'query', 'mutation', 'subscription', 'fragment', 'on', 'type', 'interface', 'union', 'enum', 'scalar',
  'input', 'extend', 'schema', 'directive', 'implements', 'repeatable',
])
const ATOMS = new Set(['true', 'false', 'null'])

const parser: StreamParser<null> = {
  name: 'graphql',
  startState: () => null,
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.eat('#')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match(/^"""(?:[^"]|"(?!""))*(?:"""|$)/)) return 'string'
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string'
    if (stream.match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)) return 'number'
    if (stream.match(/^\$[_A-Za-z][_0-9A-Za-z]*/)) return 'variableName'
    if (stream.match(/^@[_A-Za-z][_0-9A-Za-z]*/)) return 'meta'
    if (stream.match(/^\.\.\./)) return 'operator'
    if (stream.match(/^[_A-Za-z][_0-9A-Za-z]*/)) {
      const word = stream.current()
      if (KEYWORDS.has(word)) return 'keyword'
      if (ATOMS.has(word)) return 'atom'
      if (/^[A-Z]/.test(word)) return 'typeName'
      return 'propertyName'
    }
    stream.next()
    return 'punctuation'
  },
  languageData: { commentTokens: { line: '#' }, closeBrackets: { brackets: ['(', '[', '{', '"'] } },
}

export const graphqlLanguage = StreamLanguage.define(parser)
