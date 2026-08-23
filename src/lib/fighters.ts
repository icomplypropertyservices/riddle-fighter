/**
 * NFT fighters — demo roster + wallet NFTs.
 * HD / normal graphics (not 8-bit); combat kits from moveset + NFT traits.
 */

export type FighterStats = {
  hp: number
  atk: number
  def: number
  speed: number
  special: number
}

import type { NftCategory } from './nftCatalog'
import { buildMoveset, type FighterMoveset } from './moveset'
import { generateFighterPortrait } from './portraitGen'
import { bodyUrlFor } from './characterBodies'
import type { CombatPowers } from './traitPowers'
import { withCombatPowers } from './traitPowers'

/** Extra identity pulled from NFT traits — all feed combat / UI. */
export type FighterIdentity = {
  army?: string
  uniform?: string
  gameClass?: string
  faction?: string
  element?: string
  weapon?: string
  level?: number
  xp?: number
  weight?: string
  stance?: string
  title?: string
  handle?: string
  powerRaw?: number
  defenseRaw?: number
}

export type Fighter = {
  id: string
  name: string
  image?: string
  /** Ledger / genesis art (OLD) — identity lock */
  originalImage?: string
  /** Mutable / evolved art (NEW) */
  newImage?: string
  /** Dominant accent for aura / FX */
  color: string
  color2: string
  stats: FighterStats
  specialName: string
  /** Full-meter secret super name */
  secretName?: string
  /** Secondary super name */
  superName?: string
  /** Complete move kit */
  moveset?: FighterMoveset
  /** NFT-derived identity used in fight + selection */
  identity?: FighterIdentity
  wins: number
  losses: number
  source: 'demo' | 'nft'
  nftId?: string
  category?: NftCategory
  categoryLabel?: string
  collection?: string
  taxon?: number | null
  issuer?: string
  fightable?: boolean
  traits?: Array<{ trait_type?: string; value?: unknown }>
  /** Every trait resolved into combat functions (engine reads this). */
  powers?: CombatPowers
  /** Transparent Power Level total (base + traits + collection). */
  powerLevel?: number
  /** Full PL breakdown for picker / VS UI. */
  powerBreakdown?: import('./traitPowers').PowerLevelBreakdown
}

type DemoSeed = Omit<Fighter, 'wins' | 'losses' | 'moveset'> & {
  element?: string
}

const DEMO: DemoSeed[] = [
  {
    id: 'demo-ember',
    name: 'Ember Reborn',
    color: '#f472b6',
    color2: '#9f1239',
    stats: { hp: 100, atk: 14, def: 8, speed: 12, special: 22 },
    specialName: 'Rose Nova',
    secretName: 'Ash Phoenix',
    superName: 'Solar Flare Barrage',
    source: 'demo',
    category: 'human',
    fightable: true,
    element: 'fire',
  },
  {
    id: 'demo-iron',
    name: 'Iron Inquisitor',
    color: '#94a3b8',
    color2: '#334155',
    stats: { hp: 120, atk: 12, def: 14, speed: 8, special: 18 },
    specialName: 'Plate Crash',
    secretName: 'Fortress Breaker',
    superName: 'Siege Ram',
    source: 'demo',
    category: 'human',
    fightable: true,
    element: 'iron',
  },
  {
    id: 'demo-void',
    name: 'Void Striker',
    color: '#a78bfa',
    color2: '#4c1d95',
    stats: { hp: 90, atk: 16, def: 6, speed: 15, special: 24 },
    specialName: 'Riddle Wave',
    secretName: 'Void Script Finale',
    superName: 'Event Horizon',
    source: 'demo',
    category: 'god',
    fightable: true,
    element: 'void',
  },
  {
    id: 'demo-ash',
    name: 'Ashen Monk',
    color: '#fbbf24',
    color2: '#92400e',
    stats: { hp: 105, atk: 13, def: 10, speed: 11, special: 20 },
    specialName: 'Temple Palm',
    secretName: 'Ash Phoenix',
    superName: 'Solar Flare Barrage',
    source: 'demo',
    category: 'human',
    fightable: true,
    element: 'fire',
  },
  {
    id: 'demo-cyan',
    name: 'Cyan Blade',
    color: '#22d3ee',
    color2: '#0e7490',
    stats: { hp: 95, atk: 15, def: 7, speed: 14, special: 21 },
    specialName: 'Ledger Slash',
    secretName: 'Mainframe Overclock',
    superName: 'Packet Storm',
    source: 'demo',
    category: 'human',
    fightable: true,
    element: 'cyber',
  },
  {
    id: 'demo-jade',
    name: 'Jade Warden',
    color: '#34d399',
    color2: '#065f46',
    stats: { hp: 110, atk: 11, def: 12, speed: 10, special: 19 },
    specialName: 'Grove Guard',
    secretName: 'Worldtree Bloom',
    superName: 'Thorn Cascade',
    source: 'demo',
    category: 'human',
    fightable: true,
    element: 'nature',
  },
  {
    id: 'demo-inquiry',
    name: 'Inquiry Oracle',
    color: '#fde68a',
    color2: '#b45309',
    stats: { hp: 115, atk: 15, def: 11, speed: 11, special: 26 },
    specialName: 'Divine Judgment',
    secretName: 'Riddle Apocalypse',
    superName: 'Ledger Collapse',
    source: 'demo',
    category: 'god',
    fightable: true,
    element: 'god',
  },
  {
    id: 'demo-bridge',
    name: 'Bridge Ghost',
    color: '#67e8f9',
    color2: '#0e7490',
    stats: { hp: 92, atk: 15, def: 7, speed: 16, special: 23 },
    specialName: 'Riddle Wave',
    secretName: 'Void Script Finale',
    superName: 'Event Horizon',
    source: 'demo',
    category: 'human',
    fightable: true,
    element: 'void',
  },
  // —— Play specialists (always pickable, free spar) ——
  {
    id: 'spec-rook',
    name: 'Specialist Rook',
    color: '#94a3b8',
    color2: '#1e293b',
    stats: { hp: 125, atk: 11, def: 16, speed: 7, special: 17 },
    specialName: 'Fortress Wall',
    secretName: 'Castle Drop',
    superName: 'Siege Line',
    source: 'demo',
    category: 'human',
    fightable: true,
    element: 'iron',
  },
  {
    id: 'spec-nova',
    name: 'Specialist Nova',
    color: '#f472b6',
    color2: '#9d174d',
    stats: { hp: 98, atk: 16, def: 8, speed: 14, special: 24 },
    specialName: 'Star Burst',
    secretName: 'Supernova Seal',
    superName: 'Orbit Rush',
    source: 'demo',
    category: 'god',
    fightable: true,
    element: 'fire',
  },
  {
    id: 'spec-quill',
    name: 'Specialist Quill',
    color: '#a78bfa',
    color2: '#5b21b6',
    stats: { hp: 100, atk: 13, def: 10, speed: 13, special: 22 },
    specialName: 'Ink Slash',
    secretName: 'Ledger Storm',
    superName: 'Page Flip',
    source: 'demo',
    category: 'human',
    fightable: true,
    element: 'void',
  },
  {
    id: 'spec-bolt',
    name: 'Specialist Bolt',
    color: '#22d3ee',
    color2: '#0e7490',
    stats: { hp: 90, atk: 15, def: 7, speed: 17, special: 21 },
    specialName: 'Amp Spike',
    secretName: 'Mainframe Overclock',
    superName: 'Packet Storm',
    source: 'demo',
    category: 'human',
    fightable: true,
    element: 'cyber',
  },
]

function wlKey(id: string): string {
  return `rf_fighter_wl_${id}`
}

/** Exported for NFT enrich / custom image fighters. */
export function loadWl(id: string): { wins: number; losses: number } {
  try {
    const raw = localStorage.getItem(wlKey(id))
    if (!raw) return { wins: 0, losses: 0 }
    const j = JSON.parse(raw) as { wins?: number; losses?: number }
    return {
      wins: Math.max(0, Math.floor(Number(j.wins) || 0)),
      losses: Math.max(0, Math.floor(Number(j.losses) || 0)),
    }
  } catch {
    return { wins: 0, losses: 0 }
  }
}

export function bumpFighterRecord(id: string, won: boolean): void {
  const cur = loadWl(id)
  if (won) cur.wins += 1
  else cur.losses += 1
  try {
    localStorage.setItem(wlKey(id), JSON.stringify(cur))
  } catch {
    /* soft */
  }
}

function withMoves(seed: DemoSeed): Fighter {
  const { element, ...rest } = seed
  const moveset = buildMoveset({
    id: seed.id,
    name: seed.name,
    category: seed.category === 'god' ? 'god' : seed.category === 'human' ? 'human' : undefined,
    specialName: seed.specialName,
    secretName: seed.secretName,
    superName: seed.superName,
    traits: element
      ? [{ trait_type: 'Inherited Element', value: element }]
      : undefined,
  })
  const wl = loadWl(seed.id)
  // Prefer actual character body art for picker + identity; canvas portrait as fallback
  let image = rest.image
  try {
    if (!image) {
      image = bodyUrlFor({ id: seed.id, category: seed.category }, 'idle')
    }
    if (!image) {
      image = generateFighterPortrait(seed.id, seed.color, seed.color2, seed.name)
    }
  } catch {
    /* soft — keep color fallback */
  }
  const identity = {
    element: element,
    gameClass: seed.id.startsWith('spec-') ? 'Play Specialist' : seed.category || 'Fighter',
    level: seed.id.startsWith('spec-') ? 10 : 5,
    title: seed.id.startsWith('spec-') ? 'Specialist' : undefined,
  }
  const traits = element
    ? [
        { trait_type: 'Inherited Element', value: element },
        { trait_type: 'Game Class', value: identity.gameClass },
        { trait_type: 'Level', value: String(identity.level) },
        { trait_type: 'RF Title', value: identity.title || 'Fighter' },
      ]
    : [
        { trait_type: 'Game Class', value: identity.gameClass || 'Fighter' },
        { trait_type: 'Level', value: String(identity.level || 5) },
      ]
  return withCombatPowers({
    ...rest,
    stats: rest.stats,
    image: image || rest.image,
    originalImage: rest.originalImage || image,
    specialName: moveset.special.name,
    secretName: moveset.secret.name,
    superName: moveset.super.name,
    moveset,
    identity,
    traits,
    wins: wl.wins,
    losses: wl.losses,
    fightable: rest.fightable !== false,
  })
}

/**
 * Internal AI stat templates only — never shown in the player picker.
 * Players only fight with wallet-owned NFTs.
 */
function cpuTemplates(): Fighter[] {
  return DEMO.map(withMoves).map((f) => ({
    ...f,
    source: 'demo' as const,
    fightable: true,
    collection: undefined,
    categoryLabel: 'CPU',
    image: undefined,
    originalImage: undefined,
    newImage: undefined,
  }))
}

/** @deprecated Demo NFTs removed from game — always empty for UI/picker. */
export function listDemoFighters(): Fighter[] {
  return []
}

/** @deprecated Practice roster removed — only owned NFTs are playable. */
export function listPracticeFighters(): Fighter[] {
  return []
}

/** Owned-only roster helper (no fake / demo NFTs). */
export function mergeOwnedAndDemo(owned: Fighter[] | null | undefined): Fighter[] {
  return Array.isArray(owned) ? owned.filter(Boolean) : []
}

export function getFighter(_id: string): Fighter | null {
  return null
}

/**
 * Build CPU from a REAL owned NFT (mirror / rival copy).
 * Never injects hardcoded demo roster into the player picker.
 * Stats scaled by difficulty (easy = weaker rival).
 */
function statsOrDefault(s?: FighterStats | null): FighterStats {
  return {
    hp: Math.max(60, Number(s?.hp) || 100),
    atk: Math.max(6, Number(s?.atk) || 12),
    def: Math.max(4, Number(s?.def) || 8),
    speed: Math.max(5, Number(s?.speed) || 10),
    special: Math.max(10, Number(s?.special) || 18),
  }
}

export function cpuFromOwned(
  owned: Fighter,
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'easy',
  label = 'CPU',
): Fighter {
  const mult =
    difficulty === 'easy'
      ? 0.7
      : difficulty === 'medium'
        ? 0.95
        : difficulty === 'hard'
          ? 1.1
          : 1.25
  const hpMult =
    difficulty === 'easy' ? 0.75 : difficulty === 'medium' ? 0.95 : difficulty === 'hard' ? 1.1 : 1.25
  const s = statsOrDefault(owned?.stats)
  const id = owned?.nftId || owned?.id || 'nft'
  const name = owned?.name || 'NFT'
  return {
    ...owned,
    id: `cpu-${id}-${Date.now().toString(36)}`,
    name: `${label} · ${name}`,
    source: 'nft',
    wins: 0,
    losses: 0,
    stats: {
      hp: Math.max(60, Math.round(s.hp * hpMult)),
      atk: Math.max(6, Math.round(s.atk * mult)),
      def: Math.max(4, Math.round(s.def * mult)),
      speed: Math.max(5, Math.round(s.speed * mult)),
      special: Math.max(10, Math.round(s.special * mult)),
    },
    // Keep real NFT art so fight uses their assets, not fake demos
    // Preserve OLD (genesis) vs NEW (evolved) — do not collapse slots
    image: owned?.image || owned?.newImage || owned?.originalImage,
    originalImage: owned?.originalImage || owned?.image,
    newImage:
      owned?.newImage &&
      owned.newImage !== (owned.originalImage || owned.image)
        ? owned.newImage
        : undefined,
  }
}

/**
 * Pick CPU from owned pool (another NFT) or mirror the player's NFT.
 * No hardcoded demo fighters.
 */
export function pickCpuOpponent(
  player: Fighter,
  ownedPool: Fighter[] = [],
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'easy',
): Fighter {
  const others = ownedPool.filter(
    (f) =>
      f.id !== player.id &&
      f.fightable !== false &&
      !String(f.id).startsWith('cpu-') &&
      f.source !== 'demo',
  )
  if (others.length) {
    const pick = others[Math.floor(Math.random() * others.length)]!
    return cpuFromOwned(pick, difficulty, 'CPU')
  }
  // Single NFT — mirror it as AI rival (still their real art/stats base)
  return cpuFromOwned(player, difficulty, 'CPU Mirror')
}

/** @deprecated use pickCpuOpponent(player, pool, difficulty) */
export function pickCpuOpponentLegacy(excludeId?: string): Fighter {
  const pool = cpuTemplates().filter((f) => f.id !== excludeId)
  const pick = pool[0] || cpuTemplates()[0]!
  return cpuFromOwned(
    {
      ...pick,
      source: 'nft',
      name: 'Rival',
      collection: undefined,
    },
    'easy',
    'CPU',
  )
}

/** Build a fighter avatar from handle challenge (soft NFT-less). */
export function fighterFromHandle(handle: string): Fighter {
  const h = handle.replace(/^@/, '').toLowerCase() || 'rival'
  let hash = 0
  for (let i = 0; i < h.length; i++) hash = (hash * 31 + h.charCodeAt(i)) >>> 0
  const palette = [
    ['#f472b6', '#9f1239'],
    ['#22d3ee', '#0e7490'],
    ['#a78bfa', '#4c1d95'],
    ['#34d399', '#065f46'],
    ['#fbbf24', '#92400e'],
    ['#fb923c', '#9a3412'],
  ]
  const [color, color2] = palette[hash % palette.length]
  const base = DEMO[hash % DEMO.length]!
  const moveset = buildMoveset({
    id: `handle-${h}`,
    name: `@${h}`,
    category: 'human',
    specialName: base.specialName,
    secretName: base.secretName,
    superName: base.superName,
  })
  return {
    id: `handle-${h}`,
    name: `@${h}`,
    color,
    color2,
    stats: {
      hp: 90 + (hash % 30),
      atk: 11 + (hash % 7),
      def: 6 + (hash % 8),
      speed: 8 + (hash % 8),
      special: 18 + (hash % 8),
    },
    specialName: moveset.special.name,
    secretName: moveset.secret.name,
    superName: moveset.super.name,
    moveset,
    wins: 0,
    losses: 0,
    source: 'demo',
    fightable: true,
  }
}

export function recordLabel(f: Fighter): string {
  return `${f.wins}-${f.losses}`
}

export function fighterMoves(f: Fighter): FighterMoveset {
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
