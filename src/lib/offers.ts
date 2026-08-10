/**
 * Fight offers — propose a fight with your chosen NFT + optional credit stake.
 * Shareable via ?offer=… URL. Stored in localStorage (suite host).
 */

import type { Fighter } from './fighters'
import { SUITE } from './suite'

const OFFERS_KEY = 'riddle_fighter_offers_v1'
const INBOX_KEY = 'riddle_fighter_offer_inbox_v1'

export type FightOffer = {
  id: string
  createdAt: string
  status: 'open' | 'accepted' | 'declined' | 'done' | 'cancelled'
  /** Challenger */
  fromLabel: string
  fromAddress?: string
  challenger: Fighter
  /** Optional target handle / address */
  toHandle?: string
  toAddress?: string
  /** Stake each side in suite credits (0 = free) */
  stakeCredits: number
  roundsToWin: number
  message?: string
  /** When accepted — opponent fighter */
  opponent?: Fighter
  acceptedAt?: string
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
  stakeCredits?: number
  roundsToWin?: number
  message?: string
}): FightOffer {
  const offer: FightOffer = {
    id: `off_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    status: 'open',
    fromLabel: opts.fromLabel || 'Challenger',
    fromAddress: opts.fromAddress,
    challenger: opts.challenger,
    toHandle: opts.toHandle?.replace(/^@/, '') || undefined,
    stakeCredits: Math.max(0, Math.floor(Number(opts.stakeCredits) || 0)),
    roundsToWin: Math.max(1, Math.min(3, opts.roundsToWin ?? 2)),
    message: opts.message?.slice(0, 120),
  }
  const all = loadAll()
  all.unshift(offer)
  saveAll(all)
  // also stash compact payload for cross-device via URL
  try {
    localStorage.setItem(`${INBOX_KEY}_${offer.id}`, JSON.stringify(offer))
  } catch {
    /* soft */
  }
  return offer
}

export function cancelOffer(id: string): void {
  const all = loadAll().map((o) =>
    o.id === id ? { ...o, status: 'cancelled' as const } : o,
  )
  saveAll(all)
}

export function acceptOffer(
  id: string,
  opponent: Fighter,
  opts?: { toAddress?: string },
): FightOffer | null {
  const all = loadAll()
  const i = all.findIndex((o) => o.id === id)
  let offer = i >= 0 ? all[i]! : readOfferPayload(id)
  if (!offer || offer.status !== 'open') return null
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
  try {
    localStorage.setItem(`${INBOX_KEY}_${offer.id}`, JSON.stringify(offer))
  } catch {
    /* soft */
  }
  return offer
}

export function markOfferDone(id: string): void {
  const all = loadAll().map((o) =>
    o.id === id ? { ...o, status: 'done' as const } : o,
  )
  saveAll(all)
}

/** Compact share URL with base64 offer blob (works cross-device without server). */
export function offerShareUrl(offer: FightOffer): string {
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
      },
      toHandle: offer.toHandle,
      stakeCredits: offer.stakeCredits,
      roundsToWin: offer.roundsToWin,
      message: offer.message,
    }
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(compact))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
    const u = new URL(SUITE.fighter)
    u.searchParams.set('offer', offer.id)
    u.searchParams.set('o', b64)
    return u.toString()
  } catch {
    return `${SUITE.fighter}?offer=${offer.id}`
  }
}

export function readOfferPayload(id?: string | null): FightOffer | null {
  // from URL param o=
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
    const id = q.get('offer')
    return readOfferPayload(id)
  } catch {
    return null
  }
}
