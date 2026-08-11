/**
 * @riddle/suite-game-economy
 *
 * Single source of truth for cross-game economy schemas and fee constants.
 * Spendable money = suite credits only (riddle_dev_entitlement_v1 / rdl_dev).
 * City treasury gold is NOT suite credits.
 */

// ─── Economy rate (must match @riddle/suite-credits) ───────────────────────

/** 1 suite credit = $0.01 USD · 100 cr = $1 */
export const USD_PER_CREDIT = 0.01
export const CREDITS_PER_USD = 100
export const GAME_ECONOMY_VERSION = '1.0.0'

// ─── Games ─────────────────────────────────────────────────────────────────

export type GameId = 'fighter' | 'cities' | 'civilisation' | 'wallet' | 'dev'

// ─── Suite spend reasons (unified audit trail) ─────────────────────────────

export const SUITE_SPEND_REASONS = [
  'battle_entry',
  'battle_refund',
  'battle_win',
  'wager_lock',
  'wager_win',
  'wager_refund',
  'tourney_entry',
  'tourney_prize',
  'building_place',
  'building_upgrade',
  'land_plant',
  'mint',
  'agent_run',
  'scenario',
  'custom',
] as const

export type SuiteSpendReason = (typeof SUITE_SPEND_REASONS)[number]

/** Build stable spend reason string for suite ledger */
export function suiteSpendTag(
  game: GameId,
  reason: SuiteSpendReason,
  ref?: string,
): string {
  const r = ref ? `${reason}:${ref}` : reason
  return `${game}:${r}`
}

// ─── Fee SSOT (basis points where noted) ───────────────────────────────────

/** Fixed battle entry each side (Fighter). Winner pot = entry × 2 (no cut). */
export const BATTLE_ENTRY_FEE = 10
export const BATTLE_WIN_POT = BATTLE_ENTRY_FEE * 2

/** Platform cut on credit wagers (not battle entry). 1000 = 10%. */
export const WAGER_FEE_BPS = 1000
export const MIN_WAGER_CREDITS = 1

/** Default tournament entry (Fighter + Civ fighter cups). */
export const TOURNAMENT_ENTRY_FEE = 25
/** Winner prize share of total entry pot. 8000 = 80%. */
export const TOURNAMENT_PRIZE_BPS = 8000

/** Cities building place fee (suite). Plant is free. */
export const BUILD_PLACE_FEE = 5
export const LAND_PLANT_FEE = 0
export const UPGRADE_COST_PER_LEVEL = 4

/** Default Civ mint when collection has no override. */
export const DEFAULT_MINT_CREDITS = 25

/** Agent runs — paid suite fee (0 = free bootstrap; raise when product ready). */
export const AGENT_RUN_CREDITS = 0

// ─── Tournament V1 (shared across apps) ────────────────────────────────────

export type TournamentStatus =
  | 'setup'
  | 'upcoming'
  | 'open'
  | 'live'
  | 'completed'
  | 'done'

export type TourneySize = 4 | 8

/**
 * Canonical tournament record.
 * Fighter brackets use size/seats/bracket; Civ lobby boards use name/entrants.
 * Both must use entryCredits + suite spend reason tourney_entry.
 */
export type TournamentV1 = {
  id: string
  /** Which product surface owns the board */
  game: GameId
  name?: string
  /** Suite credits required to enter (SSOT field name) */
  entryCredits: number
  /** @deprecated alias — use entryCredits */
  entryFee?: number
  status: TournamentStatus
  /** Total pot from entries (suite cr) */
  pot: number
  /** Alias used by Civ UI */
  prizePool?: number
  platformCut?: number
  winnerPayout?: number
  maxEntrants?: number
  size?: TourneySize
  startsAt?: string
  endsAt?: string
  createdAt?: string
  description?: string
  entrants?: Array<{
    wallet: string
    civName?: string
    power?: number
    joinedAt: string
  }>
  /** Fighter bracket payload (opaque to Civ) */
  seats?: unknown[]
  bracket?: unknown[]
  currentMatchId?: string | null
  championId?: string | null
}

export function normalizeEntryCredits(t: {
  entryCredits?: number
  entryFee?: number
}): number {
  const n = Number(t.entryCredits ?? t.entryFee ?? TOURNAMENT_ENTRY_FEE)
  return Math.max(0, Math.floor(Number.isFinite(n) ? n : TOURNAMENT_ENTRY_FEE))
}

export function quoteTournamentPot(
  entryCredits: number,
  players: number,
  prizeBps = TOURNAMENT_PRIZE_BPS,
): { pot: number; platformCut: number; winnerPayout: number; entryCredits: number; players: number } {
  const fee = Math.max(0, Math.floor(entryCredits))
  const n = Math.max(0, Math.floor(players))
  const pot = fee * n
  const winnerPayout = Math.floor((pot * prizeBps) / 10_000)
  const platformCut = pot - winnerPayout
  return { pot, platformCut, winnerPayout, entryCredits: fee, players: n }
}

// ─── Wager V1 ──────────────────────────────────────────────────────────────

export type WagerStatus = 'open' | 'locked' | 'settled' | 'cancelled'

export type WagerQuoteV1 = {
  stakeEach: number
  pot: number
  platformCut: number
  winnerPayout: number
  feeBps: number
}

export function quoteWagerCredits(
  stakeEach: number,
  feeBps = WAGER_FEE_BPS,
): WagerQuoteV1 {
  const stake = Math.max(0, Math.floor(Number(stakeEach) || 0))
  const pot = stake * 2
  const platformCut = Math.floor((pot * feeBps) / 10_000)
  const winnerPayout = pot - platformCut
  return { stakeEach: stake, pot, platformCut, winnerPayout, feeBps }
}

export type WagerV1 = {
  id: string
  game: GameId
  title?: string
  status: WagerStatus
  stakeCredits: number
  potCredits: number
  feeBps: number
  creatorWallet?: string
  sideA?: string
  sideB?: string
  createdAt: string
  winner?: 'A' | 'B' | 'draw'
}

// ─── Credit move (audit) ───────────────────────────────────────────────────

export type CreditMove = {
  id: string
  at: string
  game: GameId
  reason: SuiteSpendReason
  /** Positive = earn, negative = spend */
  amount: number
  balanceAfter?: number
  ref?: string
  note?: string
}

export function makeCreditMoveId(): string {
  return `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ─── Agent catalog (Civ) ───────────────────────────────────────────────────

export type AgentKind =
  | 'collection-categoriser'
  | 'battle-negotiator'
  | 'city-optimiser'
  | 'metadata-updater'

export type AgentRunCost = {
  kind: AgentKind
  suiteCredits: number
  reason: SuiteSpendReason
}

export const AGENT_RUN_COSTS: Record<AgentKind, number> = {
  'collection-categoriser': AGENT_RUN_CREDITS,
  'battle-negotiator': AGENT_RUN_CREDITS,
  'city-optimiser': AGENT_RUN_CREDITS,
  'metadata-updater': AGENT_RUN_CREDITS,
}

// ─── Money naming helpers ──────────────────────────────────────────────────

/**
 * City sim treasury is NOT suite credits.
 * Prefer cityGold in new code; resources.credits remains for save compatibility.
 */
export type CityMoney = {
  /** SimCity gold — local city state only */
  cityGold: number
  /** Suite pool — Wallet/Dev/Fighter/Civ shared */
  suiteCredits: number
}

export function cityGoldFromResources(credits: number): number {
  return Math.max(0, Math.floor(Number(credits) || 0))
}

export function creditsToUsd(credits: number): number {
  return Math.round(Math.max(0, Number(credits) || 0) * USD_PER_CREDIT * 100) / 100
}

export function formatCredits(n: number): string {
  return `${Math.max(0, Math.floor(n))} cr`
}
