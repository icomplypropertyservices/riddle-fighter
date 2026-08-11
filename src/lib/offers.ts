/**
 * Fight offers — propose a fight with your NFT + suite-credit wager.
 * Supports immediate or scheduled starts, @handle / Civ targets.
 * Shareable via ?offer=…&o=… URL. Stored in localStorage (suite host).
 */

import type { Fighter } from './fighters'
import { SUITE } from './suite'

const OFFERS_KEY = 'riddle_fighter_offers_v1'
const INBOX_KEY = 'riddle_fighter_offer_inbox_v1'

export type FightStartMode = 'immediate' | 'scheduled'
export type FightTargetKind = 'open' | 'handle' | 'civ'

export type FightOffer = {
  id: string
  createdAt: string
  status: 'open' | 'accepted' | 'declined' | 'done' | 'cancelled' | 'scheduled'
  /** Challenger */
  fromLabel: string
  fromAddress?: string
  challenger: Fighter
  /** Optional target handle / address / civ */
  toHandle?: string
  toAddress?: string
  targetKind?: FightTargetKind
  /** Stake each side in suite credits (0 = free) */
  stakeCredits: number
  /** Challenger already locked stake in suite ledger */
  challengerWagerLocked?: boolean
  roundsToWin: number
  message?: string
  /** immediate = fight on accept · scheduled = wait until scheduledAt */
  startMode?: FightStartMode
  /** ISO time when scheduled fight may begin (null/omit = now) */
  scheduledAt?: string | null
  /** When accepted — opponent fighter */
  opponent?: Fighter
  acceptedAt?: string
  /** Suite credit lock refs */
  wagerRef?: string
}

function loadAll(): FightOffer[] {
  try {
    const raw = localStorage.getItem(OFFERS_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as FightOffer[]
    return Array.isArray(j) ? j : []
  } catch {
    return []
  }
}

function saveAll(list: FightOffer[]): void {
  try {
    localStorage.setItem(OFFERS_KEY, JSON.stringify(list.slice(0, 40)))
  } catch {
    /* soft */
  }
}

function persistInbox(offer: FightOffer): void {
  try {
    localStorage.setItem(`${INBOX_KEY}_${offer.id}`, JSON.stringify(offer))
  } catch {
    /* soft */
  }
}

export function listOffers(): FightOffer[] {
  return loadAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export function getOffer(id: string): FightOffer | null {
  return loadAll().find((o) => o.id === id) || null
}

export function createFightOffer(opts: {
  challenger: Fighter
  fromLabel?: string
  fromAddress?: string
  toHandle?: string
  toAddress?: string
  targetKind?: FightTargetKind
  stakeCredits?: number
  roundsToWin?: number
  message?: string
  startMode?: FightStartMode
  scheduledAt?: string | null
  challengerWagerLocked?: boolean
  wagerRef?: string
}): FightOffer {
  const startMode = opts.startMode || 'immediate'
  let scheduledAt = opts.scheduledAt || null
  if (startMode === 'immediate') scheduledAt = null
  if (startMode === 'scheduled' && scheduledAt) {
    const t = Date.parse(scheduledAt)
    if (!Number.isFinite(t) || t < Date.now() - 60_000) {
      // default +15 min if invalid past
      scheduledAt = new Date(Date.now() + 15 * 60_000).toISOString()
    }
  }

  const offer: FightOffer = {
    id: `off_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    status: startMode === 'scheduled' ? 'scheduled' : 'open',
    fromLabel: opts.fromLabel || 'Challenger',
    fromAddress: opts.fromAddress,
    challenger: opts.challenger,
    toHandle: opts.toHandle?.replace(/^@/, '') || undefined,
    toAddress: opts.toAddress,
    targetKind: opts.targetKind || (opts.toHandle ? 'handle' : 'open'),
    stakeCredits: Math.max(0, Math.floor(Number(opts.stakeCredits) || 0)),
    challengerWagerLocked: Boolean(opts.challengerWagerLocked),
    wagerRef: opts.wagerRef,
    roundsToWin: Math.max(1, Math.min(5, opts.roundsToWin ?? 2)),
    message: opts.message?.slice(0, 160),
    startMode,
    scheduledAt,
  }
  const all = loadAll()
  all.unshift(offer)
  saveAll(all)
  persistInbox(offer)
  return offer
}

export function cancelOffer(id: string): FightOffer | null {
  let found: FightOffer | null = null
  const all = loadAll().map((o) => {
    if (o.id === id && (o.status === 'open' || o.status === 'scheduled')) {
      found = { ...o, status: 'cancelled' as const }
      return found
    }
    return o
  })
  saveAll(all)
  if (found) persistInbox(found)
  return found
}

export function acceptOffer(
  id: string,
  opponent: Fighter,
  opts?: { toAddress?: string },
): FightOffer | null {
  const all = loadAll()
  const i = all.findIndex((o) => o.id === id)
  let offer = i >= 0 ? all[i]! : readOfferPayload(id)
  if (!offer || (offer.status !== 'open' && offer.status !== 'scheduled')) {
    return null
  }
  // Scheduled: only accept/start when time reached (or allow accept early but status stays scheduled)
  offer = {
    ...offer,
    status: 'accepted',
    opponent,
    toAddress: opts?.toAddress,
    acceptedAt: new Date().toISOString(),
  }
  if (i >= 0) {
    all[i] = offer
    saveAll(all)
  } else {
    all.unshift(offer)
    saveAll(all)
  }
  persistInbox(offer)
  return offer
}

export function markOfferDone(id: string): void {
  const all = loadAll().map((o) =>
    o.id === id ? { ...o, status: 'done' as const } : o,
  )
  saveAll(all)
}

/** True when offer can start a fight right now (immediate or schedule due). */
export function offerCanFightNow(offer: FightOffer): boolean {
  if (offer.startMode !== 'scheduled' || !offer.scheduledAt) return true
  const t = Date.parse(offer.scheduledAt)
  if (!Number.isFinite(t)) return true
  return Date.now() >= t - 5_000 // 5s early grace
}

export function offerWaitMs(offer: FightOffer): number {
  if (offer.startMode !== 'scheduled' || !offer.scheduledAt) return 0
  const t = Date.parse(offer.scheduledAt)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, t - Date.now())
}

/** Compact share URL with base64 offer blob (works cross-device without server). */
export function offerShareUrl(offer: FightOffer, opts?: { forCiv?: boolean }): string {
  try {
    const compact = {
      id: offer.id,
      createdAt: offer.createdAt,
      status: offer.status,
      fromLabel: offer.fromLabel,
      fromAddress: offer.fromAddress,
      challenger: {
        id: offer.challenger.id,
        name: offer.challenger.name,
        image: offer.challenger.image,
        color: offer.challenger.color,
        color2: offer.challenger.color2,
        stats: offer.challenger.stats,
        specialName: offer.challenger.specialName,
        wins: offer.challenger.wins,
        losses: offer.challenger.losses,
        source: offer.challenger.source,
        nftId: offer.challenger.nftId,
        traits: offer.challenger.traits,
        powerLevel: offer.challenger.powerLevel,
      },
      toHandle: offer.toHandle,
      targetKind: offer.targetKind,
      stakeCredits: offer.stakeCredits,
      challengerWagerLocked: offer.challengerWagerLocked,
      roundsToWin: offer.roundsToWin,
      message: offer.message,
      startMode: offer.startMode,
      scheduledAt: offer.scheduledAt,
      wagerRef: offer.wagerRef,
    }
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(compact))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
    const base = opts?.forCiv ? SUITE.civ : SUITE.fighter
    const u = new URL(base)
    if (opts?.forCiv) {
      u.searchParams.set('action', 'fight_challenge')
      u.searchParams.set('fighter_offer', offer.id)
      u.searchParams.set('fight', `${SUITE.fighter}?offer=${offer.id}&o=${b64}`)
    } else {
      u.searchParams.set('offer', offer.id)
      u.searchParams.set('o', b64)
      u.searchParams.set('mode', 'offer')
    }
    return u.toString()
  } catch {
    return `${SUITE.fighter}?offer=${offer.id}&mode=offer`
  }
}

/** Deep link for Civilisations to open this challenge on Fighter. */
export function civChallengeUrl(offer: FightOffer): string {
  return offerShareUrl(offer, { forCiv: true })
}

/** Fighter URL that Civ / Social can open for an immediate challenge. */
export function fighterChallengeUrl(opts: {
  nftId?: string
  owner?: string
  stake?: number
  handle?: string
  immediate?: boolean
}): string {
  const u = new URL(SUITE.fighter)
  u.searchParams.set('mode', 'offer')
  u.searchParams.set('from', 'civ')
  if (opts.nftId) u.searchParams.set('nftId', opts.nftId)
  if (opts.owner) u.searchParams.set('owner', opts.owner)
  if (opts.handle) u.searchParams.set('challenge', opts.handle.replace(/^@/, ''))
  if (opts.stake && opts.stake > 0) u.searchParams.set('stake', String(opts.stake))
  if (opts.immediate !== false) u.searchParams.set('immediate', '1')
  return u.toString()
}

export function readOfferPayload(id?: string | null): FightOffer | null {
  try {
    const q = new URLSearchParams(window.location.search)
    const b64 = q.get('o')
    if (b64) {
      const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
      const json = decodeURIComponent(
        escape(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad)),
      )
      const o = JSON.parse(json) as FightOffer
      if (o?.challenger?.id) {
        o.status = o.status || 'open'
        return o
      }
    }
  } catch {
    /* soft */
  }
  if (id) {
    try {
      const raw = localStorage.getItem(`${INBOX_KEY}_${id}`)
      if (raw) return JSON.parse(raw) as FightOffer
    } catch {
      /* soft */
    }
    return getOffer(id)
  }
  return null
}

export function parseOfferFromUrl(): FightOffer | null {
  try {
    const q = new URLSearchParams(window.location.search)
    const id = q.get('offer') || q.get('fighter_offer')
    return readOfferPayload(id)
  } catch {
    return null
  }
}

export function formatScheduleLabel(offer: FightOffer): string {
  if (offer.startMode !== 'scheduled' || !offer.scheduledAt) return 'Immediate'
  try {
    const d = new Date(offer.scheduledAt)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Scheduled'
  }
}
