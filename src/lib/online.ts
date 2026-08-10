/**
 * Online multiplayer — host-authoritative via PeerJS free cloud broker.
 * Room code = host peer id (short). Guest joins with code.
 * Works on fighter.riddlewallet.com across devices.
 */

import type { EngineSnapshot, InputState } from '../game/engine'
import type { Fighter } from './fighters'

export type OnlineRole = 'host' | 'guest' | null

export type OnlineLobbyMsg =
  | { type: 'hello'; role: 'guest'; fighter: Fighter }
  | { type: 'welcome'; fighter: Fighter; roundsToWin: number }
  | { type: 'ready' }
  | { type: 'input'; input: InputState }
  | { type: 'snap'; snap: EngineSnapshot }
  | { type: 'match_end'; winner: 'p1' | 'p2' }
  | { type: 'ping' }

type PeerLike = {
  id: string
  destroy: () => void
  on: (ev: string, fn: (...args: unknown[]) => void) => void
  connect: (id: string) => DataConn
}

type DataConn = {
  open: boolean
  send: (data: unknown) => void
  close: () => void
  on: (ev: string, fn: (...args: unknown[]) => void) => void
}

export type OnlineSession = {
  role: OnlineRole
  roomCode: string
  status: 'idle' | 'connecting' | 'waiting' | 'linked' | 'error'
  error?: string
  peer: PeerLike | null
  conn: DataConn | null
  remoteFighter: Fighter | null
}

type Handlers = {
  onStatus?: (s: OnlineSession) => void
  onMessage?: (msg: OnlineLobbyMsg) => void
  onLinked?: () => void
}

type PeerModule = { default: new (id?: string, opts?: object) => PeerLike }

let peerMod: PeerModule | null = null

async function loadPeer(): Promise<PeerModule | null> {
  if (peerMod) return peerMod
  try {
    const mod = await import('peerjs')
    peerMod = mod as unknown as PeerModule
    return peerMod
  } catch (e) {
    console.warn('peerjs load failed', e)
    return null
  }
}

function emit(h: Handlers, session: OnlineSession): void {
  h.onStatus?.(session)
}

export async function hostRoom(
  localFighter: Fighter,
  handlers: Handlers,
  roundsToWin = 2,
): Promise<OnlineSession> {
  const mod = await loadPeer()
  const session: OnlineSession = {
    role: 'host',
    roomCode: '',
    status: 'connecting',
    peer: null,
    conn: null,
    remoteFighter: null,
  }
  if (!mod?.default) {
    session.status = 'error'
    session.error = 'Online module unavailable'
    emit(handlers, session)
    return session
  }
  const code = `rf${Math.random().toString(36).slice(2, 8)}`
  const peer = new mod.default(code, { debug: 0 })
  session.peer = peer
  session.roomCode = code

  peer.on('open', () => {
    session.status = 'waiting'
    session.roomCode = peer.id || code
    emit(handlers, { ...session })
  })
  peer.on('error', (err: unknown) => {
    session.status = 'error'
    session.error = err instanceof Error ? err.message : 'Peer error'
    emit(handlers, { ...session })
  })
  peer.on('connection', (...args: unknown[]) => {
    const conn = args[0] as DataConn
    session.conn = conn
    wireConn(conn, session, handlers, () => {
      conn.send({
        type: 'welcome',
        fighter: localFighter,
        roundsToWin,
      } satisfies OnlineLobbyMsg)
    })
  })
  emit(handlers, session)
  return session
}

export async function joinRoom(
  roomCode: string,
  localFighter: Fighter,
  handlers: Handlers,
): Promise<OnlineSession> {
  const mod = await loadPeer()
  const session: OnlineSession = {
    role: 'guest',
    roomCode: roomCode.trim(),
    status: 'connecting',
    peer: null,
    conn: null,
    remoteFighter: null,
  }
  if (!mod?.default) {
    session.status = 'error'
    session.error = 'Online module unavailable'
    emit(handlers, session)
    return session
  }
  const peer = new mod.default(undefined, { debug: 0 })
  session.peer = peer
  peer.on('open', () => {
    const conn = peer.connect(roomCode.trim())
    session.conn = conn
    wireConn(conn, session, handlers, () => {
      conn.send({ type: 'hello', role: 'guest', fighter: localFighter } satisfies OnlineLobbyMsg)
      session.status = 'linked'
      emit(handlers, { ...session })
      handlers.onLinked?.()
    })
  })
  peer.on('error', (err: unknown) => {
    session.status = 'error'
    session.error = err instanceof Error ? err.message : 'Join failed'
    emit(handlers, { ...session })
  })
  emit(handlers, session)
  return session
}

function wireConn(
  conn: DataConn,
  session: OnlineSession,
  handlers: Handlers,
  onOpen: () => void,
): void {
  conn.on('open', () => {
    if (session.role === 'host') {
      session.status = 'linked'
      emit(handlers, { ...session })
      handlers.onLinked?.()
    }
    onOpen()
  })
  conn.on('data', (...args: unknown[]) => {
    const msg = args[0] as OnlineLobbyMsg
    if (msg?.type === 'hello' && msg.fighter) {
      session.remoteFighter = msg.fighter
      emit(handlers, { ...session })
    }
    if (msg?.type === 'welcome' && msg.fighter) {
      session.remoteFighter = msg.fighter
      emit(handlers, { ...session })
    }
    handlers.onMessage?.(msg)
  })
  conn.on('close', () => {
    session.status = 'error'
    session.error = 'Opponent disconnected'
    emit(handlers, { ...session })
  })
}

export function sendOnline(session: OnlineSession | null, msg: OnlineLobbyMsg): void {
  try {
    if (session?.conn?.open) session.conn.send(msg)
  } catch {
    /* soft */
  }
}

export function destroyOnline(session: OnlineSession | null): void {
  try {
    session?.conn?.close()
  } catch {
    /* soft */
  }
  try {
    session?.peer?.destroy()
  } catch {
    /* soft */
  }
}

export function roomShareUrl(roomCode: string): string {
  try {
    const u = new URL(window.location.href)
    u.searchParams.set('room', roomCode)
    return u.toString()
  } catch {
    return `?room=${roomCode}`
  }
}
