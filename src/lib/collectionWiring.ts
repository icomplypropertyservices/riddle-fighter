/**
 * Typed loader for hand-authored collection-wiring.json.
 * Unknown / new collections resolve through this for looks + stat biases.
 * gameMetaScores.ts maps these keys → meta.riddlewallet.com/game-meta slugs
 * for hand-scanned Power Levels (offline traits + live CDN).
 */

import wiringRaw from '../data/collection-wiring.json'
import type { FighterCollectionId } from '../game/render/collectionLooks'

export type CombatArchetype =
  | 'brawler'
  | 'tank'
  | 'mage'
  | 'assassin'
  | 'ranger'
  | 'support'

export type WiringFightRole =
  | 'fighter'
  | 'weapon'
  | 'ammo'
  | 'passive'
  | 'block'

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type StatBias = {
  power: number
  speed: number
  defense: number
  technique: number
}

export type CollectionWiringEntry = {
  key: string
  name: string
  issuer: string | null
  taxon: number | null
  archetype: CombatArchetype
  combatStyle: string
  statBias: StatBias
  visualTheme: string
  rarityTier: RarityTier
  lookId: FighterCollectionId
  fightRole: WiringFightRole
  fightable: boolean
  equipable: boolean
  notes: string
}

export type CollectionWiringFile = {
  version: number
  updatedAt: string
  notes?: string
  default: CollectionWiringEntry
  collections: CollectionWiringEntry[]
}

const data = wiringRaw as CollectionWiringFile

const byKey = new Map<string, CollectionWiringEntry>()
const byTaxon = new Map<number, CollectionWiringEntry>()

for (const c of data.collections) {
  byKey.set(c.key.toLowerCase(), c)
  if (c.taxon != null && Number.isFinite(c.taxon)) {
    // Prefer first fightable registration for a taxon (alias rows share taxon)
    if (!byTaxon.has(c.taxon) || (c.fightable && !byTaxon.get(c.taxon)!.fightable)) {
      byTaxon.set(c.taxon, c)
    }
  }
}

export function defaultWiring(): CollectionWiringEntry {
  return { ...data.default, statBias: { ...data.default.statBias } }
}

export function allCollectionWiring(): CollectionWiringEntry[] {
  return data.collections.map((c) => ({
    ...c,
    statBias: { ...c.statBias },
  }))
}

function norm(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
}

/**
 * Resolve wiring for a fighter / NFT.
 * Priority: exact key/slug → taxon → name/collection fuzzy → default.
 */
export function resolveCollectionWiring(input: {
  key?: string | null
  slug?: string | null
  collection?: string | null
  name?: string | null
  taxon?: number | null
  issuer?: string | null
  category?: string | null
}): CollectionWiringEntry {
  const key = norm(input.key || input.slug || '')
  if (key && byKey.has(key)) {
    const hit = byKey.get(key)!
    return { ...hit, statBias: { ...hit.statBias } }
  }

  const tax =
    input.taxon != null && Number.isFinite(Number(input.taxon))
      ? Number(input.taxon)
      : null
  if (tax != null && byTaxon.has(tax)) {
    const hit = byTaxon.get(tax)!
    return { ...hit, statBias: { ...hit.statBias } }
  }

  const col = norm(input.collection || input.name || '')
  if (col) {
    for (const c of data.collections) {
      const n = norm(c.name)
      const k = norm(c.key)
      if (col === n || col === k) {
        return { ...c, statBias: { ...c.statBias } }
      }
      if (col.includes(n) || n.includes(col) || col.includes(k.replace(/-/g, ' '))) {
        return { ...c, statBias: { ...c.statBias } }
      }
    }
  }

  // Category soft fallbacks
  const cat = norm(input.category || '')
  if (cat === 'god') {
    const g = byKey.get('the-inquiry')
    if (g) return { ...g, statBias: { ...g.statBias } }
  }
  if (cat === 'human') {
    const h = byKey.get('theinquisition')
    if (h) return { ...h, statBias: { ...h.statBias } }
  }
  if (cat === 'weapon') {
    const w = byKey.get('riddle-weapons')
    if (w) return { ...w, statBias: { ...w.statBias } }
  }
  if (cat === 'ammo') {
    const a = byKey.get('riddle-ammo')
    if (a) return { ...a, statBias: { ...a.statBias } }
  }
  if (cat === 'pfp') {
    const p = byKey.get('under-the-bridge-riddle')
    if (p) return { ...p, statBias: { ...p.statBias } }
  }

  return defaultWiring()
}

/** Map wiring lookId → FighterCollectionId (already typed). */
export function wiringLookId(
  input: Parameters<typeof resolveCollectionWiring>[0],
): FighterCollectionId {
  return resolveCollectionWiring(input).lookId
}

/** Solid palette hints from visual theme / look (no gradients). */
export function wiringPalette(entry: CollectionWiringEntry): {
  primary: string
  secondary: string
  aura: string
} {
  switch (entry.lookId) {
    case 'inquiry':
    case 'generic_god':
      return { primary: '#fde68a', secondary: '#b45309', aura: '#fbbf24' }
    case 'inquisition':
      return { primary: '#94a3b8', secondary: '#334155', aura: '#a1a1aa' }
    case 'reborn':
      return { primary: '#a78bfa', secondary: '#4c1d95', aura: '#a78bfa' }
    case 'bridge':
      return { primary: '#22d3ee', secondary: '#0e7490', aura: '#22d3ee' }
    case 'starter':
      return { primary: '#64748b', secondary: '#1e293b', aura: '#94a3b8' }
    case 'generic_human':
      return { primary: '#52525b', secondary: '#18181b', aura: '#71717a' }
    default:
      return { primary: '#71717a', secondary: '#18181b', aura: '#52525b' }
  }
}

/** Convert wiring statBias into collectionMatrix-style combat hooks. */
export function wiringToHooks(entry: CollectionWiringEntry): {
  atkMult: number
  defMult: number
  specialMult: number
  reachMult: number
  meterStartBonus: number
  critBonus: number
  lifeSteal: number
  armorPen: number
} {
  const b = entry.statBias
  const hooks = {
    atkMult: b.power,
    defMult: b.defense,
    specialMult: b.technique,
    reachMult: 1,
    meterStartBonus: 0,
    critBonus: 0,
    lifeSteal: 0,
    armorPen: 0,
  }
  // Archetype micro-hooks on top of bias
  switch (entry.archetype) {
    case 'tank':
      hooks.defMult *= 1.02
      hooks.meterStartBonus += 4
      break
    case 'assassin':
      hooks.critBonus += 0.04
      hooks.armorPen += 0.03
      hooks.atkMult *= 1.02
      break
    case 'mage':
      hooks.specialMult *= 1.04
      hooks.meterStartBonus += 6
      hooks.reachMult = 1.06
      break
    case 'ranger':
      hooks.reachMult = 1.1
      hooks.critBonus += 0.03
      break
    case 'support':
      hooks.meterStartBonus += 8
      hooks.specialMult *= 1.02
      break
    case 'brawler':
    default:
      hooks.atkMult *= 1.01
      break
  }
  if (!entry.fightable && entry.equipable) {
    // equipables already encode their bias; no extra body scaling
  }
  return hooks
}

export function wiringVersion(): number {
  return data.version
}

/**
 * Preferred game-meta CDN slug for a wiring entry (when known).
 * Used by gameMetaScores resolution; null if no scanned pack exists.
 */
export function wiringGameMetaSlug(entry: CollectionWiringEntry): string | null {
  const key = entry.key.toLowerCase()
  const map: Record<string, string> = {
    theinquisition: 'theinquisition',
    'the-inquisition': 'theinquisition',
    'the-inquisition-reborn': 'the-inquisition-reborn',
    'the-inquiry': 'the-inquiry',
    'the-lost-emporium': 'the-lost-emporium',
    'under-the-bridge-riddle': 'under-the-bridge-riddle',
    dantesaurum: 'dantesaurum',
    riddletank: 'riddletank',
    'riddle-community': 'riddle-community',
    'riddle-basic-human': 'riddle-basic-human',
  }
  return map[key] || null
}
