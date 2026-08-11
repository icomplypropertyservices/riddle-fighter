/**
 * Multi-frame sprite packs — bake articulated poses to offscreen canvases
 * so each collection has a real walk/idle/attack frame strip at runtime.
 *
 * This is the Phase 3 "sprite sheet" pipeline without waiting on external art:
 * same SF silhouettes as live procedural, frozen as frame packs for stable playback.
 */

import type { CollectionLook, FighterCollectionId } from './collectionLooks'
import { LOOKS_FOR_BAKE } from './collectionLooks'
import { CLIPS, sampleClip } from './poseLibrary'
import type { AnimClipId, JointPose } from './types'

export type BakedClip = {
  clipId: AnimClipId
  frames: HTMLCanvasElement[]
  /** engine frames per full cycle (matches poseLibrary length) */
  length: number
  loop: boolean
}

export type BakedPack = {
  lookId: FighterCollectionId
  clips: Partial<Record<AnimClipId, BakedClip>>
  ready: boolean
}

const packs = new Map<FighterCollectionId, BakedPack>()
let baking = false
let bakePromise: Promise<void> | null = null

const FRAME_COUNTS: Partial<Record<AnimClipId, number>> = {
  idle: 8,
  walk: 10,
  crouch: 2,
  jump: 3,
  punch: 5,
  kick: 6,
  special: 6,
  secret: 7,
  dash: 4,
  block: 2,
  hit: 3,
  ko: 4,
}

/** Offscreen draw of one pose (mirrors fighterRenderer limb logic, simplified bake). */
function bakePoseFrame(
  pose: JointPose,
  look: CollectionLook,
  color: string,
  color2: string,
): HTMLCanvasElement {
  const W = 256
  const H = 384
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) return c
  ctx.clearRect(0, 0, W, H)
  ctx.imageSmoothingEnabled = true
  try {
    ctx.imageSmoothingQuality = 'high'
  } catch {
    /* ignore */
  }

  // Feet at bottom-center
  const originX = W / 2
  const originY = H - 28
  ctx.save()
  ctx.translate(originX, originY + pose.rootY)
  ctx.scale(pose.scaleX * look.height * 1.05, pose.scaleY * look.height * 1.05)

  // Soft contact shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath()
  ctx.ellipse(0, 6, 40 * look.bulk, 11, 0, 0, Math.PI * 2)
  ctx.fill()

  drawBakedBody(ctx, pose, look, color, color2)
  ctx.restore()
  return c
}

function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.slice(0, 6)
  const n = parseInt(full, 16)
  if (!Number.isFinite(n)) return hex
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `rgb(${r},${g},${b})`
}

function limb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  ang: number,
  len: number,
  t0: number,
  t1: number,
  c0: string,
  c1: string,
): { x: number; y: number } {
  const x1 = x0 + Math.sin(ang) * len
  const y1 = y0 + Math.cos(ang) * len
  const px = Math.cos(ang)
  const py = -Math.sin(ang)
  const xm = x0 + Math.sin(ang) * len * 0.48
  const ym = y0 + Math.cos(ang) * len * 0.48
  const tm = Math.max(t0, t1) * 1.1
  const g = ctx.createLinearGradient(x0 - px * t0, y0 - py * t0, x0 + px * t0, y0 + py * t0)
  g.addColorStop(0, shade(c0, 36))
  g.addColorStop(0.5, c0)
  g.addColorStop(1, shade(c1, -24))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(x0 + px * t0, y0 + py * t0)
  ctx.quadraticCurveTo(xm + px * tm, ym + py * tm, x1 + px * t1, y1 + py * t1)
  ctx.lineTo(x1 - px * t1, y1 - py * t1)
  ctx.quadraticCurveTo(xm - px * tm, ym - py * tm, x0 - px * t0, y0 - py * t0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 1.1
  ctx.stroke()
  ctx.fillStyle = shade(c0, 20)
  ctx.beginPath()
  ctx.arc(x1, y1, t1 * 0.95, 0, Math.PI * 2)
  ctx.fill()
  return { x: x1, y: y1 }
}

function drawBakedBody(
  ctx: CanvasRenderingContext2D,
  pose: JointPose,
  look: CollectionLook,
  color: string,
  color2: string,
): void {
  const DEG = Math.PI / 180
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
  const armU = 34 * H
  const armL = 32 * H
  const legU = 42 * H
  const legL = 40 * H

  const bSh = pose.bShoulder * DEG
  const bEl = pose.bElbow * DEG
  const b1 = limb(ctx, -18 * look.bulk, shoulderY, bSh, armU, 12 * T, 10 * T, cloth1, cloth0)
  const b2 = limb(ctx, b1.x, b1.y, bSh + bEl, armL, 9 * T, 7 * T, skin1, skin2)
  ctx.fillStyle = skin0
  ctx.beginPath()
  ctx.arc(b2.x, b2.y, 6.5 * T, 0, Math.PI * 2)
  ctx.fill()

  const bH = pose.bHip * DEG
  const bK = pose.bKnee * DEG
  const bl1 = limb(ctx, -12, hipY, bH, legU, 15 * T, 12 * T, cloth1, cloth0)
  const bl2 = limb(ctx, bl1.x, bl1.y, bH + bK, legL, 12 * T, 9 * T, boot, shade(boot, 28))
  ctx.fillStyle = boot
  ctx.beginPath()
  ctx.ellipse(bl2.x + 6, bl2.y + 5, 13 * T, 6.5 * T, 0.15, 0, Math.PI * 2)
  ctx.fill()

  // torso
  const th = 82 * H
  const tw = 48 * look.bulk
  ctx.save()
  ctx.rotate(pose.torso * DEG)
  const tg = ctx.createLinearGradient(-tw / 2, -th, tw / 2, 8)
  tg.addColorStop(0, shade(cloth0, 18))
  tg.addColorStop(0.5, cloth0)
  tg.addColorStop(1, shade(cloth1, -30))
  ctx.fillStyle = tg
  roundRect(ctx, -tw / 2, -th, tw, th + 6, 16)
  ctx.fillStyle = boot
  ctx.fillRect(-tw / 2 + 2, -10, tw - 4, 12)
  ctx.restore()

  // head
  const neckY = -80 * H
  const hr = 21 * look.faceScale * H
  ctx.save()
  ctx.translate(0, neckY)
  ctx.rotate((pose.torso + pose.head) * DEG)
  const headG = ctx.createRadialGradient(-5, -hr - 6, 2, 0, -hr - 2, hr + 2)
  headG.addColorStop(0, skin0)
  headG.addColorStop(0.55, skin1)
  headG.addColorStop(1, skin2)
  ctx.fillStyle = headG
  ctx.beginPath()
  ctx.arc(0, -hr - 2, hr + 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.ellipse(-6, -hr - 4, 2.4, 2.8, 0, 0, Math.PI * 2)
  ctx.ellipse(6, -hr - 4, 2.4, 2.8, 0, 0, Math.PI * 2)
  ctx.fill()
  if (look.divine) {
    ctx.strokeStyle = look.aura || cloth0
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(0, -hr - 2, hr + 8, -Math.PI * 0.9, -Math.PI * 0.1)
    ctx.stroke()
  }
  ctx.restore()

  const fH = pose.fHip * DEG
  const fK = pose.fKnee * DEG
  const fl1 = limb(ctx, 12, hipY, fH, legU, 16 * T, 13 * T, cloth0, cloth1)
  const fl2 = limb(ctx, fl1.x, fl1.y, fH + fK, legL, 13 * T, 10 * T, boot, shade(boot, 28))
  ctx.fillStyle = boot
  ctx.beginPath()
  ctx.ellipse(fl2.x + 7, fl2.y + 5, 14 * T, 7 * T, 0.15, 0, Math.PI * 2)
  ctx.fill()

  const fSh = pose.fShoulder * DEG
  const fEl = pose.fElbow * DEG
  const f1 = limb(ctx, 18 * look.bulk, shoulderY, fSh, armU, 13 * T, 11 * T, cloth0, cloth1)
  const f2 = limb(ctx, f1.x, f1.y, fSh + fEl, armL, 10 * T, 8 * T, skin1, skin2)
  ctx.fillStyle = skin0
  ctx.beginPath()
  ctx.arc(f2.x, f2.y, 8 * T, 0, Math.PI * 2)
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

function bakeClip(look: CollectionLook, clipId: AnimClipId): BakedClip | null {
  const def = CLIPS[clipId]
  if (!def) return null
  const n = FRAME_COUNTS[clipId] ?? 4
  const frames: HTMLCanvasElement[] = []
  for (let i = 0; i < n; i++) {
    // For loops, sample evenly across 0..1; for one-shots land on last key
    const t01 = def.loop ? i / n : Math.min(1, i / Math.max(1, n - 1))
    const pose = sampleClip(def, t01)
    frames.push(bakePoseFrame(pose, look, look.cloth[0], look.cloth[1]))
  }
  return { clipId, frames, length: def.length, loop: def.loop }
}

function bakeLook(look: CollectionLook): BakedPack {
  const clips: Partial<Record<AnimClipId, BakedClip>> = {}
  const ids = Object.keys(FRAME_COUNTS) as AnimClipId[]
  for (const id of ids) {
    const c = bakeClip(look, id)
    if (c) clips[id] = c
  }
  return { lookId: look.id, clips, ready: true }
}

/** Kick off idle bake of every collection look (idle during lobby). */
export function ensureFramePacksBaked(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (bakePromise) return bakePromise
  baking = true
  bakePromise = new Promise((resolve) => {
    // Yield so first paint isn't blocked
    const run = () => {
      try {
        for (const look of LOOKS_FOR_BAKE) {
          if (!packs.has(look.id)) packs.set(look.id, bakeLook(look))
        }
      } finally {
        baking = false
        resolve()
      }
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => run(), { timeout: 1200 })
    } else {
      setTimeout(run, 0)
    }
  })
  return bakePromise
}

export function getBakedPack(lookId: FighterCollectionId): BakedPack | null {
  return packs.get(lookId) || null
}

export function getBakedFrame(
  lookId: FighterCollectionId,
  clipId: AnimClipId,
  t01: number,
): HTMLCanvasElement | null {
  const pack = packs.get(lookId)
  const clip = pack?.clips[clipId]
  if (!clip || !clip.frames.length) return null
  const n = clip.frames.length
  let idx: number
  if (clip.loop) {
    const u = ((t01 % 1) + 1) % 1
    idx = Math.min(n - 1, Math.floor(u * n))
  } else {
    idx = Math.min(n - 1, Math.floor(Math.min(1, Math.max(0, t01)) * (n - 1)))
  }
  return clip.frames[idx] || null
}

export function isBakingFrames(): boolean {
  return baking
}

/** Composite one look's walk strip for debug / export UI */
export function compositeWalkStrip(lookId: FighterCollectionId): HTMLCanvasElement | null {
  const pack = packs.get(lookId)
  const walk = pack?.clips.walk
  if (!walk?.frames.length) return null
  const fw = walk.frames[0]!.width
  const fh = walk.frames[0]!.height
  const sheet = document.createElement('canvas')
  sheet.width = fw * walk.frames.length
  sheet.height = fh
  const ctx = sheet.getContext('2d')
  if (!ctx) return null
  walk.frames.forEach((fr, i) => ctx.drawImage(fr, i * fw, 0))
  return sheet
}
