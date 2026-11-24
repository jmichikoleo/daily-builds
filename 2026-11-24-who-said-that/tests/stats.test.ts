import { describe, expect, it } from 'vitest'
import { finalResults, roundSummary, type AnswerRecord } from '../server/stats.ts'
import { revealCommentary } from '../server/commentary.ts'

const names = (id: string) => id.toUpperCase()
let n = 0
const rec = (authorId: string, votes: [string, string][], reactions = 0): AnswerRecord => ({
  id: `a${++n}`,
  round: 1,
  roundType: 'classic',
  authorId,
  text: `text by ${authorId} ${n}`,
  question: 'q?',
  impersonating: null,
  eligible: votes.map(([v]) => v),
  votes,
  reactions,
})

const ids = ['alex', 'jamie', 'sam', 'riley']

function run(records: AnswerRecord[], received: Record<string, number> = {}) {
  return finalResults({
    records,
    playerIds: ids,
    scores: new Map([
      ['alex', 500],
      ['jamie', 300],
      ['sam', 300],
      ['riley', 100],
    ]),
    reactionsSent: new Map(),
    reactionsReceived: new Map(Object.entries(received)),
    favoriteEmoji: new Map(),
    rounds: 2,
    names,
  })
}

describe('awards', () => {
  const records = [
    // jamie always knows sam and sam always knows jamie
    rec('sam', [['jamie', 'sam'], ['alex', 'riley'], ['riley', 'jamie']]),
    rec('jamie', [['sam', 'jamie'], ['alex', 'riley'], ['riley', 'sam']]),
    rec('sam', [['jamie', 'sam'], ['alex', 'riley'], ['riley', 'jamie']], 4),
    rec('alex', [['jamie', 'riley'], ['sam', 'riley'], ['riley', 'jamie']]),
    rec('riley', [['jamie', 'alex'], ['sam', 'riley'], ['alex', 'riley']]),
  ]
  const res = run(records, { sam: 4 })
  const award = (id: string) => res.awards.find((a) => a.id === id)

  it('handles ranks and ties', () => {
    expect(res.leaderboard.map((l) => l.rank)).toEqual([1, 2, 2, 4])
  })
  it('finds the best detectives', () => {
    // sam 2/3 beats jamie 2/4
    expect(award('fbi')!.winners).toEqual(['sam'])
    expect(award('fbi')!.stat).toBe('2/3 correct')
  })
  it('finds the most wrongly accused', () => {
    expect(award('public-enemy')!.winners).toEqual(['riley'])
  })
  it('finds the shared brain cell pair', () => {
    expect(award('shared-brain-cell')!.winners.sort()).toEqual(['jamie', 'sam'])
  })
  it('finds main character from reactions', () => {
    expect(award('main-character')!.winners).toEqual(['sam'])
  })
  it('finds the most deceptive', () => {
    // sam fooled 2 + 2, alex fooled 3
    expect(award('deception')!.winners).toEqual(['sam'])
  })
  it('skips awards without enough data', () => {
    const empty = run([])
    expect(empty.awards).toEqual([])
    expect(empty.reports.alex.commentary[0]).toMatch(/Not enough evidence/)
    expect(empty.group.verdict).toMatch(/Not enough evidence/)
  })
})

describe('friendship report', () => {
  it('reports accuracy with sample sizes and per friend lines', () => {
    const records = [
      rec('jamie', [['alex', 'sam'], ['sam', 'jamie']]),
      rec('jamie', [['alex', 'sam'], ['sam', 'jamie']]),
      rec('riley', [['alex', 'sam'], ['sam', 'riley']]),
      rec('sam', [['alex', 'sam'], ['jamie', 'sam']]),
    ]
    const r = run(records).reports.alex
    expect(r.accuracy).toEqual({ correct: 1, total: 4 })
    const jamie = r.friends.find((f) => f.friendId === 'jamie')!
    expect(jamie.youGotThem).toEqual({ correct: 0, total: 2 })
    // only commentary supported by the data
    expect(r.commentary.some((c) => c.includes('SAM wrote none of them'))).toBe(false)
    expect(r.mostConfused).toEqual({ truthId: 'jamie', guessedId: 'sam', count: 2 })
    expect(r.blindSpot).toEqual({ friendId: 'jamie', correct: 0, total: 2 })
  })

  it('says "wrote none of them" only when true', () => {
    const records = [
      rec('jamie', [['alex', 'sam']]),
      rec('riley', [['alex', 'sam']]),
    ]
    const r = run(records).reports.alex
    expect(r.commentary[0]).toBe('You confidently pinned 2 answers on SAM. SAM wrote none of them.')
  })

  it('builds a confusion matrix of truth by guess', () => {
    const res = run([rec('jamie', [['alex', 'sam'], ['sam', 'jamie']])])
    const i = (id: string) => res.matrix.ids.indexOf(id)
    expect(res.matrix.cells[i('jamie')][i('sam')]).toBe(1)
    expect(res.matrix.cells[i('jamie')][i('jamie')]).toBe(1)
  })
})

describe('round summary and commentary', () => {
  it('summarises a round', () => {
    const s = roundSummary({
      round: 1,
      roundType: 'classic',
      question: 'q',
      answers: [rec('sam', [['alex', 'riley'], ['jamie', 'riley'], ['riley', 'jamie']]), rec('alex', [['sam', 'alex'], ['jamie', 'alex']])],
      scores: new Map([['sam', 250]]),
      deltas: new Map([['sam', 250]]),
      playerIds: ids,
      passedCount: 1,
      names,
    })
    expect(s.biggestDeception!.authorId).toBe('sam')
    expect(s.mostObvious!.authorId).toBe('alex')
    expect(s.mostSuspected!.playerId).toBe('riley')
    expect(s.recap.join(' ')).toMatch(/pleaded the fifth/)
  })

  it('reveal commentary matches the outcome', () => {
    const base = { seed: 'x', author: 'ALEX', distinctSuspects: 1, impersonating: null, impersonatedVotes: 0 }
    expect(revealCommentary({ ...base, votes: 3, correct: 3, topWrong: null })).toMatch(/ALEX/)
    expect(revealCommentary({ ...base, votes: 3, correct: 0, topWrong: { name: 'SAM', count: 3 } })).toMatch(/SAM/)
    expect(revealCommentary({ ...base, votes: 0, correct: 0, topWrong: null })).toMatch(/cold|rain/)
  })
})
