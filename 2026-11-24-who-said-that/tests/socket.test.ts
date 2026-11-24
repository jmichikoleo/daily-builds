import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as connect, type Socket } from 'socket.io-client'
import type { AddressInfo } from 'node:net'
import { createApp } from '../server/app.ts'
import type { RoomView } from '../shared/protocol.ts'
import { profile } from './helpers.ts'

let app: ReturnType<typeof createApp>
let url = ''

beforeAll(async () => {
  app = createApp({ room: { questionCardMs: 50, autoResultsMs: 200, nextRoundMs: 50 } })
  await new Promise<void>((r) => app.http.listen(0, '127.0.0.1', () => r()))
  url = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}`
})
afterAll(() => app.close())

interface Client {
  s: Socket
  views: RoomView[]
  raw: string[]
  last: () => RoomView
  call: (ev: string, payload?: object) => Promise<{ ok: boolean; error?: string; code?: string; token?: string; playerId?: string }>
  waitFor: (pred: (v: RoomView) => boolean, ms?: number) => Promise<RoomView>
}

function client(): Promise<Client> {
  const s = connect(url, { transports: ['websocket'], forceNew: true })
  const views: RoomView[] = []
  const raw: string[] = []
  s.onAny((ev, data) => raw.push(`${ev} ${JSON.stringify(data)}`))
  s.on('game:state', (v: RoomView) => views.push(v))
  const c: Client = {
    s,
    views,
    raw,
    last: () => views[views.length - 1],
    call: (ev, payload = {}) => s.timeout(3000).emitWithAck(ev, payload),
    waitFor: (pred, ms = 3000) =>
      new Promise((resolve, reject) => {
        const hit = views.find((v, i) => i === views.length - 1 && pred(v))
        if (hit) return resolve(hit)
        const t = setTimeout(() => reject(new Error('timeout waiting for state')), ms)
        const on = (v: RoomView) => {
          if (pred(v)) {
            clearTimeout(t)
            s.off('game:state', on)
            resolve(v)
          }
        }
        s.on('game:state', on)
      }),
  }
  return new Promise((r) => s.on('connect', () => r(c)))
}

describe('socket integration', () => {
  it('validates payloads and refuses actions before joining', async () => {
    const c = await client()
    expect(await c.call('room:join', { code: '!!', profile: profile('X') })).toMatchObject({ ok: false })
    expect(await c.call('game:start')).toMatchObject({ ok: false, error: 'Join a room first.' })
    expect(await c.call('room:create', { profile: { name: '<b>x</b>', avatar: 99, color: '#000000' } })).toMatchObject({ ok: false })
    c.s.close()
  })

  it('plays a round over the network without leaking authors before the reveal', async () => {
    const host = await client()
    const created = await host.call('room:create', { profile: profile('Host', 0) })
    expect(created.ok).toBe(true)
    const code = created.code!
    const others = await Promise.all([1, 2, 3].map(() => client()))
    for (const [i, c] of others.entries()) expect((await c.call('room:join', { code, profile: profile(`P${i}`, i + 1) })).ok).toBe(true)
    const all = [host, ...others]
    await host.waitFor((v) => v.players.length === 4)
    expect((await host.call('room:update-settings', { settings: { rounds: 1, specialFrequency: 'off', revealSeconds: 5 } })).ok).toBe(true)
    // non host cannot start
    expect(await others[0].call('game:start')).toMatchObject({ ok: false, error: 'Only the host can do that.' })
    expect((await host.call('game:start')).ok).toBe(true)
    const answering = await host.waitFor((v) => v.phase === 'ANSWERING')
    const texts = all.map((_, i) => `network secret ${i}`)
    await Promise.all(all.map((c, i) => c.call('answer:submit', { step: answering.step, text: texts[i] })))
    const guessing = await host.waitFor((v) => v.phase === 'GUESSING')
    // Everything any client received up to now: no author ids next to answers, and no other answers.
    const myId = (c: Client) => c.last().you.id
    for (const [i, c] of all.entries()) {
      const everything = c.raw.join('\n')
      expect(everything).not.toContain('authorId')
      for (const [j, t] of texts.entries()) if (j !== i && t !== guessing.game!.current!.text) expect(everything).not.toContain(t)
      expect(c.last().game!.reveal).toBeNull()
      expect(c.last().game!.current!.suspects).not.toContain(myId(c))
    }
    // vote: everyone except the author votes
    const voters = all.filter((c) => !c.last().game!.current!.youAreAuthor)
    expect(voters).toHaveLength(3)
    const author = all.find((c) => c.last().game!.current!.youAreAuthor)!
    for (const v of voters) {
      const res = await v.call('guess:submit', { step: guessing.step, suspectId: myId(author) })
      expect(res.ok).toBe(true)
    }
    // the author cannot vote; double votes are rejected
    expect((await voters[0].call('guess:submit', { step: guessing.step, suspectId: myId(author) })).ok).toBe(false)
    const reveal = await host.waitFor((v) => v.phase === 'REVEAL')
    expect(reveal.game!.reveal!.authorId).toBe(myId(author))
    expect(reveal.game!.reveal!.correctVoters).toHaveLength(3)
    all.forEach((c) => c.s.close())
  })

  it('reconnects with a token after a dropped connection', async () => {
    const a = await client()
    const created = await a.call('room:create', { profile: profile('Ann') })
    const id = created.playerId
    a.s.close()
    const b = await client()
    const back = await b.call('room:reconnect', { code: created.code!, token: created.token! })
    expect(back).toMatchObject({ ok: true, playerId: id })
    expect((await b.call('room:reconnect', { code: created.code!, token: 'x'.repeat(32) })).ok).toBe(false)
    b.s.close()
  })

  it('rate limits floods', async () => {
    const c = await client()
    const results = await Promise.all(Array.from({ length: 40 }, () => c.call('game:start')))
    expect(results.some((r) => r.error === 'Slow down, detective.')).toBe(true)
    c.s.close()
  })

  it('serves a health check', async () => {
    const res = await fetch(`${url}/healthz`)
    expect(await res.json()).toMatchObject({ ok: true })
  })
})
