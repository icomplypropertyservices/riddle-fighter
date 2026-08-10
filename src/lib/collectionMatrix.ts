/**
 * Canonical NFT collection matrix for Riddle Fighter.
 * Every suite collection has: graphics profile id, fight role, gameplay hooks.
 * Source of truth aligned with city suite-nft-collections + nftCatalog.
 * Hand-authored combat archetypes / biases live in collection-wiring.json
 * (see collectionWiring.ts) and are preferred when resolving looks + PL.
 */

import type { NftCategory } from './nftCatalog'
import type { FighterCollectionId } from '../game/render/collectionLooks'
import { resolveCollectionWiring, wiringToHooks } from './collectionWiring'

export type FightRole =
  | 'fighter' // enter arena as character
  | 'weapon' // equip gear
  | 'ammo' // equip ammo
  | 'passive' // inventory / bonus only
  | 'block' // not used in fighter

export type CollectionGameplay = {
  slug: string
  name: string
  taxon: number | null
  issuer: string
  category: NftCategory
  lookId: FighterCollectionId
  role: FightRole
  /** Can be selected as P1/P2 body */
  fightable: boolean
  /** Can equip on a fighter */
  equipable: boolean
  /** Gameplay description */
  gameplay: string
  /** Stat / combat hooks when equipped or selected */
  hooks: {
    atkMult?: number
    defMult?: number
    specialMult?: number
    reachMult?: number
    meterStartBonus?: number
    critBonus?: number
    lifeSteal?: number
    armorPen?: number
  }
  /** Visual FX key for gear overlay */
  gearFx?: 'blade' | 'gun' | 'staff' | 'shield' | 'ammo' | 'aura' | 'none'
}

const ISSUER = 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH'
const LANDS = 'r3fBtgrV5ZvfqWKPLmvEtD6qRsQSmq2yPb'

/** Methodical full matrix — every known collection. */
export const COLLECTION_MATRIX: CollectionGameplay[] = [
  {
    slug: 'the-inquiry',
    name: 'The Inquiry',
    taxon: 0,
    issuer: ISSUER,
    category: 'god',
    lookId: 'inquiry',
    role: 'fighter',
    fightable: true,
    equipable: false,
    gameplay: 'God fighter · divine reach · special/super power',
    hooks: { specialMult: 1.12, reachMult: 1.08, meterStartBonus: 8, critBonus: 0.04 },
    gearFx: 'aura',
  },
  {
    slug: 'theinquisition',
    name: 'The Inquisition',
    taxon: 2,
    issuer: ISSUER,
    category: 'human',
    lookId: 'inquisition',
    role: 'fighter',
    fightable: true,
    equipable: false,
    gameplay: 'Human fighter · plate armor · balanced street kit',
    hooks: { atkMult: 1.06, defMult: 1.1, meterStartBonus: 4 },
    gearFx: 'none',
  },
  {
    slug: 'the-inquisition-reborn',
    name: 'Inquisition Reborn',
    taxon: 1003,
    issuer: ISSUER,
    category: 'human',
    lookId: 'reborn',
    role: 'fighter',
    fightable: true,
    equipable: false,
    gameplay: 'Reborn human · tech edge · faster startup',
    hooks: { atkMult: 1.08, specialMult: 1.06, critBonus: 0.05, armorPen: 0.04 },
    gearFx: 'aura',
  },
  {
    slug: 'under-the-bridge-riddle',
    name: 'Under the Bridge',
    taxon: 9,
    issuer: ISSUER,
    category: 'pfp',
    lookId: 'bridge',
    role: 'fighter',
    fightable: true,
    equipable: false,
    gameplay: 'PFP human · face-forward identity · agile kit',
    hooks: { atkMult: 1.04, critBonus: 0.06, lifeSteal: 0.03 },
    gearFx: 'none',
  },
  {
    slug: 'riddle-basic-human',
    name: 'Basic Human',
    taxon: 9001,
    issuer: ISSUER,
    category: 'human',
    lookId: 'starter',
    role: 'fighter',
    fightable: true,
    equipable: false,
    gameplay: 'Free recruit starter · fair baseline stats',
    hooks: { atkMult: 1.0, defMult: 1.0 },
    gearFx: 'none',
  },
  {
    slug: 'riddle-weapons',
    name: 'Riddle Weapons',
    taxon: 1012,
    issuer: ISSUER,
    category: 'weapon',
    lookId: 'generic_human',
    role: 'weapon',
    fightable: false,
    equipable: true,
    gameplay: 'Equip weapon · +ATK +reach · gear silhouette',
    hooks: { atkMult: 1.12, reachMult: 1.15, critBonus: 0.05, armorPen: 0.06 },
    gearFx: 'blade',
  },
  {
    slug: 'riddle-ammo',
    name: 'Riddle Ammo',
    taxon: 1015,
    issuer: ISSUER,
    category: 'ammo',
    lookId: 'generic_human',
    role: 'ammo',
    fightable: false,
    equipable: true,
    gameplay: 'Equip ammo · +special damage · chip on block',
    hooks: { specialMult: 1.1, atkMult: 1.04, critBonus: 0.03 },
    gearFx: 'ammo',
  },
  {
    slug: 'the-lost-emporium',
    name: 'The Lost Emporium',
    taxon: 3,
    issuer: ISSUER,
    category: 'item',
    lookId: 'generic_human',
    role: 'weapon',
    fightable: false,
    equipable: true,
    gameplay: 'Emporium gear · soft weapon/item equip',
    hooks: { atkMult: 1.06, defMult: 1.04, meterStartBonus: 5 },
    gearFx: 'blade',
  },
  {
    slug: 'dantesaurum',
    name: 'DANTES AURUM',
    taxon: 4,
    issuer: ISSUER,
    category: 'art',
    lookId: 'generic_god',
    role: 'passive',
    fightable: false,
    equipable: true,
    gameplay: 'Art charm · meter regen aura when equipped',
    hooks: { specialMult: 1.05, meterStartBonus: 10, critBonus: 0.02 },
    gearFx: 'aura',
  },
  {
    slug: 'riddletank',
    name: 'RiddleTank',
    taxon: 5,
    issuer: ISSUER,
    category: 'ticket',
    lookId: 'generic_human',
    role: 'passive',
    fightable: false,
    equipable: true,
    gameplay: 'Ticket charm · +defense when equipped',
    hooks: { defMult: 1.08, meterStartBonus: 6 },
    gearFx: 'shield',
  },
  {
    slug: 'riddle-community',
    name: 'Riddle Community',
    taxon: 10,
    issuer: ISSUER,
    category: 'community',
    lookId: 'generic_human',
    role: 'passive',
    fightable: false,
    equipable: true,
    gameplay: 'Community badge · happiness-style meter gain',
    hooks: { meterStartBonus: 8, specialMult: 1.03 },
    gearFx: 'aura',
  },
  {
    slug: 'riddleworld-lands',
    name: 'RiddleWorld Lands',
    taxon: 1010,
    issuer: LANDS,
    category: 'city',
    lookId: 'unknown',
    role: 'block',
    fightable: false,
    equipable: false,
    gameplay: 'Land NFTs plant cities — not arena bodies (use City app)',
    hooks: {},
    gearFx: 'none',
  },
  {
    slug: 'riddle-land-buildings',
    name: 'Riddle Land Buildings',
    taxon: 1016,
    issuer: ISSUER,
    category: 'building',
    lookId: 'unknown',
    role: 'block',
    fightable: false,
    equipable: false,
    gameplay: 'City structures only — place in City app',
    hooks: {},
    gearFx: 'none',
  },
  {
    slug: 'riddle-game-buildings',
    name: 'Game Halls',
    taxon: 1017,
    issuer: ISSUER,
    category: 'game_building',
    lookId: 'unknown',
    role: 'block',
    fightable: false,
    equipable: false,
    gameplay: 'City game-hall buildings',
    hooks: {},
    gearFx: 'none',
  },
  {
    slug: 'riddle-transport',
    name: 'Riddle Transport',
    taxon: 1101,
    issuer: ISSUER,
    category: 'vehicle',
    lookId: 'generic_human',
    role: 'passive',
    fightable: false,
    equipable: true,
    gameplay: 'Transport charm · walk speed in arena',
    hooks: { atkMult: 1.02, reachMult: 1.04 },
    gearFx: 'none',
  },
]

const byTaxon = new Map<number, CollectionGameplay>()
const bySlug = new Map<string, CollectionGameplay>()
for (const c of COLLECTION_MATRIX) {
  if (c.taxon != null) byTaxon.set(c.taxon, c)
  bySlug.set(c.slug, c)
}

export function collectionGameplayFor(input: {
  taxon?: number | null
  collection?: string | null
  category?: string | null
  slug?: string | null
  issuer?: string | null
}): CollectionGameplay | null {
  if (input.slug && bySlug.has(input.slug)) return bySlug.get(input.slug)!
  if (input.taxon != null && byTaxon.has(Number(input.taxon))) {
    return byTaxon.get(Number(input.taxon))!
  }
  const col = String(input.collection || '').toLowerCase()
  for (const c of COLLECTION_MATRIX) {
    if (col && col.includes(c.name.toLowerCase().slice(0, 8))) return c
    if (col && col.includes(c.slug.replace(/-/g, ' '))) return c
  }
  if (input.category === 'god') return bySlug.get('the-inquiry') || null
  if (input.category === 'human') return bySlug.get('theinquisition') || null
  if (input.category === 'weapon') return bySlug.get('riddle-weapons') || null
  if (input.category === 'ammo') return bySlug.get('riddle-ammo') || null

  // Fall through to hand-authored wiring as a soft CollectionGameplay adapter
  const w = resolveCollectionWiring({
    taxon: input.taxon,
    collection: input.collection,
    category: input.category,
    slug: input.slug,
    issuer: input.issuer,
  })
  if (w.key === 'default') return null
  const hooks = wiringToHooks(w)
  return {
    slug: w.key,
    name: w.name,
    taxon: w.taxon,
    issuer: w.issuer || '',
    category: (input.category as NftCategory) || 'other',
    lookId: w.lookId,
    role:
      w.fightRole === 'fighter'
        ? 'fighter'
        : w.fightRole === 'weapon'
          ? 'weapon'
          : w.fightRole === 'ammo'
            ? 'ammo'
            : w.fightRole === 'block'
              ? 'block'
              : 'passive',
    fightable: w.fightable,
    equipable: w.equipable,
    gameplay: w.combatStyle,
    hooks: {
      atkMult: hooks.atkMult,
      defMult: hooks.defMult,
      specialMult: hooks.specialMult,
      reachMult: hooks.reachMult,
      meterStartBonus: hooks.meterStartBonus,
      critBonus: hooks.critBonus,
      lifeSteal: hooks.lifeSteal,
      armorPen: hooks.armorPen,
    },
    gearFx: w.equipable ? 'aura' : 'none',
  }
}

/** Merge fighter base hooks + equipped gear hooks into mult bag. */
export function mergeEquipHooks(
  base: CollectionGameplay['hooks'],
  gear: Array<CollectionGameplay['hooks']>,
): Required<CollectionGameplay['hooks']> {
  const out = {
    atkMult: base.atkMult ?? 1,
    defMult: base.defMult ?? 1,
    specialMult: base.specialMult ?? 1,
    reachMult: base.reachMult ?? 1,
    meterStartBonus: base.meterStartBonus ?? 0,
    critBonus: base.critBonus ?? 0,
    lifeSteal: base.lifeSteal ?? 0,
    armorPen: base.armorPen ?? 0,
  }
  for (const g of gear) {
    out.atkMult *= g.atkMult ?? 1
    out.defMult *= g.defMult ?? 1
    out.specialMult *= g.specialMult ?? 1
    out.reachMult *= g.reachMult ?? 1
    out.meterStartBonus += g.meterStartBonus ?? 0
    out.critBonus += g.critBonus ?? 0
    out.lifeSteal += g.lifeSteal ?? 0
    out.armorPen += g.armorPen ?? 0
  }
  return out
}

export function fightableCollections(): CollectionGameplay[] {
  return COLLECTION_MATRIX.filter((c) => c.fightable)
}

export function equipableCollections(): CollectionGameplay[] {
  return COLLECTION_MATRIX.filter((c) => c.equipable)
}
