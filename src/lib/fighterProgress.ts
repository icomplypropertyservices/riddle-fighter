/**
 * Per-NFT fighter progress: W/L · XP · Level · traits · upgrade JSON.
 * Dual-write: localStorage + /api/fighter (Neon when DATABASE_URL set).
 */

export type FighterTrait = {
  trait_type?: string
  trait?: string
  value?: unknown
}

export type FighterProgress = {
  nftId: string
  ownerAddress?: string | null
  name?: string | null
  image?: string | null
  collection?: string | null
  wins: number
  losses: number
  xp: number
  level: number
  traits: FighterTrait[]
  meta?: Record<string, unknown>
  upgradeLevel: number
  updatedAt: string
  persisted?: string
}

export type FighterMetadataJson = {
  name: string
  description?: string
  image?: string
  external_url?: string
  attributes: Array<{ trait_type: string; value: unknown }>
  properties?: Record<string, unknown>
}

const LS_KEY = 'rf_fighter_progress_v1'
/** G10: match keys that already granted XP (battleId / matchId). Caps replay farming. */
const LS_MATCH_CLAIM_KEY = 'rf_match_xp_claimed_v1'
const MATCH_CLAIM_CAP = 200

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function loadClaimedMatchKeys(): string[] {
  if (!isBrowser()) return []
  try {
    const raw = localStorage.getItem(LS_MATCH_CLAIM_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as string[]
    return Array.isArray(j) ? j.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

function saveClaimedMatchKeys(keys: string[]): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(
      LS_MATCH_CLAIM_KEY,
      JSON.stringify(keys.slice(0, MATCH_CLAIM_CAP)),
    )
  } catch {
    /* soft */
  }
}

/**
 * Claim a match key for XP grant. Returns true if this is the first claim
 * (caller should award XP). Returns false if already claimed (G10 idempotency).
 * Empty keys always return true (no dedupe available).
 */
export function claimMatchXpKey(matchKey: string): boolean {
  const key = String(matchKey || '').trim()
  if (!key) return true
  if (!isBrowser()) return true
  const prev = loadClaimedMatchKeys()
  if (prev.includes(key)) return false
  saveClaimedMatchKeys([key, ...prev.filter((k) => k !== key)])
  return true
}

/** True when this match key already granted XP locally. */
export function wasMatchXpClaimed(matchKey: string): boolean {
  const key = String(matchKey || '').trim()
  if (!key) return false
  return loadClaimedMatchKeys().includes(key)
}

function apiBase(): string {
  if (typeof window === 'undefined') return ''
  return ''
}

function loadLocalMap(): Record<string, FighterProgress> {
  if (!isBrowser()) return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as Record<string, FighterProgress>
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

function saveLocalMap(m: Record<string, FighterProgress>): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(m))
  } catch {
    /* soft */
  }
}

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.max(0, xp) / 100) + 1)
}

export function xpForMatch(won: boolean, combo = 0, wager = 0): number {
  const c = Math.max(0, Math.floor(combo))
  const w = Math.max(0, Math.floor(wager))
  if (won) return 50 + c * 8 + Math.min(40, Math.floor(w / 5))
  return 15 + c * 3 + Math.min(15, Math.floor(w / 10))
}

export function emptyProgress(nftId: string): FighterProgress {
  return {
    nftId,
    wins: 0,
    losses: 0,
    xp: 0,
    level: 1,
    traits: [],
    upgradeLevel: 0,
    updatedAt: new Date().toISOString(),
    persisted: 'local',
  }
}

export function loadLocalProgress(nftId: string): FighterProgress {
  const id = String(nftId || '').trim()
  if (!id) return emptyProgress('')
  const m = loadLocalMap()
  const p = m[id] || m[`nft-${id}`]
  if (!p) return emptyProgress(id)
  return {
    ...emptyProgress(id),
    ...p,
    wins: Math.max(0, Math.floor(Number(p.wins) || 0)),
    losses: Math.max(0, Math.floor(Number(p.losses) || 0)),
    xp: Math.max(0, Math.floor(Number(p.xp) || 0)),
    level: Math.max(1, Math.floor(Number(p.level) || levelFromXp(p.xp))),
    traits: Array.isArray(p.traits) ? p.traits : [],
    upgradeLevel: Math.max(0, Math.floor(Number(p.upgradeLevel) || 0)),
  }
}

function writeLocal(p: FighterProgress): void {
  const m = loadLocalMap()
  m[p.nftId] = { ...p, updatedAt: new Date().toISOString() }
  saveLocalMap(m)
  try {
    window.dispatchEvent(
      new CustomEvent('riddle-fighter-progress', { detail: p }),
    )
  } catch {
    /* soft */
  }
}

/** Merge all NFT traits into progress (every trait preserved). */
export function mergeTraits(
  existing: FighterTrait[],
  incoming?: FighterTrait[] | null,
): FighterTrait[] {
  const map = new Map<string, FighterTrait>()
  for (const t of existing || []) {
    const k = String(t.trait_type || t.trait || '')
      .trim()
      .toLowerCase()
    if (k) map.set(k, t)
  }
  for (const t of incoming || []) {
    const k = String(t.trait_type || t.trait || '')
      .trim()
      .toLowerCase()
    if (k) map.set(k, t)
  }
  return [...map.values()]
}

export async function fetchProgress(
  nftId: string,
): Promise<{ progress: FighterProgress; metadata?: FighterMetadataJson } | null> {
  const id = String(nftId || '').trim()
  if (!id) return null
  const local = loadLocalProgress(id)
  try {
    const res = await fetch(
      `${apiBase()}/api/fighter?nftId=${encodeURIComponent(id)}`,
      { credentials: 'omit' },
    )
    if (!res.ok) return { progress: local }
    const data = (await res.json()) as {
      ok?: boolean
      progress?: FighterProgress
      metadata?: FighterMetadataJson
    }
    if (!data?.ok || !data.progress) return { progress: local }
    // Prefer higher XP / more fights between local and server
    const remote = data.progress
    const pick =
      remote.xp + remote.wins + remote.losses >= local.xp + local.wins + local.losses
        ? remote
        : local
    const merged = {
      ...pick,
      traits: mergeTraits(local.traits, remote.traits),
    }
    writeLocal(merged)
    return { progress: merged, metadata: data.metadata }
  } catch {
    return { progress: local }
  }
}

export async function syncFighterToDb(opts: {
  nftId: string
  ownerAddress?: string
  name?: string
  image?: string
  collection?: string
  traits?: FighterTrait[]
}): Promise<FighterProgress> {
  const id = String(opts.nftId || '').trim()
  let p = loadLocalProgress(id)
  p = {
    ...p,
    ownerAddress: opts.ownerAddress || p.ownerAddress,
    name: opts.name || p.name,
    image: opts.image || p.image,
    collection: opts.collection || p.collection,
    traits: mergeTraits(p.traits, opts.traits),
  }
  writeLocal(p)
  try {
    const res = await fetch(`${apiBase()}/api/fighter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync',
        nftId: id,
        ownerAddress: p.ownerAddress,
        name: p.name,
        image: p.image,
        collection: p.collection,
        traits: p.traits,
      }),
    })
    if (res.ok) {
      const data = (await res.json()) as { progress?: FighterProgress }
      if (data.progress) {
        writeLocal(data.progress)
        return data.progress
      }
    }
  } catch {
    /* soft */
  }
  return p
}

export async function recordMatchProgress(opts: {
  nftId: string
  ownerAddress?: string
  name?: string
  image?: string
  collection?: string
  traits?: FighterTrait[]
  won: boolean
  opponent?: string
  mode?: string
  combo?: number
  wagerCredits?: number
  /**
   * Stable match id (prefer battleId). Used for G10 local + API idempotency —
   * same key never grants XP twice.
   */
  matchId?: string
  battleId?: string
  entryCredits?: number
  payoutCredits?: number
  opponentNftId?: string
}): Promise<{
  progress: FighterProgress
  xpGained: number
  metadata?: FighterMetadataJson
  alreadySettled?: boolean
  matchId?: string
}> {
  const id = String(opts.nftId || '').trim()
  const matchId = String(opts.matchId || opts.battleId || '').trim()
  const xpGain = xpForMatch(opts.won, opts.combo, opts.wagerCredits)

  // G10: local short-circuit — already claimed this match → no XP / W-L bump
  if (matchId && wasMatchXpClaimed(matchId)) {
    const existing = loadLocalProgress(id)
    return {
      progress: existing,
      xpGained: 0,
      alreadySettled: true,
      matchId,
      metadata: buildLocalMetadata(existing),
    }
  }

  const localBase = loadLocalProgress(id)
  const payloadBase = {
    action: 'match' as const,
    nftId: id,
    ownerAddress: opts.ownerAddress || localBase.ownerAddress,
    name: opts.name || localBase.name,
    image: opts.image || localBase.image,
    collection: opts.collection || localBase.collection,
    traits: mergeTraits(localBase.traits, opts.traits),
    won: opts.won,
    opponent: opts.opponent,
    mode: opts.mode || 'cpu',
    combo: opts.combo || 0,
    wagerCredits: opts.wagerCredits || 0,
    // Prefer stable match log PK (API claim-first ON CONFLICT)
    matchId: matchId || undefined,
    battleId: opts.battleId || matchId || undefined,
    entryCredits: opts.entryCredits || 0,
    payoutCredits: opts.payoutCredits || 0,
    opponentNftId: opts.opponentNftId || null,
  }

  // G10 server-first: claim on /api/fighter (Neon insert-first / memory Set).
  // Avoid awarding local XP before the API responds — prevents inflated local
  // totals when the server already settled (replay / multi-tab / multi-device).
  try {
    const res = await fetch(`${apiBase()}/api/fighter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadBase),
    })
    if (res.ok) {
      const data = (await res.json()) as {
        ok?: boolean
        progress?: FighterProgress
        xpGained?: number
        metadata?: FighterMetadataJson
        alreadySettled?: boolean
        matchId?: string
      }
      if (data.progress) {
        // Seal local claim key after authoritative server response
        if (matchId) claimMatchXpKey(matchId)
        if (data.alreadySettled) {
          const local = loadLocalProgress(id)
          writeLocal({
            ...data.progress,
            traits: mergeTraits(local.traits, data.progress.traits),
          })
          return {
            progress: loadLocalProgress(id),
            xpGained: 0,
            alreadySettled: true,
            matchId: data.matchId || matchId,
            metadata: data.metadata,
          }
        }
        writeLocal(data.progress)
        return {
          progress: data.progress,
          xpGained: data.xpGained ?? xpGain,
          alreadySettled: false,
          matchId: data.matchId || matchId,
          metadata: data.metadata,
        }
      }
    }
  } catch {
    /* soft — fall through to offline local award */
  }

  // Offline / soft fail: claim locally then award at most once
  if (matchId && !claimMatchXpKey(matchId)) {
    const existing = loadLocalProgress(id)
    return {
      progress: existing,
      xpGained: 0,
      alreadySettled: true,
      matchId,
      metadata: buildLocalMetadata(existing),
    }
  }

  let p: FighterProgress = {
    ...localBase,
    ownerAddress: opts.ownerAddress || localBase.ownerAddress,
    name: opts.name || localBase.name,
    image: opts.image || localBase.image,
    collection: opts.collection || localBase.collection,
    traits: mergeTraits(localBase.traits, opts.traits),
    wins: localBase.wins + (opts.won ? 1 : 0),
    losses: localBase.losses + (opts.won ? 0 : 1),
    xp: localBase.xp + xpGain,
  }
  p.level = levelFromXp(p.xp)
  writeLocal(p)

  return {
    progress: p,
    xpGained: xpGain,
    alreadySettled: false,
    matchId: matchId || undefined,
    metadata: buildLocalMetadata(p),
  }
}

export async function upgradeFighterWithXp(opts: {
  nftId: string
  stat?: string
  cost?: number
}): Promise<{
  ok: boolean
  error?: string
  progress: FighterProgress
  upgradeJson?: FighterMetadataJson
  cost?: number
}> {
  const id = String(opts.nftId || '').trim()
  const cost = Math.max(50, Math.floor(Number(opts.cost) || 100))
  const stat = opts.stat || 'Power'
  let p = loadLocalProgress(id)
  if (p.xp < cost) {
    return { ok: false, error: `Need ${cost} XP · have ${p.xp}`, progress: p }
  }

  try {
    const res = await fetch(`${apiBase()}/api/fighter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upgrade',
        nftId: id,
        stat,
        cost,
      }),
    })
    const data = (await res.json()) as {
      ok?: boolean
      error?: string
      progress?: FighterProgress
      upgradeJson?: FighterMetadataJson
      cost?: number
    }
    if (data.progress) writeLocal(data.progress)
    if (!data.ok) {
      return {
        ok: false,
        error: data.error || 'Upgrade failed',
        progress: data.progress || p,
      }
    }
    return {
      ok: true,
      progress: data.progress || p,
      upgradeJson: data.upgradeJson,
      cost: data.cost ?? cost,
    }
  } catch {
    // Local-only upgrade fallback
    p.xp -= cost
    p.upgradeLevel = (p.upgradeLevel || 0) + 1
    p.level = levelFromXp(p.xp)
    p.traits = mergeTraits(p.traits, [
      { trait_type: `Upgraded ${stat}`, value: 1 },
      { trait_type: 'Last Upgrade', value: new Date().toISOString().slice(0, 10) },
    ])
    writeLocal(p)
    return {
      ok: true,
      progress: p,
      upgradeJson: buildLocalMetadata(p),
      cost,
    }
  }
}

export function buildLocalMetadata(p: FighterProgress): FighterMetadataJson {
  const byType = new Map<string, { trait_type: string; value: unknown }>()
  for (const t of p.traits || []) {
    const type = String(t.trait_type || t.trait || '').trim()
    if (!type) continue
    byType.set(type.toLowerCase(), { trait_type: type, value: t.value })
  }
  const set = (type: string, value: unknown) => {
    byType.set(type.toLowerCase(), { trait_type: type, value })
  }
  set('Wins', p.wins)
  set('Losses', p.losses)
  set('XP', p.xp)
  set('Level', p.level)
  set('Upgrade Level', p.upgradeLevel || 0)
  set('Record', `${p.wins}-${p.losses}`)
  return {
    name: p.name || `Fighter ${p.nftId.slice(0, 8)}`,
    description: `Riddle Fighter · L${p.level} · ${p.wins}W-${p.losses}L · ${p.xp} XP`,
    image: p.image || undefined,
    external_url: `https://fighter.riddlewallet.com/?view=${encodeURIComponent(p.nftId)}`,
    attributes: [...byType.values()],
    properties: {
      category: 'fighter',
      riddle: {
        product: 'riddle-fighter',
        nftId: p.nftId,
        wins: p.wins,
        losses: p.losses,
        xp: p.xp,
        level: p.level,
        upgradeLevel: p.upgradeLevel,
        updatedAt: p.updatedAt,
      },
    },
  }
}

/** Download upgrade JSON for pinning / on-chain URI update. */
export function downloadUpgradeJson(
  meta: FighterMetadataJson,
  filename?: string,
): void {
  if (!isBrowser()) return
  const blob = new Blob([JSON.stringify(meta, null, 2)], {
    type: 'application/json',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || `fighter-upgrade-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
