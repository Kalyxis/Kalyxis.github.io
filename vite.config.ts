import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * Emits sw.js with the full list of built files so the whole editor (including every
 * lazily loaded language and the formatter) works offline after the first visit.
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'kalyxis-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((name) => !name.endsWith('.map'))
        .sort()
      const build = createHash('sha1').update(files.join('|')).digest('hex').slice(0, 10)
      const template = readFileSync(`${root}scripts/sw.template.js`, 'utf8')
      const source = template
        .replace('__PRECACHE__', JSON.stringify(files))
        .replace('__BUILD__', build)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// Relative base: the app works at https://name.github.io/ and at https://name.github.io/repo/.
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorkerPlugin()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  worker: { format: 'es' },
})
