import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const SOURCE = `${root}public/app-icon-source.jpg`
const BG = '#08090c'

const png = async (size, file, fit = 'cover') => sharp(SOURCE)
  .resize(size, size, { fit, position: 'centre' })
  .png({ compressionLevel: 9 })
  .toFile(`${root}public/${file}`)

await mkdir(`${root}public/splash`, { recursive: true })
await sharp(SOURCE).resize(64, 64, { fit: 'cover' }).png().toFile(`${root}public/favicon.png`)
await writeFile(`${root}public/favicon.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><image href="app-icon-source.jpg" width="100" height="100" preserveAspectRatio="xMidYMid slice"/></svg>\n`)
await png(192, 'icon-192.png')
await png(512, 'icon-512.png')
await png(512, 'icon-maskable-512.png', 'contain')
await png(180, 'apple-touch-icon.png')

// [css width, css height, pixel ratio]
const devices = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3],
  [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2],
  [820, 1180, 2], [1024, 1366, 2], [834, 1194, 2], [810, 1080, 2],
]
const links = []
for (const [w, h, r] of devices) {
  const pw = w * r
  const ph = h * r
  const file = `splash/${pw}x${ph}.png`
  await sharp({ create: { width: pw, height: ph, channels: 3, background: BG } })
    .composite([{ input: await sharp(SOURCE).resize(Math.round(Math.min(pw, ph) * 0.3), Math.round(Math.min(pw, ph) * 0.3), { fit: 'cover' }).png().toBuffer(), gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(`${root}public/${file}`)
  links.push(`    <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="${file}" />`)
}

const htmlPath = `${root}index.html`
const html = await readFile(htmlPath, 'utf8')
const next = html.replace(/(<!-- splash:start -->)[\s\S]*?(<!-- splash:end -->)/, `$1\n${links.join('\n')}\n    $2`)
await writeFile(htmlPath, next)
console.log(`Generated image icons and ${devices.length} splash screens.`)

