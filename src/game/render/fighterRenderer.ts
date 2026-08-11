/**
 * Realistic collection-aware fighter renderer.
 * Volumetric limbs + NFT face/chest identity — not stick figures or floating portraits.
 *
 * Per collection (Inquiry / Inquisition / Reborn / Bridge / Starter):
 * distinct proportions, skin, armor, aura.
 */

import type { FighterAnimState, JointPose } from './types'
import { directAnim } from './animDirector'
import { getCollectionLook, type CollectionLook } from './collectionLooks'
import { getBakedFrame, ensureFramePacksBaked } from './frameBake'
import {
  bodyUrlFor,
  clipToBodyPose,
  loadCharacterBody,
} from '../../lib/characterBodies'

const DEG = Math.PI / 180
function deg(a: number): number {
  return a * DEG
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.slice(0, 6),
    16,
  )
  if (!Number.isFinite(n)) return [180, 140, 100]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function shade(hex: string, amt: number): string {
  const [r, g, b] = hexRgb(hex)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)))
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

/** Filled tapered limb (muscle/armor tube) — A1 volumetric, not a stick. */
function drawLimb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  ang: number,
  len: number,
  thick0: number,
  thick1: number,
  c0: string,
  c1: string,
): { x: number; y: number } {
  const x1 = x0 + Math.sin(ang) * len
  const y1 = y0 + Math.cos(ang) * len
  const px = Math.cos(ang)
  const py = -Math.sin(ang)
  // mid bulge for muscle volume
  const mid = 0.48
  const xm = x0 + Math.sin(ang) * len * mid
  const ym = y0 + Math.cos(ang) * len * mid
  const tm = Math.max(thick0, thick1) * 1.12

  ctx.save()
  // soft contact shadow under limb
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath()
  ctx.moveTo(x0 + px * thick0 * 0.3 + 2.5, y0 + py * thick0 * 0.3 + 3.5)
  ctx.lineTo(x1 + px * thick1 * 0.3 + 2.5, y1 + py * thick1 * 0.3 + 3.5)
  ctx.lineTo(x1 - px * thick1 * 0.3 + 2.5, y1 - py * thick1 * 0.3 + 3.5)
  ctx.lineTo(x0 - px * thick0 * 0.3 + 2.5, y0 - py * thick0 * 0.3 + 3.5)
  ctx.closePath()
  ctx.fill()

  // main volume (3-stop lighting)
  const g = ctx.createLinearGradient(
    x0 - px * thick0,
    y0 - py * thick0,
    x0 + px * thick0,
    y0 + py * thick0,
  )
  g.addColorStop(0, shade(c0, 42))
  g.addColorStop(0.35, shade(c0, 12))
  g.addColorStop(0.55, c0)
  g.addColorStop(0.82, c1)
  g.addColorStop(1, shade(c1, -28))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(x0 + px * thick0, y0 + py * thick0)
  ctx.quadraticCurveTo(xm + px * tm, ym + py * tm, x1 + px * thick1, y1 + py * thick1)
  ctx.lineTo(x1 - px * thick1, y1 - py * thick1)
  ctx.quadraticCurveTo(xm - px * tm, ym - py * tm, x0 - px * thick0, y0 - py * thick0)
  ctx.closePath()
  ctx.fill()

  // specular ridge
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = Math.max(1, thick0 * 0.22)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x0 + px * thick0 * 0.35, y0 + py * thick0 * 0.35)
  ctx.lineTo(x1 + px * thick1 * 0.35, y1 + py * thick1 * 0.35)
  ctx.stroke()

  // ink outline (SF readability)
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.lineWidth = 1.15
  ctx.beginPath()
  ctx.moveTo(x0 + px * thick0, y0 + py * thick0)
  ctx.quadraticCurveTo(xm + px * tm, ym + py * tm, x1 + px * thick1, y1 + py * thick1)
  ctx.lineTo(x1 - px * thick1, y1 - py * thick1)
  ctx.quadraticCurveTo(xm - px * tm, ym - py * tm, x0 - px * thick0, y0 - py * thick0)
  ctx.closePath()
  ctx.stroke()

  // joint spheres
  const jg = ctx.createRadialGradient(x1 - 2, y1 - 2, 1, x1, y1, thick1 * 1.15)
  jg.addColorStop(0, shade(c0, 48))
  jg.addColorStop(0.55, c0)
  jg.addColorStop(1, shade(c1, -20))
  ctx.fillStyle = jg
  ctx.beginPath()
  ctx.arc(x1, y1, thick1 * 0.98, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
  return { x: x1, y: y1 }
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  pose: JointPose,
  look: CollectionLook,
  color: string,
  color2: string,
  sprite: CanvasImageSource | null,
): void {
  const h = 82 * look.height
  const w = 48 * look.bulk
  ctx.save()
  ctx.rotate(deg(pose.torso))

  // torso body
  const g = ctx.createLinearGradient(-w / 2, -h, w / 2, 8)
  g.addColorStop(0, shade(color, 20))
  g.addColorStop(0.4, color)
  g.addColorStop(0.75, color2)
  g.addColorStop(1, shade(color2, -40))
  ctx.fillStyle = g
  roundRect(ctx, -w / 2, -h, w, h + 6, 16)

  // pectoral / muscle hint
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.ellipse(-10, -h * 0.55, 11, 16, -0.25, 0, Math.PI * 2)
  ctx.ellipse(10, -h * 0.55, 11, 16, 0.25, 0, Math.PI * 2)
  ctx.fill()

  // Collection armor overlay
  if (look.armor === 'plate' || look.armor === 'divine') {
    ctx.strokeStyle =
      look.armor === 'divine' ? 'rgba(253,230,138,0.75)' : 'rgba(200,200,210,0.55)'
    ctx.lineWidth = 2
    ctx.strokeRect(-w / 2 + 6, -h + 10, w - 12, h * 0.45)
    // pauldron tips
    ctx.fillStyle = look.armor === 'divine' ? 'rgba(251,191,36,0.45)' : 'rgba(160,160,170,0.4)'
    ctx.beginPath()
    ctx.ellipse(-w / 2 - 2, -h + 18, 10, 14, 0.3, 0, Math.PI * 2)
    ctx.ellipse(w / 2 + 2, -h + 18, 10, 14, -0.3, 0, Math.PI * 2)
    ctx.fill()
  } else if (look.armor === 'reborn') {
    ctx.strokeStyle = 'rgba(167,139,250,0.6)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.strokeRect(-w / 2 + 8, -h + 14, w - 16, h * 0.4)
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(124,58,237,0.25)'
    ctx.fillRect(-6, -h * 0.5, 12, 20)
  } else if (look.armor === 'leather' || look.armor === 'recruit') {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-w / 2 + 8, -h + 20)
    ctx.lineTo(w / 2 - 8, -h + 20)
    ctx.stroke()
  }

  // NFT chest identity plate
  if (look.chestPlate && sprite) {
    const cw = w * 0.72
    const ch = h * 0.42
    const cx = -cw / 2
    const cy = -h * 0.72
    ctx.save()
    roundRectPath(ctx, cx, cy, cw, ch, 10)
    ctx.clip()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.globalAlpha = 0.92
    ctx.drawImage(sprite, cx - 4, cy - ch * 0.15, cw + 8, ch * 1.35)
    ctx.globalAlpha = 1
    ctx.restore()
    ctx.strokeStyle = look.outline
    ctx.lineWidth = 1.5
    roundRectPath(ctx, cx, cy, cw, ch, 10)
    ctx.stroke()
  }

  // belt
  ctx.fillStyle = look.boots
  ctx.fillRect(-w / 2 + 2, -10, w - 4, 12)
  ctx.fillStyle = color
  ctx.fillRect(-9, -10, 18, 12)
  // buckle glint
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillRect(-4, -7, 8, 6)

  ctx.restore()
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  pose: JointPose,
  look: CollectionLook,
  sprite: CanvasImageSource | null,
  color: string,
): void {
  const neckY = -80 * look.height
  const hr = 21 * look.faceScale * look.height
  ctx.save()
  ctx.translate(0, neckY)
  ctx.rotate(deg(pose.torso + pose.head))

  // neck
  const [s0, s1, s2] = look.skin
  const neckG = ctx.createLinearGradient(-6, 0, 6, 0)
  neckG.addColorStop(0, s2)
  neckG.addColorStop(0.5, s1)
  neckG.addColorStop(1, s2)
  ctx.fillStyle = neckG
  ctx.beginPath()
  ctx.ellipse(0, 2, 7, 12, 0, 0, Math.PI * 2)
  ctx.fill()

  // head sphere base (skin)
  const headG = ctx.createRadialGradient(-5, -hr - 6, 2, 0, -hr - 2, hr + 2)
  headG.addColorStop(0, s0)
  headG.addColorStop(0.55, s1)
  headG.addColorStop(1, s2)
  ctx.fillStyle = headG
  ctx.beginPath()
  ctx.arc(0, -hr - 2, hr + 1, 0, Math.PI * 2)
  ctx.fill()

  // NFT face (clipped oval — realistic portrait insert)
  if (sprite) {
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(0, -hr - 2, hr * 0.92, hr * 1.05, 0, 0, Math.PI * 2)
    ctx.clip()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    const size = hr * 2.35
    // Bias crop to upper face of NFT plate
    ctx.drawImage(sprite, -size / 2, -hr * 2.15, size, size * 1.15)
    ctx.restore()
    // soft rim
    ctx.strokeStyle = look.outline
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, -hr - 2, hr * 0.94, hr * 1.06, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else {
    // painted face fallback
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.ellipse(-6, -hr - 4, 2.4, 2.8, 0, 0, Math.PI * 2)
    ctx.ellipse(6, -hr - 4, 2.4, 2.8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.arc(-5.2, -hr - 5, 0.8, 0, Math.PI * 2)
    ctx.arc(6.8, -hr - 5, 0.8, 0, Math.PI * 2)
    ctx.fill()
  }

  // hair / crown by collection
  if (look.divine) {
    ctx.strokeStyle = look.aura || color
    ctx.lineWidth = 2.5
    ctx.shadowColor = look.aura || color
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.arc(0, -hr - 2, hr + 8, -Math.PI * 0.9, -Math.PI * 0.1)
    ctx.stroke()
    ctx.shadowBlur = 0
    // crown spikes
    ctx.fillStyle = look.aura || '#fbbf24'
    for (let i = -2; i <= 2; i++) {
      const a = -Math.PI / 2 + i * 0.28
      const x = Math.cos(a) * (hr + 6)
      const y = Math.sin(a) * (hr + 6) - hr - 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 3, y + 10)
      ctx.lineTo(x + 3, y + 10)
      ctx.fill()
    }
  } else if (look.tech) {
    ctx.strokeStyle = look.aura || '#a78bfa'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 2])
    ctx.beginPath()
    ctx.arc(0, -hr - 2, hr + 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.restore()
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  pose: JointPose,
  look: CollectionLook,
  color: string,
  color2: string,
  sprite: CanvasImageSource | null,
): void {
  const H = look.height
  const T = look.limbThick
  const shoulderY = -72 * H
  const hipY = -4

  const cloth0 = color || look.cloth[0]
  const cloth1 = color2 || look.cloth[1]
  const skin0 = look.skin[0]
  const skin1 = look.skin[1]
  const skin2 = look.skin[2]
  const boot = look.boots

  // Slightly longer limbs for readable SF silhouettes
  const armU = 34 * H
  const armL = 32 * H
  const legU = 42 * H
  const legL = 40 * H

  // —— Back arm
  const bSh = deg(pose.bShoulder)
  const bEl = deg(pose.bElbow)
  const b1 = drawLimb(
    ctx,
    -18 * look.bulk,
    shoulderY,
    bSh,
    armU,
    12.5 * T,
    10.5 * T,
    cloth1,
    cloth0,
  )
  const b2 = drawLimb(ctx, b1.x, b1.y, bSh + bEl, armL, 9.5 * T, 7.5 * T, skin1, skin2)
  // hand
  ctx.fillStyle = skin0
  ctx.beginPath()
  ctx.arc(b2.x, b2.y, 7 * T, 0, Math.PI * 2)
  ctx.fill()

  // —— Back leg
  const bH = deg(pose.bHip)
  const bK = deg(pose.bKnee)
  const bl1 = drawLimb(ctx, -12, hipY, bH, legU, 15 * T, 12 * T, cloth1, cloth0)
  const bl2 = drawLimb(ctx, bl1.x, bl1.y, bH + bK, legL, 12 * T, 9.5 * T, boot, shade(boot, 30))
  // foot points slightly forward in local space (reads as step)
  ctx.fillStyle = boot
  ctx.beginPath()
  ctx.ellipse(bl2.x + 6, bl2.y + 5, 13 * T, 6.5 * T, 0.15, 0, Math.PI * 2)
  ctx.fill()

  // —— Torso + head
  drawTorso(ctx, pose, look, cloth0, cloth1, sprite)
  drawHead(ctx, pose, look, sprite, cloth0)

  // —— Front leg
  const fH = deg(pose.fHip)
  const fK = deg(pose.fKnee)
  const fl1 = drawLimb(ctx, 12, hipY, fH, legU, 16 * T, 13 * T, cloth0, cloth1)
  const fl2 = drawLimb(ctx, fl1.x, fl1.y, fH + fK, legL, 13 * T, 10 * T, boot, shade(boot, 30))
  ctx.fillStyle = boot
  ctx.beginPath()
  ctx.ellipse(fl2.x + 7, fl2.y + 5, 14 * T, 7 * T, 0.15, 0, Math.PI * 2)
  ctx.fill()

  // —— Front arm (punch arm on top)
  const fSh = deg(pose.fShoulder)
  const fEl = deg(pose.fElbow)
  const f1 = drawLimb(
    ctx,
    18 * look.bulk,
    shoulderY,
    fSh,
    armU,
    13.5 * T,
    11.5 * T,
    cloth0,
    cloth1,
  )
  const f2 = drawLimb(ctx, f1.x, f1.y, fSh + fEl, armL, 10.5 * T, 8.5 * T, skin1, skin2)
  // fist with knuckle highlight
  const fistG = ctx.createRadialGradient(f2.x - 2, f2.y - 2, 1, f2.x, f2.y, 9)
  fistG.addColorStop(0, skin0)
  fistG.addColorStop(1, skin2)
  ctx.fillStyle = fistG
  ctx.beginPath()
  ctx.arc(f2.x, f2.y, 8 * T, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  ctx.arc(f2.x - 2, f2.y - 2, 2.5, 0, Math.PI * 2)
  ctx.fill()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fill()
}

function roundRectPath(
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
}

function collectionFromState(p: FighterAnimState): CollectionLook {
  const f = p.fighter as {
    color: string
    color2: string
    image?: string
    category?: string
    collection?: string
    taxon?: number | null
    id?: string
    nftId?: string
  }
  return getCollectionLook({
    taxon: f.taxon,
    category: f.category,
    collection: f.collection,
    id: f.id,
    nftId: f.nftId,
    color: f.color,
    color2: f.color2,
  })
}

/** Track horizontal motion for walk clips without mutating engine state. */
const prevXByFighter = new WeakMap<object, number>()
/** Smooth facing flip so characters visibly turn (not hard snap). */
const visualFacingByFighter = new WeakMap<object, number>()

function resolveWalkSpeed(p: FighterAnimState): number {
  if (typeof p.walkSpeed === 'number') return Math.abs(p.walkSpeed)
  const key = p as object
  const prev = prevXByFighter.get(key)
  prevXByFighter.set(key, p.x)
  if (prev == null) return 0
  return Math.abs(p.x - prev)
}

/** Lerp display facing toward logical facing (−1…+1). */
function resolveVisualFacing(p: FighterAnimState): number {
  const key = p as object
  const target = p.facing
  let cur = visualFacingByFighter.get(key)
  if (cur == null || !Number.isFinite(cur)) cur = target
  // Fast turn: ~4 frames to flip at 60fps
  const next = cur + (target - cur) * 0.38
  // Snap when close
  const snapped = Math.abs(next - target) < 0.04 ? target : next
  visualFacingByFighter.set(key, snapped)
  // Never fully flatten to 0 (reads as disappear) — keep thin edge during flip
  if (Math.abs(snapped) < 0.22) return snapped >= 0 ? 0.22 : -0.22
  return snapped
}

/** Draw painted side-view character body (actual sprite art). */
function drawPaintedBody(
  ctx: CanvasRenderingContext2D,
  body: HTMLImageElement,
  pose: JointPose,
  look: CollectionLook,
  facing: 1 | -1,
  faceSprite: CanvasImageSource | null,
): void {
  // Target on-screen height ~210–240px for SF readability
  const targetH = 220 * look.height
  const iw = body.naturalWidth || body.width
  const ih = body.naturalHeight || body.height
  if (!iw || !ih) return
  const scale = targetH / ih
  const dw = iw * scale * pose.scaleX * look.bulk
  const dh = ih * scale * pose.scaleY

  ctx.save()
  ctx.imageSmoothingEnabled = true
  try {
    ctx.imageSmoothingQuality = 'high'
  } catch {
    /* ignore */
  }
  // Origin at feet center
  ctx.scale(facing, 1)
  ctx.drawImage(body, -dw / 2, -dh + pose.rootY * 0.35, dw, dh)

  // Optional NFT face inset (upper head region of sprite)
  if (faceSprite && look.faceScale > 0) {
    const faceSize = 36 * look.faceScale * look.height
    const fx = -faceSize * 0.15
    const fy = -dh * 0.72
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(fx + faceSize * 0.35, fy + faceSize * 0.45, faceSize * 0.42, faceSize * 0.48, 0, 0, Math.PI * 2)
    ctx.clip()
    ctx.globalAlpha = 0.92
    ctx.drawImage(faceSprite, fx, fy, faceSize * 0.9, faceSize * 1.05)
    ctx.restore()
    ctx.strokeStyle = look.outline
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(fx + faceSize * 0.35, fy + faceSize * 0.45, faceSize * 0.42, faceSize * 0.48, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/** Main draw entry — actual painted characters first, procedural fallback. */
export function drawFighterArticulated(
  ctx: CanvasRenderingContext2D,
  p: FighterAnimState,
  frame: number,
  sprite: CanvasImageSource | null,
): void {
  const look = collectionFromState(p)
  const { color, color2 } = p.fighter
  const walkSpeed = resolveWalkSpeed(p)
  const animState: FighterAnimState = { ...p, walkSpeed }
  const dir = directAnim(animState, frame)
  const pose = dir.pose
  /** Smooth turn toward opponent — characters visibly flip sides */
  const f = resolveVisualFacing(p)
  const H = look.height

  // Kick off multi-frame pack bake once (idle lobby / first fight)
  void ensureFramePacksBaked()
  void loadCharacterBody(bodyUrlFor(p.fighter, clipToBodyPose(dir.clipId)))

  // Prefer baked multi-frame pack when ready (Phase 3 sprite-sheet path)
  const baked = getBakedFrame(look.id, dir.clipId, dir.t)

  // Contact shadow (double ring for depth) — stretch slightly with facing
  const faceAbs = Math.abs(f)
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.58)'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 5, 42 * pose.scaleX * look.bulk * faceAbs, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.24)'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 7, 62 * pose.scaleX * faceAbs, 16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Floor reflection
  if (!p.dead && p.y > 300) {
    ctx.save()
    ctx.translate(p.x, p.y + 8)
    ctx.globalAlpha = 0.14
    if (baked) {
      ctx.scale(f, -0.28)
      const bh = 200 * look.height
      const bw = (baked.width / baked.height) * bh
      ctx.drawImage(baked, -bw / 2, -8, bw, bh)
    } else {
      ctx.scale(f * pose.scaleX * look.height * 0.92, -pose.scaleY * look.height * 0.35)
      ctx.filter = 'blur(0.5px)'
      drawBody(ctx, pose, look, color, color2, null)
      ctx.filter = 'none'
    }
    ctx.restore()
  }

  // Collection aura (gods / reborn)
  if (look.divine || look.tech) {
    ctx.save()
    ctx.globalAlpha = 0.22 + Math.sin(frame / 12) * 0.07
    const ag = ctx.createRadialGradient(p.x, p.y - 90 * H, 10, p.x, p.y - 70, 95 * H)
    ag.addColorStop(0, look.aura || color)
    ag.addColorStop(0.55, `${look.aura || color}55`)
    ag.addColorStop(1, 'transparent')
    ctx.fillStyle = ag
    ctx.beginPath()
    ctx.arc(p.x, p.y - 70 * H, 88 * H, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Afterimages (specials / dash)
  if (
    p.attackKind === 'special' ||
    p.attackKind === 'secret' ||
    p.attackKind === 'super' ||
    p.attackKind === 'dash'
  ) {
    for (let i = 3; i >= 1; i--) {
      ctx.save()
      ctx.globalAlpha = 0.12 * i
      ctx.translate(p.x - f * i * 16, p.y + pose.rootY)
      if (baked) {
        ctx.scale(f, 1)
        const bh = 210 * look.height
        const bw = (baked.width / baked.height) * bh
        ctx.drawImage(baked, -bw / 2, -bh + 8, bw, bh)
      } else {
        ctx.scale(f * pose.scaleX * look.height, pose.scaleY * look.height)
        drawBody(ctx, pose, look, color, color2, null)
      }
      ctx.restore()
    }
  }

  ctx.save()
  ctx.translate(p.x, p.y + pose.rootY)

  if (p.flash > 0) {
    ctx.shadowColor = '#fff'
    ctx.shadowBlur = 36
  } else if (p.attackKind === 'secret' || p.attackKind === 'super') {
    ctx.shadowColor = look.aura || color
    ctx.shadowBlur = 28
  } else if (p.attackKind) {
    ctx.shadowColor = color2
    ctx.shadowBlur = 16
  }

  if (baked) {
    // Multi-frame pack playback — feet at origin
    ctx.scale(f, 1)
    if (dir.clipId === 'walk') ctx.translate(0, Math.sin(frame * 0.65) * 2)
    if (p.dead) {
      ctx.rotate(0.2)
      ctx.translate(0, 16)
    }
    const bh = 220 * look.height * pose.scaleY
    const bw = (baked.width / baked.height) * bh * pose.scaleX * look.bulk
    ctx.imageSmoothingEnabled = true
    try {
      ctx.imageSmoothingQuality = 'high'
    } catch {
      /* ignore */
    }
    ctx.drawImage(baked, -bw / 2, -bh + 6, bw, bh)
    // NFT face inset on baked frame
    if (sprite) {
      const faceSize = 38 * look.faceScale * look.height
      const fx = -faceSize * 0.05
      const fy = -bh * 0.7
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(
        fx + faceSize * 0.35,
        fy + faceSize * 0.42,
        faceSize * 0.4,
        faceSize * 0.46,
        0,
        0,
        Math.PI * 2,
      )
      ctx.clip()
      ctx.globalAlpha = 0.94
      ctx.drawImage(sprite, fx, fy, faceSize * 0.9, faceSize * 1.05)
      ctx.restore()
    }
  } else {
    // Live articulated fallback while packs bake
    ctx.scale(f * pose.scaleX * look.height, pose.scaleY * look.height)
    if (dir.clipId === 'walk') {
      ctx.translate(0, Math.sin(frame * 0.65) * 2.4)
    } else if (dir.clipId === 'idle') {
      ctx.translate(0, Math.sin(frame / 12) * 1.3)
    }
    if (p.dead) {
      ctx.rotate(0.22)
      ctx.translate(0, 18)
    }
    ctx.save()
    ctx.globalAlpha = 0.32
    ctx.shadowColor = look.outline || '#000'
    ctx.shadowBlur = 12
    drawBody(ctx, pose, look, shade(color, -60), shade(color2, -50), null)
    ctx.restore()
    drawBody(ctx, pose, look, color, color2, sprite)
  }
  ctx.shadowBlur = 0

  // Active attack trail
  if (p.attackKind && p.activeMove) {
    const u = p.attackFrame / Math.max(1, p.activeMove.frames)
    const active =
      p.attackFrame >= p.activeMove.activeStart && p.attackFrame <= p.activeMove.activeEnd
    if (active || (u > 0.25 && u < 0.65)) {
      const reach = p.activeMove.reach * 0.55
      const y0 = p.attackKind === 'kick' ? -70 : -110
      const x0 = f * 28
      const grd = ctx.createLinearGradient(x0, y0, x0 + f * reach, y0)
      grd.addColorStop(0, p.activeMove.colorHint || look.aura || color)
      grd.addColorStop(0.35, 'rgba(255,255,255,0.65)')
      grd.addColorStop(1, 'transparent')
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.ellipse(
        x0 + f * reach * 0.35,
        y0,
        reach * 0.48,
        p.attackKind === 'kick' ? 15 : 10,
        0.12 * f,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }

  if (p.blocking && !p.attackKind) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 3.5
    ctx.shadowColor = '#fff'
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.ellipse(f * 30, -90, 11, 38, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  ctx.restore()

  // Collection label chip (small, only first seconds / when idle)
  if (!p.attackKind && frame < 90) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, 1 - frame / 90) * 0.85
    ctx.font = 'bold 10px system-ui,Segoe UI,sans-serif'
    ctx.textAlign = 'center'
    const label = look.label
    const tw = ctx.measureText(label).width + 12
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    roundRect(ctx, p.x - tw / 2, p.y + pose.rootY - 195 * look.height, tw, 16, 6)
    ctx.fillStyle = look.aura || color
    ctx.fillText(label, p.x, p.y + pose.rootY - 183 * look.height)
    ctx.restore()
  }

  // Move banner
  if (p.lastMoveBanner > 0 && p.lastMoveName) {
    ctx.save()
    ctx.font = 'bold 13px system-ui,Segoe UI,sans-serif'
    ctx.textAlign = 'center'
    ctx.globalAlpha = Math.min(1, p.lastMoveBanner / 18)
    const tw = ctx.measureText(p.lastMoveName).width + 18
    const by = p.y + pose.rootY - 178 * look.height
    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    roundRect(ctx, p.x - tw / 2, by, tw, 20, 8)
    ctx.fillStyle = p.activeMove?.colorHint || look.aura || color
    ctx.fillText(p.lastMoveName, p.x, by + 14)
    ctx.restore()
  }
}

export function drawFighterSf(
  ctx: CanvasRenderingContext2D,
  p: FighterAnimState,
  frame: number,
  sprite: CanvasImageSource | null,
): void {
  drawFighterArticulated(ctx, p, frame, sprite)
}
