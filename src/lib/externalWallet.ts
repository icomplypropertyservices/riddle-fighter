/**
 * External + suite wallet connect for Riddle Fighter.
 * Supports: Riddle Wallet suite SSO (primary) + Xaman SignIn.
 * Paste-to-test / free-form address entry removed from product UI.
 *
 * IDENTITY: only acceptPlayerAddress() may bind a session — never ops/poison.
 */

import {
  walletConnectUrl,
  setManualAddress,
  clearWalletSession,
  readWalletSession,
  purgeForbiddenPlayerSession,
  isForbiddenPlayerAddress,
  FORBIDDEN_PLAYER_ADDRESSES,
  decodeRwAccountsXrpl,
} from './nfts'
import {
  acceptPlayerAddress,
  clearPlayerIdentity,
  openPlayerConnect,
} from './playerIdentity'
import { SUITE } from './suite'

export { isForbiddenPlayerAddress, FORBIDDEN_PLAYER_ADDRESSES, purgeForbiddenPlayerSession }

export type ExternalProviderId = 'riddle' | 'xaman' | 'address' | 'crossmark' | 'gemwallet'

export type DetectedProvider = {
  id: ExternalProviderId
  label: string
  available: boolean
  hint?: string
}

/** XRPL classic address shape (r… base58). Kept for Xaman / handoff validation. */
export function isXrplClassicAddress(address: string): boolean {
  const a = address?.trim() ?? ''
  if (!a || a.length < 25 || a.length > 35) return false
  if (!a.startsWith('r')) return false
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)
}

const RIDDLE_WALLET_CONNECTED = 'riddle-wallet:connected' as const

type XrplProvider = {
  isCrossmark?: boolean
  isConnected?: () => Promise<boolean>
  signIn?: () => Promise<{ response?: { account?: string }; account?: string; address?: string }>
  request?: (args: { method: string; params?: unknown }) => Promise<{
    result?: { account?: string; address?: string }
    account?: string
    address?: string
  }>
}

type GemApi = {
  isConnected?: () => Promise<{ result?: { isConnected?: boolean } } | boolean>
  getAddress?: () => Promise<{ result?: { address?: string }; address?: string }>
  connect?: () => Promise<{ result?: { publicKey?: string; address?: string } }>
}

function win(): Window & {
  xrpl?: XrplProvider
  gemWallet?: GemApi
  GemWalletApi?: GemApi
} {
  return window as Window & {
    xrpl?: XrplProvider
    gemWallet?: GemApi
    GemWalletApi?: GemApi
  }
}

export function detectExternalProviders(): DetectedProvider[] {
  return [
    {
      id: 'riddle',
      label: 'Riddle Wallet',
      available: true,
      hint: 'Suite SSO · choose which wallet, then return',
    },
    {
      id: 'xaman',
      label: 'Xaman',
      available: true,
      hint: 'Platform SignIn · real r-address',
    },
  ]
}

/**
 * Listen for Riddle Wallet suite connect handoff:
 *  - postMessage `riddle-wallet:connected` from wallet popup
 *  - optional `?rw_address=` redirect return
 * Returns unsubscribe.
 */
export function listenRiddleWalletConnected(
  onConnected: (address: string) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}

  const allowedHost = (origin: string) => {
    try {
      const o = new URL(origin)
      return (
        o.protocol === 'https:' &&
        (o.hostname === 'riddlewallet.com' || o.hostname.endsWith('.riddlewallet.com'))
      )
    } catch {
      return false
    }
  }

  const apply = (address: string, source = 'riddle-wallet') => {
    const bound = bindFighterAddress(address, source)
    if (bound) onConnected(bound)
  }

  const onMessage = (event: MessageEvent) => {
    if (event.origin && !allowedHost(event.origin) && event.origin !== window.location.origin) {
      return
    }
    const data = event.data as Record<string, unknown> | null
    if (!data || data.type !== RIDDLE_WALLET_CONNECTED) return
    if (data.source && data.source !== 'riddle-wallet') return
    const accounts = (data.accounts || {}) as Record<string, string>
    const candidates = [
      data.address,
      data.xrpl,
      accounts.xrpl,
      accounts.XRPL,
      ...Object.values(accounts || {}),
    ]
    for (const c of candidates) {
      const a = acceptPlayerAddress(String(c || ''))
      if (a) {
        apply(a, 'riddle-wallet')
        return
      }
    }
    // Toxic message — wipe
    clearPlayerIdentity()
  }

  window.addEventListener('message', onMessage)

  // Redirect handoff: wallet returns with ?rw_address= and/or ?rw_accounts=
  try {
    const params = new URLSearchParams(window.location.search)
    let address =
      acceptPlayerAddress(params.get('rw_address') || '') ||
      acceptPlayerAddress(params.get('address') || '') ||
      ''
    if (!address) {
      address = decodeRwAccountsXrpl(params.get('rw_accounts')) || ''
    }
    const source = params.get('rw_source') || params.get('source')
    const hasHandoff =
      params.has('rw_address') ||
      params.has('rw_accounts') ||
      source === 'riddle-wallet'
    if (hasHandoff) {
      if (address) apply(address, 'riddle-wallet')
      else clearPlayerIdentity()
    }
  } catch {
    /* soft */
  }

  void readWalletSession()

  return () => window.removeEventListener('message', onMessage)
}

/** Persist address as fighter session (same as suite handoff). Never binds game mint. */
export function bindFighterAddress(address: string, source = 'external'): string | null {
  const a = acceptPlayerAddress(address)
  if (!a) {
    purgeForbiddenPlayerSession()
    return null
  }
  setManualAddress(a, source || 'external')
  try {
    localStorage.setItem(
      'rf_wallet_source',
      JSON.stringify({ source, address: a, at: Date.now() }),
    )
  } catch {
    /* soft */
  }
  return a
}

export function disconnectFighterWallet(): void {
  clearWalletSession()
  try {
    localStorage.removeItem('rf_wallet_source')
  } catch {
    /* soft */
  }
}

/**
 * Primary suite connect — ALWAYS wallet.riddlewallet.com?return=…&app=fighter&action=connect&source=suite.
 * NEVER opens xumm.app / Xaman. Xaman is a separate secondary option via connectXamanSignIn.
 * Clears ghosts first so return handoff is the only identity.
 */
export function connectRiddleWallet(): void {
  if (typeof window === 'undefined') return
  try {
    openPlayerConnect()
  } catch {
    clearPlayerIdentity()
    // Fallback still Riddle Wallet only — never Xaman
    const href = walletConnectUrl()
    if (href.includes('xumm.app') || href.includes('xaman')) {
      window.location.assign(
        'https://wallet.riddlewallet.com/?return=' +
          encodeURIComponent(window.location.origin + window.location.pathname) +
          '&app=fighter&action=connect&source=suite',
      )
      return
    }
    window.location.assign(href)
  }
}

/**
 * Explicit secondary: open Xaman web only (no payload).
 * Prefer connectXamanSignIn() from ./xamanSignIn for proper Platform SignIn.
 * NEVER call this from "Connect Riddle Wallet" UI.
 */
export function openXamanApp(): void {
  window.open('https://xumm.app', '_blank', 'noopener,noreferrer')
}

export async function connectCrossmark(): Promise<
  { ok: true; address: string } | { ok: false; error: string }
> {
  const xrpl = win().xrpl
  if (!xrpl) {
    return { ok: false, error: 'Crossmark not detected — install the extension' }
  }
  try {
    if (typeof xrpl.signIn === 'function') {
      const res = await xrpl.signIn()
      const account =
        res?.response?.account || res?.account || res?.address || ''
      const bound = bindFighterAddress(String(account), 'crossmark')
      if (bound) return { ok: true, address: bound }
      return { ok: false, error: 'Crossmark did not return a valid XRPL address' }
    }
    if (typeof xrpl.request === 'function') {
      const res = await xrpl.request({ method: 'account' })
      const account =
        res?.result?.account ||
        res?.result?.address ||
        res?.account ||
        res?.address ||
        ''
      const bound = bindFighterAddress(String(account), 'crossmark')
      if (bound) return { ok: true, address: bound }
    }
    return { ok: false, error: 'Crossmark connect failed' }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Crossmark rejected',
    }
  }
}

export async function connectGemWallet(): Promise<
  { ok: true; address: string } | { ok: false; error: string }
> {
  const gem = win().gemWallet || win().GemWalletApi
  if (!gem) {
    return { ok: false, error: 'GemWallet not detected — install the extension' }
  }
  try {
    if (typeof gem.connect === 'function') {
      await gem.connect()
    }
    if (typeof gem.getAddress === 'function') {
      const res = await gem.getAddress()
      const account = res?.result?.address || res?.address || ''
      const bound = bindFighterAddress(String(account), 'gemwallet')
      if (bound) return { ok: true, address: bound }
    }
    return { ok: false, error: 'GemWallet did not return an address' }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'GemWallet rejected',
    }
  }
}

export function connectByAddress(
  address: string,
): { ok: true; address: string } | { ok: false; error: string } {
  const a = String(address || '').trim()
  if (isForbiddenPlayerAddress(a)) {
    return {
      ok: false,
      error:
        'That address is the game mint / issuer / treasury — connect your personal Riddle Wallet only (the wallet that receives the NFT)',
    }
  }
  const bound = bindFighterAddress(address, 'paste')
  if (!bound) {
    return {
      ok: false,
      error: 'Invalid XRPL address — classic r… address required',
    }
  }
  return { ok: true, address: bound }
}

/** Cafe / wallet links for users who want NFTs later. */
export function externalHelpLinks() {
  return {
    riddleWallet: SUITE.wallet,
    cafe: SUITE.cafe,
    xaman: 'https://xumm.app',
    crossmark: 'https://crossmark.io',
    gemwallet: 'https://gemwallet.app',
  }
}
