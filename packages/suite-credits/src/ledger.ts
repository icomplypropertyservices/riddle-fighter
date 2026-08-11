/**
 * Framework-agnostic client ledger for the unified suite credit pool.
 *
 * SSOT: localStorage `riddle_dev_entitlement_v1` + cookie `rdl_dev`
 *         on `.riddlewallet.com`.
 * Event: `riddle-credits-changed` (+ alias `riddle-suite-credits-changed`).
 *
 * This package only reads/writes the local ledger. Verified purchase activation
 * happens on the riddle-dev server; call `setPlan()` here after verification.
 */

import {
  DEV_PLANS,
  type DevPlanId,
  type PaygSku,
} from './economy.js';

// ─── Storage keys ──────────────────────────────────────────────────────────

export const SUITE_CREDITS_LS_KEY = 'riddle_dev_entitlement_v1';
export const COOKIE_SUITE_CREDITS = 'rdl_dev';

export const CREDITS_CHANGED_EVENT = 'riddle-credits-changed';
export const SUITE_CREDITS_ALIAS_EVENT = 'riddle-suite-credits-changed';

const SUITE_COOKIE_DOMAIN = '.riddlewallet.com';
const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60;
const CREDITS_V2_SCALE_FLAG = 'riddle_credits_denom_v2';
/**
 * Browsers cap one cookie near 4096 bytes *including* name/attrs, on the
 * ENCODED value. Never slice JSON mid-token — that is what broke credits
 * following from Wallet → Cities / Fighter (garbage cookie → 0 balance).
 */
const SUITE_COOKIE_MAX_ENCODED = 3600;

// ─── Shapes ────────────────────────────────────────────────────────────────

export interface DevEntitlement {
  plan: DevPlanId;
  credits: number;
  lastGrantAt: string | null;
  expiresAt: string | null;
  lastPaymentTx?: string;
  updatedAt: string;
}

export interface SuiteCreditLedger {
  credits: number;
  earned: number;
  spent: number;
  gameCredits?: number;
  updatedAt: string;
  lastTx?: string;
  lastSku?: string;
  plan?: string;
}

export interface CreditsChangedDetail {
  balance: number;
  delta: number;
  reason: string;
}

export interface SpendResult {
  ok: boolean;
  ledger: SuiteCreditLedger;
  message?: string;
}

// ─── SSR-safe browser helpers ──────────────────────────────────────────────

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof localStorage !== 'undefined'
  );
}

function isSuiteHost(hostname: string): boolean {
  if (!hostname) return false;
  return (
    hostname === 'riddlewallet.com' ||
    hostname.endsWith('.riddlewallet.com') ||
    hostname === 'www.riddlewallet.com'
  );
}

function cookieDomainAttr(): string {
  if (!isBrowser()) return '';
  return isSuiteHost(window.location.hostname)
    ? `; Domain=${SUITE_COOKIE_DOMAIN}`
    : '';
}

function secureAttr(): string {
  if (!isBrowser()) return '';
  return window.location.protocol === 'https:' ? '; Secure' : '';
}

function getSuiteCookie(name: string): string | null {
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

function setSuiteCookie(
  name: string,
  value: string,
  maxAgeSec = DEFAULT_MAX_AGE
): void {
  if (!isBrowser()) return;
  try {
    const encoded = encodeURIComponent(value);
    // Refuse oversized writes rather than truncating JSON (matches suiteCrossStorage).
    // Clears (maxAgeSec 0) always pass. Callers slim via slimDevPlanJson first.
    if (maxAgeSec > 0 && encoded.length > SUITE_COOKIE_MAX_ENCODED) return;
    document.cookie =
      `${name}=${encoded}; Path=/; Max-Age=${Math.max(0, maxAgeSec)}; SameSite=Lax` +
      secureAttr() +
      cookieDomainAttr();
  } catch {
    /* ignore */
  }
}

function clearSuiteCookie(name: string): void {
  if (!isBrowser()) return;
  try {
    document.cookie =
      `${name}=; Path=/; Max-Age=0; SameSite=Lax` +
      secureAttr() +
      cookieDomainAttr();
  } catch {
    /* ignore */
  }
}

function lsGet(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

function lsRemove(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function normalizeCredits(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function ensureDevPlanCreditsJson(json: string): string {
  try {
    const p = JSON.parse(json) as Record<string, unknown>;
    if (!p || typeof p !== 'object') return json;
    const n = Number(p.credits);
    const credits = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    let dirty = false;
    if (typeof p.credits !== 'number' || p.credits !== credits) {
      p.credits = credits;
      dirty = true;
    }
    if (typeof p.updatedAt !== 'string' || !p.updatedAt) {
      p.updatedAt = new Date().toISOString();
      dirty = true;
    }
    return dirty ? JSON.stringify(p) : json;
  } catch {
    return json;
  }
}

/**
 * Compact entitlement for Domain=.riddlewallet.com cookie transport.
 * Keeps only fields cities/fighter/civ need to show & spend the same pool.
 */
function slimDevPlanJson(json: string): string {
  try {
    const p = JSON.parse(json) as Record<string, unknown>;
    if (!p || typeof p !== 'object') return json;
    const slim: Record<string, unknown> = {
      plan: typeof p.plan === 'string' && p.plan ? p.plan : 'free',
      credits: normalizeCredits(p.credits),
      lastGrantAt: typeof p.lastGrantAt === 'string' ? p.lastGrantAt : null,
      expiresAt: typeof p.expiresAt === 'string' ? p.expiresAt : null,
      updatedAt:
        typeof p.updatedAt === 'string' && p.updatedAt
          ? p.updatedAt
          : new Date().toISOString(),
    };
    if (typeof p.lastPaymentTx === 'string' && p.lastPaymentTx) {
      slim.lastPaymentTx = p.lastPaymentTx.slice(0, 128);
    }
    return JSON.stringify(slim);
  } catch {
    return json;
  }
}

type ParsedLedgerSide = {
  raw: string;
  credits: number;
  t: number;
};

function parseLedgerSide(raw: string | null): ParsedLedgerSide | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as {
      updatedAt?: string | number;
      connectedAt?: number;
      credits?: unknown;
      /** Slim suiteCrossStorage / legacy cookie field */
      c?: unknown;
      balance?: unknown;
      /** Unix ms on some slim payloads */
      t?: unknown;
    };
    if (!o || typeof o !== 'object') return null;
    // Accept credits | c | balance (wallet/dev/slim cookie shapes)
    const credits = normalizeCredits(
      o.credits != null ? o.credits : o.c != null ? o.c : o.balance,
    );
    let t = 0;
    if (typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt)) {
      t = o.updatedAt > 1e12 ? o.updatedAt : o.updatedAt * 1000;
    } else if (o.updatedAt != null) {
      const parsed = Date.parse(String(o.updatedAt));
      t = Number.isFinite(parsed) ? parsed : 0;
    }
    if (!t) {
      const n = Number(o.connectedAt ?? o.t);
      if (Number.isFinite(n) && n > 0) t = n > 1e12 ? n : n * 1000;
    }
    // Rewrite slim {c,t} into canonical JSON so later merges see `credits`
    let normalizedRaw = raw;
    if (
      (o.credits == null || typeof o.credits !== 'number') &&
      credits >= 0
    ) {
      try {
        normalizedRaw = JSON.stringify({
          plan: typeof (o as { plan?: string }).plan === 'string'
            ? (o as { plan?: string }).plan
            : 'free',
          credits,
          lastGrantAt: null,
          expiresAt: null,
          updatedAt: t ? new Date(t).toISOString() : new Date().toISOString(),
        });
      } catch {
        /* keep raw */
      }
    }
    return { raw: normalizedRaw, credits, t };
  } catch {
    // Corrupt / truncated cookie — ignore so a good LS or cookie can win
    return null;
  }
}

/**
 * Merge LS + cookie for the shared credit pool.
 *
 * Prefer **newer `updatedAt`** so spends/grants converge across subdomains.
 * Never prefer "max credits" when both sides are valid — that undid spends
 * when a stale higher cookie beat a fresher lower LS (or vice versa).
 *
 * Corrupt / truncated cookies parse as null (see parseLedgerSide), so they
 * cannot invent a newer zero and wipe a good ledger.
 *
 * Tie-break when timestamps match: keep localStorage (same-origin truth).
 */
function suiteStorageGet(lsKey: string, cookieName: string): string | null {
  const local = lsGet(lsKey);
  const cookie = getSuiteCookie(cookieName);
  const L = parseLedgerSide(local);
  const C = parseLedgerSide(cookie);

  if (L && C) {
    let winner: ParsedLedgerSide;
    if (C.t !== L.t) {
      winner = C.t > L.t ? C : L;
    } else if (L.credits !== C.credits) {
      // Identical clock (or both missing): prefer LS so in-tab spends stick.
      // If LS is missing a clock but cookie has one, C.t !== L.t already handled.
      winner = L;
    } else {
      winner = L;
    }

    // Always converge both sides onto winner so the next cross-app read is stable.
    try {
      if (local !== winner.raw) lsSet(lsKey, winner.raw);
      setSuiteCookie(cookieName, slimDevPlanJson(winner.raw));
    } catch {
      /* soft */
    }
    return winner.raw;
  }
  if (L) {
    setSuiteCookie(cookieName, slimDevPlanJson(L.raw));
    return L.raw;
  }
  if (C) {
    lsSet(lsKey, C.raw);
    return C.raw;
  }
  return null;
}

function suiteStorageSet(
  lsKey: string,
  cookieName: string,
  value: string,
  maxAgeSec = DEFAULT_MAX_AGE
): void {
  const normalized = ensureDevPlanCreditsJson(value);
  lsSet(lsKey, normalized);
  // Always write slim shape to cookie so cross-subdomain apps get a valid rdl_dev
  setSuiteCookie(cookieName, slimDevPlanJson(normalized), maxAgeSec);
}

function suiteStorageRemove(lsKey: string, cookieName: string): void {
  lsRemove(lsKey);
  clearSuiteCookie(cookieName);
}

function readDevPlanJson(): string | null {
  const v = suiteStorageGet(SUITE_CREDITS_LS_KEY, COOKIE_SUITE_CREDITS);
  if (v) {
    const normalized = ensureDevPlanCreditsJson(v);
    if (normalized !== v) {
      suiteStorageSet(SUITE_CREDITS_LS_KEY, COOKIE_SUITE_CREDITS, normalized);
      return normalized;
    }
    return v;
  }
  const legacy = lsGet('riddle_dev_entitlement');
  if (legacy) {
    const normalized = ensureDevPlanCreditsJson(legacy);
    suiteStorageSet(SUITE_CREDITS_LS_KEY, COOKIE_SUITE_CREDITS, normalized);
    lsRemove('riddle_dev_entitlement');
    return normalized;
  }
  return null;
}

function persistDevPlanJson(json: string): void {
  suiteStorageSet(
    SUITE_CREDITS_LS_KEY,
    COOKIE_SUITE_CREDITS,
    ensureDevPlanCreditsJson(json)
  );
}

function clearDevPlanJson(): void {
  suiteStorageRemove(SUITE_CREDITS_LS_KEY, COOKIE_SUITE_CREDITS);
  lsRemove('riddle_dev_entitlement');
}

// ─── Entitlement core ──────────────────────────────────────────────────────

export function freeDevEntitlement(): DevEntitlement {
  return {
    plan: 'free',
    credits: 0,
    lastGrantAt: null,
    expiresAt: null,
    updatedAt: new Date().toISOString(),
  };
}

let snapshotCache: { raw: string; value: DevEntitlement } | null = null;

export function loadDevEntitlement(): DevEntitlement {
  if (!isBrowser()) return freeDevEntitlement();
  try {
    const raw = readDevPlanJson();
    if (!raw) return freeDevEntitlement();
    const parsed = JSON.parse(raw) as Partial<DevEntitlement> & {
      credits?: unknown;
    };
    // Never zero credits just because plan is missing/unknown — preserve balance
    // so Wallet / Cities / Fighter / Civ all share one pool.
    const plan: DevPlanId =
      parsed?.plan && parsed.plan in DEV_PLANS
        ? (parsed.plan as DevPlanId)
        : 'free';

    const credits = normalizeCredits(parsed.credits);

    // One-shot migration flag only — do NOT multiply balances (broke cross-app).
    try {
      if (localStorage.getItem(CREDITS_V2_SCALE_FLAG) !== '1') {
        localStorage.setItem(CREDITS_V2_SCALE_FLAG, '1');
      }
    } catch {
      /* private mode */
    }

    let updatedAt: string;
    const rawUpdated = (parsed as { updatedAt?: unknown }).updatedAt;
    if (typeof rawUpdated === 'string' && rawUpdated) {
      updatedAt = rawUpdated;
    } else if (typeof rawUpdated === 'number' && Number.isFinite(rawUpdated)) {
      updatedAt = new Date(rawUpdated > 1e12 ? rawUpdated : rawUpdated * 1000).toISOString();
    } else {
      updatedAt = new Date().toISOString();
    }

    const ent: DevEntitlement = {
      plan,
      credits,
      lastGrantAt:
        typeof parsed.lastGrantAt === 'string' ? parsed.lastGrantAt : null,
      expiresAt:
        typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null,
      lastPaymentTx:
        typeof parsed.lastPaymentTx === 'string'
          ? parsed.lastPaymentTx
          : undefined,
      updatedAt,
    };

    // Persist normalized shape so other apps always get valid plan+credits
    try {
      const want = JSON.stringify(ent);
      if (want !== raw) persistDevPlanJson(want);
    } catch {
      /* ignore */
    }

    // Plan expiry drops paid plan → free but KEEPS credit balance
    if (ent.expiresAt && Date.parse(ent.expiresAt) < Date.now()) {
      return { ...ent, plan: 'free', expiresAt: null };
    }
    return ent;
  } catch {
    return freeDevEntitlement();
  }
}

export function saveDevEntitlement(
  e: DevEntitlement,
  opts?: { emitDelta?: number; emitReason?: string }
): DevEntitlement {
  if (!isBrowser()) return e;
  const prevCredits =
    opts?.emitDelta != null
      ? normalizeCredits(e.credits) - (opts.emitDelta || 0)
      : snapshotCache?.value?.credits ?? getCredits();
  const next: DevEntitlement = {
    ...e,
    credits: normalizeCredits(e.credits),
    updatedAt: new Date().toISOString(),
  };
  try {
    persistDevPlanJson(JSON.stringify(next));
  } catch {
    /* quota */
  }
  snapshotCache = null;
  const delta =
    opts?.emitDelta != null ? opts.emitDelta : next.credits - prevCredits;
  emitCreditsChanged(next.credits, delta, opts?.emitReason || 'update');
  return next;
}

function toLedger(
  ent: DevEntitlement,
  extra?: Partial<SuiteCreditLedger>
): SuiteCreditLedger {
  return {
    credits: Math.max(0, Math.floor(Number(ent.credits) || 0)),
    earned: Math.max(0, Math.floor(Number(extra?.earned) || 0)),
    spent: Math.max(0, Math.floor(Number(extra?.spent) || 0)),
    gameCredits: Math.max(
      0,
      Math.floor(Number(extra?.gameCredits ?? ent.credits) || 0)
    ),
    updatedAt: ent.updatedAt || new Date().toISOString(),
    lastTx: extra?.lastTx || ent.lastPaymentTx,
    lastSku: extra?.lastSku,
    plan: ent.plan,
  };
}

function emitCreditsChanged(balance: number, delta: number, reason: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent<CreditsChangedDetail>(CREDITS_CHANGED_EVENT, {
        detail: { balance, delta, reason },
      })
    );
  } catch {
    /* soft */
  }
  try {
    window.dispatchEvent(
      new CustomEvent<SuiteCreditLedger>(SUITE_CREDITS_ALIAS_EVENT, {
        detail: toLedger(loadDevEntitlement()),
      })
    );
  } catch {
    /* soft */
  }
}

function emitAlias(ledger: SuiteCreditLedger): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent<SuiteCreditLedger>(SUITE_CREDITS_ALIAS_EVENT, {
        detail: ledger,
      })
    );
  } catch {
    /* soft */
  }
}

// ─── Public ledger API ─────────────────────────────────────────────────────

/** Live credit balance from the unified suite ledger. */
export function getBalance(): number {
  return loadDevEntitlement().credits;
}

/** Full entitlement read from the unified suite ledger. */
export function getEntitlement(): DevEntitlement {
  return loadDevEntitlement();
}

/** Grant credits to the ledger (after verified purchase/earn). */
export function grant(amount: number, reason = 'grant'): DevEntitlement {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const current = loadDevEntitlement();
  if (n === 0) return current;
  return saveDevEntitlement(
    { ...current, credits: current.credits + n },
    { emitDelta: n, emitReason: reason }
  );
}

/**
 * Free starter pack for every new user — **1000 credits once**.
 * Ledger is browser/device shared (rdl_dev), so this is once per browser,
 * not once per plan purchase. Optional address only tags the grant reason.
 */
export const HANDLE_STARTER_CREDITS = 1000;
/** Alias — preferred name for the free starter grant. */
export const STARTER_CREDITS = HANDLE_STARTER_CREDITS;
const STARTER_FLAG_KEY = 'riddle_starter_credits_v1';
const HANDLE_STARTER_FLAG_PREFIX = 'riddle_handle_starter_v1:';

function readStarterAlreadyClaimed(address?: string | null): boolean {
  if (!isBrowser()) return false;
  try {
    if (localStorage.getItem(STARTER_FLAG_KEY) === '1') return true;
    const addr = String(address || '')
      .trim()
      .toLowerCase();
    // Legacy per-wallet / browser handle flags (pre-unification)
    if (localStorage.getItem(HANDLE_STARTER_FLAG_PREFIX + 'browser') === '1') {
      return true;
    }
    if (addr && localStorage.getItem(HANDLE_STARTER_FLAG_PREFIX + addr) === '1') {
      return true;
    }
  } catch {
    /* soft */
  }
  return false;
}

function markStarterClaimed(address?: string | null): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STARTER_FLAG_KEY, '1');
    const addr = String(address || '')
      .trim()
      .toLowerCase();
    localStorage.setItem(
      HANDLE_STARTER_FLAG_PREFIX + (addr || 'browser'),
      '1'
    );
  } catch {
    /* soft */
  }
}

/**
 * Ensure every browser gets the free **1000-credit starter once**.
 *
 * Rules (no infinite free pool):
 *  - already claimed → never auto-grant again (spent-to-0 stays 0)
 *  - balance ≥ 1000 → mark claimed, grant 0
 *  - never claimed → mark claimed first, then grant gap up to 1000
 *  - opts.force → grant gap regardless of claim flag (admin / tests only)
 *
 * Safe on every hydrate / app mount. Recovering wiped ledgers that left the
 * claim flag set is intentionally NOT done — that path refilled forever after
 * users spent their starter to zero.
 */
export function ensureStarterCredits(
  address?: string | null,
  opts?: { force?: boolean; amount?: number }
): { granted: number; balance: number; alreadyClaimed: boolean } {
  const amount = Math.max(
    0,
    Math.floor(Number(opts?.amount ?? STARTER_CREDITS) || 0)
  );
  if (!isBrowser() || amount <= 0) {
    return { granted: 0, balance: getBalance(), alreadyClaimed: false };
  }

  const bal = getBalance();
  const claimed = readStarterAlreadyClaimed(address);
  const addr = String(address || '')
    .trim()
    .toLowerCase();
  const reasonBase = addr
    ? `starter:${addr.slice(0, 12)}`
    : 'starter:free';

  // Already at or above starter floor — seal claim flag
  if (!opts?.force && bal >= amount) {
    markStarterClaimed(address);
    return { granted: 0, balance: bal, alreadyClaimed: claimed };
  }

  // Claimed and not forced: user already received starter (spent some or all)
  if (!opts?.force && claimed) {
    return { granted: 0, balance: bal, alreadyClaimed: true };
  }

  // First-time (or force): claim flag BEFORE grant to shrink multi-mount races
  // (React Strict Mode, WalletNav + ClientProviders + bridge all call this).
  markStarterClaimed(address);

  // Re-read after claim — another mount may have granted already
  const bal2 = getBalance();
  const need = Math.max(0, amount - bal2);
  if (need <= 0) {
    return { granted: 0, balance: bal2, alreadyClaimed: true };
  }

  grant(need, opts?.force ? `${reasonBase}:force` : reasonBase);
  return {
    granted: need,
    balance: getBalance(),
    alreadyClaimed: claimed,
  };
}

/**
 * @deprecated Use `ensureStarterCredits` — same one-time 1000 free starter.
 * Kept for handle-claim call sites.
 */
export function grantHandleStarterCredits(
  address?: string | null,
  opts?: { force?: boolean; amount?: number }
): { granted: number; balance: number; alreadyClaimed: boolean } {
  return ensureStarterCredits(address, opts);
}

/** Spend credits; returns false if balance is insufficient. */
export function spend(amount: number, reason = 'spend'): boolean {
  const cost = Math.max(0, Math.floor(Number(amount) || 0));
  if (cost === 0) return true;
  const current = loadDevEntitlement();
  if (current.credits < cost) return false;
  saveDevEntitlement(
    { ...current, credits: current.credits - cost },
    { emitDelta: -cost, emitReason: reason }
  );
  return true;
}

/** Spend credits with a full ledger result. */
export function spendWithLedger(
  amount: number,
  meta?: { sku?: string }
): SpendResult {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const bal = getBalance();
  if (n <= 0) return { ok: true, ledger: loadSuiteCredits() };
  if (bal < n) {
    return {
      ok: false,
      ledger: loadSuiteCredits(),
      message: `Need ${n} cr · have ${bal} cr (100 cr = $1)`,
    };
  }
  const ok = spend(n, meta?.sku ? `spend:${meta.sku}` : 'spend');
  const final = loadSuiteCredits();
  emitAlias(final);
  if (!ok) {
    return {
      ok: false,
      ledger: final,
      message: `Need ${n} cr · have ${bal} cr (100 cr = $1)`,
    };
  }
  return { ok: true, ledger: final };
}

/** Activate a plan after a verified on-chain payment. */
export function setPlan(
  plan: DevPlanId,
  txHash?: string,
  opts?: { durationHours?: number; creditGrant?: number }
): DevEntitlement {
  const current = loadDevEntitlement();
  const p = DEV_PLANS[plan] ?? DEV_PLANS.free;
  // Free plan must never wipe the shared credit pool (starter / PAYG / earns).
  // Paid plans roll over up to rolloverCap; non-rollover paid plans start from 0 + grant.
  const carried =
    plan === 'free'
      ? current.credits
      : p.rollover
        ? Math.min(current.credits, p.rolloverCap)
        : 0;
  const grantAmt =
    opts?.creditGrant != null && opts.creditGrant >= 0
      ? Math.floor(opts.creditGrant)
      : plan === 'free'
        ? 0
        : p.monthlyCredits;
  const credits = carried + grantAmt;
  const delta = credits - current.credits;
  const hours =
    opts?.durationHours != null && opts.durationHours > 0
      ? opts.durationHours
      : 30 * 24;

  return saveDevEntitlement(
    {
      plan,
      credits,
      lastGrantAt: new Date().toISOString(),
      expiresAt:
        plan === 'free'
          ? null
          : new Date(Date.now() + hours * 3600 * 1000).toISOString(),
      lastPaymentTx: txHash,
      updatedAt: new Date().toISOString(),
    },
    delta !== 0 ? { emitDelta: delta, emitReason: `plan:${plan}` } : undefined
  );
}

/** Subscribe to ledger changes. */
export function subscribe(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const notify = () => {
    try {
      listener();
    } catch {
      /* soft */
    }
  };

  const onCredits = () => notify();
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === SUITE_CREDITS_LS_KEY || e.key === COOKIE_SUITE_CREDITS)
      notify();
  };
  const onFocus = () => {
    snapshotCache = null;
    notify();
  };
  const onVis = () => {
    if (document.visibilityState === 'visible') {
      snapshotCache = null;
      notify();
    }
  };

  window.addEventListener(CREDITS_CHANGED_EVENT, onCredits);
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVis);

  return () => {
    window.removeEventListener(CREDITS_CHANGED_EVENT, onCredits);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVis);
  };
}

// ─── Snapshot / server-safe accessors ──────────────────────────────────────

export function getDevEntitlementSnapshot(): DevEntitlement {
  const raw = isBrowser() ? readDevPlanJson() || '' : '';
  if (snapshotCache && snapshotCache.raw === raw) return snapshotCache.value;
  const value = loadDevEntitlement();
  snapshotCache = { raw, value };
  return value;
}

const SERVER_SNAPSHOT: DevEntitlement = Object.freeze({
  plan: 'free',
  credits: 0,
  lastGrantAt: null,
  expiresAt: null,
  updatedAt: '1970-01-01T00:00:00.000Z',
}) as DevEntitlement;

export function getDevEntitlementServerSnapshot(): DevEntitlement {
  return SERVER_SNAPSHOT;
}

/**
 * Re-read ledger from LS/cookie and ensure free starter (1000 cr) once per browser.
 * Call on app mount / focus. Already-claimed browsers are left unchanged (no refill).
 */
export function hydrateDevEntitlementFromSuite(
  address?: string | null
): DevEntitlement {
  snapshotCache = null;
  try {
    ensureStarterCredits(address);
  } catch {
    /* soft — never block hydrate */
  }
  snapshotCache = null;
  return getDevEntitlementSnapshot();
}

// ─── Suite-credits.ts compatibility aliases ────────────────────────────────

/** @deprecated Use `getBalance()` directly. */
export function getCredits(): number {
  return getBalance();
}

/** @deprecated Use `getEntitlement()` directly. */
export function getDevEntitlement(): DevEntitlement {
  return getEntitlement();
}

/** @deprecated Use `grant()` directly. */
export function addCredits(amount: number, reason = 'grant'): DevEntitlement {
  return grant(amount, reason);
}

/** @deprecated Use `grant()` directly. */
export function addPaygCredits(amount: number, sku?: PaygSku): DevEntitlement {
  return grant(amount, sku ? `payg:${sku}` : 'payg');
}

/** @deprecated Use `grant()` directly. */
export function addDevCredits(amount: number, _sku?: PaygSku): DevEntitlement {
  return addPaygCredits(amount, _sku);
}

/** @deprecated Use `spend()` directly. */
export function spendCredits(amount: number, reason = 'spend'): boolean {
  return spend(amount, reason);
}

/** @deprecated Use `spend()` directly. */
export function spendCreditsAmount(amount: number, reason = 'spend'): boolean {
  return spend(amount, reason);
}

/** @deprecated Use `spendWithLedger()` directly. */
export function spendSuiteCredits(
  amount: number,
  meta?: { sku?: string }
): SpendResult {
  return spendWithLedger(amount, meta);
}

/** @deprecated Use `setPlan()` directly. */
export function activateDevPlan(
  plan: DevPlanId,
  txHash?: string,
  opts?: { durationHours?: number; creditGrant?: number }
): DevEntitlement {
  return setPlan(plan, txHash, opts);
}

/** @deprecated Use `subscribe()` directly. */
export function subscribeDevEntitlement(onChange: () => void): () => void {
  return subscribe(onChange);
}

/** Ledger view shape — mapped from DevEntitlement. */
export function loadSuiteCredits(): SuiteCreditLedger {
  return toLedger(getEntitlement());
}

/** Soft overwrite of credit balance on SSOT. */
export function saveSuiteCredits(ledger: SuiteCreditLedger): SuiteCreditLedger {
  const cur = getEntitlement();
  const next = saveDevEntitlement(
    {
      ...cur,
      credits: Math.max(0, Math.floor(Number(ledger.credits) || 0)),
      lastPaymentTx: ledger.lastTx || cur.lastPaymentTx,
    },
    { emitReason: 'suite-save' }
  );
  const out = toLedger(next, {
    earned: ledger.earned,
    spent: ledger.spent,
    gameCredits: ledger.gameCredits,
    lastSku: ledger.lastSku,
  });
  emitAlias(out);
  return out;
}

/** Grant credits after verified micro / PAYG payment → SSOT. */
export function grantSuiteCredits(
  amount: number,
  meta?: { tx?: string; sku?: string; game?: boolean }
): SuiteCreditLedger {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const reason = meta?.sku
    ? meta.game
      ? `game:${meta.sku}`
      : `payg:${meta.sku}`
    : 'grant';
  const ent = n > 0 ? grant(n, reason) : getEntitlement();
  if (meta?.tx && n > 0) {
    saveDevEntitlement(
      { ...ent, lastPaymentTx: meta.tx },
      { emitDelta: 0, emitReason: 'tx-meta' }
    );
  }
  const out = toLedger(getEntitlement(), {
    lastTx: meta?.tx,
    lastSku: meta?.sku,
    gameCredits: meta?.game ? getBalance() : undefined,
  });
  emitAlias(out);
  return out;
}

/** @deprecated Use `getBalance()` directly. */
export function suiteCreditsBalance(): number {
  return getBalance();
}

/** Clear the ledger (free plan, zero credits). */
export function clearDevEntitlement(): DevEntitlement {
  const prev = isBrowser() ? getBalance() : 0;
  if (isBrowser()) {
    try {
      clearDevPlanJson();
    } catch {
      /* ignore */
    }
  }
  snapshotCache = null;
  emitCreditsChanged(0, -prev, 'clear');
  return freeDevEntitlement();
}

export const DEV_ENTITLEMENT_STORAGE_KEY = SUITE_CREDITS_LS_KEY;

// USD helper kept for compatibility with legacy suite-credits callers.
export function tierPriceUsd(tier: string): number {
  const t = String(tier || 'free').toLowerCase();
  if (t === 'free') return 0;
  if (t === 'bronze') return 4.99;
  if (t === 'silver') return 14.99;
  if (t === 'gold') return 39.99;
  return 0;
}

/** @deprecated Micro XRP quotes removed — always null. */
export function tierMicroXrp(_tier: string): string | null {
  return null;
}
