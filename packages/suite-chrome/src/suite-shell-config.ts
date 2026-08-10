/**
 * CANONICAL suite shell SSOT — copy verbatim into every app.
 * No process.env — same URLs everywhere.
 */

/**
 * Package version — single source of truth for all chrome components.
 * Header, footer, social rail and bottom nav all stamp this exact value, so a
 * mismatch between any two of them on a live app means that app is mid-deploy
 * or pinned to an old build.
 */
export const SUITE_CHROME_VERSION = '2.1.0'

export const ACCOUNT_URL = 'https://account.riddlewallet.com'

export const SUITE_SHELL_URLS = {
  hub: 'https://riddlewallet.com',
  wallet: 'https://wallet.riddlewallet.com',
  swap: 'https://swap.riddlewallet.com',
  bridge: 'https://bridge.riddlewallet.com',
  scanner: 'https://scanner.riddlewallet.com',
  cafe: 'https://cafe.riddlewallet.com',
  creator: 'https://creator.riddlewallet.com',
  dev: 'https://dev.riddlewallet.com',
  social: 'https://social.riddlewallet.com',
  pay: 'https://pay.riddlewallet.com',
  fighter: 'https://fighter.riddlewallet.com',
  world: 'https://civ.riddlewallet.com',
  cities: 'https://city.riddlewallet.com',
  // Secondary apps — same header, but not pills (nav stays identical everywhere).
  sniper: 'https://sniper.riddlewallet.com',
  loyalty: 'https://loyalty.riddlewallet.com',
  partners: 'https://partners.riddlewallet.com',
  admin: 'https://admin.riddlewallet.com',
  privacy: 'https://riddlewallet.com/privacy',
  terms: 'https://riddlewallet.com/terms',
} as const

export type SuiteShellAppId = keyof typeof SUITE_SHELL_URLS

export const SUITE_APP_PILLS: { id: SuiteShellAppId; label: string; href: string }[] = [
  { id: 'wallet', label: 'Wallet', href: SUITE_SHELL_URLS.wallet },
  { id: 'swap', label: 'Swap', href: SUITE_SHELL_URLS.swap },
  { id: 'bridge', label: 'Bridge', href: SUITE_SHELL_URLS.bridge },
  { id: 'scanner', label: 'Scanner', href: SUITE_SHELL_URLS.scanner },
  { id: 'cafe', label: 'Cafe', href: SUITE_SHELL_URLS.cafe },
  { id: 'cities', label: 'Cities', href: SUITE_SHELL_URLS.cities },
  { id: 'world', label: 'Civ', href: SUITE_SHELL_URLS.world },
  { id: 'dev', label: 'Dev', href: SUITE_SHELL_URLS.dev },
  { id: 'social', label: 'Social', href: SUITE_SHELL_URLS.social },
  { id: 'pay', label: 'Pay', href: SUITE_SHELL_URLS.pay },
  { id: 'fighter', label: 'Fight', href: SUITE_SHELL_URLS.fighter },
  { id: 'hub', label: 'Hub', href: SUITE_SHELL_URLS.hub },
]

/**
 * Header simplification (v2.1): only the primary five render as pills; the rest
 * live behind a "More" menu. `SUITE_APP_PILLS` stays the full ordered SSOT and
 * is still what the footer and the hub mirror enumerate — no destination is
 * lost, the header just stops rendering twelve equal-weight pills.
 */
export const SUITE_PRIMARY_PILL_IDS = [
  'wallet',
  'swap',
  'bridge',
  'cafe',
  'scanner',
] as const satisfies readonly SuiteShellAppId[]

export type SuitePrimaryPillId = (typeof SUITE_PRIMARY_PILL_IDS)[number]

const isPrimaryPill = (id: SuiteShellAppId): boolean =>
  (SUITE_PRIMARY_PILL_IDS as readonly SuiteShellAppId[]).includes(id)

/** Always-visible pills, in SUITE_PRIMARY_PILL_IDS order. */
export const SUITE_PRIMARY_PILLS = SUITE_PRIMARY_PILL_IDS.map(
  (id) => SUITE_APP_PILLS.find((p) => p.id === id)!,
)

/** Everything else, in SUITE_APP_PILLS order — rendered inside the More menu. */
export const SUITE_MORE_PILLS = SUITE_APP_PILLS.filter((p) => !isPrimaryPill(p.id))

/** Label for the header overflow trigger. */
export const SUITE_MORE_LABEL = 'More'

export const SUITE_BOTTOM_TABS: {
  id: SuiteShellAppId
  label: string
  href: string
  icon: string
}[] = [
  { id: 'wallet', label: 'Wallet', href: SUITE_SHELL_URLS.wallet, icon: '◇' },
  { id: 'cafe', label: 'Cafe', href: SUITE_SHELL_URLS.cafe, icon: '▣' },
  { id: 'swap', label: 'Swap', href: SUITE_SHELL_URLS.swap, icon: '⇄' },
  { id: 'scanner', label: 'Scan', href: SUITE_SHELL_URLS.scanner, icon: '◎' },
  { id: 'hub', label: 'More', href: SUITE_SHELL_URLS.hub, icon: '⋯' },
]

/**
 * Game dock — Cities / Civ / Fight / Wallet / Cafe (max 6).
 * Reborn removed from bottom nav — Civilizations (Civ) is the game identity surface.
 * Header pill links Civilisations (civ.riddlewallet.com).
 */
export type GameBottomTabId =
  | 'cities'
  | 'civ'
  | 'fighter'
  | 'wallet'
  | 'cafe'
  | 'world' // legacy id still accepted for active highlight

export type GameBottomTab = {
  id: GameBottomTabId
  label: string
  href: string
  icon: string
  active?: boolean
}

export const GAME_SUITE_BOTTOM_TABS: GameBottomTab[] = [
  {
    id: 'cities',
    label: 'Cities',
    href: `${SUITE_SHELL_URLS.cities}?mode=build`,
    icon: '🏙',
  },
  {
    id: 'civ',
    label: 'Civ',
    href: SUITE_SHELL_URLS.world,
    icon: '◈',
  },
  {
    id: 'fighter',
    label: 'Fight',
    href: SUITE_SHELL_URLS.fighter,
    icon: '⚔',
  },
  {
    id: 'wallet',
    label: 'Wallet',
    href: SUITE_SHELL_URLS.wallet,
    icon: '◇',
  },
  {
    id: 'cafe',
    label: 'Cafe',
    href: SUITE_SHELL_URLS.cafe,
    icon: '▣',
  },
]

/** Mark which game dock tab is active (cities | civ | fighter). */
export function gameBottomTabs(
  active: GameBottomTabId | 'cities' | 'fighter' | 'world' | 'civ',
  opts?: { citiesMode?: 'build' | 'civ' | string },
): GameBottomTab[] {
  const mode = opts?.citiesMode
  // world/reborn no longer a dock tab — map to civ for continuity
  const resolved: GameBottomTabId =
    active === 'world' ? 'civ' : (active as GameBottomTabId)
  return GAME_SUITE_BOTTOM_TABS.map((t) => {
    let isActive = t.id === resolved
    // On Cities host: highlight Cities vs Civ by mode when provided
    if (resolved === 'cities' || resolved === 'civ') {
      if (mode === 'civ') isActive = t.id === 'civ'
      else if (t.id === 'cities') isActive = resolved === 'cities' || mode !== 'civ'
      else if (t.id === 'civ') isActive = resolved === 'civ' || mode === 'civ'
    }
    return { ...t, active: isActive }
  })
}

export const APP_LABELS: Partial<Record<SuiteShellAppId, string>> = {
  wallet: 'WALLET',
  swap: 'SWAP',
  bridge: 'BRIDGE',
  scanner: 'SCANNER',
  cafe: 'CAFE',
  creator: 'CREATOR',
  dev: 'DEV',
  social: 'SOCIAL',
  pay: 'PAY',
  fighter: 'FIGHTER',
  hub: 'HUB',
  world: 'CIV',
  cities: 'CITIES',
  sniper: 'SNIPER',
  loyalty: 'LOYALTY',
  partners: 'PARTNERS',
  admin: 'ADMIN',
}

export const SUITE_SOCIALS: { id: string; label: string; href: string }[] = [
  { id: 'x', label: 'X', href: 'https://x.com/riddlewallet' },
  { id: 'discord', label: 'Discord', href: 'https://discord.gg/riddlewallet' },
  { id: 'telegram', label: 'Telegram', href: 'https://t.me/riddlewallet' },
  { id: 'github', label: 'GitHub', href: 'https://github.com/riddlewallet' },
]

export const SUITE_FOOTER_PROMO = {
  title: 'Riddle Suite — one wallet, every app',
  body: 'Swap, bridge, cafe, scanner, and DevTools. Keys stay on your device.',
  href: SUITE_SHELL_URLS.wallet,
  imageSrc: 'https://wallet.riddlewallet.com/rdllogo-40.png',
  imageAlt: 'Riddle',
}

export const SUITE_LEGAL_LINKS = [
  { label: 'Privacy', href: SUITE_SHELL_URLS.privacy },
  { label: 'Terms', href: SUITE_SHELL_URLS.terms },
  { label: 'Privacy & data', href: ACCOUNT_URL },
] as const

export const SUITE_COLORS = {
  bg: '#07070c',
  bgAlt: '#09090b',
  card: '#111118',
  border: '#24262c',
  accent: '#8b5cf6',
  muted: '#8b8ba3',
  accentText: '#c4b5fd',
  text: '#f4f4f8',
  pillText: '#a1a1aa',
} as const

export const REAUTH_IDLE_MS = 60 * 60 * 1000

/** Header geometry — keep in sync with UnifiedSuiteHeader */
export const SUITE_HEADER_ROW_PX = 44
export const SUITE_SOCIAL_RAIL_PX = 40
