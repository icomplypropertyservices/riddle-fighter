/**
 * Lightweight Fight Pilot prefs for Riddle Fighter (local).
 * Vs human (online / offer): both players must agree before AI pilots.
 */

const KEY = 'rf_agent_pilot_v1'

export type RfPilotState = {
  enabled: boolean
  mode: 'off' | 'assist' | 'full'
  requireMutualConsentVsHuman: boolean
  /** matchKey → bothAgreed */
  consents: Record<string, { local: boolean; remote: boolean; at: number }>
}

function empty(): RfPilotState {
  return {
    enabled: false,
    mode: 'assist',
    requireMutualConsentVsHuman: true,
    consents: {},
  }
}

export function loadRfPilot(): RfPilotState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    return { ...empty(), ...(JSON.parse(raw) as RfPilotState) }
  } catch {
    return empty()
  }
}

export function saveRfPilot(s: RfPilotState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* soft */
  }
}

export function setRfPilotEnabled(on: boolean): RfPilotState {
  const s = loadRfPilot()
  s.enabled = on
  if (on && s.mode === 'off') s.mode = 'assist'
  saveRfPilot(s)
  return s
}

export function setRfPilotConsent(
  matchKey: string,
  side: 'local' | 'remote',
  agrees: boolean,
): RfPilotState {
  const s = loadRfPilot()
  const cur = s.consents[matchKey] || { local: false, remote: false, at: Date.now() }
  if (side === 'local') cur.local = agrees
  else cur.remote = agrees
  cur.at = Date.now()
  s.consents[matchKey] = cur
  saveRfPilot(s)
  return s
}

export function canRfPilot(matchKey: string, opponentIsHuman: boolean): {
  ok: boolean
  message: string
} {
  const s = loadRfPilot()
  if (!s.enabled || s.mode === 'off') {
    return { ok: false, message: 'Enable AI pilot in match settings' }
  }
  if (!opponentIsHuman) return { ok: true, message: 'AI pilot · vs CPU' }
  if (!s.requireMutualConsentVsHuman) {
    return { ok: true, message: 'AI pilot · local only (consent rule off)' }
  }
  const c = s.consents[matchKey]
  if (!c?.local || !c?.remote) {
    return {
      ok: false,
      message: 'Vs human: both players must Accept AI pilot',
    }
  }
  return { ok: true, message: 'AI pilot · both agreed' }
}
