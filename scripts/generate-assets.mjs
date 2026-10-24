/* Generates the favicon, app icons and iOS splash screens from the Kalyxis mark.
 * Run with: npm run assets   (the generated files are committed, so this is only needed after a design change) */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const BG = '#08090c'
const RING = '#cdd3d8'
const STAR = '#d6c38f'

const mark = (size, { bg = BG, pad = 0, rounded = false } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  ${bg ? `<rect width="100" height="100" ${rounded ? 'rx="22"' : ''} fill="${bg}"/>` : ''}
  <g transform="translate(${pad} ${pad}) scale(${(100 - pad * 2) / 100})">
    <circle cx="50" cy="50" r="46" fill="none" stroke="${RING}" stroke-width="2" opacity="0.9"/>
    <circle cx="50" cy="50" r="33" fill="none" stroke="${RING}" stroke-width="1" opacity="0.4"/>
    <path d="M50 18 L53.2 46.8 L82 50 L53.2 53.2 L50 82 L46.8 53.2 L18 50 L46.8 46.8 Z" fill="${STAR}"/>
  </g>
</svg>`

const png = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(`${root}public/${file}`)

await mkdir(`${root}public/splash`, { recursive: true })

await writeFile(`${root}public/favicon.svg`, mark(64, { pad: 6, rounded: true }).trim() + '\n')
await png(mark(192, { pad: 14 }), 'icon-192.png')
await png(mark(512, { pad: 14 }), 'icon-512.png')
await png(mark(512, { pad: 26 }), 'icon-maskable-512.png')
await png(mark(180, { pad: 14 }), 'apple-touch-icon.png')

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
  const logo = Math.round(Math.min(pw, ph) * 0.3)
  const file = `splash/${pw}x${ph}.png`
  const markSvg = mark(logo, { bg: null, pad: 0 })
  await sharp({ create: { width: pw, height: ph, channels: 4, background: BG } })
    .composite([{ input: Buffer.from(markSvg), gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(`${root}public/${file}`)
  links.push(
    `    <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="${file}" />`,
  )
}

const htmlPath = `${root}index.html`
const html = await readFile(htmlPath, 'utf8')
const next = html.replace(/(<!-- splash:start -->)[\s\S]*?(<!-- splash:end -->)/, `$1\n${links.join('\n')}\n    $2`)
await writeFile(htmlPath, next)
console.log(`Generated icons and ${devices.length} splash screens.`)
