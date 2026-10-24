import type { LanguageId } from '../languages/catalog'

interface Plan {
  parser: string
  plugins: () => Promise<unknown[]>
}

const babel = async () => [(await import('prettier/plugins/babel')).default, (await import('prettier/plugins/estree')).default]
const typescript = async () => [(await import('prettier/plugins/typescript')).default, (await import('prettier/plugins/estree')).default]
const postcss = async () => [(await import('prettier/plugins/postcss')).default]
const html = async () => [(await import('prettier/plugins/html')).default]
const markdown = async () => [(await import('prettier/plugins/markdown')).default]
const yaml = async () => [(await import('prettier/plugins/yaml')).default]
const graphql = async () => [(await import('prettier/plugins/graphql')).default]

const PLANS: Partial<Record<LanguageId, Plan>> = {
  javascript: { parser: 'babel', plugins: babel },
  jsx: { parser: 'babel', plugins: babel },
  typescript: { parser: 'typescript', plugins: typescript },
  tsx: { parser: 'typescript', plugins: typescript },
  json: { parser: 'json', plugins: babel },
  jsonc: { parser: 'json', plugins: babel },
  css: { parser: 'css', plugins: postcss },
  scss: { parser: 'scss', plugins: postcss },
  less: { parser: 'less', plugins: postcss },
  html: { parser: 'html', plugins: html },
  vue: { parser: 'vue', plugins: html },
  markdown: { parser: 'markdown', plugins: markdown },
  yaml: { parser: 'yaml', plugins: yaml },
  graphql: { parser: 'graphql', plugins: graphql },
}

export interface FormatOptions {
  tabSize: number
  useTabs: boolean
}

/** Formats documents with Prettier. The engine is a separate chunk, downloaded on first use. */
export class Formatter {
  canFormat(id: LanguageId): boolean {
    return id in PLANS
  }

  async format(text: string, id: LanguageId, options: FormatOptions): Promise<string> {
    const plan = PLANS[id]
    if (!plan) throw new Error('Formatting is not available for this language.')
    const prettier = await import('prettier/standalone')
    return prettier.format(text, {
      parser: plan.parser,
      plugins: (await plan.plugins()) as never[],
      tabWidth: options.tabSize,
      useTabs: options.useTabs,
      printWidth: 90,
    })
  }
}
