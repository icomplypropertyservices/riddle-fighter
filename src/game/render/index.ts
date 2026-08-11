/**
 * True 2D Street Fighter–standard render pipeline.
 * High-DPI canvas + articulated fighters + painted stages.
 * @see docs/STREET_FIGHTER_GRAPHICS_PLAN.md
 */

export { drawFighterSf, drawFighterArticulated } from './fighterRenderer'
export { directAnim } from './animDirector'
export { CLIPS, sampleClip } from './poseLibrary'
export {
  getCollectionLook,
  resolveCollectionId,
  LOOKS,
  LOOKS_FOR_BAKE,
  type CollectionLook,
  type FighterCollectionId,
} from './collectionLooks'
export {
  setupTrue2dCanvas,
  applyHighQuality,
  clearTrue2d,
  restoreTrue2dTransform,
  type True2dContext,
} from './true2dCanvas'
export { drawStageTrue2d, STAGE_GROUND_Y } from './stageRenderer'
export {
  ensureFramePacksBaked,
  getBakedFrame,
  getBakedPack,
  compositeWalkStrip,
  type BakedClip,
  type BakedPack,
} from './frameBake'
export type { AnimClipId, JointPose, FighterDrawInput } from './types'
