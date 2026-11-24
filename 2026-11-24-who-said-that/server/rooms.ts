// Room registry: codes, creation, lookup and expiry. In memory only (V1).
import { randomInt } from 'node:crypto'
import { LIMITS } from '../shared/protocol.ts'
import { cryptoRng, realClock, type Clock, type Rng } from './model.ts'
import { GameError, Room, type RoomConfig } from './room.ts'

// No 0/O/1/I/L to keep codes readable out loud on a call.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export interface ManagerOptions {
  clock?: Clock
  rng?: Rng
  maxRooms?: number
  idleMs?: number
  maxAgeMs?: number
  room?: Partial<RoomConfig>
  onChange?: (room: Room) => void
}

export class RoomManager {
  readonly rooms = new Map<string, Room>()
  private readonly clock: Clock
  private readonly rng: Rng
  private readonly opts: Required<Omit<ManagerOptions, 'clock' | 'rng' | 'room' | 'onChange'>>
  private readonly roomConfig: Partial<RoomConfig>
  onChange: (room: Room) => void

  constructor(o: ManagerOptions = {}) {
    this.clock = o.clock ?? realClock
    this.rng = o.rng ?? cryptoRng
    this.opts = {
      maxRooms: o.maxRooms ?? 300,
      idleMs: o.idleMs ?? 60 * 60_000,
      maxAgeMs: o.maxAgeMs ?? 12 * 60 * 60_000,
    }
    this.roomConfig = o.room ?? {}
    this.onChange = o.onChange ?? (() => {})
  }

  private newCode() {
    for (let tries = 0; tries < 50; tries++) {
      let c = ''
      for (let i = 0; i < LIMITS.codeLength; i++) c += ALPHABET[randomInt(0, ALPHABET.length)]
      if (!this.rooms.has(c)) return c
    }
    throw new GameError('Could not find a free room code. Try again.')
  }

  create(): Room {
    this.sweep()
    if (this.rooms.size >= this.opts.maxRooms) throw new GameError('The detective agency is at capacity. Try again in a bit.')
    const code = this.newCode()
    const room = new Room(code, { clock: this.clock, rng: this.rng, config: this.roomConfig, onChange: (r) => this.onChange(r) })
    this.rooms.set(code, room)
    return room
  }

  get(code: string): Room {
    const room = this.rooms.get(code.toUpperCase())
    if (!room) throw new GameError('No room with that code. It may have expired.')
    return room
  }

  /** Deletes rooms that are empty and idle, or simply too old. Returns deleted codes. */
  sweep(): string[] {
    const now = this.clock.now()
    const gone: string[] = []
    for (const [code, room] of this.rooms) {
      const idle = now - room.s.lastActivity > this.opts.idleMs && room.isEmpty()
      const old = now - room.s.createdAt > this.opts.maxAgeMs
      const abandoned = room.s.players.size === 0
      if (idle || old || abandoned) {
        room.destroy()
        this.rooms.delete(code)
        gone.push(code)
      }
    }
    return gone
  }
}
