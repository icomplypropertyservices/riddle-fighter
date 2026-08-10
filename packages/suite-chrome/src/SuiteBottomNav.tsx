/**
 * CANONICAL suite bottom nav v2 — SSOT in @riddle/suite-chrome.
 * Three modes: suite (default), app (custom tabs), game (game dock).
 * Solid chrome · safe-area · touch ≥44.
 */
import {
  gameBottomTabs,
  SUITE_BOTTOM_TABS,
  SUITE_CHROME_VERSION,
  type GameBottomTabId,
  type SuiteShellAppId,
} from './suite-shell-config'

export type SuiteBottomTab = {
  id: string
  label: string
  href: string
  icon?: string
  active?: boolean
}

export type SuiteBottomNavMode = 'suite' | 'app' | 'game'

export type SuiteBottomNavProps = {
  /** Highlight suite app id (wallet, cafe, …). */
  current?: SuiteShellAppId | string
  /** Override default suite tabs with app-local tabs (max 6). Alias: `items`. */
  tabs?: SuiteBottomTab[]
  items?: SuiteBottomTab[]
  /** Three modes. Defaults to 'app' when tabs/items provided, else 'suite'. */
  mode?: SuiteBottomNavMode
  /** Game dock active tab. */
  gameActive?: GameBottomTabId
  /** Cities mode for game dock highlight. */
  citiesMode?: 'build' | 'civ' | string
  className?: string
  /** Hide on desktop (default true). */
  mobileOnly?: boolean
}

export function SuiteBottomNav({
  current,
  tabs,
  items,
  mode,
  gameActive,
  citiesMode,
  className = '',
  mobileOnly = true,
}: SuiteBottomNavProps) {
  const resolvedMode: SuiteBottomNavMode =
    mode ?? ((tabs && tabs.length) || (items && items.length) ? 'app' : 'suite')

  const navItems: SuiteBottomTab[] = (() => {
    if (resolvedMode === 'game') {
      const dock = gameBottomTabs(gameActive || 'cities', { citiesMode })
      return dock.map((t) => ({ id: t.id, label: t.label, href: t.href, icon: t.icon, active: t.active }))
    }
    const custom = (tabs && tabs.length ? tabs : items) || []
    if (custom.length) return custom.slice(0, 6)
    return SUITE_BOTTOM_TABS.map((t) => ({
      id: t.id,
      label: t.label,
      href: t.href,
      icon: t.icon,
    }))
  })()

  return (
    <nav
      className={[
        'rw-suite-bottom-nav',
        mobileOnly ? 'rw-suite-bottom-nav--mobile' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Primary"
      data-suite-bottom-nav="1"
      data-suite-chrome-version={SUITE_CHROME_VERSION}
    >
      <div className="rw-suite-bottom-nav__row">
        {navItems.map((tab) => {
          const active =
            tab.active === true ||
            (tab.active !== false && current != null && String(tab.id) === String(current))
          return (
            <a
              key={tab.id}
              href={tab.href}
              data-nav-id={tab.id}
              data-active={active ? '1' : '0'}
              aria-current={active ? 'page' : undefined}
              className="rw-suite-bottom-nav__item"
            >
              <span className="rw-suite-bottom-nav__icon" aria-hidden>
                {tab.icon || '•'}
              </span>
              <span className="rw-suite-bottom-nav__label">{tab.label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}

/** Spacer so page content clears the fixed bottom nav + safe area. */
export function SuiteBottomNavSpacer({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      data-suite-bottom-spacer="1"
      style={{
        height: 'calc(52px + env(safe-area-inset-bottom, 0px))',
        flexShrink: 0,
      }}
    />
  )
}

export default SuiteBottomNav
