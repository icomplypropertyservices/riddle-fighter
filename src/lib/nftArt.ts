/**
 * Always-on art resolution for Fighter cards.
 * Basic Human must paint the **Pinata** product plate — never blank / near-black CDN.
 */

import {
  BASIC_HUMAN_PINATA_IMAGE,
  basicHumanImageUrl,
  basicHumanSvgDataUri,
  isStarterHumanFighter,
} from './starterHuman'
import type { Fighter } from './fighters'

/**
 * Reborn JPEG plate lives on the **riddle-meta CDN** origin (pad-4 keys).
 * Bare serials (1.jpg) and meta.riddlewallet.com/static/* historically 404 —
 * always normalize to riddle-meta.vercel.app + zero-pad-4.
 * Live: GET https://riddle-meta.vercel.app/static/the-inquisition-reborn/0001.jpg → 200
 */
export const REBORN_META_CDN_ORIGIN =
  'https://riddle-meta.vercel.app'

export const REBORN_CDN = (serial: number) => {
  const n = Math.max(1, Math.floor(Number(serial) || 1))
  const key = String(n).padStart(4, '0')
  return `${REBORN_META_CDN_ORIGIN}/static/the-inquisition-reborn/${key}.jpg`
}

export const REBORN_FALLBACK =
  'https://city.riddlewallet.com/collections/the-inquisition-reborn.svg'

/**
 * Rewrite dead reborn static URLs (meta host / bare serial) to the live CDN pad-4 path.
 */
export function normalizeRebornStaticUrl(url: string): string {
  const s = String(url || '').trim()
  if (!s) return s
  const m = s.match(
    /^https?:\/\/(?:meta\.riddlewallet\.com|riddle-meta\.vercel\.app)\/static\/the-inquisition-reborn\/(\d+)\.(jpg|jpeg|png|webp)$/i,
  )
  if (!m) return s
  const n = Math.max(1, Math.floor(Number(m[1]) || 1))
  return REBORN_CDN(n)
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
 * - inline SVG placeholders (not the product plate)
 * - meta JSON URIs
 */
function isWeakBasicHumanArt(s: string): boolean {
  const u = String(s || '').trim()
  if (!u) return true
  if (isMetaJsonPath(u)) return true
  if (/^data:image\/svg/i.test(u)) return true
  if (/meta\.riddlewallet\.com\/static\/riddle-basic-human\//i.test(u)) return true
  return false
}

function normalizeIpfs(s: string): string {
  const u = String(s || '').trim()
  if (u.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${u.slice(7).replace(/^ipfs\//, '')}`
  }
  return u
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

  const candidates = [
    opts.newImage,
    opts.image,
    opts.originalImage,
  ]
    .map((s) => normalizeRebornStaticUrl(normalizeIpfs(String(s || '').trim())))
    .filter(Boolean)
    .filter((s) => !isMetaJsonPath(s))

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

  if (isBh) {
    // 1) Prefer any Pinata / IPFS product URL already on the NFT
    for (const c of candidates) {
      if (isPinataArtUrl(c)) return c
    }
    // 2) Evolved / non-weak http art (not meta plate, not svg placeholder)
    for (const c of candidates) {
      if (
        (c.startsWith('http') || c.startsWith('data:image')) &&
        !isWeakBasicHumanArt(c)
      ) {
        return c
      }
    }
    // 3) Product default: Pinata basic-human.jpg (never blank / dark CDN plate)
    return basicHumanImageUrl(serial)
  }

  // Non-BH: first usable candidate (skip dead meta-host static reborn paths)
  for (const c of candidates) {
    if (
      /meta\.riddlewallet\.com\/static\/the-inquisition-reborn\//i.test(c)
    ) {
      continue
    }
    if (c.startsWith('http') || c.startsWith('data:image') || c.startsWith('ipfs')) {
      return c
    }
  }

  if (isReborn) {
    // Prefer CDN JPEG (pad-4); city SVG only as last resort
    return REBORN_CDN(serial) || REBORN_FALLBACK
  }

  return candidates[0] || basicHumanSvgDataUri({ serial: 1, label: 'Fighter' })
}

/** Mutate fighter with guaranteed image fields for UI. */
export function ensureFighterArt(f: Fighter): Fighter {
  if (!f) return f
  const art = resolveFighterArt({
    name: f.name,
    image: f.image,
    originalImage: f.originalImage,
    newImage: f.newImage,
    taxon: f.taxon,
    collection: f.collection,
    traits: f.traits,
    uri: (f as { uri?: string }).uri,
  })
  const serial =
    traitSerial(f.traits) || serialFromName(f.name) || 1
  const isBh = isStarterHumanFighter(f) || f.taxon === 9001
  const pinata = isBh ? basicHumanImageUrl(serial) : undefined
  const svg = isBh
    ? basicHumanSvgDataUri({ serial, label: `Human #${serial}` })
    : undefined
  // BH: always stamp Pinata on image; keep original if already pinata-ish
  const orig =
    f.originalImage && isPinataArtUrl(String(f.originalImage))
      ? f.originalImage
      : pinata || art || f.originalImage
  return {
    ...f,
    image: art || pinata || f.image || svg,
    originalImage: orig || art,
    newImage: f.newImage && !isWeakBasicHumanArt(String(f.newImage))
      ? f.newImage
      : svg || f.newImage,
  }
}
