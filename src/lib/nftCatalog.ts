/**
 * Enterprise NFT category catalog for Fighter (+ shared with World/City).
 *
 * Product map (issuer rp5DGDDF… + lands r3fBtgr…):
 *   The Inquiry     (taxon 0)   → god (god-like characters)
 *   The Inquisition (taxon 2)   → human (special humans)
 *   Reborn          (taxon 1003 / reborn slug) → human (reborn fighter)
 *   Lands           (r3fBtgr · 1010) → city
 *   Riddle Weapons  (1012 / weapons) → weapon
 *   Lost Emporium   (taxon 3)   → item | weapon | vehicle | building
 *   Under the Bridge (9)        → pfp / human-like
 *   Community / Tank / Dante    → community | ticket | art
 */

export type NftCategory =
  | 'human'
  | 'god'
  | 'weapon'
  | 'ammo'
  | 'city'
  | 'building'
  | 'game_building'
  | 'item'
  | 'vehicle'
  | 'art'
  | 'ticket'
  | 'pfp'
  | 'community'
  | 'other'

export const FIGHTER_ISSUER = 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH'
export const LANDS_ISSUER = 'r3fBtgrV5ZvfqWKPLmvEtD6qRsQSmq2yPb'
/** Game mint wallet — Basic Human (9001), some Reborn (1003) live mints */
export const GAME_MINT_ISSUER = 'rDiHMcZARsb1uakt8tYScLbZuLRihZqjMp'

/**
 * Old (genesis) fighter collections on FIGHTER_ISSUER:
 *   taxon 0 = The Inquiry (gods)
 *   taxon 2 = The Inquisition (humans)
 * Reborn (1003) and other taxa are NOT part of the old collection.
 */
export const OLD_COLLECTION_TAXONS: ReadonlySet<number> = new Set([0, 2])

export function isFighterIssuer(issuer?: string | null): boolean {
  const iss = String(issuer || '')
    .trim()
    .toLowerCase()
  return iss === FIGHTER_ISSUER.toLowerCase() || iss.includes('rp5dgddf')
}

/** True when NFT is from the old collection (Inquiry 0 + Inquisition 2). */
export function isOldCollectionNft(input: {
  issuer?: string | null
  taxon?: number | null
}): boolean {
  if (!isFighterIssuer(input.issuer)) return false
  const t = input.taxon
  if (t == null || !Number.isFinite(Number(t))) return false
  return OLD_COLLECTION_TAXONS.has(Number(t))
}

/** Taxon → category for first-party issuer. */
export const TAXON_CATEGORY: Record<number, NftCategory> = {
  0: 'god', // The Inquiry — god-like
  2: 'human', // The Inquisition — special humans
  3: 'item', // Lost Emporium (refined by traits/name)
  4: 'art', // DANTES AURUM
  5: 'ticket', // RiddleTank
  9: 'pfp', // Under the Bridge
  10: 'community',
  1003: 'human', // Inquisition Reborn fighters (special humans line)
  1010: 'city', // Lands
  1011: 'city',
  1012: 'weapon', // Riddle Weapons
  1015: 'ammo', // Riddle Ammo
  1016: 'building', // City buildings
  1017: 'game_building', // Arcade / game halls
  9001: 'human',
}

export const CATEGORY_LABEL: Record<NftCategory, string> = {
  human: 'Human',
  god: 'God',
  weapon: 'Weapon',
  ammo: 'Ammo',
  city: 'City / Land',
  building: 'Building',
  game_building: 'Game Hall',
  item: 'Item',
  vehicle: 'Vehicle',
  art: 'Art',
  ticket: 'Ticket',
  pfp: 'PFP',
  community: 'Community',
  other: 'Other',
}

/** Categories that can enter the fight arena. */
export const FIGHTABLE: ReadonlySet<NftCategory> = new Set(['human', 'god'])

export type CatalogMeta = {
  category: NftCategory
  collection: string
  slug: string
  taxon: number | null
  issuer: string
  fightable: boolean
  label: string
}

function norm(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
}

export function parseTaxonFromRaw(raw: {
  NFTokenTaxon?: number
  nft_taxon?: number
  Issuer?: string
  issuer?: string
}): number | null {
  const t = raw.NFTokenTaxon ?? raw.nft_taxon
  if (t == null) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/**
 * Refine Lost Emporium / generic items by name + traits.
 */
function refineItemCategory(
  base: NftCategory,
  name: string,
  traitsBlob: string,
): NftCategory {
  const b = `${name} ${traitsBlob}`
  if (/ammo|bolt|shell|slug|round|cell|charge/i.test(b)) {
    return 'ammo'
  }
  if (/weapon|blade|sword|axe|staff|rifle|bow|gun|mace|spear|scythe|halberd|carbine/i.test(b)) {
    return 'weapon'
  }
  if (/vehicle|hover|board|tank|ship|transport|skiff|drone|airship/i.test(b)) {
    return 'vehicle'
  }
  if (/arcade|casino|esports|racing|game hall|arena pit/i.test(b)) {
    return 'game_building'
  }
  if (/building|house|tower|barracks|forge|wall|keep|structure|temple|armory|depot/i.test(b)) {
    return 'building'
  }
  if (/land|plot|city|castle|hamlet/i.test(b) && base !== 'weapon') {
    return 'city'
  }
  return base
}

/**
 * Classify any wallet/ledger NFT into an enterprise category.
 */
export function classifyNft(input: {
  issuer?: string
  taxon?: number | null
  name?: string
  collection?: string
  uri?: string
  traits?: Array<{ trait_type?: string; value?: unknown }> | Record<string, unknown>
}): CatalogMeta {
  const issuer = String(input.issuer || '').trim()
  const iss = norm(issuer)
  const name = String(input.name || '')
  const collection = String(input.collection || '')
  const col = norm(collection)
  const uri = String(input.uri || '')
  let taxon =
    input.taxon != null && Number.isFinite(Number(input.taxon))
      ? Number(input.taxon)
      : null

  let traitsBlob = ''
  if (Array.isArray(input.traits)) {
    traitsBlob = input.traits
      .map((t) => `${t.trait_type || ''} ${t.value ?? ''}`)
      .join(' ')
    if (taxon == null) {
      const tt = input.traits.find((t) =>
        /taxon|nftokentaxon/i.test(String(t.trait_type || '')),
      )
      if (tt) taxon = Number(tt.value)
    }
  } else if (input.traits && typeof input.traits === 'object') {
    traitsBlob = JSON.stringify(input.traits)
  }

  const blob = `${name} ${collection} ${uri} ${traitsBlob}`.toLowerCase()

  // Lands issuer first
  if (iss === LANDS_ISSUER.toLowerCase() || iss.includes('r3fbtgr')) {
    return pack('city', 'RiddleWorld Lands', 'riddleworld-lands', taxon ?? 1010, issuer)
  }

  // Game mint wallet (Basic Human free mint + some Reborn)
  if (iss === GAME_MINT_ISSUER.toLowerCase() || iss.includes('rdihmc')) {
    if (taxon === 9001 || /basic-human|starter-human|riddle-basic-human/i.test(blob)) {
      return pack('human', 'Riddle Basic Human', 'riddle-basic-human', taxon ?? 9001, issuer)
    }
    if (taxon === 1003 || /reborn|inquisition/i.test(blob)) {
      return pack('human', 'Inquisition Reborn', 'the-inquisition-reborn', taxon ?? 1003, issuer)
    }
    if (taxon != null && TAXON_CATEGORY[taxon] != null) {
      const cat = TAXON_CATEGORY[taxon]!
      return pack(cat, collection || CATEGORY_LABEL[cat], `taxon-${taxon}`, taxon, issuer)
    }
    return pack('human', collection || 'Riddle Game Mint', 'game-mint', taxon, issuer)
  }

  // URI / name hints for Basic Human even if issuer unknown
  if (/riddle-basic-human|basic-human|starter-human/i.test(blob) || taxon === 9001) {
    return pack('human', 'Riddle Basic Human', 'riddle-basic-human', taxon ?? 9001, issuer)
  }

  // Explicit taxon map for primary issuer
  if (iss === FIGHTER_ISSUER.toLowerCase() || iss.includes('rp5dgddf')) {
    if (taxon != null && TAXON_CATEGORY[taxon] != null) {
      let cat = TAXON_CATEGORY[taxon]!
      let slug =
        taxon === 0
          ? 'the-inquiry'
          : taxon === 2
            ? 'theinquisition'
            : taxon === 3
              ? 'the-lost-emporium'
              : taxon === 4
                ? 'dantesaurum'
                : taxon === 5
                  ? 'riddletank'
                  : taxon === 9
                    ? 'under-the-bridge-riddle'
                    : taxon === 10
                      ? 'riddle-community'
                      : taxon === 1003
                        ? 'the-inquisition-reborn'
                        : taxon === 1012
                          ? 'riddle-weapons'
                          : 'unknown'
      let coll =
        taxon === 0
          ? 'The Inquiry'
          : taxon === 2
            ? 'The Inquisition'
            : taxon === 3
              ? 'The Lost Emporium'
              : taxon === 1003
                ? 'Inquisition Reborn'
                : taxon === 1012
                  ? 'Riddle Weapons'
                  : collection || slug

      if (taxon === 3 || taxon === 1012) {
        cat = refineItemCategory(cat === 'weapon' ? 'weapon' : 'item', name, traitsBlob)
        if (cat === 'weapon' && taxon === 3) slug = 'the-lost-emporium'
      }
      if (taxon === 0) {
        // Inquiry = god-like
        cat = 'god'
      }
      if (taxon === 2) {
        // Inquisition = special humans
        cat = 'human'
      }
      return pack(cat, coll, slug, taxon, issuer)
    }
  }

  // Collection name hints
  if (/inquisition/.test(col) && /reborn/.test(col) && !/land/.test(col)) {
    return pack('human', 'Inquisition Reborn', 'the-inquisition-reborn', taxon, issuer)
  }
  if (
    (/the inquiry|inquiry/.test(col) || /inquiry/.test(blob)) &&
    !/inquisition/.test(col) &&
    !/inquisition/.test(blob)
  ) {
    return pack('god', 'The Inquiry', 'the-inquiry', taxon ?? 0, issuer)
  }
  if (/the inquisition|inquisition/.test(col) || /inquisition/.test(blob)) {
    return pack('human', 'The Inquisition', 'theinquisition', taxon ?? 2, issuer)
  }
  if (/weapon|riddle-weapons/.test(col) || /weapon/.test(blob)) {
    return pack('weapon', collection || 'Riddle Weapons', 'riddle-weapons', taxon, issuer)
  }
  if (/land|riddleworld lands|plot/.test(col) || /plot #|land #/.test(blob)) {
    return pack('city', collection || 'Lands', 'riddleworld-lands', taxon ?? 1010, issuer)
  }
  if (/building|structure/.test(blob)) {
    return pack('building', collection || 'Building', 'building', taxon, issuer)
  }
  if (/emporium/.test(col)) {
    const cat = refineItemCategory('item', name, traitsBlob)
    return pack(cat, 'The Lost Emporium', 'the-lost-emporium', taxon ?? 3, issuer)
  }
  if (/under the bridge|troll/.test(col)) {
    return pack('pfp', 'Under the Bridge', 'under-the-bridge-riddle', taxon ?? 9, issuer)
  }
  if (/dante|aurum/.test(col)) {
    return pack('art', 'DANTES AURUM', 'dantesaurum', taxon ?? 4, issuer)
  }
  if (/tank/.test(col)) {
    return pack('ticket', 'RiddleTank', 'riddletank', taxon ?? 5, issuer)
  }
  if (/community/.test(col)) {
    return pack('community', 'Riddle Community', 'riddle-community', taxon ?? 10, issuer)
  }

  // Name-only fallbacks
  if (/blade|sword|axe|rifle|staff|weapon/.test(name)) {
    return pack('weapon', collection || 'Weapon', 'weapon', taxon, issuer)
  }

  return pack('other', collection || 'NFT', 'other', taxon, issuer)
}

function pack(
  category: NftCategory,
  collection: string,
  slug: string,
  taxon: number | null,
  issuer: string,
): CatalogMeta {
  return {
    category,
    collection,
    slug,
    taxon,
    issuer,
    fightable: FIGHTABLE.has(category),
    label: CATEGORY_LABEL[category],
  }
}

export function isFightableCategory(c: NftCategory): boolean {
  return FIGHTABLE.has(c)
}

/** Enterprise filter tabs for picker UI. */
export const PICKER_TABS: { id: NftCategory | 'all' | 'fightable'; label: string }[] = [
  { id: 'fightable', label: 'Fighters' },
  { id: 'all', label: 'All' },
  { id: 'human', label: 'Humans' },
  { id: 'god', label: 'Gods' },
  { id: 'weapon', label: 'Weapons' },
  { id: 'ammo', label: 'Ammo' },
  { id: 'city', label: 'Cities' },
  { id: 'building', label: 'Buildings' },
  { id: 'game_building', label: 'Game Halls' },
  { id: 'item', label: 'Items' },
  { id: 'other', label: 'Other' },
]
