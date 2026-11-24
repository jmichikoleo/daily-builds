// Pure scoring rules. All points are decided here, on the server.
import type { PointLine } from '../shared/protocol.ts'

export const POINTS = {
  correct: 100,
  fooled: 50,
  perfectRound: 200,
  untouchable: 150,
} as const

export interface ScoreInput {
  authorId: string
  /** Voters allowed to vote on this answer (never includes the author). */
  eligible: string[]
  votes: Map<string, string>
  multiplier: number
}

export interface ScoreResult {
  lines: (PointLine & { kind: string })[]
  correctVoters: string[]
  validVotes: [string, string][]
}

export function scoreAnswer({ authorId, eligible, votes, multiplier }: ScoreInput): ScoreResult {
  const allowed = new Set(eligible.filter((id) => id !== authorId))
  const validVotes = [...votes.entries()].filter(([voter, suspect]) => allowed.has(voter) && voter !== suspect)
  const lines: ScoreResult['lines'] = []
  const correctVoters: string[] = []
  let fooled = 0
  for (const [voter, suspect] of validVotes) {
    if (suspect === authorId) {
      correctVoters.push(voter)
      lines.push({ playerId: voter, amount: POINTS.correct * multiplier, reason: 'cracked the case', kind: 'correct' })
    } else fooled++
  }
  if (fooled > 0)
    lines.push({
      playerId: authorId,
      amount: POINTS.fooled * fooled * multiplier,
      reason: `fooled ${fooled} detective${fooled === 1 ? '' : 's'}`,
      kind: 'fooled',
    })
  if (validVotes.length >= 2 && correctVoters.length === 0)
    lines.push({ playerId: authorId, amount: POINTS.untouchable * multiplier, reason: 'nobody suspected a thing', kind: 'untouchable' })
  return { lines, correctVoters, validVotes }
}

/** +200 for a voter who correctly identified every answer they were eligible to vote on (min two). */
export function perfectRoundBonus(
  answers: { authorId: string; eligible: string[]; votes: Map<string, string> }[],
  voterId: string,
  multiplier: number,
): PointLine | null {
  const mine = answers.filter((a) => a.authorId !== voterId && a.eligible.includes(voterId))
  if (mine.length < 2) return null
  const allCorrect = mine.every((a) => a.votes.get(voterId) === a.authorId)
  return allCorrect ? { playerId: voterId, amount: POINTS.perfectRound * multiplier, reason: 'perfect round' } : null
}
