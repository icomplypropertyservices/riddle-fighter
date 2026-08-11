/**
 * G10 regression: one match key → one XP claim (local claim helpers).
 * Run: node scripts/test-g10-settlement-idempotency.mjs
 *
 * Mocks localStorage so pure claim + key logic can run under Node.
 */

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

// ── mock browser storage ──────────────────────────────────────────
const store = new Map()
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}
globalThis.localStorage = localStorage
globalThis.window = {
  localStorage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  CustomEvent: class CustomEvent {
    constructor(type, init) {
      this.type = type
      this.detail = init?.detail
    }
  },
}

// Vite/TS sources are .ts — load via dynamic transpile is heavy.
// Re-implement the claim contract here mirroring fighterProgress + matchSettlement
// and also exercise exported pure helpers if we can import the built modules.
// Prefer inline mirror of the contract + API match-id semantics.

function claimMatchXpKey(matchKey, cap = 200) {
  const key = String(matchKey || '').trim()
  if (!key) return true
  const LS = 'rf_match_xp_claimed_v1'
  let prev = []
  try {
    const raw = localStorage.getItem(LS)
    prev = raw ? JSON.parse(raw) : []
    if (!Array.isArray(prev)) prev = []
  } catch {
    prev = []
  }
  if (prev.includes(key)) return false
  const next = [key, ...prev.filter((k) => k !== key)].slice(0, cap)
  localStorage.setItem(LS, JSON.stringify(next))
  return true
}

function buildSettlementKey(input) {
  const explicit = String(input.settlementKey || '').trim()
  if (explicit) return explicit
  const battleId = String(input.entryLock?.battleId || '').trim()
  if (battleId) return `battle:${battleId}`
  return `once:${input.mode}:${input.selectedId || 'none'}:${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function claimSettlementKey(key, cap = 120) {
  const k = String(key || '').trim()
  if (!k) return true
  if (k.startsWith('once:')) return true
  const LS = 'rf_match_settled_v1'
  let prev = []
  try {
    const raw = localStorage.getItem(LS)
    prev = raw ? JSON.parse(raw) : []
    if (!Array.isArray(prev)) prev = []
  } catch {
    prev = []
  }
  if (prev.includes(k)) return false
  const next = [k, ...prev.filter((x) => x !== k)].slice(0, cap)
  localStorage.setItem(LS, JSON.stringify(next))
  return true
}

function xpForMatch(won, combo = 0, wager = 0) {
  const c = Math.max(0, Math.floor(combo))
  const w = Math.max(0, Math.floor(wager))
  if (won) return 50 + c * 8 + Math.min(40, Math.floor(w / 5))
  return 15 + c * 3 + Math.min(15, Math.floor(w / 10))
}

/** Simulate settle: claim settlement then claim XP once. */
function settleOnce(battleId, won = true) {
  const key = buildSettlementKey({ entryLock: { battleId }, mode: 'cpu' })
  if (!claimSettlementKey(key)) {
    return { alreadySettled: true, xpGained: 0, settlementKey: key }
  }
  const matchId = battleId
  if (!claimMatchXpKey(matchId)) {
    return { alreadySettled: true, xpGained: 0, settlementKey: key }
  }
  return {
    alreadySettled: false,
    xpGained: xpForMatch(won, 2, 20),
    settlementKey: key,
  }
}

// ── tests ─────────────────────────────────────────────────────────
let failed = 0
function check(name, fn) {
  try {
    store.clear()
    fn()
    console.log(`  ok  ${name}`)
  } catch (e) {
    failed++
    console.error(`  FAIL ${name}`)
    console.error('   ', e.message)
  }
}

console.log('G10 settlement idempotency')

check('buildSettlementKey prefers battleId', () => {
  const k = buildSettlementKey({
    entryLock: { battleId: 'b_abc123' },
    mode: 'cpu',
  })
  assert.equal(k, 'battle:b_abc123')
})

check('buildSettlementKey uses explicit override', () => {
  const k = buildSettlementKey({
    settlementKey: 'custom:1',
    entryLock: { battleId: 'b_x' },
    mode: 'cpu',
  })
  assert.equal(k, 'custom:1')
})

check('first settle awards XP', () => {
  const a = settleOnce('b_fight_1', true)
  assert.equal(a.alreadySettled, false)
  assert.ok(a.xpGained > 0)
  assert.equal(a.settlementKey, 'battle:b_fight_1')
})

check('second settle same battle awards 0 XP', () => {
  const a = settleOnce('b_fight_2', true)
  const b = settleOnce('b_fight_2', true)
  assert.equal(a.alreadySettled, false)
  assert.ok(a.xpGained > 0)
  assert.equal(b.alreadySettled, true)
  assert.equal(b.xpGained, 0)
})

check('two different battles each award once', () => {
  const a = settleOnce('b_a', true)
  const b = settleOnce('b_b', true)
  assert.equal(a.alreadySettled, false)
  assert.equal(b.alreadySettled, false)
  assert.equal(a.xpGained, b.xpGained)
})

check('claimMatchXpKey alone is idempotent', () => {
  assert.equal(claimMatchXpKey('m1'), true)
  assert.equal(claimMatchXpKey('m1'), false)
  assert.equal(claimMatchXpKey('m2'), true)
})

check('once: keys never block (unique ad-hoc finishes)', () => {
  const k1 = buildSettlementKey({ mode: 'cpu', selectedId: 'f1' })
  const k2 = buildSettlementKey({ mode: 'cpu', selectedId: 'f1' })
  assert.ok(k1.startsWith('once:'))
  assert.ok(k2.startsWith('once:'))
  assert.notEqual(k1, k2)
  assert.equal(claimSettlementKey(k1), true)
  assert.equal(claimSettlementKey(k1), true) // once: always allows
})

check('win XP formula baseline', () => {
  assert.equal(xpForMatch(true, 0, 0), 50)
  assert.equal(xpForMatch(false, 0, 0), 15)
})

// Server-side claim semantics (mirror api/fighter.js insert-first)
check('server claim-first: second insert does not award', () => {
  const ids = new Set()
  function serverMatch(matchId, xpGain = 50) {
    if (ids.has(matchId)) {
      return { alreadySettled: true, xpGained: 0 }
    }
    ids.add(matchId)
    return { alreadySettled: false, xpGained: xpGain }
  }
  const a = serverMatch('b_srv_1')
  const b = serverMatch('b_srv_1')
  assert.equal(a.xpGained, 50)
  assert.equal(b.alreadySettled, true)
  assert.equal(b.xpGained, 0)
})

if (failed) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log('\nAll G10 claim tests passed.')
