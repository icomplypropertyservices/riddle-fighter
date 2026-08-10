/**
 * Premium painted stage art for Riddle Fighter.
 * Loaded once, drawn full-bleed under fighters.
 */

export type StageId = 'neon-city' | 'crystal-ruin'

const STAGE_URLS: Record<StageId, string> = {
  'neon-city': '/art/stage-neon-city.jpg',
  'crystal-ruin': '/art/stage-crystal-ruin.jpg',
}

const images = new Map<StageId, HTMLImageElement | 'fail'>()
const inflight = new Map<StageId, Promise<HTMLImageElement | null>>()

export function preloadStage(id: StageId): Promise<HTMLImageElement | null> {
  const hit = images.get(id)
  if (hit === 'fail') return Promise.resolve(null)
  if (hit) return Promise.resolve(hit)
  const pending = inflight.get(id)
  if (pending) return pending

  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      images.set(id, img)
      inflight.delete(id)
      resolve(img)
    }
    img.onerror = () => {
      images.set(id, 'fail')
      inflight.delete(id)
      resolve(null)
    }
    img.src = STAGE_URLS[id]
  })
  inflight.set(id, p)
  return p
}

export function getStageImage(id: StageId): HTMLImageElement | null {
  const hit = images.get(id)
  if (!hit || hit === 'fail') return null
  return hit
}

/** Pick stage by match seed (round / fighter ids hash). */
export function pickStageId(seed: string): StageId {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % 2 === 0 ? 'neon-city' : 'crystal-ruin'
}

/** Warm both stages at app boot / arena open. */
export function preloadAllStages(): void {
  void preloadStage('neon-city')
  void preloadStage('crystal-ruin')
}

export const FX_KO_URL = '/art/fx-ko-burst.jpg'

let koImg: HTMLImageElement | null | 'fail' = null

export function preloadKoFx(): Promise<HTMLImageElement | null> {
  if (koImg === 'fail') return Promise.resolve(null)
  if (koImg) return Promise.resolve(koImg)
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      koImg = img
      resolve(img)
    }
    img.onerror = () => {
      koImg = 'fail'
      resolve(null)
    }
    img.src = FX_KO_URL
  })
}

export function getKoFx(): HTMLImageElement | null {
  return koImg && koImg !== 'fail' ? koImg : null
}
