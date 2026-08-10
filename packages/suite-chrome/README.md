# @riddle/suite-chrome

Shared Riddle suite chrome v2: header, footer, social rail, bottom nav, consent banner, analytics gate, shell config, and handle SSOT.

## Usage

```tsx
import {
  UnifiedSuiteHeader,
  UnifiedSuiteFooter,
  SuiteBottomNav,
  SuiteConsentBanner,
  SuiteAnalytics,
} from '@riddle/suite-chrome';
import '@riddle/suite-chrome/css';

export default function Page() {
  return (
    <>
      <UnifiedSuiteHeader current="wallet" />
      <main data-suite-main="1">…</main>
      <SuiteBottomNav current="wallet" />
      <UnifiedSuiteFooter current="wallet" />
      <SuiteConsentBanner />
      <SuiteAnalytics />
    </>
  );
}
```

## Exports

- `UnifiedSuiteHeader` / `SuiteHeaderSpacer`
- `SuiteSocialRail`
- `UnifiedSuiteFooter`
- `SuiteBottomNav` / `SuiteBottomNavSpacer`
- `SuiteConsentBanner`
- `SuiteAnalytics`
- Shell config (`SUITE_SHELL_URLS`, `SUITE_APP_PILLS`, `SUITE_BOTTOM_TABS`, `GAME_SUITE_BOTTOM_TABS`, `gameBottomTabs`, `APP_LABELS`, `SUITE_SOCIALS`, `SUITE_LEGAL_LINKS`, `SUITE_COLORS`, etc.)
- Handle helpers (`readSuiteHandle`, `persistSuiteHandle`, `refreshSuiteHandleFromSocial`, etc.)
- Consent helpers (`readSuiteConsent`, `writeSuiteConsent`, `hasConsentedToAnalytics`, `subscribeConsent`)
- Identity guard (`isForbiddenChromeAddress`, `isPoisonedTestWallet`, `NEVER_PLAYER_XRPL_ADDRESSES`)

## Sync

Run `node scripts/sync-suite-chrome.mjs` from the `riddle-wallet` root to mirror this package (and `@riddle/suite-credits`) into every suite app and regenerate the hub vanilla-JS mirror.
