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
    const parsed = JSON.parse(raw) as Partial<SuiteConsent>
    if (parsed && typeof parsed.analytics === 'boolean' && parsed.v === 1) {
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
      if (part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1))
    }
  } catch {
    /* soft */
  }
  return null
}

function writeCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === 'undefined') return
  try {
    const secure = isSecure() ? '; Secure' : ''
    const domain = isSuiteHost() ? '; Domain=.riddlewallet.com' : ''
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}${domain}`
  } catch {
    /* soft */
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

function writeLocal(consent: SuiteConsent): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(consent))
  } catch {
    /* soft */
  }
}

export function readSuiteConsent(): { analytics: boolean } | null {
  if (typeof window === 'undefined') return null
  return parseConsent(readCookie(COOKIE_NAME)) || readLocal()
}

export function writeSuiteConsent({ analytics }: { analytics: boolean }): void {
  const consent: SuiteConsent = { analytics, ts: Date.now(), v: 1 }
  writeCookie(COOKIE_NAME, JSON.stringify(consent), 365 * 24 * 60 * 60)
  writeLocal(consent)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: consent }))
    } catch {
      /* soft */
    }
  }
}

/** Clear stored consent so the banner can be shown again (preference change). */
export function clearSuiteConsent(): void {
  if (typeof window === 'undefined') return
  try {
    writeCookie(COOKIE_NAME, '', 0)
    // Also clear suite-domain legacy copy if present
    const secure = isSecure() ? '; Secure' : ''
    const domain = isSuiteHost() ? '; Domain=.riddlewallet.com' : ''
    document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}${domain}`
    localStorage.removeItem(LS_KEY)
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
    const detail = (e as CustomEvent).detail as SuiteConsent | undefined
    listener(detail || readSuiteConsent())
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(EVENT_NAME, onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EVENT_NAME, onCustom)
  }
}
