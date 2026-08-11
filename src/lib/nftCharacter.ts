/**
 * Build combat characters from XRPL NFT metadata + RF trait plan.
 * Every relevant trait on the chosen NFT feeds stats, moves, colors, identity.
 */

import type { Fighter, FighterIdentity, FighterStats } from './fighters'
import { loadWl } from './fighters'
import { buildMoveset, traitMap, type FighterMoveset } from './moveset'
import { withCombatPowers } from './traitPowers'
import {
  classifyNft,
  isFightableCategory,
  CATEGORY_LABEL,
  type NftCategory,
} from './nftCatalog'
import {
  resolveCollectionWiring,
  wiringPalette,
} from './collectionWiring'
import { getCollectionLook } from '../game/render/collectionLooks'
import { splitArtSlots } from './nftArt'

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function numFromTrait(v: string | undefined, fallback: number): number {
  if (v == null || v === '') return fallback
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function firstTrait(
  tm: Record<string, string>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = tm[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return undefined
}

function hashHue(id: string): [string, string] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const palettes: [string, string][] = [
    ['#f472b6', '#9f1239'],
    ['#22d3ee', '#0e7490'],
    ['#a78bfa', '#4c1d95'],
    ['#34d399', '#065f46'],
    ['#fbbf24', '#92400e'],
    ['#fb923c', '#9a3412'],
    ['#e879f9', '#86198f'],
    ['#60a5fa', '#1e3a8a'],
    ['#fde68a', '#b45309'],
    ['#c4b5fd', '#5b21b6'],
  ]
  return palettes[h % palettes.length]!
}

function baseStatsFromId(id: string): FighterStats {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0
  return {
    hp: 95 + (h % 45),
    atk: 12 + (h % 9),
    def: 7 + ((h >> 3) % 10),
    speed: 9 + ((h >> 5) % 10),
    special: 18 + ((h >> 7) % 14),
  }
}

/** Pull full identity block from traits */
export function identityFromTraits(
  traits?: Array<{ trait_type?: string; value?: unknown }>,
): FighterIdentity {
  const tm = traitMap(traits)
  const level = numFromTrait(firstTrait(tm, ['level', 'lvl', 'rf level']), NaN)
  const xp = numFromTrait(firstTrait(tm, ['xp', 'experience', 'rf xp']), NaN)
  const powerRaw = numFromTrait(
    firstTrait(tm, ['power', 'rf atk', 'inherited power', 'atk', 'attack']),
    NaN,
  )
  const defenseRaw = numFromTrait(
    firstTrait(tm, [
      'defense',
      'defence',
      'rf def',
      'inherited defence',
      'inherited defense',
      'def',
    ]),
    NaN,
  )
  return {
    army: firstTrait(tm, ['army', 'owner army', 'faction army']),
    uniform: firstTrait(tm, ['uniform', 'outfit', 'skin']),
    gameClass: firstTrait(tm, ['game class', 'class', 'role', 'rf class']),
    faction: firstTrait(tm, ['faction bias', 'faction', 'side']),
    element: firstTrait(tm, [
      'inherited element',
      'element',
      'rf element',
      'affinity',
    ]),
    weapon: firstTrait(tm, ['weapon', 'armament', 'rf weapon', 'equipped']),
    level: Number.isFinite(level) ? Math.round(level) : undefined,
    xp: Number.isFinite(xp) ? Math.round(xp) : undefined,
    weight: firstTrait(tm, ['rf weight', 'weight', 'build']),
    stance: firstTrait(tm, ['rf stance', 'stance', 'rf battle stance', 'style']),
    title: firstTrait(tm, ['rf title', 'title', 'rank title']),
    handle: firstTrait(tm, ['rf handle', 'handle', 'username']),
    powerRaw: Number.isFinite(powerRaw) ? powerRaw : undefined,
    defenseRaw: Number.isFinite(defenseRaw) ? defenseRaw : undefined,
  }
}

/** Map RF / World traits → combat stats (all numeric characteristics). */
export function statsFromTraits(
  id: string,
  traits?: Array<{ trait_type?: string; value?: unknown }>,
  category?: NftCategory,
): FighterStats {
  const tm = traitMap(traits)
  const idn = identityFromTraits(traits)
  const base = baseStatsFromId(id)

  const power = numFromTrait(
    firstTrait(tm, ['power', 'rf atk', 'inherited power', 'atk', 'attack', 'strength']),
    NaN,
  )
  const defense = numFromTrait(
    firstTrait(tm, [
      'defense',
      'defence',
      'rf def',
      'inherited defence',
      'inherited defense',
      'def',
      'armor',
    ]),
    NaN,
  )
  const hpT = numFromTrait(
    firstTrait(tm, [
      'rf hp',
      'inherited health',
      'health',
      'hp',
      'vitality',
      'max hp',
    ]),
    NaN,
  )
  const spd = numFromTrait(
    firstTrait(tm, ['rf speed', 'speed', 'spd', 'agility', 'dex']),
    NaN,
  )
  const sp = numFromTrait(
    firstTrait(tm, ['rf special', 'special', 'magic', 'spirit', 'energy']),
    NaN,
  )
  const level = idn.level ?? numFromTrait(firstTrait(tm, ['level', 'lvl']), 1)
  const xp = idn.xp ?? 0

  const stats: FighterStats = {
    hp: Number.isFinite(hpT) ? clamp(70 + hpT * 0.9, 80, 180) : base.hp,
    atk: Number.isFinite(power) ? clamp(8 + power * 0.35, 8, 32) : base.atk,
    def: Number.isFinite(defense) ? clamp(4 + defense * 0.3, 4, 26) : base.def,
    speed: Number.isFinite(spd) ? clamp(6 + spd * 0.25, 6, 22) : base.speed,
    special: Number.isFinite(sp) ? clamp(14 + sp * 0.4, 14, 40) : base.special,
  }

  // Level + XP soft scale
  const lv = clamp(level, 1, 99)
  stats.hp = clamp(stats.hp + Math.floor(lv * 0.65) + Math.floor(xp / 500), 80, 190)
  stats.atk = clamp(stats.atk + Math.floor(lv * 0.14), 8, 34)
  stats.def = clamp(stats.def + Math.floor(lv * 0.11), 4, 28)
  stats.special = clamp(stats.special + Math.floor(lv * 0.1), 14, 42)

  // Class / weight / stance modifiers
  const cls = (idn.gameClass || '').toLowerCase()
  if (/tank|guard|warden|knight|heavy/i.test(cls)) {
    stats.hp += 12
    stats.def += 4
    stats.speed = Math.max(6, stats.speed - 2)
  } else if (/assassin|rogue|striker|ninja|swift/i.test(cls)) {
    stats.speed += 4
    stats.atk += 2
    stats.hp = Math.max(80, stats.hp - 6)
  } else if (/mage|oracle|void|mystic|sorcer/i.test(cls)) {
    stats.special += 6
    stats.atk += 1
    stats.def = Math.max(4, stats.def - 1)
  } else if (/brawler|fighter|monk|soldier/i.test(cls)) {
    stats.atk += 3
    stats.hp += 4
  }

  const weight = (idn.weight || '').toLowerCase()
  if (/heavy|tank|armor/i.test(weight)) {
    stats.def += 3
    stats.speed = Math.max(6, stats.speed - 2)
  } else if (/light|agile|glass/i.test(weight)) {
    stats.speed += 3
    stats.def = Math.max(4, stats.def - 1)
  }

  // Weapon bonus
  const weap = (idn.weapon || '').toLowerCase()
  if (/sword|blade|katana|axe|spear|halberd/i.test(weap)) stats.atk += 3
  else if (/staff|wand|tome|scepter/i.test(weap)) stats.special += 4
  else if (/gun|rifle|bow|crossbow|pistol/i.test(weap)) {
    stats.atk += 2
    stats.speed += 1
  } else if (/shield|plate|armor/i.test(weap)) stats.def += 3
  else if (weap) stats.atk += 1

  // Element flavor
  const el = (idn.element || '').toLowerCase()
  if (/fire|ember|solar|flame/i.test(el)) {
    stats.atk += 2
    stats.special += 2
  } else if (/void|shadow|dark|null/i.test(el)) {
    stats.special += 3
    stats.speed += 1
  } else if (/ice|water|frost/i.test(el)) {
    stats.def += 2
    stats.special += 1
  } else if (/earth|nature|grove|jade/i.test(el)) {
    stats.hp += 8
    stats.def += 2
  } else if (/electric|volt|cyber|storm/i.test(el)) {
    stats.speed += 3
    stats.special += 2
  } else if (/holy|divine|light|gold/i.test(el)) {
    stats.special += 3
    stats.hp += 4
  }

  // Army / faction small buffs
  if (idn.army) stats.hp += 3
  if (idn.faction) stats.special += 1

  if (category === 'god') {
    stats.atk += 4
    stats.special += 6
    stats.hp += 5
  } else if (category === 'human') {
    stats.hp += 10
    stats.def += 2
  }

  return {
    hp: Math.round(stats.hp),
    atk: Math.round(stats.atk),
    def: Math.round(stats.def),
    speed: Math.round(stats.speed),
    special: Math.round(stats.special),
  }
}

export function colorsFromTraits(
  id: string,
  traits?: Array<{ trait_type?: string; value?: unknown }>,
  collectionHint?: {
    taxon?: number | null
    collection?: string | null
    category?: string | null
    issuer?: string | null
  },
): [string, string] {
  const tm = traitMap(traits)
  const c1 = firstTrait(tm, [
    'rf color primary',
    'primary color',
    'color',
    'color primary',
    'main color',
  ])
  const c2 = firstTrait(tm, [
    'rf color secondary',
    'secondary color',
    'accent',
    'color secondary',
  ])
  if (c1 && /^#?[0-9a-f]{3,8}$/i.test(c1)) {
    const p = c1.startsWith('#') ? c1 : `#${c1}`
    const s =
      c2 && /^#?[0-9a-f]{3,8}$/i.test(c2)
        ? c2.startsWith('#')
          ? c2
          : `#${c2}`
        : hashHue(id)[1]
    return [p, s]
  }
  // Element-based palette when no hex colors
  const el = (
    firstTrait(tm, ['inherited element', 'element', 'rf element']) || ''
  ).toLowerCase()
  if (/fire|ember|flame/i.test(el)) return ['#f97316', '#9a3412']
  if (/void|shadow|dark/i.test(el)) return ['#a78bfa', '#4c1d95']
  if (/nature|earth|jade|grove/i.test(el)) return ['#34d399', '#065f46']
  if (/ice|water|frost/i.test(el)) return ['#67e8f9', '#0e7490']
  if (/electric|volt|cyber/i.test(el)) return ['#22d3ee', '#155e75']
  if (/holy|divine|gold/i.test(el)) return ['#fde68a', '#b45309']

  // Collection look / wiring palette — fighter body aura matches its set
  if (collectionHint) {
    const wiring = resolveCollectionWiring(collectionHint)
    const pal = wiringPalette(wiring)
    const look = getCollectionLook({
      taxon: collectionHint.taxon,
      category: collectionHint.category,
      collection: collectionHint.collection,
      id,
    })
    return [look.cloth[0] || pal.primary, look.cloth[1] || pal.secondary]
  }
  return hashHue(id)
}

export type NftCharacterInput = {
  nftId: string
  name: string
  image?: string
  originalImage?: string
  newImage?: string
  issuer?: string
  taxon?: number | null
  collection?: string
  uri?: string
  traits?: Array<{ trait_type?: string; value?: unknown }>
}

/** Full Fighter build from NFT fields — identity + combat kit. */
export function fighterFromNft(input: NftCharacterInput): Fighter {
  const id = input.nftId
  const cat = classifyNft({
    issuer: input.issuer || '',
    taxon: input.taxon ?? null,
    name: input.name,
    collection: input.collection || '',
    uri: input.uri || '',
    traits: input.traits,
  })
  const tm = traitMap(input.traits)
  const identity = identityFromTraits(input.traits)
  // Base stats only — withCombatPowers applies trait mults + wiring once
  const baseStats = statsFromTraits(id, input.traits, cat.category)
  const [color, color2] = colorsFromTraits(id, input.traits, {
    taxon: cat.taxon,
    collection: cat.collection || input.collection,
    category: cat.category,
    issuer: cat.issuer || input.issuer,
  })
  const moveset: FighterMoveset = buildMoveset({
    id,
    name: input.name,
    category: cat.category,
    traits: input.traits,
    specialName:
      firstTrait(tm, [
        'rf special name',
        'inherited special ability 1',
        'special name',
        'special ability',
      ]) || undefined,
    secretName:
      firstTrait(tm, [
        'rf super name',
        'inherited special ability 2',
        'super name',
        'ultimate',
        'secret',
      ]) || undefined,
    superName: firstTrait(tm, ['rf moveset', 'moveset', 'super move']) || undefined,
  })
  const wl = loadWl(id)
  // RF portrait trait can override display image, but never invent OLD/NEW slots
  const portrait = firstTrait(tm, ['rf portrait', 'portrait', 'battle portrait'])
  const portraitUrl =
    portrait && /^https?:|ipfs/i.test(portrait) ? portrait : undefined
  // Split genesis (OLD) vs evolved (NEW) — do not collapse both onto display
  const slots = splitArtSlots({
    name: input.name,
    image: portraitUrl || input.image,
    originalImage: input.originalImage,
    newImage: input.newImage,
    taxon: cat.taxon,
    collection: cat.collection || input.collection,
    traits: input.traits,
    uri: input.uri,
  })

  const title = identity.title || ''
  const handle = identity.handle ? `@${identity.handle.replace(/^@/, '')}` : ''
  let displayName = String(input.name).slice(0, 36)
  if (title) displayName = `${displayName} · ${String(title).slice(0, 14)}`
  else if (handle) displayName = `${displayName} · ${handle}`

  // Local W/L can be overridden by NFT record traits if present
  const nftWins = numFromTrait(firstTrait(tm, ['wins', 'rf wins', 'record wins']), NaN)
  const nftLosses = numFromTrait(firstTrait(tm, ['losses', 'rf losses', 'record losses']), NaN)

  const built: Fighter = {
    id: `nft-${id}`,
    name: displayName,
    image: slots.image || undefined,
    originalImage: slots.originalImage || undefined,
    newImage: slots.newImage,
    color,
    color2,
    stats: baseStats,
    specialName: moveset.special.name,
    secretName: moveset.secret.name,
    superName: moveset.super.name,
    moveset,
    identity,
    traits: input.traits,
    wins: Number.isFinite(nftWins) ? Math.max(wl.wins, Math.round(nftWins)) : wl.wins,
    losses: Number.isFinite(nftLosses)
      ? Math.max(wl.losses, Math.round(nftLosses))
      : wl.losses,
    source: 'nft',
    nftId: id,
    category: cat.category,
    categoryLabel: cat.label || CATEGORY_LABEL[cat.category],
    collection: cat.collection || input.collection,
    taxon: cat.taxon,
    issuer: cat.issuer || input.issuer,
    fightable: isFightableCategory(cat.category),
  }
  // Full kit: collection wiring biases + transparent Power Level (single pass)
  return withCombatPowers(built)
}

export function ensureMoveset(f: Fighter): FighterMoveset {
  if (f.moveset) return f.moveset
  return buildMoveset({
    id: f.id,
    name: f.name,
    category: f.category,
    traits: f.traits,
    specialName: f.specialName,
    secretName: f.secretName,
    superName: f.superName,
  })
}

/** Short trait chips for selection UI */
export function fighterTraitChips(f: Fighter): string[] {
  const id = f.identity
  const chips: string[] = []
  if (f.categoryLabel) chips.push(f.categoryLabel)
  if (id?.level != null) chips.push(`Lv ${id.level}`)
  if (id?.element) chips.push(id.element)
  if (id?.gameClass) chips.push(id.gameClass)
  if (id?.weapon) chips.push(id.weapon)
  if (id?.army) chips.push(id.army)
  if (id?.stance) chips.push(id.stance)
  chips.push(`HP ${f.stats.hp}`)
  chips.push(`ATK ${f.stats.atk}`)
  return chips.slice(0, 8)
}
