'use client'

/**
 * Suite consent banner — first-visit dialog + always-available Accept/Reject
 * so users (and inspect exercises) can re-click after a prior decision.
 *
 * Exercise FAIL fix (rw-cookie-banner-exercise-fail): never unmount Accept/Reject
 * after the first choice; collapse to a manage strip that stays clickable.
 */
import { useEffect, useState } from 'react'
import { ACCOUNT_URL } from './suite-shell-config'
import { hasConsentedToAnalytics, readSuiteConsent, writeSuiteConsent } from './consent'

export type SuiteConsentBannerProps = {
  className?: string
}

export default function SuiteConsentBanner({ className = '' }: SuiteConsentBannerProps) {
  /** Full banner (first visit or user reopened manage UI). */
  const [expanded, setExpanded] = useState(false)
  /** Hydrated so SSR never flashes wrong mode. */
  const [ready, setReady] = useState(false)
  const [analyticsOn, setAnalyticsOn] = useState<boolean | null>(null)

  useEffect(() => {
    const sync = () => {
      const c = readSuiteConsent()
      setAnalyticsOn(c === null ? null : c.analytics)
      // Expand when no decision yet; keep manage strip when decided
      if (c === null) setExpanded(true)
    }
    sync()
    setReady(true)

    const onChange = () => {
      const c = readSuiteConsent()
      setAnalyticsOn(c === null ? null : c.analytics)
      // After a choice, collapse the large dialog but keep manage strip mounted
      if (c !== null) setExpanded(false)
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

  // SSR / pre-hydrate: still mount a zero-visibility shell so DOM testids exist
  // after first paint; full interaction after ready.
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

  const accept = () => {
    // Optimistic UI so Accept/Reject stay visible & re-clickable immediately
    setAnalyticsOn(true)
    writeSuiteConsent({ analytics: true })
    setExpanded(false)
  }
  const reject = () => {
    setAnalyticsOn(false)
    writeSuiteConsent({ analytics: false })
    setExpanded(false)
  }

  const undecided = analyticsOn === null
  // Always mount Accept/Reject so they remain re-clickable after first decision.
  // Full dialog when undecided or force-expanded; compact manage strip otherwise.
  const showFull = undecided || expanded

  return (
    <div
      className={[
        'rw-suite-consent',
        showFull ? '' : 'rw-suite-consent--manage',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role={showFull ? 'dialog' : 'region'}
      aria-live="polite"
      aria-label={showFull ? 'Cookie consent' : 'Cookie preferences'}
      data-suite-consent="1"
      data-suite-consent-mode={showFull ? 'banner' : 'manage'}
      data-suite-consent-analytics={
        analyticsOn === null ? 'unset' : analyticsOn ? 'on' : 'off'
      }
    >
      <div className="rw-suite-consent__card">
        {showFull ? (
          <p className="rw-suite-consent__text">
            We use optional analytics cookies to improve the suite. Strictly-necessary storage
            (session, handle cache) is always used.{' '}
            <a href={ACCOUNT_URL} target="_blank" rel="noopener noreferrer">
              Learn more
            </a>
          </p>
        ) : (
          <p className="rw-suite-consent__text rw-suite-consent__text--compact">
            Cookies: {analyticsOn ? 'analytics on' : 'analytics off'}. Change anytime.
          </p>
        )}
        <div className="rw-suite-consent__actions">
          <button
            type="button"
            className="rw-suite-consent__btn rw-suite-consent__btn--accept"
            onClick={accept}
            data-testid="consent-accept"
            data-rdl-consent="accept"
            aria-pressed={analyticsOn === true}
            aria-label="Accept analytics"
          >
            Accept analytics
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
    // Banner (or manage strip) is always mounted after hydrate
    setVisible(true)
    const onChange = () => setVisible(true)
    window.addEventListener('riddle-consent-changed', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('riddle-consent-changed', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])
  return visible
}

export { hasConsentedToAnalytics }
