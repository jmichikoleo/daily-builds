// Socket.IO wiring: validation, rate limits, authorization and per player state projections.
import type { Server, Socket } from 'socket.io'
import type { z } from 'zod'
import {
  schemas,
  type ClientEvent,
  type ClientToServer,
  type CustomDeck,
  type GameSettings,
  type JoinResult,
  type ServerToClient,
} from '../shared/protocol.ts'
import { GameError, type Room } from './room.ts'
import type { RoomManager } from './rooms.ts'

interface SocketData {
  code: string | null
  playerId: string | null
  ip: string
}

type IO = Server<ClientToServer, ServerToClient, Record<string, never>, SocketData>
type S = Socket<ClientToServer, ServerToClient, Record<string, never>, SocketData>

/** Simple token bucket. */
export class Bucket {
  private tokens: number
  private last: number
  private readonly capacity: number
  private readonly perSecond: number
  private readonly now: () => number
  constructor(capacity: number, perSecond: number, now: () => number = Date.now) {
    this.capacity = capacity
    this.perSecond = perSecond
    this.now = now
    this.tokens = capacity
    this.last = now()
  }
  take(n = 1) {
    const t = this.now()
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.perSecond)
    this.last = t
    if (this.tokens < n) return false
    this.tokens -= n
    return true
  }
}

const ipBuckets = new Map<string, Bucket>()
function ipAllowed(ip: string) {
  let b = ipBuckets.get(ip)
  if (!b) {
    b = new Bucket(8, 8 / 60)
    ipBuckets.set(ip, b)
  }
  if (ipBuckets.size > 5000) ipBuckets.clear()
  return b.take()
}

export function broadcast(io: IO, room: Room) {
  for (const p of room.s.players.values()) {
    if (p.sockets.size === 0) continue
    const view = room.view(p.id)
    for (const sid of p.sockets) io.to(sid).emit('game:state', view)
  }
}

export function attachSockets(io: IO, manager: RoomManager, log: (msg: string) => void = () => {}) {
  manager.onChange = (room) => broadcast(io, room)

  io.on('connection', (socket: S) => {
    const fwd = socket.handshake.headers['x-forwarded-for']
    socket.data.ip = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || socket.handshake.address
    socket.data.code = null
    socket.data.playerId = null
    const events = new Bucket(25, 10)
    const reactions = new Bucket(6, 2.5)

    const current = (): { room: Room; playerId: string } => {
      const { code, playerId } = socket.data
      if (!code || !playerId) throw new GameError('Join a room first.')
      const room = manager.rooms.get(code)
      if (!room || !room.s.players.has(playerId)) throw new GameError('This room no longer exists.')
      return { room, playerId }
    }

    const bind = (room: Room, playerId: string) => {
      if (socket.data.code && socket.data.playerId && (socket.data.code !== room.code || socket.data.playerId !== playerId)) {
        manager.rooms.get(socket.data.code)?.detach(socket.data.playerId, socket.id)
      }
      socket.data.code = room.code
      socket.data.playerId = playerId
      socket.join(room.code)
      room.attach(playerId, socket.id)
    }

    function on<E extends ClientEvent>(event: E, handler: (data: z.output<(typeof schemas)[E]>, ack: (extra?: object) => void) => void) {
      socket.on(event as never, ((raw: unknown, ack: unknown) => {
        const reply = typeof ack === 'function' ? (ack as (r: unknown) => void) : () => {}
        try {
          if (event === 'reaction:send' ? !reactions.take() : !events.take()) throw new GameError('Slow down, detective.')
          const parsed = schemas[event].safeParse(raw ?? {})
          if (!parsed.success) throw new GameError('That request did not look right.')
          handler(parsed.data as z.output<(typeof schemas)[E]>, (extra) => reply({ ok: true, ...extra }))
        } catch (err) {
          const message = err instanceof GameError ? err.message : 'Something went wrong on our side.'
          if (!(err instanceof GameError)) log(`error in ${event}: ${(err as Error).stack ?? err}`)
          reply({ ok: false, error: message })
        }
      }) as never)
    }

    on('room:create', ({ profile }, ok) => {
      if (!ipAllowed(socket.data.ip)) throw new GameError('Too many rooms from here. Wait a minute.')
      const room = manager.create()
      const p = room.addPlayer(profile)
      bind(room, p.id)
      const res: JoinResult = { code: room.code, playerId: p.id, token: p.token }
      ok(res)
      log(`room ${room.code} created (${manager.rooms.size} rooms)`)
    })

    on('room:join', ({ code, profile }, ok) => {
      const room = manager.get(code)
      const p = room.addPlayer(profile)
      bind(room, p.id)
      ok({ code: room.code, playerId: p.id, token: p.token } satisfies JoinResult)
    })

    on('room:reconnect', ({ code, token }, ok) => {
      const room = manager.get(code)
      const p = room.findByToken(token)
      if (!p) throw new GameError('Your seat expired. Join again with the code.')
      bind(room, p.id)
      ok({ code: room.code, playerId: p.id, token: p.token } satisfies JoinResult)
    })

    on('room:leave', (_, ok) => {
      const { room, playerId } = current()
      room.leave(playerId)
      socket.leave(room.code)
      socket.data.code = null
      socket.data.playerId = null
      ok()
    })

    on('room:update-settings', ({ settings }, ok) => {
      const { room, playerId } = current()
      room.updateSettings(playerId, settings as Partial<GameSettings>)
      ok()
    })

    on('room:custom-decks', ({ decks }, ok) => {
      const { room, playerId } = current()
      room.setCustomDecks(playerId, decks as CustomDeck[])
      ok()
    })

    on('room:kick', ({ playerId: target }, ok) => {
      const { room, playerId } = current()
      room.kick(playerId, target)
      for (const s of io.sockets.sockets.values()) {
        if (s.data.code === room.code && s.data.playerId === target) {
          s.emit('room:kicked', { message: 'The host removed you from this room.' })
          s.leave(room.code)
          s.data.code = null
          s.data.playerId = null
        }
      }
      ok()
    })

    on('room:transfer-host', ({ playerId: target }, ok) => {
      const { room, playerId } = current()
      room.transferHost(playerId, target)
      ok()
    })

    on('player:update-profile', ({ profile }, ok) => {
      const { room, playerId } = current()
      room.updateProfile(playerId, profile)
      ok()
    })

    on('player:ready', ({ ready }, ok) => {
      const { room, playerId } = current()
      room.setReady(playerId, ready)
      ok()
    })

    on('game:start', (_, ok) => {
      const { room, playerId } = current()
      room.start(playerId)
      ok()
    })

    on('answer:submit', ({ step, text }, ok) => {
      const { room, playerId } = current()
      room.submitAnswer(playerId, step, text)
      ok()
    })

    on('answer:unlock', ({ step }, ok) => {
      const { room, playerId } = current()
      room.unlockAnswer(playerId, step)
      ok()
    })

    on('answer:pass', ({ step }, ok) => {
      const { room, playerId } = current()
      room.passAnswer(playerId, step)
      ok()
    })

    on('answer:skip-request', ({ step }, ok) => {
      const { room, playerId } = current()
      room.requestSkip(playerId, step)
      ok()
    })

    on('guess:submit', ({ step, suspectId }, ok) => {
      const { room, playerId } = current()
      room.guess(playerId, step, suspectId)
      ok()
    })

    on('round:advance', ({ step }, ok) => {
      const { room, playerId } = current()
      room.advance(playerId, step)
      ok()
    })

    on('game:end', (_, ok) => {
      const { room, playerId } = current()
      room.endGame(playerId)
      ok()
    })

    on('game:rematch', (_, ok) => {
      const { room, playerId } = current()
      room.rematch(playerId)
      ok()
    })

    on('reaction:send', ({ emoji }, ok) => {
      const { room, playerId } = current()
      const r = room.react(playerId, emoji)
      io.to(room.code).emit('reaction:new', r)
      ok()
    })

    socket.on('disconnect', () => {
      const { code, playerId } = socket.data
      if (!code || !playerId) return
      manager.rooms.get(code)?.detach(playerId, socket.id)
    })
  })
}
