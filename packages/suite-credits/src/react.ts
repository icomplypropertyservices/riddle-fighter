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
export function useSuiteCredits(): UseSuiteCreditsResult {
  const isClient = useIsClient();
  const entitlement = useSyncExternalStore(
    subscribe,
    getDevEntitlementSnapshot,
    getDevEntitlementServerSnapshot
  );

  const refresh = useCallback(() => {
    hydrateDevEntitlementFromSuite();
  }, []);

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
