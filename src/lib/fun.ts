/**
 * Addictive meta: streaks, ranks, daily heat — local only (not a second credits pool).
 */

const STREAK_KEY = 'rf_fun_meta_v1'

export type FunMeta = {
  winStreak: number
  bestWinStreak: number
  totalKOs: number
  perfectRounds: number
  maxCombo: number
  rankPoints: number
  lastPlayDay: string
  dailyWins: number
  heat: number
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function empty(): FunMeta {
  return {
    winStreak: 0,
    bestWinStreak: 0,
    totalKOs: 0,
    perfectRounds: 0,
    maxCombo: 0,
    rankPoints: 1000,
    lastPlayDay: dayKey(),
    dailyWins: 0,
    heat: 0,
  }
}

export function loadFunMeta(): FunMeta {
  try {
    const raw = localStorage.getItem(STREAK_KEY)
    if (!raw) return empty()
    const j = { ...empty(), ...(JSON.parse(raw) as FunMeta) }
    if (j.lastPlayDay !== dayKey()) {
      j.dailyWins = 0
      j.heat = Math.max(0, Math.floor(j.heat * 0.4))
      j.lastPlayDay = dayKey()
    }
    return j
  } catch {
    return empty()
  }
}

function save(m: FunMeta): void {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(m))
  } catch {
    /* soft */
  }
}

export function recordFunMatch(opts: {
  won: boolean
  comboMax: number
  perfect?: boolean
}): FunMeta {
  const m = loadFunMeta()
  m.lastPlayDay = dayKey()
  m.maxCombo = Math.max(m.maxCombo, opts.comboMax || 0)
  if (opts.won) {
    m.winStreak += 1
    m.bestWinStreak = Math.max(m.bestWinStreak, m.winStreak)
    m.totalKOs += 1
    m.dailyWins += 1
    m.heat = Math.min(100, m.heat + 12 + Math.min(20, m.winStreak * 2))
    m.rankPoints += 18 + Math.min(40, m.winStreak * 4)
    if (opts.perfect) {
      m.perfectRounds += 1
      m.rankPoints += 10
      m.heat = Math.min(100, m.heat + 8)
    }
  } else {
    m.winStreak = 0
    m.heat = Math.max(0, m.heat - 15)
    m.rankPoints = Math.max(0, m.rankPoints - 12)
  }
  save(m)
  return m
}

export function rankTitle(points: number): string {
  if (points >= 1800) return 'Legend'
  if (points >= 1500) return 'Champion'
  if (points >= 1300) return 'Contender'
  if (points >= 1100) return 'Fighter'
  if (points >= 900) return 'Rookie'
  return 'Prospect'
}

export function streakFlavor(streak: number): string {
  if (streak >= 10) return 'UNSTOPPABLE'
  if (streak >= 7) return 'ON FIRE'
  if (streak >= 5) return 'HOT STREAK'
  if (streak >= 3) return 'HEATING UP'
  if (streak >= 2) return 'DOUBLE UP'
  return ''
}

/** Short KO / win lines for result screen (fun copy). */
export function fightWinLine(opts: {
  won: boolean
  streak: number
  combo: number
  category?: string
}): string {
  if (!opts.won) {
    if (opts.combo >= 4) return 'Lost the round — but that combo was fire. Rematch?'
    return 'Tough loss. Heat cools… one more fight builds it back.'
  }
  if (opts.combo >= 8) return 'INSANE COMBO KO — the crowd loses it!'
  if (opts.combo >= 5) return 'Beautiful chain — meter monster!'
  if (opts.streak >= 5) return `${streakFlavor(opts.streak) || 'STREAK'} — they fear your NFT!`
  if (opts.category === 'god') return 'Divine judgment delivered.'
  if (opts.category === 'human') return 'Special human grit wins the day.'
  return 'Clean win — bank the heat and go again!'
}

export function comboFlavor(combo: number): string {
  if (combo >= 10) return 'GOD COMBO'
  if (combo >= 7) return 'LEGENDARY'
  if (combo >= 5) return 'SICK COMBO'
  if (combo >= 3) return 'NICE COMBO'
  return ''
}
