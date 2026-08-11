/**
 * Canonical suite economy — single source of truth.
 *
 * Economy: 100 credits = $1 USD (1 cr = $0.01).
 * Catalog version: 2.0.0
 */

// ─── Core FX ───────────────────────────────────────────────────────────────

/** 100 suite credits = $1 USD. This is the locked economy rate. */
export const USD_PER_CREDIT = 0.01;

/** Inverse rate: $1 USD = 100 suite credits. */
export const CREDITS_PER_USD = 100;

/**
 * Legacy bridge: 1 XRP ≈ 100 credits when XRP ~$1 (100 cr = $1).
 * Used only to map legacy PAYG XRP packs → credit grants.
 */
export const CREDITS_PER_XRP = 100;

/** XRPL drops per 1 XRP. */
export const XRP_DROPS = 1_000_000;

/** Catalog revision — bump when any product credit cost changes. */
export const PRODUCT_CREDITS_VERSION = '2.0.0';

/** PAYG catalog revision — bump when prices/SKUs change. */
export const PAYG_CATALOG_VERSION = '2.0.0';

/** Convert XRP decimal to integer drops string (no BigInt literal). */
export function xrpToDrops(xrp: number): string {
  const s = Math.max(0, Number(xrp) || 0).toFixed(6);
  const [whole, frac = ''] = s.split('.');
  const padded = (frac + '000000').slice(0, 6);
  const wholeN = parseInt(whole || '0', 10) || 0;
  const fracN = parseInt(padded, 10) || 0;
  return String(wholeN * XRP_DROPS + fracN);
}

/** Convert suite credits to USD at list price. */
export function creditsToUsd(credits: number): number {
  const n = Math.max(0, Number(credits) || 0);
  return Math.round(n * USD_PER_CREDIT * 100) / 100;
}

/** Format credits as "N cr (~$X.XX)". */
export function formatCreditsUsd(credits: number): string {
  const n = Math.max(0, Math.floor(Number(credits) || 0));
  if (n === 0) return 'free';
  const usd = creditsToUsd(n);
  const usdLabel =
    usd < 1 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(usd % 1 === 0 ? 0 : 2)}`;
  return `${n} cr (~${usdLabel})`;
}

// ─── Product credit catalog ────────────────────────────────────────────────

export type DevProductId =
  | 'image'
  | 'metaUpdate'
  | 'nftKit'
  | 'adPack'
  | 'tokenLaunch'
  | 'scannerPromoDay'
  | 'copy';

export type SniperProductId =
  | 'sniperDayPass'
  | 'sniperArm'
  | 'sniperCopy'
  | 'sniperWhale'
  | 'sniperLadder'
  | 'sniperRisk'
  | 'sniperNftRadar'
  | 'sniperMulti';

export type GameProductId =
  | 'gameEnergy'
  | 'gameBuildBoost'
  | 'gameBillboardDay';

export type ProductId = DevProductId | SniperProductId | GameProductId;

export interface ProductCreditEntry {
  id: ProductId;
  name: string;
  description: string;
  credits: number;
  family: 'devtools' | 'sniper' | 'shared' | 'game' | 'micro';
  unitLabel?: string;
}

export const PRODUCT_CREDIT_CATALOG: Record<ProductId, ProductCreditEntry> = {
  image: {
    id: 'image',
    name: 'AI image',
    description: 'One Studio / NFT art generation',
    credits: 100,
    family: 'devtools',
    unitLabel: 'gen',
  },
  metaUpdate: {
    id: 'metaUpdate',
    name: 'NFT image + meta update',
    description: 'Owner NFT image and mutable metadata update',
    credits: 10,
    family: 'shared',
    unitLabel: 'update',
  },
  nftKit: {
    id: 'nftKit',
    name: 'NFT project kit',
    description: 'One NFT kit export',
    credits: 400,
    family: 'devtools',
    unitLabel: 'kit',
  },
  adPack: {
    id: 'adPack',
    name: 'Ad creative pack',
    description: 'One campaign / ad creative pack',
    credits: 500,
    family: 'devtools',
    unitLabel: 'pack',
  },
  tokenLaunch: {
    id: 'tokenLaunch',
    name: 'Token launch',
    description: 'Token kit / launch on-ramp (included free)',
    credits: 0,
    family: 'devtools',
    unitLabel: 'launch',
  },
  scannerPromoDay: {
    id: 'scannerPromoDay',
    name: 'Scanner promo (1 day)',
    description: '24-hour project promo strip on Scanner',
    credits: 400,
    family: 'devtools',
    unitLabel: 'day',
  },
  copy: {
    id: 'copy',
    name: 'AI copy',
    description: 'One Studio copy generation',
    credits: 20,
    family: 'devtools',
    unitLabel: 'gen',
  },
  sniperDayPass: {
    id: 'sniperDayPass',
    name: 'Sniper day pass',
    description: '24h full desk access without Silver/Gold',
    credits: 250,
    family: 'sniper',
    unitLabel: 'day',
  },
  sniperArm: {
    id: 'sniperArm',
    name: 'AMM arm',
    description: 'Queue one AMM sniper arm',
    credits: 50,
    family: 'sniper',
    unitLabel: 'arm',
  },
  sniperCopy: {
    id: 'sniperCopy',
    name: 'Copy mirror',
    description: 'Mirror a wallet trade size',
    credits: 30,
    family: 'sniper',
    unitLabel: 'mirror',
  },
  sniperWhale: {
    id: 'sniperWhale',
    name: 'Whale radar refresh',
    description: 'Premium whale / vol feed refresh',
    credits: 10,
    family: 'sniper',
    unitLabel: 'refresh',
  },
  sniperLadder: {
    id: 'sniperLadder',
    name: 'Ladder plan',
    description: 'Build / arm a DCA ladder',
    credits: 50,
    family: 'sniper',
    unitLabel: 'plan',
  },
  sniperRisk: {
    id: 'sniperRisk',
    name: 'Risk scorecard',
    description: 'Full risk intel scorecard',
    credits: 20,
    family: 'sniper',
    unitLabel: 'scan',
  },
  sniperNftRadar: {
    id: 'sniperNftRadar',
    name: 'NFT radar scan',
    description: 'Collection floor / vol radar pass',
    credits: 20,
    family: 'sniper',
    unitLabel: 'scan',
  },
  sniperMulti: {
    id: 'sniperMulti',
    name: 'Multi-chain hunt',
    description: 'EVM / Solana / XRPL board hunt',
    credits: 30,
    family: 'sniper',
    unitLabel: 'hunt',
  },
  gameEnergy: {
    id: 'gameEnergy',
    name: 'Game energy',
    description: 'Energy refill for World / Civilisations actions',
    credits: 50,
    family: 'game',
    unitLabel: 'pack',
  },
  gameBuildBoost: {
    id: 'gameBuildBoost',
    name: 'Build boost',
    description: 'Speed / cost boost for plot builds',
    credits: 80,
    family: 'game',
    unitLabel: 'boost',
  },
  gameBillboardDay: {
    id: 'gameBillboardDay',
    name: 'Billboard day',
    description: '1 day in-world billboard placement',
    credits: 120,
    family: 'game',
    unitLabel: 'day',
  },
};

export const DEVTOOLS_PRODUCT_IDS: DevProductId[] = [
  'image',
  'metaUpdate',
  'nftKit',
  'adPack',
  'tokenLaunch',
  'scannerPromoDay',
  'copy',
];

export const SNIPER_PRODUCT_IDS: SniperProductId[] = [
  'sniperDayPass',
  'sniperArm',
  'sniperCopy',
  'sniperWhale',
  'sniperLadder',
  'sniperRisk',
  'sniperNftRadar',
  'sniperMulti',
];

export const GAME_PRODUCT_IDS: GameProductId[] = [
  'gameEnergy',
  'gameBuildBoost',
  'gameBillboardDay',
];

export function productCredits(id: ProductId): number {
  return PRODUCT_CREDIT_CATALOG[id]?.credits ?? 0;
}

export function productEntry(id: ProductId): ProductCreditEntry {
  return PRODUCT_CREDIT_CATALOG[id];
}

export function productUsd(id: ProductId, qty = 1): number {
  return creditsToUsd(productCredits(id) * Math.max(0, qty));
}

export function formatProductPrice(id: ProductId, qty = 1): string {
  const entry = productEntry(id);
  const total = entry.credits * Math.max(1, Math.floor(qty) || 1);
  if (total <= 0) return 'free';
  return formatCreditsUsd(total);
}

export const DEV_ACTION_TO_PRODUCT = {
  image: 'image',
  metaUpdate: 'metaUpdate',
  nftKit: 'nftKit',
  adPack: 'adPack',
  tokenLaunch: 'tokenLaunch',
  scannerPromoDay: 'scannerPromoDay',
  copy: 'copy',
} as const satisfies Record<string, DevProductId>;

export type DevAction = keyof typeof DEV_ACTION_TO_PRODUCT;

export function devActionCreditCost(action: DevAction): number {
  return productCredits(DEV_ACTION_TO_PRODUCT[action]);
}

/** Credit cost per Dev action — derived from product catalog. */
export const CREDIT_COST: Record<DevAction, number> = {
  image: productCredits('image'),
  metaUpdate: productCredits('metaUpdate'),
  nftKit: productCredits('nftKit'),
  adPack: productCredits('adPack'),
  tokenLaunch: productCredits('tokenLaunch'),
  scannerPromoDay: productCredits('scannerPromoDay'),
  copy: productCredits('copy'),
};

/** Every owner NFT update (image + mutable metadata). */
export const NFT_UPDATE_CREDIT_COST = productCredits('metaUpdate');

/** Production PAYG SKU → credit grants (no micro/test rails). */
export const PAYG_SKU_CREDIT_GRANT: Record<
  'nft_gen_pack' | 'ad_creative_pack' | 'scanner_promo_day' | 'image_gen_pack',
  { product: DevProductId | 'image'; units: number; credits: number }
> = {
  image_gen_pack: {
    product: 'image',
    units: 3,
    credits: productCredits('image') * 3,
  },
  nft_gen_pack: {
    product: 'nftKit',
    units: 1,
    credits: productCredits('nftKit'),
  },
  ad_creative_pack: {
    product: 'adPack',
    units: 1,
    credits: productCredits('adPack'),
  },
  scanner_promo_day: {
    product: 'scannerPromoDay',
    units: 1,
    credits: productCredits('scannerPromoDay'),
  },
};

export function paygSkuUnifiedCredits(
  sku: keyof typeof PAYG_SKU_CREDIT_GRANT,
  qty = 1
): number {
  const g = PAYG_SKU_CREDIT_GRANT[sku];
  if (!g) return 0;
  return g.credits * Math.max(1, Math.floor(qty) || 1);
}

export function listProducts(
  family?: ProductCreditEntry['family']
): ProductCreditEntry[] {
  return Object.values(PRODUCT_CREDIT_CATALOG).filter(
    (p) => !family || p.family === family
  );
}

// ─── PAYG catalog ───────────────────────────────────────────────────────────

export type PaygSku =
  | 'nft_gen_pack'
  | 'ad_creative_pack'
  | 'scanner_promo_day'
  | 'image_gen_pack';

export type PaygCreditKind =
  | 'images'
  | 'nftKits'
  | 'adPacks'
  | 'scannerPromoDays';

export interface PaygCatalogEntry {
  sku: PaygSku;
  name: string;
  description: string;
  priceXrp: number;
  priceCredits: number;
  units: number;
  unitLabel: string;
  creditKind: PaygCreditKind | null;
  validityHours: number | null;
}

export const PAYG_CATALOG: Record<PaygSku, PaygCatalogEntry> = {
  nft_gen_pack: {
    sku: 'nft_gen_pack',
    name: 'NFT gen pack',
    description: '1 NFT project kit · 400 cr ($4.00) · 100 cr = $1',
    priceXrp: 2,
    priceCredits: PAYG_SKU_CREDIT_GRANT.nft_gen_pack.credits,
    units: 1,
    unitLabel: 'kits',
    creditKind: 'nftKits',
    validityHours: null,
  },
  ad_creative_pack: {
    sku: 'ad_creative_pack',
    name: 'Ad creative pack',
    description: '1 campaign/ad pack · 500 cr ($5.00) · 100 cr = $1',
    priceXrp: 2.5,
    priceCredits: PAYG_SKU_CREDIT_GRANT.ad_creative_pack.credits,
    units: 1,
    unitLabel: 'packs',
    creditKind: 'adPacks',
    validityHours: null,
  },
  scanner_promo_day: {
    sku: 'scanner_promo_day',
    name: 'Scanner promo (1 day)',
    description: '24-hour promo strip · 400 cr ($4.00)',
    priceXrp: 2,
    priceCredits: PAYG_SKU_CREDIT_GRANT.scanner_promo_day.credits,
    units: 1,
    unitLabel: 'day',
    creditKind: 'scannerPromoDays',
    validityHours: 24,
  },
  image_gen_pack: {
    sku: 'image_gen_pack',
    name: 'Image gen pack',
    description: '3 AI images · 300 cr ($3.00; 100 cr each)',
    priceXrp: 1.5,
    priceCredits: PAYG_SKU_CREDIT_GRANT.image_gen_pack.credits,
    units: 3,
    unitLabel: 'gens',
    creditKind: 'images',
    validityHours: null,
  },
};

export const PAYG_SKU_LIST: PaygSku[] = [
  'image_gen_pack',
  'nft_gen_pack',
  'ad_creative_pack',
  'scanner_promo_day',
];

export const PAYG_MEMO_PREFIX = 'RDL1';
export const PAYG_MEMO_KIND = 'PAYG';

export function isPaygSku(value: unknown): value is PaygSku {
  return (
    typeof value === 'string' && (PAYG_SKU_LIST as string[]).includes(value)
  );
}

export function getPaygCatalogEntry(sku: PaygSku): PaygCatalogEntry {
  return PAYG_CATALOG[sku];
}

export function paygPriceXrp(sku: PaygSku): number {
  return PAYG_CATALOG[sku].priceXrp;
}

export function paygPriceCredits(sku: PaygSku, qty = 1): number {
  return PAYG_CATALOG[sku].priceCredits * Math.max(1, Math.floor(qty) || 1);
}

export function paygPriceDrops(sku: PaygSku): string {
  return xrpToDrops(PAYG_CATALOG[sku].priceXrp);
}

export function catalogCreditsFor(
  sku: PaygSku
): Partial<Record<PaygCreditKind, number>> {
  const entry = PAYG_CATALOG[sku];
  if (!entry.creditKind) return {};
  return { [entry.creditKind]: entry.units };
}

/** Build XRPL Payment memo for a PAYG purchase. */
export function buildPaygMemo(sku: PaygSku, projectId: string): string {
  const pid = (projectId || 'none').trim().replace(/\|/g, '-') || 'none';
  return `${PAYG_MEMO_PREFIX}|${PAYG_MEMO_KIND}|${sku}|${pid}`;
}

export interface ParsedPaygMemo {
  ok: true;
  sku: PaygSku;
  projectId: string;
  raw: string;
}

export interface ParsedPaygMemoFail {
  ok: false;
  reason: string;
  raw: string;
}

export function parsePaygMemo(
  memo: string
): ParsedPaygMemo | ParsedPaygMemoFail {
  const raw = (memo || '').trim();
  const parts = raw.split('|');
  if (parts.length < 4) {
    return { ok: false, reason: 'memo must be RDL1|PAYG|sku|projectId', raw };
  }
  const [prefix, kind, sku, ...rest] = parts;
  if (prefix !== PAYG_MEMO_PREFIX) {
    return { ok: false, reason: `expected prefix ${PAYG_MEMO_PREFIX}`, raw };
  }
  if (kind !== PAYG_MEMO_KIND) {
    return { ok: false, reason: `expected kind ${PAYG_MEMO_KIND}`, raw };
  }
  if (!isPaygSku(sku)) {
    return { ok: false, reason: `unknown sku "${sku}"`, raw };
  }
  const projectId = rest.join('|').trim() || 'none';
  return { ok: true, sku, projectId, raw };
}

/**
 * Node's Buffer, read off globalThis rather than referenced as a bare global.
 *
 * This package ships to browser apps (Vite + Next) that do not install
 * @types/node, where a bare `Buffer` is a hard TS2580 and broke their builds.
 * Runtime behaviour is identical — same object, just typed locally. Both call
 * sites below are unreachable in a browser (TextEncoder/TextDecoder win).
 */
type NodeBufferLike = {
  from(input: string, encoding: string): { toString(encoding: string): string };
};
function nodeBuffer(): NodeBufferLike | undefined {
  return (globalThis as { Buffer?: NodeBufferLike }).Buffer;
}

/** Hex-encode UTF-8 memo for XRPL MemoData (no 0x prefix). */
export function paygMemoToHex(memo: string): string {
  if (typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(memo);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return (nodeBuffer()?.from(memo, 'utf8').toString('hex') ?? '').toUpperCase();
}

export function paygMemoFromHex(hex: string): string {
  const clean = hex.replace(/^0x/i, '');
  if (typeof TextDecoder !== 'undefined') {
    const bytes = new Uint8Array(
      clean.match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) || []
    );
    return new TextDecoder().decode(bytes);
  }
  return nodeBuffer()?.from(clean, 'hex').toString('utf8') ?? '';
}

/** Unified credits granted when a PAYG SKU is verified (qty=1). */
export function paygUnifiedCreditGrant(sku: PaygSku, qty = 1): number {
  return paygSkuUnifiedCredits(sku, qty);
}

// ─── DevTools plans ────────────────────────────────────────────────────────

export type DevPlanId = 'free' | 'hobby' | 'business' | 'enterprise';

export interface DevPlan {
  id: DevPlanId;
  name: string;
  priceUsd: number;
  monthlyCredits: number;
  tokenLaunches: number;
  seats: number;
  rollover: boolean;
  rolloverCap: number;
  prioritySupport: boolean;
  apiAccess: boolean;
  blurb: string;
  accent: string;
}

export const DEV_PLANS: Record<DevPlanId, DevPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceUsd: 0,
    monthlyCredits: 0,
    tokenLaunches: 1,
    seats: 1,
    rollover: false,
    rolloverCap: 0,
    prioritySupport: false,
    apiAccess: false,
    blurb: 'Browse and launch a token · pay as you go for everything else',
    accent: 'zinc',
  },
  hobby: {
    id: 'hobby',
    name: 'Hobby',
    priceUsd: 24.99,
    monthlyCredits: 220,
    tokenLaunches: 3,
    seats: 1,
    rollover: true,
    rolloverCap: 220,
    prioritySupport: false,
    apiAccess: false,
    blurb: 'For solo builders shipping their first projects',
    accent: 'sky',
  },
  business: {
    id: 'business',
    name: 'Business',
    priceUsd: 99.99,
    monthlyCredits: 750,
    tokenLaunches: 10,
    seats: 5,
    rollover: true,
    rolloverCap: 750,
    prioritySupport: true,
    apiAccess: true,
    blurb: 'Production teams with recurring output',
    accent: 'violet',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceUsd: 199.99,
    monthlyCredits: 2250,
    tokenLaunches: 30,
    seats: 15,
    rollover: true,
    rolloverCap: 2250,
    prioritySupport: true,
    apiAccess: true,
    blurb: 'High volume, priority throughput · PAYG for bursts',
    accent: 'amber',
  },
};

export const DEV_PLAN_ORDER: DevPlanId[] = [
  'free',
  'hobby',
  'business',
  'enterprise',
];

export function devPlan(id: DevPlanId): DevPlan {
  return DEV_PLANS[id] ?? DEV_PLANS.free;
}

export function devPlanRank(id: DevPlanId): number {
  return DEV_PLAN_ORDER.indexOf(id);
}

export function actionsPerMonth(id: DevPlanId, action: DevAction): number {
  const cost = CREDIT_COST[action];
  if (cost <= 0) return -1;
  return Math.floor(devPlan(id).monthlyCredits / cost);
}

export function creditsFor(action: DevAction, count = 1): number {
  return CREDIT_COST[action] * Math.max(0, count);
}

export function usdPerCredit(id?: DevPlanId): number {
  if (!id) return USD_PER_CREDIT;
  const p = devPlan(id);
  if (!p.monthlyCredits) return USD_PER_CREDIT;
  return p.priceUsd / p.monthlyCredits;
}

export function devPlanPriceUsd(plan: DevPlanId | string): number {
  const p = String(plan || 'free').toLowerCase();
  if (p === 'free') return 0;
  if (p === 'hobby') return 24.99;
  if (p === 'business') return 99.99;
  if (p === 'enterprise') return 199.99;
  return 0;
}

// ─── Wallet tier metadata ──────────────────────────────────────────────────

export type TierId = 'free' | 'bronze' | 'silver' | 'gold';

export interface TierMeta {
  id: TierId;
  name: string;
  priceUsd: number;
  blurb: string;
  accent: string;
}

export const TIER_ORDER: TierId[] = ['free', 'bronze', 'silver', 'gold'];

export const TIER_META: Record<TierId, TierMeta> = {
  free: {
    id: 'free',
    name: 'Free',
    priceUsd: 0,
    blurb: 'Core wallet · free sends · base swap/bridge',
    accent: 'zinc',
  },
  bronze: {
    id: 'bronze',
    name: 'Bronze',
    priceUsd: 4.99,
    blurb: 'Free sends · 0.7% swap · lower bridge',
    accent: 'amber',
  },
  silver: {
    id: 'silver',
    name: 'Silver',
    priceUsd: 14.99,
    blurb: 'Free sends · 0.35% swap · ad-free · verified',
    accent: 'slate',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    priceUsd: 39.99,
    blurb: 'Free sends · 0.1% swap · lowest suite fees',
    accent: 'yellow',
  },
};

export function getTierMeta(tier: TierId): TierMeta {
  return TIER_META[tier] ?? TIER_META.free;
}

export function tierRank(tier: TierId): number {
  return TIER_ORDER.indexOf(tier);
}

export function isAtLeast(tier: TierId, minimum: TierId): boolean {
  return tierRank(tier) >= tierRank(minimum);
}

export function normalizeFeeTier(tier: string | null | undefined): TierId {
  const t = String(tier || 'free').toLowerCase();
  if (t === 'bronze' || t === 'silver' || t === 'gold') return t;
  if (t === 'pro' || t === 'platinum' || t === 'lifetime') return 'gold';
  return 'free';
}

export function isPaidTier(tier: TierId | string | null | undefined): boolean {
  const t = normalizeFeeTier(tier);
  return t === 'bronze' || t === 'silver' || t === 'gold';
}

export function tierFromPro(isPro: boolean): TierId {
  return isPro ? 'gold' : 'free';
}

export function tierPriceUsd(tier: TierId | string): number {
  const t = String(tier || 'free').toLowerCase();
  if (t === 'free') return 0;
  if (t === 'bronze') return 4.99;
  if (t === 'silver') return 14.99;
  if (t === 'gold') return 39.99;
  return 0;
}

// ─── Fee ladders ───────────────────────────────────────────────────────────

export type FeeProduct = 'send' | 'swap' | 'bridge' | 'cafe';

export interface ProductFeeLadder {
  freeBps: number;
  bronzeBps: number;
  silverBps: number;
  goldBps: number;
  riddleWalletSessionBps?: number;
}

export const FEE_PRODUCTS: Record<FeeProduct, ProductFeeLadder> = {
  send: {
    // Decision D1 (suite unify): sends are truly free on every tier.
    // The old 0.02% free-tier fee was display-only and never collected on-chain.
    freeBps: 0,
    bronzeBps: 0,
    silverBps: 0,
    goldBps: 0,
  },
  swap: {
    freeBps: 85,
    bronzeBps: 70,
    silverBps: 35,
    goldBps: 10,
    riddleWalletSessionBps: 50,
  },
  bridge: {
    freeBps: 120,
    bronzeBps: 100,
    silverBps: 80,
    goldBps: 50,
    riddleWalletSessionBps: 100,
  },
  cafe: {
    freeBps: 100,
    bronzeBps: 80,
    silverBps: 60,
    goldBps: 40,
  },
};

export const FEE_POLICY = {
  freeBps: FEE_PRODUCTS.swap.freeBps,
  bronzeBps: FEE_PRODUCTS.swap.bronzeBps,
  silverBps: FEE_PRODUCTS.swap.silverBps,
  goldBps: FEE_PRODUCTS.swap.goldBps,
  riddleWalletSessionBps: FEE_PRODUCTS.swap.riddleWalletSessionBps ?? 50,
  platformDefaultBps: FEE_PRODUCTS.swap.freeBps,
  products: FEE_PRODUCTS,
} as const;

export interface FeePolicyFees {
  freeBps?: number;
  bronzeBps?: number;
  silverBps?: number;
  goldBps?: number;
  riddleWalletSessionBps?: number;
  platformDefaultBps?: number;
  send?: Partial<ProductFeeLadder>;
  swap?: Partial<ProductFeeLadder>;
  bridge?: Partial<ProductFeeLadder>;
  cafe?: Partial<ProductFeeLadder>;
}

function clampBps(n: unknown, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return fallback;
  return Math.round(v * 10) / 10;
}

function ladderForProduct(
  product: FeeProduct,
  admin?: FeePolicyFees | null
): ProductFeeLadder {
  const base = FEE_PRODUCTS[product];
  const nested = admin?.[product];
  const flatAsSwap =
    product === 'swap'
      ? {
          freeBps: admin?.freeBps,
          bronzeBps: admin?.bronzeBps,
          silverBps: admin?.silverBps,
          goldBps: admin?.goldBps,
          riddleWalletSessionBps: admin?.riddleWalletSessionBps,
        }
      : null;

  const src = { ...base, ...flatAsSwap, ...nested };
  return {
    freeBps: clampBps(src.freeBps, base.freeBps),
    bronzeBps: clampBps(src.bronzeBps, base.bronzeBps),
    silverBps: clampBps(src.silverBps, base.silverBps),
    goldBps: clampBps(src.goldBps, base.goldBps),
    riddleWalletSessionBps: clampBps(
      src.riddleWalletSessionBps,
      base.riddleWalletSessionBps ?? base.freeBps
    ),
  };
}

export function resolveFeeBps(opts?: {
  tier?: string | null;
  product?: FeeProduct;
  riddleWalletSession?: boolean;
  adminFees?: FeePolicyFees | null;
  fallbackBps?: number;
}): number {
  const product = opts?.product || 'swap';
  const tier = normalizeFeeTier(opts?.tier);
  const ladder = ladderForProduct(product, opts?.adminFees);

  if (opts?.riddleWalletSession && tier === 'free') {
    return clampBps(ladder.riddleWalletSessionBps, ladder.freeBps);
  }

  if (tier === 'gold') return ladder.goldBps;
  if (tier === 'silver') return ladder.silverBps;
  if (tier === 'bronze') return ladder.bronzeBps;
  if (opts?.fallbackBps != null) return clampBps(opts.fallbackBps, ladder.freeBps);
  return ladder.freeBps;
}

export function tierFeeBpsForProduct(
  product: FeeProduct,
  adminFees?: FeePolicyFees | null
): Record<TierId, number> {
  const L = ladderForProduct(product, adminFees);
  return {
    free: L.freeBps,
    bronze: L.bronzeBps,
    silver: L.silverBps,
    gold: L.goldBps,
  };
}

export const TIER_FEE_BPS: Record<TierId, number> =
  tierFeeBpsForProduct('swap');

export function formatFeeBpsLabel(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return 'Free';
  const p = bps / 100;
  if (p < 0.1) return `${p.toFixed(2)}%`;
  if (Number.isInteger(p * 10)) return `${p.toFixed(1)}%`;
  return `${p.toFixed(2)}%`;
}

export function feeScheduleLines(adminFees?: FeePolicyFees | null): {
  product: FeeProduct;
  label: string;
  rows: { tier: string; bps: number; pct: string }[];
}[] {
  const products: { product: FeeProduct; label: string }[] = [
    { product: 'send', label: 'Send' },
    { product: 'swap', label: 'Swap' },
    { product: 'bridge', label: 'Bridge' },
    { product: 'cafe', label: 'Cafe broker' },
  ];
  return products.map(({ product, label }) => {
    const L = tierFeeBpsForProduct(product, adminFees);
    return {
      product,
      label,
      rows: (['free', 'bronze', 'silver', 'gold'] as TierId[]).map((tier) => ({
        tier: tier[0]!.toUpperCase() + tier.slice(1),
        bps: L[tier],
        pct: formatFeeBpsLabel(L[tier]),
      })),
    };
  });
}

export function feePolicyAsAdminFees(): FeePolicyFees & {
  freeBps: number;
  bronzeBps: number;
  silverBps: number;
  goldBps: number;
  riddleWalletSessionBps: number;
  platformDefaultBps: number;
} {
  return {
    freeBps: FEE_PRODUCTS.swap.freeBps,
    bronzeBps: FEE_PRODUCTS.swap.bronzeBps,
    silverBps: FEE_PRODUCTS.swap.silverBps,
    goldBps: FEE_PRODUCTS.swap.goldBps,
    riddleWalletSessionBps: FEE_PRODUCTS.swap.riddleWalletSessionBps ?? 50,
    platformDefaultBps: FEE_PRODUCTS.swap.freeBps,
    send: { ...FEE_PRODUCTS.send },
    swap: { ...FEE_PRODUCTS.swap },
    bridge: { ...FEE_PRODUCTS.bridge },
    cafe: { ...FEE_PRODUCTS.cafe },
  };
}

// ─── Tier-aware fee helpers ────────────────────────────────────────────────

export function swapFeeBps(tier: TierId): number {
  return resolveFeeBps({ tier, product: 'swap' });
}

export function bridgeFeeBps(tier: TierId): number {
  return resolveFeeBps({ tier, product: 'bridge' });
}

export function sendFeeBps(tier: TierId): number {
  return resolveFeeBps({ tier, product: 'send' });
}

export function cafeFeeBps(tier: TierId): number {
  return resolveFeeBps({ tier, product: 'cafe' });
}

export function swapFeePercent(tier: TierId): number {
  return swapFeeBps(tier) / 100;
}

export function formatFeeRate(tier: TierId): string {
  const pct = swapFeePercent(tier);
  return pct === 0 ? '0%' : `${pct}%`;
}

export function feeOnVolumeUsd(
  tier: TierId,
  product: FeeProduct,
  volumeUsd: number
): number {
  const bps = resolveFeeBps({ tier, product });
  return (bps / 10_000) * volumeUsd;
}

export function feeSavedVsFreeUsd(
  tier: TierId,
  product: FeeProduct,
  volumeUsd: number
): number {
  return Math.max(
    0,
    feeOnVolumeUsd('free', product, volumeUsd) -
      feeOnVolumeUsd(tier, product, volumeUsd)
  );
}
