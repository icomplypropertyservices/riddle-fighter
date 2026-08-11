/**
 * Per–NFT-collection realistic fighter look profiles.
 * Used by fighterRenderer so each collection reads as a distinct, realistic fighter.
 *
 * Look ids are also authored in collection-wiring.json (hand-categorised).
 * resolveCollectionId prefers wiring, then taxon/name fallbacks.
 *
 * Collections (issuer rp5DGDDF…):
 *   taxon 0    The Inquiry      → gods
 *   taxon 2    The Inquisition  → special humans
 *   taxon 1003 Reborn           → reborn humans
 *   taxon 9    Under the Bridge → PFP-style humans
 *   taxon 9001 Basic Human      → free starter recruit
 */

import { resolveCollectionWiring } from '../../lib/collectionWiring'

export type FighterCollectionId =
  | 'inquiry'
  | 'inquisition'
  | 'reborn'
  | 'bridge'
  | 'starter'
  | 'generic_human'
  | 'generic_god'
  | 'unknown'

export type CollectionLook = {
  id: FighterCollectionId
  label: string
  /** Body height scale */
  height: number
  /** Torso width scale */
  bulk: number
  limbThick: number
  /** Skin base / shadow / highlight */
  skin: [string, string, string]
  /** Cloth / armor primary when NFT colors weak */
  cloth: [string, string]
  /** Boots / pants */
  boots: string
  /** Draw divine halo / aura */
  divine: boolean
  /** Tech / reborn edge glow */
  tech: boolean
  /** Armor overlay: none | leather | plate | divine | recruit */
  armor: 'none' | 'leather' | 'plate' | 'divine' | 'recruit' | 'reborn'
  /** How large NFT face plate is (0.8–1.4) */
  faceScale: number
  /** Also paint NFT onto chest plate */
  chestPlate: boolean
  /** Aura color override */
  aura?: string
  /** Silhouette outline for readability */
  outline: string
}

/** Exported for frame-bake / pose preview tools */
export const LOOKS: Record<FighterCollectionId, CollectionLook> = {
  inquiry: {
    id: 'inquiry',
    label: 'The Inquiry',
    height: 1.12,
    bulk: 1.08,
    limbThick: 1.05,
    skin: ['#f5e6c8', '#d4a574', '#8b6914'],
    cloth: ['#fde68a', '#b45309'],
    boots: '#1c1917',
    divine: true,
    tech: false,
    armor: 'divine',
    faceScale: 1.2,
    chestPlate: true,
    aura: '#fbbf24',
    outline: 'rgba(251,191,36,0.55)',
  },
  inquisition: {
    id: 'inquisition',
    label: 'The Inquisition',
    height: 1.05,
    bulk: 1.12,
    limbThick: 1.12,
    skin: ['#e8c4a0', '#c49a6c', '#6b4423'],
    cloth: ['#3f3f46', '#18181b'],
    boots: '#0c0a09',
    divine: false,
    tech: false,
    armor: 'plate',
    faceScale: 1.15,
    chestPlate: true,
    aura: '#a1a1aa',
    outline: 'rgba(161,161,170,0.4)',
  },
  reborn: {
    id: 'reborn',
    label: 'Inquisition Reborn',
    height: 1.06,
    bulk: 1.06,
    limbThick: 1.08,
    skin: ['#f0d0b0', '#c98b5a', '#7a4a2a'],
    cloth: ['#7c3aed', '#1e1b4b'],
    boots: '#0f172a',
    divine: false,
    tech: true,
    armor: 'reborn',
    faceScale: 1.18,
    chestPlate: true,
    aura: '#a78bfa',
    outline: 'rgba(167,139,250,0.5)',
  },
  bridge: {
    id: 'bridge',
    label: 'Under the Bridge',
    height: 1.0,
    bulk: 1.0,
    limbThick: 1.0,
    skin: ['#e8b89a', '#b07850', '#5c3a24'],
    cloth: ['#22d3ee', '#0e7490'],
    boots: '#164e63',
    divine: false,
    tech: false,
    armor: 'leather',
    faceScale: 1.25,
    chestPlate: true,
    aura: '#22d3ee',
    outline: 'rgba(34,211,238,0.4)',
  },
  starter: {
    id: 'starter',
    label: 'Basic Human',
    height: 1.0,
    bulk: 0.98,
    limbThick: 1.0,
    skin: ['#f0c8a8', '#c9926a', '#6b4423'],
    cloth: ['#64748b', '#1e293b'],
    boots: '#1e293b',
    divine: false,
    tech: false,
    armor: 'recruit',
    faceScale: 1.1,
    chestPlate: false,
    outline: 'rgba(148,163,184,0.35)',
  },
  generic_human: {
    id: 'generic_human',
    label: 'Human',
    height: 1.02,
    bulk: 1.04,
    limbThick: 1.06,
    skin: ['#e8c4a0', '#b88860', '#6b4423'],
    cloth: ['#52525b', '#18181b'],
    boots: '#0c0a09',
    divine: false,
    tech: false,
    armor: 'leather',
    faceScale: 1.12,
    chestPlate: true,
    outline: 'rgba(120,120,130,0.35)',
  },
  generic_god: {
    id: 'generic_god',
    label: 'God',
    height: 1.1,
    bulk: 1.06,
    limbThick: 1.04,
    skin: ['#f5e6d0', '#d4b08c', '#8a7040'],
    cloth: ['#c4b5fd', '#4c1d95'],
    boots: '#1e1b4b',
    divine: true,
    tech: false,
    armor: 'divine',
    faceScale: 1.18,
    chestPlate: true,
    aura: '#c4b5fd',
    outline: 'rgba(196,181,253,0.45)',
  },
  unknown: {
    id: 'unknown',
    label: 'Fighter',
    height: 1.0,
    bulk: 1.0,
    limbThick: 1.0,
    skin: ['#e0b090', '#a87850', '#5a3a22'],
    cloth: ['#71717a', '#18181b'],
    boots: '#18181b',
    divine: false,
    tech: false,
    armor: 'none',
    faceScale: 1.1,
    chestPlate: true,
    outline: 'rgba(100,100,110,0.3)',
  },
}

export function resolveCollectionId(input: {
  taxon?: number | null
  category?: string | null
  collection?: string | null
  id?: string | null
  nftId?: string | null
  slug?: string | null
  issuer?: string | null
}): FighterCollectionId {
  // Prefer hand-authored collection wiring (lookId per collection)
  const wired = resolveCollectionWiring({
    taxon: input.taxon,
    collection: input.collection,
    category: input.category,
    slug: input.slug,
    issuer: input.issuer,
    key: input.slug,
  })
  if (wired && wired.key !== 'default' && wired.lookId) return wired.lookId

  const tax = input.taxon != null ? Number(input.taxon) : NaN
  const col = String(input.collection || '').toLowerCase()
  const id = String(input.nftId || input.id || '').toLowerCase()
  const cat = String(input.category || '').toLowerCase()
  const slug = String(input.slug || '').toLowerCase()

  if (tax === 0 || slug === 'the-inquiry' || col.includes('the inquiry') || (col.includes('inquiry') && !col.includes('inquisition')))
    return 'inquiry'
  if (tax === 2 || slug === 'theinquisition' || slug === 'the-inquisition' || (col.includes('inquisition') && !col.includes('reborn')))
    return 'inquisition'
  if (tax === 1003 || slug.includes('reborn') || col.includes('reborn')) return 'reborn'
  if (tax === 9 || slug.includes('bridge') || col.includes('under the bridge') || col.includes('bridge'))
    return 'bridge'
  if (
    tax === 9001 ||
    slug.includes('basic-human') ||
    col.includes('basic human') ||
    id.includes('starter-human') ||
    id.includes('basic-human')
  ) {
    return 'starter'
  }
  // Non-body collections still resolve a look for gear overlays / picker
  if (tax === 1012 || col.includes('weapon')) return 'inquisition'
  if (tax === 1015 || col.includes('ammo')) return 'reborn'
  if (tax === 3 || col.includes('emporium')) return 'generic_human'
  if (tax === 4 || col.includes('dante') || col.includes('aurum')) return 'generic_god'
  if (tax === 1101 || col.includes('transport')) return 'generic_human'
  if (tax === 1200 || col.includes('civilization')) return 'generic_god'
  if (cat === 'god') return 'generic_god'
  if (cat === 'human' || cat === 'pfp') return 'generic_human'
  return 'unknown'
}

export function getCollectionLook(input: {
  taxon?: number | null
  category?: string | null
  collection?: string | null
  id?: string | null
  nftId?: string | null
  color?: string
  color2?: string
}): CollectionLook {
  const id = resolveCollectionId(input)
  const base = { ...LOOKS[id] }
  // Blend NFT accent colors into cloth when provided
  if (input.color && /^#/.test(input.color)) {
    base.cloth = [input.color, input.color2 && /^#/.test(input.color2) ? input.color2 : base.cloth[1]]
    if (!base.aura) base.aura = input.color
  }
  return base
}

/** Distinct looks to bake into multi-frame packs (skip pure aliases). */
export const LOOKS_FOR_BAKE: CollectionLook[] = [
  LOOKS.starter,
  LOOKS.inquisition,
  LOOKS.inquiry,
  LOOKS.reborn,
  LOOKS.bridge,
  LOOKS.generic_human,
  LOOKS.generic_god,
]
