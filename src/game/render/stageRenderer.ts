/**
 * True 2D stage renderer — painted backdrop, parallax, floor plane, atmosphere.
 * Separated from engine so stage quality can iterate without touching sim.
 */

import {
  getStageImage,
  type StageId,
} from '../../lib/stageAssets'

export const STAGE_GROUND_Y = 420

/**
 * Draw full-bleed stage for one frame (logical 960×540).
 */
export function drawStageTrue2d(
  ctx: CanvasRenderingContext2D,
  frame: number,
  bgPulse: number,
  finishFlash: number,
  stageId: StageId,
  logicalW: number,
  logicalH: number,
): void {
  const ground = STAGE_GROUND_Y
  const painted = getStageImage(stageId)

  if (painted && painted.complete && painted.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = true
    try {
      ctx.imageSmoothingQuality = 'high'
    } catch {
      /* ignore */
    }

    const iw = painted.naturalWidth
    const ih = painted.naturalHeight
    // Subtle parallax drift (camera breathe)
    const px = Math.sin(frame / 180) * 6 + Math.sin(frame / 90) * 2
    const py = Math.cos(frame / 220) * 3
    const scale = Math.max(logicalW / iw, logicalH / ih) * 1.06
    const dw = iw * scale
    const dh = ih * scale
    ctx.drawImage(
      painted,
      (logicalW - dw) / 2 + px,
      (logicalH - dh) / 2 + py - 10,
      dw,
      dh,
    )

    // Cinematic top vignette
    const topShade = ctx.createLinearGradient(0, 0, 0, 140)
    topShade.addColorStop(0, 'rgba(0,0,0,0.55)')
    topShade.addColorStop(0.55, 'rgba(0,0,0,0.18)')
    topShade.addColorStop(1, 'transparent')
    ctx.fillStyle = topShade
    ctx.fillRect(0, 0, logicalW, 140)

    // Floor contact plane (readability — feet always sit here)
    const floorLift = ctx.createLinearGradient(0, ground - 50, 0, ground + 30)
    floorLift.addColorStop(0, 'transparent')
    floorLift.addColorStop(0.45, 'rgba(5,5,12,0.25)')
    floorLift.addColorStop(1, 'rgba(5,5,12,0.72)')
    ctx.fillStyle = floorLift
    ctx.fillRect(0, ground - 50, logicalW, logicalH - (ground - 50))

    // Neon ground line
    ctx.fillStyle =
      finishFlash > 0
        ? 'rgba(244,114,182,0.9)'
        : bgPulse > 0
          ? 'rgba(167,139,250,0.92)'
          : 'rgba(139,92,246,0.78)'
    ctx.shadowColor = finishFlash > 0 ? '#f472b6' : '#a78bfa'
    ctx.shadowBlur = 18
    ctx.fillRect(0, ground, logicalW, 3)
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(34,211,238,0.4)'
    ctx.fillRect(0, ground + 3, logicalW, 1)

    // Floor reflection strip (fighters draw their own mirror above this)
    const reflect = ctx.createLinearGradient(0, ground + 4, 0, ground + 70)
    reflect.addColorStop(0, 'rgba(139,92,246,0.12)')
    reflect.addColorStop(1, 'transparent')
    ctx.fillStyle = reflect
    ctx.fillRect(0, ground + 4, logicalW, 70)

    // Distant dust motes (cheap atmosphere)
    ctx.save()
    ctx.globalAlpha = 0.18
    for (let i = 0; i < 14; i++) {
      const mx = ((i * 97 + frame * (0.35 + (i % 3) * 0.08)) % (logicalW + 40)) - 20
      const my = 80 + ((i * 53) % 200) + Math.sin(frame / 40 + i) * 6
      const r = 1.2 + (i % 4) * 0.5
      ctx.fillStyle = i % 2 === 0 ? '#c4b5fd' : '#67e8f9'
      ctx.beginPath()
      ctx.arc(mx, my, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Crowd silhouettes along rails (parallax slower than stage drift)
    ctx.save()
    ctx.globalAlpha = 0.22
    ctx.fillStyle = '#0a0814'
    for (let i = 0; i < 18; i++) {
      const cx =
        ((i * 58 + frame * 0.12) % (logicalW + 80)) - 40
      const baseY = ground - 8
      const h = 18 + (i % 5) * 4
      // body
      ctx.beginPath()
      ctx.ellipse(cx, baseY - h * 0.55, 7 + (i % 3), h * 0.45, 0, 0, Math.PI * 2)
      ctx.fill()
      // head
      ctx.beginPath()
      ctx.arc(cx, baseY - h, 4.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Mid parallax haze strip
    const mid = ctx.createLinearGradient(0, ground - 120, 0, ground - 40)
    mid.addColorStop(0, 'transparent')
    mid.addColorStop(0.5, 'rgba(99,102,241,0.06)')
    mid.addColorStop(1, 'transparent')
    ctx.fillStyle = mid
    ctx.fillRect(0, ground - 120, logicalW, 80)
  } else {
    drawProceduralFallback(ctx, frame, ground, logicalW, logicalH)
  }

  // Finish / pulse full-frame grade
  if (finishFlash > 0) {
    ctx.fillStyle = `rgba(244,114,182,${Math.min(0.35, finishFlash / 40)})`
    ctx.fillRect(0, 0, logicalW, logicalH)
  } else if (bgPulse > 0) {
    ctx.fillStyle = `rgba(139,92,246,${Math.min(0.18, bgPulse / 30)})`
    ctx.fillRect(0, 0, logicalW, logicalH)
  }

  // Edge vignette for arcade depth
  const vig = ctx.createRadialGradient(
    logicalW / 2,
    logicalH / 2,
    logicalH * 0.22,
    logicalW / 2,
    logicalH / 2,
    logicalW * 0.72,
  )
  vig.addColorStop(0, 'transparent')
  vig.addColorStop(0.75, 'transparent')
  vig.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, logicalW, logicalH)
}

function drawProceduralFallback(
  ctx: CanvasRenderingContext2D,
  frame: number,
  ground: number,
  W: number,
  H: number,
): void {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0f0a1a')
  g.addColorStop(0.45, '#1a1030')
  g.addColorStop(0.72, '#12081c')
  g.addColorStop(1, '#08060e')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const haze = ctx.createRadialGradient(W * 0.5, ground - 80, 40, W * 0.5, ground, 420)
  haze.addColorStop(0, 'rgba(139,92,246,0.22)')
  haze.addColorStop(1, 'transparent')
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, W, H)

  // Simple building silhouettes
  ctx.fillStyle = 'rgba(20,16,36,0.85)'
  for (let i = 0; i < 12; i++) {
    const bx = ((i * 90 - frame * 0.55) % (W + 120)) - 60
    const bh = 60 + (i % 5) * 28
    ctx.fillRect(bx, ground - bh, 48 + (i % 3) * 12, bh)
  }

  const gg = ctx.createLinearGradient(0, ground, 0, H)
  gg.addColorStop(0, '#1e1630')
  gg.addColorStop(1, '#0a0812')
  ctx.fillStyle = gg
  ctx.fillRect(0, ground + 1, W, H - ground)
  ctx.fillStyle = 'rgba(167,139,250,0.75)'
  ctx.fillRect(0, ground, W, 4)
}
