/**
 * Suite consent SSOT — framework-agnostic, SSR-safe.
 * Stores choice in cookie + localStorage mirror.
 */

export interface SuiteConsent {
  analytics: boolean
  ts: number
  v: 1
}

const COOKIE_NAME = 'rdl_consent'
const LS_KEY = 'rdl_consent'
const EVENT_NAME = 'riddle-consent-changed'

function isSuiteHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'riddlewallet.com' || h.endsWith('.riddlewallet.com')
}

function isSecure(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.protocol === 'https:'
}

function parseConsent(raw: string | null): SuiteConsent | null {
  if (!raw) return null
  try {
    let text = raw
    // Tolerate accidental double-encoding
    if (text.includes('%7B') || text.includes('%22')) {
      try {
        text = decodeURIComponent(text)
      } catch {
        /* keep original */
      }
    }
    const parsed = JSON.parse(text) as Partial<SuiteConsent>
    if (parsed && typeof parsed.analytics === 'boolean') {
      // Accept v missing (legacy) as v1
      const v = parsed.v === 1 || parsed.v == null ? 1 : null
      if (v !== 1) return null
      return {
        analytics: parsed.analytics,
        ts: Number(parsed.ts) || Date.now(),
        v: 1,
      }
    }
  } catch {
    /* soft */
  }
  return null
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  try {
    for (const part of document.cookie.split('; ')) {
      const i = part.indexOf('=')
      if (i < 0) continue
      if (part.slice(0, i) === name) {
        const raw = part.slice(i + 1)
        try {
          return decodeURIComponent(raw)
        } catch {
          return raw
        }
      }
    }
  } catch {
    /* soft */
  }
  return null
}

function writeCookie(name: string, value: string, maxAgeSec: number): boolean {
  if (typeof document === 'undefined') return false
  try {
    const secure = isSecure() ? '; Secure' : ''
    // Host-only first (always works on the current origin)
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(
      0,
      maxAgeSec,
    )}; SameSite=Lax${secure}`
    // Suite-wide Domain when on *.riddlewallet.com
    if (isSuiteHost()) {
      document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(
        0,
        maxAgeSec,
      )}; SameSite=Lax${secure}; Domain=.riddlewallet.com`
    }
    return true
  } catch {
    return false
  }
}

function readLocal(): SuiteConsent | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return parseConsent(localStorage.getItem(LS_KEY))
  } catch {
    return null
  }
}

function writeLocal(consent: SuiteConsent): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(consent))
    return true
  } catch {
    return false
  }
}

export function readSuiteConsent(): { analytics: boolean } | null {
  if (typeof window === 'undefined') return null
  // Prefer LS (never blocked by Domain=.riddlewallet.com quirks), then cookie
  return readLocal() || parseConsent(readCookie(COOKIE_NAME))
}

/**
 * Persist consent. Returns true if at least one store accepted the write.
 * Always dispatches the change event with the in-memory choice so UI dismisses
 * even when storage is restricted.
 */
export function writeSuiteConsent({ analytics }: { analytics: boolean }): boolean {
  const consent: SuiteConsent = { analytics, ts: Date.now(), v: 1 }
  const raw = JSON.stringify(consent)
  const lsOk = writeLocal(consent)
  const cookieOk = writeCookie(COOKIE_NAME, raw, 365 * 24 * 60 * 60)
  // sessionStorage backup so same-tab reloads still dismiss even if LS/cookie blocked
  try {
    sessionStorage.setItem(LS_KEY, raw)
  } catch {
    /* soft */
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: consent }))
    } catch {
      /* soft */
    }
  }
  return lsOk || cookieOk
}

/** Clear stored consent so the banner can be shown again (preference change). */
export function clearSuiteConsent(): void {
  if (typeof window === 'undefined') return
  try {
    writeCookie(COOKIE_NAME, '', 0)
    const secure = isSecure() ? '; Secure' : ''
    if (isSuiteHost()) {
      document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}; Domain=.riddlewallet.com`
    }
    document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
    localStorage.removeItem(LS_KEY)
    try {
      sessionStorage.removeItem(LS_KEY)
    } catch {
      /* soft */
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: null }))
  } catch {
    /* soft */
  }
}

/** Ask SuiteConsentBanner to open manage UI (Accept/Reject re-clickable). */
export function openSuiteConsentBanner(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('riddle-consent-open'))
  } catch {
    /* soft */
  }
}

export function hasConsentedToAnalytics(): boolean {
  const c = readSuiteConsent()
  return c?.analytics === true
}

export type ConsentListener = (consent: { analytics: boolean } | null) => void

export function subscribeConsent(listener: ConsentListener): () => void {
  if (typeof window === 'undefined') return () => {}

  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY || e.key === null) {
      listener(readSuiteConsent())
    }
  }

  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent).detail as SuiteConsent | null | undefined
    // Prefer event detail so Accept/Reject UI never re-opens from a failed re-read
    if (detail === null) {
      listener(null)
      return
    }
    if (detail && typeof detail.analytics === 'boolean') {
      listener({ analytics: detail.analytics })
      return
    }
    listener(readSuiteConsent())
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(EVENT_NAME, onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EVENT_NAME, onCustom)
  }
}
