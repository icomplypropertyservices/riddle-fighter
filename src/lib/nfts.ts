/**
 * Load wallet-owned XRPL NFTs as selectable fighters.
 *
 * IDENTITY: single source of truth is ./playerIdentity — never invent wallets,
 * never multi-key “heal”, never ops/mint/treasury/test as the player.
 */

import { SUITE } from './suite'
import type { Fighter, FighterStats } from './fighters'
import { loadWl } from './fighters'
import {
  classifyNft,
  isOldCollectionNft,
  parseTaxonFromRaw,
  type NftCategory,
} from './nftCatalog'
import { fighterFromNft } from './nftCharacter'
import { buildMoveset } from './moveset'
import {
  acceptPlayerAddress,
  clearPlayerIdentity,
  isPoisonTestWallet,
  openPlayerConnect,
  playerConnectUrl,
  readPlayerIdentity,
  scrubHandoffQuery as scrubPlayerHandoff,
  writePlayerIdentity,
} from './playerIdentity'

// ── Session types (thin — identity lives in playerIdentity) ─────────────────

export type WalletSession = {
  address: string
  chain?: string
}

export type RawNft = {
  NFTokenID: string
  Issuer?: string
  issuer?: string
  URI?: string
  uri?: string
  uriDecoded?: string
  name?: string
  image?: string
  imageUrl?: string
  collection?: string
  collectionLabel?: string
  NFTokenTaxon?: number
  nft_taxon?: number
}

/**
 * Public issuers/treasuries — never a Fighter player session.
 * rDiHMc… is a valid player wallet (suite game holder) — not banned here.
 */
export const FORBIDDEN_PLAYER_ADDRESSES = new Set(
  [
    'rEwUuTNY3TaXAJL6T4y1tjkAnY7JPdX3dB',
    'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    'rpHshLWWWJoitkWBAJVBpyBdQq425XE77C',
    'r3fBtgrV5ZvfqWKPLmvEtD6qRsQSmq2yPb',
  ].map((a) => a.toLowerCase()),
)

export function isPoisonedTestWallet(address: string | null | undefined): boolean {
  return isPoisonTestWallet(address)
}

export function isForbiddenPlayerAddress(address: string): boolean {
  return acceptPlayerAddress(address) === null
}

/**
 * Purge only poison/ops ghosts — NEVER wipe a valid personal session.
 * (Earlier rewrite wrongly nuclear-cleared on every boot → forced re-login.)
 */
export function purgePoisonedTestWalletEverywhere(): number {
  if (typeof window === 'undefined') return 0
  let n = 0
  const keys = [
    'riddle_wallet_session',
    'riddle_wallet_session_v1',
    'rw_session',
    'riddle_session',
    'wallet-session',
    'rf_wallet_source',
  ]
  for (const k of keys) {
    try {
      const v = localStorage.getItem(k)
      if (!v) continue
      // Drop only if payload is poison/ops (not a valid personal address)
      const ok = acceptPlayerAddress(
        (() => {
          try {
            const j = JSON.parse(v) as Record<string, unknown>
            const accounts = (j.accounts || {}) as Record<string, string>
            return String(
              j.address || j.xrpl || accounts.xrpl || accounts.XRPL || '',
            )
          } catch {
            return v
          }
        })(),
      )
      if (!ok && (/rHvuNQ88/i.test(v) || /rEwUuTNY/i.test(v))) {
        localStorage.removeItem(k)
        n += 1
      }
    } catch {
      /* soft */
    }
  }
  // If primary session is currently forbidden, clear it
  try {
    const p = readPlayerIdentity()
    if (!p) {
      /* already clean or empty — do not thrash */
    }
  } catch {
    /* soft */
  }
  return n
}

export function purgeForbiddenPlayerSession(): void {
  // Only clear when current identity is forbidden / missing
  const p = readPlayerIdentity()
  if (!p) {
    clearPlayerIdentity()
    scrubPlayerHandoff()
  }
}

/** SECURITY: single identity read only. */
export function readWalletSession(): WalletSession | null {
  const p = readPlayerIdentity()
  if (p?.address) return { address: p.address, chain: p.chain || 'xrpl' }
  return null
}

/** Bind XRPL classic address after real connect — rejects poison/ops. */
export function setManualAddress(address: string, source = 'external'): void {
  const ok = writePlayerIdentity(address, source || 'external')
  if (!ok) clearPlayerIdentity()
}

export function clearWalletSession(): void {
  clearPlayerIdentity()
}

export function scrubHandoffQuery(): void {
  scrubPlayerHandoff()
}

export function walletConnectUrl(): string {
  return playerConnectUrl()
}

export function decodeRwAccountsXrpl(raw: string | null | undefined): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  try {
    let b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json = decodeURIComponent(escape(atob(b64)))
    const parsed = JSON.parse(json) as Record<string, unknown>
    for (const key of ['xrpl', 'XRPL']) {
      const a = acceptPlayerAddress(String(parsed[key] || ''))
      if (a) return a
    }
    for (const v of Object.values(parsed || {})) {
      const a = acceptPlayerAddress(String(v || ''))
      if (a) return a
    }
  } catch {
    /* soft */
  }
  return null
}

export function listenSuiteSessionChanges(
  onChange: (session: WalletSession | null) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  let last = ''
  const emit = () => {
    try {
      const s = readWalletSession()
      const key = s?.address || ''
      if (key === last) return
      last = key
      onChange(s)
    } catch {
      /* soft */
    }
  }
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === 'riddle_wallet_session' || e.key.includes('session')) {
      emit()
    }
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener('focus', emit)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') emit()
  })
  window.addEventListener('riddle-wallet:session-changed', emit)
  let bc: BroadcastChannel | null = null
  try {
    bc = new BroadcastChannel('riddle-wallet-session')
    bc.onmessage = () => emit()
  } catch {
    /* soft */
  }
  try {
    last = readWalletSession()?.address || ''
  } catch {
    last = ''
  }
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', emit)
    window.removeEventListener('riddle-wallet:session-changed', emit)
    try {
      bc?.close()
    } catch {
      /* soft */
    }
  }
}

// ── NFT inventory ──────────────────────────────────────────────────────────

/**
 * Live-validated xrpl.to inventory base (openapi 1.15, probed 2026-08-10):
 * Canonical owner bag: GET /v1/account/nfts/{account} → 200 { success, nfts: [] }.
 * NOT inventory: GET /v1/nft/issuer/... → 404 (issuer probe is not owned-NFT path).
 * Alternate portfolio: GET /v1/nft/account/{account}/nfts (rate-limited; not primary).
 * Ledger fallback: XRPL RPC account_nfts (xrplcluster / ripple) when index empty.
 */
export const XRPL_TO_API_BASE = 'https://api.xrpl.to/v1'

/** Absolute URL for account NFT inventory page (xrpl.to primary path). */
export function xrplToAccountNftsUrl(
  address: string,
  query: { limit?: number; marker?: string; offset?: number } = {},
): string {
  const a = address.trim()
  const params = new URLSearchParams()
  if (query.limit != null) params.set('limit', String(query.limit))
  if (query.marker) params.set('marker', query.marker)
  if (query.offset != null) params.set('offset', String(query.offset))
  const qs = params.toString()
  // Primary live path — do not use /nft/issuer/… (404).
  return `${XRPL_TO_API_BASE}/account/nfts/${encodeURIComponent(a)}${qs ? `?${qs}` : ''}`
}

const XRPL_RPCS = [
  'https://s1.ripple.com:51234',
  'https://s2.ripple.com:51234',
  'https://xrpl.ws',
  'https://xrplcluster.com',
]

type AccountNftsPage = {
  account_nfts?: RawNft[]
  marker?: unknown
  error?: string
}

function resolveIpfs(url: string): string {
  const u = String(url || '').trim()
  if (!u) return ''
  if (u.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${u.slice(7).replace(/^ipfs\//, '')}`
  }
  return u
}

function hexToUtf8(hex: string): string {
  const h = hex.replace(/^0x/i, '').replace(/\s/g, '')
  if (!h || h.length % 2) return ''
  try {
    const bytes = new Uint8Array(h.length / 2)
    for (let i = 0; i < h.length; i += 2) {
      bytes[i / 2] = parseInt(h.slice(i, i + 2), 16)
    }
    return new TextDecoder().decode(bytes).replace(/\0/g, '')
  } catch {
    try {
      let s = ''
      for (let i = 0; i < h.length; i += 2) {
        const c = parseInt(h.slice(i, i + 2), 16)
        if (c) s += String.fromCharCode(c)
      }
      return s
    } catch {
      return ''
    }
  }
}

function hashHue(seed: string): [string, string] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const hue = h % 360
  const hue2 = (hue + 40) % 360
  return [`hsl(${hue} 70% 48%)`, `hsl(${hue2} 65% 40%)`]
}

function statsFromId(id: string): FighterStats {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0
  const pick = (i: number, min: number, max: number) =>
    min + ((h >>> (i * 3)) % (max - min + 1))
  return {
    hp: pick(0, 80, 120),
    atk: pick(1, 8, 18),
    def: pick(2, 4, 14),
    speed: pick(3, 6, 16),
    special: pick(4, 10, 22),
  }
}

function normalizeRawNftRow(row: Record<string, unknown>): RawNft | null {
  const id = String(
    row.NFTokenID || row.nft_id || row.nftokenID || row.id || '',
  ).trim()
  if (!id || id.length < 16) return null
  return {
    NFTokenID: id,
    Issuer: String(row.Issuer || row.issuer || '') || undefined,
    issuer: String(row.Issuer || row.issuer || '') || undefined,
    URI: row.URI != null ? String(row.URI) : row.uri != null ? String(row.uri) : undefined,
    uri: row.uri != null ? String(row.uri) : undefined,
    uriDecoded: row.uriDecoded != null ? String(row.uriDecoded) : undefined,
    name: row.name != null ? String(row.name) : undefined,
    image:
      row.image != null
        ? String(row.image)
        : row.imageUrl != null
          ? String(row.imageUrl)
          : undefined,
    imageUrl: row.imageUrl != null ? String(row.imageUrl) : undefined,
    collection:
      row.collection != null
        ? String(row.collection)
        : row.collectionLabel != null
          ? String(row.collectionLabel)
          : undefined,
    NFTokenTaxon:
      row.NFTokenTaxon != null
        ? Number(row.NFTokenTaxon)
        : row.nft_taxon != null
          ? Number(row.nft_taxon)
          : undefined,
    nft_taxon: row.nft_taxon != null ? Number(row.nft_taxon) : undefined,
  }
}

async function fetchAccountNftsFromXrplTo(
  address: string,
  onPage?: (soFar: number, page: number) => void,
): Promise<RawNft[]> {
  const a = address.trim()
  const all: RawNft[] = []
  const seen = new Set<string>()
  const pageLimit = 400
  // Live-validated inventory path (not /nft/issuer/… which 404s).
  let url = xrplToAccountNftsUrl(a, { limit: pageLimit })
  let offset = 0

  for (let page = 0; page < 20; page++) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 12_000) : null
    try {
      const res = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        signal: ctrl?.signal,
        headers: { accept: 'application/json, text/plain, */*' },
      })
      if (!res.ok) break
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('text/html')) break
      const data = (await res.json()) as Record<string, unknown>
      if (data.success === false) break
      const batch = (data.nfts ||
        data.account_nfts ||
        (data.result as { account_nfts?: unknown } | undefined)?.account_nfts ||
        data.data ||
        []) as unknown[]
      if (!Array.isArray(batch) || batch.length === 0) break
      let added = 0
      for (const raw of batch) {
        const n = normalizeRawNftRow((raw || {}) as Record<string, unknown>)
        if (!n || seen.has(n.NFTokenID)) continue
        seen.add(n.NFTokenID)
        all.push(n)
        added++
      }
      onPage?.(all.length, page + 1)
      const marker =
        data.marker ??
        (data.result as { marker?: unknown } | undefined)?.marker ??
        data.next_marker ??
        data.next
      const nextUrl = data.next_url || (data.links as { next?: string } | undefined)?.next
      if (typeof nextUrl === 'string' && nextUrl) {
        url = nextUrl.startsWith('http') ? nextUrl : `${XRPL_TO_API_BASE}${nextUrl}`
        continue
      }
      if (marker != null && marker !== false && String(marker)) {
        url = xrplToAccountNftsUrl(a, {
          limit: pageLimit,
          marker: String(marker),
        })
        continue
      }
      if (batch.length >= pageLimit && added > 0) {
        offset += batch.length
        url = xrplToAccountNftsUrl(a, { limit: pageLimit, offset })
        continue
      }
      break
    } catch {
      break
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  return all
}

async function fetchAccountNftsPaginated(
  address: string,
  onPage?: (soFar: number, page: number) => void,
): Promise<RawNft[]> {
  const a = address.trim()
  const all: RawNft[] = []
  const seen = new Set<string>()

  for (const rpc of XRPL_RPCS) {
    all.length = 0
    seen.clear()
    let marker: unknown = undefined
    let page = 0
    let ok = false
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        page += 1
        const params: Record<string, unknown> = {
          account: a,
          ledger_index: 'validated',
          limit: 400,
        }
        if (marker !== undefined) params.marker = marker
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
        const timer = ctrl ? setTimeout(() => ctrl.abort(), 12_000) : null
        let res: Response
        try {
          res = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: 'account_nfts', params: [params] }),
            signal: ctrl?.signal,
          })
        } finally {
          if (timer) clearTimeout(timer)
        }
        if (!res.ok) break
        const data = (await res.json()) as { result?: AccountNftsPage }
        const result = data.result
        if (!result || result.error) break
        const list = result.account_nfts
        if (!Array.isArray(list)) break
        ok = true
        for (const n of list) {
          const id = String(n.NFTokenID || '')
          if (!id || seen.has(id)) continue
          seen.add(id)
          all.push(n)
        }
        onPage?.(all.length, page)
        if (result.marker == null || result.marker === undefined) break
        if (page >= 50 || all.length >= 20_000) break
        marker = result.marker
      }
      if (ok) return all
    } catch {
      /* try next rpc */
    }
  }
  return all
}

/**
 * Fetch owned NFTs for a VALIDATED personal address only.
 * Wrong/ops/poison address → empty (never invent inventory).
 */
export async function fetchOwnedNfts(
  address: string,
  onProgress?: (msg: string) => void,
): Promise<RawNft[]> {
  const a = acceptPlayerAddress(address)
  if (!a) {
    onProgress?.('Invalid wallet — connect your personal Riddle Wallet')
    return []
  }

  const byId = new Map<string, RawNft>()

  onProgress?.('Loading NFTs via xrpl.to…')
  try {
    const fromTo = await fetchAccountNftsFromXrplTo(a, (soFar, page) => {
      onProgress?.(`xrpl.to page ${page} · ${soFar} NFTs…`)
    })
    for (const n of fromTo) {
      const id = String(n.NFTokenID || '')
      if (id) byId.set(id, n)
    }
  } catch {
    /* soft */
  }

  if (byId.size === 0) {
    onProgress?.('Loading NFTs from XRPL ledger…')
    try {
      const fromRpc = await fetchAccountNftsPaginated(a, (soFar, page) => {
        onProgress?.(`Ledger page ${page} · ${soFar} NFTs…`)
      })
      for (const n of fromRpc) {
        const id = String(n.NFTokenID || '')
        if (id) byId.set(id, n)
      }
    } catch {
      /* soft */
    }
  } else {
    // Merge authoritative RPC if xrpl.to returned a partial bag
    try {
      const fromRpc = await fetchAccountNftsPaginated(a)
      for (const n of fromRpc) {
        const id = String(n.NFTokenID || '')
        if (id && !byId.has(id)) byId.set(id, n)
      }
    } catch {
      /* soft */
    }
  }

  // Wallet suite NFT API enrich (optional)
  try {
    const walletBase = String(SUITE.wallet || 'https://wallet.riddlewallet.com').replace(
      /\/$/,
      '',
    )
    const res = await fetch(
      `${walletBase}/api/nft/owned?address=${encodeURIComponent(a)}&chain=xrpl`,
      { mode: 'cors', credentials: 'omit' },
    )
    if (res.ok) {
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('html')) throw new Error('wallet nft html')
      const data = (await res.json()) as { nfts?: unknown[] }
      if (Array.isArray(data.nfts)) {
        for (const raw of data.nfts) {
          const n = normalizeRawNftRow((raw || {}) as Record<string, unknown>)
          if (n && !byId.has(n.NFTokenID)) byId.set(n.NFTokenID, n)
        }
      }
    }
  } catch {
    /* soft */
  }

  return Array.from(byId.values())
}

function filterOldCollectionRaw(raw: RawNft[]): RawNft[] {
  return raw.filter((n) =>
    isOldCollectionNft({
      issuer: n.Issuer || n.issuer,
      taxon: parseTaxonFromRaw(n),
    }),
  )
}

async function enrichNft(n: RawNft): Promise<Fighter> {
  let uri = ''
  const uriRaw = n.URI || n.uri || ''
  if (uriRaw) {
    uri = /^[0-9a-fA-F]+$/.test(uriRaw.replace(/\s/g, ''))
      ? hexToUtf8(uriRaw)
      : String(uriRaw)
  }
  if (n.uriDecoded) uri = n.uriDecoded

  let meta: Record<string, unknown> = {}
  if (uri && (uri.startsWith('http') || uri.startsWith('ipfs://'))) {
    try {
      const metaUrl = resolveIpfs(uri)
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 8_000) : null
      try {
        const res = await fetch(metaUrl, { signal: ctrl?.signal, mode: 'cors' })
        if (res.ok) {
          const ct = res.headers.get('content-type') || ''
          // text/html matches includes('text') and JSON.parse then throws.
          if (ct.includes('html')) {
            /* gateway 404 page */
          } else if (ct.includes('json') || ct.includes('text/plain') || !ct) {
            const text = await res.text()
            const trimmed = text.trim()
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
              meta = JSON.parse(trimmed) as Record<string, unknown>
            }
          }
        }
      } finally {
        if (timer) clearTimeout(timer)
      }
    } catch {
      /* soft */
    }
  }

  // Meta art slots: genesis (OLD) vs current/evolved (NEW)
  const rw =
    meta.riddleworld && typeof meta.riddleworld === 'object'
      ? (meta.riddleworld as Record<string, unknown>)
      : {}
  const pickStr = (...vals: unknown[]) => {
    for (const v of vals) {
      const s = String(v ?? '').trim()
      if (s) return s
    }
    return ''
  }
  const originalRaw = pickStr(
    meta.original_image,
    meta.originalImage,
    meta.originalImageUrl,
    rw.originalImageUrl,
    rw.original_image,
  )
  const evolvedRaw = pickStr(
    meta.new_image,
    meta.newImage,
    meta.evolved_image,
    meta.evolvedImage,
    rw.newImageUrl,
    rw.evolvedImageUrl,
  )
  const currentRaw = pickStr(
    n.image,
    n.imageUrl,
    meta.image,
    meta.image_url,
    meta.imageUrl,
    rw.currentImageUrl,
    rw.imageUrl,
  )
  const name =
    n.name ||
    String(meta.name || meta.title || '') ||
    `NFT ${String(n.NFTokenID || '').slice(0, 8)}`
  const collection = n.collection || n.collectionLabel || String(meta.collection || '')
  const traits = Array.isArray(meta.attributes)
    ? (meta.attributes as Array<{ trait_type?: string; value?: unknown }>)
    : Array.isArray(meta.traits)
      ? (meta.traits as Array<{ trait_type?: string; value?: unknown }>)
      : []

  const taxon = parseTaxonFromRaw(n)
  const cat = classifyNft({
    issuer: n.Issuer || n.issuer,
    taxon,
    name,
    collection,
    uri: String(uri || ''),
    traits,
  })

  return fighterFromNft({
    nftId: n.NFTokenID,
    name,
    image: currentRaw ? resolveIpfs(currentRaw) : undefined,
    originalImage: originalRaw ? resolveIpfs(originalRaw) : undefined,
    newImage: evolvedRaw ? resolveIpfs(evolvedRaw) : undefined,
    issuer: n.Issuer || n.issuer,
    taxon: cat.taxon ?? taxon,
    collection: cat.collection || collection,
    uri: String(uri || uriRaw || ''),
    traits,
  })
}

export type LoadWalletFightersOpts = {
  limit?: number
  /** When true, only old collection (taxon 0 + 2). Default false = ALL owned. */
  oldCollectionOnly?: boolean
  onProgress?: (n: number, total: number, phase?: string) => void
}

/**
 * Load wallet-owned fighters for the LIVE personal session address only.
 * Litmus: connect personal MP wallet → ledger NFTs appear here.
 */
export async function loadWalletFighters(
  address: string,
  limitOrOpts: number | LoadWalletFightersOpts = {},
  onProgressLegacy?: (n: number, total: number) => void,
): Promise<Fighter[]> {
  const opts: LoadWalletFightersOpts =
    typeof limitOrOpts === 'number'
      ? { limit: limitOrOpts, onProgress: onProgressLegacy }
      : limitOrOpts
  const oldOnly = opts.oldCollectionOnly === true
  const limit = opts.limit ?? 5000
  const onProgress = opts.onProgress || onProgressLegacy

  // HARD GATE — never scan ops/poison/empty
  const owner = acceptPlayerAddress(address)
  if (!owner) {
    onProgress?.(0, 0, 'Connect your personal wallet')
    return []
  }

  const rawAll = await fetchOwnedNfts(owner, (msg) => {
    onProgress?.(0, 0, msg)
  })
  const raw = oldOnly ? filterOldCollectionRaw(rawAll) : rawAll
  const slice = raw.slice(0, Math.max(1, limit))
  onProgress?.(0, slice.length, oldOnly ? 'old-collection' : 'all')

  const out: Fighter[] = []
  for (let i = 0; i < slice.length; i += 3) {
    const batch = slice.slice(i, i + 3)
    const part = await Promise.all(batch.map((n) => enrichNft(n)))
    out.push(...part)
    onProgress?.(Math.min(slice.length, i + batch.length), slice.length, 'art')
  }

  out.sort((a, b) => {
    const oa = isOldCollectionNft({ issuer: a.issuer, taxon: a.taxon }) ? 4 : 0
    const ob = isOldCollectionNft({ issuer: b.issuer, taxon: b.taxon }) ? 4 : 0
    const fa = a.fightable ? 2 : 0
    const fb = b.fightable ? 2 : 0
    const ia = a.image ? 1 : 0
    const ib = b.image ? 1 : 0
    return ob + fb + ib - (oa + fa + ia)
  })

  return out
}

export function countOldCollection(raw: RawNft[]): {
  total: number
  old: number
  inquiry: number
  inquisition: number
} {
  let inquiry = 0
  let inquisition = 0
  for (const n of raw) {
    const taxon = parseTaxonFromRaw(n)
    if (!isOldCollectionNft({ issuer: n.Issuer || n.issuer, taxon })) continue
    if (taxon === 0) inquiry += 1
    else if (taxon === 2) inquisition += 1
  }
  return {
    total: raw.length,
    old: inquiry + inquisition,
    inquiry,
    inquisition,
  }
}

export function filterFightable(fighters: Fighter[]): Fighter[] {
  return fighters.filter((f) => {
    if (f.fightable === false) return false
    if (f.source === 'demo' || String(f.id || '').startsWith('cpu-')) return false
    return f.category === 'human' || f.category === 'god' || !f.category
  })
}

export function filterByCategory(
  fighters: Fighter[],
  cat: NftCategory | 'all' | 'fightable',
): Fighter[] {
  if (cat === 'all') return fighters
  if (cat === 'fightable') return filterFightable(fighters)
  return fighters.filter((f) => f.category === cat)
}

export function fighterFromImageUrl(name: string, imageUrl: string): Fighter {
  const id = `img-${btoa(unescape(encodeURIComponent(imageUrl)))
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 16)}`
  const [color, color2] = hashHue(imageUrl)
  const wl = loadWl(id)
  const moveset = buildMoveset({
    id,
    name: name || 'Custom NFT',
    category: 'human',
    specialName: 'Art Strike',
    secretName: 'Canvas Finale',
  })
  return {
    id,
    name: name || 'Custom NFT',
    image: resolveIpfs(imageUrl),
    color,
    color2,
    stats: statsFromId(imageUrl),
    specialName: moveset.special.name,
    secretName: moveset.secret.name,
    superName: moveset.super.name,
    moveset,
    wins: wl.wins,
    losses: wl.losses,
    source: 'nft',
    nftId: id,
    fightable: true,
    category: 'human',
  }
}

/** Re-export connect opener for UI. */
export { openPlayerConnect }
