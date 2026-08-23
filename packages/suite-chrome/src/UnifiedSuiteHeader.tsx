'use client';

/**
 * CANONICAL suite header v2 — SSOT in @riddle/suite-chrome.
 * Apps import this package; do not fork or copy-paste.
 * Solid chrome · CSS-first · single version stamp · optional credits chip.
 */
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CREDITS_URL,
  suiteCreditsTopUpHref,
  APP_LABELS,
  SUITE_CHROME_VERSION,
  SUITE_MORE_LABEL,
  SUITE_MORE_PILLS,
  SUITE_PRIMARY_PILLS,
  SUITE_SHELL_URLS,
  SUITE_SOCIAL_RAIL_PX,
  type SuiteShellAppId,
} from './suite-shell-config'
import SuiteSocialRail from './SuiteSocialRail'
import SuiteAccountControl from './SuiteAccountControl'
import { useSuiteCredits, useSuiteTier } from '@riddle/suite-credits'

export type UnifiedSuiteHeaderProps = {
  current?: SuiteShellAppId
  appLabel?: string
  rightSlot?: ReactNode
  /** Extra content under the main row (rare) */
  subRow?: ReactNode
  className?: string
  hidePills?: boolean
  /** Live address for @handle rail hydration */
  address?: string | null
  /** Render the social rail under the header (default false in v2 — footer carries socials). */
  showSocialRail?: boolean
  /** Render the credits/tier chip (default true). */
  showCredits?: boolean
  /**
   * Render the shared wallet control when the app supplies no `rightSlot`
   * (default true). The wallet app passes its own richer control instead.
   */
  showAccount?: boolean
  logoSrc?: string
}

/**
 * Overflow menu holding every non-primary destination. The header shows five
 * pills; nothing is removed from the suite, it just stops competing for the
 * same row.
 */
function SuiteMoreMenu({ current }: { current: SuiteShellAppId }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const activeInMenu = SUITE_MORE_PILLS.some((p) => p.id === current)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="rw-suite-header__more" ref={rootRef}>
      <button
        type="button"
        className="rw-suite-header__pill rw-suite-header__pill--more"
        data-suite-more="1"
        data-active={activeInMenu ? '1' : '0'}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {SUITE_MORE_LABEL}
        <span className="rw-suite-header__more-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="rw-suite-header__more-menu" role="menu">
          {SUITE_MORE_PILLS.map((p) => (
            <a
              key={p.id}
              href={p.href}
              role="menuitem"
              aria-current={p.id === current ? 'page' : undefined}
              data-suite-pill={p.id}
              data-active={p.id === current ? '1' : '0'}
              className="rw-suite-header__more-item"
            >
              {p.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function formatCredits(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  return Math.floor(n).toLocaleString('en-US')
}

const TIER_DOT: Record<string, string> = {
  free: '#71717a',
  bronze: '#f59e0b',
  silver: '#94a3b8',
  gold: '#facc15',
}

/** Always-visible suite credits chip — every header, including 0 cr. */
function SuiteCreditsChip({ fromApp }: { fromApp?: SuiteShellAppId }) {
  const { balance, loading } = useSuiteCredits()
  const { tier } = useSuiteTier()
  const dot = TIER_DOT[tier] || TIER_DOT.free
  const href = suiteCreditsTopUpHref(fromApp) || CREDITS_URL

  const crLabel = useMemo(() => {
    if (loading) return '… cr'
    return `${formatCredits(balance)} cr`
  }, [balance, loading])

  return (
    <a
      href={href}
      className="rw-suite-header__credits"
      title="Suite credits · 100 cr = $1 · top up in Wallet"
      aria-label={`Suite credits ${crLabel}, ${tier} tier`}
      data-testid="suite-credits-chip"
      data-suite-credits={loading ? undefined : String(Math.max(0, Math.floor(balance)))}
      data-suite-tier={tier}
    >
      <span
        className="rw-suite-header__credits-dot"
        style={{ backgroundColor: dot }}
        aria-hidden
      />
      <span className="rw-suite-header__credits-tier">{tier}</span>
      <span className="rw-suite-header__credits-balance">{crLabel}</span>
    </a>
  )
}

export function UnifiedSuiteHeader({
  current = 'wallet',
  appLabel,
  rightSlot,
  subRow,
  className = '',
  hidePills = false,
  address,
  showSocialRail = false,
  // Credits chip is mandatory on every suite header (cannot be opted out).
  showCredits: _showCredits = true,
  showAccount = true,
  logoSrc = 'https://wallet.riddlewallet.com/rdllogo-40.png',
}: UnifiedSuiteHeaderProps) {
  const showCredits = true
  void _showCredits
  const sub = (appLabel || APP_LABELS[current] || 'RIDDLE').toUpperCase()
  const homeHref =
    current === 'hub' ? SUITE_SHELL_URLS.hub : SUITE_SHELL_URLS[current] || SUITE_SHELL_URLS.hub
  const [logoFailed, setLogoFailed] = useState(false)
  const hasSubRow = showSocialRail || Boolean(subRow)

  return (
    <header
      className={['rw-suite-header', className].filter(Boolean).join(' ')}
      data-suite-header="1"
      data-suite-header-size="sm"
      data-suite-chrome-version={SUITE_CHROME_VERSION}
      data-suite-current={current}
    >
      <div className="rw-suite-header__row">
        <a
          href={homeHref}
          className="rw-suite-header__brand"
          aria-label="Riddle home"
        >
          <span className="rw-suite-header__brand-mark">
            {!logoFailed ? (
              <img
                src={logoSrc}
                alt=""
                width={28}
                height={28}
                onError={() => setLogoFailed(true)}
              />
            ) : null}
            {logoFailed ? <span className="rw-suite-header__brand-fallback">r</span> : null}
          </span>
          <span className="rw-suite-header__brand-text">
            <span className="rw-suite-header__brand-name">riddle</span>
            <span className="rw-suite-header__brand-sublabel">{sub}</span>
          </span>
        </a>

        {!hidePills ? (
          <>
            <nav
              className="rw-suite-header__pills"
              aria-label="Riddle suite apps"
            >
              <div className="rw-suite-header__pills-inner">
                {SUITE_PRIMARY_PILLS.map((p) => {
                  const active = p.id === current
                  return (
                    <a
                      key={p.id}
                      href={p.href}
                      aria-current={active ? 'page' : undefined}
                      data-suite-pill={p.id}
                      data-active={active ? '1' : '0'}
                      className="rw-suite-header__pill"
                    >
                      {p.label}
                    </a>
                  )
                })}
              </div>
            </nav>
            {/*
              Deliberately a sibling of the pills nav, not a child of it.
              `.rw-suite-header__pills` sets overflow-x:auto for pill
              scrolling, and a scroll container clips BOTH axes (overflow-y
              computes to auto), so an absolutely-positioned dropdown rendered
              inside it was clipped away — the button toggled but nothing was
              visible. Out here it can overhang the header.
            */}
            <SuiteMoreMenu current={current} />
          </>
        ) : null}

        {showCredits || showAccount || rightSlot ? (
          <div className="rw-suite-header__right">
            {showCredits ? <SuiteCreditsChip fromApp={current} /> : null}
            {/* Apps that pass their own control (the wallet) win; everyone
                else gets the shared one, so the wallet is reachable from
                every page of the suite. */}
            {rightSlot ?? (showAccount ? <SuiteAccountControl current={current} /> : null)}
          </div>
        ) : null}
      </div>

      {hasSubRow ? (
        <div
          className="rw-suite-header__sub"
          data-suite-header-sub="1"
          style={{ height: subRow && !showSocialRail ? undefined : SUITE_SOCIAL_RAIL_PX }}
        >
          <div className="rw-suite-header__sub-inner">
            {showSocialRail ? <SuiteSocialRail address={address} /> : null}
            {subRow}
          </div>
        </div>
      ) : null}
    </header>
  )
}

/**
 * Spacer for legacy layouts that reserved room under a fixed header.
 * Header is now in-flow (scrolls with the page) — spacer is a zero-height no-op.
 */
export function SuiteHeaderSpacer({
  hasSubRow = false,
  className = '',
}: {
  hasSubRow?: boolean
  className?: string
}) {
  void hasSubRow
  return (
    <div
      aria-hidden
      className={className}
      data-suite-header-spacer="1"
      data-suite-chrome-version={SUITE_CHROME_VERSION}
      style={{
        height: 0,
        minHeight: 0,
        maxHeight: 0,
        overflow: 'hidden',
        margin: 0,
        padding: 0,
        flexShrink: 0,
        pointerEvents: 'none',
      }}
    />
  )
}

export default UnifiedSuiteHeader
