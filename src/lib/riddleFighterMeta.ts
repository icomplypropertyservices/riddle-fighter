/**
 * Client mirror of Riddle Fighter meta field plan.
 * Full catalog: riddle-world/content/nfts/game/riddle-fighter-fields.json
 */

export const RF_META_SCHEMA_ID = 'riddle.fighter.meta.v1'
export const RF_MAINFRAME_CREDIT_COST = 0.5

/** Flat list of trait_type keys Fighter may read/write. */
export const RF_TRAIT_TYPES = {
  // World (existing)
  army: 'Army',
  ownerArmy: 'Owner Army',
  uniform: 'Uniform',
  ins: 'Ins',
  gameClass: 'Game Class',
  factionBias: 'Faction Bias',
  power: 'Power',
  defense: 'Defense',
  level: 'Level',
  xp: 'XP',
  weapon: 'Weapon',
  inheritedHealth: 'Inherited Health',
  inheritedPower: 'Inherited Power',
  inheritedDefence: 'Inherited Defence',
  special1: 'Inherited Special Ability 1',
  special2: 'Inherited Special Ability 2',
  element: 'Inherited Element',
  // Progression (to backfill)
  wins: 'Wins',
  losses: 'Losses',
  record: 'Record',
  // RF combat overlay
  rfHp: 'RF HP',
  rfAtk: 'RF ATK',
  rfDef: 'RF DEF',
  rfSpd: 'RF Speed',
  rfSpecial: 'RF Special',
  rfSpecialName: 'RF Special Name',
  rfSuperName: 'RF Super Name',
  rfStance: 'RF Stance',
  rfWeight: 'RF Weight',
  rfMoveset: 'RF Moveset',
  rfStage: 'RF Stage',
  // RF progression
  rfDraws: 'RF Draws',
  rfKos: 'RF KOs',
  rfPerfects: 'RF Perfects',
  rfMaxCombo: 'RF Max Combo',
  rfWinStreak: 'RF Win Streak',
  rfBestStreak: 'RF Best Streak',
  rfElo: 'RF Elo',
  rfRank: 'RF Rank',
  rfHeat: 'RF Heat',
  // Visual
  rfBattleStance: 'RF Battle Stance',
  rfPortrait: 'RF Portrait',
  rfColorPrimary: 'RF Color Primary',
  rfColorSecondary: 'RF Color Secondary',
  // Social / city / multiplayer
  rfHandle: 'RF Handle',
  rfTitle: 'RF Title',
  rfCityPlot: 'RF City Plot',
  rfCityJob: 'RF City Job',
  rfCityHappiness: 'RF City Happiness',
  rfChallengeOpen: 'RF Challenge Open',
  rfMinWager: 'RF Min Wager',
  rfMaxWager: 'RF Max Wager',
  rfPublishStatus: 'RF Publish Status',
} as const

export type TraitRow = { trait_type: string; value: string | number | boolean }

export type RfFieldGroup =
  | 'identity'
  | 'world_traits'
  | 'combat'
  | 'progression'
  | 'visual'
  | 'army_social'
  | 'city'
  | 'equipment'
  | 'economy'
  | 'multiplayer'
  | 'future'

/** Human-readable plan groups for mainframe UI / docs. */
export const RF_FIELD_GROUPS: { id: RfFieldGroup; title: string; summary: string }[] = [
  {
    id: 'identity',
    title: 'Identity & linkage',
    summary: 'nft_id, collection, owner, taxon, serial, URI, mutable contract',
  },
  {
    id: 'world_traits',
    title: 'World / remint (existing DB)',
    summary: 'Army, Uniform, Ins, Class, Power, Defense, inherited stats',
  },
  {
    id: 'combat',
    title: 'Combat vitals (RF overlay)',
    summary: 'RF HP/ATK/DEF/Speed/Special, stance, weight, moveset, stage',
  },
  {
    id: 'progression',
    title: 'Progression & ladder',
    summary: 'Wins/Losses/Record, KOs, streaks, Elo, heat, evolution',
  },
  {
    id: 'visual',
    title: 'Visual / art pipeline',
    summary: 'Images, battle stance, palette, generation history, identity lock',
  },
  {
    id: 'army_social',
    title: 'Army & social',
    summary: '@handle, title, bio, primary fighter for player',
  },
  {
    id: 'city',
    title: 'City / placement',
    summary: 'Plot, job, happiness, grid x/y, city_saves link',
  },
  {
    id: 'equipment',
    title: 'Equipment & specials',
    summary: 'Weapon, armor, relic, special/super names',
  },
  {
    id: 'economy',
    title: 'Economy & mainframe',
    summary: '0.5 cr mutate cost, publish status, hot-wallet tx audit',
  },
  {
    id: 'multiplayer',
    title: 'Multiplayer / offers',
    summary: 'Challenge open, wager min/max, tournament seed',
  },
  {
    id: 'future',
    title: 'Future-ready',
    summary: 'Tags, rarity score, voice, skins, quests, season',
  },
]

export function traitMap(traits: TraitRow[] | undefined | null): Map<string, string | number | boolean> {
  const m = new Map<string, string | number | boolean>()
  if (!Array.isArray(traits)) return m
  for (const t of traits) {
    if (t?.trait_type != null) m.set(String(t.trait_type), t.value)
  }
  return m
}

export function numTrait(traits: TraitRow[] | undefined | null, type: string, fb = 0): number {
  const n = Number(traitMap(traits).get(type))
  return Number.isFinite(n) ? n : fb
}

export function strTrait(traits: TraitRow[] | undefined | null, type: string, fb = ''): string {
  const v = traitMap(traits).get(type)
  return v == null || v === '' ? fb : String(v)
}

export function upsertTrait(
  traits: TraitRow[] | undefined | null,
  trait_type: string,
  value: string | number | boolean,
): TraitRow[] {
  const list = Array.isArray(traits) ? traits.map((t) => ({ ...t })) : []
  const i = list.findIndex((t) => t.trait_type === trait_type)
  if (i >= 0) list[i] = { trait_type, value }
  else list.push({ trait_type, value })
  return list
}

/** Build fighter combat stats from DB-style traits (for arena). */
export function combatFromTraits(traits: TraitRow[] | undefined | null): {
  hp: number
  atk: number
  def: number
  speed: number
  special: number
  specialName: string
  weapon: string
  wins: number
  losses: number
} {
  const power = numTrait(traits, 'Power', numTrait(traits, 'Inherited Power', 50))
  const defense = numTrait(traits, 'Defense', numTrait(traits, 'Inherited Defence', 40))
  const iHp = numTrait(traits, 'Inherited Health', 90)
  const level = numTrait(traits, 'Level', 1)
  const hp = numTrait(traits, 'RF HP', 0) || Math.max(80, Math.min(200, Math.floor(70 + iHp * 0.6 + level * 2)))
  const atk = numTrait(traits, 'RF ATK', 0) || Math.max(8, Math.min(28, Math.floor(8 + power * 0.12)))
  const def = numTrait(traits, 'RF DEF', 0) || Math.max(4, Math.min(22, Math.floor(5 + defense * 0.1)))
  const speed = numTrait(traits, 'RF Speed', 0) || Math.max(6, Math.min(20, Math.floor(8 + (100 - defense) * 0.05)))
  const special = numTrait(traits, 'RF Special', 0) || Math.max(12, Math.min(36, Math.floor(14 + power * 0.08)))
  return {
    hp,
    atk,
    def,
    speed,
    special,
    specialName:
      strTrait(traits, 'RF Special Name') ||
      strTrait(traits, 'Inherited Special Ability 1', 'Special'),
    weapon: strTrait(traits, 'Weapon', 'Blade'),
    wins: numTrait(traits, 'Wins', 0),
    losses: numTrait(traits, 'Losses', 0),
  }
}
