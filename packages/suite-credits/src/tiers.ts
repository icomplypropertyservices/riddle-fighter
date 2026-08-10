/**
 * Wallet tier entitlement READ helpers.
 *
 * Sources (in order):
 *   1. localStorage `riddle_wallet_session`
 *   2. cookie `rdl_sess`
 *   3. cookie `rdl_tier`
 *   4. localStorage `riddle_subscription_entitlement`
 *
 * Shape follows `lib/subscriptions/store.ts` Entitlement.
 */

import {
  type FeeProduct,
  type TierId,
  TIER_ORDER,
  resolveFeeBps as resolveFeeBpsFromEconomy,
  normalizeFeeTier,
  getTierMeta,
  tierRank,
  isAtLeast,
} from './economy.js';

export type { TierId };

export interface PaymentTxRecord {
  chain: string;
  txHash?: string;
  at: string;
  amount?: string;
  source?: string;
  tier?: TierId;
}

export interface Entitlement {
  tier: TierId;
  expiresAt: number | null;
  paymentTxs: PaymentTxRecord[];
  migratedFromPro?: boolean;
  updatedAt: string;
}

const WALLET_SESSION_LS_KEY = 'riddle_wallet_session';
const ENTITLEMENT_LS_KEY = 'riddle_subscription_entitlement';
const COOKIE_RW_SESSION = 'rdl_sess';
const COOKIE_WALLET_TIER = 'rdl_tier';

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof localStorage !== 'undefined'
  );
}

function lsGet(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getCookie(name: string): string | null {
  if (!isBrowser()) return null;
  try {
    const parts = document.cookie.split('; ');
    for (const p of parts) {
      const i = p.indexOf('=');
      if (i < 0) continue;
      const k = p.slice(0, i);
      if (k === name) return decodeURIComponent(p.slice(i + 1));
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isValidTier(v: unknown): v is TierId {
  return typeof v === 'string' && (TIER_ORDER as string[]).includes(v);
}

function parseTierFromJson(raw: string | null): TierId | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return null;
    if (isValidTier(data.tier)) return data.tier;
  } catch {
    /* ignore */
  }
  return null;
}

function readRawTierSource(): string | null {
  if (!isBrowser()) return null;
  return (
    lsGet(WALLET_SESSION_LS_KEY) ||
    getCookie(COOKIE_RW_SESSION) ||
    getCookie(COOKIE_WALLET_TIER) ||
    lsGet(ENTITLEMENT_LS_KEY)
  );
}

function isExpired(ent: Entitlement): boolean {
  if (ent.expiresAt == null) return false;
  return Date.now() > ent.expiresAt;
}

function parseEntitlement(raw: string): Entitlement | null {
  try {
    const data = JSON.parse(raw) as Partial<Entitlement>;
    if (!isValidTier(data.tier)) return null;
    return {
      tier: data.tier,
      expiresAt:
        data.expiresAt === null || typeof data.expiresAt === 'number'
          ? data.expiresAt
          : null,
      paymentTxs: Array.isArray(data.paymentTxs) ? data.paymentTxs : [],
      migratedFromPro: !!data.migratedFromPro,
      updatedAt:
        typeof data.updatedAt === 'string'
          ? data.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Read full wallet entitlement from session/tier sources. */
export function getWalletEntitlement(): Entitlement | null {
  const raw = readRawTierSource();
  if (!raw) return null;
  return parseEntitlement(raw);
}

/** Resolve the effective wallet tier, falling back to free. */
export function getSuiteTier(): TierId {
  const raw = readRawTierSource();
  if (!raw) return 'free';
  const tier = parseTierFromJson(raw);
  if (!tier) return 'free';
  const ent = parseEntitlement(raw);
  if (ent && isExpired(ent)) return 'free';
  return tier;
}

/** Alias for legacy callers. */
export function getTier(): TierId {
  return getSuiteTier();
}

/** Resolve fee bps for a flow + tier. */
export function resolveFeeBps(
  flow: FeeProduct,
  tier: TierId | string
): number {
  return resolveFeeBpsFromEconomy({ tier, product: flow });
}

/** Re-exported helpers from economy. */
export {
  getTierMeta,
  normalizeFeeTier,
  tierRank,
  isAtLeast,
  isValidTier as isSuiteTier,
};

/** Subscribe to tier storage changes. */
export function subscribeTier(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const notify = () => {
    try {
      onChange();
    } catch {
      /* soft */
    }
  };

  const onStorage = (e: StorageEvent) => {
    if (
      !e.key ||
      e.key === WALLET_SESSION_LS_KEY ||
      e.key === ENTITLEMENT_LS_KEY
    ) {
      notify();
    }
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
