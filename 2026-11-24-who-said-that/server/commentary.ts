// Deterministic, template based commentary. No LLMs were harmed.

export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const pick = <T>(seed: string, options: T[]): T => options[hash(seed) % options.length]

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}

export interface RevealFacts {
  seed: string
  author: string
  votes: number
  correct: number
  topWrong: { name: string; count: number } | null
  distinctSuspects: number
  impersonating: string | null
  impersonatedVotes: number
}

const T = {
  noVotes: [
    'No detectives showed up. The case goes cold.',
    'Zero votes. The evidence was left in the rain.',
  ],
  impersonation: [
    '{n} detectives arrested {imp}. {imp} is innocent. {author} is a menace.',
    'Flawless identity theft. {imp} has been framed by {author}.',
  ],
  ghost: [
    'Absolutely nobody suspected {author}. Investigators are reconsidering their careers.',
    '{author} walked out the front door and nobody noticed. Untouchable.',
    'Not one detective clocked {author}. Witness protection could never.',
  ],
  unanimous: [
    '{author} was identified by everyone. Your friends know you. That is not a compliment.',
    'Unanimous. {author} has the subtlety of a marching band.',
    'Everyone knew it was {author}. Everyone. Even the furniture.',
  ],
  framed: [
    '{wrong} took {n} accusations for a crime they did not commit.',
    'The mob came for {wrong}. {wrong} would like a lawyer.',
    '{n} detectives pointed at {wrong}. {wrong} has never looked more guilty while being innocent.',
  ],
  split: [
    'The detectives split {k} ways. Nobody trusts anybody. Healthy.',
    'Votes scattered across {k} suspects. Chaos, but make it evidence.',
  ],
  majority: [
    'Most of you got it. {author} needs a better disguise.',
    'Mostly cracked. {author} was sloppy but not careless.',
  ],
  minority: [
    'Only {c} detective{s} saw through {author}. The rest owe them an apology.',
    '{c} sharp eye{s} spotted {author}. Everyone else was busy being wrong.',
  ],
}

export function revealCommentary(f: RevealFacts): string {
  const vars = {
    author: f.author,
    n: f.topWrong?.count ?? 0,
    wrong: f.topWrong?.name ?? '',
    imp: f.impersonating ?? '',
    k: f.distinctSuspects,
    c: f.correct,
    s: f.correct === 1 ? '' : 's',
  }
  if (f.votes === 0) return pick(f.seed, T.noVotes)
  if (f.impersonating && f.impersonatedVotes >= 2 && f.correct === 0)
    return fill(pick(f.seed, T.impersonation), { ...vars, n: f.impersonatedVotes })
  if (f.correct === 0 && f.votes >= 2) {
    if (f.topWrong && f.topWrong.count >= 2 && f.topWrong.count === f.votes) return fill(pick(f.seed, T.framed), vars)
    return fill(pick(f.seed, T.ghost), vars)
  }
  if (f.correct === f.votes && f.votes >= 2) return fill(pick(f.seed, T.unanimous), vars)
  if (f.topWrong && f.topWrong.count >= 2 && f.topWrong.count > f.correct) return fill(pick(f.seed, T.framed), vars)
  if (f.distinctSuspects >= 3 && f.correct <= f.votes / 2) return fill(pick(f.seed, T.split), vars)
  if (f.correct > f.votes / 2) return fill(pick(f.seed, T.majority), vars)
  return fill(pick(f.seed, T.minority), vars)
}

export function groupVerdict(rate: number, total: number): string {
  if (total < 3) return 'Not enough evidence for a verdict. Play another round, coward.'
  if (rate >= 0.7) return 'This friend group is a hive mind. Concerning.'
  if (rate >= 0.45) return 'Solid surveillance. Mostly. Nobody is safe.'
  if (rate >= 0.25) return 'Several friendships are now under review.'
  return 'Do you people even know each other?'
}
