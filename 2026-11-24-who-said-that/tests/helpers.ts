import type { Clock } from '../server/model.ts'
import { Room, type RoomConfig } from '../server/room.ts'
import type { Profile } from '../shared/protocol.ts'
import { PLAYER_COLORS } from '../shared/avatars.ts'

export class FakeClock implements Clock {
  t = 1_000_000
  private timers: { at: number; fn: () => void; id: number }[] = []
  private seq = 0
  now = () => this.t
  setTimeout = (fn: () => void, ms: number) => {
    const id = ++this.seq
    this.timers.push({ at: this.t + ms, fn, id })
    return id
  }
  clearTimeout = (h: unknown) => {
    this.timers = this.timers.filter((t) => t.id !== h)
  }
  advance(ms: number) {
    const end = this.t + ms
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at)
      const next = this.timers[0]
      if (!next || next.at > end) break
      this.timers.shift()
      this.t = next.at
      next.fn()
    }
    this.t = end
  }
}

export function seededRng(seed = 42) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

export const profile = (name: string, avatar = 0): Profile => ({ name, avatar, color: PLAYER_COLORS[avatar % PLAYER_COLORS.length] })

export function makeRoom(n = 4, config: Partial<RoomConfig> = {}, seed = 7) {
  const clock = new FakeClock()
  const room = new Room('ABCDEF', { clock, rng: seededRng(seed), config })
  const players = Array.from({ length: n }, (_, i) => room.addPlayer(profile(['Alex', 'Jamie', 'Sam', 'Riley', 'Kai', 'Noor', 'Mo', 'Lee'][i] ?? `P${i}`, i)))
  players.forEach((p, i) => room.attach(p.id, `sock-${i}`))
  return { room, clock, players, ids: players.map((p) => p.id), host: players[0].id }
}

/** Start the game and move past the question card into answering. */
export function startToAnswering(r: ReturnType<typeof makeRoom>) {
  r.room.start(r.host)
  r.clock.advance(4000)
  if (r.room.phase !== 'ANSWERING') throw new Error(`expected ANSWERING, got ${r.room.phase}`)
}

export function answerAll(r: ReturnType<typeof makeRoom>, text = (i: number) => `answer number ${i}`) {
  const step = r.room.s.step
  const type = r.room.round!.type
  r.ids.forEach((id, i) => {
    if (r.room.s.phase !== 'ANSWERING') return
    r.room.submitAnswer(id, step, type === 'two-brain-cells' ? `word ${i}` : text(i))
  })
}

export const authorOf = (r: ReturnType<typeof makeRoom>) => {
  const round = r.room.round!
  return round.answers[round.current].authorId
}
