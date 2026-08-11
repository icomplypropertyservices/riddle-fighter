/**
 * Log EVERY wager/entry settlement to:
 *  1) Fighter localStorage wager ledger
 *  2) Fighter /api/fighter settle action (Neon when DATABASE_URL set)
 *  3) Civilisation arena (local + /api/arena when available)
 *
 * G10 single XP path:
 *  - XP / W-L / NFT card toast live ONLY in settleMatch → recordMatchProgress
 *  - This module must NEVER import or call recordMatchProgress (double XP)
 *  - API action is always "settle" (ledger/meta only), never "match"
 */

import { WAGER_FEE_BPS } from '@riddle/suite-game-economy'
import { SUITE } from './suite'

const LS_KEY = 'rf_wager_ledger_v1'
const LS_CAP = 80

export type WagerSettleLog = {
  id: string
  at: string
  battleId?: string
  nftId: string
  nftName?: string
  ownerAddress?: string
  opponent: string
  opponentNftId?: string
  mode: string
  won: boolean
  stakeCredits: number
  entryCredits: number
  potCredits: number
  platformCut: number
  payoutCredits: number
  kind: 'wager' | 'entry' | 'tournament' | 'mixed'
}

function loadLocal(): WagerSettleLog[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as WagerSettleLog[]
    return Array.isArray(j) ? j : []
  } catch {
    return []
  }
}

function saveLocal(rows: WagerSettleLog[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows.slice(0, LS_CAP)))
  } catch {
    /* soft */
  }
}

export function listWagerSettles(): WagerSettleLog[] {
  return loadLocal()
}

/**
 * Call after settleWagerWin / settleBattleWin / tourney prize.
 * Idempotent soft-log — never throws.
 */
export async function logWagerSettlement(opts: {
  won: boolean
  nftId: string
  nftName?: string
  ownerAddress?: string
  opponent: string
  opponentNftId?: string
  mode: string
  stakeCredits?: number
  entryCredits?: number
  potCredits?: number
  platformCut?: number
  payoutCredits?: number
  battleId?: string
  kind?: WagerSettleLog['kind']
  /** Stable id for ledger de-dupe (prefer ws_${matchId} from settleMatch). */
  id?: string
}): Promise<{ ok: boolean; log: WagerSettleLog; deduped?: boolean }> {
  const stake = Math.max(0, Math.floor(Number(opts.stakeCredits) || 0))
  const entry = Math.max(0, Math.floor(Number(opts.entryCredits) || 0))
  const payout = Math.max(0, Math.floor(Number(opts.payoutCredits) || 0))
  const pot =
    Math.max(0, Math.floor(Number(opts.potCredits) || 0)) ||
    (stake > 0 ? stake * 2 : entry * 2)
  const cut = Math.max(
    0,
    Math.floor(
      Number(opts.platformCut) ||
        (stake > 0 ? Math.floor((pot * WAGER_FEE_BPS) / 10_000) : 0),
    ),
  )
  const logId =
    String(opts.id || '').trim() ||
    `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const log: WagerSettleLog = {
    id: logId,
    at: new Date().toISOString(),
    battleId: opts.battleId,
    nftId: String(opts.nftId || '').trim(),
    nftName: opts.nftName,
    ownerAddress: opts.ownerAddress,
    opponent: opts.opponent || 'Rival',
    opponentNftId: opts.opponentNftId,
    mode: opts.mode || 'cpu',
    won: Boolean(opts.won),
    stakeCredits: stake,
    entryCredits: entry,
    potCredits: pot,
    platformCut: cut,
    payoutCredits: payout,
    kind:
      opts.kind ||
      (opts.mode === 'tournament'
        ? 'tournament'
        : stake > 0 && entry > 0
          ? 'mixed'
          : stake > 0
            ? 'wager'
            : 'entry'),
  }

  // 1) Local fighter ledger (de-dupe by id)
  const prev = loadLocal()
  if (prev.some((r) => r.id === log.id)) {
    return { ok: true, log: prev.find((r) => r.id === log.id) || log, deduped: true }
  }
  saveLocal([log, ...prev])

  // 2) Fighter DB API — action "settle" only (no XP; never "match")
  try {
    await fetch('/api/fighter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'settle',
        id: log.id,
        battleId: log.battleId,
        nftId: log.nftId,
        ownerAddress: log.ownerAddress,
        opponent: log.opponent,
        opponentNftId: log.opponentNftId,
        mode: log.mode,
        won: log.won,
        stakeCredits: log.stakeCredits,
        entryCredits: log.entryCredits,
        potCredits: log.potCredits,
        platformCut: log.platformCut,
        payoutCredits: log.payoutCredits,
        kind: log.kind,
        meta: {
          nftName: log.nftName,
          at: log.at,
        },
      }),
    })
  } catch {
    /* soft */
  }

  // 3) Civilisation arena — public board only (no fighter XP / W-L)
  void logToCivilisationArena(log)

  return { ok: true, log }
}

async function logToCivilisationArena(log: WagerSettleLog): Promise<void> {
  const settledWager = {
    id: `fighter_${log.id}`,
    title: `${log.nftName || log.nftId.slice(0, 8)} vs ${log.opponent}`,
    game: 'fighter' as const,
    status: 'settled' as const,
    stakeCredits: log.stakeCredits || log.entryCredits,
    potCredits: log.potCredits,
    creatorWallet: log.ownerAddress || '',
    creatorCiv: 'Fighter',
    sideA: log.nftName || log.nftId.slice(0, 10),
    sideB: log.opponent,
    betsA: log.ownerAddress
      ? [{ wallet: log.ownerAddress, amount: log.stakeCredits || log.entryCredits }]
      : [],
    betsB: [],
    winner: log.won ? ('A' as const) : ('B' as const),
    createdAt: log.at,
    settlesAt: log.at,
    source: 'riddle-fighter',
    battleId: log.battleId,
    nftId: log.nftId,
    payoutCredits: log.payoutCredits,
    platformCut: log.platformCut,
  }

  // Local civ storage if same browser visited civ
  try {
    const KEY = 'civ_game_arena_v1'
    const raw = localStorage.getItem(KEY)
    const store = raw
      ? (JSON.parse(raw) as { tournaments?: unknown[]; wagers?: unknown[] })
      : { tournaments: [], wagers: [] }
    const wagers = Array.isArray(store.wagers) ? store.wagers : []
    // de-dupe by id
    const next = [
      settledWager,
      ...wagers.filter((w) => (w as { id?: string }).id !== settledWager.id),
    ].slice(0, 100)
    localStorage.setItem(
      KEY,
      JSON.stringify({
        tournaments: store.tournaments || [],
        wagers: next,
      }),
    )
  } catch {
    /* soft */
  }

  // Remote civ arena — merge with GET then POST
  try {
    const civBase = SUITE.civ || 'https://civ.riddlewallet.com'
    const getRes = await fetch(`${civBase}/api/arena`, {
      credentials: 'omit',
      mode: 'cors',
    })
    let tournaments: unknown[] = []
    let wagers: unknown[] = []
    if (getRes.ok) {
      const data = (await getRes.json()) as {
        tournaments?: unknown[]
        wagers?: unknown[]
      }
      tournaments = Array.isArray(data.tournaments) ? data.tournaments : []
      wagers = Array.isArray(data.wagers) ? data.wagers : []
    }
    const merged = [
      settledWager,
      ...wagers.filter((w) => (w as { id?: string }).id !== settledWager.id),
    ].slice(0, 120)
    await fetch(`${civBase}/api/arena`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      mode: 'cors',
      body: JSON.stringify({ tournaments, wagers: merged }),
    })
  } catch {
    /* soft — CORS or offline */
  }
}
