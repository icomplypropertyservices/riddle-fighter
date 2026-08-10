/**
 * Street Fighter–readable keyframe poses.
 * All angles in degrees; limbs drawn with filled rounded segments.
 */

import type { AnimClip, AnimClipId, JointPose, PoseKey } from './types'

function P(partial: Partial<JointPose> & Pick<JointPose, 'torso'>): JointPose {
  return {
    torso: partial.torso,
    head: partial.head ?? 0,
    fShoulder: partial.fShoulder ?? 20,
    fElbow: partial.fElbow ?? 25,
    bShoulder: partial.bShoulder ?? 15,
    bElbow: partial.bElbow ?? 20,
    fHip: partial.fHip ?? 8,
    fKnee: partial.fKnee ?? 10,
    bHip: partial.bHip ?? 6,
    bKnee: partial.bKnee ?? 8,
    rootY: partial.rootY ?? 0,
    scaleY: partial.scaleY ?? 1,
    scaleX: partial.scaleX ?? 1,
  }
}

const IDLE: PoseKey[] = [
  { t: 0, pose: P({ torso: 2, fShoulder: 18, bShoulder: 22, fHip: 6, bHip: 10, rootY: 0 }) },
  { t: 0.5, pose: P({ torso: 0, fShoulder: 14, bShoulder: 18, fHip: 10, bHip: 6, rootY: -2, scaleY: 1.015 }) },
  { t: 1, pose: P({ torso: 2, fShoulder: 18, bShoulder: 22, fHip: 6, bHip: 10, rootY: 0 }) },
]

const WALK: PoseKey[] = [
  { t: 0, pose: P({ torso: 6, fHip: -28, fKnee: 35, bHip: 22, bKnee: 8, fShoulder: -10, bShoulder: 35 }) },
  { t: 0.25, pose: P({ torso: 4, fHip: 0, fKnee: 5, bHip: 0, bKnee: 5, fShoulder: 10, bShoulder: 10 }) },
  { t: 0.5, pose: P({ torso: 6, fHip: 22, fKnee: 8, bHip: -28, bKnee: 35, fShoulder: 35, bShoulder: -10 }) },
  { t: 0.75, pose: P({ torso: 4, fHip: 0, fKnee: 5, bHip: 0, bKnee: 5, fShoulder: 10, bShoulder: 10 }) },
  { t: 1, pose: P({ torso: 6, fHip: -28, fKnee: 35, bHip: 22, bKnee: 8, fShoulder: -10, bShoulder: 35 }) },
]

const CROUCH: PoseKey[] = [
  {
    t: 0,
    pose: P({
      torso: 8,
      head: 4,
      fHip: 55,
      fKnee: 95,
      bHip: 50,
      bKnee: 90,
      fShoulder: 40,
      bShoulder: 35,
      rootY: 38,
      scaleY: 0.92,
      scaleX: 1.06,
    }),
  },
]

const JUMP: PoseKey[] = [
  {
    t: 0,
    pose: P({
      torso: -4,
      fHip: -40,
      fKnee: 50,
      bHip: -25,
      bKnee: 40,
      fShoulder: -50,
      bShoulder: -30,
      rootY: -8,
      scaleY: 1.04,
    }),
  },
]

const PUNCH: PoseKey[] = [
  // startup
  {
    t: 0,
    pose: P({ torso: -6, fShoulder: 50, fElbow: 80, bShoulder: 30, fHip: 12, bHip: 8, scaleX: 0.96 }),
  },
  // active — lead arm fully extended (SF jab/readability)
  {
    t: 0.35,
    pose: P({
      torso: 18,
      head: -6,
      fShoulder: -85,
      fElbow: 5,
      bShoulder: 55,
      bElbow: 40,
      fHip: 15,
      bHip: -5,
      scaleX: 1.08,
      scaleY: 0.97,
    }),
  },
  // recovery
  {
    t: 0.75,
    pose: P({ torso: 8, fShoulder: -20, fElbow: 40, bShoulder: 25, fHip: 10, bHip: 6 }),
  },
  { t: 1, pose: P({ torso: 2, fShoulder: 18, bShoulder: 20, fHip: 8, bHip: 8 }) },
]

const KICK: PoseKey[] = [
  {
    t: 0,
    pose: P({ torso: -8, fHip: 20, fKnee: 30, bHip: 10, fShoulder: 40, bShoulder: -20, scaleX: 0.95 }),
  },
  // active — chambered high kick silhouette
  {
    t: 0.4,
    pose: P({
      torso: 12,
      head: -4,
      fHip: -95,
      fKnee: 15,
      bHip: 25,
      bKnee: 20,
      fShoulder: -30,
      bShoulder: 50,
      scaleX: 1.1,
      scaleY: 0.96,
    }),
  },
  {
    t: 0.8,
    pose: P({ torso: 4, fHip: -30, fKnee: 40, bHip: 12, fShoulder: 10, bShoulder: 20 }),
  },
  { t: 1, pose: P({ torso: 2, fHip: 8, fKnee: 10, bHip: 8, fShoulder: 18, bShoulder: 18 }) },
]

const SPECIAL: PoseKey[] = [
  {
    t: 0,
    pose: P({ torso: -15, fShoulder: 70, fElbow: 90, bShoulder: 60, fHip: 20, rootY: 4, scaleX: 0.9 }),
  },
  {
    t: 0.45,
    pose: P({
      torso: 22,
      fShoulder: -100,
      fElbow: 0,
      bShoulder: -40,
      bElbow: 20,
      fHip: -20,
      bHip: 15,
      scaleX: 1.15,
      scaleY: 0.94,
    }),
  },
  {
    t: 1,
    pose: P({ torso: 6, fShoulder: -30, fElbow: 30, bShoulder: 20, fHip: 8, bHip: 8 }),
  },
]

const SECRET: PoseKey[] = [
  {
    t: 0,
    pose: P({
      torso: -20,
      head: 8,
      fShoulder: 90,
      fElbow: 100,
      bShoulder: 80,
      fHip: 30,
      bHip: 25,
      rootY: 6,
      scaleY: 0.9,
      scaleX: 0.88,
    }),
  },
  {
    t: 0.5,
    pose: P({
      torso: 28,
      head: -10,
      fShoulder: -110,
      fElbow: -5,
      bShoulder: -70,
      fHip: -40,
      bHip: 20,
      scaleX: 1.22,
      scaleY: 0.92,
      rootY: -4,
    }),
  },
  {
    t: 1,
    pose: P({ torso: 10, fShoulder: -40, bShoulder: 15, fHip: 10, bHip: 8 }),
  },
]

const DASH: PoseKey[] = [
  {
    t: 0,
    pose: P({ torso: 25, fShoulder: -50, bShoulder: -30, fHip: -35, bHip: 40, scaleX: 1.2, scaleY: 0.9 }),
  },
  {
    t: 1,
    pose: P({ torso: 8, fShoulder: 10, bShoulder: 10, fHip: 8, bHip: 8, scaleX: 1 }),
  },
]

const BLOCK: PoseKey[] = [
  {
    t: 0,
    pose: P({
      torso: -4,
      fShoulder: -40,
      fElbow: 95,
      bShoulder: -35,
      bElbow: 90,
      fHip: 12,
      bHip: 12,
      scaleX: 0.95,
    }),
  },
]

const HIT: PoseKey[] = [
  {
    t: 0,
    pose: P({
      torso: -18,
      head: 12,
      fShoulder: 50,
      bShoulder: 45,
      fHip: -15,
      bHip: 20,
      scaleX: 0.92,
      scaleY: 1.05,
    }),
  },
]

const KO: PoseKey[] = [
  {
    t: 0,
    pose: P({
      torso: 70,
      head: 30,
      fShoulder: 20,
      bShoulder: -40,
      fHip: 40,
      fKnee: 20,
      bHip: -10,
      rootY: 50,
      scaleY: 0.7,
      scaleX: 1.15,
    }),
  },
]

function clip(id: AnimClipId, length: number, loop: boolean, keys: PoseKey[]): AnimClip {
  return { id, length, loop, keys }
}

export const CLIPS: Record<AnimClipId, AnimClip> = {
  idle: clip('idle', 48, true, IDLE),
  walk: clip('walk', 24, true, WALK),
  crouch: clip('crouch', 8, true, CROUCH),
  jump: clip('jump', 16, true, JUMP),
  punch: clip('punch', 14, false, PUNCH),
  kick: clip('kick', 18, false, KICK),
  special: clip('special', 22, false, SPECIAL),
  secret: clip('secret', 28, false, SECRET),
  dash: clip('dash', 14, false, DASH),
  block: clip('block', 12, true, BLOCK),
  hit: clip('hit', 12, false, HIT),
  ko: clip('ko', 40, false, KO),
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpPose(a: JointPose, b: JointPose, t: number): JointPose {
  const s = t * t * (3 - 2 * t) // smoothstep
  return {
    torso: lerp(a.torso, b.torso, s),
    head: lerp(a.head, b.head, s),
    fShoulder: lerp(a.fShoulder, b.fShoulder, s),
    fElbow: lerp(a.fElbow, b.fElbow, s),
    bShoulder: lerp(a.bShoulder, b.bShoulder, s),
    bElbow: lerp(a.bElbow, b.bElbow, s),
    fHip: lerp(a.fHip, b.fHip, s),
    fKnee: lerp(a.fKnee, b.fKnee, s),
    bHip: lerp(a.bHip, b.bHip, s),
    bKnee: lerp(a.bKnee, b.bKnee, s),
    rootY: lerp(a.rootY, b.rootY, s),
    scaleY: lerp(a.scaleY, b.scaleY, s),
    scaleX: lerp(a.scaleX, b.scaleX, s),
  }
}

/** Sample clip at normalized 0..1 (or loop). */
export function sampleClip(clip: AnimClip, t01: number): JointPose {
  const keys = clip.keys
  if (!keys.length) return P({ torso: 0 })
  if (keys.length === 1) return keys[0]!.pose
  let t = t01
  if (clip.loop) {
    t = ((t % 1) + 1) % 1
  } else {
    t = Math.min(1, Math.max(0, t))
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!
    const b = keys[i + 1]!
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1
      const u = (t - a.t) / span
      return lerpPose(a.pose, b.pose, u)
    }
  }
  return keys[keys.length - 1]!.pose
}
