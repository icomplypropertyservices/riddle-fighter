/**
 * Suite credits — EXISTING SSOT only (Wallet / Dev / World).
 *
 * Keys (do not invent a second pool):
 *   localStorage `riddle_dev_entitlement_v1`
 *   cookie `rdl_dev` (Domain=.riddlewallet.com on suite hosts)
 * Event: `riddle-credits-changed`
 *
 * Fighter spends for battle entry, optional wagers, tournament entry.
 * Event log (local): kind spend|earn · amount · ref · at
 * No demo grants · no free spar · no XRP · no parallel ledger.
 *
 * All balance mutations go through @riddle/suite-credits so the shared
 * cookie is never truncated mid-JSON (that broke credits on Cities/Fighter).
 */

import {
  getBalance,
  spend as suiteSpend,
  grant as suiteGrant,
  subscribe,
  USD_PER_CREDIT as SUITE_USD_PER_CREDIT,
  SUITE_CREDITS_LS_KEY,
  COOKIE_SUITE_CREDITS,
  CREDITS_CHANGED_EVENT,
} from '@riddle/suite-credits'
import {
  WAGER_FEE_BPS,
  MIN_WAGER_CREDITS,
  BATTLE_ENTRY_FEE,
  BATTLE_WIN_POT,
  TOURNAMENT_ENTRY_FEE,
  TOURNAMENT_PRIZE_BPS,
  quoteWagerCredits as quoteWagerCreditsShared,
  suiteSpendTag,
  formatCredits as formatCreditsShared,
  creditsToUsd as creditsToUsdNum,
} from '@riddle/suite-game-economy'

export { SUITE_CREDITS_LS_KEY, CREDITS_CHANGED_EVENT }
export const SUITE_CREDITS_COOKIE = COOKIE_SUITE_CREDITS
/** Match wallet product-credits: 100 credits = $1 · SSOT @riddle/suite-game-economy */
export const USD_PER_CREDIT = SUITE_USD_PER_CREDIT

/** Re-export fee SSOT from @riddle/suite-game-economy (Cities/Fighter/Civ lockstep). */
export {
  WAGER_FEE_BPS,
  MIN_WAGER_CREDITS,
  BATTLE_ENTRY_FEE,
  BATTLE_WIN_POT,
  TOURNAMENT_ENTRY_FEE,
  TOURNAMENT_PRIZE_BPS,
}

const TX_LOG_KEY = 'riddle_fighter_credit_tx_v1'
const TX_LOG_CAP = 80

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

export type CreditTxKind = 'spend' | 'earn'
export type CreditTx = {
  kind: CreditTxKind
  amount: number
  ref: string
  at: number
  reason?: string
}

function readTxLog(): CreditTx[] {
  if (!isBrowser()) return []
  try {
    const raw = localStorage.getItem(TX_LOG_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as CreditTx[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeTxLog(rows: CreditTx[]): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(TX_LOG_KEY, JSON.stringify(rows.slice(-TX_LOG_CAP)))
  } catch {
    /* soft */
  }
}

/** Append a spend/earn event to the local fighter credit log. */
export function recordCreditTx(
  kind: CreditTxKind,
  amount: number,
  ref: string,
  reason?: string,
): CreditTx {
  const row: CreditTx = {
    kind,
    amount: Math.max(0, Math.floor(Number(amount) || 0)),
    ref: String(ref || ''),
    at: Date.now(),
    reason,
  }
  if (row.amount <= 0) return row
  const next = [...readTxLog(), row]
  writeTxLog(next)
  return row
}

export function listCreditTxs(): CreditTx[] {
  return readTxLog()
}

/**
 * Dual-write via @riddle/suite-credits (LS + Domain=.riddlewallet.com cookie).
 * Called from battle entry / wager / tournament / mint spend.
 */
function mutateCredits(delta: number, reason: string, ref?: string): boolean {
  if (!isBrowser()) return false
  const abs = Math.abs(Math.floor(delta))
  if (abs <= 0) return true
  const tag = ref ? `${reason}:${ref}` : reason
  if (delta < 0) {
    const ok = suiteSpend(abs, tag)
    if (ok) recordCreditTx('spend', abs, ref || reason, reason)
    return ok
  }
  suiteGrant(abs, tag)
  recordCreditTx('earn', abs, ref || reason, reason)
  return true
}

/** Live suite balance (read-only). */
export function getCredits(): number {
  return getBalance()
}

/** Spend suite credits (mint packs, etc.). Returns false if balance too low. */
export function trySpendCredits(amount: number, reason: string, ref?: string): boolean {
  const n = Math.floor(Number(amount) || 0)
  if (n <= 0) return true
  return mutateCredits(-n, reason, ref || reason)
}

/** Insufficient-balance message with current balance + top-up hint. */
export function insufficientCreditsMessage(need: number, label = 'action'): string {
  const bal = getCredits()
  return `Need ${formatCredits(need)} for ${label} · balance ${formatCredits(bal)}. Top up in Wallet.`
}

export function canAfford(amount: number): boolean {
  return getCredits() >= Math.max(0, Math.floor(Number(amount) || 0))
}

export type BattleEntryLock = {
  battleId: string
  stakeEach: number
  pot: number
  winnerPayout: number
}

/**
 * Lock fixed battle entry fee at fight start.
 * Winner later receives full pot (entry × 2); loser keeps 0; draw refunds stake.
 */
export function lockBattleEntry(battleId?: string): {
  ok: boolean
  lock: BattleEntryLock
  error?: string
} {
  const id = battleId || `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const lock: BattleEntryLock = {
    battleId: id,
    stakeEach: BATTLE_ENTRY_FEE,
    pot: BATTLE_WIN_POT,
    winnerPayout: BATTLE_WIN_POT,
  }
  if (getCredits() < BATTLE_ENTRY_FEE) {
    return {
      ok: false,
      lock,
      error: insufficientCreditsMessage(BATTLE_ENTRY_FEE, 'battle entry'),
    }
  }
  if (!mutateCredits(-BATTLE_ENTRY_FEE, suiteSpendTag('fighter', 'battle_entry'), id)) {
    return {
      ok: false,
      lock,
      error: insufficientCreditsMessage(BATTLE_ENTRY_FEE, 'battle entry'),
    }
  }
  return { ok: true, lock }
}

/** Winner pot: own stake back + opponent stake (= 20 for default 10 entry). */
export function settleBattleWin(lock: BattleEntryLock): void {
  if (lock.winnerPayout > 0) {
    mutateCredits(lock.winnerPayout, suiteSpendTag('fighter', 'battle_win'), lock.battleId)
  }
}

/** Loser: entry already spent at lock. */
export function settleBattleLose(_lock: BattleEntryLock): void {
  /* no-op */
}

/** Draw or cancel before KO — refund locked entry. */
export function refundBattleEntry(lock: BattleEntryLock): void {
  if (lock.stakeEach > 0) {
    mutateCredits(lock.stakeEach, suiteSpendTag('fighter', 'battle_refund'), lock.battleId)
  }
}

/**
 * Lock tournament entry. Prize pool = 80% of total entries (display pot uses size).
 */
export function lockTournamentEntry(
  entryFee: number,
  tourneyId: string,
): { ok: boolean; error?: string; fee: number } {
  const fee = Math.max(0, Math.floor(Number(entryFee) || 0))
  if (fee <= 0) return { ok: true, fee: 0 }
  if (getCredits() < fee) {
    return { ok: false, fee, error: insufficientCreditsMessage(fee, 'tournament entry') }
  }
  if (!mutateCredits(-fee, suiteSpendTag('fighter', 'tourney_entry'), tourneyId)) {
    return { ok: false, fee, error: insufficientCreditsMessage(fee, 'tournament entry') }
  }
  return { ok: true, fee }
}

/** Champion prize payout (earn). */
export function settleTournamentWin(payout: number, tourneyId: string): void {
  const n = Math.max(0, Math.floor(Number(payout) || 0))
  if (n > 0) mutateCredits(n, suiteSpendTag('fighter', 'tourney_prize'), tourneyId)
}

/** Credit prices for open mint on Fighter (match World product). */
export const MINT_PRICE_BASIC_HUMAN_EXTRA = 150
export const MINT_PRICE_REBORN = 200

export function subscribeCredits(cb: (balance: number) => void): () => void {
  if (!isBrowser()) return () => {}
  return subscribe(() => cb(getCredits()))
}

export type WagerQuote = {
  stakeEach: number
  pot: number
  platformCut: number
  winnerPayout: number
  feeBps: number
}

/** Credits-only wager quote. stake each side → pot 2W · 10% platform cut (SSOT). */
export function quoteWagerCredits(stakeEach: number): WagerQuote {
  return quoteWagerCreditsShared(stakeEach)
}

/**
 * Lock challenger stake from existing suite credits (wager only).
 * Fails if balance short — never invents credits.
 */
export function lockWagerStake(stakeEach: number, ref?: string): {
  ok: boolean
  quote: WagerQuote
  error?: string
} {
  const quote = quoteWagerCredits(stakeEach)
  if (quote.stakeEach < MIN_WAGER_CREDITS) {
    return { ok: false, quote, error: `Min wager ${MIN_WAGER_CREDITS} credit` }
  }
  if (getCredits() < quote.stakeEach) {
    return {
      ok: false,
      quote,
      error: insufficientCreditsMessage(quote.stakeEach, 'wager'),
    }
  }
  const txRef = ref || `wager_${Date.now().toString(36)}`
  if (!mutateCredits(-quote.stakeEach, suiteSpendTag('fighter', 'wager_lock'), txRef)) {
    return { ok: false, quote, error: insufficientCreditsMessage(quote.stakeEach, 'wager') }
  }
  return { ok: true, quote }
}

/**
 * Winner settle on suite ledger only.
 * After lock of stake W: credit winnerPayout (1.8W) so net +0.8W vs locked W
 * when opponent side is soft/CPU (same pot math as product lock).
 */
export function settleWagerWin(quote: WagerQuote, ref?: string): void {
  if (quote.winnerPayout > 0) {
    mutateCredits(quote.winnerPayout, suiteSpendTag('fighter', 'wager_win'), ref || 'wager-win')
  }
}

/** Loser: stake already spent at lock — no further mutation. */
export function settleWagerLose(_quote: WagerQuote): void {
  /* no-op — existing ledger already debited at lock */
}

/** Refund lock if match cancelled before start (forfeit before KO). */
export function refundWagerLock(quote: WagerQuote, ref?: string): void {
  if (quote.stakeEach > 0) {
    mutateCredits(quote.stakeEach, suiteSpendTag('fighter', 'wager_refund'), ref || 'wager-refund')
  }
}

export function formatCredits(n: number): string {
  return formatCreditsShared(n)
}

export function creditsToUsd(n: number): string {
  return `$${creditsToUsdNum(n).toFixed(2)}`
}
