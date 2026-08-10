/**
 * CANONICAL suite @handle cache — copy verbatim into every app.
 * Cookie Domain=.riddlewallet.com + localStorage. No framework deps.
 *
 * Carries Social identity for the suite rail:
 *   @handle · displayName · bio · avatar (wallet/social image) · banner
 * Brand social links stay in suite-shell-config (SUITE_SOCIALS).
 */

export const COOKIE_SUITE_HANDLE = 'rdl_handle'
export const LS_SUITE_HANDLE = 'riddle_suite_handle_v1'
/** Large data:image avatars — local only (cookie budget). */
export const LS_SUITE_HANDLE_AVATAR = 'riddle_suite_handle_avatar_v1'
export const SOCIAL_API_BASE = 'https://social.riddlewallet.com'

export type SuiteHandleSocials = {
  x?: string
  discord?: string
  telegram?: string
  github?: string
  website?: string
}

export type SuiteHandleProfile = {
  handle: string
  address: string
  /** Primary chain for handle (usually xrpl). */
  chain?: string
  /** Multi-chain destinations from Social. */
  accounts?: Partial<Record<string, string>>
  displayName?: string
  /** Short bio from Social profile (≤280). */
  bio?: string
  /** Latest news blurb from Social (≤500). */
  news?: string
  /** Prefer https URL in cookie; data: may live only in LS_SUITE_HANDLE_AVATAR. */
  avatar?: string
  avatarUrl?: string
  bannerUrl?: string
  verified?: boolean
  isProject?: boolean
  projectName?: string
  projectUrl?: string
  projectTagline?: string
  /** Optional linked social handles (without @ where possible). */
  socials?: SuiteHandleSocials
  updatedAt: number
}

function isSuiteHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'riddlewallet.com' || h.endsWith('.riddlewallet.com')
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  try {
    for (const p of document.cookie.split('; ')) {
      const i = p.indexOf('=')
      if (i < 0) continue
      if (p.slice(0, i) === name) return decodeURIComponent(p.slice(i + 1))
    }
  } catch {
    /* ignore */
  }
  return null
}

function setCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === 'undefined') return
  try {
    const v = value.length > 3500 ? value.slice(0, 3500) : value
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    const domain = isSuiteHost() ? '; Domain=.riddlewallet.com' : ''
    document.cookie = `${name}=${encodeURIComponent(v)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}${domain}`
  } catch {
    /* ignore */
  }
}

/** Corrupt / retired handles — never surface in suite rail or game. */
const BLOCKED_HANDLES = new Set([
  'dippdoge',
  'dippydoge',
  'dippy_doge',
  'dippy-doge',
  'dippyd0ge',
])

function isBlockedHandle(h: string): boolean {
  return BLOCKED_HANDLES.has(String(h || '').replace(/^@/, '').toLowerCase())
}

function normalizeSocials(raw: unknown): SuiteHandleSocials | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const out: SuiteHandleSocials = {}
  const take = (k: keyof SuiteHandleSocials, ...aliases: string[]) => {
    for (const a of [k, ...aliases]) {
      const v = String(o[a] || '').trim()
      if (v) {
        out[k] = v.replace(/^@/, '').slice(0, 64)
        return
      }
    }
  }
  take('x', 'twitter', 'twitterHandle')
  take('discord', 'discordHandle')
  take('telegram', 'tg')
  take('github', 'gh')
  take('website', 'web', 'url')
  return Object.keys(out).length ? out : undefined
}

function parseProfile(raw: string | null): SuiteHandleProfile | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as SuiteHandleProfile
    if (!p?.handle || !p?.address) return null
    const h = String(p.handle).replace(/^@/, '').toLowerCase()
    if (!/^[a-z0-9_]{3,24}$/.test(h)) return null
    if (isBlockedHandle(h)) return null
    return {
      handle: h,
      address: String(p.address).trim(),
      chain: p.chain ? String(p.chain).slice(0, 32) : 'xrpl',
      accounts:
        p.accounts && typeof p.accounts === 'object'
          ? (p.accounts as Partial<Record<string, string>>)
          : undefined,
      displayName: p.displayName || h,
      bio: String(p.bio || '').slice(0, 280),
      news: String(p.news || '').slice(0, 500),
      avatar: p.avatar || '',
      avatarUrl: p.avatarUrl || '',
      bannerUrl: p.bannerUrl || '',
      verified: Boolean(p.verified),
      isProject: Boolean(p.isProject),
      projectName: String(p.projectName || '').slice(0, 80),
      projectUrl: String(p.projectUrl || '').slice(0, 500),
      projectTagline: String(p.projectTagline || '').slice(0, 160),
      socials: normalizeSocials(p.socials),
      updatedAt: Number(p.updatedAt) || Date.now(),
    }
  } catch {
    return null
  }
}

export function formatSuiteHandle(h?: string | null): string {
  const s = String(h || '')
    .replace(/^@/, '')
    .toLowerCase()
  return s ? `@${s}` : ''
}

/** Best image URL for rail / header chips (https preferred, then data:). */
export function suiteHandleImage(p: SuiteHandleProfile | null | undefined): string {
  if (!p) return ''
  const u = (p.avatarUrl || p.avatar || '').trim()
  if (/^https?:\/\//i.test(u) || u.startsWith('data:image') || u.startsWith('blob:')) {
    return u
  }
  // Large data: avatars kept out of cookie — recover from LS
  try {
    const raw = localStorage.getItem(LS_SUITE_HANDLE_AVATAR)
    if (!raw) return ''
    const j = JSON.parse(raw) as { handle?: string; data?: string }
    if (
      j?.handle &&
      j.handle.toLowerCase() === p.handle.toLowerCase() &&
      j.data &&
      (j.data.startsWith('data:image') || /^https?:\/\//i.test(j.data))
    ) {
      return j.data
    }
  } catch {
    /* soft */
  }
  return ''
}

function storeAvatarBlob(handle: string, data: string): void {
  try {
    if (!data || data.length < 32) {
      localStorage.removeItem(LS_SUITE_HANDLE_AVATAR)
      return
    }
    // Cap ~400KB in LS
    if (data.length > 400_000) return
    localStorage.setItem(
      LS_SUITE_HANDLE_AVATAR,
      JSON.stringify({ handle: handle.toLowerCase(), data, at: Date.now() }),
    )
  } catch {
    /* soft */
  }
}

/** Compact profile for cookie (no giant data:image). */
function compactForCookie(full: SuiteHandleProfile): SuiteHandleProfile {
  const avatarUrl = String(full.avatarUrl || '').trim()
  const avatar = String(full.avatar || '').trim()
  const httpAvatar =
    /^https?:\/\//i.test(avatarUrl) ? avatarUrl : /^https?:\/\//i.test(avatar) ? avatar : ''
  // Persist data: only in LS
  if (avatar.startsWith('data:image') || avatarUrl.startsWith('data:image')) {
    storeAvatarBlob(full.handle, avatar.startsWith('data:image') ? avatar : avatarUrl)
  } else if (httpAvatar) {
    storeAvatarBlob(full.handle, httpAvatar)
  }
  return {
    handle: full.handle,
    address: full.address,
    chain: full.chain || 'xrpl',
    accounts: full.accounts,
    displayName: full.displayName || full.handle,
    bio: String(full.bio || '').slice(0, 200),
    news: String(full.news || '').slice(0, 200),
    avatar: httpAvatar || '',
    avatarUrl: httpAvatar || '',
    bannerUrl: /^https?:\/\//i.test(String(full.bannerUrl || ''))
      ? String(full.bannerUrl).slice(0, 500)
      : '',
    verified: Boolean(full.verified),
    isProject: Boolean(full.isProject),
    projectName: String(full.projectName || '').slice(0, 80),
    projectUrl: String(full.projectUrl || '').slice(0, 300),
    projectTagline: String(full.projectTagline || '').slice(0, 120),
    socials: full.socials,
    updatedAt: full.updatedAt,
  }
}

export function readSuiteHandle(): SuiteHandleProfile | null {
  let local: SuiteHandleProfile | null = null
  try {
    local = parseProfile(localStorage.getItem(LS_SUITE_HANDLE))
  } catch {
    local = null
  }
  const cookie = parseProfile(getCookie(COOKIE_SUITE_HANDLE))
  if (local && cookie) {
    if ((cookie.updatedAt || 0) > (local.updatedAt || 0)) {
      try {
        localStorage.setItem(LS_SUITE_HANDLE, JSON.stringify(cookie))
      } catch {
        /* soft */
      }
      return cookie
    }
    setCookie(COOKIE_SUITE_HANDLE, JSON.stringify(compactForCookie(local)), 30 * 24 * 60 * 60)
    return local
  }
  if (local) {
    setCookie(COOKIE_SUITE_HANDLE, JSON.stringify(compactForCookie(local)), 30 * 24 * 60 * 60)
    return local
  }
  if (cookie) {
    try {
      localStorage.setItem(LS_SUITE_HANDLE, JSON.stringify(cookie))
    } catch {
      /* soft */
    }
    return cookie
  }
  return null
}

export function persistSuiteHandle(
  profile: Omit<SuiteHandleProfile, 'updatedAt'> & { updatedAt?: number },
): SuiteHandleProfile {
  const handle = String(profile.handle)
    .replace(/^@/, '')
    .toLowerCase()
  if (isBlockedHandle(handle)) {
    clearSuiteHandle()
    throw new Error('blocked_handle')
  }
  const full: SuiteHandleProfile = {
    handle,
    address: String(profile.address).trim(),
    chain: profile.chain ? String(profile.chain).slice(0, 32) : 'xrpl',
    accounts:
      profile.accounts && typeof profile.accounts === 'object'
        ? profile.accounts
        : undefined,
    displayName: profile.displayName || profile.handle,
    bio: String(profile.bio || '').slice(0, 280),
    news: String(profile.news || '').slice(0, 500),
    avatar: profile.avatar || '',
    avatarUrl: profile.avatarUrl || '',
    bannerUrl: profile.bannerUrl || '',
    verified: Boolean(profile.verified),
    isProject: Boolean(profile.isProject),
    projectName: String(profile.projectName || '').slice(0, 80),
    projectUrl: String(profile.projectUrl || '').slice(0, 500),
    projectTagline: String(profile.projectTagline || '').slice(0, 160),
    socials: normalizeSocials(profile.socials),
    updatedAt: profile.updatedAt || Date.now(),
  }
  const compact = compactForCookie(full)
  const json = JSON.stringify(compact)
  try {
    // Full (incl. short fields) in LS — avatar blob separate if data:
    localStorage.setItem(LS_SUITE_HANDLE, JSON.stringify({ ...full, ...compact }))
  } catch {
    /* soft */
  }
  setCookie(COOKIE_SUITE_HANDLE, json, 30 * 24 * 60 * 60)
  return { ...full, ...compact }
}

export function clearSuiteHandle(): void {
  try {
    localStorage.removeItem(LS_SUITE_HANDLE)
    localStorage.removeItem(LS_SUITE_HANDLE_AVATAR)
  } catch {
    /* soft */
  }
  setCookie(COOKIE_SUITE_HANDLE, '', 0)
}

/**
 * Pull @handle + avatar + bio from Social by XRPL (or multi-chain) address.
 * Feeds the suite rail on every app via Domain=.riddlewallet.com cookie.
 */
export async function refreshSuiteHandleFromSocial(
  address: string,
  opts?: { force?: boolean },
): Promise<SuiteHandleProfile | null> {
  const addr = String(address || '').trim()
  if (!addr) return readSuiteHandle()
  const cached = readSuiteHandle()
  if (
    !opts?.force &&
    cached &&
    cached.address.toLowerCase() === addr.toLowerCase() &&
    Date.now() - (cached.updatedAt || 0) < 5 * 60 * 1000
  ) {
    return cached
  }
  try {
    const res = await fetch(
      `${SOCIAL_API_BASE}/api/handles/by-address?address=${encodeURIComponent(addr)}`,
      { mode: 'cors', credentials: 'omit', headers: { Accept: 'application/json' } },
    )
    if (res.status === 404) {
      if (cached && cached.address.toLowerCase() === addr.toLowerCase()) clearSuiteHandle()
      return null
    }
    if (!res.ok) return cached
    const data = (await res.json()) as {
      handle?: string
      address?: string
      chain?: string
      displayName?: string
      bio?: string
      news?: string
      avatar?: string
      avatarUrl?: string
      bannerUrl?: string
      verified?: boolean
      isProject?: boolean
      projectName?: string
      projectUrl?: string
      projectTagline?: string
      socials?: SuiteHandleSocials
      accounts?: Record<string, string>
    }
    if (!data?.handle || isBlockedHandle(data.handle)) {
      if (cached && cached.address.toLowerCase() === addr.toLowerCase()) clearSuiteHandle()
      return null
    }
    try {
      return persistSuiteHandle({
        handle: data.handle,
        address: data.address || addr,
        chain: data.chain || 'xrpl',
        accounts: data.accounts,
        displayName: data.displayName || data.handle,
        bio: data.bio || '',
        news: data.news || '',
        avatar: data.avatar || '',
        avatarUrl: data.avatarUrl || data.avatar || '',
        bannerUrl: data.bannerUrl || '',
        verified: Boolean(data.verified),
        isProject: Boolean(data.isProject),
        projectName: data.projectName || '',
        projectUrl: data.projectUrl || '',
        projectTagline: data.projectTagline || '',
        socials: data.socials,
      })
    } catch {
      clearSuiteHandle()
      return null
    }
  } catch {
    return cached
  }
}
