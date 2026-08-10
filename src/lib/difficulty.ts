/**
 * CPU difficulty for Riddle Fighter.
 * Easy by default — Nintendo-friendly approachable play.
 */

export type DifficultyId = 'easy' | 'medium' | 'hard' | 'expert'

export type DifficultyProfile = {
  id: DifficultyId
  label: string
  hint: string
  dmgOut: number
  dmgIn: number
  hp: number
  stats: number
  blockChance: number
  attackChance: number
  specialChance: number
  jumpChance: number
  reactionFrames: number
}

export const DIFFICULTIES: DifficultyProfile[] = [
  {
    id: 'easy',
    label: 'Easy',
    hint: 'Patient rival · big openings · learn the game',
    dmgOut: 0.42,
    dmgIn: 1.45,
    hp: 0.7,
    stats: 0.65,
    blockChance: 0.1,
    attackChance: 0.055,
    specialChance: 0.02,
    jumpChance: 0.08,
    reactionFrames: 22,
  },
  {
    id: 'medium',
    label: 'Medium',
    hint: 'Fair Nintendo pace · readable fights',
    dmgOut: 0.72,
    dmgIn: 1.1,
    hp: 0.9,
    stats: 0.9,
    blockChance: 0.32,
    attackChance: 0.12,
    specialChance: 0.06,
    jumpChance: 0.2,
    reactionFrames: 12,
  },
  {
    id: 'hard',
    label: 'Hard',
    hint: 'Faster decisions · less free damage',
    dmgOut: 0.95,
    dmgIn: 0.95,
    hp: 1.05,
    stats: 1.05,
    blockChance: 0.5,
    attackChance: 0.18,
    specialChance: 0.1,
    jumpChance: 0.3,
    reactionFrames: 5,
  },
  {
    id: 'expert',
    label: 'Expert',
    hint: 'Sharp AI · for practiced players',
    dmgOut: 1.12,
    dmgIn: 0.85,
    hp: 1.15,
    stats: 1.15,
    blockChance: 0.62,
    attackChance: 0.24,
    specialChance: 0.14,
    jumpChance: 0.36,
    reactionFrames: 1,
  },
]

const STORAGE_KEY = 'rf_difficulty_v1'

export function getDifficulty(id: DifficultyId): DifficultyProfile {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[0]!
}

export function loadDifficulty(): DifficultyId {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'easy' || v === 'medium' || v === 'hard' || v === 'expert') return v
  } catch {
    /* soft */
  }
  return 'easy'
}

export function saveDifficulty(id: DifficultyId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* soft */
  }
}
