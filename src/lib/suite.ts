/** Suite brand + URLs — aligned with riddleweb / Social (solid token colors). */

export const COLORS = {
  bg: '#07070c',
  card: '#111118',
  border: '#1f1f2e',
  text: '#f4f4f8',
  muted: '#8b8ba3',
  violet: '#8b5cf6',
  fuchsia: '#d946ef',
  cyan: '#22d3ee',
  success: '#34d399',
  warn: '#fbbf24',
  danger: '#f87171',
  themeColor: '#07070c',
} as const

export const SUITE = {
  hub: import.meta.env.VITE_SUITE_URL || 'https://riddlewallet.com',
  wallet: import.meta.env.VITE_WALLET_URL || 'https://wallet.riddlewallet.com',
  bridge: 'https://bridge.riddlewallet.com',
  creator: 'https://creator.riddlewallet.com',
  scanner: 'https://scanner.riddlewallet.com',
  cafe: 'https://cafe.riddlewallet.com',
  swap: 'https://swap.riddlewallet.com',
  dev: 'https://dev.riddlewallet.com',
  social: import.meta.env.VITE_SOCIAL_URL || 'https://social.riddlewallet.com',
  world: import.meta.env.VITE_WORLD_URL || 'https://reborn.riddlewallet.com',
  reborn: 'https://reborn.riddlewallet.com',
  fighter: import.meta.env.VITE_FIGHTER_URL || 'https://fighter.riddlewallet.com',
  pay: 'https://pay.riddlewallet.com',
  creditsTopup: 'https://wallet.riddlewallet.com',
  city: import.meta.env.VITE_CITY_URL || 'https://city.riddlewallet.com',
} as const

/** Cafe NFT market — used when wallet owns zero fightable NFTs. */
export function cafeBuyNftUrl(ref = 'fighter-no-nft'): string {
  const u = new URL(SUITE.cafe)
  u.searchParams.set('from', 'fighter')
  u.searchParams.set('action', 'buy')
  u.searchParams.set('ref', ref)
  return u.toString()
}

/** Primary fighter collection on xrp.cafe (Inquisition). */
export function xrpCafeFightersUrl(): string {
  return 'https://xrp.cafe/collection/theinquisition'
}

/** Footer / nav suite map — same order style as Social. */
export const SUITE_NAV: { key: keyof typeof SUITE; label: string }[] = [
  { key: 'hub', label: 'Hub' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'social', label: 'Social' },
  { key: 'cafe', label: 'Cafe' },
  { key: 'swap', label: 'Swap' },
  { key: 'bridge', label: 'Bridge' },
  { key: 'scanner', label: 'Scanner' },
  { key: 'dev', label: 'Dev' },
  { key: 'fighter', label: 'Fighter' },
  { key: 'reborn', label: 'World' },
]

export const BRAND = {
  suite: 'Riddle',
  name: 'Riddle Fighter',
  shortName: 'Fighter',
  host: 'fighter.riddlewallet.com',
  tagline: 'NFT arena · suite credits · @handles',
  description:
    'Street Fighter–style NFT battles. Choose your NFT, wager suite credits, challenge by @handle, host tournaments.',
  disclaimer: 'Not financial advice. Self-custodial — keys stay in Riddle Wallet. Credits are suite ledger units.',
  themeColor: COLORS.themeColor,
} as const
