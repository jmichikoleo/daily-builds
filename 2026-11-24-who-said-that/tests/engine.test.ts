import { describe, expect, it } from 'vitest'
import { GameError } from '../server/room.ts'
import { RoomManager } from '../server/rooms.ts'
import { answerAll, authorOf, FakeClock, makeRoom, profile, seededRng, startToAnswering } from './helpers.ts'

describe('rooms and lobby', () => {
  it('creates a room with a readable 6 character code and joins players', () => {
    const m = new RoomManager({ clock: new FakeClock(), rng: seededRng() })
    const room = m.create()
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    const a = room.addPlayer(profile('Alex'))
    const b = room.addPlayer(profile('Jamie', 1))
    expect(room.s.hostId).toBe(a.id)
    expect(room.view(b.id).players.map((p) => p.name)).toEqual(['Alex', 'Jamie'])
    expect(m.get(room.code.toLowerCase())).toBe(room)
    expect(() => m.get('ZZZZZZ')).toThrow(GameError)
  })

  it('dedupes nicknames', () => {
    const r = makeRoom(1)
    const p = r.room.addPlayer(profile('alex'))
    expect(p.name).toBe('alex 2')
  })

  it('tracks readiness', () => {
    const r = makeRoom(3)
    r.room.setReady(r.ids[1], true)
    expect(r.room.view(r.host).players[1].ready).toBe(true)
  })

  it('enforces host only actions', () => {
    const r = makeRoom(4)
    expect(() => r.room.start(r.ids[1])).toThrow('Only the host')
    expect(() => r.room.updateSettings(r.ids[1], { rounds: 3 })).toThrow('Only the host')
    expect(() => r.room.kick(r.ids[1], r.ids[2])).toThrow('Only the host')
    r.room.transferHost(r.host, r.ids[2])
    expect(r.room.s.hostId).toBe(r.ids[2])
    expect(() => r.room.start(r.host)).toThrow('Only the host')
  })

  it('kicks a player and refuses their token afterwards', () => {
    const r = makeRoom(4)
    const target = r.players[3]
    r.room.kick(r.host, target.id)
    expect(r.room.s.players.has(target.id)).toBe(false)
    expect(r.room.findByToken(target.token)).toBeNull()
  })

  it('needs three connected players to start', () => {
    const r = makeRoom(2)
    expect(() => r.room.start(r.host)).toThrow('at least 3')
  })

  it('caps players at 12 and seats extras as spectators', () => {
    const r = makeRoom(12)
    const extra = r.room.addPlayer(profile('Extra'))
    expect(extra.role).toBe('spectator')
    r.room.updateSettings(r.host, { allowSpectators: false })
    expect(() => r.room.addPlayer(profile('Nope'))).toThrow('full')
  })
})

describe('game loop', () => {
  it('walks LOBBY → QUESTION → ANSWERING → GUESSING → REVEAL → ROUND_RESULTS → NEXT_ROUND → FINAL_RESULTS', () => {
    const r = makeRoom(4)
    r.room.updateSettings(r.host, { rounds: 2, specialFrequency: 'off' })
    const seen: string[] = []
    r.room.start(r.host)
    seen.push(r.room.phase)
    r.clock.advance(4000)
    seen.push(r.room.phase)
    for (let round = 0; round < 2; round++) {
      answerAll(r)
      seen.push(r.room.phase)
      while (r.room.phase === 'GUESSING') {
        const author = authorOf(r)
        const step = r.room.s.step
        for (const id of r.ids) if (id !== author) r.room.guess(id, step, author)
        seen.push(r.room.phase)
        r.clock.advance(12_000)
      }
      seen.push(r.room.phase)
      r.clock.advance(15_000)
      seen.push(r.room.phase)
      if (r.room.phase === 'NEXT_ROUND') {
        r.clock.advance(3000)
        r.clock.advance(4000)
      }
    }
    expect(seen[0]).toBe('QUESTION')
    expect(seen[1]).toBe('ANSWERING')
    expect(seen).toContain('GUESSING')
    expect(seen).toContain('REVEAL')
    expect(seen).toContain('ROUND_RESULTS')
    expect(seen).toContain('NEXT_ROUND')
    expect(r.room.phase).toBe('FINAL_RESULTS')
    expect(r.room.view(r.host).game!.final!.leaderboard).toHaveLength(4)
  })

  it('advances early when everyone submits, and on timeout keeps valid answers', () => {
    const r = makeRoom(4)
    r.room.updateSettings(r.host, { specialFrequency: 'off', answerSeconds: 30 })
    startToAnswering(r)
    const step = r.room.s.step
    r.room.submitAnswer(r.ids[0], step, 'a real answer')
    r.room.passAnswer(r.ids[1], step)
    expect(r.room.phase).toBe('ANSWERING')
    r.clock.advance(32_000)
    expect(r.room.phase).toBe('GUESSING')
    expect(r.room.round!.answers).toHaveLength(1)
    expect(r.room.round!.answers[0].text).toBe('a real answer')
  })

  it('goes straight to round results when nobody answers', () => {
    const r = makeRoom(3)
    r.room.updateSettings(r.host, { specialFrequency: 'off' })
    startToAnswering(r)
    const step = r.room.s.step
    r.ids.forEach((id) => r.room.passAnswer(id, step))
    expect(r.room.phase).toBe('ROUND_RESULTS')
    expect(r.room.view(r.host).game!.summary!.recap[0]).toMatch(/pleaded the fifth/)
  })

  it('lets players edit by unlocking, and rejects stale steps and empty answers', () => {
    const r = makeRoom(4)
    startToAnswering(r)
    const step = r.room.s.step
    expect(() => r.room.submitAnswer(r.ids[0], step, '   ')).toThrow('Write something')
    r.room.submitAnswer(r.ids[0], step, 'first draft')
    expect(() => r.room.submitAnswer(r.ids[0], step, 'again')).toThrow('Already locked')
    r.room.unlockAnswer(r.ids[0], step)
    r.room.submitAnswer(r.ids[0], step, 'second draft')
    expect(r.room.view(r.ids[0]).game!.mine!.text).toBe('second draft')
    expect(() => r.room.submitAnswer(r.ids[1], step - 1, 'late')).toThrow('passed')
  })

  it('enforces the character limit and sanitises control characters', () => {
    const r = makeRoom(3)
    r.room.updateSettings(r.host, { answerLimit: 40, specialFrequency: 'off' })
    startToAnswering(r)
    const step = r.room.s.step
    expect(() => r.room.submitAnswer(r.ids[0], step, 'x'.repeat(41))).toThrow('under 40')
    r.room.submitAnswer(r.ids[0], step, 'hi\u0000‮ there\n\nfriend')
    expect(r.room.view(r.ids[0]).game!.mine!.text).toBe('hi there friend')
  })

  it('anonymous skip swaps the question once when half the room asks', () => {
    const r = makeRoom(4)
    r.room.updateSettings(r.host, { specialFrequency: 'off' })
    startToAnswering(r)
    const before = r.room.round!.question.id
    r.room.requestSkip(r.ids[0], r.room.s.step)
    expect(r.room.phase).toBe('ANSWERING')
    r.room.requestSkip(r.ids[1], r.room.s.step)
    expect(r.room.phase).toBe('QUESTION')
    expect(r.room.round!.question.id).not.toBe(before)
    r.clock.advance(4000)
    expect(() => r.room.requestSkip(r.ids[2], r.room.s.step)).toThrow('already skipped')
  })
})

describe('privacy', () => {
  it('never puts authors in any view before the reveal', () => {
    const r = makeRoom(4)
    r.room.updateSettings(r.host, { specialFrequency: 'off' })
    startToAnswering(r)
    answerAll(r, (i) => `secret answer ${i}`)
    expect(r.room.phase).toBe('GUESSING')
    const author = authorOf(r)
    for (const id of r.ids) {
      const v = r.room.view(id)
      const json = JSON.stringify(v.game)
      expect(v.game!.reveal).toBeNull()
      // only the author is told it is theirs
      expect(v.game!.current!.youAreAuthor).toBe(id === author)
      if (id !== author) {
        // no other player's answer text leaks into a non-author view beyond the current one
        for (const a of r.room.round!.answers.slice(1)) if (a.authorId !== id) expect(json).not.toContain(a.text)
        expect(json).not.toContain('authorId')
      }
      expect(v.game!.current!.suspects).not.toContain(id)
    }
    expect(r.room.view(author).game!.current!.suspects).toEqual([])
  })

  it('does not reveal who has submitted during answering', () => {
    const r = makeRoom(4)
    startToAnswering(r)
    r.room.submitAnswer(r.ids[1], r.room.s.step, 'shh')
    const v = r.room.view(r.ids[2])
    expect(v.game!.submittedCount).toBe(1)
    expect(JSON.stringify(v)).not.toContain('shh')
  })
})

describe('guessing and scoring', () => {
  it('blocks self votes, double votes and the author', () => {
    const r = makeRoom(4)
    r.room.updateSettings(r.host, { specialFrequency: 'off' })
    startToAnswering(r)
    answerAll(r)
    const author = authorOf(r)
    const voter = r.ids.find((id) => id !== author)!
    const step = r.room.s.step
    expect(() => r.room.guess(author, step, voter)).toThrow('own answer')
    expect(() => r.room.guess(voter, step, voter)).toThrow('accuse yourself')
    r.room.guess(voter, step, author)
    expect(() => r.room.guess(voter, step, author)).toThrow('already locked')
  })

  it('awards +100 correct, +50 per fooled voter, +150 when nobody guesses, x2 on final boss', () => {
    const r = makeRoom(4)
    r.room.updateSettings(r.host, { specialFrequency: 'off', rounds: 1 })
    startToAnswering(r)
    answerAll(r)
    const author = authorOf(r)
    const others = r.ids.filter((id) => id !== author)
    const step = r.room.s.step
    // all three guess wrong (each blames someone who is neither themselves nor the author)
    for (const v of others) r.room.guess(v, step, others.find((o) => o !== v)!)
    expect(r.room.phase).toBe('REVEAL')
    const rev = r.room.view(r.host).game!.reveal!
    expect(rev.authorId).toBe(author)
    const authorPts = rev.points.filter((p) => p.playerId === author).reduce((s, p) => s + p.amount, 0)
    expect(authorPts).toBe(50 * 3 + 150)
    // replaying the reveal does not double score
    const before = r.room.scores().get(author)
    ;(r.room as unknown as { openReveal: () => void }).openReveal()
    expect(r.room.scores().get(author)).toBe(before)
  })

  it('gives the perfect round bonus and doubles final boss', async () => {
    const { perfectRoundBonus, scoreAnswer } = await import('../server/scoring.ts')
    const votes = new Map([
      ['v1', 'a'],
      ['v2', 'x'],
    ])
    const res = scoreAnswer({ authorId: 'a', eligible: ['v1', 'v2'], votes, multiplier: 2 })
    expect(res.lines.find((l) => l.playerId === 'v1')!.amount).toBe(200)
    expect(res.lines.find((l) => l.playerId === 'a')!.amount).toBe(100)
    const answers = [
      { authorId: 'a', eligible: ['v'], votes: new Map([['v', 'a']]) },
      { authorId: 'b', eligible: ['v'], votes: new Map([['v', 'b']]) },
    ]
    expect(perfectRoundBonus(answers, 'v', 1)!.amount).toBe(200)
    expect(perfectRoundBonus(answers.slice(0, 1), 'v', 1)).toBeNull()
    // the untouchable bonus needs at least two valid guesses
    const one = scoreAnswer({ authorId: 'a', eligible: ['v1', 'v2'], votes: new Map([['v1', 'x']]), multiplier: 1 })
    expect(one.lines.some((l) => l.kind === 'untouchable')).toBe(false)
    // votes from non eligible players are ignored
    const ghost = scoreAnswer({ authorId: 'a', eligible: ['v1'], votes: new Map([['zz', 'q']]), multiplier: 1 })
    expect(ghost.lines).toEqual([])
  })

  it('advances guessing on timeout with missing votes', () => {
    const r = makeRoom(4)
    r.room.updateSettings(r.host, { specialFrequency: 'off', guessSeconds: 10 })
    startToAnswering(r)
    answerAll(r)
    r.clock.advance(11_500)
    expect(r.room.phase).toBe('REVEAL')
    expect(r.room.view(r.host).game!.reveal!.commentary).toMatch(/cold|rain/)
  })
})

describe('disconnects', () => {
  it('reconnects with a token and keeps the seat', () => {
    const r = makeRoom(4)
    const p = r.players[2]
    r.room.detach(p.id, 'sock-2')
    expect(r.room.view(r.host).players[2].connected).toBe(false)
    expect(r.room.findByToken(p.token)!.id).toBe(p.id)
    r.room.attach(p.id, 'sock-new')
    expect(r.room.view(r.host).players[2].connected).toBe(true)
  })

  it('moves host powers when the host disconnects too long, and when they leave', () => {
    const r = makeRoom(4, { hostGraceMs: 5000 })
    r.room.detach(r.host, 'sock-0')
    r.clock.advance(5001)
    expect(r.room.s.hostId).toBe(r.ids[1])
    r.room.leave(r.ids[1])
    expect(r.room.s.hostId).toBe(r.ids[2])
  })

  it('does not let a disconnected player block answering', () => {
    const r = makeRoom(4)
    startToAnswering(r)
    r.room.detach(r.ids[3], 'sock-3')
    const step = r.room.s.step
    for (const id of r.ids.slice(0, 3)) r.room.submitAnswer(id, step, `hi from ${id}`)
    // a fresh drop might be a refresh, so we wait briefly...
    expect(r.room.phase).toBe('ANSWERING')
    // ...but not forever
    r.clock.advance(15_100)
    expect(r.room.phase).toBe('GUESSING')
  })

  it('pauses when too few players remain and resumes when they return', () => {
    const r = makeRoom(3, { reconnectGraceMs: 1000 })
    startToAnswering(r)
    r.room.detach(r.ids[2], 'sock-2')
    r.clock.advance(1001)
    expect(r.room.phase).toBe('PAUSED')
    r.room.attach(r.ids[2], 'sock-back')
    expect(r.room.phase).toBe('ANSWERING')
  })

  it('late joiners spectate until the next game', () => {
    const r = makeRoom(3)
    startToAnswering(r)
    const late = r.room.addPlayer(profile('Late'))
    expect(late.role).toBe('spectator')
    expect(() => r.room.submitAnswer(late.id, r.room.s.step, 'hi')).toThrow('spectating')
    r.room.endGame(r.host)
    r.room.rematch(r.host)
    expect(r.room.s.players.get(late.id)!.role).toBe('player')
  })
})

describe('rematch and cleanup', () => {
  it('rematch keeps players, resets scores and remembers recent questions', () => {
    const r = makeRoom(3)
    r.room.updateSettings(r.host, { rounds: 1, specialFrequency: 'off' })
    startToAnswering(r)
    const q1 = r.room.round!.question.id
    r.room.endGame(r.host)
    expect(r.room.phase).toBe('FINAL_RESULTS')
    r.room.rematch(r.host)
    expect(r.room.phase).toBe('LOBBY')
    expect(r.room.s.players.size).toBe(3)
    expect(r.room.s.recent).toContain(q1)
    startToAnswering(r)
    expect(r.room.round!.question.id).not.toBe(q1)
  })

  it('sweeps idle empty rooms and abandoned rooms', () => {
    const clock = new FakeClock()
    const m = new RoomManager({ clock, rng: seededRng(), idleMs: 1000 })
    const a = m.create()
    const p = a.addPlayer(profile('A'))
    a.attach(p.id, 's')
    const b = m.create()
    expect(m.sweep()).toEqual([b.code])
    a.detach(p.id, 's')
    clock.advance(2000)
    expect(m.sweep()).toEqual([a.code])
    expect(m.rooms.size).toBe(0)
  })

  it('refuses new rooms when at capacity', () => {
    const m = new RoomManager({ clock: new FakeClock(), rng: seededRng(), maxRooms: 1 })
    const a = m.create()
    a.addPlayer(profile('A'))
    expect(() => m.create()).toThrow('capacity')
  })
})
