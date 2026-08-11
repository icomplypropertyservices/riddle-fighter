/**
 * Single-path match settlement used by finishMatch.
 *
 * One entry point for:
 *  1) suite credits (battle entry + optional wager)
 *  2) local fighter W/L bump
 *  3) NFT fight history + public card
 *  4) wager/entry ledger log (DB + civ)
 *  5) match progress / XP — exactly once (G10 single-path)
 *  6) fun meta + scorebook + result copy
 *
 * App.tsx only applies React state from SettleMatchResult.
 * Double-submit: idempotency key (battleId / matchId) + in-module consume set.
 */

import {
  settleBattleLose,
  settleBattleWin,
  settleWagerLose,
  settleWagerWin,
  type BattleEntryLock,
  type WagerQuote,
} from './credits'
import { bumpFighterRecord, type Fighter } from './fighters'
import { loadLocalProgress, recordMatchProgress } from './fighterProgress'
import {
  comboFlavor,
  fightWinLine,
  loadFunMeta,
  recordFunMatch,
  streakFlavor,
  type FunMeta,
} from './fun'
import { publishNftCard, recordNftFight } from './nftFightHistory'
import { loadScores, recordMatch, type PlayerScore } from './scores'
import { logWagerSettlement } from './wagerLedger'

export type FinishMatchMode = 'cpu' | 'pvp' | 'handle' | 'online' | 'tournament'
export type ScoreMode = 'cpu' | 'pvp' | 'handle'

/** In-memory consume set — same tab / HMR session. */
const consumedSettlementKeys = new Set<string>()
const CONSUMED_CAP = 80

function markConsumed(key: string): boolean {
  const k = String(key || '').trim()
  if (!k) return false
  if (consumedSettlementKeys.has(k)) return true
  consumedSettlementKeys.add(k)
  if (consumedSettlementKeys.size > CONSUMED_CAP) {
    const first = consumedSettlementKeys.values().next().value
    if (first) consumedSettlementKeys.delete(first)
  }
  return false
}

/** True if this settlement key already ran side-effects this session. */
export function wasSettlementConsumed(key: string): boolean {
  return consumedSettlementKeys.has(String(key || '').trim())
}

/** Test / recovery helper — does not clear server or localStorage match ids. */
export function clearSettlementConsumeGuard(): void {
  consumedSettlementKeys.clear()
}

export function makeMatchId(input: {
  matchId?: string
  entryLock?: BattleEntryLock | null
  selectedId?: string
  mode?: string
  opponentName?: string
}): string {
  if (input.matchId && String(input.matchId).trim()) return String(input.matchId).trim()
  if (input.entryLock?.battleId) return `m_${input.entryLock.battleId}`
  const sel = (input.selectedId || 'nof').slice(0, 12)
  const mode = input.mode || 'cpu'
  const opp = String(input.opponentName || 'opp')
    .replace(/\s+/g, '_')
    .slice(0, 16)
  return `m_${mode}_${sel}_${opp}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** Map arena/play mode → scorebook mode (tournament & online count as pvp). */
export function toScoreMode(mode: FinishMatchMode): ScoreMode {
  if (mode === 'online' || mode === 'pvp' || mode === 'tournament') return 'pvp'
  if (mode === 'handle') return 'handle'
  return 'cpu'
}

/** Fighter fields settlement needs (avoids pulling full App state). */
export type SettleMatchFighter = Pick<
  Fighter,
  | 'id'
  | 'name'
  | 'nftId'
  | 'image'
  | 'originalImage'
  | 'newImage'
  | 'collection'
  | 'category'
  | 'categoryLabel'
  | 'taxon'
  | 'issuer'
  | 'color'
  | 'color2'
  | 'specialName'
  | 'traits'
>

export type SettleMatchOpponent = {
  id?: string
  nftId?: string
  name?: string
} | null

export type SettleMatchInput = {
  won: boolean
  opponentName: string
  quote: WagerQuote | null
  mode: FinishMatchMode
  extraNote?: string
  maxCombo?: number
  entryLock?: BattleEntryLock | null
  /** Prize already paid (e.g. tournament champion) — counted in payout, not re-settled. */
  alreadyGrantedPayout?: number
  selected?: SettleMatchFighter | null
  opponent?: SettleMatchOpponent
  walletAddr?: string | null
  /**
   * Optional stable idempotency key. Defaults to battleId-derived match id.
   * Re-settle with same key is a no-op for credits + XP (G10 double-submit guard).
   */
  matchId?: string
}

export type ProgressUiUpdate = {
  wins: number
  losses: number
  level: number
  xp: number
  xpGained: number
  powerLevel: number
  toast: string
}

export type SettleMatchResult = {
  payout: number
  entryStake: number
  wagerStake: number
  totalWager: number
  scoreMode: ScoreMode
  fun: FunMeta
  scores: PlayerScore
  resultLine: string
  resultNote: string
  playWinSfx: boolean
  /** Stable idempotency key used for this settlement. */
  matchId: string
  /** True when side-effects were skipped (already settled). */
  alreadySettled: boolean
  /**
   * Single XP/progress path. Resolves null when no selected fighter.
   * Callers await for toast + W/L UI only — never call recordMatchProgress again.
   */
  progress: Promise<ProgressUiUpdate | null>
}

function progressToastFromLocal(
  selected: SettleMatchFighter,
  won: boolean,
): Promise<ProgressUiUpdate | null> {
  const nid = selected.nftId || selected.id.replace(/^nft-/, '')
  const nftKey = nid || selected.id
  const p = loadLocalProgress(nftKey)
  const powerLevel = p.level * 10 + Math.floor(p.xp / 10)
  return Promise.resolve({
    wins: p.wins,
    losses: p.losses,
    level: p.level,
    xp: p.xp,
    xpGained: 0,
    powerLevel,
    toast: won
      ? `WIN · already settled · L${p.level} · ${p.wins}-${p.losses}`
      : `LOSS · already settled · L${p.level} · ${p.wins}-${p.losses}`,
  })
}

/**
 * Settle a finished match. Side-effects: credits, local storage, soft network logs.
 * Returns data for App to setResult / setScores / setFunMeta / setScreen.
 * Idempotent on matchId / battleId within the tab session; XP also deduped in
 * recordMatchProgress + /api/fighter match log.
 */
export function settleMatch(input: SettleMatchInput): SettleMatchResult {
  const {
    won,
    opponentName,
    quote,
    mode,
    extraNote,
    selected,
    opponent,
    walletAddr,
  } = input
  const maxCombo = Math.max(0, Math.floor(Number(input.maxCombo) || 0))
  const lock = input.entryLock ?? null
  let payout = Math.max(0, Math.floor(Number(input.alreadyGrantedPayout) || 0))
  const matchId = makeMatchId({
    matchId: input.matchId,
    entryLock: lock,
    selectedId: selected?.id,
    mode,
    opponentName,
  })
  const scoreMode = toScoreMode(mode)
  // Only count entry that was actually locked — do not invent BATTLE_ENTRY_FEE for the ledger
  const entryStake =
    mode === 'tournament' ? 0 : Math.max(0, Math.floor(Number(lock?.stakeEach) || 0))
  const wagerStake = Math.max(0, Math.floor(Number(quote?.stakeEach) || 0))
  const totalWager = wagerStake + entryStake

  // ── Idempotency: same battle/match must not re-pay credits or re-grant XP
  const already = markConsumed(matchId)
  if (already) {
    const fun = loadFunMeta()
    const scores = loadScores()
    const resultLine = fightWinLine({
      won,
      streak: fun.winStreak,
      combo: maxCombo,
      category: selected?.category,
    })
    return {
      payout,
      entryStake,
      wagerStake,
      totalWager,
      scoreMode,
      fun,
      scores,
      resultLine,
      resultNote: [extraNote, 'already settled'].filter(Boolean).join(' · '),
      playWinSfx: false,
      matchId,
      alreadySettled: true,
      progress: selected ? progressToastFromLocal(selected, won) : Promise.resolve(null),
    }
  }

  // ── 1) Credits: battle entry pot (not tournament — entry already on tourney path)
  if (lock && mode !== 'tournament') {
    if (won) {
      settleBattleWin(lock)
      payout += lock.winnerPayout
    } else {
      settleBattleLose(lock)
    }
  }

  // ── 2) Credits: optional side wager
  if (quote) {
    if (won) {
      settleWagerWin(quote, lock?.battleId)
      payout += quote.winnerPayout
    } else {
      settleWagerLose(quote)
    }
  }

  // ── 3–5) Fighter-bound records + single progress/XP path
  let progress: Promise<ProgressUiUpdate | null> = Promise.resolve(null)

  if (selected) {
    bumpFighterRecord(selected.id, won)
    const nid = selected.nftId || selected.id.replace(/^nft-/, '')
    const nftKey = nid || selected.id

    recordNftFight(nftKey, {
      won,
      opponent: opponentName,
      mode: scoreMode,
      combo: maxCombo,
      wagerCredits: totalWager,
      payoutCredits: won ? payout : 0,
      note: comboFlavor(maxCombo) || undefined,
    })

    // Ledger / DB / civ — no XP here (G10 single path → recordMatchProgress below)
    void logWagerSettlement({
      id: `ws_${matchId}`,
      won,
      nftId: nftKey,
      nftName: selected.name,
      ownerAddress: walletAddr || undefined,
      opponent: opponentName,
      opponentNftId: opponent?.nftId || opponent?.id,
      mode: mode === 'tournament' ? 'tournament' : scoreMode,
      stakeCredits: wagerStake,
      entryCredits: entryStake,
      potCredits: (quote?.pot || 0) + (lock && mode !== 'tournament' ? lock.pot : 0),
      platformCut: quote?.platformCut || 0,
      payoutCredits: won ? payout : 0,
      battleId: lock?.battleId,
      kind:
        mode === 'tournament'
          ? 'tournament'
          : wagerStake > 0 && entryStake > 0
            ? 'mixed'
            : wagerStake > 0
              ? 'wager'
              : 'entry',
    })

    // ── 5) XP / W-L / traits — ONLY here (G10 single path)
    progress = recordMatchProgress({
      nftId: nftKey,
      ownerAddress: walletAddr || undefined,
      name: selected.name,
      image: selected.image,
      collection: selected.collection,
      traits: selected.traits as { trait_type?: string; value?: unknown }[] | undefined,
      won,
      opponent: opponentName,
      mode: scoreMode,
      combo: maxCombo,
      wagerCredits: totalWager,
      matchId,
      battleId: lock?.battleId,
      entryCredits: entryStake,
      payoutCredits: won ? payout : 0,
      opponentNftId: opponent?.nftId || opponent?.id,
    })
      .then((rp) => {
        const wl = {
          wins: rp.progress.wins,
          losses: rp.progress.losses,
        }
        publishNftCard({
          nftId: nid,
          name: selected.name,
          image: selected.image,
          originalImage: selected.originalImage || selected.image,
          newImage:
            selected.newImage &&
            selected.newImage !== (selected.originalImage || selected.image)
              ? selected.newImage
              : undefined,
          collection: selected.collection,
          categoryLabel: selected.categoryLabel,
          taxon: selected.taxon,
          issuer: selected.issuer,
          color: selected.color,
          color2: selected.color2,
          wins: wl.wins,
          losses: wl.losses,
          specialName: selected.specialName,
        })
        const xpLabel =
          rp.xpGained > 0
            ? `+${rp.xpGained} XP`
            : rp.alreadySettled
              ? 'already settled'
              : '+0 XP'
        return {
          wins: wl.wins,
          losses: wl.losses,
          level: rp.progress.level,
          xp: rp.progress.xp,
          xpGained: rp.xpGained,
          powerLevel: rp.progress.level * 10 + Math.floor(rp.progress.xp / 10),
          toast: won
            ? `WIN · ${xpLabel} · L${rp.progress.level} · ${wl.wins}-${wl.losses}`
            : `LOSS · ${xpLabel} · L${rp.progress.level} · ${wl.wins}-${wl.losses}`,
        } satisfies ProgressUiUpdate
      })
      .catch(() => null)
  }

  // ── 6) Fun meta + scorebook + result copy
  const fun = recordFunMatch({ won, comboMax: maxCombo, perfect: maxCombo >= 6 })
  const flavor = won ? streakFlavor(fun.winStreak) : ''
  const cFlavor = comboFlavor(maxCombo)
  const resultLine = fightWinLine({
    won,
    streak: fun.winStreak,
    combo: maxCombo,
    category: selected?.category,
  })
  const scores = recordMatch({
    won,
    mode: scoreMode,
    opponent: opponentName,
    fighterName: selected?.name || 'Fighter',
    wagerCredits: totalWager,
    payoutCredits: won ? payout : 0,
  })
  const resultNote = [extraNote, flavor, cFlavor, maxCombo >= 3 ? `Max combo ${maxCombo}` : '']
    .filter(Boolean)
    .join(' · ')

  return {
    payout,
    entryStake,
    wagerStake,
    totalWager,
    scoreMode,
    fun,
    scores,
    resultLine,
    resultNote,
    playWinSfx: won,
    matchId,
    alreadySettled: false,
    progress,
  }
}
