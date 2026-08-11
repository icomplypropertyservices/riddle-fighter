/**
 * Tournament brackets — suite-credit entry, prize pool, schedule, Civ/NFT themes.
 * 4 / 8 / 16 slots; empty seats filled with CPU. Single elimination.
 */

import type { Fighter } from './fighters'
import { cpuFromOwned, fighterFromHandle } from './fighters'
import {
  getCredits,
  quoteWagerCredits,
  TOURNAMENT_ENTRY_FEE,
} from './credits'
import {
  quoteTournamentPot,
  normalizeEntryCredits,
  type TourneySize as SharedTourneySize,
} from '@riddle/suite-game-economy'
import { SUITE } from './suite'

export { TOURNAMENT_ENTRY_FEE }

/** Bracket sizes — 16 is Fighter-extended (shared economy SSOT is 4|8). */
export type TourneySize = 4 | 8 | 16
export type TourneySizeExt = TourneySize

export type TourneyTheme = 'open' | 'civ' | 'nft' | 'mixed'

export type TourneySeat = {
  id: string
  label: string
  fighter: Fighter
  kind: 'you' | 'cpu' | 'handle' | 'civ' | 'nft'
  eliminated: boolean
  /** Optional civ name / alliance badge */
  civTag?: string
  image?: string
}

export type TourneyMatch = {
  id: string
  round: number
  a: string | null
  b: string | null
  winnerId: string | null
  label: string
  /** Optional scheduled tip for this match */
  scheduledHint?: string
}

export type TournamentSetupOpts = {
  name?: string
  theme?: TourneyTheme
  /** ISO start time (optional) */
  startsAt?: string | null
  /** Registration deadline (optional) */
  registrationEnds?: string | null
  description?: string
  /** Linked civ tags for display */
  civTags?: string[]
  /** Host wallet */
  hostAddress?: string
  hostHandle?: string
}

/**
 * Fighter bracket tournament.
 * entryCredits is SSOT field; entryFee kept for save/UI compatibility.
 */
export type Tournament = {
  id: string
  name: string
  description?: string
  theme: TourneyTheme
  size: TourneySizeExt
  /** @deprecated prefer entryCredits — same value */
  entryFee: number
  /** Suite credits required to enter (SSOT · TournamentV1) */
  entryCredits: number
  /** Total pot locked from entry fees (suite credits). */
  pot: number
  platformCut: number
  winnerPayout: number
  seats: TourneySeat[]
  bracket: TourneyMatch[]
  currentMatchId: string | null
  championId: string | null
  status: 'setup' | 'registration' | 'live' | 'done'
  createdAt: string
  startsAt?: string | null
  registrationEnds?: string | null
  civTags?: string[]
  hostAddress?: string
  hostHandle?: string
}

const LS_KEY = 'riddle_fighter_tournament_v1'

function seatId(): string {
  return `s_${Math.random().toString(36).slice(2, 9)}`
}

function matchId(r: number, i: number): string {
  return `m_r${r}_${i}`
}

export function quoteTournament(size: TourneySizeExt, entryFee: number): {
  entryFee: number
  entryCredits: number
  pot: number
  platformCut: number
  winnerPayout: number
  players: number
} {
  // Shared economy only types 4|8 — scale 16 as 2× an 8-man pot of same entry
  if (size === 16) {
    const half = quoteTournamentPot(entryFee, 8)
    const entry = half.entryCredits
    const pot = entry * 16
    const platformCut = Math.floor((pot * 2000) / 10_000) // 20% platform for large field display
    // Keep 80% prize like standard
    const prizeCut = Math.floor((pot * 8000) / 10_000)
    return {
      entryFee: entry,
      entryCredits: entry,
      pot,
      platformCut: pot - prizeCut,
      winnerPayout: prizeCut,
      players: 16,
    }
  }
  const q = quoteTournamentPot(entryFee, size as SharedTourneySize)
  return {
    entryFee: q.entryCredits,
    entryCredits: q.entryCredits,
    pot: q.pot,
    platformCut: q.platformCut,
    winnerPayout: q.winnerPayout,
    players: q.players,
  }
}

const CIV_FILL_TAGS = [
  'Iron League',
  'Void Court',
  'Crown Holds',
  'Ashen March',
  'Riddle Freeholds',
  'Storm Banner',
  'Goldleaf Pact',
  'Obsidian Ring',
]

/** Build empty bracket + you seat; rest handles / civ / CPU. Entry not locked yet. */
export function createTournamentSetup(
  you: Fighter,
  size: TourneySizeExt,
  entryFee: number,
  handleFills: string[] = [],
  opts: TournamentSetupOpts = {},
): Tournament {
  const q = quoteTournament(size, entryFee)
  const theme = opts.theme || 'open'
  const seats: TourneySeat[] = []
  seats.push({
    id: seatId(),
    label: opts.hostHandle ? `@${opts.hostHandle.replace(/^@/, '')}` : 'You',
    fighter: you,
    kind: 'you',
    eliminated: false,
    image: you.image,
    civTag: theme === 'civ' ? opts.civTags?.[0] || 'Your Civ' : undefined,
  })
  for (let i = 1; i < size; i++) {
    const h = handleFills[i - 1]
    if (h && h.trim()) {
      const raw = h.trim()
      const isCiv = theme === 'civ' || raw.toLowerCase().startsWith('civ:')
      const label = raw.replace(/^civ:/i, '').replace(/^@/, '')
      const fh = fighterFromHandle(label)
      seats.push({
        id: seatId(),
        label: isCiv ? label : `@${label}`,
        fighter: fh,
        kind: isCiv ? 'civ' : 'handle',
        eliminated: false,
        civTag: isCiv
          ? label
          : theme === 'mixed'
            ? CIV_FILL_TAGS[i % CIV_FILL_TAGS.length]
            : undefined,
        image: fh.image,
      })
    } else {
      const diff =
        i % 4 === 1 ? 'easy' : i % 4 === 2 ? 'medium' : i % 4 === 3 ? 'hard' : 'expert'
      const civName = CIV_FILL_TAGS[i % CIV_FILL_TAGS.length]!
      const f = cpuFromOwned(
        you,
        diff as 'easy' | 'medium' | 'hard' | 'expert',
        theme === 'civ' ? `${civName} Champ` : theme === 'nft' ? `NFT Rival ${i}` : `CPU ${i}`,
      )
      seats.push({
        id: seatId(),
        label: f.name,
        fighter: { ...f, id: `cpu-t-${i}-${you.nftId || you.id}` },
        kind: theme === 'civ' ? 'civ' : theme === 'nft' ? 'nft' : 'cpu',
        eliminated: false,
        civTag: theme === 'civ' || theme === 'mixed' ? civName : undefined,
        image: f.image || you.image,
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
  const youIdx = seats.findIndex((s) => s.kind === 'you')
  if (youIdx > 0) {
    const t = seats[0]!
    seats[0] = seats[youIdx]!
    seats[youIdx] = t
  }

  const bracket = buildBracket(seats, size)
  const name =
    opts.name?.trim() ||
    (theme === 'civ'
      ? 'Civ Banner Cup'
      : theme === 'nft'
        ? 'NFT Invitational'
        : theme === 'mixed'
          ? 'Realm Mixed Open'
          : `${size}-Player Cup`)

  return {
    id: `t_${Date.now().toString(36)}`,
    name,
    description: opts.description,
    theme,
    size,
    entryFee: q.entryFee,
    entryCredits: q.entryCredits,
    pot: q.pot,
    platformCut: q.platformCut,
    winnerPayout: q.winnerPayout,
    seats,
    bracket,
    currentMatchId: bracket.find((m) => m.round === 1)?.id || null,
    championId: null,
    status: opts.startsAt && Date.parse(opts.startsAt) > Date.now() ? 'registration' : 'setup',
    createdAt: new Date().toISOString(),
    startsAt: opts.startsAt || null,
    registrationEnds: opts.registrationEnds || null,
    civTags: opts.civTags || (theme === 'civ' ? CIV_FILL_TAGS.slice(0, 4) : undefined),
    hostAddress: opts.hostAddress,
    hostHandle: opts.hostHandle,
  }
}

function buildBracket(seats: TourneySeat[], size: TourneySizeExt): TourneyMatch[] {
  const matches: TourneyMatch[] = []
  const rounds = Math.log2(size)
  for (let i = 0; i < size / 2; i++) {
    const a = seats[i * 2]?.id || null
    const b = seats[i * 2 + 1]?.id || null
    matches.push({
      id: matchId(1, i),
      round: 1,
      a,
      b,
      winnerId: null,
      label: `R1 · M${i + 1}`,
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
        label:
          r === rounds
            ? 'Final'
            : r === rounds - 1
              ? `Semi ${i + 1}`
              : `R${r} · M${i + 1}`,
      })
    }
  }
  return matches
}

export function formatTourneyWhen(t: Tournament): string {
  if (!t.startsAt) return 'Starts when you lock entry'
  try {
    return new Date(t.startsAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Scheduled'
  }
}

export function tourneyShareUrl(t: Tournament): string {
  const u = new URL(SUITE.fighter)
  u.searchParams.set('mode', 'tournament')
  u.searchParams.set('tid', t.id)
  if (t.theme === 'civ') u.searchParams.set('from', 'civ')
  return u.toString()
}

export function civTourneyInviteUrl(t: Tournament): string {
  const u = new URL(SUITE.civ)
  u.searchParams.set('action', 'tournament')
  u.searchParams.set('tid', t.id)
  u.searchParams.set('fight', tourneyShareUrl(t))
  u.searchParams.set('entry', String(t.entryCredits))
  u.searchParams.set('name', t.name)
  return u.toString()
}

export function roundsInTourney(size: TourneySizeExt): number {
  return Math.round(Math.log2(size))
}

export function matchesByRound(t: Tournament): Map<number, TourneyMatch[]> {
  const m = new Map<number, TourneyMatch[]>()
  for (const match of t.bracket) {
    const list = m.get(match.round) || []
    list.push(match)
    m.set(match.round, list)
  }
  return m
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
  return normalizeEntryCredits(t)
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
    const t = JSON.parse(raw) as Tournament
    // Migrate legacy entryFee-only saves → entryCredits SSOT
    const entry = normalizeEntryCredits(t)
    return {
      ...t,
      name: t.name || `${t.size || 4}-Player Cup`,
      theme: t.theme || 'open',
      size: (t.size === 16 || t.size === 8 || t.size === 4 ? t.size : 4) as TourneySizeExt,
      entryFee: entry,
      entryCredits: entry,
      status: t.status || 'setup',
    }
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
export function potLine(entryFee: number, size: TourneySizeExt): string {
  const q = quoteTournament(size, entryFee)
  void quoteWagerCredits
  return `Entry ${q.entryFee} cr × ${q.players} → pot ${q.pot} · prize ${q.winnerPayout} cr · cut ${q.platformCut}`
}
