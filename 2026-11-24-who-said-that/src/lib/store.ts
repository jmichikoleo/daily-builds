// Client connection + state store. The server is the source of truth; this only mirrors it.
import { useSyncExternalStore } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  ClientEvent,
  ClientToServer,
  JoinResult,
  Payload,
  Profile,
  ReactionEvent,
  RoomView,
  ServerToClient,
} from '../../shared/protocol.ts'
import { sfx } from './sound.ts'

export type Status = 'connecting' | 'online' | 'offline'

export interface StoreState {
  status: Status
  view: RoomView | null
  code: string | null
  offset: number
  reactions: (ReactionEvent & { key: number })[]
  kicked: string | null
  joinError: string | null
}

let state: StoreState = { status: 'connecting', view: null, code: null, offset: 0, reactions: [], kicked: null, joinError: null }
const listeners = new Set<() => void>()
const set = (patch: Partial<StoreState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

const SESSION_KEY = (code: string) => `wst:session:${code}`
export function savedSession(code: string): JoinResult | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY(code))
    return raw ? (JSON.parse(raw) as JoinResult) : null
  } catch {
    return null
  }
}
function saveSession(s: JoinResult) {
  try {
    localStorage.setItem(SESSION_KEY(s.code), JSON.stringify(s))
  } catch {
    /* private mode */
  }
}
export function forgetSession(code: string) {
  try {
    localStorage.removeItem(SESSION_KEY(code))
  } catch {
    /* ignore */
  }
}

let socket: Socket<ServerToClient, ClientToServer> | null = null
let reactionKey = 0

function sock() {
  if (socket) return socket
  socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 })
  socket.on('connect', () => {
    set({ status: 'online' })
    // Refresh or network blip: take our seat back.
    if (state.code) {
      const saved = savedSession(state.code)
      if (saved) void resume(state.code)
    }
  })
  socket.on('disconnect', () => set({ status: 'offline' }))
  socket.io.on('reconnect_attempt', () => set({ status: 'connecting' }))
  socket.on('connect_error', () => set({ status: 'offline' }))
  socket.on('game:state', (view) => {
    const prev = state.view
    set({ view, offset: view.serverNow - Date.now() })
    cueSounds(prev, view)
  })
  socket.on('reaction:new', (r) => {
    const item = { ...r, key: ++reactionKey }
    set({ reactions: [...state.reactions.slice(-24), item] })
    setTimeout(() => set({ reactions: state.reactions.filter((x) => x.key !== item.key) }), 3200)
  })
  socket.on('room:kicked', ({ message }) => {
    if (state.code) forgetSession(state.code)
    set({ kicked: message, view: null })
  })
  return socket
}

export function connect() {
  sock()
}

type Res = { ok: true } & Partial<JoinResult> | { ok: false; error: string }

export async function send<E extends ClientEvent>(event: E, payload: Payload<E>): Promise<Res> {
  const s = sock()
  if (!s.connected) return { ok: false, error: 'Not connected to the server. Reconnecting…' }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await (s.timeout(6000) as any).emitWithAck(event, payload)) as Res
  } catch {
    return { ok: false, error: 'The server took too long to answer.' }
  }
}

function waitConnected(): Promise<void> {
  const s = sock()
  if (s.connected) return Promise.resolve()
  return new Promise((resolve) => s.once('connect', () => resolve()))
}

export async function createRoom(profile: Profile) {
  await waitConnected()
  const res = await send('room:create', { profile })
  if (res.ok && res.code) {
    saveSession(res as JoinResult)
    set({ code: res.code, joinError: null, kicked: null })
  }
  return res
}

export async function joinRoom(code: string, profile: Profile) {
  await waitConnected()
  const res = await send('room:join', { code, profile })
  if (res.ok && res.code) {
    saveSession(res as JoinResult)
    set({ code: res.code, joinError: null, kicked: null })
  }
  return res
}

export async function resume(code: string) {
  const saved = savedSession(code)
  if (!saved) return { ok: false as const, error: 'no session' }
  await waitConnected()
  set({ code })
  const res = await send('room:reconnect', { code, token: saved.token })
  if (!res.ok) {
    forgetSession(code)
    set({ view: null, joinError: res.error })
  }
  return res
}

export async function leaveRoom() {
  const code = state.code
  await send('room:leave', {})
  if (code) forgetSession(code)
  set({ view: null, code: null })
}

export function setRoomCode(code: string | null) {
  if (state.code !== code) set({ code, view: code && state.view?.code === code ? state.view : null, joinError: null })
}

export function clearKicked() {
  set({ kicked: null })
}

export function useStore(): StoreState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export const serverNow = () => Date.now() + state.offset

function cueSounds(prev: RoomView | null, next: RoomView) {
  if (!next.settings.sound) return
  if (prev && prev.code === next.code && next.players.length > prev.players.length && next.phase === 'LOBBY') sfx('join')
  if (!prev || prev.phase === next.phase) return
  switch (next.phase) {
    case 'QUESTION':
      sfx('card')
      break
    case 'GUESSING':
      sfx('card')
      break
    case 'REVEAL':
      sfx('suspense')
      break
    case 'ROUND_RESULTS':
      sfx('paper')
      break
    case 'FINAL_RESULTS':
      sfx('fanfare')
      break
  }
}
