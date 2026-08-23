/**
 * Resolve hand-scored game-meta Power Levels for fighter NFTs.
 *
 * Resolution order (offline-first):
 *   1. memory cache
 *   2. localStorage cache
 *   3. bundled .traits.json (traitScores + comboKeys + archetypes)
 *   4. network: per-NFT JSON → collection index.json → .traits.json
 *
 * Meta base: https://meta.riddlewallet.com/game-meta
 * Fallback: riddle-meta CDN (same game-meta tree) when meta host is unreachable.
 */

import { resolveCollectionWiring } from './collectionWiring'

import theinquisitionTraits from '../data/game-meta/theinquisition.traits.json'
import rebornTraits from '../data/game-meta/the-inquisition-reborn.traits.json'
import inquiryTraits from '../data/game-meta/the-inquiry.traits.json'
import emporiumTraits from '../data/game-meta/the-lost-emporium.traits.json'
import bridgeTraits from '../data/game-meta/under-the-bridge-riddle.traits.json'
import dantesaurumTraits from '../data/game-meta/dantesaurum.traits.json'
import riddletankTraits from '../data/game-meta/riddletank.traits.json'
import communityTraits from '../data/game-meta/riddle-community.traits.json'
import basicHumanTraits from '../data/game-meta/riddle-basic-human.traits.json'
import rebornCombos from '../data/game-meta/the-inquisition-reborn.combos.json'
import bridgeCombosRaw from '../data/game-meta/under-the-bridge-riddle.combos.json'

const bridgeCombos = bridgeCombosRaw as {
  groups?: Record<string, { score?: number; comboKey?: string }>
}

/** Canonical meta host path (riddle-dev meta domain; proxies CDN game-meta). */
export const GAME_META_BASE = 'https://meta.riddlewallet.com/game-meta'
/** Live static CDN fallback when meta host has not been redeployed yet. */
export const GAME_META_FALLBACK_BASE = 'https://riddle-meta.vercel.app/game-meta'
const GAME_META_BASES = [GAME_META_BASE, GAME_META_FALLBACK_BASE] as const
const LS_KEY = 'rf_game_meta_scores_v1'
const LS_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type GameMetaGameValue = {
  power?: number
  speed?: number
  defense?: number
  technique?: number
  creditsPerWin?: number
  creditsPerHour?: number
  baseValue?: number
  /** Free-form scanner payload (numbers, nested objects, labels). */
  [k: string]: unknown
}

export type GameMetaTraitScore = {
  score: number
  gameValue?: GameMetaGameValue
}

export type GameMetaTraitsFile = {
  slug?: string
  name?: string
  role?: string
  taxon?: number | null
  traitScores?: Record<string, Record<string, GameMetaTraitScore>>
  numericTraits?: Record<
    string,
    {
      scorePerPoint?: number
      gameValuePerPoint?: GameMetaGameValue
      notes?: string
    }
  >
  archetypes?: Record<
    string,
    {
      archetype?: string
      base?: { power?: number; speed?: number; defense?: number; technique?: number }
      combatStyle?: string
    }
  >
  comboKeys?: Record<
    string,
    {
      powerLevel?: number
      gameClass?: string
      army?: string
      ins?: string
      evolution?: number
      [k: string]: unknown
    }
  >
  scannedAt?: string
}

export type GameMetaFighterScore = {
  slug: string
  /** Hand-scored Power Level (typically 0–100 scale). */
  powerLevel: number
  power?: number
  speed?: number
  defense?: number
  technique?: number
  comboKey?: string
  archetype?: string
  /** How the score was resolved */
  provenance: 'scanned-nft' | 'scanned-index' | 'scanned-traits' | 'offline-traits' | 'cache'
  sourceLabel: string
  updatedAt?: string
}

type CacheEntry = GameMetaFighterScore & { cachedAt: number }

const mem = new Map<string, CacheEntry>()
const offlineBySlug = new Map<string, GameMetaTraitsFile>()
const indexCache = new Map<string, Record<string, unknown>>()
const inflight = new Map<string, Promise<GameMetaFighterScore | null>>()

const BUNDLED: Array<{ slug: string; data: GameMetaTraitsFile }> = [
  { slug: 'theinquisition', data: theinquisitionTraits as unknown as GameMetaTraitsFile },
  { slug: 'the-inquisition-reborn', data: rebornTraits as unknown as GameMetaTraitsFile },
  { slug: 'the-inquiry', data: inquiryTraits as unknown as GameMetaTraitsFile },
  { slug: 'the-lost-emporium', data: emporiumTraits as unknown as GameMetaTraitsFile },
  { slug: 'under-the-bridge-riddle', data: bridgeTraits as unknown as GameMetaTraitsFile },
  { slug: 'dantesaurum', data: dantesaurumTraits as unknown as GameMetaTraitsFile },
  { slug: 'riddletank', data: riddletankTraits as unknown as GameMetaTraitsFile },
  { slug: 'riddle-community', data: communityTraits as unknown as GameMetaTraitsFile },
  { slug: 'riddle-basic-human', data: basicHumanTraits as unknown as GameMetaTraitsFile },
]

for (const b of BUNDLED) {
  offlineBySlug.set(b.slug, b.data)
  if (b.data.taxon != null) {
    // also index by taxon string for quick lookup
  }
}

/** Collection key / alias → game-meta slug */
const SLUG_ALIASES: Record<string, string> = {
  theinquisition: 'theinquisition',
  'the-inquisition': 'theinquisition',
  inquisition: 'theinquisition',
  'the-inquisition-reborn': 'the-inquisition-reborn',
  reborn: 'the-inquisition-reborn',
  'the-inquiry': 'the-inquiry',
  inquiry: 'the-inquiry',
  'the-lost-emporium': 'the-lost-emporium',
  'lost-emporium': 'the-lost-emporium',
  'under-the-bridge-riddle': 'under-the-bridge-riddle',
  'under-the-bridge': 'under-the-bridge-riddle',
  bridge: 'under-the-bridge-riddle',
  dantesaurum: 'dantesaurum',
  riddletank: 'riddletank',
  'riddle-tank': 'riddletank',
  'riddle-community': 'riddle-community',
  community: 'riddle-community',
  'riddle-basic-human': 'riddle-basic-human',
  'basic-human': 'riddle-basic-human',
}

const TAXON_TO_SLUG: Record<number, string> = {
  0: 'the-inquiry',
  2: 'theinquisition',
  1003: 'the-inquisition-reborn',
}

function norm(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function cacheKey(slug: string, id: string): string {
  return `${slug}::${id}`
}

function loadLs(): Record<string, CacheEntry> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as Record<string, CacheEntry>
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

function saveLs(all: Record<string, CacheEntry>): void {
  if (typeof localStorage === 'undefined') return
  try {
    // prune stale + cap size
    const now = Date.now()
    const entries = Object.entries(all)
      .filter(([, v]) => v && now - (v.cachedAt || 0) < LS_TTL_MS)
      .slice(-400)
    localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    /* soft */
  }
}

function putCache(score: GameMetaFighterScore, id: string): GameMetaFighterScore {
  const entry: CacheEntry = { ...score, cachedAt: Date.now() }
  const key = cacheKey(score.slug, id)
  mem.set(key, entry)
  const all = loadLs()
  all[key] = entry
  saveLs(all)
  return score
}

function getCached(slug: string, id: string): GameMetaFighterScore | null {
  const key = cacheKey(slug, id)
  const m = mem.get(key)
  if (m && Date.now() - m.cachedAt < LS_TTL_MS) {
    return { ...m, provenance: 'cache', sourceLabel: m.sourceLabel || 'cached scanned score' }
  }
  const all = loadLs()
  const ls = all[key]
  if (ls && Date.now() - (ls.cachedAt || 0) < LS_TTL_MS) {
    mem.set(key, ls)
    return { ...ls, provenance: 'cache', sourceLabel: ls.sourceLabel || 'cached scanned score' }
  }
  return null
}

/** Resolve game-meta slug for a fighter / collection. */
export function resolveGameMetaSlug(input: {
  key?: string | null
  slug?: string | null
  collection?: string | null
  taxon?: number | null
  category?: string | null
}): string | null {
  const wiring = resolveCollectionWiring({
    key: input.key,
    slug: input.slug,
    collection: input.collection,
    taxon: input.taxon,
    category: input.category,
  })
  const candidates = [input.key, input.slug, input.collection, wiring.key, wiring.name]
  for (const c of candidates) {
    if (!c) continue
    const n = norm(c)
    if (SLUG_ALIASES[n]) return SLUG_ALIASES[n]
    if (offlineBySlug.has(n)) return n
    // fuzzy: strip common prefixes
    for (const [alias, slug] of Object.entries(SLUG_ALIASES)) {
      if (n.includes(alias) || alias.includes(n)) return slug
    }
  }
  if (input.taxon != null && Number.isFinite(Number(input.taxon))) {
    const t = Number(input.taxon)
    if (TAXON_TO_SLUG[t]) return TAXON_TO_SLUG[t]
  }
  if (wiring.taxon != null && TAXON_TO_SLUG[wiring.taxon]) return TAXON_TO_SLUG[wiring.taxon]
  return null
}

function traitMap(
  traits?: Array<{ trait_type?: string; value?: unknown }>,
): Record<string, string> {
  const m: Record<string, string> = {}
  for (const t of traits || []) {
    const k = String(t.trait_type || '').trim()
    if (!k) continue
    m[k] = String(t.value ?? '').trim()
  }
  return m
}

function findTraitScore(
  scores: Record<string, Record<string, GameMetaTraitScore>> | undefined,
  traitType: string,
  value: string,
): GameMetaTraitScore | null {
  if (!scores) return null
  // exact key
  let bucket = scores[traitType]
  if (!bucket) {
    const nk = norm(traitType)
    for (const k of Object.keys(scores)) {
      if (norm(k) === nk) {
        bucket = scores[k]
        break
      }
    }
  }
  if (!bucket) return null
  if (bucket[value]) return bucket[value]
  const nv = norm(value)
  for (const [k, v] of Object.entries(bucket)) {
    if (norm(k) === nv) return v
  }
  return null
}

/**
 * Compute powerLevel + fighter stats from offline traitScores catalog + NFT traits.
 */
export function scoreFromTraitsCatalog(
  slug: string,
  traits?: Array<{ trait_type?: string; value?: unknown }>,
  provenance: GameMetaFighterScore['provenance'] = 'offline-traits',
): GameMetaFighterScore | null {
  const catalog = offlineBySlug.get(slug)
  if (!catalog) return null
  const tm = traitMap(traits)
  if (Object.keys(tm).length === 0 && !catalog.comboKeys) return null

  // 1) Try comboKeys match (theinquisition)
  if (catalog.comboKeys && Object.keys(catalog.comboKeys).length) {
    for (const [comboKey, combo] of Object.entries(catalog.comboKeys)) {
      let ok = true
      if (combo.gameClass && tm['Game Class'] && tm['Game Class'] !== combo.gameClass) ok = false
      if (combo.army && tm['Army'] && tm['Army'] !== combo.army) ok = false
      if (combo.ins && tm['Ins'] && tm['Ins'] !== combo.ins) ok = false
      if (
        combo.evolution != null &&
        tm['Evolution'] != null &&
        Number(tm['Evolution']) !== Number(combo.evolution)
      ) {
        ok = false
      }
      // softer: Ins grade match alone often enough for this collection
      if (!ok && combo.ins && tm['Ins'] === combo.ins) ok = true
      if (ok && typeof combo.powerLevel === 'number') {
        const archKey = combo.gameClass || tm['Game Class'] || ''
        const arch = catalog.archetypes?.[archKey]
        const base = arch?.base
        return {
          slug,
          powerLevel: Math.round(combo.powerLevel),
          power: base?.power,
          speed: base?.speed,
          defense: base?.defense,
          technique: base?.technique,
          comboKey,
          archetype: arch?.archetype,
          provenance,
          sourceLabel: `scanned combo · ${comboKey}`,
        }
      }
    }
  }

  // 2) Reborn: Class__Army combo from bundled combos
  if (slug === 'the-inquisition-reborn') {
    const cls = tm['Game Class'] || tm['Class'] || ''
    const army = (tm['Army'] || '').replace(/\s+/g, '-')
    if (cls && army) {
      const key = `${cls}__${army}`
      const by = (rebornCombos as { byCombo?: Record<string, { powerLevel?: number }> }).byCombo
      const hit = by?.[key]
      if (hit && typeof hit.powerLevel === 'number') {
        const arch = catalog.archetypes?.[cls]
        return {
          slug,
          powerLevel: Math.round(hit.powerLevel),
          power: arch?.base?.power,
          speed: arch?.base?.speed,
          defense: arch?.base?.defense,
          technique: arch?.base?.technique,
          comboKey: key,
          archetype: arch?.archetype || cls,
          provenance,
          sourceLabel: `scanned combo · ${key}`,
        }
      }
    }
  }

  // 2b) Under the Bridge: if traits name a known group comboKey, use group score
  if (slug === 'under-the-bridge-riddle' && bridgeCombos.groups) {
    const maybeKey =
      tm['Combo'] ||
      tm['comboKey'] ||
      tm['Group'] ||
      tm['Archetype'] ||
      ''
    const g = maybeKey ? bridgeCombos.groups[maybeKey] : undefined
    if (g && typeof g.score === 'number') {
      return {
        slug,
        powerLevel: Math.round(g.score),
        comboKey: g.comboKey || maybeKey,
        provenance,
        sourceLabel: `scanned bridge group · ${g.comboKey || maybeKey}`,
      }
    }
  }

  // 3) Sum trait scores + numeric rules → synthetic powerLevel
  let scoreSum = 0
  let scoreN = 0
  let power = 0
  let speed = 0
  let defense = 0
  let technique = 0
  const gvAdd = (gv?: GameMetaGameValue) => {
    if (!gv) return
    power += Number(gv.power as number) || 0
    speed += Number(gv.speed as number) || 0
    defense += Number(gv.defense as number) || 0
    technique += Number(gv.technique as number) || 0
  }

  for (const [traitType, value] of Object.entries(tm)) {
    const num = Number(String(value).replace(/[^\d.-]/g, ''))
    const numeric = catalog.numericTraits?.[traitType]
    // find numeric by normalized name
    let numRule = numeric
    if (!numRule) {
      for (const [k, v] of Object.entries(catalog.numericTraits || {})) {
        if (norm(k) === norm(traitType)) {
          numRule = v
          break
        }
      }
    }
    if (numRule && Number.isFinite(num)) {
      const spp = Number(numRule.scorePerPoint) || 0
      scoreSum += num * spp
      scoreN += 1
      if (numRule.gameValuePerPoint) {
        power += (numRule.gameValuePerPoint.power || 0) * num
        speed += (numRule.gameValuePerPoint.speed || 0) * num
        defense += (numRule.gameValuePerPoint.defense || 0) * num
        technique += (numRule.gameValuePerPoint.technique || 0) * num
      }
      continue
    }
    const hit = findTraitScore(catalog.traitScores, traitType, value)
    if (hit) {
      scoreSum += hit.score
      scoreN += 1
      gvAdd(hit.gameValue)
    }
  }

  // Seed archetype base when Game Class known
  const classVal = tm['Game Class'] || tm['Class'] || tm['Archetype'] || ''
  const arch = classVal ? catalog.archetypes?.[classVal] : undefined
  if (arch?.base) {
    power = (arch.base.power || 0) + power * 0.15
    speed = (arch.base.speed || 0) + speed * 0.15
    defense = (arch.base.defense || 0) + defense * 0.15
    technique = (arch.base.technique || 0) + technique * 0.15
  }

  if (scoreN === 0 && !arch) return null

  // Map average trait score (~0-100) to powerLevel band used by scanners
  const avg = scoreN > 0 ? scoreSum / scoreN : 40
  let powerLevel = Math.round(clamp(avg, 12, 98))
  // Prefer average of combat stats if we got them
  if (power + speed + defense + technique > 0) {
    const statAvg = (power + speed + defense + technique) / 4
    // blend avg trait score with stat package
    powerLevel = Math.round(clamp(avg * 0.45 + statAvg * 0.55, 12, 98))
  }

  return {
    slug,
    powerLevel,
    power: power || undefined,
    speed: speed || undefined,
    defense: defense || undefined,
    technique: technique || undefined,
    archetype: arch?.archetype || classVal || undefined,
    provenance,
    sourceLabel: `offline trait scores · ${slug}`,
  }
}

function parseNftGameBlock(slug: string, data: unknown): GameMetaFighterScore | null {
  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>
  const game = (root.game || root) as Record<string, unknown>
  const fighter = (game.fighter || game) as Record<string, unknown>
  const pl = Number(fighter.powerLevel ?? game.powerLevel ?? fighter.score ?? game.score)
  if (!Number.isFinite(pl) || pl <= 0) return null
  return {
    slug,
    powerLevel: Math.round(pl),
    power: numOrU(fighter.power),
    speed: numOrU(fighter.speed),
    defense: numOrU(fighter.defense),
    technique: numOrU(fighter.technique),
    comboKey: typeof fighter.comboKey === 'string' ? fighter.comboKey : typeof game.comboKey === 'string' ? game.comboKey : undefined,
    archetype: typeof fighter.archetype === 'string' ? fighter.archetype : undefined,
    provenance: 'scanned-nft',
    sourceLabel: 'scanned NFT game-meta',
    updatedAt: typeof game.updatedAt === 'string' ? game.updatedAt : undefined,
  }
}

function numOrU(v: unknown): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function parseIndexEntry(slug: string, entry: unknown): GameMetaFighterScore | null {
  if (!entry || typeof entry !== 'object') return null
  const e = entry as Record<string, unknown>
  const pl = Number(e.powerLevel ?? e.score ?? e.baseValue)
  if (!Number.isFinite(pl) || pl <= 0) return null
  return {
    slug,
    powerLevel: Math.round(pl),
    comboKey: typeof e.comboKey === 'string' ? e.comboKey : undefined,
    provenance: 'scanned-index',
    sourceLabel: 'scanned index',
  }
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { credentials: 'omit' })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('html')) return null
    const text = await res.text()
    const trimmed = text.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

/**
 * Try canonical meta host then riddle-meta CDN fallback.
 * meta.riddlewallet.com/game-meta was 404 until cdn-proxy deploy; CDN already hosts the tree.
 */
async function fetchGameMetaJson(relPath: string): Promise<unknown | null> {
  const rel = String(relPath || '').replace(/^\//, '')
  for (const base of GAME_META_BASES) {
    const data = await fetchJson(`${base}/${rel}`)
    if (data != null) return data
  }
  return null
}

function idCandidates(id: string): string[] {
  const raw = String(id || '').trim()
  if (!raw) return []
  const out = new Set<string>()
  out.add(raw)
  out.add(raw.replace(/\.json$/i, ''))
  // strip nft- prefix from fighter ids
  const stripped = raw.replace(/^nft-/i, '')
  out.add(stripped)
  // zero-pad numeric
  if (/^\d+$/.test(stripped)) {
    out.add(stripped.padStart(4, '0'))
    out.add(String(Number(stripped)))
  }
  // with .json
  for (const c of [...out]) {
    if (!c.endsWith('.json')) out.add(`${c}.json`)
  }
  return [...out]
}

/**
 * Sync resolve: cache → offline traits. Never blocks on network.
 */
export function resolveGameMetaScoreSync(input: {
  nftId?: string | null
  collection?: string | null
  taxon?: number | null
  category?: string | null
  traits?: Array<{ trait_type?: string; value?: unknown }>
}): GameMetaFighterScore | null {
  const slug = resolveGameMetaSlug(input)
  if (!slug) return null
  const id = String(input.nftId || '').replace(/^nft-/i, '').trim()
  if (id) {
    const cached = getCached(slug, id)
    if (cached) return cached
    // also try alternate id forms in cache
    for (const c of idCandidates(id)) {
      const hit = getCached(slug, c.replace(/\.json$/i, ''))
      if (hit) return hit
    }
  }
  return scoreFromTraitsCatalog(slug, input.traits, 'offline-traits')
}

/**
 * Async resolve with network fallback. Populates cache for future sync reads.
 */
export async function resolveGameMetaScore(input: {
  nftId?: string | null
  collection?: string | null
  taxon?: number | null
  category?: string | null
  traits?: Array<{ trait_type?: string; value?: unknown }>
}): Promise<GameMetaFighterScore | null> {
  const slug = resolveGameMetaSlug(input)
  if (!slug) return null
  const id = String(input.nftId || '').replace(/^nft-/i, '').trim()
  const sync = resolveGameMetaScoreSync(input)
  // Prefer network-fresh when we have an id; still return offline immediately via sync callers
  if (!id) return sync

  const inflightKey = cacheKey(slug, id)
  const existing = inflight.get(inflightKey)
  if (existing) return existing

  const job = (async (): Promise<GameMetaFighterScore | null> => {
    // 1) per-NFT game-meta file (meta host → CDN fallback)
    for (const cand of idCandidates(id)) {
      const bare = cand.replace(/\.json$/i, '')
      const data = await fetchGameMetaJson(`${slug}/${bare}.json`)
      const parsed = parseNftGameBlock(slug, data)
      if (parsed) {
        putCache(parsed, bare)
        putCache(parsed, id)
        return parsed
      }
    }

    // 2) collection index
    let index = indexCache.get(slug)
    if (!index) {
      const idxData = await fetchGameMetaJson(`${slug}/index.json`)
      if (idxData && typeof idxData === 'object') {
        index = idxData as Record<string, unknown>
        indexCache.set(slug, index)
      }
    }
    if (index) {
      const files = (index.files || index.tokens || {}) as Record<string, unknown>
      for (const cand of idCandidates(id)) {
        const entry = files[cand] || files[cand.replace(/\.json$/i, '')] || files[`${cand.replace(/\.json$/i, '')}.json`]
        const parsed = parseIndexEntry(slug, entry)
        if (parsed) {
          // enrich via traits if possible
          const offline = scoreFromTraitsCatalog(slug, input.traits, 'scanned-index')
          const merged: GameMetaFighterScore = {
            ...(offline || {}),
            ...parsed,
            power: offline?.power ?? parsed.power,
            speed: offline?.speed ?? parsed.speed,
            defense: offline?.defense ?? parsed.defense,
            technique: offline?.technique ?? parsed.technique,
            provenance: 'scanned-index',
            sourceLabel: parsed.comboKey
              ? `scanned index · ${parsed.comboKey}`
              : 'scanned index',
          }
          putCache(merged, id)
          return merged
        }
      }
      // bridge: token entry may use `score` instead of powerLevel (handled in parseIndexEntry)
    }

    // 3) offline / traits
    const fromTraits = scoreFromTraitsCatalog(slug, input.traits, 'scanned-traits')
    if (fromTraits) {
      putCache(fromTraits, id)
      return fromTraits
    }
    return sync
  })()

  inflight.set(inflightKey, job)
  try {
    return await job
  } finally {
    inflight.delete(inflightKey)
  }
}

/** Prefetch game-meta for a roster (non-blocking). */
export function prefetchGameMetaScores(
  fighters: Array<{
    nftId?: string | null
    collection?: string | null
    taxon?: number | null
    category?: string | null
    traits?: Array<{ trait_type?: string; value?: unknown }>
  }>,
): void {
  for (const f of fighters.slice(0, 40)) {
    void resolveGameMetaScore(f)
  }
}

/** Map scanned 0–100-ish fighter stats onto combat mult deltas (centered at 50). */
export function scannedStatsToMults(score: GameMetaFighterScore): {
  multAtk: number
  multDef: number
  multSpeed: number
  multSpecial: number
  multHp: number
} {
  const toMult = (v: number | undefined) => {
    if (v == null || !Number.isFinite(v)) return 1
    // 50 → 1.0, 100 → 1.18, 0 → 0.82
    return clamp(1 + (v - 50) * 0.0036, 0.82, 1.22)
  }
  return {
    multAtk: toMult(score.power),
    multDef: toMult(score.defense),
    multSpeed: toMult(score.speed),
    multSpecial: toMult(score.technique),
    multHp: toMult(
      score.defense != null && score.power != null
        ? (score.defense + score.power) / 2
        : score.defense ?? score.power,
    ),
  }
}

export function offlineTraitsLoaded(): string[] {
  return [...offlineBySlug.keys()]
}
