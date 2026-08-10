/**
 * NFT → photoreal HD fighter plate.
 * Max fidelity: high res, multi-pass scale, soft photographic grade (not pixel art).
 */

const cache = new Map<string, HTMLCanvasElement | HTMLImageElement | 'fail'>()
const inflight = new Map<string, Promise<HTMLCanvasElement | HTMLImageElement | null>>()

/** High-res plate for arena (displayed large with smoothing). */
const PIXEL = 512

/**
 * Photographic grade: slight contrast, warm midtones, soft unsharp,
 * alpha cleanup — keeps NFT art looking real, not cartoon-outlined.
 */
function photoGrade(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  const copy = new Uint8ClampedArray(d)
  const cx = size / 2
  const cy = size * 0.42

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const a = copy[i + 3]!
      if (a < 8) {
        d[i + 3] = 0
        continue
      }
      let r = copy[i]!
      let g = copy[i + 1]!
      let b = copy[i + 2]!

      // mild S-curve contrast
      r = sCurve(r)
      g = sCurve(g)
      b = sCurve(b)

      // soft center key-light (face/torso lift)
      const dist = Math.hypot(x - cx, y - cy) / (size * 0.65)
      const key = Math.max(0, 1 - dist) * 14
      r = Math.min(255, r + key)
      g = Math.min(255, g + key * 0.92)
      b = Math.min(255, b + key * 0.78)

      // subtle warm grade
      r = Math.min(255, r + 3)
      b = Math.max(0, b - 2)

      // micro unsharp from neighbors (edge clarity without pixel outline)
      if (x > 0 && x < size - 1 && y > 0 && y < size - 1 && a > 40) {
        const n =
          (copy[((y - 1) * size + x) * 4]! +
            copy[((y + 1) * size + x) * 4]! +
            copy[(y * size + x - 1) * 4]! +
            copy[(y * size + x + 1) * 4]!) /
          4
        const detail = (copy[i]! - n) * 0.35
        r = clampByte(r + detail)
        g = clampByte(g + detail * 0.9)
        b = clampByte(b + detail * 0.85)
      }

      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
      // keep alpha soft (anti-aliased edges)
      d[i + 3] = a
    }
  }
  ctx.putImageData(img, 0, 0)
}

function sCurve(v: number): number {
  const x = v / 255
  const y = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
  // blend original 70% + curve 30% so we don't overcook
  return Math.min(255, Math.max(0, v * 0.7 + y * 255 * 0.3))
}

function clampByte(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)))
}

function drawHighQuality(
  img: HTMLImageElement,
  ctx: CanvasRenderingContext2D,
): void {
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return

  // Portrait crop: prefer upper body (fighters read better)
  const side = Math.min(iw, ih)
  const sx = (iw - side) / 2
  // bias up slightly for face in frame
  const sy = Math.max(0, (ih - side) / 2 - side * 0.06)

  // Multi-pass pyramid downscale (best quality)
  let curW = side
  let curH = side
  let src: HTMLCanvasElement | HTMLImageElement = img
  let sxx = sx
  let syy = sy
  while (curW / 2 >= PIXEL * 1.25) {
    const next = document.createElement('canvas')
    next.width = Math.max(PIXEL, Math.floor(curW / 2))
    next.height = Math.max(PIXEL, Math.floor(curH / 2))
    const nctx = next.getContext('2d')!
    nctx.imageSmoothingEnabled = true
    nctx.imageSmoothingQuality = 'high'
    if (src === img) {
      nctx.drawImage(img, sxx, syy, side, side, 0, 0, next.width, next.height)
    } else {
      nctx.drawImage(src as HTMLCanvasElement, 0, 0, curW, curH, 0, 0, next.width, next.height)
    }
    src = next
    curW = next.width
    curH = next.height
    sxx = 0
    syy = 0
  }

  ctx.clearRect(0, 0, PIXEL, PIXEL)
  if (src === img) {
    ctx.drawImage(img, sx, sy, side, side, 0, 0, PIXEL, PIXEL)
  } else {
    ctx.drawImage(src as HTMLCanvasElement, 0, 0, curW, curH, 0, 0, PIXEL, PIXEL)
  }
  photoGrade(ctx, PIXEL)
}

export function loadNftSprite(
  url: string,
): Promise<HTMLCanvasElement | HTMLImageElement | null> {
  const key = url.trim()
  if (!key) return Promise.resolve(null)
  const hit = cache.get(key)
  if (hit === 'fail') return Promise.resolve(null)
  if (hit) return Promise.resolve(hit)
  const pending = inflight.get(key)
  if (pending) return pending

  const p = new Promise<HTMLCanvasElement | HTMLImageElement | null>((resolve) => {
    const finish = (src: HTMLImageElement) => {
      try {
        const c = document.createElement('canvas')
        c.width = PIXEL
        c.height = PIXEL
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          cache.set(key, src)
          resolve(src)
          inflight.delete(key)
          return
        }
        drawHighQuality(src, ctx)
        cache.set(key, c)
        resolve(c)
      } catch {
        cache.set(key, src)
        resolve(src)
      }
      inflight.delete(key)
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => finish(img)
    img.onerror = () => {
      if (key.includes('/ipfs/')) {
        const cid = key.split('/ipfs/')[1]
        const gws = [
          'https://ipfs.io/ipfs/',
          'https://cloudflare-ipfs.com/ipfs/',
          'https://nftstorage.link/ipfs/',
          'https://gateway.pinata.cloud/ipfs/',
        ]
        let gi = 0
        const tryNext = () => {
          if (gi >= gws.length) {
            cache.set(key, 'fail')
            resolve(null)
            inflight.delete(key)
            return
          }
          const img2 = new Image()
          img2.crossOrigin = 'anonymous'
          img2.onload = () => finish(img2)
          img2.onerror = () => {
            gi++
            tryNext()
          }
          img2.src = gws[gi++]! + cid
        }
        tryNext()
        return
      }
      const img2 = new Image()
      img2.onload = () => finish(img2)
      img2.onerror = () => {
        cache.set(key, 'fail')
        resolve(null)
        inflight.delete(key)
      }
      img2.src = key
    }
    img.src = key
  })
  inflight.set(key, p)
  return p
}

export function getCachedSprite(
  url?: string,
): HTMLCanvasElement | HTMLImageElement | null {
  if (!url) return null
  const h = cache.get(url)
  if (!h || h === 'fail') return null
  return h
}

export function preloadFighterImages(urls: (string | undefined)[]): void {
  for (const u of urls) {
    if (u) void loadNftSprite(u)
  }
}

export function clearSpriteCache(): void {
  cache.clear()
  inflight.clear()
}
