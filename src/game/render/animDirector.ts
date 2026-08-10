/**
 * Map engine FighterState → animation clip + local time.
 */

import { CLIPS, sampleClip } from './poseLibrary'
import type { AnimClipId, FighterAnimState, JointPose } from './types'

export type DirectedAnim = {
  clipId: AnimClipId
  pose: JointPose
  /** 0..1 progress in clip */
  t: number
}

/**
 * Priority (SF readable): KO > hitstun > attack > block > crouch > jump > walk > idle
 */
export function directAnim(p: FighterAnimState, frame: number): DirectedAnim {
  if (p.dead) {
    const clip = CLIPS.ko
    const t = Math.min(1, (40 - Math.min(40, p.hitstun || 40)) / 40)
    return { clipId: 'ko', t, pose: sampleClip(clip, Math.min(1, t)) }
  }

  if (p.hitstun > 0 && !p.attackKind) {
    const clip = CLIPS.hit
    const t = 1 - Math.min(1, p.hitstun / 14)
    return { clipId: 'hit', t, pose: sampleClip(clip, t) }
  }

  if (p.attackKind) {
    const map: Record<string, AnimClipId> = {
      punch: 'punch',
      kick: 'kick',
      special: 'special',
      secret: 'secret',
      super: 'secret',
      dash: 'dash',
    }
    const id = map[p.attackKind] || 'punch'
    const clip = CLIPS[id]
    const total = Math.max(1, p.activeMove?.frames || clip.length)
    const t = Math.min(1, p.attackFrame / total)
    return { clipId: id, t, pose: sampleClip(clip, t) }
  }

  if (p.blocking) {
    return { clipId: 'block', t: 0, pose: sampleClip(CLIPS.block, 0) }
  }

  if (p.crouch) {
    return { clipId: 'crouch', t: 0, pose: sampleClip(CLIPS.crouch, 0) }
  }

  if (p.jump) {
    return { clipId: 'jump', t: 0, pose: sampleClip(CLIPS.jump, 0) }
  }

  // Walk when moving on ground (engine supplies walkSpeed)
  const speed = Math.abs(p.walkSpeed ?? 0)
  if (speed > 0.45) {
    const clip = CLIPS.walk
    // Phase advances with frame + speed for natural gait
    const gait = (frame * (0.55 + Math.min(1.4, speed / 3))) % clip.length
    const t = gait / clip.length
    return { clipId: 'walk', t, pose: sampleClip(clip, t) }
  }

  // Idle breathing
  const clip = CLIPS.idle
  const t = (frame % clip.length) / clip.length
  return { clipId: 'idle', t, pose: sampleClip(clip, t) }
}
