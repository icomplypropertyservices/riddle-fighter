/**
 * Actual painted character bodies for the arena (side-view 2D sprites).
 * Magenta-keyed PNGs under /art/characters/ — not procedural sticks.
 */

import type { FighterCollectionId } from '../game/render/collectionLooks'
import { resolveCollectionId } from '../game/render/collectionLooks'
import type { AnimClipId } from '../game/render/types'

export type BodyPose =
  | 'idle'
  | 'punch'
  | 'kick'
  | 'crouch'
  | 'jump'
  | 'block'
  | 'hit'
  | 'special'
  | 'ko'

const BASE = '/art/characters'

/** Per-collection available pose files (idle always required). */
const BODIES: Record<
  string,
  Partial<Record<BodyPose, string>> & { idle: string }
> = {
  starter: {
    idle: `${BASE}/body-starter-idle.png`,
    punch: `${BASE}/body-starter-punch.png`,
    kick: `${BASE}/body-starter-kick.png`,
    special: `${BASE}/body-starter-punch.png`,
    block: `${BASE}/body-starter-idle.png`,
    hit: `${BASE}/body-starter-idle.png`,
    crouch: `${BASE}/body-starter-idle.png`,
    jump: `${BASE}/body-starter-idle.png`,
    ko: `${BASE}/body-starter-idle.png`,
  },
  inquisition: {
    idle: `${BASE}/body-inquisition-idle.png`,
    punch: `${BASE}/body-inquisition-punch.png`,
    kick: `${BASE}/body-inquisition-punch.png`,
    special: `${BASE}/body-inquisition-punch.png`,
    block: `${BASE}/body-inquisition-idle.png`,
    hit: `${BASE}/body-inquisition-idle.png`,
    crouch: `${BASE}/body-inquisition-idle.png`,
    jump: `${BASE}/body-inquisition-idle.png`,
    ko: `${BASE}/body-inquisition-idle.png`,
  },
  inquiry: {
    idle: `${BASE}/body-inquiry-idle.png`,
    punch: `${BASE}/body-inquiry-idle.png`,
    kick: `${BASE}/body-inquiry-idle.png`,
    special: `${BASE}/body-inquiry-idle.png`,
    block: `${BASE}/body-inquiry-idle.png`,
    hit: `${BASE}/body-inquiry-idle.png`,
    crouch: `${BASE}/body-inquiry-idle.png`,
    jump: `${BASE}/body-inquiry-idle.png`,
    ko: `${BASE}/body-inquiry-idle.png`,
  },
  reborn: {
    idle: `${BASE}/body-reborn-idle.png`,
    punch: `${BASE}/body-reborn-idle.png`,
    kick: `${BASE}/body-reborn-idle.png`,
    special: `${BASE}/body-reborn-idle.png`,
    block: `${BASE}/body-reborn-idle.png`,
    hit: `${BASE}/body-reborn-idle.png`,
    crouch: `${BASE}/body-reborn-idle.png`,
    jump: `${BASE}/body-reborn-idle.png`,
    ko: `${BASE}/body-reborn-idle.png`,
  },
  bridge: {
    idle: `${BASE}/body-bridge-idle.png`,
    punch: `${BASE}/body-bridge-idle.png`,
    kick: `${BASE}/body-bridge-idle.png`,
    special: `${BASE}/body-bridge-idle.png`,
    block: `${BASE}/body-bridge-idle.png`,
    hit: `${BASE}/body-bridge-idle.png`,
    crouch: `${BASE}/body-bridge-idle.png`,
    jump: `${BASE}/body-bridge-idle.png`,
    ko: `${BASE}/body-bridge-idle.png`,
  },
  /** Demo / element specialists */
  ember: {
    idle: `${BASE}/body-ember-idle.png`,
    punch: `${BASE}/body-ember-idle.png`,
    kick: `${BASE}/body-ember-idle.png`,
    special: `${BASE}/body-ember-idle.png`,
    block: `${BASE}/body-ember-idle.png`,
    hit: `${BASE}/body-ember-idle.png`,
    crouch: `${BASE}/body-ember-idle.png`,
    jump: `${BASE}/body-ember-idle.png`,
    ko: `${BASE}/body-ember-idle.png`,
  },
  void: {
    idle: `${BASE}/body-void-idle.png`,
    punch: `${BASE}/body-void-idle.png`,
    kick: `${BASE}/body-void-idle.png`,
    special: `${BASE}/body-void-idle.png`,
    block: `${BASE}/body-void-idle.png`,
    hit: `${BASE}/body-void-idle.png`,
    crouch: `${BASE}/body-void-idle.png`,
    jump: `${BASE}/body-void-idle.png`,
    ko: `${BASE}/body-void-idle.png`,
  },
}

/** Demo fighter id → body key */
const DEMO_BODY: Record<string, string> = {
  'demo-ember': 'ember',
  'demo-ash': 'ember',
  'demo-iron': 'inquisition',
  'demo-void': 'void',
  'demo-inquiry': 'inquiry',
  'demo-bridge': 'bridge',
  'demo-cyan': 'bridge',
  'demo-jade': 'starter',
  'spec-rook': 'inquisition',
  'spec-nova': 'ember',
}

const cache = new Map<string, HTMLImageElement | 'fail'>()
const inflight = new Map<string, Promise<HTMLImageElement | null>>()

export function clipToBodyPose(clipId: AnimClipId): BodyPose {
  switch (clipId) {
    case 'punch':
      return 'punch'
    case 'kick':
      return 'kick'
    case 'special':
    case 'secret':
    case 'dash':
      return 'special'
    case 'crouch':
      return 'crouch'
    case 'jump':
      return 'jump'
    case 'block':
      return 'block'
    case 'hit':
      return 'hit'
    case 'ko':
      return 'ko'
    case 'walk':
    case 'idle':
    default:
      return 'idle'
  }
}

export function resolveBodyKey(fighter: {
  id?: string
  category?: string
  collection?: string
  taxon?: number | null
  nftId?: string
  source?: string
}): string {
  const id = String(fighter.id || '')
  if (DEMO_BODY[id]) return DEMO_BODY[id]

  const col = resolveCollectionId({
    taxon: fighter.taxon,
    category: fighter.category,
    collection: fighter.collection,
    id: fighter.id,
    nftId: fighter.nftId,
  }) as FighterCollectionId

  if (col === 'starter' || col === 'generic_human') return 'starter'
  if (col === 'inquisition') return 'inquisition'
  if (col === 'inquiry' || col === 'generic_god') return 'inquiry'
  if (col === 'reborn') return 'reborn'
  if (col === 'bridge') return 'bridge'
  return 'starter'
}

export function bodyUrlFor(
  fighter: {
    id?: string
    category?: string
    collection?: string
    taxon?: number | null
    nftId?: string
  },
  pose: BodyPose,
): string {
  const key = resolveBodyKey(fighter)
  const set = BODIES[key] || BODIES.starter
  return set[pose] || set.idle
}

export function loadCharacterBody(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  const hit = cache.get(url)
  if (hit === 'fail') return Promise.resolve(null)
  if (hit) return Promise.resolve(hit)
  const pending = inflight.get(url)
  if (pending) return pending

  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      cache.set(url, img)
      inflight.delete(url)
      resolve(img)
    }
    img.onerror = () => {
      cache.set(url, 'fail')
      inflight.delete(url)
      resolve(null)
    }
    img.src = url
  })
  inflight.set(url, p)
  return p
}

export function getCachedBody(url: string): HTMLImageElement | null {
  const hit = cache.get(url)
  if (!hit || hit === 'fail') return null
  return hit
}

/** Warm every idle body so first fight frame is painted. */
export function preloadAllCharacterBodies(): void {
  const urls = new Set<string>()
  for (const set of Object.values(BODIES)) {
    for (const u of Object.values(set)) {
      if (u) urls.add(u)
    }
  }
  for (const u of urls) void loadCharacterBody(u)
}

export function allBodyUrls(): string[] {
  const urls = new Set<string>()
  for (const set of Object.values(BODIES)) {
    for (const u of Object.values(set)) {
      if (u) urls.add(u)
    }
  }
  return [...urls]
}
