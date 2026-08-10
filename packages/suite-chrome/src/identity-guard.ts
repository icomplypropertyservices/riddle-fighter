/**
 * Suite chrome identity guard — SSOT for addresses that must NEVER be treated
 * as a live player in the header, social rail, or any chrome chip.
 *
 * Mirrors lib/suite-connect.ts ~536-600 semantics. No process.env.
 */

/** Ops / bank / hot minter / issuer addresses — never a player Account. */
export const NEVER_PLAYER_XRPL_ADDRESSES = [
  'rDiHMcZARsb1uakt8tYScLbZuLRihZqjMp', // game mint hot
  'rEwUuTNY3TaXAJL6T4y1tjkAnY7JPdX3dB', // suite treasury / bank
  'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', // collection issuer
  'rpHshLWWWJoitkWBAJVBpyBdQq425XE77C', // legacy / alternate fee destination
  'r3fBtgrV5ZvfqWKPLmvEtD6qRsQSmq2yPb', // lands issuer
] as const

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
  if (isPoisonedTestWallet(a)) return true
  if (NEVER_PLAYER_SET.has(a.toLowerCase())) return true
  if (extra) {
    for (const e of extra) {
      if (a.toLowerCase() === String(e || '').trim().toLowerCase()) return true
    }
  }
  if (/^rDEMO/i.test(a)) return true
  if (/XXXXXXXX/i.test(a)) return true
  if (/Holder/i.test(a)) return true
  if (/CitiesMeta/i.test(a)) return true
  if (/MetaverseX/i.test(a)) return true
  return false
}
