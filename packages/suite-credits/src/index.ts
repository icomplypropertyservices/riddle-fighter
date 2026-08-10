/**
 * @riddle/suite-credits
 *
 * Shared economy constants, client ledger, wallet tier helpers, and React hooks
 * for the unified Riddle suite credit pool.
 */

// ─── Economy ───────────────────────────────────────────────────────────────

export {
  USD_PER_CREDIT,
  CREDITS_PER_USD,
  CREDITS_PER_XRP,
  XRP_DROPS,
  PRODUCT_CREDITS_VERSION,
  PAYG_CATALOG_VERSION,
  xrpToDrops,
  creditsToUsd,
  formatCreditsUsd,
  PRODUCT_CREDIT_CATALOG,
  DEVTOOLS_PRODUCT_IDS,
  SNIPER_PRODUCT_IDS,
  GAME_PRODUCT_IDS,
  productCredits,
  productEntry,
  productUsd,
  formatProductPrice,
  DEV_ACTION_TO_PRODUCT,
  devActionCreditCost,
  CREDIT_COST,
  NFT_UPDATE_CREDIT_COST,
  PAYG_SKU_CREDIT_GRANT,
  paygSkuUnifiedCredits,
  listProducts,
  PAYG_CATALOG,
  PAYG_SKU_LIST,
  PAYG_MEMO_PREFIX,
  PAYG_MEMO_KIND,
  isPaygSku,
  getPaygCatalogEntry,
  paygPriceXrp,
  paygPriceCredits,
  paygPriceDrops,
  catalogCreditsFor,
  buildPaygMemo,
  parsePaygMemo,
  paygMemoToHex,
  paygMemoFromHex,
  paygUnifiedCreditGrant,
  DEV_PLANS,
  DEV_PLAN_ORDER,
  devPlan,
  devPlanRank,
  actionsPerMonth,
  creditsFor,
  usdPerCredit,
  devPlanPriceUsd,
  TIER_ORDER,
  TIER_META,
  getTierMeta,
  tierRank,
  isAtLeast,
  normalizeFeeTier,
  isPaidTier,
  tierFromPro,
  tierPriceUsd,
  FEE_PRODUCTS,
  FEE_POLICY,
  TIER_FEE_BPS,
  resolveFeeBps,
  tierFeeBpsForProduct,
  formatFeeBpsLabel,
  feeScheduleLines,
  feePolicyAsAdminFees,
  swapFeeBps,
  bridgeFeeBps,
  sendFeeBps,
  cafeFeeBps,
  swapFeePercent,
  formatFeeRate,
  feeOnVolumeUsd,
  feeSavedVsFreeUsd,
} from './economy.js';

export type {
  DevProductId,
  SniperProductId,
  GameProductId,
  ProductId,
  ProductCreditEntry,
  DevAction,
  PaygSku,
  PaygCreditKind,
  PaygCatalogEntry,
  ParsedPaygMemo,
  ParsedPaygMemoFail,
  DevPlanId,
  DevPlan,
  TierId,
  TierMeta,
  FeeProduct,
  ProductFeeLadder,
  FeePolicyFees,
} from './economy.js';

// ─── Ledger ────────────────────────────────────────────────────────────────

export {
  SUITE_CREDITS_LS_KEY,
  COOKIE_SUITE_CREDITS,
  CREDITS_CHANGED_EVENT,
  SUITE_CREDITS_ALIAS_EVENT,
  freeDevEntitlement,
  getBalance,
  getCredits,
  getEntitlement,
  getDevEntitlement,
  loadDevEntitlement,
  grant,
  addCredits,
  addPaygCredits,
  addDevCredits,
  spend,
  spendCredits,
  spendCreditsAmount,
  spendWithLedger,
  spendSuiteCredits,
  setPlan,
  activateDevPlan,
  subscribe,
  subscribeDevEntitlement,
  getDevEntitlementSnapshot,
  getDevEntitlementServerSnapshot,
  hydrateDevEntitlementFromSuite,
  loadSuiteCredits,
  saveSuiteCredits,
  grantSuiteCredits,
  suiteCreditsBalance,
  clearDevEntitlement,
  DEV_ENTITLEMENT_STORAGE_KEY,
  tierPriceUsd as ledgerTierPriceUsd,
  tierMicroXrp,
} from './ledger.js';

export type {
  DevEntitlement,
  SuiteCreditLedger,
  CreditsChangedDetail,
  SpendResult,
} from './ledger.js';

// ─── Tiers ─────────────────────────────────────────────────────────────────

export {
  getWalletEntitlement,
  getSuiteTier,
  getTier,
  resolveFeeBps as resolveTierFeeBps,
  getTierMeta as getWalletTierMeta,
  isSuiteTier,
  subscribeTier,
} from './tiers.js';

export type {
  PaymentTxRecord,
  Entitlement,
} from './tiers.js';

// ─── React ─────────────────────────────────────────────────────────────────

export { useSuiteCredits, useSuiteTier } from './react.js';
export type {
  UseSuiteCreditsResult,
  UseSuiteTierResult,
} from './react.js';
