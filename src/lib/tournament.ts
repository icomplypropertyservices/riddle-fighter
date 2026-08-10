/**
 * Tournament brackets — entry fee from suite credits only.
 * 4 or 8 slots; empty seats filled with CPU. Single elimination.
 */

import type { Fighter } from './fighters'
import { cpuFromOwned, fighterFromHandle } from './fighters'
import {
  getCredits,
  quoteWagerCredits,
  TOURNAMENT_ENTRY_FEE,
  TOURNAMENT_PRIZE_BPS,
} from './credits'

export { TOURNAMENT_ENTRY_FEE }

export type TourneySize = 4 | 8

export type TourneySeat = {
  id: string
  label: string
  fighter: Fighter
  kind: 'you' | 'cpu' | 'handle'
  eliminated: boolean
}

export type TourneyMatch = {
  id: string
  round: number
  a: string | null
  b: string | null
  winnerId: string | null
  label: string
}

export type Tournament = {
  id: string
  size: TourneySize
  entryFee: number
  /** Total pot locked from entry fees (suite credits). */
  pot: number
  platformCut: number
  winnerPayout: number
  seats: TourneySeat[]
  bracket: TourneyMatch[]
  currentMatchId: string | null
  championId: string | null
  status: 'setup' | 'live' | 'done'
  createdAt: string
}

const LS_KEY = 'riddle_fighter_tournament_v1'

function seatId(): string {
  return `s_${Math.random().toString(36).slice(2, 9)}`
}

function matchId(r: number, i: number): string {
  return `m_r${r}_${i}`
}

export function quoteTournament(size: TourneySize, entryFee: number): {
  entryFee: number
  pot: number
  platformCut: number
  winnerPayout: number
  players: number
} {
  const fee = Math.max(0, Math.floor(entryFee))
  const players = size
  const pot = fee * players
  /** Winner prize pool = 80% of entries (platform keeps 20%). */
  const winnerPayout = Math.floor((pot * TOURNAMENT_PRIZE_BPS) / 10_000)
  const platformCut = pot - winnerPayout
  return { entryFee: fee, pot, platformCut, winnerPayout, players }
}

/** Build empty bracket + you seat; rest CPU. Entry not locked yet. */
export function createTournamentSetup(
  you: Fighter,
  size: TourneySize,
  entryFee: number,
  handleFills: string[] = [],
): Tournament {
  const q = quoteTournament(size, entryFee)
  const seats: TourneySeat[] = []
  seats.push({
    id: seatId(),
    label: 'You',
    fighter: you,
    kind: 'you',
    eliminated: false,
  })
  // CPU seats are scaled mirrors of YOUR real NFT — no hardcoded demo roster
  for (let i = 1; i < size; i++) {
    const h = handleFills[i - 1]
    if (h && h.trim()) {
      const fh = fighterFromHandle(h.trim())
      seats.push({
        id: seatId(),
        label: `@${h.replace(/^@/, '')}`,
        fighter: fh,
        kind: 'handle',
        eliminated: false,
      })
    } else {
      const diff =
        i % 4 === 1 ? 'easy' : i % 4 === 2 ? 'medium' : i % 4 === 3 ? 'hard' : 'expert'
      const f = cpuFromOwned(you, diff as 'easy' | 'medium' | 'hard' | 'expert', `CPU ${i}`)
      seats.push({
        id: seatId(),
        label: f.name,
        fighter: { ...f, id: `cpu-t-${i}-${you.nftId || you.id}` },
        kind: 'cpu',
        eliminated: false,
      })
    }
  }
  // shuffle non-you positions slightly
  for (let i = seats.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(Math.random() * i)
    if (j === 0) continue
    const tmp = seats[i]!
    seats[i] = seats[j]!
    seats[j] = tmp
  }
  // ensure you at index 0 after shuffle re-find
  const youIdx = seats.findIndex((s) => s.kind === 'you')
  if (youIdx > 0) {
    const t = seats[0]!
    seats[0] = seats[youIdx]!
    seats[youIdx] = t
  }

  const bracket = buildBracket(seats, size)
  return {
    id: `t_${Date.now().toString(36)}`,
    size,
    entryFee: q.entryFee,
    pot: q.pot,
    platformCut: q.platformCut,
    winnerPayout: q.winnerPayout,
    seats,
    bracket,
    currentMatchId: bracket.find((m) => m.round === 1)?.id || null,
    championId: null,
    status: 'setup',
    createdAt: new Date().toISOString(),
  }
}

function buildBracket(seats: TourneySeat[], size: TourneySize): TourneyMatch[] {
  const matches: TourneyMatch[] = []
  const rounds = Math.log2(size)
  // round 1 pairs
  for (let i = 0; i < size / 2; i++) {
    const a = seats[i * 2]?.id || null
    const b = seats[i * 2 + 1]?.id || null
    matches.push({
      id: matchId(1, i),
      round: 1,
      a,
      b,
      winnerId: null,
      label: `R1 · Match ${i + 1}`,
    })
  }
  for (let r = 2; r <= rounds; r++) {
    const prevCount = size / Math.pow(2, r - 1)
    const count = prevCount / 2
    for (let i = 0; i < count; i++) {
      matches.push({
        id: matchId(r, i),
        round: r,
        a: null,
        b: null,
        winnerId: null,
        label: r === rounds ? 'Final' : `R${r} · Match ${i + 1}`,
      })
    }
  }
  return matches
}

export function canAffordEntry(entryFee: number): boolean {
  return getCredits() >= Math.max(0, Math.floor(entryFee))
}

/**
 * Soft-lock: player pays only their entryFee (you seat).
 * Pot math still uses full size * fee for display (CPU seats virtual).
 * Real credits: only YOUR entry leaves the suite ledger.
 */
export function playerEntryCost(t: Tournament): number {
  return t.entryFee
}

/** Real pot for player: if only you paid, pot = entry * 2 soft CPU match... use product:
 *  Your stake = entryFee. On championship win, payout = quote single-elim pot of
 *  (entryFee * size) - 10%, funded soft for CPU share (same as 1v1 CPU wager).
 */
export function championshipPayout(t: Tournament): number {
  return t.winnerPayout
}

export function nextPlayableMatch(t: Tournament): TourneyMatch | null {
  const open = t.bracket
    .filter((m) => !m.winnerId && m.a && m.b)
    .sort((a, b) => a.round - b.round)
  // Prefer match involving you
  const you = t.seats.find((s) => s.kind === 'you' && !s.eliminated)
  if (you) {
    const yours = open.find((m) => m.a === you.id || m.b === you.id)
    if (yours) return yours
  }
  return open[0] || null
}

export function getSeat(t: Tournament, id: string | null): TourneySeat | null {
  if (!id) return null
  return t.seats.find((s) => s.id === id) || null
}

export function resolveMatch(
  t: Tournament,
  matchIdStr: string,
  winnerSeatId: string,
): Tournament {
  const bracket = t.bracket.map((m) =>
    m.id === matchIdStr ? { ...m, winnerId: winnerSeatId } : m,
  )
  const match = bracket.find((m) => m.id === matchIdStr)
  if (!match) return t

  const seats = t.seats.map((s) => {
    if (s.id === match.a || s.id === match.b) {
      if (s.id !== winnerSeatId) return { ...s, eliminated: true }
    }
    return s
  })

  // feed winner into next round
  const rounds = Math.log2(t.size)
  if (match.round < rounds) {
    const idxInRound = t.bracket
      .filter((m) => m.round === match.round)
      .findIndex((m) => m.id === matchIdStr)
    const nextRound = match.round + 1
    const nextIdx = Math.floor(idxInRound / 2)
    const next = bracket.find((m) => m.round === nextRound && m.id === matchId(nextRound, nextIdx))
    if (next) {
      const slot = idxInRound % 2 === 0 ? 'a' : 'b'
      for (let i = 0; i < bracket.length; i++) {
        if (bracket[i]!.id === next.id) {
          bracket[i] = { ...bracket[i]!, [slot]: winnerSeatId }
        }
      }
    }
  }

  const final = bracket.find((m) => m.round === rounds)
  const championId =
    final?.winnerId && final.round === rounds ? final.winnerId : null
  const status: Tournament['status'] = championId ? 'done' : 'live'
  const current = nextPlayableMatch({ ...t, bracket, seats, status, championId })

  return {
    ...t,
    seats,
    bracket,
    currentMatchId: current?.id || null,
    championId,
    status,
  }
}

/** Auto-sim CPU vs CPU (or handle as CPU AI). */
export function autoSimMatch(t: Tournament, m: TourneyMatch): string {
  const a = getSeat(t, m.a)
  const b = getSeat(t, m.b)
  if (!a) return m.b!
  if (!b) return m.a!
  const pa = a.fighter.stats.atk + a.fighter.stats.speed + a.fighter.stats.hp / 10
  const pb = b.fighter.stats.atk + b.fighter.stats.speed + b.fighter.stats.hp / 10
  const ra = pa + Math.random() * 20
  const rb = pb + Math.random() * 20
  return ra >= rb ? a.id : b.id
}

export function saveTournament(t: Tournament): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(t))
  } catch {
    /* soft */
  }
}

export function loadTournament(): Tournament | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Tournament
  } catch {
    return null
  }
}

export function clearTournament(): void {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* soft */
  }
}

/** Display-only pot line — 80% prize pool to champion. */
export function potLine(entryFee: number, size: TourneySize): string {
  const q = quoteTournament(size, entryFee)
  void quoteWagerCredits
  return `Entry ${q.entryFee} cr × ${q.players} → pot ${q.pot} · 80% prize ${q.winnerPayout} cr · cut ${q.platformCut}`
}
