/**
 * Per-NFT fight history + public card cache (local, suite-scoped).
 * Public pages can open ?view=<nftId> and show OLD|NEW + record without re-connect.
 */

const HIST_KEY = 'rf_nft_fight_hist_v1'
const PUBLIC_KEY = 'rf_nft_public_card_v1'
const HIST_MAX = 30
const PUBLIC_MAX = 80

export type NftFightEvent = {
  id: string
  at: string
  won: boolean
  opponent: string
  mode: string
  combo?: number
  wagerCredits?: number
  payoutCredits?: number
  note?: string
}

export type NftPublicCard = {
  nftId: string
  name: string
  image?: string
  originalImage?: string
  newImage?: string
  collection?: string
  categoryLabel?: string
  taxon?: number | null
  issuer?: string
  color?: string
  color2?: string
  wins: number
  losses: number
  specialName?: string
  updatedAt: string
}

function histStore(): Record<string, NftFightEvent[]> {
  try {
    const raw = localStorage.getItem(HIST_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as Record<string, NftFightEvent[]>
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

function saveHist(s: Record<string, NftFightEvent[]>): void {
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(s))
  } catch {
    /* soft */
  }
}

function publicStore(): Record<string, NftPublicCard> {
  try {
    const raw = localStorage.getItem(PUBLIC_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as Record<string, NftPublicCard>
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

function savePublic(s: Record<string, NftPublicCard>): void {
  try {
    const keys = Object.keys(s)
    if (keys.length > PUBLIC_MAX) {
      // drop oldest by updatedAt
      const sorted = keys
        .map((k) => ({ k, t: s[k]?.updatedAt || '' }))
        .sort((a, b) => (a.t < b.t ? -1 : 1))
      for (let i = 0; i < sorted.length - PUBLIC_MAX; i++) {
        delete s[sorted[i]!.k]
      }
    }
    localStorage.setItem(PUBLIC_KEY, JSON.stringify(s))
  } catch {
    /* soft */
  }
}

export function loadNftFightHistory(nftId: string): NftFightEvent[] {
  const id = String(nftId || '').trim()
  if (!id) return []
  const s = histStore()
  const list = s[id] || s[`nft-${id}`] || []
  return Array.isArray(list) ? list.slice(0, HIST_MAX) : []
}

export function recordNftFight(
  nftId: string,
  ev: Omit<NftFightEvent, 'id' | 'at'> & { id?: string; at?: string },
): NftFightEvent[] {
  const id = String(nftId || '').trim()
  if (!id) return []
  const s = histStore()
  const row: NftFightEvent = {
    id: ev.id || `fh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: ev.at || new Date().toISOString(),
    won: !!ev.won,
    opponent: String(ev.opponent || 'CPU'),
    mode: String(ev.mode || 'cpu'),
    combo: ev.combo,
    wagerCredits: ev.wagerCredits,
    payoutCredits: ev.payoutCredits,
    note: ev.note,
  }
  const prev = s[id] || []
  s[id] = [row, ...prev].slice(0, HIST_MAX)
  // mirror without nft- prefix for share links
  if (id.startsWith('nft-')) {
    const bare = id.slice(4)
    s[bare] = s[id]
  } else {
    s[`nft-${id}`] = s[id]
  }
  saveHist(s)
  return s[id]!
}

export function publishNftCard(card: Omit<NftPublicCard, 'updatedAt'> & { updatedAt?: string }): NftPublicCard {
  const nftId = String(card.nftId || '').trim()
  const full: NftPublicCard = {
    ...card,
    nftId,
    wins: Math.max(0, Math.floor(card.wins || 0)),
    losses: Math.max(0, Math.floor(card.losses || 0)),
    updatedAt: card.updatedAt || new Date().toISOString(),
  }
  if (!nftId) return full
  const s = publicStore()
  s[nftId] = full
  if (nftId.startsWith('nft-')) s[nftId.slice(4)] = full
  else s[`nft-${nftId}`] = full
  savePublic(s)
  return full
}

export function getPublicNftCard(nftId: string): NftPublicCard | null {
  const id = String(nftId || '').trim()
  if (!id) return null
  const s = publicStore()
  return s[id] || s[`nft-${id}`] || s[id.replace(/^nft-/, '')] || null
}

/** Deep-link for public NFT view (same origin). */
export function publicNftViewUrl(nftId: string): string {
  try {
    const u = new URL(window.location.href)
    u.searchParams.set('view', nftId.replace(/^nft-/, ''))
    u.hash = ''
    return u.toString()
  } catch {
    return `?view=${encodeURIComponent(nftId.replace(/^nft-/, ''))}`
  }
}

export function readViewParam(): string | null {
  try {
    const q = new URLSearchParams(window.location.search)
    const v = (q.get('view') || q.get('nft') || '').trim()
    return v || null
  } catch {
    return null
  }
}

export function clearViewParam(): void {
  try {
    const u = new URL(window.location.href)
    if (!u.searchParams.has('view') && !u.searchParams.has('nft')) return
    u.searchParams.delete('view')
    u.searchParams.delete('nft')
    window.history.replaceState({}, '', u.pathname + u.search + u.hash)
  } catch {
    /* soft */
  }
}
