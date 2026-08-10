'use client';

/**
 * Suite analytics gate — renders Vercel Analytics only after explicit consent.
 */
import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { hasConsentedToAnalytics, subscribeConsent } from './consent'

export type SuiteAnalyticsProps = {
  /** Inject Vercel script even before consent (default false). */
  injectImplied?: boolean
}

export default function SuiteAnalytics({ injectImplied = false }: SuiteAnalyticsProps) {
  const [allowed, setAllowed] = useState(injectImplied)

  useEffect(() => {
    setAllowed(injectImplied || hasConsentedToAnalytics())
    return subscribeConsent((c) => {
      setAllowed(injectImplied || c?.analytics === true)
    })
  }, [injectImplied])

  if (!allowed) return null
  return <Analytics />
}
