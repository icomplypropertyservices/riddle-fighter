/**
 * Client-side portrait plates for specialists (no external art files).
 * Produces 512×512 data URLs that look like painted fighters, not blobs.
 */

const portraitCache = new Map<string, string>()

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgb(r: number, g: number, b: number, a = 1): string {
  return `rgba(${r|0},${g|0},${b|0},${a})`
}

/** Generate a painted humanoid fighter portrait as data URL. */
export function generateFighterPortrait(
  id: string,
  color: string,
  color2: string,
  name: string,
): string {
  const hit = portraitCache.get(id)
  if (hit) return hit
  if (typeof document === 'undefined') return ''

  const size = 512
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  if (!ctx) return ''

  const [r1, g1, b1] = hexToRgb(color)
  const [r2, g2, b2] = hexToRgb(color2)

  // Transparent plate — only the fighter body (no card background)
  ctx.clearRect(0, 0, size, size)

  const cx = size * 0.5
  const ground = size * 0.92

  // Contact shadow
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  ctx.ellipse(cx, ground, 110, 28, 0, 0, Math.PI * 2)
  ctx.fill()

  // Legs
  const legGrad = ctx.createLinearGradient(cx, size * 0.55, cx, ground)
  legGrad.addColorStop(0, rgb(r2, g2, b2))
  legGrad.addColorStop(1, rgb(r2 * 0.25, g2 * 0.25, b2 * 0.3))
  ctx.fillStyle = legGrad
  // left leg
  roundedLimb(ctx, cx - 38, size * 0.52, 36, 150, 16)
  // right leg
  roundedLimb(ctx, cx + 2, size * 0.52, 36, 150, 16)

  // Boots
  ctx.fillStyle = rgb(20, 18, 28)
  roundedLimb(ctx, cx - 42, size * 0.78, 44, 55, 12)
  roundedLimb(ctx, cx - 2, size * 0.78, 44, 55, 12)

  // Torso
  const torso = ctx.createLinearGradient(cx, size * 0.28, cx, size * 0.62)
  torso.addColorStop(0, rgb(r1, g1, b1))
  torso.addColorStop(0.45, rgb((r1 + r2) / 2, (g1 + g2) / 2, (b1 + b2) / 2))
  torso.addColorStop(1, rgb(r2 * 0.45, g2 * 0.45, b2 * 0.5))
  ctx.fillStyle = torso
  roundRect(ctx, cx - 72, size * 0.3, 144, 160, 28)
  // chest highlight
  const chest = ctx.createRadialGradient(cx - 18, size * 0.38, 8, cx - 10, size * 0.42, 70)
  chest.addColorStop(0, 'rgba(255,255,255,0.22)')
  chest.addColorStop(1, 'transparent')
  ctx.fillStyle = chest
  ctx.fillRect(cx - 72, size * 0.3, 144, 160)

  // Belt
  ctx.fillStyle = rgb(r2 * 0.5, g2 * 0.5, b2 * 0.55)
  ctx.fillRect(cx - 70, size * 0.54, 140, 14)
  ctx.fillStyle = rgb(r1, g1, b1)
  ctx.beginPath()
  ctx.arc(cx, size * 0.547, 10, 0, Math.PI * 2)
  ctx.fill()

  // Arms
  const armG = ctx.createLinearGradient(0, size * 0.32, 0, size * 0.58)
  armG.addColorStop(0, rgb(r1 * 0.9, g1 * 0.9, b1 * 0.95))
  armG.addColorStop(1, rgb(r2 * 0.5, g2 * 0.5, b2 * 0.55))
  ctx.fillStyle = armG
  // left arm
  ctx.save()
  ctx.translate(cx - 78, size * 0.36)
  ctx.rotate(-0.25)
  roundedLimb(ctx, -18, 0, 36, 130, 16)
  ctx.restore()
  // right arm
  ctx.save()
  ctx.translate(cx + 78, size * 0.36)
  ctx.rotate(0.25)
  roundedLimb(ctx, -18, 0, 36, 130, 16)
  ctx.restore()

  // Hands
  ctx.fillStyle = rgb(196, 140, 108)
  ctx.beginPath()
  ctx.ellipse(cx - 105, size * 0.6, 16, 18, -0.2, 0, Math.PI * 2)
  ctx.ellipse(cx + 105, size * 0.6, 16, 18, 0.2, 0, Math.PI * 2)
  ctx.fill()

  // Neck
  ctx.fillStyle = rgb(180, 120, 90)
  roundRect(ctx, cx - 16, size * 0.26, 32, 28, 8)

  // Head
  const skin = ctx.createRadialGradient(cx - 12, size * 0.18, 10, cx, size * 0.2, 55)
  skin.addColorStop(0, rgb(232, 190, 160))
  skin.addColorStop(0.65, rgb(200, 145, 110))
  skin.addColorStop(1, rgb(140, 90, 65))
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(cx, size * 0.2, 48, 56, 0, 0, Math.PI * 2)
  ctx.fill()

  // Hair / helmet plate from primary color
  ctx.fillStyle = rgb(r2 * 0.6, g2 * 0.55, b2 * 0.65)
  ctx.beginPath()
  ctx.ellipse(cx, size * 0.145, 50, 36, 0, Math.PI, 0)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx - 28, size * 0.17, 14, 28, -0.4, 0, Math.PI * 2)
  ctx.ellipse(cx + 28, size * 0.17, 14, 28, 0.4, 0, Math.PI * 2)
  ctx.fill()

  // Eyes
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.ellipse(cx - 16, size * 0.2, 5, 6, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + 16, size * 0.2, 5, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(cx - 14, size * 0.195, 1.8, 0, Math.PI * 2)
  ctx.arc(cx + 18, size * 0.195, 1.8, 0, Math.PI * 2)
  ctx.fill()

  // Mouth soft
  ctx.strokeStyle = rgb(120, 70, 55, 0.7)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, size * 0.235, 10, 0.15, Math.PI - 0.15)
  ctx.stroke()

  // Shoulder armor pads
  ctx.fillStyle = rgb(r1, g1, b1)
  ctx.beginPath()
  ctx.ellipse(cx - 70, size * 0.34, 28, 18, -0.3, 0, Math.PI * 2)
  ctx.ellipse(cx + 70, size * 0.34, 28, 18, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Soft ground shadow under feet only (transparent edges)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(cx, ground + 4, 95, 18, 0, 0, Math.PI * 2)
  ctx.fill()

  void name // reserved for future name tag art
  const url = c.toDataURL('image/png')
  portraitCache.set(id, url)
  return url
}

function roundedLimb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  roundRect(ctx, x, y, w, h, r)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
  ctx.fill()
}
