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

  // Match-end victory arms
  if (p.lastMoveName === 'VICTORY' && (p.lastMoveBanner || 0) > 0) {
    const pose = sampleClip(CLIPS.secret, 0.55)
    // Raise both arms
    return {
      clipId: 'idle',
      t: 0.5,
      pose: {
        ...pose,
        fShoulder: -120,
        bShoulder: -110,
        fElbow: 10,
        bElbow: 15,
        torso: -6,
        rootY: -2,
        scaleY: 1.04,
      },
    }
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
  if (speed > 0.1 && !p.jump) {
    const clip = CLIPS.walk
    // Gait speed tracks movement — legs cycle faster when sprinting
    const rate = 1.05 + Math.min(2.2, speed / 1.8)
    const gait = (frame * rate) % clip.length
    const t = gait / clip.length
    const pose = sampleClip(clip, t)
    // Slight crouch-walk compression when holding down mid-walk (handled by crouch priority above)
    return { clipId: 'walk', t, pose }
  }

  // Idle breathing — continuous arm/leg micro-sway
  const clip = CLIPS.idle
  const t = (frame % clip.length) / clip.length
  return { clipId: 'idle', t, pose: sampleClip(clip, t) }
}
