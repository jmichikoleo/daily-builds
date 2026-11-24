import { describe, expect, it } from 'vitest'
import { ALL_QUESTIONS, DECK_QUESTIONS, SPECIAL_QUESTIONS, validateBank } from '../shared/bank.ts'
import { DECK_IDS, ROUND_TYPES, type RoundType } from '../shared/questions.ts'
import { DEFAULT_SETTINGS } from '../shared/protocol.ts'
import { assignImpersonations, countWords, eligibleQuestions, pickQuestions, planRounds } from '../server/questions.ts'
import { answerAll, authorOf, makeRoom, seededRng, startToAnswering } from './helpers.ts'

describe('question bank', () => {
  it('is valid: no duplicate ids or texts, no missing fields, valid decks', () => {
    expect(validateBank(ALL_QUESTIONS)).toEqual([])
  })

  it('has at least 300 deck questions and at least 30 per deck', () => {
    expect(DECK_QUESTIONS.length).toBeGreaterThanOrEqual(300)
    for (const d of DECK_IDS) expect(DECK_QUESTIONS.filter((q) => q.deck === d).length).toBeGreaterThanOrEqual(30)
  })

  it('covers every chaos level and every round type', () => {
    for (const lvl of [1, 2, 3, 4, 5]) expect(DECK_QUESTIONS.filter((q) => q.chaos === lvl).length).toBeGreaterThan(20)
    for (const t of ROUND_TYPES) expect(ALL_QUESTIONS.some((q) => q.rounds.includes(t))).toBe(true)
    for (const t of ['alibi', 'pr-disaster', 'complaints', 'unsent-message'] as RoundType[])
      expect(SPECIAL_QUESTIONS.filter((q) => q.rounds.includes(t) && q.chaos <= 2).length).toBeGreaterThanOrEqual(2)
  })

  it('catches broken questions', () => {
    const bad = [
      { ...ALL_QUESTIONS[0] },
      { ...ALL_QUESTIONS[0], text: 'something else entirely here' },
      { ...ALL_QUESTIONS[1], id: 'petty-999', deck: 'nope', chaos: 9 as never, rounds: [] },
    ]
    const problems = validateBank(bad).join('\n')
    expect(problems).toMatch(/duplicate id/)
    expect(problems).toMatch(/invalid deck/)
    expect(problems).toMatch(/invalid chaos/)
    expect(problems).toMatch(/no rounds/)
  })
})

describe('question selection', () => {
  it('filters by chaos level independently of decks', () => {
    const s = { ...DEFAULT_SETTINGS, chaos: 1 as const, decks: ['petty', 'online'] as never }
    const qs = eligibleQuestions(s, [], 'classic')
    expect(qs.length).toBeGreaterThan(5)
    expect(qs.every((q) => q.chaos === 1 && ['petty', 'online'].includes(q.deck))).toBe(true)
  })

  it('never repeats within a game and avoids recent history', () => {
    const used = new Set<string>()
    const s = { ...DEFAULT_SETTINGS }
    for (let i = 0; i < 60; i++) {
      const [q] = pickQuestions({ settings: s, customDecks: [], type: 'classic', used, recent: new Set(), count: 1, rng: seededRng(i) })
      expect(used.has(q.id)).toBe(false)
      used.add(q.id)
    }
    const recent = new Set(DECK_QUESTIONS.slice(0, 200).map((q) => q.id))
    const picked = pickQuestions({ settings: s, customDecks: [], type: 'classic', used: new Set(), recent, count: 20, rng: seededRng(3) })
    expect(picked.every((q) => !recent.has(q.id))).toBe(true)
  })

  it('uses custom decks when enabled', () => {
    const deck = { id: 'mine', name: 'Mine', description: '', color: '#ffaaaa', icon: '⭐', questions: [{ id: 'q1', text: 'Who would win a fight with a goose?', chaos: 1 }] }
    const s = { ...DEFAULT_SETTINGS, decks: [] as never[] }
    expect(eligibleQuestions(s, [deck], 'classic').map((q) => q.text)).toEqual(['Who would win a fight with a goose?'])
    expect(eligibleQuestions({ ...s, customQuestions: false }, [deck], 'classic')).toEqual([])
  })

  it('plans rounds: classic only, randomized specials, final boss last', () => {
    expect(planRounds({ ...DEFAULT_SETTINGS, specialFrequency: 'off', rounds: 5 }, seededRng())).toEqual(Array(5).fill('classic'))
    const plan = planRounds({ ...DEFAULT_SETTINGS, specialFrequency: 'always', rounds: 10 }, seededRng(9))
    expect(plan[9]).toBe('final-boss')
    expect(plan.slice(0, 9).every((t) => t !== 'classic' && t !== 'final-boss')).toBe(true)
    const only = planRounds({ ...DEFAULT_SETTINGS, specialFrequency: 'always', specialTypes: ['alibi'], rounds: 3 }, seededRng())
    expect(only).toEqual(['alibi', 'alibi', 'alibi'])
  })

  it('assigns impersonation targets as a derangement', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    const m = assignImpersonations(ids, seededRng(5))
    expect(new Set(m.values()).size).toBe(5)
    for (const [k, v] of m) expect(k).not.toBe(v)
  })
})

/** Plays a room whose only round is the given special type, returning the room in guessing. */
function specialRoom(type: RoundType, n = 4) {
  const r = makeRoom(n)
  r.room.updateSettings(r.host, { rounds: 1, specialFrequency: 'always', specialTypes: [type] })
  r.room.start(r.host)
  r.clock.advance(4000)
  return r
}

describe('special rounds (all 10)', () => {
  it('Identity Theft: private targets, shown at guessing, actual writer wins points', () => {
    const r = specialRoom('identity-theft')
    expect(r.room.round!.type).toBe('identity-theft')
    const targets = r.ids.map((id) => r.room.view(id).game!.impersonate)
    targets.forEach((t, i) => {
      expect(t).not.toBeNull()
      expect(t).not.toBe(r.ids[i])
    })
    // a player only sees their own target
    expect(JSON.stringify(r.room.view(r.ids[0]))).not.toContain(`"impersonate":"${targets[1]}"`)
    answerAll(r)
    const v = r.room.view(r.ids[0]).game!.current!
    const author = authorOf(r)
    expect(v.impersonating).toBe(r.room.round!.assignments!.get(author))
  })

  it('Two Brain Cells: three words max on the server', () => {
    const r = specialRoom('two-brain-cells')
    const step = r.room.s.step
    expect(() => r.room.submitAnswer(r.ids[0], step, 'one two three four')).toThrow('Three words')
    r.room.submitAnswer(r.ids[0], step, 'one two three')
    expect(countWords('  a   b ')).toBe(2)
  })

  it('Wrong Answers Only uses deck questions with the wrong-answers flag', () => {
    const r = specialRoom('wrong-answers')
    expect(r.room.round!.question.rounds).toContain('wrong-answers')
    expect(r.room.view(r.host).game!.rules).toMatch(/incorrect/)
  })

  for (const type of ['alibi', 'pr-disaster', 'complaints', 'unsent-message'] as RoundType[]) {
    it(`${type} draws from the special prompt pool`, () => {
      const r = specialRoom(type)
      expect(r.room.round!.question.deck).toBe('case-files')
      expect(r.room.round!.question.rounds).toContain(type)
    })
  }

  it('Plot Twist: everyone gets a different question, shown next to the answer', () => {
    const r = specialRoom('plot-twist', 5)
    const qs = r.ids.map((id) => r.room.view(id).game!.question!.id)
    expect(new Set(qs).size).toBe(5)
    answerAll(r)
    const author = authorOf(r)
    const cur = r.room.view(r.host).game!.current!
    expect(cur.question).toBe(r.room.round!.perPlayer!.get(author)!.text)
  })

  it('Speed Demon: 10 second timer', () => {
    const r = specialRoom('speed-demon')
    const v = r.room.view(r.host)
    expect(r.room.round!.type).toBe('speed-demon')
    expect(v.deadline! - v.serverNow).toBeLessThanOrEqual(10_000)
    expect(v.deadline! - v.serverNow).toBeGreaterThan(9_000)
    r.clock.advance(11_300)
    expect(r.room.phase).not.toBe('ANSWERING')
  })

  it('Final Boss: last round, double points', () => {
    const r = makeRoom(4)
    r.room.updateSettings(r.host, { rounds: 2, specialFrequency: 'sometimes', specialTypes: ['final-boss'] })
    r.room.start(r.host)
    expect(r.room.s.game!.plan).toEqual(['classic', 'final-boss'])
    r.room.s.game!.plan = ['final-boss']
    r.room.s.game!.rounds = []
    ;(r.room as unknown as { startRound: () => void }).startRound()
    r.clock.advance(4000)
    answerAll(r)
    const author = authorOf(r)
    const step = r.room.s.step
    for (const id of r.ids) if (id !== author) r.room.guess(id, step, author)
    const rev = r.room.view(r.host).game!.reveal!
    expect(rev.multiplier).toBe(2)
    expect(rev.points.every((p) => p.amount === 200)).toBe(true)
  })
})

describe('chaos preview data', () => {
  it('every level has questions in the full bank for the preview', () => {
    for (const lvl of [1, 2, 3, 4, 5]) expect(DECK_QUESTIONS.some((q) => q.chaos === lvl)).toBe(true)
  })
  it('startToAnswering helper works for a default room', () => {
    const r = makeRoom(3)
    startToAnswering(r)
    expect(r.room.phase).toBe('ANSWERING')
  })
})
