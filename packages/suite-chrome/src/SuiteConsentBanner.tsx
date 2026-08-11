'use client'

/**
 * Suite consent banner — first-visit dialog.
 *
 * Accept / Reject MUST dismiss the banner completely. Re-open only via
 * `openSuiteConsentBanner()` (footer “Cookies” / manage preferences).
 *
 * Root cause of “Accept does nothing”: after write, a change handler re-read
 * storage (which could miss Domain-scoped cookies) and reset analyticsOn to
 * null, which forced the full dialog back open. We now trust the click +
 * event detail and only re-read for cross-tab storage events.
 */
import { useCallback, useEffect, useState, type MouseEvent, type PointerEvent } from 'react'
import { ACCOUNT_URL } from './suite-shell-config'
import {
  hasConsentedToAnalytics,
  readSuiteConsent,
  writeSuiteConsent,
} from './consent'

export type SuiteConsentBannerProps = {
  className?: string
}

export default function SuiteConsentBanner({ className = '' }: SuiteConsentBannerProps) {
  /** Full banner (first visit or user reopened manage UI). */
  const [expanded, setExpanded] = useState(false)
  /** Hydrated so SSR never flashes wrong mode. */
  const [ready, setReady] = useState(false)
  /** null = undecided; true/false = stored choice */
  const [analyticsOn, setAnalyticsOn] = useState<boolean | null>(null)

  useEffect(() => {
    const syncFromStorage = () => {
      // sessionStorage backup if LS/cookie missing this session
      let c = readSuiteConsent()
      if (!c) {
        try {
          const raw = sessionStorage.getItem('rdl_consent')
          if (raw) {
            const p = JSON.parse(raw) as { analytics?: boolean }
            if (typeof p.analytics === 'boolean') c = { analytics: p.analytics }
          }
        } catch {
          /* soft */
        }
      }
      setAnalyticsOn(c === null ? null : c.analytics)
      // Only auto-expand when no decision yet
      if (c === null) setExpanded(true)
      else setExpanded(false)
    }

    syncFromStorage()
    setReady(true)

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { analytics?: boolean }
        | null
        | undefined
      if (detail === null) {
        setAnalyticsOn(null)
        setExpanded(true)
        return
      }
      if (detail && typeof detail.analytics === 'boolean') {
        setAnalyticsOn(detail.analytics)
        setExpanded(false)
        return
      }
      // Fallback re-read (storage event from other tab)
      syncFromStorage()
    }

    const onOpen = () => setExpanded(true)

    window.addEventListener('riddle-consent-changed', onChange)
    window.addEventListener('riddle-consent-open', onOpen)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('riddle-consent-changed', onChange)
      window.removeEventListener('riddle-consent-open', onOpen)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const accept = useCallback((e?: MouseEvent | PointerEvent) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    // Optimistic dismiss — must not wait on storage
    setAnalyticsOn(true)
    setExpanded(false)
    writeSuiteConsent({ analytics: true })
  }, [])

  const reject = useCallback((e?: MouseEvent | PointerEvent) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    setAnalyticsOn(false)
    setExpanded(false)
    writeSuiteConsent({ analytics: false })
  }, [])

  // SSR / pre-hydrate placeholder
  if (!ready) {
    return (
      <div
        className={['rw-suite-consent', 'rw-suite-consent--pending', className]
          .filter(Boolean)
          .join(' ')}
        data-suite-consent="1"
        data-suite-consent-mode="pending"
        aria-hidden="true"
      />
    )
  }

  const undecided = analyticsOn === null
  // Full dialog only when undecided or user reopened manage UI
  const showFull = undecided || expanded

  // After a decision and not reopened: unmount banner entirely (Accept “goes”)
  if (!showFull) {
    return (
      <div
        className={['rw-suite-consent', 'rw-suite-consent--hidden', className]
          .filter(Boolean)
          .join(' ')}
        data-suite-consent="1"
        data-suite-consent-mode="hidden"
        data-suite-consent-analytics={analyticsOn ? 'on' : 'off'}
        hidden
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      className={['rw-suite-consent', className].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal="false"
      aria-live="polite"
      aria-label="Cookie consent"
      data-suite-consent="1"
      data-suite-consent-mode="banner"
      data-suite-consent-analytics={
        analyticsOn === null ? 'unset' : analyticsOn ? 'on' : 'off'
      }
    >
      <div className="rw-suite-consent__card">
        <p className="rw-suite-consent__text">
          We use optional analytics cookies to improve the suite. Strictly-necessary storage
          (session, handle cache) is always used.{' '}
          <a href={ACCOUNT_URL} target="_blank" rel="noopener noreferrer">
            Learn more
          </a>
        </p>
        <div className="rw-suite-consent__actions">
          <button
            type="button"
            className="rw-suite-consent__btn rw-suite-consent__btn--accept"
            onClick={accept}
            data-testid="consent-accept"
            data-rdl-consent="accept"
            aria-pressed={analyticsOn === true}
            aria-label="Accept cookies"
          >
            Accept cookies
          </button>
          <button
            type="button"
            className="rw-suite-consent__btn rw-suite-consent__btn--reject"
            onClick={reject}
            data-testid="consent-reject"
            data-rdl-consent="reject"
            aria-pressed={analyticsOn === false}
            aria-label="Reject optional"
          >
            Reject optional
          </button>
        </div>
      </div>
    </div>
  )
}

export function useSuiteConsentBannerVisible(): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const sync = () => {
      const c = readSuiteConsent()
      // Visible only when no decision yet
      setVisible(c === null)
    }
    sync()
    const onChange = () => sync()
    window.addEventListener('riddle-consent-changed', onChange)
    window.addEventListener('storage', onChange)
    window.addEventListener('riddle-consent-open', () => setVisible(true))
    return () => {
      window.removeEventListener('riddle-consent-changed', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])
  return visible
}

export { hasConsentedToAnalytics }
