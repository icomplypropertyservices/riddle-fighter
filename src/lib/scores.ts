/**
 * Player scorebook — wins / losses / streak / history (local, suite-scoped).
 * Separate from Reborn / World dash — fighter app owns this ledger.
 */

const SCORE_KEY = 'riddle_fighter_scores_v1'
const HISTORY_MAX = 40

export type MatchResult = {
  id: string
  at: string
  won: boolean
  mode: 'cpu' | 'pvp' | 'handle'
  opponent: string
  fighterName: string
  wagerCredits: number
  payoutCredits: number
}

export type PlayerScore = {
  wins: number
  losses: number
  draws: number
  streak: number
  bestStreak: number
  totalWagered: number
  totalWonCredits: number
  history: MatchResult[]
  updatedAt: string
}

function empty(): PlayerScore {
  return {
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    totalWagered: 0,
    totalWonCredits: 0,
    history: [],
    updatedAt: new Date().toISOString(),
  }
}

export function loadScores(): PlayerScore {
  if (typeof localStorage === 'undefined') return empty()
  try {
    const raw = localStorage.getItem(SCORE_KEY)
    if (!raw) return empty()
    const j = JSON.parse(raw) as PlayerScore
    return {
      ...empty(),
      ...j,
      wins: Math.max(0, Math.floor(Number(j.wins) || 0)),
      losses: Math.max(0, Math.floor(Number(j.losses) || 0)),
      draws: Math.max(0, Math.floor(Number(j.draws) || 0)),
      streak: Math.floor(Number(j.streak) || 0),
      bestStreak: Math.max(0, Math.floor(Number(j.bestStreak) || 0)),
      totalWagered: Math.max(0, Math.floor(Number(j.totalWagered) || 0)),
      totalWonCredits: Math.max(0, Math.floor(Number(j.totalWonCredits) || 0)),
      history: Array.isArray(j.history) ? j.history.slice(0, HISTORY_MAX) : [],
    }
  } catch {
    return empty()
  }
}

function save(s: PlayerScore): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify({ ...s, updatedAt: new Date().toISOString() }))
  } catch {
    /* soft */
  }
  try {
    window.dispatchEvent(new CustomEvent('riddle-fighter-scores', { detail: s }))
  } catch {
    /* soft */
  }
}

export function recordMatch(opts: {
  won: boolean
  mode: MatchResult['mode']
  opponent: string
  fighterName: string
  wagerCredits?: number
  payoutCredits?: number
}): PlayerScore {
  const s = loadScores()
  const wager = Math.max(0, Math.floor(Number(opts.wagerCredits) || 0))
  const payout = Math.max(0, Math.floor(Number(opts.payoutCredits) || 0))
  if (opts.won) {
    s.wins += 1
    s.streak = s.streak >= 0 ? s.streak + 1 : 1
  } else {
    s.losses += 1
    s.streak = s.streak <= 0 ? s.streak - 1 : -1
  }
  s.bestStreak = Math.max(s.bestStreak, s.streak > 0 ? s.streak : 0)
  s.totalWagered += wager
  if (opts.won) s.totalWonCredits += payout
  const row: MatchResult = {
    id: `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    won: opts.won,
    mode: opts.mode,
    opponent: opts.opponent || 'CPU',
    fighterName: opts.fighterName || 'Fighter',
    wagerCredits: wager,
    payoutCredits: payout,
  }
  s.history = [row, ...s.history].slice(0, HISTORY_MAX)
  save(s)
  return s
}

export function winRate(s: PlayerScore): number {
  const t = s.wins + s.losses
  if (t <= 0) return 0
  return Math.round((s.wins / t) * 100)
}

export function recordLabel(s: PlayerScore): string {
  return `${s.wins}W · ${s.losses}L`
}
