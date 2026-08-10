/**
 * Xaman SignIn for Riddle Fighter — proper Platform payloads.
 * Stays on this app (no cafe hop):
 *   POST/GET /api/xaman/payload  → fighter.riddlewallet.com
 */

import { SUITE } from './suite'
import { bindFighterAddress, isXrplClassicAddress } from './externalWallet'

export type XummPayloadCreated = {
  uuid: string
  refs?: {
    qr_png?: string
    qr_matrix?: string
    websocket_status?: string
  }
  next?: {
    always?: string
    no_push_msg_received?: string
  }
  pushed?: boolean
}

export type XummPayloadStatus = {
  meta?: {
    signed?: boolean
    cancelled?: boolean
    expired?: boolean
    resolved?: boolean
  }
  response?: {
    account?: string
    txid?: string
    hex?: string
  }
}

export type XamanSignInResult =
  | { ok: true; address: string; uuid: string }
  | { ok: false; error: string; cancelled?: boolean; expired?: boolean }

/** Same-origin fighter proxy; optional override for local/dev only. */
function fighterXamanUrl(): string {
  const env =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string> }).env
      : undefined
  const override = String(env?.VITE_XAMAN_PROXY || '').trim()
  if (override) return override.replace(/\/$/, '')
  // Production / preview: always this app's API (connections move through fighter)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}/api/xaman/payload`
  }
  return `${String(SUITE.fighter || 'https://fighter.riddlewallet.com').replace(/\/$/, '')}/api/xaman/payload`
}

const PENDING_KEY = 'rf_xaman_signin_uuid'

function returnUrl(uuid?: string): string {
  try {
    const u = new URL(window.location.href)
    u.hash = ''
    // strip old xaman params
    u.searchParams.delete('xamanUuid')
    u.searchParams.delete('uuid')
    if (uuid) u.searchParams.set('xamanUuid', uuid)
    return u.toString()
  } catch {
    return SUITE.fighter
  }
}

/** Create Platform SignIn payload (server keys via Cafe proxy). */
export async function createXamanSignInPayload(
  instruction = 'Riddle Fighter · Sign In to load your old-collection NFTs',
): Promise<XummPayloadCreated> {
  const ret = returnUrl()
  const body = {
    txjson: { TransactionType: 'SignIn' },
    options: {
      submit: false,
      expire: 10,
      return_url: { app: ret, web: ret },
    },
    custom_meta: {
      instruction: String(instruction).slice(0, 280),
      blob: { app: 'riddle-fighter', action: 'signin' },
    },
  }
  const res = await fetch(fighterXamanUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    throw new Error(text.slice(0, 160) || `Xaman create failed (${res.status})`)
  }
  if (!res.ok) {
    const err = String(data.error || data.message || text || res.status)
    throw new Error(err.slice(0, 200))
  }
  const uuid = String(data.uuid || '')
  if (!uuid) throw new Error('Xaman payload missing uuid')
  try {
    sessionStorage.setItem(PENDING_KEY, uuid)
  } catch {
    /* soft */
  }
  return data as unknown as XummPayloadCreated
}

export async function pollXamanPayload(uuid: string): Promise<XummPayloadStatus> {
  const id = String(uuid || '').trim()
  if (!id) throw new Error('uuid required')
  const res = await fetch(`${fighterXamanUrl()}?uuid=${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const text = await res.text()
  let data: XummPayloadStatus = {}
  try {
    data = text ? (JSON.parse(text) as XummPayloadStatus) : {}
  } catch {
    throw new Error(text.slice(0, 160) || `Poll failed (${res.status})`)
  }
  if (!res.ok) {
    throw new Error(String((data as { error?: string }).error || res.status))
  }
  return data
}

export function xamanDeepLinks(uuid: string, nextAlways?: string): {
  web: string
  native: string
  qrPng: string
} {
  const web = nextAlways || `https://xumm.app/sign/${uuid}`
  return {
    web,
    native: `xumm://xumm.app/sign/${uuid}`,
    qrPng: `https://xumm.app/sign/${uuid}_q.png`,
  }
}

export function isMobileUa(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/** Open Xaman for the given payload (popup desktop / app scheme mobile). */
export function openXamanSignIn(uuid: string, nextAlways?: string): void {
  const links = xamanDeepLinks(uuid, nextAlways)
  try {
    if (isMobileUa()) {
      const a = document.createElement('a')
      a.href = links.native
      a.rel = 'noopener'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          window.open(links.web, '_blank', 'noopener,noreferrer')
        }
      }, 900)
      return
    }
    const w = 440
    const h = 720
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2))
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2))
    const feat = `popup=yes,width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
    const popup = window.open(links.web, 'riddle_fighter_xaman', feat)
    if (!popup) window.open(links.web, '_blank', 'noopener,noreferrer')
  } catch {
    window.open(links.web, '_blank', 'noopener,noreferrer')
  }
}

export type PollHandlers = {
  onTick?: (status: XummPayloadStatus) => void
  signal?: AbortSignal
  intervalMs?: number
  maxMs?: number
}

/**
 * Poll until signed / cancelled / expired / timeout.
 * Returns bound address on success.
 */
export async function waitXamanSignIn(
  uuid: string,
  handlers?: PollHandlers,
): Promise<XamanSignInResult> {
  const interval = handlers?.intervalMs ?? 3500
  const maxMs = handlers?.maxMs ?? 4 * 60 * 1000
  const start = Date.now()
  let delay = interval

  while (Date.now() - start < maxMs) {
    if (handlers?.signal?.aborted) {
      return { ok: false, error: 'Sign-in cancelled' }
    }
    try {
      const st = await pollXamanPayload(uuid)
      handlers?.onTick?.(st)
      if (st.meta?.signed) {
        const account = String(st.response?.account || '').trim()
        if (!isXrplClassicAddress(account)) {
          return { ok: false, error: 'Signed but no XRPL address returned' }
        }
        const bound = bindFighterAddress(account, 'xaman')
        if (!bound) {
          return {
            ok: false,
            error:
              'Xaman returned the game mint / issuer address — switch to your personal wallet in Xaman and try again',
          }
        }
        try {
          sessionStorage.removeItem(PENDING_KEY)
        } catch {
          /* soft */
        }
        return { ok: true, address: bound, uuid }
      }
      if (st.meta?.cancelled) {
        return { ok: false, error: 'Xaman sign-in cancelled', cancelled: true }
      }
      if (st.meta?.expired) {
        return { ok: false, error: 'Xaman payload expired — try again', expired: true }
      }
      delay = interval
    } catch (e) {
      // 429 backoff
      const msg = e instanceof Error ? e.message : String(e)
      if (/429|rate/i.test(msg)) delay = Math.min(delay * 2, 20000)
    }
    await new Promise((r) => setTimeout(r, delay))
  }
  return { ok: false, error: 'Xaman sign-in timed out' }
}

/**
 * Full flow: create SignIn payload → open Xaman → poll → bind address.
 */
export async function connectXamanSignIn(opts?: {
  instruction?: string
  openApp?: boolean
  onCreated?: (payload: XummPayloadCreated) => void
  onTick?: (status: XummPayloadStatus) => void
  signal?: AbortSignal
}): Promise<XamanSignInResult & { payload?: XummPayloadCreated }> {
  try {
    const payload = await createXamanSignInPayload(opts?.instruction)
    opts?.onCreated?.(payload)
    if (opts?.openApp !== false) {
      openXamanSignIn(payload.uuid, payload.next?.always)
    }
    const result = await waitXamanSignIn(payload.uuid, {
      onTick: opts?.onTick,
      signal: opts?.signal,
    })
    return { ...result, payload }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Xaman SignIn failed',
    }
  }
}

/** Resume pending uuid from URL or sessionStorage after mobile return. */
export function readPendingXamanUuid(): string | null {
  try {
    const q = new URLSearchParams(window.location.search)
    const fromQ = (q.get('xamanUuid') || q.get('uuid') || '').trim()
    if (fromQ) return fromQ
    return sessionStorage.getItem(PENDING_KEY)
  } catch {
    return null
  }
}

export function clearPendingXamanUuid(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY)
    const url = new URL(window.location.href)
    if (url.searchParams.has('xamanUuid') || url.searchParams.has('uuid')) {
      url.searchParams.delete('xamanUuid')
      url.searchParams.delete('uuid')
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    }
  } catch {
    /* soft */
  }
}

/** Probe THIS app's health for xamanReady (fighter owns its keys). */
export async function fetchXamanReady(): Promise<boolean> {
  try {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin.replace(/\/$/, '')
        : String(SUITE.fighter || 'https://fighter.riddlewallet.com').replace(/\/$/, '')
    const res = await fetch(`${origin}/api/health`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return false
    const data = (await res.json()) as { xamanReady?: boolean }
    return data.xamanReady === true
  } catch {
    return false
  }
}
