/**
 * @riddle/suite-chrome v2 — single import for suite chrome.
 *
 *   import {
 *     UnifiedSuiteHeader,
 *     UnifiedSuiteFooter,
 *     SuiteBottomNav,
 *     SuiteConsentBanner,
 *     SuiteAnalytics,
 *   } from '@riddle/suite-suite-chrome'
 *   import '@riddle/suite-chrome/css'
 */

export {
  UnifiedSuiteHeader,
  SuiteHeaderSpacer,
  default as default,
} from './UnifiedSuiteHeader'
export type { UnifiedSuiteHeaderProps } from './UnifiedSuiteHeader'

export { default as SuiteSocialRail } from './SuiteSocialRail'
export type { SuiteSocialRailProps } from './SuiteSocialRail'

export { default as SuiteAccountControl, SuiteAccountControl as SuiteAccount } from './SuiteAccountControl'
export type { SuiteAccountControlProps } from './SuiteAccountControl'

export { default as UnifiedSuiteFooter } from './UnifiedSuiteFooter'
export type { UnifiedSuiteFooterProps } from './UnifiedSuiteFooter'

export { default as SuiteConsentBanner } from './SuiteConsentBanner'
export { useSuiteConsentBannerVisible, hasConsentedToAnalytics } from './SuiteConsentBanner'

export { default as SuiteAnalytics } from './SuiteAnalytics'
export type { SuiteAnalyticsProps } from './SuiteAnalytics'

export {
  SuiteBottomNav,
  SuiteBottomNavSpacer,
  default as SuiteBottomNavDefault,
} from './SuiteBottomNav'
export type {
  SuiteBottomNavProps,
  SuiteBottomTab,
  SuiteBottomNavMode,
} from './SuiteBottomNav'

export {
  readSuiteConsent,
  writeSuiteConsent,
  clearSuiteConsent,
  openSuiteConsentBanner,
  hasConsentedToAnalytics as hasConsentedToAnalyticsRaw,
  subscribeConsent,
} from './consent'
export type { SuiteConsent, ConsentListener } from './consent'

export {
  NEVER_PLAYER_XRPL_ADDRESSES,
  POISONED_WALLET_PREFIXES,
  isPoisonedTestWallet,
  isForbiddenChromeAddress,
} from './identity-guard'

export {
  SUITE_CHROME_VERSION,
  ACCOUNT_URL,
  CREDITS_URL,
  suiteCreditsTopUpHref,
  SUITE_SHELL_URLS,
  SUITE_APP_PILLS,
  SUITE_PRIMARY_PILL_IDS,
  SUITE_PRIMARY_PILLS,
  SUITE_MORE_PILLS,
  SUITE_MORE_LABEL,
  SUITE_BOTTOM_TABS,
  GAME_SUITE_BOTTOM_TABS,
  gameBottomTabs,
  APP_LABELS,
  SUITE_SOCIALS,
  SUITE_LEGAL_LINKS,
  SUITE_COLORS,
  SUITE_FOOTER_PROMO,
  REAUTH_IDLE_MS,
  SUITE_HEADER_ROW_PX,
  SUITE_SOCIAL_RAIL_PX,
} from './suite-shell-config'
export type {
  SuiteShellAppId,
  SuitePrimaryPillId,
  GameBottomTabId,
  GameBottomTab,
} from './suite-shell-config'

export {
  SUITE_SESSION_COOKIE,
  SUITE_SESSION_LS_KEY,
  SUITE_SESSION_EVENT,
  SUITE_CHAIN_LABELS,
  WALLET_ORIGIN,
  suiteChainLabel,
  shortenSuiteAddress,
  readSuiteSession,
  hasSuiteSession,
  suiteSessionAccounts,
  clearSuiteSession,
  buildSuiteConnectUrl,
  decodeSuiteAccountsParam,
  acceptSuiteConnectHandoff,
  subscribeSuiteSession,
} from './suiteSession'
export type { SuiteSession, SuiteSessionChain } from './suiteSession'

export {
  COOKIE_SUITE_HANDLE,
  LS_SUITE_HANDLE,
  LS_SUITE_HANDLE_AVATAR,
  SOCIAL_API_BASE,
  formatSuiteHandle,
  suiteHandleImage,
  readSuiteHandle,
  persistSuiteHandle,
  clearSuiteHandle,
  refreshSuiteHandleFromSocial,
} from './suiteHandle'
export type { SuiteHandleProfile, SuiteHandleSocials } from './suiteHandle'
