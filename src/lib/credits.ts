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
 */

export const SUITE_CREDITS_LS_KEY = 'riddle_dev_entitlement_v1'
export const SUITE_CREDITS_COOKIE = 'rdl_dev'
export const CREDITS_CHANGED_EVENT = 'riddle-credits-changed'
/** Match wallet product-credits: 100 credits = $1 */
export const USD_PER_CREDIT = 0.01

/** Platform cut on pot (basis points). 1000 = 10% — same product lock as World wagers. */
export const WAGER_FEE_BPS = 1000
export const MIN_WAGER_CREDITS = 1

/** Fixed battle entry fee (each side). Winner pot = entry × 2 (full pot, no cut). */
export const BATTLE_ENTRY_FEE = 10
/** Winner receives own stake back + opponent stake. */
export const BATTLE_WIN_POT = BATTLE_ENTRY_FEE * 2
/** Default tournament entry fee. */
export const TOURNAMENT_ENTRY_FEE = 25
/** Tournament prize share of total entries (basis points). 8000 = 80%. */
export const TOURNAMENT_PRIZE_BPS = 8000

const TX_LOG_KEY = 'riddle_fighter_credit_tx_v1'
const TX_LOG_CAP = 80

type Entitlement = {
  plan?: string
  credits: number
  lastGrantAt?: string | null
  expiresAt?: string | null
  lastPaymentTx?: string
  updatedAt?: string
  [key: string]: unknown
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function isSuiteHost(hostname = isBrowser() ? window.location.hostname : ''): boolean {
  return (
    hostname === 'riddlewallet.com' ||
    hostname.endsWith('.riddlewallet.com')
  )
}

function readCookie(name: string): string | null {
  if (!isBrowser()) return null
  try {
    for (const p of document.cookie.split('; ')) {
      const i = p.indexOf('=')
      if (i < 0) continue
      if (p.slice(0, i) === name) return decodeURIComponent(p.slice(i + 1))
    }
  } catch {
    /* soft */
  }
  return null
}

function writeCookie(name: string, value: string): void {
  if (!isBrowser()) return
  try {
    const domain = isSuiteHost() ? '; Domain=.riddlewallet.com' : ''
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    const v = value.length > 3500 ? value.slice(0, 3500) : value
    document.cookie =
      `${name}=${encodeURIComponent(v)}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax` +
      secure +
      domain
  } catch {
    /* soft */
  }
}

function parseEnt(raw: string | null): Entitlement | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw) as Entitlement
    if (!j || typeof j !== 'object') return null
    return {
      ...j,
      plan: String(j.plan || 'free'),
      credits: Math.max(0, Math.floor(Number(j.credits) || 0)),
      updatedAt: j.updatedAt || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/** Read-only load of existing suite entitlement (never creates free balance). */
function loadEntitlement(): Entitlement {
  if (!isBrowser()) {
    return { plan: 'free', credits: 0, updatedAt: new Date().toISOString() }
  }
  let local: Entitlement | null = null
  let cookie: Entitlement | null = null
  try {
    local = parseEnt(localStorage.getItem(SUITE_CREDITS_LS_KEY))
  } catch {
    /* soft */
  }
  cookie = parseEnt(readCookie(SUITE_CREDITS_COOKIE))
  // legacy key hydrate (wallet path)
  if (!local && !cookie) {
    try {
      local = parseEnt(localStorage.getItem('riddle_dev_entitlement'))
    } catch {
      /* soft */
    }
  }
  if (local && cookie) {
    const ta = Date.parse(String(local.updatedAt || 0)) || 0
    const tb = Date.parse(String(cookie.updatedAt || 0)) || 0
    return tb > ta ? cookie : local
  }
  return (
    local ||
    cookie || {
      plan: 'free',
      credits: 0,
      updatedAt: new Date().toISOString(),
    }
  )
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
 * Dual-write same shape Wallet/Dev use. Preserves plan + extra fields.
 * Called from battle entry / wager / tournament / mint spend.
 */
function mutateCredits(delta: number, reason: string, ref?: string): boolean {
  if (!isBrowser()) return false
  const cur = loadEntitlement()
  const nextBal = Math.max(0, Math.floor(cur.credits + delta))
  if (delta < 0 && cur.credits < -delta) return false
  const payload: Entitlement = {
    ...cur,
    credits: nextBal,
    updatedAt: new Date().toISOString(),
  }
  const raw = JSON.stringify(payload)
  try {
    localStorage.setItem(SUITE_CREDITS_LS_KEY, raw)
  } catch {
    /* soft */
  }
  writeCookie(SUITE_CREDITS_COOKIE, raw)
  const abs = Math.abs(Math.floor(delta))
  if (abs > 0 && ref) {
    recordCreditTx(delta < 0 ? 'spend' : 'earn', abs, ref, reason)
  }
  try {
    window.dispatchEvent(
      new CustomEvent(CREDITS_CHANGED_EVENT, {
        detail: {
          balance: payload.credits,
          delta,
          reason,
          source: 'riddle-fighter',
        },
      }),
    )
  } catch {
    /* soft */
  }
  return true
}

/** Live suite balance (read-only). */
export function getCredits(): number {
  return loadEntitlement().credits
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
  if (!mutateCredits(-BATTLE_ENTRY_FEE, 'fighter:battle-entry', id)) {
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
    mutateCredits(lock.winnerPayout, 'fighter:battle-pot', lock.battleId)
  }
}

/** Loser: entry already spent at lock. */
export function settleBattleLose(_lock: BattleEntryLock): void {
  /* no-op */
}

/** Draw or cancel before KO — refund locked entry. */
export function refundBattleEntry(lock: BattleEntryLock): void {
  if (lock.stakeEach > 0) {
    mutateCredits(lock.stakeEach, 'fighter:battle-refund', lock.battleId)
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
  if (!mutateCredits(-fee, 'fighter:tourney-entry', tourneyId)) {
    return { ok: false, fee, error: insufficientCreditsMessage(fee, 'tournament entry') }
  }
  return { ok: true, fee }
}

/** Champion prize payout (earn). */
export function settleTournamentWin(payout: number, tourneyId: string): void {
  const n = Math.max(0, Math.floor(Number(payout) || 0))
  if (n > 0) mutateCredits(n, 'fighter:tourney-prize', tourneyId)
}

/** Credit prices for open mint on Fighter (match World product). */
export const MINT_PRICE_BASIC_HUMAN_EXTRA = 150
export const MINT_PRICE_REBORN = 200

export function subscribeCredits(cb: (balance: number) => void): () => void {
  if (!isBrowser()) return () => {}
  const handler = () => cb(getCredits())
  window.addEventListener(CREDITS_CHANGED_EVENT, handler)
  window.addEventListener('storage', handler)
  window.addEventListener('focus', handler)
  document.addEventListener('visibilitychange', handler)
  return () => {
    window.removeEventListener(CREDITS_CHANGED_EVENT, handler)
    window.removeEventListener('storage', handler)
    window.removeEventListener('focus', handler)
    document.removeEventListener('visibilitychange', handler)
  }
}

export type WagerQuote = {
  stakeEach: number
  pot: number
  platformCut: number
  winnerPayout: number
  feeBps: number
}

/** Credits-only wager quote. stake each side → pot 2W · 10% platform cut. */
export function quoteWagerCredits(stakeEach: number): WagerQuote {
  const stake = Math.max(0, Math.floor(Number(stakeEach) || 0))
  const pot = stake * 2
  const platformCut = Math.floor((pot * WAGER_FEE_BPS) / 10_000)
  const winnerPayout = pot - platformCut
  return { stakeEach: stake, pot, platformCut, winnerPayout, feeBps: WAGER_FEE_BPS }
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
  if (!mutateCredits(-quote.stakeEach, 'fighter:wager-lock', txRef)) {
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
    mutateCredits(quote.winnerPayout, 'fighter:wager-win', ref || 'wager-win')
  }
}

/** Loser: stake already spent at lock — no further mutation. */
export function settleWagerLose(_quote: WagerQuote): void {
  /* no-op — existing ledger already debited at lock */
}

/** Refund lock if match cancelled before start (forfeit before KO). */
export function refundWagerLock(quote: WagerQuote, ref?: string): void {
  if (quote.stakeEach > 0) {
    mutateCredits(quote.stakeEach, 'fighter:wager-refund', ref || 'wager-refund')
  }
}

export function formatCredits(n: number): string {
  return `${Math.max(0, Math.floor(n))} cr`
}

export function creditsToUsd(n: number): string {
  return `$${(Math.max(0, n) * USD_PER_CREDIT).toFixed(2)}`
}
