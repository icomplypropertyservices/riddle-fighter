/**
 * Free Basic Human mint for Riddle Fighter.
 * Once per wallet (shared claim key with World: rw-starter-human-claimed-v1).
 * Offline fight-ready · taxon 9001 · soft-seed meta on reborn when available.
 */

import type { Fighter } from './fighters'
import { loadWl } from './fighters'
import { buildMoveset } from './moveset'
import { fighterFromNft } from './nftCharacter'
import { SUITE } from './suite'
import { withCombatPowers } from './traitPowers'

export const STARTER_HUMAN_TAXON = 9001
export const STARTER_HUMAN_SLUG = 'riddle-basic-human'
export const STARTER_HUMAN_COLLECTION = 'Riddle Basic Human'
export const STARTER_HUMAN_WEAPON = 'Training Blade'
export const STARTER_HUMAN_POWER = 25
export const STARTER_HUMAN_ARMY = 'Riddle'
export const STARTER_HUMAN_GAME_CLASS = 'Recruit'

/** Shared with World so one free claim covers both surfaces. */
export const STARTER_CLAIMED_KEY = 'rw-starter-human-claimed-v1'
export const STARTER_SERIAL_KEY = 'rw-starter-human-serial-v1'
/** Per-wallet fighter bag (Fighter JSON). */
export const STARTER_FIGHTER_BAG_KEY = 'rf-starter-human-bag-v1'

function claimKey(wallet?: string | null): string {
  const w = String(wallet || '').trim().toLowerCase()
  if (w.startsWith('r') && w.length >= 25) return w
  return 'anon-session'
}

function loadClaimed(): Set<string> {
  try {
    const raw = localStorage.getItem(STARTER_CLAIMED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}

function saveClaimed(set: Set<string>): void {
  try {
    localStorage.setItem(STARTER_CLAIMED_KEY, JSON.stringify([...set]))
  } catch {
    /* soft */
  }
}

export function hasClaimedFreeStarter(wallet?: string | null): boolean {
  return loadClaimed().has(claimKey(wallet))
}

export function nextStarterSerial(): number {
  try {
    const n = Math.max(0, Math.floor(Number(localStorage.getItem(STARTER_SERIAL_KEY) || 0)))
    const next = n + 1
    localStorage.setItem(STARTER_SERIAL_KEY, String(next))
    return next
  } catch {
    return Math.floor(Date.now() % 1_000_000) + 1
  }
}

/** Offline portrait — prefer painted starter body; SVG fallback for rare offline edge cases. */
export function basicHumanSvgDataUri(opts?: {
  serial?: number
  hue?: number
  label?: string
}): string {
  // Real side-view character art for Basic Human recruits (picker + arena)
  void opts
  return '/art/characters/body-starter-idle.png'
}

function starterTraits(serial: number): Array<{ trait_type: string; value: string | number }> {
  return [
    { trait_type: 'Class', value: 'Human' },
    { trait_type: 'Tier', value: 'Starter' },
    { trait_type: 'Serial', value: serial },
    { trait_type: 'Taxon', value: STARTER_HUMAN_TAXON },
    { trait_type: 'Power', value: STARTER_HUMAN_POWER },
    { trait_type: 'Game Class', value: STARTER_HUMAN_GAME_CLASS },
    { trait_type: 'Army', value: STARTER_HUMAN_ARMY },
    { trait_type: 'Weapon', value: STARTER_HUMAN_WEAPON },
    { trait_type: 'Wins', value: 0 },
    { trait_type: 'Losses', value: 0 },
    { trait_type: 'Record', value: '0-0' },
    { trait_type: 'Starter', value: 'true' },
    { trait_type: 'Free Mint', value: 'true' },
    { trait_type: 'Battle Ready', value: 'true' },
    { trait_type: 'Fighter', value: 'true' },
  ]
}

export function isStarterHumanFighter(f: Fighter | null | undefined): boolean {
  if (!f) return false
  if (f.taxon === STARTER_HUMAN_TAXON) return true
  const col = String(f.collection || '').toLowerCase()
  if (col.includes('basic human')) return true
  const id = String(f.nftId || f.id || '').toLowerCase()
  return id.startsWith('starter-human-') || id.startsWith('riddle-basic-human')
}

/** Real XRPL NFTokenID is 64 hex chars — soft local bags use starter-human-N. */
export function isXrplNftokenId(id: string | null | undefined): boolean {
  return /^[A-Fa-f0-9]{64}$/.test(String(id || '').trim())
}

/**
 * True only for starters that exist on ledger (or were stamped with a real NFTokenID
 * after AcceptOffer). Soft localStorage fakes must never count as "owned".
 */
export function isOnChainStarterFighter(f: Fighter | null | undefined): boolean {
  if (!f || !isStarterHumanFighter(f)) return false
  const nid = String(f.nftId || f.id || '').replace(/^nft-/, '')
  return isXrplNftokenId(nid)
}

/** Soft offline bag (local serial, no ledger ownership). */
export function isSoftLocalStarter(f: Fighter | null | undefined): boolean {
  if (!f) return false
  if (isOnChainStarterFighter(f)) return false
  return isStarterHumanFighter(f)
}

function bagKey(wallet?: string | null): string {
  return `${STARTER_FIGHTER_BAG_KEY}:${claimKey(wallet)}`
}

/** Persist claimed fighter for wallet so refresh restores it. */
export function saveStarterFighter(fighter: Fighter, wallet?: string | null): void {
  try {
    localStorage.setItem(
      bagKey(wallet),
      JSON.stringify({
        fighter,
        at: Date.now(),
        wallet: claimKey(wallet),
      }),
    )
  } catch {
    /* soft */
  }
}

/**
 * Load bagged starter — **only if stamped with a real on-chain NFTokenID**.
 * Soft local fakes (starter-human-N) are cleared and never returned as owned.
 */
export function loadStarterFighter(wallet?: string | null): Fighter | null {
  try {
    const raw = localStorage.getItem(bagKey(wallet))
    if (!raw) return null
    const j = JSON.parse(raw) as { fighter?: Fighter }
    if (!j?.fighter?.id) return null
    const f = j.fighter
    if (!isOnChainStarterFighter(f)) {
      // Purge soft fake so UI never shows "owned" without ledger ownership
      clearStarterFighterBag(wallet)
      return null
    }
    const id = f.nftId || f.id
    const wl = loadWl(id)
    return {
      ...f,
      wins: Math.max(f.wins || 0, wl.wins),
      losses: Math.max(f.losses || 0, wl.losses),
      fightable: true,
      category: 'human',
      source: 'nft',
    }
  } catch {
    return null
  }
}

/** Drop soft claim flags so free mint can re-run the real AcceptOffer path. */
export function clearSoftFreeClaim(wallet?: string | null): void {
  clearStarterFighterBag(wallet)
  try {
    const set = loadClaimed()
    set.delete(claimKey(wallet))
    saveClaimed(set)
  } catch {
    /* soft */
  }
}

function metaBase(): string {
  try {
    const env = (import.meta as { env?: Record<string, string> }).env || {}
    const from =
      env.VITE_META_BASE_URL ||
      env.VITE_WORLD_API ||
      SUITE.reborn ||
      'https://reborn.riddlewallet.com'
    return String(from).replace(/\/+$/, '')
  } catch {
    return 'https://reborn.riddlewallet.com'
  }
}

/** Soft seed World meta host (best-effort; claim works offline). */
function softSeedMeta(serial: number, name: string, image: string, traits: Array<{ trait_type: string; value: string | number }>): void {
  const base = metaBase()
  const body = JSON.stringify({
    serial,
    name,
    originalImageUrl: image,
    traits,
    mintIntent: true,
    battleFigure: true,
    fighter: true,
    freeClaim: true,
    reason: 'fighter-free-mint',
  })
  void fetch(`${base}/api/mint/starter-human/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
  }).catch(() => {
    /* soft offline */
  })
}

/**
 * Product genesis art — Pinata IPFS (not meta CDN plate).
 * Directory CID from cafe-mint-ready/PINATA-MASTER.json; file is basic-human.jpg.
 */
export const BASIC_HUMAN_PINATA_CID =
  'bafybeidtvz6msntyfv5mp3tylnbd6tyy4sr5uhzkjsjdozgcjpi72ntq3u'
export const BASIC_HUMAN_PINATA_IMAGE =
  `https://gateway.pinata.cloud/ipfs/${BASIC_HUMAN_PINATA_CID}/basic-human.jpg`

/** Canonical display art = Pinata master (shared plate for all serials until evolve). */
export function basicHumanImageUrl(_serial?: number): string {
  return BASIC_HUMAN_PINATA_IMAGE
}

/** Soft meta-host static path (legacy / demoted — near-black plate on dark UI). */
export function basicHumanMetaCdnUrl(serial: number): string {
  const s = Math.max(1, Math.floor(serial || 1))
  return `https://meta.riddlewallet.com/static/riddle-basic-human/${s}.jpg`
}

export function createBasicHumanFighter(serial?: number): Fighter {
  const s = serial && serial > 0 ? serial : nextStarterSerial()
  const nftId = `starter-human-${s}`
  // Pinata product art is primary — user-facing Basic Human plate
  const pinata = basicHumanImageUrl(s)
  const svg = basicHumanSvgDataUri({ serial: s, label: `Human #${s}` })
  const traits = starterTraits(s)
  const f = fighterFromNft({
    nftId,
    name: `Basic Human #${s}`,
    image: pinata,
    originalImage: pinata,
    newImage: svg,
    issuer: STARTER_HUMAN_SLUG,
    taxon: STARTER_HUMAN_TAXON,
    collection: STARTER_HUMAN_COLLECTION,
    uri: `https://meta.riddlewallet.com/meta/${STARTER_HUMAN_SLUG}/${s}`,
    traits,
  })
  // Ensure fightable human kit even if catalog edge-cases
  f.fightable = true
  f.category = 'human'
  f.categoryLabel = 'Human'
  f.collection = STARTER_HUMAN_COLLECTION
  f.taxon = STARTER_HUMAN_TAXON
  if (!f.moveset) {
    f.moveset = buildMoveset({
      id: f.id,
      name: f.name,
      category: 'human',
      specialName: 'Recruit Strike',
      secretName: 'Training Finale',
    })
  }
  f.identity = {
    ...(f.identity || {}),
    army: STARTER_HUMAN_ARMY,
    gameClass: STARTER_HUMAN_GAME_CLASS,
    weapon: STARTER_HUMAN_WEAPON,
    powerRaw: STARTER_HUMAN_POWER,
  }
  // Re-bind full trait powers after identity stamp (no shortcut)
  return withCombatPowers(f)
}

export type ClaimFreeStarterResult =
  | {
      ok: true
      fighter?: Fighter
      alreadyClaimed?: boolean
      serial: number
      /** Step 1: authorize Payment sign opened */
      needsAuthorizeSign?: boolean
      /** Step 2: AcceptOffer sign opened */
      needsAcceptSign?: boolean
      nftokenId?: string
      live?: boolean
      step?: 'authorize_mint' | 'accept_offer' | 'done'
    }
  | { ok: false; error: string; alreadyClaimed?: boolean; fighter?: Fighter }

function encodeSuiteTxjson(tx: Record<string, unknown>): string {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(tx))))
  } catch {
    return encodeURIComponent(JSON.stringify(tx))
  }
}

/** Game mint / issuer (public) — authorize Payment Destination. */
export const GAME_MINT_ADDRESS = 'rDiHMcZARsb1uakt8tYScLbZuLRihZqjMp'

/** Open Riddle Wallet sign popup — never auto-accept. Account must be player wallet. */
export function openWalletSign(opts: {
  tx: Record<string, unknown>
  instruction?: string
  returnUrl?: string
  /** Pending step stamped for postMessage resume */
  step?: 'authorize_mint' | 'accept_offer'
}): Window | null {
  if (typeof window === 'undefined') return null
  const account = String(opts.tx?.Account || '').trim()
  if (
    !account.startsWith('r') ||
    account.length < 25 ||
    account.toLowerCase() === GAME_MINT_ADDRESS.toLowerCase() ||
    /^rDEMO/i.test(account) ||
    /XXXXXXXX/i.test(account)
  ) {
    try {
      console.warn(
        '[fighter] openWalletSign refused — Account must be logged-in personal wallet, got:',
        account.slice(0, 12),
      )
    } catch {
      /* soft */
    }
    return null
  }
  // Re-assert player Account on the wire (never issuer / game mint)
  const safeTx: Record<string, unknown> = { ...opts.tx, Account: account }
  if (String(safeTx.TransactionType || '') === 'NFTokenAcceptOffer') {
    delete safeTx.Destination
    delete safeTx.Amount
    delete safeTx.Memos
    delete safeTx.Fee
  }
  const origin = String(SUITE.wallet || 'https://wallet.riddlewallet.com').replace(/\/$/, '')
  const u = new URL(origin)
  u.searchParams.set('action', 'sign')
  u.searchParams.set('app', 'fighter')
  u.searchParams.set('source', 'suite')
  const ret =
    opts.returnUrl ||
    (typeof window !== 'undefined' ? window.location.href.split('#')[0] : SUITE.fighter)
  u.searchParams.set('return', ret)
  u.searchParams.set('tx', encodeSuiteTxjson(safeTx))
  if (opts.instruction) {
    u.searchParams.set('instruction', opts.instruction.slice(0, 220))
  }
  if (opts.step) {
    try {
      sessionStorage.setItem('rf_mint_step', opts.step)
      sessionStorage.setItem('rf_mint_dest', account)
    } catch {
      /* soft */
    }
  }
  const href = u.toString()
  const mobile =
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  if (mobile) {
    window.location.assign(href)
    return null
  }
  const w = window.open(
    href,
    'riddle-wallet-sign',
    'popup=yes,width=440,height=760,menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes',
  )
  if (!w || w.closed) {
    window.location.assign(href)
    return null
  }
  try {
    w.focus()
  } catch {
    /* soft */
  }
  return w
}

/** @deprecated use openWalletSign */
export function openWalletAcceptSign(opts: {
  tx: Record<string, unknown>
  instruction?: string
  returnUrl?: string
}): Window | null {
  return openWalletSign({ ...opts, step: 'accept_offer' })
}

/**
 * @deprecated Dust authorize Payment (12 drops → game mint) looked like a scam in Xaman
 * and is not required — free mint is Destination-locked NFTokenAcceptOffer only.
 * Kept as no-op builder for any residual imports.
 */
export function buildAuthorizeMintPayment(destination: string): Record<string, unknown> {
  const dest = String(destination || '').trim()
  return {
    TransactionType: 'NFTokenAcceptOffer',
    Account: dest,
    // Placeholder — real offer index comes from live mint API
    NFTokenSellOffer: '',
  }
}

/**
 * Clean AcceptOffer for wallets / Xaman — only XRPL fields.
 * No dust Payment, no issuer Account, no Memos that trip scam filters.
 * User pays network fee only; NFT price is 0 (Destination-locked sell offer).
 */
export function buildCleanAcceptOfferTx(
  playerAddress: string,
  offerIndex: string,
  extras?: { nftokenId?: string; serial?: number },
): Record<string, unknown> {
  const account = String(playerAddress || '').trim()
  const offer = String(offerIndex || '').trim()
  const tx: Record<string, unknown> = {
    TransactionType: 'NFTokenAcceptOffer',
    Account: account,
    NFTokenSellOffer: offer,
  }
  // Attach non-ledger hints under underscore for UI only (stripped before sign)
  if (extras?.nftokenId) tx._nftokenId = extras.nftokenId
  if (extras?.serial != null) tx._serial = extras.serial
  tx._userPaysNetworkFeeOnly = true
  tx._nftPriceXrp = '0'
  tx._purpose = 'Riddle Fighter free Basic Human mint — AcceptOffer only'
  return tx
}

export type LiveMintResult = {
  ok: boolean
  live?: boolean
  serial?: number
  nftokenId?: string | null
  offerIndex?: string | null
  acceptTx?: Record<string, unknown> | null
  mintHash?: string | null
  error?: string
  message?: string
}

/**
 * Server mints Basic Human + Destination-locked 0-XRP sell offer.
 * Client MUST open wallet for user to sign NFTokenAcceptOffer (network fee only).
 */
export async function requestBasicHumanLiveMint(destination: string): Promise<LiveMintResult> {
  const dest = String(destination || '').trim()
  if (!dest.startsWith('r') || dest.length < 25) {
    return { ok: false, error: 'wallet_required', message: 'Connect an XRPL r… wallet first' }
  }
  // Security: never mint Destination-locked offers into game mint / treasury / issuer
  if (dest.toLowerCase() === GAME_MINT_ADDRESS.toLowerCase()) {
    return {
      ok: false,
      error: 'forbidden_destination',
      message:
        'Cannot mint to the game mint treasury — connect your personal wallet as Destination',
    }
  }
  if (/^rDEMO/i.test(dest) || /XXXXXXXX/i.test(dest)) {
    return {
      ok: false,
      error: 'forbidden_destination',
      message: 'Demo / placeholder addresses cannot receive free mints',
    }
  }
  const base = metaBase()
  try {
    const r = await fetch(`${base}/api/mint/starter-human/live`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        destination: dest,
        buyer: dest,
        mode: 'free',
        // serial omitted — server SSOT
      }),
    })
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>
    if (!r.ok && !data?.ok) {
      return {
        ok: false,
        error: String(data?.error || `http_${r.status}`),
        message: String(
          data?.message ||
            'Live mint failed — free mint requires on-chain AcceptOffer. No fake owned NFT.',
        ),
      }
    }
    return {
      ok: true,
      live: Boolean(data.live ?? data.ok),
      serial: Math.max(0, Math.floor(Number(data.serial) || 0)),
      nftokenId: (data.nftokenId as string) || null,
      offerIndex: (data.offerIndex as string) || null,
      acceptTx: (data.acceptTx as Record<string, unknown>) || null,
      mintHash: (data.mintHash as string) || null,
      message: String(data.message || ''),
    }
  } catch (e) {
    return {
      ok: false,
      error: 'network',
      message: e instanceof Error ? e.message : 'Live mint network error',
    }
  }
}

/**
 * Free Basic Human — ONE player signature only:
 * Server mints + Destination-locked 0-XRP sell offer → player signs NFTokenAcceptOffer.
 * No dust Payment (that looked like a scam in Xaman).
 */
export async function claimFreeBasicHuman(
  wallet?: string | null,
  _opts?: { skipAuthorize?: boolean },
): Promise<ClaimFreeStarterResult> {
  const dest = String(wallet || '').trim()
  if (!dest.startsWith('r') || dest.length < 25) {
    return {
      ok: false,
      error:
        'Connect your personal Riddle Wallet first — choose the wallet that should receive the NFT, then sign AcceptOffer',
    }
  }
  // Never free-mint into the game mint / issuer vault (public constant Destination only).
  if (dest.toLowerCase() === GAME_MINT_ADDRESS.toLowerCase()) {
    return {
      ok: false,
      error:
        'Connected address is the game mint treasury — disconnect and connect your personal Riddle Wallet (the wallet that receives the NFT), not the hot minter.',
    }
  }

  const existing = loadStarterFighter(dest)
  if (existing && isOnChainStarterFighter(existing)) {
    return {
      ok: true,
      alreadyClaimed: true,
      fighter: existing,
      serial: Number(existing.traits?.find((t) => t.trait_type === 'Serial')?.value) || 0,
      live: true,
      step: 'done',
    }
  }

  clearSoftFreeClaim(dest)

  // Direct path: live mint + AcceptOffer (no authorize Payment)
  return continueFreeMintAfterAuthorize(dest)
}

/** After authorize Payment signed — live mint then AcceptOffer sign. */
export async function continueFreeMintAfterAuthorize(
  wallet: string,
): Promise<ClaimFreeStarterResult> {
  const dest = String(wallet || '').trim()
  if (!dest.startsWith('r') || dest.length < 25) {
    return { ok: false, error: 'Wallet address required for AcceptOffer step' }
  }
  if (dest.toLowerCase() === GAME_MINT_ADDRESS.toLowerCase()) {
    return {
      ok: false,
      error:
        'Cannot AcceptOffer as game mint — connect your personal Riddle Wallet first',
    }
  }

  const live = await requestBasicHumanLiveMint(dest)
  if (!live.ok) {
    return {
      ok: false,
      error:
        live.message ||
        live.error ||
        'Live mint unavailable — game mint server error. No fake owned NFT.',
    }
  }

  const acceptTx = live.acceptTx
  const offerIndex = String(
    (acceptTx && (acceptTx as { NFTokenSellOffer?: string }).NFTokenSellOffer) ||
      live.offerIndex ||
      '',
  ).trim()
  if (!acceptTx || !acceptTx.TransactionType || !offerIndex || offerIndex.startsWith('PENDING')) {
    return {
      ok: false,
      error: live.nftokenId
        ? `Mint created (${String(live.nftokenId).slice(0, 12)}…) but AcceptOffer missing — retry free mint`
        : 'AcceptOffer payload missing after mint — retry free mint',
    }
  }

  // Ledger fields only for sign path (strip _hints when sending to wallet)
  const full = buildCleanAcceptOfferTx(dest, offerIndex, {
    nftokenId: live.nftokenId || undefined,
    serial: live.serial,
  })
  const tx: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(full)) {
    if (k.startsWith('_')) continue
    if (v === undefined || v === null || v === '') continue
    tx[k] = v
  }
  // Force player Account — never game mint as signer
  tx.Account = dest
  tx.TransactionType = 'NFTokenAcceptOffer'
  // Never include Payment / Destination / Amount that look like scams
  delete tx.Destination
  delete tx.Amount
  delete tx.Memos
  delete tx.Fee // wallet autofills network fee

  const serial = live.serial || 0
  const pad = serial > 0 ? String(serial).padStart(6, '0') : '?'
  openWalletSign({
    tx,
    step: 'accept_offer',
    instruction: [
      `Accept free Basic Human #${pad} into YOUR wallet`,
      'Official Riddle Fighter free mint',
      'NFTokenAcceptOffer · NFT price 0 XRP · you only pay XRPL network fee (~12 drops)',
      'Game mint already created a Destination-locked sell offer to you',
    ].join(' · '),
  })

  // SECURITY: do NOT bag as "owned" until AcceptOffer is confirmed on ledger.
  // Premature saveStarterFighter with nftokenId made soft ownership leakage possible.
  // Meta seed is ok (mutable JSON host); claim flag only after accept scan.
  if (serial > 0) {
    try {
      sessionStorage.setItem(
        'rf_mint_pending',
        JSON.stringify({
          serial,
          nftokenId: live.nftokenId || null,
          offerIndex,
          dest,
          at: Date.now(),
        }),
      )
    } catch {
      /* soft */
    }
    softSeedMeta(
      serial,
      `Basic Human #${pad}`,
      basicHumanImageUrl(serial),
      [
        { trait_type: 'Class', value: 'Human' },
        { trait_type: 'Serial', value: serial },
        { trait_type: 'Free Mint', value: 'true' },
      ],
    )
  }

  return {
    ok: true,
    serial: serial || 0,
    needsAcceptSign: true,
    live: Boolean(live.live),
    nftokenId: live.nftokenId || undefined,
    step: 'accept_offer',
  }
}

/** Clear fighter bag for wallet (does not un-claim free mint). */
export function clearStarterFighterBag(wallet?: string | null): void {
  try {
    localStorage.removeItem(bagKey(wallet))
  } catch {
    /* soft */
  }
}
