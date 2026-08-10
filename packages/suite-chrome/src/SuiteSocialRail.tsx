'use client';

/**
 * CANONICAL suite social rail v2 — SSOT in @riddle/suite-chrome.
 * Apps import this package; do not fork or copy-paste.
 * Solid chrome · inline SVG icons · identity-guard SSOT.
 */
import { useEffect, useState, type JSX } from 'react'
import {
  formatSuiteHandle,
  readSuiteHandle,
  refreshSuiteHandleFromSocial,
  suiteHandleImage,
  type SuiteHandleProfile,
} from './suiteHandle'
import {
  SUITE_SHELL_URLS,
  SUITE_SOCIALS,
  SUITE_CHROME_VERSION,
} from './suite-shell-config'
import { isForbiddenChromeAddress } from './identity-guard'

export type SuiteSocialRailProps = {
  address?: string | null
  className?: string
}

const SOCIAL_SVGS: Record<string, (props: { className?: string }) => JSX.Element> = {
  x: ({ className }) => (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M9.47 6.77 15.23 0h-1.37L8.86 5.88 4.79 0H0l6.05 8.89L0 16h1.37l5.02-5.93L10.88 16H16M1.67 1.04h2.18l10.03 14.1h-2.18" fill="currentColor" />
    </svg>
  ),
  twitter: ({ className }) => (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M9.47 6.77 15.23 0h-1.37L8.86 5.88 4.79 0H0l6.05 8.89L0 16h1.37l5.02-5.93L10.88 16H16M1.67 1.04h2.18l10.03 14.1h-2.18" fill="currentColor" />
    </svg>
  ),
  discord: ({ className }) => (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M13.54 3.08A11.5 11.5 0 0 0 10.55 2c-.15.27-.33.63-.45.92a10.7 10.7 0 0 0-3.2 0A9.7 9.7 0 0 0 6.45 2a11.5 11.5 0 0 0-3 1.08C1.23 6.78 1.05 10.45 2.05 14c1.34 1 2.64 1.6 3.92 1.6.33-.45.62-.92.87-1.42-.48-.18-.93-.4-1.37-.68.12-.08.22-.17.33-.25 2.62 1.22 5.47 1.22 8.05 0l.33.25c-.44.28-.9.5-1.37.68.25.5.54.98.87 1.42 1.28 0 2.58-.6 3.92-1.6 1.14-4.02.47-7.66-1.93-10.92zM5.9 11.5c-.78 0-1.43-.73-1.43-1.62S5.1 8.26 5.9 8.26s1.45.73 1.43 1.62c-.02.9-.65 1.62-1.43 1.62zm4.2 0c-.78 0-1.43-.73-1.43-1.62s.65-1.62 1.43-1.62 1.45.73 1.43 1.62c-.02.9-.65 1.62-1.43 1.62z" fill="currentColor" />
    </svg>
  ),
  telegram: ({ className }) => (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M14.85 2.07 12.6 13.3c-.18.78-.64.97-1.3.6l-3.6-2.65-1.74 1.67c-.19.2-.35.36-.71.36l.26-3.65 6.67-6.02c.29-.26-.06-.4-.45-.14L3.7 8.9.3 7.85c-.76-.24-.78-.76.16-1.12l13.6-5.24c.64-.23 1.2.15.99 1.2z" fill="currentColor" />
    </svg>
  ),
  github: ({ className }) => (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 0a8 8 0 0 0-8 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" fill="currentColor" />
    </svg>
  ),
}

/**
 * Player identity for chrome ONLY from:
 *  1) explicit prop (parent already resolved live session)
 *  2) live suite SSO `riddle_wallet_session`
 * NEVER from `riddle_last_address` (stale / device meta — caused “programmed wallet” ghosts).
 * NEVER ops/mint/treasury/issuer or internal test prefix rHvuNQ88.
 */
function resolveAddress(prop?: string | null): string {
  const fromProp = String(prop || '').trim()
  if (fromProp && !isForbiddenChromeAddress(fromProp)) return fromProp
  try {
    const raw = localStorage.getItem('riddle_wallet_session')
    if (raw) {
      const j = JSON.parse(raw) as { address?: string; source?: string }
      const addr = String(j?.address || '').trim()
      if (addr && !isForbiddenChromeAddress(addr)) return addr
    }
  } catch {
    /* soft */
  }
  // Do NOT fall back to riddle_last_address — that is not a live login.
  return ''
}

export default function SuiteSocialRail({ address, className = '' }: SuiteSocialRailProps) {
  const [profile, setProfile] = useState<SuiteHandleProfile | null>(() =>
    typeof window !== 'undefined' ? readSuiteHandle() : null,
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const addr = resolveAddress(address)
    setProfile(readSuiteHandle())
    if (!addr) return
    setLoading(true)
    void refreshSuiteHandleFromSocial(addr)
      .then((p) => {
        if (!cancelled) setProfile(p)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [address])

  const img = suiteHandleImage(profile)
  const handleLabel = profile
    ? formatSuiteHandle(profile.handle)
    : loading
      ? '…'
      : 'Claim @handle'
  const display = profile?.displayName || profile?.handle || ''
  const bio = (profile?.bio || '').trim()
  const profileHref = profile
    ? `${SUITE_SHELL_URLS.social}/u/${profile.handle}`
    : `${SUITE_SHELL_URLS.social}/claim`
  const title = profile
    ? [handleLabel, display && display !== profile.handle ? display : '', bio]
        .filter(Boolean)
        .join(' · ')
    : 'Claim your Riddle @handle on Social'

  return (
    <div
      className={['rw-suite-social-rail', className].filter(Boolean).join(' ')}
      data-suite-social-rail="1"
      data-suite-chrome-version={SUITE_CHROME_VERSION}
    >
      {/* Riddle @handle + avatar (Social wallet image) */}
      <a
        href={profileHref}
        className="rw-suite-rail-chip rw-suite-rail-chip--handle"
        title={title}
        data-testid="suite-rail-handle"
      >
        <span className="rw-suite-rail-avatar">
          {img ? (
            <img
              src={img}
              alt=""
              width={24}
              height={24}
              referrerPolicy="no-referrer"
            />
          ) : (
            (profile?.handle || '?')[0]?.toUpperCase()
          )}
        </span>
        <span className="rw-suite-rail-handle-label">{handleLabel}</span>
      </a>

      {/* Feed + DMs + Pay — same Social surfaces on every app */}
      <a
        href={`${SUITE_SHELL_URLS.social}/`}
        className="rw-suite-rail-chip"
        title="Social feed"
        data-testid="suite-rail-feed"
      >
        Feed
      </a>
      <a
        href={`${SUITE_SHELL_URLS.social}/messages`}
        className="rw-suite-rail-chip"
        title="Messages"
        data-testid="suite-rail-messages"
      >
        Messages
      </a>
      <a href={`${SUITE_SHELL_URLS.pay}/`} className="rw-suite-rail-chip" title="Pay by handle" data-testid="suite-rail-pay">
        Pay
      </a>

      <span className="rw-suite-rail-divider" aria-hidden />

      {/* Brand social pictures / labels */}
      {SUITE_SOCIALS.map((s) => {
        const Icon = SOCIAL_SVGS[s.id] || SOCIAL_SVGS.x
        return (
          <a
            key={s.id}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rw-suite-rail-chip rw-suite-rail-chip--social"
            title={s.label}
          >
            <Icon className="rw-suite-rail-icon" />
            {s.label}
          </a>
        )
      })}
    </div>
  )
}
