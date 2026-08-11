/**
 * Suite chrome identity guard — SSOT for addresses that must NEVER be treated
 * as a live player in the header, social rail, or any chrome chip.
 *
 * Mirrors lib/suite-connect.ts ~536-600 semantics. No process.env.
 */

/**
 * Ops / bank / hot minter / issuer addresses.
 *
 * EMPTY by operator decision (2026-08-10): these wallets must be able to hold
 * a suite session like any other. Blocking them here made the header render
 * "Connect wallet" for an account that had genuinely connected. The list is
 * kept (rather than deleted) so re-enabling is a one-line change.
 */
export const NEVER_PLAYER_XRPL_ADDRESSES: readonly string[] = []

const NEVER_PLAYER_SET = new Set(
  NEVER_PLAYER_XRPL_ADDRESSES.map((a) => a.toLowerCase()),
)

/** Known poisoned test-wallet prefix(es). */
export const POISONED_WALLET_PREFIXES = ['rHvuNQ88'] as const

/** True for the internal test / ghost wallet that must never suite-login. */
export function isPoisonedTestWallet(
  address: string | null | undefined,
): boolean {
  const a = String(address || '').trim()
  if (!a || a.length < 8) return false
  // Known test wallet UI: rHvuNQ88…Zg8i — match substring so truncated forms die too.
  if (/rHvuNQ88/i.test(a)) return true
  if (/^rHvu/i.test(a) && /Zg8i$/i.test(a)) return true
  for (const p of POISONED_WALLET_PREFIXES) {
    if (a.toLowerCase().startsWith(p.toLowerCase())) return true
  }
  return false
}

/**
 * Chrome-specific forbidden check:
 * - 5 ops addresses
 * - poisoned test wallet
 * - demo / placeholder patterns
 * - optional caller-supplied extra addresses (replaces env reads).
 */
export function isForbiddenChromeAddress(
  address: string,
  extra?: string[],
): boolean {
  const a = String(address || '').trim()
  if (!a) return false
  // NEVER_PLAYER_XRPL_ADDRESSES is empty by operator decision, and `extra` is
  // deliberately ignored: callers pass the treasury/fee address from env, and
  // honouring that here is what made those wallets show "Connect wallet" in
  // the header after a successful connect.
  void extra
  if (NEVER_PLAYER_SET.has(a.toLowerCase())) return true
  // Obvious non-wallets from sample/demo data — input validation, not policy.
  if (/^rDEMO/i.test(a)) return true
  if (/XXXXXXXX/i.test(a)) return true
  if (/CitiesMeta/i.test(a)) return true
  if (/MetaverseX/i.test(a)) return true
  return false
}
