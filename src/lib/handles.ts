/**
 * Riddle Social @handles — find players for 1v1 challenges.
 * Resolves via social.riddlewallet.com public API (soft offline).
 * Fight CPU gate is selected owned fighter; @handle is optional identity / challenges.
 */

import { SUITE } from './suite'

export type HandleResolve = {
  handle: string
  displayName?: string
  address?: string
  avatarUrl?: string
  chain?: string
}

const MY_HANDLE_KEY = 'rf_my_handle_v1'

/**
 * Corrupt / retired handles that must never appear in Fighter (local cache or API).
 * Not wallets — no r-address is hardcoded as a player.
 */
const BLOCKED_HANDLES = new Set([
  'dippdoge',
  'dippydoge',
  'dippy_doge',
  'dippy-doge',
  'dippyd0ge',
])

function normalize(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
}

export function isBlockedHandle(raw: string | null | undefined): boolean {
  const h = normalize(raw || '')
  return Boolean(h) && BLOCKED_HANDLES.has(h)
}

export function isValidHandleFormat(raw: string): boolean {
  const h = normalize(raw)
  if (h.length < 3 || h.length > 24) return false
  return /^[a-z0-9][a-z0-9_]*$/.test(h)
}

function parseHandleBody(data: Record<string, unknown>, fallback?: string): HandleResolve | null {
  const h = normalize(String(data.handle || data.name || fallback || ''))
  if (!h || isBlockedHandle(h)) return null
  const address = String(
    data.address ||
      data.xrpl ||
      (data.accounts as { xrpl?: string } | undefined)?.xrpl ||
      '',
  ).trim()
  return {
    handle: h,
    displayName: String(data.displayName || data.display_name || h),
    address: address || undefined,
    avatarUrl: String(data.avatarUrl || data.avatar || data.image || '') || undefined,
    chain: String(data.chain || 'xrpl'),
  }
}

/** Resolve @handle → address / profile (soft null on miss). */
export async function resolveHandle(raw: string): Promise<HandleResolve | null> {
  const handle = normalize(raw)
  if (!isValidHandleFormat(handle)) return null
  const bases = [SUITE.social, 'https://social.riddlewallet.com']
  for (const base of bases) {
    try {
      const url = `${base.replace(/\/$/, '')}/api/handles/resolve?handle=${encodeURIComponent(handle)}`
      const res = await fetch(url, { credentials: 'include', mode: 'cors' })
      if (res.status === 404) return null
      if (!res.ok) continue
      const data = (await res.json()) as Record<string, unknown>
      return parseHandleBody(data, handle)
    } catch {
      /* try next */
    }
  }
  return null
}

/**
 * Lookup claimed Riddle handle for a wallet address (XRPL classic, etc.).
 * Used on Fighter dash after connect.
 */
export async function lookupHandleByAddress(
  address: string,
): Promise<HandleResolve | null> {
  const a = String(address || '').trim()
  if (!a || a.length < 10) return null
  const bases = [SUITE.social, 'https://social.riddlewallet.com']
  for (const base of bases) {
    try {
      const url = `${base.replace(/\/$/, '')}/api/handles/by-address?address=${encodeURIComponent(a)}`
      const res = await fetch(url, { credentials: 'include', mode: 'cors' })
      if (res.status === 404) return null
      if (!res.ok) continue
      const data = (await res.json()) as Record<string, unknown>
      if (data.error) return null
      const rec = parseHandleBody(data)
      if (rec) {
        writeCachedMyHandle(rec, a)
        return rec
      }
    } catch {
      /* try next */
    }
  }
  // Cache hit only if bound to this address
  const cached = readCachedMyHandle()
  if (cached?.address && cached.address === a) return cached
  return null
}

/** Local cache so UI can show @handle offline after first resolve. */
export function readCachedMyHandle(): HandleResolve | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(MY_HANDLE_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as HandleResolve & { cachedAt?: number }
    const h = normalize(j.handle || '')
    if (!isValidHandleFormat(h) || isBlockedHandle(h)) {
      clearCachedMyHandle()
      return null
    }
    return {
      handle: h,
      displayName: j.displayName || h,
      address: j.address,
      avatarUrl: j.avatarUrl,
      chain: j.chain || 'xrpl',
    }
  } catch {
    return null
  }
}

export function writeCachedMyHandle(rec: HandleResolve, address?: string): void {
  if (typeof localStorage === 'undefined') return
  if (isBlockedHandle(rec.handle)) {
    clearCachedMyHandle()
    return
  }
  try {
    localStorage.setItem(
      MY_HANDLE_KEY,
      JSON.stringify({
        handle: normalize(rec.handle),
        displayName: rec.displayName || rec.handle,
        address: address || rec.address || '',
        avatarUrl: rec.avatarUrl,
        chain: rec.chain || 'xrpl',
        cachedAt: Date.now(),
      }),
    )
  } catch {
    /* soft */
  }
}

export function clearCachedMyHandle(): void {
  try {
    localStorage.removeItem(MY_HANDLE_KEY)
  } catch {
    /* soft */
  }
}

/** Social claim page — user creates @handle bound to wallet, then returns to Fighter. */
export function claimHandleUrl(opts?: {
  address?: string
  returnUrl?: string
}): string {
  try {
    const u = new URL(`${SUITE.social.replace(/\/$/, '')}/claim`)
    if (opts?.address) u.searchParams.set('address', opts.address)
    const ret =
      opts?.returnUrl ||
      (typeof window !== 'undefined'
        ? window.location.href.split('#')[0]
        : SUITE.fighter)
    u.searchParams.set('return', ret)
    u.searchParams.set('from', 'fighter')
    u.searchParams.set('suite_return', ret)
    return u.toString()
  } catch {
    return `${SUITE.social}/claim`
  }
}

/** Soft demo opponent when handle not found / offline — never blocked/corrupt names. */
export function demoOpponentFromHandle(raw: string): HandleResolve {
  let handle = normalize(raw) || 'challenger'
  if (isBlockedHandle(handle)) handle = 'challenger'
  return {
    handle,
    displayName: `@${handle}`,
    address: undefined,
  }
}

export function challengeUrl(handle: string, fighterId?: string): string {
  const h = normalize(handle)
  const u = new URL(SUITE.fighter)
  u.searchParams.set('challenge', h)
  if (fighterId) u.searchParams.set('nft', fighterId)
  return u.toString()
}

/** Display form: @name */
export function formatHandle(raw: string | null | undefined): string {
  const h = normalize(raw || '')
  return h ? `@${h}` : ''
}
