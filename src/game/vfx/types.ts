/**
 * World-class fight VFX types — shared by all 10 designers.
 */

export type VfxKind =
  | 'spark'
  | 'ring'
  | 'star'
  | 'dust'
  | 'ember'
  | 'shard'
  | 'shock'
  | 'arc'
  | 'petal'
  | 'glyph'
  | 'smoke'
  | 'slash'
  | 'orb'
  | 'beam'
  | 'debris'

export type VfxParticle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  color2?: string
  size: number
  kind: VfxKind
  rot?: number
  spin?: number
  drag?: number
  gravity?: number
  glow?: number
}

export type VfxFloater = {
  x: number
  y: number
  text: string
  life: number
  max: number
  color: string
  vy: number
  scale?: number
}

export type VfxBurstOpts = {
  x: number
  y: number
  color: string
  color2?: string
  facing?: 1 | -1
  power?: number
  element?: string
}

export type VfxDesigner = {
  id: string
  name: string
  skill: string
  /** Spawn particles for this designer's signature moments */
  hit: (opts: VfxBurstOpts) => VfxParticle[]
  heavy: (opts: VfxBurstOpts) => VfxParticle[]
  special: (opts: VfxBurstOpts) => VfxParticle[]
  secret: (opts: VfxBurstOpts) => VfxParticle[]
  block: (opts: VfxBurstOpts) => VfxParticle[]
  ko: (opts: VfxBurstOpts) => VfxParticle[]
  dash?: (opts: VfxBurstOpts) => VfxParticle[]
  land?: (opts: VfxBurstOpts) => VfxParticle[]
  aura?: (opts: VfxBurstOpts & { frame: number }) => VfxParticle[]
}

export function p(
  partial: Omit<VfxParticle, 'max'> & { max?: number },
): VfxParticle {
  const life = partial.life
  return {
    drag: 0.98,
    gravity: 0.12,
    rot: 0,
    spin: 0,
    glow: 0,
    ...partial,
    max: partial.max ?? life,
  }
}

export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

export function ang(facing = 1): number {
  return (Math.random() - 0.5) * Math.PI + (facing > 0 ? 0 : Math.PI)
}
