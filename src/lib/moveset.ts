/**
 * Full arcade moveset + secret supers for Riddle Fighter.
 * Motions are buffered (Street Fighter–style) on the engine side.
 */

export type MotionId = 'none' | 'qcf' | 'qcb' | 'dp' | 'hcb' | 'charge_b_f' | 'full_circle'

export type MoveSlot =
  | 'punch'
  | 'kick'
  | 'special'
  | 'dash'
  | 'secret'
  | 'super'

export type MoveDef = {
  slot: MoveSlot
  name: string
  /** Flavor line for HUD / picker */
  tagline?: string
  damageMult: number
  meterCost: number
  /** Meter gained on hit */
  meterGain: number
  frames: number
  activeStart: number
  activeEnd: number
  reach: number
  hitstun: number
  knockback: number
  launch?: boolean
  motion?: MotionId
  /** Requires full meter (100) for secret */
  needsFullMeter?: boolean
  secret?: boolean
  colorHint?: string
}

export type FighterMoveset = {
  punch: MoveDef
  kick: MoveDef
  special: MoveDef
  dash: MoveDef
  /** ↓↘→ + P or SP at 100 meter — signature secret */
  secret: MoveDef
  /** Optional second super (↓↙← + K) */
  super: MoveDef
}

/** Nintendo-readable normals: clear startup → active → recovery. */
const BASE_PUNCH: MoveDef = {
  slot: 'punch',
  name: 'Quick Jab',
  damageMult: 1,
  meterCost: 0,
  meterGain: 7,
  frames: 14,
  activeStart: 4,
  activeEnd: 7,
  reach: 60,
  hitstun: 8,
  knockback: 5,
  motion: 'none',
}

const BASE_KICK: MoveDef = {
  slot: 'kick',
  name: 'Roundhouse',
  damageMult: 1.18,
  meterCost: 0,
  meterGain: 9,
  frames: 18,
  activeStart: 6,
  activeEnd: 10,
  reach: 78,
  hitstun: 10,
  knockback: 7,
  motion: 'none',
}

const BASE_DASH: MoveDef = {
  slot: 'dash',
  name: 'Shadow Step',
  damageMult: 0.85,
  meterCost: 18,
  meterGain: 5,
  frames: 14,
  activeStart: 3,
  activeEnd: 8,
  reach: 72,
  hitstun: 7,
  knockback: 8,
  motion: 'none',
}

/** Archetype kits keyed by category / element / hash bucket */
const ARCHETYPES: Record<
  string,
  Pick<FighterMoveset, 'special' | 'secret' | 'super'> & {
    punchName?: string
    kickName?: string
  }
> = {
  god: {
    punchName: 'Divine Tap',
    kickName: 'Judgment Heel',
    special: {
      slot: 'special',
      name: 'Divine Judgment',
      tagline: 'Heaven cracks the floor',
      damageMult: 1.15,
      meterCost: 50,
      meterGain: 4,
      frames: 24,
      activeStart: 5,
      activeEnd: 16,
      reach: 118,
      hitstun: 18,
      knockback: 14,
      launch: true,
      motion: 'qcf',
      colorHint: '#fde68a',
    },
    secret: {
      slot: 'secret',
      name: 'Riddle Apocalypse',
      tagline: 'Full-meter secret — erases the arena',
      damageMult: 1.85,
      meterCost: 100,
      meterGain: 0,
      frames: 32,
      activeStart: 6,
      activeEnd: 22,
      reach: 150,
      hitstun: 26,
      knockback: 22,
      launch: true,
      motion: 'qcf',
      needsFullMeter: true,
      secret: true,
      colorHint: '#fbbf24',
    },
    super: {
      slot: 'super',
      name: 'Ledger Collapse',
      tagline: '←↙↓ + K · gravity well',
      damageMult: 1.55,
      meterCost: 75,
      meterGain: 0,
      frames: 28,
      activeStart: 5,
      activeEnd: 18,
      reach: 130,
      hitstun: 20,
      knockback: 16,
      launch: true,
      motion: 'qcb',
      colorHint: '#a78bfa',
    },
  },
  human: {
    punchName: 'Street Hook',
    kickName: 'Inquisitor Sweep',
    special: {
      slot: 'special',
      name: 'Human Resolve',
      tagline: 'Will over steel',
      damageMult: 1.08,
      meterCost: 50,
      meterGain: 6,
      frames: 22,
      activeStart: 5,
      activeEnd: 14,
      reach: 110,
      hitstun: 16,
      knockback: 12,
      launch: true,
      motion: 'qcf',
      colorHint: '#f472b6',
    },
    secret: {
      slot: 'secret',
      name: 'Blood Contract',
      tagline: 'Full meter · trait-locked secret',
      damageMult: 1.7,
      meterCost: 100,
      meterGain: 0,
      frames: 30,
      activeStart: 6,
      activeEnd: 20,
      reach: 140,
      hitstun: 24,
      knockback: 18,
      launch: true,
      motion: 'qcf',
      needsFullMeter: true,
      secret: true,
      colorHint: '#fb7185',
    },
    super: {
      slot: 'super',
      name: 'Last Stand',
      tagline: '←↙↓ + K',
      damageMult: 1.45,
      meterCost: 75,
      meterGain: 0,
      frames: 26,
      activeStart: 5,
      activeEnd: 17,
      reach: 120,
      hitstun: 18,
      knockback: 14,
      motion: 'qcb',
      colorHint: '#22d3ee',
    },
  },
  fire: {
    punchName: 'Ember Jab',
    kickName: 'Cinder Kick',
    special: {
      slot: 'special',
      name: 'Rose Nova',
      damageMult: 1.12,
      meterCost: 50,
      meterGain: 5,
      frames: 22,
      activeStart: 4,
      activeEnd: 15,
      reach: 112,
      hitstun: 16,
      knockback: 13,
      launch: true,
      motion: 'qcf',
      colorHint: '#f97316',
    },
    secret: {
      slot: 'secret',
      name: 'Ash Phoenix',
      damageMult: 1.78,
      meterCost: 100,
      meterGain: 0,
      frames: 32,
      activeStart: 6,
      activeEnd: 22,
      reach: 145,
      hitstun: 25,
      knockback: 20,
      launch: true,
      motion: 'dp',
      needsFullMeter: true,
      secret: true,
      colorHint: '#ef4444',
    },
    super: {
      slot: 'super',
      name: 'Solar Flare Barrage',
      damageMult: 1.5,
      meterCost: 75,
      meterGain: 0,
      frames: 28,
      activeStart: 5,
      activeEnd: 18,
      reach: 128,
      hitstun: 19,
      knockback: 15,
      motion: 'qcb',
      colorHint: '#fbbf24',
    },
  },
  void: {
    punchName: 'Null Tap',
    kickName: 'Rift Heel',
    special: {
      slot: 'special',
      name: 'Riddle Wave',
      damageMult: 1.1,
      meterCost: 50,
      meterGain: 5,
      frames: 22,
      activeStart: 5,
      activeEnd: 14,
      reach: 115,
      hitstun: 15,
      knockback: 13,
      launch: true,
      motion: 'qcf',
      colorHint: '#a78bfa',
    },
    secret: {
      slot: 'secret',
      name: 'Void Script Finale',
      damageMult: 1.82,
      meterCost: 100,
      meterGain: 0,
      frames: 34,
      activeStart: 7,
      activeEnd: 24,
      reach: 155,
      hitstun: 28,
      knockback: 24,
      launch: true,
      motion: 'full_circle',
      needsFullMeter: true,
      secret: true,
      colorHint: '#c084fc',
    },
    super: {
      slot: 'super',
      name: 'Event Horizon',
      damageMult: 1.52,
      meterCost: 75,
      meterGain: 0,
      frames: 27,
      activeStart: 5,
      activeEnd: 18,
      reach: 132,
      hitstun: 20,
      knockback: 16,
      motion: 'qcb',
      colorHint: '#7c3aed',
    },
  },
  iron: {
    punchName: 'Plate Fist',
    kickName: 'Greave Crash',
    special: {
      slot: 'special',
      name: 'Plate Crash',
      damageMult: 1.05,
      meterCost: 50,
      meterGain: 7,
      frames: 20,
      activeStart: 5,
      activeEnd: 13,
      reach: 100,
      hitstun: 17,
      knockback: 11,
      motion: 'qcf',
      colorHint: '#94a3b8',
    },
    secret: {
      slot: 'secret',
      name: 'Fortress Breaker',
      damageMult: 1.65,
      meterCost: 100,
      meterGain: 0,
      frames: 28,
      activeStart: 6,
      activeEnd: 19,
      reach: 125,
      hitstun: 22,
      knockback: 16,
      motion: 'charge_b_f',
      needsFullMeter: true,
      secret: true,
      colorHint: '#e2e8f0',
    },
    super: {
      slot: 'super',
      name: 'Siege Ram',
      damageMult: 1.4,
      meterCost: 75,
      meterGain: 0,
      frames: 24,
      activeStart: 4,
      activeEnd: 16,
      reach: 118,
      hitstun: 18,
      knockback: 14,
      motion: 'qcb',
      colorHint: '#64748b',
    },
  },
  nature: {
    punchName: 'Vine Jab',
    kickName: 'Root Sweep',
    special: {
      slot: 'special',
      name: 'Grove Guard',
      damageMult: 1.06,
      meterCost: 50,
      meterGain: 6,
      frames: 21,
      activeStart: 5,
      activeEnd: 14,
      reach: 108,
      hitstun: 15,
      knockback: 11,
      motion: 'qcf',
      colorHint: '#34d399',
    },
    secret: {
      slot: 'secret',
      name: 'Worldtree Bloom',
      damageMult: 1.68,
      meterCost: 100,
      meterGain: 0,
      frames: 30,
      activeStart: 6,
      activeEnd: 20,
      reach: 138,
      hitstun: 23,
      knockback: 17,
      launch: true,
      motion: 'qcf',
      needsFullMeter: true,
      secret: true,
      colorHint: '#6ee7b7',
    },
    super: {
      slot: 'super',
      name: 'Thorn Cascade',
      damageMult: 1.42,
      meterCost: 75,
      meterGain: 0,
      frames: 26,
      activeStart: 5,
      activeEnd: 17,
      reach: 122,
      hitstun: 18,
      knockback: 13,
      motion: 'qcb',
      colorHint: '#10b981',
    },
  },
  cyber: {
    punchName: 'Pulse Fist',
    kickName: 'Volt Kick',
    special: {
      slot: 'special',
      name: 'Ledger Slash',
      damageMult: 1.14,
      meterCost: 50,
      meterGain: 5,
      frames: 20,
      activeStart: 4,
      activeEnd: 13,
      reach: 116,
      hitstun: 15,
      knockback: 13,
      motion: 'qcf',
      colorHint: '#22d3ee',
    },
    secret: {
      slot: 'secret',
      name: 'Mainframe Overclock',
      damageMult: 1.76,
      meterCost: 100,
      meterGain: 0,
      frames: 31,
      activeStart: 5,
      activeEnd: 21,
      reach: 148,
      hitstun: 24,
      knockback: 19,
      launch: true,
      motion: 'dp',
      needsFullMeter: true,
      secret: true,
      colorHint: '#67e8f9',
    },
    super: {
      slot: 'super',
      name: 'Packet Storm',
      damageMult: 1.48,
      meterCost: 75,
      meterGain: 0,
      frames: 27,
      activeStart: 5,
      activeEnd: 18,
      reach: 126,
      hitstun: 19,
      knockback: 15,
      motion: 'qcb',
      colorHint: '#06b6d4',
    },
  },
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function pickArchetypeKey(opts: {
  category?: string
  element?: string
  name?: string
  id?: string
}): string {
  const el = (opts.element || '').toLowerCase()
  if (/fire|ember|ash|solar|flame|nova/i.test(el + opts.name)) return 'fire'
  if (/void|shadow|null|dark|rift/i.test(el + opts.name)) return 'void'
  if (/iron|steel|plate|metal|fort/i.test(el + opts.name)) return 'iron'
  if (/nature|grove|jade|vine|earth|wood/i.test(el + opts.name)) return 'nature'
  if (/cyber|volt|ledger|neon|electric|tech/i.test(el + opts.name)) return 'cyber'
  if (opts.category === 'god') return 'god'
  if (opts.category === 'human') return 'human'
  const keys = ['fire', 'void', 'iron', 'nature', 'cyber', 'human'] as const
  return keys[hashStr(opts.id || opts.name || 'x') % keys.length]!
}

export function traitMap(
  traits?: Array<{ trait_type?: string; value?: unknown }>,
): Record<string, string> {
  const m: Record<string, string> = {}
  if (!Array.isArray(traits)) return m
  for (const t of traits) {
    const k = String(t.trait_type || '').trim()
    if (!k) continue
    m[k.toLowerCase()] = String(t.value ?? '').trim()
  }
  return m
}

export function buildMoveset(opts: {
  id: string
  name: string
  category?: string
  traits?: Array<{ trait_type?: string; value?: unknown }>
  specialName?: string
  secretName?: string
  superName?: string
}): FighterMoveset {
  const tm = traitMap(opts.traits)
  const element =
    tm['inherited element'] ||
    tm['element'] ||
    tm['rf element'] ||
    tm['faction bias'] ||
    ''
  const key = pickArchetypeKey({
    category: opts.category,
    element,
    name: opts.name,
    id: opts.id,
  })
  const arch = ARCHETYPES[key] || ARCHETYPES.human!

  const specialName =
    opts.specialName ||
    tm['rf special name'] ||
    tm['inherited special ability 1'] ||
    arch.special.name
  const secretName =
    opts.secretName ||
    tm['rf super name'] ||
    tm['inherited special ability 2'] ||
    arch.secret.name
  const superName = opts.superName || tm['rf moveset'] || arch.super.name

  return {
    punch: {
      ...BASE_PUNCH,
      name: arch.punchName || BASE_PUNCH.name,
    },
    kick: {
      ...BASE_KICK,
      name: arch.kickName || BASE_KICK.name,
    },
    dash: { ...BASE_DASH },
    special: { ...arch.special, name: String(specialName).slice(0, 40) },
    secret: { ...arch.secret, name: String(secretName).slice(0, 40) },
    super: { ...arch.super, name: String(superName).slice(0, 40) },
  }
}

export function defaultMoveset(): FighterMoveset {
  return buildMoveset({ id: 'default', name: 'Fighter', category: 'human' })
}

/** Human-readable move card for UI */
export function movesetSummary(m: FighterMoveset): string[] {
  return [
    `P · ${m.punch.name}`,
    `K · ${m.kick.name}`,
    `SP · ${m.special.name} (50)`,
    `✦ SECRET · ${m.secret.name} (100 + ↓↘→P)`,
    `★ SUPER · ${m.super.name} (75 + ←↙↓K)`,
  ]
}
