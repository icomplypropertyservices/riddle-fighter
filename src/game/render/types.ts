/**
 * Street Fighter–standard procedural fighter render types.
 * Joints are local to hip origin; Y-up negative (canvas: head is negative Y).
 */

export type AnimClipId =
  | 'idle'
  | 'walk'
  | 'crouch'
  | 'jump'
  | 'punch'
  | 'kick'
  | 'special'
  | 'secret'
  | 'dash'
  | 'block'
  | 'hit'
  | 'ko'

/** Single joint angle / offset key (degrees for rot, px for offsets). */
export type JointPose = {
  /** torso pitch (deg, lean forward = +) */
  torso: number
  /** head nod */
  head: number
  /** front arm: shoulder angle (0 = down, -90 = forward punch for facing-right logical) */
  fShoulder: number
  fElbow: number
  /** back arm */
  bShoulder: number
  bElbow: number
  /** front leg: hip angle (0 = stand, -ve kick up) */
  fHip: number
  fKnee: number
  /** back leg */
  bHip: number
  bKnee: number
  /** whole-body vertical offset from ground contact (px) */
  rootY: number
  /** squash scale Y */
  scaleY: number
  scaleX: number
}

export type PoseKey = {
  /** 0..1 within clip */
  t: number
  pose: JointPose
}

export type AnimClip = {
  id: AnimClipId
  /** duration in engine frames at 60fps baseline */
  length: number
  loop: boolean
  keys: PoseKey[]
}

export type FighterDrawInput = {
  x: number
  y: number
  facing: 1 | -1
  color: string
  color2: string
  /** NFT plate image (optional) */
  sprite: CanvasImageSource | null
  name?: string
  crouch: boolean
  jump: boolean
  blocking: boolean
  hitstun: number
  flash: number
  dead: boolean
  attackKind: string | null
  /** 0..attackFrames */
  attackFrame: number
  attackFrames: number
  /** global engine frame for idle/walk phase */
  frame: number
  /** horizontal speed estimate for walk (optional) */
  walkPhase?: number
  lastMoveName?: string
  lastMoveBanner?: number
  moveColor?: string
}

/** Minimal anim-facing state (avoids circular import with engine). */
export type FighterAnimState = {
  fighter: {
    color: string
    color2: string
    image?: string
    /** Collection-aware realistic looks */
    category?: string
    collection?: string
    taxon?: number | null
    id?: string
    nftId?: string
  }
  x: number
  y: number
  facing: 1 | -1
  crouch: boolean
  blocking: boolean
  jump: boolean
  attackKind: string | null
  attackFrame: number
  hitstun: number
  flash: number
  dead: boolean
  activeMove: {
    frames: number
    activeStart: number
    activeEnd: number
    reach: number
    colorHint?: string
  } | null
  lastMoveName: string
  lastMoveBanner: number
  /** Absolute horizontal speed (px/frame) — drives walk clip when > threshold. */
  walkSpeed?: number
}
