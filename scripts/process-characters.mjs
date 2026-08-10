/**
 * Chroma-key character plates (magenta) → transparent PNGs for the arena.
 * Usage: node scripts/process-characters.mjs
 */
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sessionImg =
  'C:/Users/E-Store/.grok/sessions/C%3A%5CUsers%5CE-Store/019fc901-f8c8-7df1-b482-8c0b4252f656/images'
const outDir = path.resolve(__dirname, '../public/art/characters')
const copyDir = path.resolve(__dirname, '../images/characters')

fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(copyDir, { recursive: true })

/** Map source session files → public names */
const MAP = [
  { src: '4.jpg', out: 'body-starter-idle.png' },
  { src: '8.jpg', out: 'body-starter-punch.png' },
  { src: '9.jpg', out: 'body-starter-kick.png' },
  { src: '2.jpg', out: 'body-inquisition-idle.png' },
  { src: '10.jpg', out: 'body-inquisition-punch.png' },
  { src: '1.jpg', out: 'body-inquiry-idle.png' },
  { src: '5.jpg', out: 'body-reborn-idle.png' },
  { src: '3.jpg', out: 'body-bridge-idle.png' },
  { src: '6.jpg', out: 'body-ember-idle.png' },
  { src: '7.jpg', out: 'body-void-idle.png' },
]

/** Magenta key: high R+B, low G, or pure pink screens */
function isKey(r, g, b) {
  // pure #FF00FF family
  if (r > 180 && b > 180 && g < 120) return true
  // bright magenta / hot pink bg
  if (r > 200 && b > 140 && g < 100) return true
  // near-white-pink overspill near edges
  if (r > 220 && g < 90 && b > 200) return true
  // distance to #FF00FF
  const dr = r - 255
  const dg = g - 0
  const db = b - 255
  const dist = Math.sqrt(dr * dr + dg * dg + db * db)
  if (dist < 95) return true
  // chroma: magenta has high R and B relative to G
  if (r > 160 && b > 160 && g < r * 0.55 && g < b * 0.55) return true
  return false
}

async function processOne(srcName, outName) {
  const srcPath = path.join(sessionImg, srcName)
  if (!fs.existsSync(srcPath)) {
    console.error('MISSING', srcPath)
    return false
  }
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const out = Buffer.alloc(width * height * 4)

  for (let i = 0; i < width * height; i++) {
    const o = i * channels
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    const a = channels === 4 ? data[o + 3] : 255
    const dest = i * 4
    if (isKey(r, g, b)) {
      out[dest] = 0
      out[dest + 1] = 0
      out[dest + 2] = 0
      out[dest + 3] = 0
    } else {
      // slight fringe despill: pull magenta fringe toward neutral
      let rr = r
      let gg = g
      let bb = b
      if (r > 150 && b > 150 && g < 160) {
        const spill = Math.min(r, b) - g
        if (spill > 20) {
          rr = Math.max(0, r - spill * 0.45)
          bb = Math.max(0, b - spill * 0.45)
          gg = Math.min(255, g + spill * 0.15)
        }
      }
      out[dest] = rr
      out[dest + 1] = gg
      out[dest + 2] = bb
      out[dest + 3] = a
    }
  }

  const png = await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer()

  const dest1 = path.join(outDir, outName)
  const dest2 = path.join(copyDir, outName)
  fs.writeFileSync(dest1, png)
  fs.writeFileSync(dest2, png)
  console.log('OK', outName, `${width}x${height}`)
  return true
}

let ok = 0
for (const m of MAP) {
  if (await processOne(m.src, m.out)) ok++
}
console.log(`Processed ${ok}/${MAP.length}`)
if (ok < MAP.length) process.exitCode = 1
