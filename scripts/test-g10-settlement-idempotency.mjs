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

// ── Live handler: /api/fighter action:match claim-first by matchId ──
// Force memory backend (no Neon) so tests stay offline + deterministic.
for (const k of ['DATABASE_URL', 'NEON_DATABASE_URL', 'POSTGRES_URL']) {
  delete process.env[k]
}

const fighterApi = await import(pathToFileURL(path.join(root, 'api', 'fighter.js')).href)
const handler = fighterApi.default
const { resolveMatchId, claimMatchFirst, _resetMemForTests } = fighterApi

function makeReq(body) {
  const payload = Buffer.from(JSON.stringify(body || {}))
  return {
    method: 'POST',
    url: '/api/fighter',
    async *[Symbol.asyncIterator]() {
      yield payload
    },
  }
}

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) {
      this.headers[k] = v
    },
    end(s) {
      this.body = typeof s === 'string' ? s : String(s ?? '')
    },
  }
}

async function postMatch(body) {
  const req = makeReq(body)
  const res = makeRes()
  await handler(req, res)
  assert.equal(res.statusCode, 200, `expected 200 got ${res.statusCode}: ${res.body}`)
  return JSON.parse(res.body)
}

async function checkAsync(name, fn) {
  try {
    _resetMemForTests()
    await fn()
    console.log(`  ok  ${name}`)
  } catch (e) {
    failed++
    console.error(`  FAIL ${name}`)
    console.error('   ', e.message)
  }
}

console.log('\nG10 /api/fighter action:match (real handler, memory)')

await checkAsync('resolveMatchId prefers matchId over battleId', () => {
  assert.equal(resolveMatchId({ matchId: 'm1', battleId: 'b1' }), 'm1')
  assert.equal(resolveMatchId({ battleId: 'b_only' }), 'b_only')
  assert.ok(resolveMatchId({}).startsWith('m_'))
})

await checkAsync('claimMatchFirst memory is idempotent', async () => {
  const row = { nftId: 'n1', won: true, xpGained: 50 }
  assert.equal(await claimMatchFirst(null, 'claim_a', row), true)
  assert.equal(await claimMatchFirst(null, 'claim_a', row), false)
  assert.equal(await claimMatchFirst(null, 'claim_b', row), true)
})

await checkAsync('POST match awards XP once; second same matchId is 0', async () => {
  const nftId = 'nft_idem_1'
  const matchId = 'battle_g10_once'
  const base = {
    action: 'match',
    nftId,
    matchId,
    battleId: matchId,
    won: true,
    combo: 0,
    wagerCredits: 0,
    mode: 'cpu',
  }
  const a = await postMatch(base)
  assert.equal(a.ok, true)
  assert.equal(a.alreadySettled, false)
  assert.equal(a.xpGained, 50)
  assert.equal(a.progress.xp, 50)
  assert.equal(a.progress.wins, 1)
  assert.equal(a.matchId, matchId)

  const b = await postMatch({ ...base, won: false, combo: 9 }) // different payload, same matchId
  assert.equal(b.ok, true)
  assert.equal(b.alreadySettled, true)
  assert.equal(b.xpGained, 0)
  assert.equal(b.progress.xp, 50, 'XP must not double on replay')
  assert.equal(b.progress.wins, 1, 'W-L must not bump on replay')
  assert.equal(b.progress.losses, 0)
})

await checkAsync('two different matchIds each award once', async () => {
  const nftId = 'nft_idem_2'
  const a = await postMatch({
    action: 'match',
    nftId,
    matchId: 'm_diff_1',
    won: true,
  })
  const b = await postMatch({
    action: 'match',
    nftId,
    matchId: 'm_diff_2',
    won: true,
  })
  assert.equal(a.xpGained, 50)
  assert.equal(b.xpGained, 50)
  assert.equal(b.progress.xp, 100)
  assert.equal(b.progress.wins, 2)
})

await checkAsync('battleId alone is enough for claim key', async () => {
  const nftId = 'nft_idem_3'
  const battleId = 'b_only_key'
  const a = await postMatch({ action: 'match', nftId, battleId, won: false })
  const b = await postMatch({ action: 'match', nftId, battleId, won: true })
  assert.equal(a.alreadySettled, false)
  assert.equal(a.xpGained, 15)
  assert.equal(b.alreadySettled, true)
  assert.equal(b.xpGained, 0)
  assert.equal(b.progress.xp, 15)
  assert.equal(b.progress.losses, 1)
})

if (failed) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log('\nAll G10 claim tests passed.')
