/**
 * React hooks for suite credits and wallet tier.
 *
 * Client-only: all window/document/localStorage access is guarded so SSR
 * renders do not throw. Hooks return safe defaults on the server.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  grant,
  spend,
  subscribe,
  getDevEntitlementSnapshot,
  getDevEntitlementServerSnapshot,
  hydrateDevEntitlementFromSuite,
  ensureStarterCredits,
  type DevEntitlement,
} from './ledger.js';
import {
  getSuiteTier,
  subscribeTier,
  type TierId,
} from './tiers.js';

export interface UseSuiteCreditsResult {
  balance: number;
  plan: string | null;
  loading: boolean;
  refresh: () => void;
  spend: (amount: number, reason?: string) => boolean;
  grant: (amount: number, reason?: string) => DevEntitlement;
}

export interface UseSuiteTierResult {
  tier: TierId;
  loading: boolean;
}

function useIsClient(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/** Live suite-credits balance and plan. */
export function useSuiteCredits(opts?: {
  /** Wallet address — tags starter grant reason only (ledger is shared). */
  address?: string | null;
}): UseSuiteCreditsResult {
  const isClient = useIsClient();
  const address = opts?.address ?? null;
  const entitlement = useSyncExternalStore(
    subscribe,
    getDevEntitlementSnapshot,
    getDevEntitlementServerSnapshot
  );

  // One-time free starter (1000 cr) once per browser — no refill after spend
  useEffect(() => {
    if (!isClient) return;
    try {
      ensureStarterCredits(address);
    } catch {
      /* soft */
    }
  }, [isClient, address]);

  const refresh = useCallback(() => {
    hydrateDevEntitlementFromSuite(address);
  }, [address]);

  const spendCb = useCallback(
    (amount: number, reason = 'spend') => spend(amount, reason),
    []
  );

  const grantCb = useCallback(
    (amount: number, reason = 'grant') => grant(amount, reason),
    []
  );

  return useMemo(
    () => ({
      balance: Math.max(0, Math.floor(entitlement.credits || 0)),
      plan: entitlement.plan || null,
      loading: !isClient,
      refresh,
      spend: spendCb,
      grant: grantCb,
    }),
    [entitlement, isClient, refresh, spendCb, grantCb]
  );
}

/**
 * Cross-app credits bridge for *.riddlewallet.com games.
 * Re-hydrates rdl_dev cookie on focus/visibility + short delayed pulls
 * so Wallet/Dev grants appear on Cities / Fighter / Civ without re-login.
 */
export function useSuiteCreditsBridge(opts?: {
  topUpUrl?: string;
  delayMs?: number[];
}): UseSuiteCreditsResult & { topUpUrl: string } {
  const base = useSuiteCredits();
  const topUpUrl =
    opts?.topUpUrl || 'https://wallet.riddlewallet.com/?tab=credits';
  const delays = opts?.delayMs || [400, 1600];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pull = () => {
      try {
        base.refresh();
      } catch {
        /* soft */
      }
    };
    pull();
    window.addEventListener('focus', pull);
    document.addEventListener('visibilitychange', pull);
    const timers = delays.map((ms) => window.setTimeout(pull, ms));
    return () => {
      window.removeEventListener('focus', pull);
      document.removeEventListener('visibilitychange', pull);
      timers.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bridge mounts once per app
  }, [base.refresh]);

  return useMemo(
    () => ({
      ...base,
      topUpUrl,
    }),
    [base, topUpUrl]
  );
}

/** Live wallet fee tier. */
export function useSuiteTier(): UseSuiteTierResult {
  const isClient = useIsClient();
  const tier = useSyncExternalStore<TierId>(
    subscribeTier,
    getSuiteTier,
    () => 'free'
  );

  return useMemo(
    () => ({ tier, loading: !isClient }),
    [tier, isClient]
  );
}
