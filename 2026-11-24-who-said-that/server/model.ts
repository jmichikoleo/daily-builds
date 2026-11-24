// Internal (never sent as is) server state.
import { randomBytes, randomInt } from 'node:crypto'
import type { Question, RoundType } from '../shared/questions.ts'
import type { CustomDeck, FinalResults, GameSettings, Phase, PointLine, Reaction, RevealInfo, RoundSummary } from '../shared/protocol.ts'

export interface Clock {
  now(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const t = setTimeout(fn, ms)
    t.unref?.()
    return t
  },
  clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout),
}

export type Rng = () => number
export const cryptoRng: Rng = () => randomInt(0, 2 ** 32) / 2 ** 32

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const newId = (bytes = 9) => randomBytes(bytes).toString('base64url')

export interface Player {
  id: string
  token: string
  name: string
  avatar: number
  color: string
  role: 'player' | 'spectator'
  ready: boolean
  connected: boolean
  /** Gone for good (grace expired, left, kicked) but kept for records during a game. */
  left: boolean
  disconnectedAt: number | null
  joinedAt: number
  sockets: Set<string>
  graceTimer: unknown
}

export interface Submission {
  text: string | null
  passed: boolean
}

export interface Answer {
  id: string
  authorId: string
  text: string
  question: Question
  impersonating: string | null
  eligible: string[]
  votes: Map<string, string>
  reveal: RevealInfo | null
  reactions: number
}

export interface Round {
  index: number
  type: RoundType
  question: Question
  perPlayer: Map<string, Question> | null
  assignments: Map<string, string> | null
  participants: string[]
  submissions: Map<string, Submission>
  skipVotes: Set<string>
  skipUsed: boolean
  answers: Answer[]
  current: number
  multiplier: number
  summary: RoundSummary | null
  bonusDone: boolean
}

export interface LedgerEntry extends PointLine {
  key: string
  round: number
}

export interface Game {
  plan: RoundType[]
  rounds: Round[]
  used: Set<string>
  ledger: Map<string, LedgerEntry>
  reactionsSent: Map<string, number>
  reactionsReceived: Map<string, number>
  emojiUse: Map<string, Map<Reaction, number>>
  final: FinalResults | null
  startedWith: string[]
}

export interface RoomState {
  code: string
  createdAt: number
  lastActivity: number
  hostId: string
  players: Map<string, Player>
  order: string[]
  settings: GameSettings
  customDecks: CustomDeck[]
  phase: Phase
  pausedFrom: Phase | null
  pauseRemaining: number
  pauseReason: string | null
  step: number
  deadline: number | null
  game: Game | null
  recent: string[]
  gamesPlayed: number
  kickedTokens: Set<string>
}
