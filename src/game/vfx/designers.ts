/**
 * 10 world-class VFX designers — each owns a skill lane for fight spectacle.
 */
import {
  type VfxBurstOpts,
  type VfxDesigner,
  type VfxParticle,
  p,
  rand,
  ang,
} from './types'

function spray(
  opts: VfxBurstOpts,
  n: number,
  kind: VfxParticle['kind'],
  speed: number,
  life: number,
  size: number,
  extra: Partial<VfxParticle> = {},
): VfxParticle[] {
  const out: VfxParticle[] = []
  const pow = opts.power ?? 1
  for (let i = 0; i < Math.floor(n * pow); i++) {
    const a = ang(opts.facing ?? 1) + rand(-0.8, 0.8)
    const sp = speed * rand(0.45, 1.25) * pow
    out.push(
      p({
        x: opts.x + rand(-6, 6),
        y: opts.y + rand(-10, 10),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(0, 2),
        life: life * rand(0.7, 1.2),
        color: Math.random() > 0.35 ? opts.color : opts.color2 || opts.color,
        color2: opts.color2,
        size: size * rand(0.6, 1.4),
        kind,
        spin: rand(-0.3, 0.3),
        ...extra,
      }),
    )
  }
  return out
}

function ringBurst(opts: VfxBurstOpts, n: number, speed: number, color: string): VfxParticle[] {
  const out: VfxParticle[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push(
      p({
        x: opts.x,
        y: opts.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 18 + rand(0, 10),
        color,
        size: 3 + rand(0, 4),
        kind: 'ring',
        gravity: 0,
        drag: 0.94,
        glow: 10,
      }),
    )
  }
  return out
}

/** 1 — Impact Design: punch/kick contact sparks */
const impactDesigner: VfxDesigner = {
  id: 'd01-impact',
  name: 'Impact Forge',
  skill: 'Hit sparks · impact stars · debris',
  hit: (o) => [
    ...spray(o, 10, 'spark', 5.5, 14, 3.5, { glow: 6 }),
    ...spray(o, 4, 'star', 3.2, 12, 2.5, { gravity: 0.05 }),
  ],
  heavy: (o) => [
    ...spray(o, 16, 'spark', 7, 18, 4, { glow: 10 }),
    ...spray(o, 6, 'shard', 5, 16, 3, { glow: 8 }),
    ...ringBurst(o, 8, 4.5, o.color),
  ],
  special: (o) => spray(o, 20, 'star', 8, 22, 4.5, { glow: 14 }),
  secret: (o) => [
    ...spray(o, 36, 'star', 11, 28, 5, { glow: 18 }),
    ...ringBurst(o, 16, 7, o.color2 || o.color),
  ],
  block: (o) => spray(o, 8, 'spark', 4, 12, 2.5, { color: '#e2e8f0', glow: 8 }),
  ko: (o) => [
    ...spray(o, 40, 'star', 12, 32, 6, { glow: 20 }),
    ...spray(o, 20, 'debris', 8, 28, 4),
  ],
}

/** 2 — Element Fire */
const fireDesigner: VfxDesigner = {
  id: 'd02-fire',
  name: 'Ember Atelier',
  skill: 'Fire embers · heat haze · rose nova trails',
  hit: (o) => spray({ ...o, color: o.color || '#f97316' }, 8, 'ember', 4, 16, 3.5, { gravity: -0.08, glow: 12 }),
  heavy: (o) => spray({ ...o, color: '#fb923c' }, 14, 'ember', 6, 20, 4.5, { gravity: -0.12, glow: 16 }),
  special: (o) => [
    ...spray({ ...o, color: '#f97316', color2: '#fbbf24' }, 22, 'ember', 7, 24, 5, { gravity: -0.15, glow: 18 }),
    ...ringBurst(o, 10, 5, '#fbbf24'),
  ],
  secret: (o) => [
    ...spray({ ...o, color: '#ef4444', color2: '#fde68a' }, 40, 'ember', 10, 32, 6, { gravity: -0.2, glow: 22 }),
    ...spray(o, 12, 'orb', 3, 26, 8, { gravity: -0.05, glow: 20 }),
  ],
  block: (o) => spray(o, 5, 'ember', 3, 10, 2.5, { gravity: -0.05 }),
  ko: (o) => spray({ ...o, color: '#fbbf24' }, 50, 'ember', 11, 36, 6, { gravity: -0.18, glow: 24 }),
}

/** 3 — Element Void / arcane */
const voidDesigner: VfxDesigner = {
  id: 'd03-void',
  name: 'Null Script Studio',
  skill: 'Void glyphs · purple arcs · riddle waves',
  hit: (o) => spray({ ...o, color: '#a78bfa' }, 7, 'glyph', 4.5, 16, 3, { gravity: 0.02, glow: 12 }),
  heavy: (o) => [
    ...spray({ ...o, color: '#c084fc' }, 12, 'glyph', 6, 20, 3.5, { glow: 14 }),
    ...spray(o, 6, 'arc', 5, 14, 2, { gravity: 0, glow: 16 }),
  ],
  special: (o) => [
    ...ringBurst(o, 14, 6, '#a78bfa'),
    ...spray({ ...o, color: '#7c3aed' }, 18, 'glyph', 7, 24, 4, { glow: 18 }),
  ],
  secret: (o) => [
    ...ringBurst(o, 20, 9, '#e9d5ff'),
    ...spray({ ...o, color: '#a78bfa', color2: '#4c1d95' }, 36, 'glyph', 9, 30, 5, { glow: 22 }),
    ...spray(o, 10, 'orb', 2.5, 28, 10, { gravity: 0, glow: 24 }),
  ],
  block: (o) => spray(o, 6, 'glyph', 3, 12, 2.5, { color: '#c4b5fd' }),
  ko: (o) => spray({ ...o, color: '#c084fc' }, 44, 'glyph', 10, 34, 5.5, { glow: 22 }),
}

/** 4 — Element Nature */
const natureDesigner: VfxDesigner = {
  id: 'd04-nature',
  name: 'Grove Motion',
  skill: 'Petals · leaves · grove guard bloom',
  hit: (o) => spray({ ...o, color: '#34d399' }, 8, 'petal', 3.5, 18, 3.5, { gravity: 0.08, spin: 0.2 }),
  heavy: (o) => spray({ ...o, color: '#6ee7b7' }, 14, 'petal', 5, 22, 4, { spin: 0.25, glow: 8 }),
  special: (o) => [
    ...spray({ ...o, color: '#10b981', color2: '#a7f3d0' }, 24, 'petal', 6, 26, 4.5, { spin: 0.3, glow: 10 }),
    ...ringBurst(o, 10, 4.5, '#34d399'),
  ],
  secret: (o) => [
    ...spray({ ...o, color: '#6ee7b7' }, 40, 'petal', 8, 32, 5, { spin: 0.35, glow: 14 }),
    ...spray(o, 12, 'orb', 2, 28, 9, { color: '#34d399', gravity: -0.04, glow: 16 }),
  ],
  block: (o) => spray(o, 5, 'petal', 2.5, 12, 2.5),
  ko: (o) => spray({ ...o, color: '#a7f3d0' }, 48, 'petal', 9, 36, 5, { spin: 0.4 }),
}

/** 5 — Element Cyber / electric */
const cyberDesigner: VfxDesigner = {
  id: 'd05-cyber',
  name: 'Volt Circuit',
  skill: 'Electric arcs · packet storms · ledger slash',
  hit: (o) => spray({ ...o, color: '#22d3ee' }, 9, 'arc', 6, 12, 2.5, { gravity: 0, drag: 0.9, glow: 14 }),
  heavy: (o) => [
    ...spray({ ...o, color: '#67e8f9' }, 14, 'arc', 8, 16, 3, { gravity: 0, glow: 16 }),
    ...spray(o, 6, 'spark', 5, 14, 2.5, { color: '#fff' }),
  ],
  special: (o) => [
    ...ringBurst(o, 12, 7, '#22d3ee'),
    ...spray({ ...o, color: '#06b6d4' }, 20, 'arc', 9, 18, 3.5, { gravity: 0, glow: 18 }),
  ],
  secret: (o) => [
    ...ringBurst(o, 18, 10, '#a5f3fc'),
    ...spray({ ...o, color: '#22d3ee', color2: '#fff' }, 34, 'arc', 11, 22, 4, { gravity: 0, glow: 22 }),
  ],
  block: (o) => spray(o, 7, 'arc', 4, 10, 2, { color: '#e0f2fe', gravity: 0 }),
  ko: (o) => spray({ ...o, color: '#22d3ee' }, 42, 'arc', 12, 26, 4.5, { gravity: 0, glow: 24 }),
}

/** 6 — Motion / dash trails */
const motionDesigner: VfxDesigner = {
  id: 'd06-motion',
  name: 'Afterimage Lab',
  skill: 'Dash streaks · land dust · speed lines',
  hit: (o) => spray(o, 4, 'slash', 3, 10, 4, { gravity: 0.02, drag: 0.92 }),
  heavy: (o) => spray(o, 8, 'slash', 5, 14, 5, { gravity: 0 }),
  special: (o) => spray(o, 12, 'slash', 6, 16, 5.5, { gravity: 0 }),
  secret: (o) => spray(o, 20, 'slash', 8, 20, 6, { gravity: 0, glow: 12 }),
  block: (o) => spray(o, 3, 'dust', 2, 10, 3),
  ko: (o) => spray(o, 10, 'slash', 6, 18, 5),
  dash: (o) => {
    const f = o.facing ?? 1
    return Array.from({ length: 10 }, (_, i) =>
      p({
        x: o.x - f * i * 6,
        y: o.y + rand(-16, 16),
        vx: -f * rand(1, 3),
        vy: rand(-0.5, 0.5),
        life: 10 + i,
        color: o.color,
        size: 8 - i * 0.5,
        kind: 'slash',
        gravity: 0,
        drag: 0.9,
        glow: 8,
      }),
    )
  },
  land: (o) => spray({ ...o, y: o.y + 4 }, 10, 'dust', 3.5, 14, 3.5, { gravity: 0.15 }),
}

/** 7 — Guard / shield */
const guardDesigner: VfxDesigner = {
  id: 'd07-guard',
  name: 'Aegis Studio',
  skill: 'Block flashes · shield rings · armor chips',
  hit: (o) => spray(o, 3, 'spark', 2, 8, 2),
  heavy: (o) => spray(o, 5, 'spark', 3, 10, 2.5),
  special: (o) => ringBurst(o, 8, 3, '#e2e8f0'),
  secret: (o) => ringBurst(o, 12, 5, '#f8fafc'),
  block: (o) => [
    ...ringBurst(o, 10, 4, '#f1f5f9'),
    ...spray({ ...o, color: '#e2e8f0' }, 10, 'spark', 5, 12, 3, { gravity: 0.05, glow: 12 }),
  ],
  ko: (o) => spray(o, 8, 'debris', 4, 16, 3),
}

/** 8 — Super / secret spectacle */
const superDesigner: VfxDesigner = {
  id: 'd08-super',
  name: 'Finale Works',
  skill: 'Screen-fill supers · secret novas · KO bloom',
  hit: (o) => spray(o, 6, 'star', 4, 12, 3, { glow: 10 }),
  heavy: (o) => spray(o, 12, 'star', 6, 16, 4, { glow: 14 }),
  special: (o) => [
    ...ringBurst(o, 16, 6.5, o.color),
    ...spray(o, 24, 'orb', 4, 22, 5, { glow: 16, gravity: -0.02 }),
    ...spray(o, 16, 'star', 7, 20, 4, { glow: 14 }),
  ],
  secret: (o) => [
    ...ringBurst(o, 24, 10, o.color2 || o.color),
    ...ringBurst(o, 16, 6, '#fff'),
    ...spray(o, 48, 'star', 12, 34, 6, { glow: 24 }),
    ...spray(o, 20, 'orb', 3, 30, 10, { glow: 20, gravity: -0.04 }),
    ...spray(o, 16, 'beam', 8, 18, 3, { gravity: 0, drag: 0.88, glow: 18 }),
  ],
  block: (o) => spray(o, 4, 'star', 3, 10, 2),
  ko: (o) => [
    ...ringBurst(o, 28, 11, '#fbbf24'),
    ...spray({ ...o, color: '#fbbf24', color2: '#f472b6' }, 56, 'star', 13, 40, 7, { glow: 26 }),
  ],
}

/** 9 — Atmosphere / stage dust */
const atmoDesigner: VfxDesigner = {
  id: 'd09-atmo',
  name: 'Atmosphere Desk',
  skill: 'Stage dust · smoke · heat particles',
  hit: (o) => spray(o, 3, 'smoke', 1.5, 16, 6, { gravity: -0.03, drag: 0.96 }),
  heavy: (o) => spray(o, 6, 'smoke', 2.5, 20, 8, { gravity: -0.04 }),
  special: (o) => spray(o, 10, 'smoke', 3, 24, 9, { gravity: -0.05, glow: 4 }),
  secret: (o) => spray(o, 18, 'smoke', 4, 30, 12, { gravity: -0.06 }),
  block: (o) => spray(o, 4, 'dust', 2, 12, 4),
  ko: (o) => spray(o, 24, 'smoke', 5, 36, 14, { gravity: -0.05 }),
  land: (o) => spray({ ...o, color: '#94a3b8' }, 12, 'dust', 4, 16, 4, { gravity: 0.2 }),
  aura: (o) => {
    if (o.frame % 8 !== 0) return []
    return [
      p({
        x: o.x + rand(-20, 20),
        y: o.y - rand(10, 50),
        vx: rand(-0.4, 0.4),
        vy: -rand(0.4, 1.2),
        life: 20,
        color: o.color,
        size: rand(2, 5),
        kind: 'smoke',
        gravity: -0.02,
        glow: 6,
      }),
    ]
  },
}

/** 10 — Combo / UI celebration */
const comboDesigner: VfxDesigner = {
  id: 'd10-combo',
  name: 'Combo Confetti',
  skill: 'Combo confetti · meter flash · win pop',
  hit: (o) => (o.power && o.power > 1.2 ? spray(o, 5, 'star', 4, 12, 2.5, { glow: 8 }) : []),
  heavy: (o) => spray(o, 8, 'star', 5, 14, 3, { glow: 10 }),
  special: (o) => spray(o, 14, 'star', 6, 16, 3.5, { glow: 12 }),
  secret: (o) => spray(o, 28, 'star', 9, 24, 5, { glow: 18 }),
  block: () => [],
  ko: (o) => [
    ...spray({ ...o, color: '#fbbf24' }, 30, 'star', 8, 28, 5, { glow: 20 }),
    ...spray({ ...o, color: '#f472b6' }, 20, 'petal', 6, 24, 4, { spin: 0.3 }),
  ],
}

export const VFX_DESIGNERS: VfxDesigner[] = [
  impactDesigner,
  fireDesigner,
  voidDesigner,
  natureDesigner,
  cyberDesigner,
  motionDesigner,
  guardDesigner,
  superDesigner,
  atmoDesigner,
  comboDesigner,
]

export function designersByElement(element?: string): VfxDesigner[] {
  const el = (element || '').toLowerCase()
  const core = [impactDesigner, motionDesigner, guardDesigner, superDesigner, atmoDesigner, comboDesigner]
  if (/fire|ember|flame|solar|rose/.test(el)) return [...core, fireDesigner]
  if (/void|shadow|dark|null|arcane|purple/.test(el)) return [...core, voidDesigner]
  if (/nature|grove|jade|earth|wood|leaf/.test(el)) return [...core, natureDesigner]
  if (/cyber|volt|electric|tech|ledger|ice|water/.test(el)) return [...core, cyberDesigner]
  return [...core, fireDesigner, voidDesigner]
}

export function mergeBursts(
  designers: VfxDesigner[],
  method: keyof Pick<VfxDesigner, 'hit' | 'heavy' | 'special' | 'secret' | 'block' | 'ko'>,
  opts: VfxBurstOpts,
): VfxParticle[] {
  const out: VfxParticle[] = []
  for (const d of designers) {
    const fn = d[method]
    if (fn) out.push(...fn(opts))
  }
  // Cap particle flood
  if (out.length > 180) return out.slice(0, 180)
  return out
}

export const DESIGNER_ROSTER = VFX_DESIGNERS.map((d) => ({
  id: d.id,
  name: d.name,
  skill: d.skill,
}))
