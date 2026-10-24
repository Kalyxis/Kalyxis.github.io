import type { LanguageId } from '../languages/catalog'
import { HtmlRunner } from './HtmlRunner'
import { JavaScriptRunner } from './JavaScriptRunner'
import { PythonRunner } from './PythonRunner'
import type { Runner } from './Runner'

export class RunnerRegistry {
  readonly runners: readonly Runner[] = [new PythonRunner(), new JavaScriptRunner(), new HtmlRunner()]

  forLanguage(id: LanguageId): Runner | null {
    return this.runners.find((r) => (r.languages as readonly string[]).includes(id)) ?? null
  }
}
