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
// Mirror production contracts from matchSettlement.ts + fighterProgress.ts
// (makeMatchId / in-module consume set / local XP claim keys).

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

/** Mirrors matchSettlement.makeMatchId */
function makeMatchId(input) {
  if (input.matchId && String(input.matchId).trim()) return String(input.matchId).trim()
  if (input.entryLock?.battleId) return `m_${input.entryLock.battleId}`
  const sel = (input.selectedId || 'nof').slice(0, 12)
  const mode = input.mode || 'cpu'
  const opp = String(input.opponentName || 'opp')
    .replace(/\s+/g, '_')
    .slice(0, 16)
  return `m_${mode}_${sel}_${opp}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** Mirrors matchSettlement consumedSettlementKeys markConsumed */
const consumedSettlementKeys = new Set()
const CONSUMED_CAP = 80
function markConsumed(key) {
  const k = String(key || '').trim()
  if (!k) return false
  if (consumedSettlementKeys.has(k)) return true
  consumedSettlementKeys.add(k)
  if (consumedSettlementKeys.size > CONSUMED_CAP) {
    const first = consumedSettlementKeys.values().next().value
    if (first) consumedSettlementKeys.delete(first)
  }
  return false
}
function clearSettlementConsumeGuard() {
  consumedSettlementKeys.clear()
}

function xpForMatch(won, combo = 0, wager = 0) {
  const c = Math.max(0, Math.floor(combo))
  const w = Math.max(0, Math.floor(wager))
  if (won) return 50 + c * 8 + Math.min(40, Math.floor(w / 5))
  return 15 + c * 3 + Math.min(15, Math.floor(w / 10))
}

/**
 * Simulate settleMatch double-submit: session consume + XP claim once.
 * Production also claims via /api/fighter action:match (tested below).
 */
function settleOnce(battleId, won = true) {
  const matchId = makeMatchId({ entryLock: { battleId }, mode: 'cpu' })
  if (markConsumed(matchId)) {
    return { alreadySettled: true, xpGained: 0, matchId }
  }
  // XP key = same stable matchId (recordMatchProgress matchId || battleId)
  if (!claimMatchXpKey(matchId)) {
    return { alreadySettled: true, xpGained: 0, matchId }
  }
  return {
    alreadySettled: false,
    xpGained: xpForMatch(won, 2, 20),
    matchId,
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

check('makeMatchId prefers explicit matchId', () => {
  const k = makeMatchId({
    matchId: 'custom:1',
    entryLock: { battleId: 'b_x' },
    mode: 'cpu',
  })
  assert.equal(k, 'custom:1')
})

check('makeMatchId derives m_${battleId} from entryLock', () => {
  const k = makeMatchId({
    entryLock: { battleId: 'b_abc123' },
    mode: 'cpu',
  })
  assert.equal(k, 'm_b_abc123')
})

check('first settle awards XP', () => {
  clearSettlementConsumeGuard()
  const a = settleOnce('b_fight_1', true)
  assert.equal(a.alreadySettled, false)
  assert.ok(a.xpGained > 0)
  assert.equal(a.matchId, 'm_b_fight_1')
})

check('second settle same battle awards 0 XP', () => {
  clearSettlementConsumeGuard()
  store.clear()
  const a = settleOnce('b_fight_2', true)
  const b = settleOnce('b_fight_2', true)
  assert.equal(a.alreadySettled, false)
  assert.ok(a.xpGained > 0)
  assert.equal(b.alreadySettled, true)
  assert.equal(b.xpGained, 0)
  assert.equal(a.matchId, b.matchId)
  assert.equal(a.matchId, 'm_b_fight_2')
})

check('two different battles each award once', () => {
  clearSettlementConsumeGuard()
  store.clear()
  const a = settleOnce('b_a', true)
  const b = settleOnce('b_b', true)
  assert.equal(a.alreadySettled, false)
  assert.equal(b.alreadySettled, false)
  assert.equal(a.xpGained, b.xpGained)
  assert.notEqual(a.matchId, b.matchId)
})

check('claimMatchXpKey alone is idempotent', () => {
  assert.equal(claimMatchXpKey('m1'), true)
  assert.equal(claimMatchXpKey('m1'), false)
  assert.equal(claimMatchXpKey('m2'), true)
})

check('markConsumed session guard is idempotent', () => {
  clearSettlementConsumeGuard()
  assert.equal(markConsumed('m_sess_1'), false) // first = not already
  assert.equal(markConsumed('m_sess_1'), true) // second = already
  assert.equal(markConsumed('m_sess_2'), false)
})

check('ad-hoc finishes without battleId get unique matchIds', () => {
  const k1 = makeMatchId({ mode: 'cpu', selectedId: 'f1', opponentName: 'Bot' })
  const k2 = makeMatchId({ mode: 'cpu', selectedId: 'f1', opponentName: 'Bot' })
  assert.ok(k1.startsWith('m_cpu_'))
  assert.ok(k2.startsWith('m_cpu_'))
  assert.notEqual(k1, k2)
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

check('double-submit path: consume guard alone blocks XP even if claim cleared', () => {
  clearSettlementConsumeGuard()
  store.clear()
  const battleId = 'b_consume_only'
  const a = settleOnce(battleId, true)
  // Wipe local XP claims but keep session consume set (tab still open)
  store.clear()
  const b = settleOnce(battleId, true)
  assert.equal(a.alreadySettled, false)
  assert.ok(a.xpGained > 0)
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

await checkAsync('triple replay same matchId never double-awards XP or W-L', async () => {
  const nftId = 'nft_idem_triple'
  const matchId = 'battle_g10_triple'
  const base = {
    action: 'match',
    nftId,
    matchId,
    battleId: matchId,
    won: true,
    combo: 2,
    wagerCredits: 0,
    mode: 'cpu',
  }
  const a = await postMatch(base)
  const b = await postMatch(base)
  const c = await postMatch({ ...base, won: false, combo: 99 })
  assert.equal(a.alreadySettled, false)
  assert.ok(a.xpGained > 0)
  assert.equal(b.alreadySettled, true)
  assert.equal(b.xpGained, 0)
  assert.equal(c.alreadySettled, true)
  assert.equal(c.xpGained, 0)
  assert.equal(c.progress.xp, a.progress.xp)
  assert.equal(c.progress.wins, 1)
  assert.equal(c.progress.losses, 0)
})

await checkAsync('rapid sequential posts: only first claim awards', async () => {
  const nftId = 'nft_idem_rapid'
  const matchId = 'battle_g10_rapid'
  const body = { action: 'match', nftId, matchId, won: true }
  // Sequential await (Node single-thread mirrors serverless multi-invoke)
  const results = []
  for (let i = 0; i < 5; i++) results.push(await postMatch(body))
  const awarded = results.filter((r) => !r.alreadySettled)
  const blocked = results.filter((r) => r.alreadySettled)
  assert.equal(awarded.length, 1)
  assert.equal(blocked.length, 4)
  assert.equal(results[4].progress.xp, awarded[0].xpGained)
  assert.equal(results[4].progress.wins, 1)
})

await checkAsync('matchId preferred: battleId collision does not double when matchId set', async () => {
  const nftId = 'nft_idem_pref'
  const a = await postMatch({
    action: 'match',
    nftId,
    matchId: 'm_stable_1',
    battleId: 'b_other',
    won: true,
  })
  const b = await postMatch({
    action: 'match',
    nftId,
    matchId: 'm_stable_1',
    battleId: 'b_other_changed',
    won: false,
  })
  assert.equal(a.xpGained, 50)
  assert.equal(b.alreadySettled, true)
  assert.equal(b.xpGained, 0)
  assert.equal(b.progress.xp, 50)
})

console.log('\nG10 /api/fighter action:settle (ledger only, no XP)')

await checkAsync('settle does not award XP or bump W-L', async () => {
  const nftId = 'nft_settle_no_xp'
  const settled = await postMatch({
    action: 'settle',
    id: 'ws_settle_1',
    nftId,
    won: true,
    stakeCredits: 20,
    entryCredits: 10,
    potCredits: 40,
    payoutCredits: 36,
    kind: 'mixed',
    mode: 'cpu',
  })
  assert.equal(settled.ok, true)
  assert.equal(settled.progress.xp, 0, 'settle must not grant XP')
  assert.equal(settled.progress.wins, 0, 'settle must not bump wins')
  assert.equal(settled.progress.losses, 0, 'settle must not bump losses')
  assert.ok(settled.settle)
  assert.equal(settled.settle.id, 'ws_settle_1')
})

await checkAsync('settle after match does not clobber XP', async () => {
  const nftId = 'nft_settle_after'
  const matchId = 'm_then_settle'
  const matched = await postMatch({
    action: 'match',
    nftId,
    matchId,
    won: true,
    combo: 0,
    wagerCredits: 0,
  })
  assert.equal(matched.xpGained, 50)
  assert.equal(matched.progress.xp, 50)
  assert.equal(matched.progress.wins, 1)

  const settled = await postMatch({
    action: 'settle',
    id: `ws_${matchId}`,
    nftId,
    battleId: matchId,
    won: true,
    stakeCredits: 10,
    entryCredits: 5,
    payoutCredits: 18,
    kind: 'mixed',
  })
  assert.equal(settled.ok, true)
  assert.equal(settled.progress.xp, 50, 'settle must not wipe match XP')
  assert.equal(settled.progress.wins, 1, 'settle must not wipe wins')
  assert.equal(
    settled.progress.meta?.lastPayoutCredits,
    18,
    'settle may patch wager meta only',
  )
})

await checkAsync('settle then match still awards XP once', async () => {
  const nftId = 'nft_settle_then_match'
  const matchId = 'm_settle_first'
  await postMatch({
    action: 'settle',
    id: `ws_${matchId}`,
    nftId,
    won: true,
    stakeCredits: 5,
    payoutCredits: 9,
  })
  const matched = await postMatch({
    action: 'match',
    nftId,
    matchId,
    won: true,
  })
  assert.equal(matched.alreadySettled, false)
  assert.equal(matched.xpGained, 50)
  assert.equal(matched.progress.xp, 50)
  assert.equal(matched.progress.wins, 1)
})

if (failed) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log('\nAll G10 claim tests passed.')
