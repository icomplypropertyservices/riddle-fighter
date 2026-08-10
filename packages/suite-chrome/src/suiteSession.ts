/**
 * CANONICAL suite wallet session reader — copy verbatim into every app.
 *
 * The Riddle Wallet writes the session (lib/suite-connect.ts is the SSOT for
 * *writing*); every other suite app only needs to read it, which is what this
 * module does. Framework-free, no deps, safe on the server.
 *
 * Transport, in priority order:
 *   1. localStorage `riddle_wallet_session`  (same-origin, fast)
 *   2. cookie `rdl_sess` Domain=.riddlewallet.com  (shared across the suite)
 *
 * When only the cookie is present we hydrate localStorage, so a user who
 * connects on wallet.riddlewallet.com arrives at swap/bridge/cafe already
 * connected — that is what "wallet connection gets passed" means in practice.
 */

export const SUITE_SESSION_COOKIE = 'rdl_sess'
export const SUITE_SESSION_LS_KEY = 'riddle_wallet_session'
export const SUITE_SESSION_EVENT = 'riddle-wallet:session-changed'
export const WALLET_ORIGIN = 'https://wallet.riddlewallet.com'

/** Chains the wallet can hand over. Kept loose — unknown chains still render. */
export type SuiteSessionChain =
  | 'xrpl'
  | 'evm'
  | 'bnb'
  | 'solana'
  | 'stellar'
  | 'btc'
  | (string & {})

export type SuiteSession = {
  address: string
  chain: SuiteSessionChain
  source: 'riddle-wallet'
  app?: string
  /** Every chain address the wallet chose to share. */
  accounts?: Partial<Record<string, string>>
  connectedAt: number
  expiresAt?: number
  tier?: string
  feeBps?: number
}

/** Display labels for the account control. */
export const SUITE_CHAIN_LABELS: Record<string, string> = {
  xrpl: 'XRPL',
  evm: 'Ethereum',
  bnb: 'BNB Chain',
  solana: 'Solana',
  stellar: 'Stellar',
  btc: 'Bitcoin',
}

export function suiteChainLabel(chain: string): string {
  return SUITE_CHAIN_LABELS[chain] || chain.toUpperCase()
}

/** `rXYZ…9k2` — enough to recognise, short enough for a header. */
export function shortenSuiteAddress(address: string, lead = 5, tail = 4): string {
  const a = String(address || '').trim()
  if (a.length <= lead + tail + 1) return a
  return `${a.slice(0, lead)}…${a.slice(-tail)}`
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function isSuiteHost(): boolean {
  if (!isBrowser()) return false
  const h = window.location.hostname
  return h === 'riddlewallet.com' || h.endsWith('.riddlewallet.com')
}

function getCookie(name: string): string | null {
  if (!isBrowser()) return null
  try {
    for (const part of document.cookie.split('; ')) {
      const i = part.indexOf('=')
      if (i < 0) continue
      if (part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1))
    }
  } catch {
    /* ignore */
  }
  return null
}

function setCookie(name: string, value: string, maxAgeSec: number): void {
  if (!isBrowser()) return
  try {
    const v = value.length > 3500 ? value.slice(0, 3500) : value
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    const domain = isSuiteHost() ? '; Domain=.riddlewallet.com' : ''
    document.cookie = `${name}=${encodeURIComponent(v)}; Path=/; Max-Age=${Math.max(
      0,
      maxAgeSec,
    )}; SameSite=Lax${secure}${domain}`
  } catch {
    /* ignore */
  }
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* quota */
  }
}

function parseSession(raw: string | null): SuiteSession | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Partial<SuiteSession>
    const address = String(p?.address || '').trim()
    if (!address) return null
    if (p?.source !== 'riddle-wallet') return null
    // Expired sessions are treated as absent, never as "connected".
    if (typeof p.expiresAt === 'number' && p.expiresAt > 0 && Date.now() >= p.expiresAt) {
      return null
    }
    const accounts =
      p.accounts && typeof p.accounts === 'object'
        ? Object.fromEntries(
            Object.entries(p.accounts as Record<string, unknown>)
              .filter(([, v]) => typeof v === 'string' && v.trim())
              .map(([k, v]) => [k, String(v).trim()]),
          )
        : undefined
    return {
      address,
      chain: String(p.chain || 'xrpl'),
      source: 'riddle-wallet',
      app: p.app ? String(p.app) : undefined,
      accounts,
      connectedAt: Number(p.connectedAt) || Date.now(),
      expiresAt: typeof p.expiresAt === 'number' ? p.expiresAt : undefined,
      tier: p.tier ? String(p.tier) : undefined,
      feeBps: typeof p.feeBps === 'number' ? p.feeBps : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Read the shared session. Prefers whichever of localStorage / cookie is newer,
 * then backfills the other so both transports converge.
 */
export function readSuiteSession(): SuiteSession | null {
  if (!isBrowser()) return null
  const localRaw = lsGet(SUITE_SESSION_LS_KEY)
  const cookieRaw = getCookie(SUITE_SESSION_COOKIE)
  const local = parseSession(localRaw)
  const cookie = parseSession(cookieRaw)

  if (local && cookie) {
    if (cookie.connectedAt > local.connectedAt) {
      lsSet(SUITE_SESSION_LS_KEY, cookieRaw!)
      return cookie
    }
    if (local.connectedAt > cookie.connectedAt) {
      setCookie(SUITE_SESSION_COOKIE, localRaw!, remainingSeconds(local))
    }
    return local
  }
  if (local) {
    // First visit on this subdomain wrote LS only — publish to the suite cookie.
    setCookie(SUITE_SESSION_COOKIE, localRaw!, remainingSeconds(local))
    return local
  }
  if (cookie) {
    // Arrived from another suite app — hydrate LS so the app sees it locally.
    lsSet(SUITE_SESSION_LS_KEY, cookieRaw!)
    return cookie
  }
  return null
}

function remainingSeconds(s: SuiteSession): number {
  const until = s.expiresAt || s.connectedAt + 7 * 24 * 60 * 60 * 1000
  return Math.max(60, Math.floor((until - Date.now()) / 1000))
}

export function hasSuiteSession(): boolean {
  return readSuiteSession() !== null
}

/**
 * Every address the session carries, deduped, active chain first.
 * This is what the header control lists as "all wallets".
 */
export function suiteSessionAccounts(
  session: SuiteSession | null,
): { chain: string; address: string; active: boolean }[] {
  if (!session) return []
  const seen = new Set<string>()
  const out: { chain: string; address: string; active: boolean }[] = []

  const push = (chain: string, address: string) => {
    const key = `${chain}:${address}`
    if (!address || seen.has(key)) return
    seen.add(key)
    out.push({ chain, address, active: address === session.address })
  }

  push(session.chain, session.address)
  for (const [chain, address] of Object.entries(session.accounts || {})) {
    if (address) push(chain, address)
  }
  return out
}

/** Clear the session on this app (does not sign the user out of the wallet). */
export function clearSuiteSession(): void {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(SUITE_SESSION_LS_KEY)
  } catch {
    /* ignore */
  }
  setCookie(SUITE_SESSION_COOKIE, '', 0)
  try {
    window.dispatchEvent(new CustomEvent(SUITE_SESSION_EVENT, { detail: { address: null } }))
  } catch {
    /* ignore */
  }
}

/** Deep link that asks the wallet to connect and return here. */
export function buildSuiteConnectUrl(opts: {
  app: string
  returnUrl?: string
  chain?: string
  walletOrigin?: string
}): string {
  const origin = (opts.walletOrigin || WALLET_ORIGIN).replace(/\/$/, '')
  const returnUrl =
    opts.returnUrl || (isBrowser() ? window.location.href : origin)
  const q = new URLSearchParams({
    action: 'connect',
    app: opts.app,
    source: 'suite',
    return: returnUrl,
  })
  if (opts.chain) q.set('chain', opts.chain)
  return `${origin}/?${q.toString()}`
}

/**
 * Decode `rw_accounts` — base64url JSON, as written by the wallet's
 * `buildReturnUrlWithSession`. Falls back to plain percent-encoded JSON.
 */
export function decodeSuiteAccountsParam(
  raw: string | null | undefined,
): Record<string, string> | undefined {
  const s = String(raw || '').trim()
  if (!s) return undefined

  const collect = (parsed: unknown): Record<string, string> | undefined => {
    if (!parsed || typeof parsed !== 'object') return undefined
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim().length >= 10) out[k] = v.trim()
    }
    return Object.keys(out).length ? out : undefined
  }

  try {
    let b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json =
      typeof atob !== 'undefined'
        ? decodeURIComponent(escape(atob(b64)))
        : Buffer.from(b64, 'base64').toString('utf8')
    return collect(JSON.parse(json))
  } catch {
    try {
      return collect(JSON.parse(decodeURIComponent(s)))
    } catch {
      return undefined
    }
  }
}

/**
 * Accept the wallet's query handoff (`?rw_address=…&rw_chain=…`) and strip the
 * params from the URL. Call once on mount; returns the session it wrote.
 *
 * This is the no-popup fallback path of the connect protocol — without it a
 * redirect-mode connect silently drops the address.
 */
export function acceptSuiteConnectHandoff(app?: string): SuiteSession | null {
  if (!isBrowser()) return null
  let url: URL
  try {
    url = new URL(window.location.href)
  } catch {
    return null
  }
  const address = url.searchParams.get('rw_address')
  if (!address || url.searchParams.get('rw_source') !== 'riddle-wallet') return null

  const chain = url.searchParams.get('rw_chain') || 'xrpl'
  const accounts = decodeSuiteAccountsParam(url.searchParams.get('rw_accounts'))

  const session: SuiteSession = {
    address: address.trim(),
    chain,
    source: 'riddle-wallet',
    app,
    accounts,
    connectedAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    tier: url.searchParams.get('rw_tier') || undefined,
    feeBps: Number(url.searchParams.get('rw_fee_bps')) || undefined,
  }
  const json = JSON.stringify(session)
  lsSet(SUITE_SESSION_LS_KEY, json)
  setCookie(SUITE_SESSION_COOKIE, json, remainingSeconds(session))

  for (const k of ['rw_address', 'rw_chain', 'rw_source', 'rw_accounts', 'rw_tier', 'rw_fee_bps']) {
    url.searchParams.delete(k)
  }
  try {
    window.history.replaceState({}, '', url.toString())
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent(SUITE_SESSION_EVENT, { detail: { address: session.address } }),
    )
  } catch {
    /* ignore */
  }
  return session
}

/**
 * Fire `listener` whenever the session changes — same tab (custom event),
 * other tabs (storage event), and on focus (cookie set by another subdomain
 * produces no event at all, so focus is the only way to notice it).
 */
export function subscribeSuiteSession(listener: () => void): () => void {
  if (!isBrowser()) return () => {}
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === SUITE_SESSION_LS_KEY) listener()
  }
  window.addEventListener(SUITE_SESSION_EVENT, listener as EventListener)
  window.addEventListener('storage', onStorage)
  window.addEventListener('focus', listener)
  return () => {
    window.removeEventListener(SUITE_SESSION_EVENT, listener as EventListener)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', listener)
  }
}
