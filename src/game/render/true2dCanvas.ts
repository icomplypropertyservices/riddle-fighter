/**
 * True 2D canvas bootstrap — high-DPI, crisp smoothing, stable logical coords.
 *
 * Engine always draws in logical 960×540 space; physical pixels are DPR-scaled
 * so phones/TVs get A1 sharpness without rewriting world math.
 */

export type True2dContext = {
  ctx: CanvasRenderingContext2D
  dpr: number
  logicalW: number
  logicalH: number
}

/** Cap DPR so mid-range phones stay at 60fps. */
const MAX_DPR = 2.5

/**
 * Size the canvas for retina / desktop DPR and return a 2D context already
 * transformed so (0,0)–(logicalW,logicalH) fills the view.
 */
export function setupTrue2dCanvas(
  canvas: HTMLCanvasElement,
  logicalW: number,
  logicalH: number,
): True2dContext {
  const raw =
    typeof window !== 'undefined' && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1
  const dpr = Math.max(1, Math.min(MAX_DPR, raw))

  const pw = Math.max(1, Math.round(logicalW * dpr))
  const ph = Math.max(1, Math.round(logicalH * dpr))
  if (canvas.width !== pw) canvas.width = pw
  if (canvas.height !== ph) canvas.height = ph

  // CSS fills arena wrap; keep aspect via width 100% + auto height
  canvas.style.width = '100%'
  canvas.style.height = 'auto'
  canvas.style.imageRendering = 'auto'
  canvas.style.display = 'block'

  // Prefer desynchronized for lower latency; fall back if browser rejects options
  let ctx =
    canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    }) || canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d')

  if (!ctx) {
    throw new Error('2D canvas context unavailable — cannot run true 2D fighter renderer')
  }

  // Reset any prior transform then scale to logical pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  applyHighQuality(ctx)

  return { ctx, dpr, logicalW, logicalH }
}

/** Re-apply HD smoothing flags (call at start of each frame). */
export function applyHighQuality(ctx: CanvasRenderingContext2D): void {
  ctx.imageSmoothingEnabled = true
  try {
    ctx.imageSmoothingQuality = 'high'
  } catch {
    /* older browsers */
  }
}

/**
 * Clear logical viewport to opaque fill (avoids transparent flash between frames).
 * Assumes ctx already has DPR transform from setupTrue2dCanvas.
 */
export function clearTrue2d(
  ctx: CanvasRenderingContext2D,
  logicalW: number,
  logicalH: number,
  fill = '#050508',
): void {
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, logicalW, logicalH)
}

/** Keep DPR transform after engine code that may reset it. */
export function restoreTrue2dTransform(
  ctx: CanvasRenderingContext2D,
  dpr: number,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  applyHighQuality(ctx)
}
