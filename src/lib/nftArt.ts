/**
 * Always-on art resolution for Fighter cards.
 * Basic Human must paint the **Pinata** product plate — never blank / near-black CDN.
 *
 * Policy: logos / NFT art = **JPG/PNG only** (no SVG). Charts/canvas elsewhere OK.
 * Collection covers → city.riddlewallet.com/collections/{slug}.jpg (or meta sample JPG).
 * Land plots → Vercel blob JPEG (meta static/lands is dead).
 */

import {
  BASIC_HUMAN_PINATA_IMAGE,
  basicHumanImageUrl,
  basicHumanSvgDataUri,
} from './starterHuman'
import type { Fighter } from './fighters'

export const CITY_CDN = 'https://city.riddlewallet.com'
export const META_CDN = 'https://meta.riddlewallet.com'
/** Live land plot art (suite SSOT — meta static/lands 404s). */
export const LAND_IMAGE_BLOB =
  'https://ucc2ll8ogomrqf5q.public.blob.vercel-storage.com/nft/lands'

/**
 * Reborn JPEG plate lives on the **riddle-meta CDN** origin (pad-4 keys).
 * Bare serials (1.jpg) historically 404 — always normalize to pad-4 path.
 * Live: GET https://riddle-meta.vercel.app/static/the-inquisition-reborn/0001.jpg → 200
 * Also live on meta.riddlewallet.com same path.
 */
export const REBORN_META_CDN_ORIGIN =
  'https://riddle-meta.vercel.app'

export const REBORN_CDN = (serial: number) => {
  const n = Math.max(1, Math.floor(Number(serial) || 1))
  const key = String(n).padStart(4, '0')
  return `${REBORN_META_CDN_ORIGIN}/static/the-inquisition-reborn/${key}.jpg`
}

/** Real raster cover — never city .svg collection badge. */
export const REBORN_FALLBACK =
  `${META_CDN}/static/the-inquisition-reborn/0001.jpg`

/**
 * Suite collection cover JPGs (city host + meta samples).
 * Prefer these over any `/collections/*.svg` badge.
 */
export const COLLECTION_COVER_JPG: Record<string, string> = {
  'riddle-basic-human': BASIC_HUMAN_PINATA_IMAGE,
  'riddle-weapons': `${CITY_CDN}/collections/riddle-weapons.jpg`,
  'riddle-transport': `${CITY_CDN}/collections/riddle-transport.jpg`,
  'riddle-ammo': `${CITY_CDN}/collections/riddle-ammo.jpg`,
  'riddle-land-buildings': `${CITY_CDN}/collections/riddle-land-buildings.jpg`,
  'riddleworld-lands': `${LAND_IMAGE_BLOB}/0001.jpeg`,
  'the-inquisition-reborn': REBORN_FALLBACK,
  theinquisition: `${CITY_CDN}/collections/theinquisition.jpg`,
  'the-inquisition': `${CITY_CDN}/collections/theinquisition.jpg`,
  'under-the-bridge-riddle': `${CITY_CDN}/collections/under-the-bridge-riddle.jpg`,
  'the-inquiry': `${CITY_CDN}/collections/the-inquiry.jpg`,
  'the-lost-emporium': `${CITY_CDN}/collections/the-lost-emporium.jpg`,
  dantesaurum: `${CITY_CDN}/collections/dantesaurum.jpg`,
  riddletank: `${CITY_CDN}/collections/riddletank.jpg`,
  'riddle-community': `${CITY_CDN}/collections/riddle-community.jpg`,
  'riddle-civilizations': `${CITY_CDN}/collections/riddle-civilizations.jpg`,
}

/** Collection cover by slug — always JPG/PNG, never SVG. */
export function collectionCoverJpg(slug?: string | null): string {
  const key = String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/\.svg$/i, '')
  if (!key) return COLLECTION_COVER_JPG['riddle-civilizations']
  if (COLLECTION_COVER_JPG[key]) return COLLECTION_COVER_JPG[key]
  return `${CITY_CDN}/collections/${key}.jpg`
}

/** Land plot art by number (pad-4 JPEG on Vercel blob). */
export function landPlotImage(plot: number): string {
  const n = Math.max(1, Math.min(1000, Math.floor(Number(plot) || 1)))
  return `${LAND_IMAGE_BLOB}/${String(n).padStart(4, '0')}.jpeg`
}

/** True when URL is SVG (data URI or .svg path) — not allowed for NFT/logo art. */
export function isSvgArtUrl(url?: string | null): boolean {
  const u = String(url || '').trim()
  if (!u) return false
  if (/^data:image\/svg/i.test(u)) return true
  if (/\.svg(\?|#|$)/i.test(u)) return true
  return false
}

/**
 * Rewrite dead reborn static URLs (meta host / bare serial) to the live CDN pad-4 path.
 * Also rewrite city collection SVG → JPG covers.
 */
export function normalizeRebornStaticUrl(url: string): string {
  const s = String(url || '').trim()
  if (!s) return s
  const m = s.match(
    /^https?:\/\/(?:meta\.riddlewallet\.com|riddle-meta\.vercel\.app)\/static\/the-inquisition-reborn\/(\d+)\.(jpg|jpeg|png|webp)$/i,
  )
  if (m) {
    const n = Math.max(1, Math.floor(Number(m[1]) || 1))
    return REBORN_CDN(n)
  }
  return s
}

/**
 * Rewrite known SVG / dead land hosts to live JPG/JPEG.
 * Logos & NFT plates must never stay as SVG.
 */
export function rewriteSvgAndDeadArtUrl(url: string): string {
  let u = String(url || '').trim()
  if (!u) return u

  // Dead meta / riddle-meta land static → blob JPEG
  if (
    /(?:meta\.riddlewallet\.com|riddle-meta\.vercel\.app)\/static\/lands\//i.test(u)
  ) {
    const m = u.match(/lands\/0*(\d{1,4})/i)
    if (m) return landPlotImage(parseInt(m[1]!, 10))
  }

  // City / relative collection SVG badge → JPG cover
  const colSvg = u.match(/\/collections\/([a-z0-9_-]+)\.svg(\?|#|$)/i)
  if (colSvg) {
    return collectionCoverJpg(colSvg[1])
  }

  // Bare data: SVG or any .svg URL → drop (caller supplies raster fallback)
  if (isSvgArtUrl(u)) {
    return ''
  }

  // Prefer .jpg when a dead .svg sibling pattern slips through as query
  if (/\.svg(\?|#|$)/i.test(u)) {
    u = u.replace(/\.svg(\?|#|$)/i, '.jpg$1')
  }

  return u
}

/** Re-export product Pinata plate for UI fallbacks. */
export { BASIC_HUMAN_PINATA_IMAGE }

function traitSerial(
  traits?: Array<{ trait_type?: string; value?: unknown }> | null,
): number {
  if (!Array.isArray(traits)) return 0
  for (const t of traits) {
    if (/^serial$/i.test(String(t.trait_type || '').trim())) {
      const n = Math.floor(Number(t.value) || 0)
      if (n > 0) return n
    }
  }
  // name "Basic Human #3" / "Basic Human #000003"
  return 0
}

function serialFromName(name?: string): number {
  const m = String(name || '').match(/#\s*0*(\d{1,6})\b/)
  return m ? Math.floor(Number(m[1]) || 0) : 0
}

function isMetaJsonPath(s: string): boolean {
  if (/\/meta\/riddle-basic-human\/\d+$/i.test(s)) return true
  if (/\/meta\/the-inquisition-reborn\/\d+$/i.test(s)) return true
  return false
}

/** Pinata gateway / ipfs product art. */
export function isPinataArtUrl(s: string): boolean {
  const u = String(s || '').trim().toLowerCase()
  if (!u) return false
  if (u.includes('gateway.pinata.cloud') || u.includes('pinata.cloud/ipfs')) return true
  if (u.startsWith('ipfs://') || u.includes('/ipfs/bafy') || u.includes('/ipfs/bafk')) return true
  return false
}

/**
 * Weak BH display sources we must NOT prefer over Pinata:
 * - meta static JPG plate (near-black on dark chrome)
 * - SVG placeholders / collection badges (not the product plate)
 * - meta JSON URIs
 */
function isWeakBasicHumanArt(s: string): boolean {
  const u = String(s || '').trim()
  if (!u) return true
  if (isMetaJsonPath(u)) return true
  if (isSvgArtUrl(u)) return true
  if (/meta\.riddlewallet\.com\/static\/riddle-basic-human\//i.test(u)) return true
  return false
}

/** Any NFT art URL we refuse to paint (SVG, meta JSON). */
function isUnusableArt(s: string): boolean {
  const u = String(s || '').trim()
  if (!u) return true
  if (isMetaJsonPath(u)) return true
  if (isSvgArtUrl(u)) return true
  return false
}

function normalizeIpfs(s: string): string {
  const u = String(s || '').trim()
  if (u.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${u.slice(7).replace(/^ipfs\//, '')}`
  }
  return u
}

/** Normalize a single art URL (ipfs + reborn + SVG→JPG + dead land rewrite). */
export function normalizeArtUrl(url?: string | null): string {
  const s = String(url || '').trim()
  if (!s) return ''
  const rewritten = rewriteSvgAndDeadArtUrl(normalizeIpfs(s))
  if (!rewritten) return ''
  return normalizeRebornStaticUrl(rewritten)
}

/**
 * Compare two art URLs loosely (ignore gateway / query / trailing slash).
 * Used so OLD/NEW slots do not show the same plate as two different eras.
 */
export function artUrlsEqual(a?: string | null, b?: string | null): boolean {
  const na = normalizeArtUrl(a)
  const nb = normalizeArtUrl(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const strip = (u: string) =>
    u
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .replace(/^gateway\.pinata\.cloud\/ipfs\//, 'ipfs/')
      .replace(/^[^/]*pinata\.cloud\/ipfs\//, 'ipfs/')
  return strip(na) === strip(nb)
}

export type ArtSlots = {
  /** Best combat / card display (prefer evolved when present). */
  image: string
  /** Genesis / ledger mint art — OLD slot. */
  originalImage: string
  /** Evolved / mutable art — NEW slot; empty when not evolved. */
  newImage?: string
}

/**
 * Split raw NFT art fields into distinct OLD | NEW | display slots.
 *
 * Contract:
 * - originalImage = genesis (never overwritten by evolved)
 * - newImage = evolved alternate only when distinct from genesis
 * - image = best display without collapsing the two slots
 */
export function splitArtSlots(opts: {
  image?: string | null
  originalImage?: string | null
  newImage?: string | null
  name?: string
  taxon?: number | null
  collection?: string | null
  traits?: Array<{ trait_type?: string; value?: unknown }> | null
  uri?: string | null
}): ArtSlots {
  const serial =
    traitSerial(opts.traits) || serialFromName(opts.name) || 1
  const taxon = opts.taxon == null ? null : Number(opts.taxon)
  const col = String(opts.collection || opts.name || opts.uri || '').toLowerCase()
  const isBh =
    taxon === 9001 ||
    col.includes('basic human') ||
    col.includes('starter-human') ||
    /basic.?human|starter-human/i.test(String(opts.uri || ''))

  let original = normalizeArtUrl(opts.originalImage)
  let evolved = normalizeArtUrl(opts.newImage)
  let current = normalizeArtUrl(opts.image)

  // Drop meta JSON, SVG, and weak BH placeholders from slot candidates
  const usable = (u: string) =>
    Boolean(u) &&
    !isUnusableArt(u) &&
    !(isBh && isWeakBasicHumanArt(u))

  if (!usable(original)) original = ''
  if (!usable(evolved)) evolved = ''
  if (!usable(current)) current = ''

  // If only current exists, it is genesis (not "new")
  if (!original && current) {
    original = current
  }
  // If only evolved exists, treat as genesis until a real pair appears
  if (!original && evolved) {
    original = evolved
    evolved = ''
  }

  // Current distinct from genesis with no explicit new → current is evolved
  if (
    !evolved &&
    current &&
    original &&
    !artUrlsEqual(current, original)
  ) {
    evolved = current
  }

  // Collapse identical evolved onto genesis (NEW must be truly different)
  if (evolved && original && artUrlsEqual(evolved, original)) {
    evolved = ''
  }

  if (isBh) {
    const pinata = basicHumanImageUrl(serial)
    // Product genesis plate for Basic Human
    if (!original || isWeakBasicHumanArt(original)) {
      original = pinata
    }
    // Never invent placeholder SVG as NEW — only keep real evolved art
    if (evolved && isWeakBasicHumanArt(evolved)) {
      evolved = ''
    }
    if (evolved && artUrlsEqual(evolved, original)) {
      evolved = ''
    }
    current = evolved || original || pinata
  } else {
    current = evolved || current || original
  }

  const display = resolveFighterArt({
    name: opts.name,
    image: current || original,
    originalImage: original,
    newImage: evolved || undefined,
    taxon: opts.taxon,
    collection: opts.collection,
    traits: opts.traits,
    uri: opts.uri,
  })

  return {
    image: display || current || original,
    originalImage: original || display,
    newImage: evolved || undefined,
  }
}

/** Resolve best display URL for any fighter / raw NFT fields. */
export function resolveFighterArt(opts: {
  name?: string
  image?: string | null
  originalImage?: string | null
  newImage?: string | null
  taxon?: number | null
  collection?: string | null
  traits?: Array<{ trait_type?: string; value?: unknown }> | null
  uri?: string | null
}): string {
  const serial =
    traitSerial(opts.traits) ||
    serialFromName(opts.name) ||
    1

  // Display priority: evolved → current image → genesis (slots stay separate elsewhere)
  const candidates = [
    opts.newImage,
    opts.image,
    opts.originalImage,
  ]
    .map((s) => normalizeArtUrl(s))
    .filter(Boolean)
    .filter((s) => !isUnusableArt(s))

  const taxon = opts.taxon == null ? null : Number(opts.taxon)
  const col = String(opts.collection || opts.name || opts.uri || '').toLowerCase()
  const isBh =
    taxon === 9001 ||
    col.includes('basic human') ||
    col.includes('starter-human') ||
    /basic.?human|starter-human/i.test(String(opts.uri || ''))
  const isReborn =
    taxon === 1003 ||
    col.includes('reborn') ||
    /inquisition-reborn|reborn/i.test(String(opts.uri || ''))
  const isLand =
    taxon === 1010 ||
    taxon === 1011 ||
    col.includes('land') ||
    /riddleworld-lands|static\/lands/i.test(String(opts.uri || ''))

  if (isBh) {
    // 1) Prefer any Pinata / IPFS product URL already on the NFT
    for (const c of candidates) {
      if (isPinataArtUrl(c)) return c
    }
    // 2) Evolved / non-weak http art (not meta plate, not svg placeholder)
    for (const c of candidates) {
      if (
        (c.startsWith('http') || c.startsWith('data:image')) &&
        !isWeakBasicHumanArt(c) &&
        !isSvgArtUrl(c)
      ) {
        return c
      }
    }
    // 3) Product default: Pinata basic-human.jpg (never blank / dark CDN plate)
    return basicHumanImageUrl(serial)
  }

  // Non-BH: first usable raster candidate (skip dead meta-host static reborn paths)
  for (const c of candidates) {
    if (
      /meta\.riddlewallet\.com\/static\/the-inquisition-reborn\//i.test(c)
    ) {
      continue
    }
    if (isSvgArtUrl(c)) continue
    if (c.startsWith('http') || c.startsWith('data:image') || c.startsWith('ipfs')) {
      return c
    }
  }

  if (isReborn) {
    // Prefer CDN JPEG (pad-4); meta sample JPG as last resort — never SVG
    return REBORN_CDN(serial) || REBORN_FALLBACK
  }

  if (isLand) {
    return landPlotImage(serial)
  }

  // Collection-name cover JPG when no token art; PNG body as final offline plate
  const slugHint = col
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (slugHint && COLLECTION_COVER_JPG[slugHint]) {
    return COLLECTION_COVER_JPG[slugHint]
  }

  // basicHumanSvgDataUri is misnamed — returns PNG body art, not SVG
  return candidates[0] || basicHumanSvgDataUri({ serial: 1, label: 'Fighter' })
}

/**
 * Guarantee fighter image fields for UI.
 * Preserves genesis (OLD) vs evolved (NEW) — never collapses both onto one URL.
 */
export function ensureFighterArt(f: Fighter): Fighter {
  if (!f) return f
  const slots = splitArtSlots({
    name: f.name,
    image: f.image,
    originalImage: f.originalImage,
    newImage: f.newImage,
    taxon: f.taxon,
    collection: f.collection,
    traits: f.traits,
    uri: (f as { uri?: string }).uri,
  })
  return {
    ...f,
    image: slots.image || f.image,
    originalImage: slots.originalImage || f.originalImage || slots.image,
    // Only keep NEW when splitArtSlots found a distinct evolved plate
    newImage: slots.newImage,
  }
}
