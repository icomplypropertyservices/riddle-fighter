/**
 * Fighter NFT progress API — W/L, XP, traits, upgrade JSON for on-chain meta.
 * Soft-safe when DATABASE_URL missing (in-memory fallback on this instance).
 *
 * GET  /api/fighter?nftId=…
 * POST /api/fighter  { action: 'match' | 'settle' | 'upgrade' | 'sync' | 'schema', … }
 *
 * G10 single XP path:
 *  - action "match" → claim-first XP + W/L (only XP grant path)
 *  - action "settle" → wager ledger + meta only (never XP / W-L)
 */
import pg from 'pg'

const mem = new Map()

/** In-memory match claim set (G10). Keyed by matchId — first claim wins XP. */
function matchClaimSet() {
  if (!mem.has('__match_ids')) mem.set('__match_ids', new Set())
  return mem.get('__match_ids')
}

/**
 * Test helper: wipe in-memory progress + match claims.
 * Only for unit/assert scripts — not used in production handlers.
 */
export function _resetMemForTests() {
  mem.clear()
}

/**
 * Resolve stable match key for claim-first idempotency.
 * Prefers explicit matchId, then battleId (G10). Random only when neither set.
 */
export function resolveMatchId(body = {}) {
  const explicit = String(body.matchId || body.battleId || '').trim()
  if (explicit) return explicit
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Claim matchId first (atomic). Returns true only on first claim.
 * Neon: INSERT … ON CONFLICT DO NOTHING RETURNING id
 * Memory: Set.add semantics
 */
export async function claimMatchFirst(client, matchId, logRow) {
  const id = String(matchId || '').trim()
  if (!id) return false
  if (client) {
    const ins = await client.query(
      `INSERT INTO fighter_match_log
        (id, nft_id, owner_address, won, opponent, mode, xp_gained, combo, wager_credits, entry_credits, payout_credits, battle_id, opponent_nft_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        id,
        logRow.nftId,
        logRow.ownerAddress || null,
        Boolean(logRow.won),
        logRow.opponent || null,
        logRow.mode || 'cpu',
        Math.max(0, Math.floor(Number(logRow.xpGained) || 0)),
        logRow.combo ?? null,
        Math.max(0, Math.floor(Number(logRow.wagerCredits) || 0)),
        Math.max(0, Math.floor(Number(logRow.entryCredits) || 0)),
        Math.max(0, Math.floor(Number(logRow.payoutCredits) || 0)),
        logRow.battleId || null,
        logRow.opponentNftId || null,
      ],
    )
    return (ins.rowCount || 0) > 0
  }
  const ids = matchClaimSet()
  if (ids.has(id)) return false
  ids.add(id)
  return true
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('X-Riddle-Product', 'riddle-fighter')
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function dbUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ''
  ).trim()
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS fighter_nft_progress (
  nft_id TEXT PRIMARY KEY,
  owner_address TEXT,
  name TEXT,
  image TEXT,
  collection TEXT,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  traits_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  upgrade_level INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fighter_match_log (
  id TEXT PRIMARY KEY,
  nft_id TEXT NOT NULL,
  owner_address TEXT,
  won BOOLEAN NOT NULL,
  opponent TEXT,
  mode TEXT,
  xp_gained INT NOT NULL DEFAULT 0,
  combo INT,
  wager_credits INT DEFAULT 0,
  entry_credits INT DEFAULT 0,
  payout_credits INT DEFAULT 0,
  battle_id TEXT,
  opponent_nft_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fighter_wager_ledger (
  id TEXT PRIMARY KEY,
  battle_id TEXT,
  nft_id TEXT,
  owner_address TEXT,
  opponent TEXT,
  opponent_nft_id TEXT,
  mode TEXT,
  won BOOLEAN NOT NULL,
  stake_credits INT NOT NULL DEFAULT 0,
  entry_credits INT NOT NULL DEFAULT 0,
  pot_credits INT NOT NULL DEFAULT 0,
  platform_cut INT NOT NULL DEFAULT 0,
  payout_credits INT NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'wager',
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fighter_match_nft_idx ON fighter_match_log (nft_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fighter_progress_owner_idx ON fighter_nft_progress (owner_address);
CREATE INDEX IF NOT EXISTS fighter_wager_owner_idx ON fighter_wager_ledger (owner_address, created_at DESC);
CREATE INDEX IF NOT EXISTS fighter_wager_nft_idx ON fighter_wager_ledger (nft_id, created_at DESC);
`

function levelFromXp(xp) {
  const n = Math.max(0, Math.floor(Number(xp) || 0))
  return Math.max(1, Math.floor(n / 100) + 1)
}

function xpForMatch(won, combo = 0, wager = 0) {
  const c = Math.max(0, Math.floor(Number(combo) || 0))
  const w = Math.max(0, Math.floor(Number(wager) || 0))
  if (won) return 50 + c * 8 + Math.min(40, Math.floor(w / 5))
  return 15 + c * 3 + Math.min(15, Math.floor(w / 10))
}

function emptyProgress(nftId) {
  return {
    nftId,
    ownerAddress: null,
    name: null,
    image: null,
    collection: null,
    wins: 0,
    losses: 0,
    xp: 0,
    level: 1,
    traits: [],
    meta: {},
    upgradeLevel: 0,
    updatedAt: new Date().toISOString(),
    persisted: 'memory',
  }
}

function rowToProgress(row) {
  if (!row) return null
  const xp = Math.max(0, Number(row.xp) || 0)
  return {
    nftId: row.nft_id,
    ownerAddress: row.owner_address || null,
    name: row.name || null,
    image: row.image || null,
    collection: row.collection || null,
    wins: Math.max(0, Number(row.wins) || 0),
    losses: Math.max(0, Number(row.losses) || 0),
    xp,
    level: Math.max(1, Number(row.level) || levelFromXp(xp)),
    traits: Array.isArray(row.traits_json)
      ? row.traits_json
      : typeof row.traits_json === 'string'
        ? JSON.parse(row.traits_json || '[]')
        : row.traits_json || [],
    meta:
      row.meta_json && typeof row.meta_json === 'object'
        ? row.meta_json
        : typeof row.meta_json === 'string'
          ? JSON.parse(row.meta_json || '{}')
          : {},
    upgradeLevel: Math.max(0, Number(row.upgrade_level) || 0),
    updatedAt: row.updated_at
      ? new Date(row.updated_at).toISOString()
      : new Date().toISOString(),
    persisted: 'neon',
  }
}

/** Build on-chain-ready metadata JSON from progress + base traits. */
function buildUpgradeMetadata(progress, opts = {}) {
  const traits = Array.isArray(progress.traits) ? [...progress.traits] : []
  const byType = new Map()
  for (const t of traits) {
    const k = String(t.trait_type || t.trait || '').trim()
    if (k) byType.set(k.toLowerCase(), t)
  }
  const setTrait = (type, value) => {
    const key = type.toLowerCase()
    byType.set(key, { trait_type: type, value })
  }
  setTrait('Wins', progress.wins)
  setTrait('Losses', progress.losses)
  setTrait('XP', progress.xp)
  setTrait('Level', progress.level)
  setTrait('Upgrade Level', progress.upgradeLevel || 0)
  setTrait('Record', `${progress.wins}-${progress.losses}`)
  if (opts.statBoosts) {
    for (const [k, v] of Object.entries(opts.statBoosts)) {
      setTrait(k, v)
    }
  }
  const attributes = [...byType.values()]
  return {
    name: progress.name || `Fighter ${String(progress.nftId || '').slice(0, 8)}`,
    description:
      opts.description ||
      `Riddle Fighter · L${progress.level} · ${progress.wins}W-${progress.losses}L · ${progress.xp} XP`,
    image: progress.image || undefined,
    external_url: `https://fighter.riddlewallet.com/?view=${encodeURIComponent(progress.nftId)}`,
    attributes,
    properties: {
      category: 'fighter',
      riddle: {
        product: 'riddle-fighter',
        nftId: progress.nftId,
        wins: progress.wins,
        losses: progress.losses,
        xp: progress.xp,
        level: progress.level,
        upgradeLevel: progress.upgradeLevel || 0,
        updatedAt: progress.updatedAt,
      },
    },
  }
}

async function withDb(fn) {
  const url = dbUrl()
  if (!url) return fn(null)
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    await client.query(SCHEMA)
    return await fn(client)
  } finally {
    try {
      await client.end()
    } catch {
      /* soft */
    }
  }
}

async function getProgress(client, nftId) {
  const id = String(nftId || '').trim()
  if (!id) return null
  if (!client) {
    return mem.get(id) || emptyProgress(id)
  }
  const r = await client.query(`SELECT * FROM fighter_nft_progress WHERE nft_id = $1`, [id])
  if (!r.rows[0]) return emptyProgress(id)
  return rowToProgress(r.rows[0])
}

async function upsertProgress(client, p) {
  const level = levelFromXp(p.xp)
  const row = {
    ...p,
    level,
    updatedAt: new Date().toISOString(),
  }
  if (!client) {
    mem.set(p.nftId, { ...row, persisted: 'memory' })
    return mem.get(p.nftId)
  }
  await client.query(
    `INSERT INTO fighter_nft_progress
      (nft_id, owner_address, name, image, collection, wins, losses, xp, level, traits_json, meta_json, upgrade_level, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,NOW())
     ON CONFLICT (nft_id) DO UPDATE SET
       owner_address = COALESCE(EXCLUDED.owner_address, fighter_nft_progress.owner_address),
       name = COALESCE(EXCLUDED.name, fighter_nft_progress.name),
       image = COALESCE(EXCLUDED.image, fighter_nft_progress.image),
       collection = COALESCE(EXCLUDED.collection, fighter_nft_progress.collection),
       wins = EXCLUDED.wins,
       losses = EXCLUDED.losses,
       xp = EXCLUDED.xp,
       level = EXCLUDED.level,
       traits_json = EXCLUDED.traits_json,
       meta_json = EXCLUDED.meta_json,
       upgrade_level = EXCLUDED.upgrade_level,
       updated_at = NOW()`,
    [
      p.nftId,
      p.ownerAddress || null,
      p.name || null,
      p.image || null,
      p.collection || null,
      p.wins,
      p.losses,
      p.xp,
      level,
      JSON.stringify(p.traits || []),
      JSON.stringify(p.meta || {}),
      p.upgradeLevel || 0,
    ],
  )
  return getProgress(client, p.nftId)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    json(res, 204, {})
    return
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url || '/', 'http://local')
      const nftId = url.searchParams.get('nftId') || url.searchParams.get('id')
      const owner = url.searchParams.get('owner')
      if (!nftId && !owner) {
        json(res, 400, { ok: false, error: 'nftId or owner required' })
        return
      }
      const out = await withDb(async (client) => {
        if (nftId) {
          const progress = await getProgress(client, nftId)
          const meta = buildUpgradeMetadata(progress)
          return {
            ok: true,
            database: Boolean(client),
            progress,
            metadata: meta,
          }
        }
        // list by owner
        if (!client) {
          const list = [...mem.values()].filter(
            (p) =>
              p.ownerAddress &&
              p.ownerAddress.toLowerCase() === String(owner).toLowerCase(),
          )
          return { ok: true, database: false, list }
        }
        const r = await client.query(
          `SELECT * FROM fighter_nft_progress WHERE lower(owner_address) = lower($1) ORDER BY xp DESC LIMIT 100`,
          [owner],
        )
        return {
          ok: true,
          database: true,
          list: r.rows.map(rowToProgress),
        }
      })
      json(res, 200, out)
      return
    }

    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'GET or POST' })
      return
    }

    const body = await readBody(req)
    const action = String(body.action || 'match').toLowerCase()

    if (action === 'schema') {
      const out = await withDb(async (client) => {
        if (!client) return { ok: true, database: false, message: 'no DATABASE_URL' }
        await client.query(SCHEMA)
        return {
          ok: true,
          database: true,
          schema: 'fighter_nft_progress + fighter_match_log + fighter_wager_ledger',
        }
      })
      json(res, 200, out)
      return
    }

    if (action === 'sync') {
      const nftId = String(body.nftId || '').trim()
      if (!nftId) {
        json(res, 400, { ok: false, error: 'nftId required' })
        return
      }
      const out = await withDb(async (client) => {
        let p = await getProgress(client, nftId)
        p = {
          ...p,
          ownerAddress: body.ownerAddress || p.ownerAddress,
          name: body.name || p.name,
          image: body.image || p.image,
          collection: body.collection || p.collection,
          traits: Array.isArray(body.traits) ? body.traits : p.traits,
        }
        p = await upsertProgress(client, p)
        return { ok: true, progress: p, metadata: buildUpgradeMetadata(p) }
      })
      json(res, 200, out)
      return
    }

    if (action === 'match') {
      const nftId = String(body.nftId || '').trim()
      if (!nftId) {
        json(res, 400, { ok: false, error: 'nftId required' })
        return
      }
      const won = Boolean(body.won)
      const combo = Math.max(0, Math.floor(Number(body.combo) || 0))
      const wager = Math.max(0, Math.floor(Number(body.wagerCredits) || 0))
      const xpGain = xpForMatch(won, combo, wager)
      // G10: claim-first by stable matchId (matchId || battleId)
      const matchId = resolveMatchId(body)
      const battleId = body.battleId ? String(body.battleId).trim() : null
      const entryCr = Math.max(0, Math.floor(Number(body.entryCredits) || 0))
      const payoutCr = Math.max(0, Math.floor(Number(body.payoutCredits) || 0))

      const out = await withDb(async (client) => {
        // Neon: claim + award in one transaction so failed awards release the claim
        // (retry can succeed). Memory: claim-first Set (at-most-once).
        if (client) {
          await client.query('BEGIN')
          try {
            const claimed = await claimMatchFirst(client, matchId, {
              nftId,
              ownerAddress: body.ownerAddress || null,
              won,
              opponent: body.opponent || null,
              mode: body.mode || 'cpu',
              xpGained: xpGain,
              combo,
              wagerCredits: wager,
              entryCredits: entryCr,
              payoutCredits: payoutCr,
              battleId,
              opponentNftId: body.opponentNftId || null,
            })
            if (!claimed) {
              await client.query('COMMIT')
              const p = await getProgress(client, nftId)
              return {
                ok: true,
                alreadySettled: true,
                xpGained: 0,
                progress: p,
                metadata: buildUpgradeMetadata(p),
                matchId,
              }
            }

            let p = await getProgress(client, nftId)
            p = {
              ...p,
              ownerAddress: body.ownerAddress || p.ownerAddress,
              name: body.name || p.name,
              image: body.image || p.image,
              collection: body.collection || p.collection,
              traits:
                Array.isArray(body.traits) && body.traits.length ? body.traits : p.traits,
              wins: p.wins + (won ? 1 : 0),
              losses: p.losses + (won ? 0 : 1),
              xp: p.xp + xpGain,
            }
            p.level = levelFromXp(p.xp)
            p.meta = {
              ...(p.meta || {}),
              lastMatchAt: new Date().toISOString(),
              lastOpponent: body.opponent || null,
              lastMode: body.mode || null,
              lastCombo: combo,
              lastMatchId: matchId,
            }
            p = await upsertProgress(client, p)
            await client.query('COMMIT')
            return {
              ok: true,
              alreadySettled: false,
              xpGained: xpGain,
              progress: p,
              metadata: buildUpgradeMetadata(p),
              matchId,
            }
          } catch (err) {
            try {
              await client.query('ROLLBACK')
            } catch {
              /* soft */
            }
            throw err
          }
        }

        // Memory / no DATABASE_URL — claim matchId first, then award once
        const claimed = await claimMatchFirst(null, matchId, {
          nftId,
          ownerAddress: body.ownerAddress || null,
          won,
          opponent: body.opponent || null,
          mode: body.mode || 'cpu',
          xpGained: xpGain,
          combo,
          wagerCredits: wager,
          entryCredits: entryCr,
          payoutCredits: payoutCr,
          battleId,
          opponentNftId: body.opponentNftId || null,
        })
        if (!claimed) {
          const p = await getProgress(null, nftId)
          return {
            ok: true,
            alreadySettled: true,
            xpGained: 0,
            progress: p,
            metadata: buildUpgradeMetadata(p),
            matchId,
          }
        }

        let p = await getProgress(null, nftId)
        p = {
          ...p,
          ownerAddress: body.ownerAddress || p.ownerAddress,
          name: body.name || p.name,
          image: body.image || p.image,
          collection: body.collection || p.collection,
          traits: Array.isArray(body.traits) && body.traits.length ? body.traits : p.traits,
          wins: p.wins + (won ? 1 : 0),
          losses: p.losses + (won ? 0 : 1),
          xp: p.xp + xpGain,
        }
        p.level = levelFromXp(p.xp)
        p.meta = {
          ...(p.meta || {}),
          lastMatchAt: new Date().toISOString(),
          lastOpponent: body.opponent || null,
          lastMode: body.mode || null,
          lastCombo: combo,
          lastMatchId: matchId,
        }
        p = await upsertProgress(null, p)
        return {
          ok: true,
          alreadySettled: false,
          xpGained: xpGain,
          progress: p,
          metadata: buildUpgradeMetadata(p),
          matchId,
        }
      })
      json(res, 200, out)
      return
    }

    /** Log suite-credit wager/entry settlement (win or loss) for NFT + DB audit. */
    if (action === 'settle' || action === 'wager_settle') {
      const nftId = String(body.nftId || '').trim()
      if (!nftId) {
        json(res, 400, { ok: false, error: 'nftId required' })
        return
      }
      const won = Boolean(body.won)
      const stake = Math.max(0, Math.floor(Number(body.stakeCredits) || 0))
      const entry = Math.max(0, Math.floor(Number(body.entryCredits) || 0))
      const pot = Math.max(0, Math.floor(Number(body.potCredits) || stake * 2))
      const cut = Math.max(0, Math.floor(Number(body.platformCut) || 0))
      const payout = Math.max(0, Math.floor(Number(body.payoutCredits) || 0))
      const id =
        body.id ||
        `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      const row = {
        id,
        battleId: body.battleId || null,
        nftId,
        ownerAddress: body.ownerAddress || null,
        opponent: body.opponent || null,
        opponentNftId: body.opponentNftId || null,
        mode: body.mode || 'cpu',
        won,
        stakeCredits: stake,
        entryCredits: entry,
        potCredits: pot,
        platformCut: cut,
        payoutCredits: payout,
        kind: body.kind || (stake > 0 ? 'wager' : 'entry'),
        meta: body.meta || {},
        createdAt: new Date().toISOString(),
      }

      // Soft in-memory if no DB (de-dupe by id)
      if (!mem.has('__wagers')) mem.set('__wagers', [])
      const wlist = mem.get('__wagers')
      if (!wlist.some((w) => w && w.id === row.id)) {
        wlist.unshift(row)
        if (wlist.length > 200) wlist.length = 200
      }

      /**
       * G10: settle is ledger/audit only — never awards XP or bumps W/L.
       * Meta fields only; full upsertProgress would race with action=match
       * and could clobber a concurrent XP grant.
       */
      const out = await withDb(async (client) => {
        if (client) {
          await client.query(
            `INSERT INTO fighter_wager_ledger
              (id, battle_id, nft_id, owner_address, opponent, opponent_nft_id, mode, won,
               stake_credits, entry_credits, pot_credits, platform_cut, payout_credits, kind, meta_json)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
             ON CONFLICT (id) DO NOTHING`,
            [
              row.id,
              row.battleId,
              row.nftId,
              row.ownerAddress,
              row.opponent,
              row.opponentNftId,
              row.mode,
              row.won,
              row.stakeCredits,
              row.entryCredits,
              row.potCredits,
              row.platformCut,
              row.payoutCredits,
              row.kind,
              JSON.stringify(row.meta),
            ],
          )

          const cur = await client.query(
            `SELECT meta_json FROM fighter_nft_progress WHERE nft_id = $1`,
            [nftId],
          )
          const prevMeta =
            cur.rows[0]?.meta_json && typeof cur.rows[0].meta_json === 'object'
              ? cur.rows[0].meta_json
              : {}
          const metaPatch = {
            lastPayoutCredits: payout,
            lastStakeCredits: stake,
            lastEntryCredits: entry,
            lastSettleAt: row.createdAt,
            totalWagerWon:
              Math.max(0, Number(prevMeta.totalWagerWon) || 0) + (won ? payout : 0),
            totalWagerStaked:
              Math.max(0, Number(prevMeta.totalWagerStaked) || 0) + stake + entry,
          }
          // meta_json merge only — wins / losses / xp untouched
          await client.query(
            `INSERT INTO fighter_nft_progress (nft_id, meta_json, updated_at)
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (nft_id) DO UPDATE SET
               meta_json = COALESCE(fighter_nft_progress.meta_json, '{}'::jsonb) || $2::jsonb,
               updated_at = NOW()`,
            [nftId, JSON.stringify(metaPatch)],
          )
        } else {
          // Memory: patch meta in place — never rewrite wins/losses/xp
          const pMem = mem.get(nftId) || emptyProgress(nftId)
          pMem.meta = {
            ...(pMem.meta || {}),
            lastPayoutCredits: payout,
            lastStakeCredits: stake,
            lastEntryCredits: entry,
            lastSettleAt: row.createdAt,
            totalWagerWon:
              Math.max(0, Number((pMem.meta || {}).totalWagerWon) || 0) +
              (won ? payout : 0),
            totalWagerStaked:
              Math.max(0, Number((pMem.meta || {}).totalWagerStaked) || 0) +
              stake +
              entry,
          }
          mem.set(nftId, pMem)
        }

        const p = await getProgress(client, nftId)
        return {
          ok: true,
          database: Boolean(client),
          settle: row,
          // Progress counters unchanged by settle (XP path = action match only)
          progress: p,
          metadata: buildUpgradeMetadata(p),
        }
      })
      json(res, 200, out)
      return
    }

    if (action === 'upgrade') {
      const nftId = String(body.nftId || '').trim()
      if (!nftId) {
        json(res, 400, { ok: false, error: 'nftId required' })
        return
      }
      /** XP cost per upgrade rank */
      const cost = Math.max(50, Math.floor(Number(body.cost) || 100))
      const stat = String(body.stat || 'Power').trim() || 'Power'
      const out = await withDb(async (client) => {
        let p = await getProgress(client, nftId)
        if (p.xp < cost) {
          return {
            ok: false,
            error: `Need ${cost} XP · have ${p.xp}`,
            progress: p,
          }
        }
        p.xp -= cost
        p.upgradeLevel = (p.upgradeLevel || 0) + 1
        p.level = levelFromXp(p.xp)

        // Bump or add upgrade trait
        const traits = Array.isArray(p.traits) ? [...p.traits] : []
        const key = stat.toLowerCase()
        let found = false
        for (const t of traits) {
          const tt = String(t.trait_type || t.trait || '').toLowerCase()
          if (tt === key || tt === `upgraded ${key}`) {
            const n = Number(t.value)
            t.value = Number.isFinite(n) ? n + 1 : `${t.value}+1`
            found = true
            break
          }
        }
        if (!found) {
          traits.push({ trait_type: `Upgraded ${stat}`, value: 1 })
        }
        traits.push({
          trait_type: 'Last Upgrade',
          value: new Date().toISOString().slice(0, 10),
        })
        p.traits = traits
        p.meta = {
          ...(p.meta || {}),
          lastUpgradeAt: new Date().toISOString(),
          lastUpgradeStat: stat,
          lastUpgradeCost: cost,
        }
        p = await upsertProgress(client, p)
        const metadata = buildUpgradeMetadata(p, {
          description: `Riddle Fighter upgraded · L${p.level} · UL${p.upgradeLevel} · ${p.wins}W-${p.losses}L`,
        })
        return {
          ok: true,
          progress: p,
          metadata,
          /** Ready to pin / push as on-chain URI body */
          upgradeJson: metadata,
          cost,
        }
      })
      json(res, out.ok ? 200 : 400, out)
      return
    }

    json(res, 400, {
      ok: false,
      error: 'Unknown action',
      actions: ['match', 'upgrade', 'sync', 'schema'],
    })
  } catch (e) {
    json(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
