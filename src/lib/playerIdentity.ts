/**
 * SECURITY: Player identity for Fighter (and pattern for suite games).
 *
 * RULES
 * 1. Never invent or hardcode a player r… address.
 * 2. Never treat mint / treasury / issuer / internal test wallets as the player.
 * 3. Cookie/LS suite session is untrusted until it passes acceptPlayerAddress().
 * 4. On any rejection: nuclear-clear ALL suite session keys + rdl_sess cookie.
 * 5. Only explicit Connect handoff (postMessage / ?rw_address=) or a clean
 *    validated suite session may set identity.
 */

import { SUITE } from './suite'

const SESSION_KEY = 'riddle_wallet_session'
const COOKIE_SESS = 'rdl_sess'
const SESSION_ALIAS_KEYS = [
  'riddle_wallet_session_v1',
  'rw_session',
  'riddle_session',
  'wallet-session',
  'rf_wallet_source',
] as const

/**
 * Public ops / issuers — never “logged in as”.
 * NOTE: rDiHMc… is a real player wallet for suite games (lands/humans holder).
 * Do NOT ban it as the player — only ban pure treasury / collection issuers.
 */
const NEVER_PLAYER = new Set(
  [
    'rEwUuTNY3TaXAJL6T4y1tjkAnY7JPdX3dB', // treasury
    'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', // collection issuer
    'rpHshLWWWJoitkWBAJVBpyBdQq425XE77C', // legacy fee
    'r3fBtgrV5ZvfqWKPLmvEtD6qRsQSmq2yPb', // lands issuer
  ].map((a) => a.toLowerCase()),
)

export type PlayerIdentity = {
  address: string
  chain: 'xrpl'
  source: string
}

/** Known internal test wallet (UI: rHvuNQ88…Zg8i) — block forever as player. */
export function isPoisonTestWallet(address: string | null | undefined): boolean {
  const a = String(address || '').trim()
  if (!a) return false
  if (/rHvuNQ88/i.test(a)) return true
  if (/^rHvu/i.test(a) && /Zg8i$/i.test(a)) return true
  return false
}

/**
 * Accept only a personal classic XRPL address.
 * Rejects ops, poison test, demos, map fakes, garbage.
 */
export function acceptPlayerAddress(address: string | null | undefined): string | null {
  const a = String(address || '').trim()
  if (!a.startsWith('r')) return null
  if (a.length < 25 || a.length > 40) return null
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)) return null
  if (isPoisonTestWallet(a)) return null
  if (NEVER_PLAYER.has(a.toLowerCase())) return null
  if (/^rDEMO/i.test(a) || /XXXXXXXX/i.test(a)) return null
  if (/Holder/i.test(a) || /CitiesMeta/i.test(a) || /Metaverse/i.test(a)) return null
  return a
}

function expireSuiteCookies(): void {
  if (typeof document === 'undefined') return
  const base = 'rdl_sess=; Path=/; Max-Age=0; SameSite=Lax'
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  try {
    document.cookie = `${base}${secure}`
    if (window.location.hostname.endsWith('riddlewallet.com')) {
      document.cookie = `${base}${secure}; Domain=.riddlewallet.com`
    }
  } catch {
    /* soft */
  }
}

function storageLooksBad(raw: string | null | undefined): boolean {
  if (!raw) return false
  if (/rHvuNQ88/i.test(raw)) return true
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    const accounts = (j.accounts || j.wallets || {}) as Record<string, string>
    const addr = String(
      j.address || j.xrpl || j.wallet || accounts.xrpl || accounts.XRPL || '',
    ).trim()
    // Only bad if primary address is present and rejected (ops / poison)
    return addr.startsWith('r') && !acceptPlayerAddress(addr)
  } catch {
    return false
  }
}

/** Nuclear clear — identity gone from this origin + suite cookie. */
export function clearPlayerIdentity(): void {
  if (typeof window === 'undefined') return
  const keys = [SESSION_KEY, ...SESSION_ALIAS_KEYS]
  for (const k of keys) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* soft */
    }
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k.startsWith('riddle_keystore') || k.startsWith('riddle_imported')) continue
      const v = localStorage.getItem(k)
      if (storageLooksBad(v) || (k.includes('session') && storageLooksBad(v))) {
        localStorage.removeItem(k)
      }
    }
  } catch {
    /* soft */
  }
  expireSuiteCookies()
  try {
    sessionStorage.removeItem('rf_mint_step')
    sessionStorage.removeItem('rf_mint_dest')
  } catch {
    /* soft */
  }
}

function parseAddressFromRaw(raw: string | null): string | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    const accounts = (j.accounts || j.wallets || {}) as Record<string, string>
    const address = String(
      j.address ||
        j.xrpl ||
        j.wallet ||
        j.classicAddress ||
        accounts.xrpl ||
        accounts.XRPL ||
        '',
    ).trim()
    return acceptPlayerAddress(address)
  } catch {
    const t = raw.trim()
    return acceptPlayerAddress(t)
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
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

/**
 * Read player identity. Returns null if nothing valid.
 * Auto-nukes poison/ops from storage when found.
 */
export function readPlayerIdentity(): PlayerIdentity | null {
  if (typeof localStorage === 'undefined') return null

  // 1) Handoff query first (explicit connect return)
  try {
    const q = new URLSearchParams(window.location.search)
    const handoff =
      q.get('rw_address') ||
      (q.get('source') === 'riddle-wallet' || q.get('rw_source') === 'riddle-wallet'
        ? q.get('address')
        : '') ||
      ''
    const fromAccounts = q.get('rw_accounts')
    let addr = acceptPlayerAddress(handoff.trim())
    if (!addr && fromAccounts) {
      try {
        let b64 = fromAccounts.replace(/-/g, '+').replace(/_/g, '/')
        while (b64.length % 4) b64 += '='
        const json = decodeURIComponent(escape(atob(b64)))
        const parsed = JSON.parse(json) as Record<string, unknown>
        addr = acceptPlayerAddress(String(parsed.xrpl || parsed.XRPL || ''))
        if (!addr) {
          for (const v of Object.values(parsed)) {
            addr = acceptPlayerAddress(String(v || ''))
            if (addr) break
          }
        }
      } catch {
        /* soft */
      }
    }
    const hasHandoff =
      q.has('rw_address') ||
      q.has('rw_accounts') ||
      q.get('source') === 'riddle-wallet' ||
      q.get('rw_source') === 'riddle-wallet'
    if (addr && hasHandoff) {
      writePlayerIdentity(addr, 'handoff')
      scrubHandoffQuery()
      return { address: addr, chain: 'xrpl', source: 'handoff' }
    }
    // Toxic handoff → wipe URL
    if (hasHandoff && handoff && !addr) {
      clearPlayerIdentity()
      scrubHandoffQuery()
    }
  } catch {
    /* soft */
  }

  // 2) Primary LS key only (no multi-key “heal” that can resurrect ghosts)
  try {
    const rawPrimary = localStorage.getItem(SESSION_KEY)
    const fromLs = parseAddressFromRaw(rawPrimary)
    if (fromLs) {
      return { address: fromLs, chain: 'xrpl', source: 'suite-ls' }
    }
    // Bad primary payload → drop it (do not fall through to promote aliases)
    if (rawPrimary && (storageLooksBad(rawPrimary) || rawPrimary.trim())) {
      // If JSON has an r… address that failed accept → wipe identity entirely
      try {
        const j = JSON.parse(rawPrimary) as Record<string, unknown>
        const accounts = (j.accounts || j.wallets || {}) as Record<string, string>
        const maybe = String(
          j.address || j.xrpl || j.wallet || accounts.xrpl || accounts.XRPL || '',
        ).trim()
        if (maybe.startsWith('r')) {
          clearPlayerIdentity()
          return null
        }
      } catch {
        if (storageLooksBad(rawPrimary)) {
          clearPlayerIdentity()
          return null
        }
      }
    }
  } catch {
    /* soft */
  }

  // 3) Cookie — only if valid player
  const fromCookie = parseAddressFromRaw(readCookie(COOKIE_SESS))
  if (fromCookie) {
    writePlayerIdentity(fromCookie, 'cookie')
    return { address: fromCookie, chain: 'xrpl', source: 'cookie' }
  }

  // 4) Aliases — NEVER promote silently as identity.
  // Drop any alias keys (ghost farm). User must Connect to establish session.
  for (const k of SESSION_ALIAS_KEYS) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* next */
    }
  }

  // Nothing valid — ensure cookie clean if poison, but do not thrash empty storage
  try {
    const c = readCookie(COOKIE_SESS)
    if (c && storageLooksBad(c)) expireSuiteCookies()
  } catch {
    /* soft */
  }
  return null
}

/** Persist validated player identity for suite SSO. */
export function writePlayerIdentity(address: string, source: string): PlayerIdentity | null {
  const a = acceptPlayerAddress(address)
  if (!a) {
    clearPlayerIdentity()
    return null
  }
  // Drop aliases so only one identity exists
  for (const k of SESSION_ALIAS_KEYS) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* soft */
    }
  }
  // ALWAYS source riddle-wallet for suite SSO — other apps reject non-canonical sources
  const payload = JSON.stringify({
    address: a,
    chain: 'xrpl',
    source: 'riddle-wallet',
    appSource: source || 'riddle-wallet',
    connectedAt: Date.now(),
    updatedAt: new Date().toISOString(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  })
  try {
    localStorage.setItem(SESSION_KEY, payload)
  } catch {
    /* soft */
  }
  try {
    const maxAge = 7 * 24 * 3600
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    const domain = window.location.hostname.endsWith('riddlewallet.com')
      ? '; Domain=.riddlewallet.com'
      : ''
    document.cookie = `rdl_sess=${encodeURIComponent(payload)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}${domain}`
  } catch {
    /* soft */
  }
  return { address: a, chain: 'xrpl', source }
}

/** Stale handoff / SSO noise to strip from return URLs and after connect. */
const HANDOFF_QUERY_KEYS = [
  'rw_address',
  'rw_chain',
  'rw_source',
  'rw_accounts',
  'rw_tier',
  'rw_fee_bps',
  'rw_tx',
  'rw_signed',
  'rw_xrpl',
  'rw_stellar',
  'rw_solana',
  'rw_evm',
  'rw_bnb',
  'address',
  'source',
  'accounts',
  'tier',
  'xamanUuid',
  'xaman',
  'uuid',
  'txHash',
] as const

/**
 * Strip rw_*, xaman*, and stale handoff params so wallet return= is clean.
 * Prevents nested handoff loops and accidental Xaman uuid resume noise.
 */
export function cleanSuiteReturnUrl(preferred?: string): string {
  try {
    const raw =
      preferred ||
      (typeof window !== 'undefined'
        ? window.location.href
        : 'https://fighter.riddlewallet.com/')
    const u = new URL(raw)
    for (const k of HANDOFF_QUERY_KEYS) u.searchParams.delete(k)
    // Drop any remaining rw_* / xaman* keys (prefix match)
    const doomed: string[] = []
    u.searchParams.forEach((_v, k) => {
      const low = k.toLowerCase()
      if (low.startsWith('rw_') || low.startsWith('xaman') || low === 'xumm') {
        doomed.push(k)
      }
    })
    for (const k of doomed) u.searchParams.delete(k)
    // Hash rarely carries handoff; keep path + cleaned search
    return u.origin + u.pathname + u.search + u.hash
  } catch {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${window.location.pathname}`
    }
    return 'https://fighter.riddlewallet.com/'
  }
}

export function scrubHandoffQuery(): void {
  try {
    const url = new URL(window.location.href)
    for (const k of HANDOFF_QUERY_KEYS) url.searchParams.delete(k)
    const doomed: string[] = []
    url.searchParams.forEach((_v, k) => {
      const low = k.toLowerCase()
      if (low.startsWith('rw_') || low.startsWith('xaman') || low === 'xumm') {
        doomed.push(k)
      }
    })
    for (const k of doomed) url.searchParams.delete(k)
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  } catch {
    /* soft */
  }
}

/**
 * Deep-link to unified wallet connect — NEVER xumm.app / Xaman.
 * Canonical: wallet.riddlewallet.com?return=<clean>&app=fighter&action=connect&source=suite
 */
export function playerConnectUrl(): string {
  try {
    const origin = String(SUITE.wallet || 'https://wallet.riddlewallet.com').replace(/\/$/, '')
    const u = new URL(origin)
    const ret = cleanSuiteReturnUrl()
    u.searchParams.set('return', ret)
    u.searchParams.set('app', 'fighter')
    u.searchParams.set('action', 'connect')
    u.searchParams.set('source', 'suite')
    u.searchParams.set('chain', 'xrpl')
    return u.toString()
  } catch {
    const ret =
      typeof window !== 'undefined'
        ? encodeURIComponent(
            window.location.origin + window.location.pathname + window.location.search,
          )
        : encodeURIComponent('https://fighter.riddlewallet.com/')
    return `https://wallet.riddlewallet.com/?return=${ret}&app=fighter&action=connect&source=suite&chain=xrpl`
  }
}

/**
 * Open Riddle Wallet suite SSO only — never Xaman.
 * Mobile → redirect; desktop → popup without noopener (needs opener for postMessage);
 * if popup blocked → same-tab redirect.
 */
export function openPlayerConnect(): void {
  if (typeof window === 'undefined') return
  // Clear ghosts before connect so return handoff is the only identity
  clearPlayerIdentity()
  const href = playerConnectUrl()
  const mobile =
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  if (mobile) {
    window.location.assign(href)
    return
  }
  // Do NOT pass noopener/noreferrer — wallet postMessages to window.opener
  const w = window.open(
    href,
    'riddle-wallet-connect',
    'popup=yes,width=440,height=760,menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes',
  )
  if (!w || w.closed) window.location.assign(href)
  else {
    try {
      w.focus()
    } catch {
      /* soft */
    }
  }
}
