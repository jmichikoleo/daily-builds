// Typed event contracts and state projections shared by server and client.
import { z } from 'zod'
import { DECK_IDS, ROUND_TYPES, type ChaosLevel, type RoundType } from './questions.ts'
import { AVATAR_COUNT, PLAYER_COLORS } from './avatars.ts'

export const LIMITS = {
  minPlayers: 3,
  maxPlayers: 12,
  maxSpectators: 8,
  nameMax: 16,
  answerMaxCap: 280,
  answerMinCap: 40,
  customDeckMax: 6,
  customQuestionsPerDeck: 80,
  customQuestionMax: 160,
  codeLength: 6,
} as const

export const PHASES = [
  'LOBBY',
  'QUESTION',
  'ANSWERING',
  'GUESSING',
  'REVEAL',
  'ROUND_RESULTS',
  'NEXT_ROUND',
  'FINAL_RESULTS',
  'PAUSED',
] as const
export type Phase = (typeof PHASES)[number]

export const SPECIAL_FREQUENCIES = ['off', 'sometimes', 'often', 'always'] as const
export type SpecialFrequency = (typeof SPECIAL_FREQUENCIES)[number]

export const REACTIONS = ['😂', '💀', '😱', '🔥', '🫠', '👀', '🤡', '❤️'] as const
export type Reaction = (typeof REACTIONS)[number]

// ---------- settings ----------

export const settingsSchema = z.object({
  rounds: z.number().int().min(1).max(20),
  answerSeconds: z.number().int().min(20).max(300),
  guessSeconds: z.number().int().min(10).max(120),
  revealSeconds: z.number().int().min(5).max(30),
  answerLimit: z.number().int().min(LIMITS.answerMinCap).max(LIMITS.answerMaxCap),
  decks: z.array(z.enum(DECK_IDS)).max(DECK_IDS.length),
  chaos: z.number().int().min(1).max(5),
  specialFrequency: z.enum(SPECIAL_FREQUENCIES),
  specialTypes: z.array(z.enum(ROUND_TYPES)).max(ROUND_TYPES.length),
  progression: z.enum(['auto', 'manual']),
  allowSpectators: z.boolean(),
  allowReactions: z.boolean(),
  sound: z.boolean(),
  customQuestions: z.boolean(),
})
export type GameSettings = Omit<z.infer<typeof settingsSchema>, 'chaos' | 'specialTypes'> & {
  chaos: ChaosLevel
  specialTypes: RoundType[]
}

export const SPECIAL_TYPES: RoundType[] = ROUND_TYPES.filter((t) => t !== 'classic')

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 5,
  answerSeconds: 75,
  guessSeconds: 25,
  revealSeconds: 11,
  answerLimit: 140,
  decks: [...DECK_IDS],
  chaos: 3,
  specialFrequency: 'sometimes',
  specialTypes: [...SPECIAL_TYPES],
  progression: 'auto',
  allowSpectators: true,
  allowReactions: true,
  sound: true,
  customQuestions: true,
}

export const QUICK_PLAY: Partial<GameSettings> = {
  rounds: 3,
  answerSeconds: 60,
  guessSeconds: 20,
  revealSeconds: 9,
  chaos: 2,
  specialFrequency: 'sometimes',
  progression: 'auto',
}

// ---------- custom decks ----------

const cleanText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(1).max(max))

export const customQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  text: cleanText(LIMITS.customQuestionMax),
  chaos: z.number().int().min(1).max(5),
})

export const customDeckSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: cleanText(32),
  description: z.string().max(140).default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().min(1).max(8),
  questions: z.array(customQuestionSchema).min(1).max(LIMITS.customQuestionsPerDeck),
})
export type CustomDeck = z.infer<typeof customDeckSchema>
export type CustomQuestion = z.infer<typeof customQuestionSchema>

// ---------- client -> server payloads ----------

export const nameSchema = cleanText(LIMITS.nameMax)
export const codeSchema = z
  .string()
  .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .pipe(z.string().length(LIMITS.codeLength))

export const profileSchema = z.object({
  name: nameSchema,
  avatar: z.number().int().min(0).max(AVATAR_COUNT - 1),
  color: z.enum(PLAYER_COLORS),
})
export type Profile = z.infer<typeof profileSchema>

export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,80}$/)

export const schemas = {
  'room:create': z.object({ profile: profileSchema }),
  'room:join': z.object({ code: codeSchema, profile: profileSchema }),
  'room:reconnect': z.object({ code: codeSchema, token: tokenSchema }),
  'room:leave': z.object({}),
  'room:update-settings': z.object({ settings: settingsSchema.partial() }),
  'room:custom-decks': z.object({ decks: z.array(customDeckSchema).max(LIMITS.customDeckMax) }),
  'room:kick': z.object({ playerId: z.string().min(1).max(40) }),
  'room:transfer-host': z.object({ playerId: z.string().min(1).max(40) }),
  'player:update-profile': z.object({ profile: profileSchema }),
  'player:ready': z.object({ ready: z.boolean() }),
  'game:start': z.object({}),
  'answer:submit': z.object({ step: z.number().int(), text: z.string().max(LIMITS.answerMaxCap * 2) }),
  'answer:unlock': z.object({ step: z.number().int() }),
  'answer:pass': z.object({ step: z.number().int() }),
  'answer:skip-request': z.object({ step: z.number().int() }),
  'guess:submit': z.object({ step: z.number().int(), suspectId: z.string().min(1).max(40) }),
  'round:advance': z.object({ step: z.number().int() }),
  'game:end': z.object({}),
  'game:rematch': z.object({}),
  'reaction:send': z.object({ emoji: z.enum(REACTIONS) }),
} as const

export type ClientEvent = keyof typeof schemas
export type Payload<E extends ClientEvent> = z.input<(typeof schemas)[E]>

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void

export interface JoinResult {
  code: string
  playerId: string
  token: string
}

// ---------- server -> client state ----------

export interface PublicPlayer {
  id: string
  name: string
  avatar: number
  color: string
  isHost: boolean
  ready: boolean
  connected: boolean
  role: 'player' | 'spectator'
  score: number
  /** Gone for good during this game (kept so results can still name them). */
  left: boolean
}

export interface CurrentAnswer {
  id: string
  index: number
  total: number
  text: string
  /** Only for plot twist rounds: the question this answer was written for. */
  question: string | null
  /** Only for identity theft rounds: whose style the writer was copying. */
  impersonating: string | null
  /** True only on the author's own screen. */
  youAreAuthor: boolean
  /** Who you may accuse (never yourself). Empty for the author and spectators. */
  suspects: string[]
  guessedCount: number
  eligibleCount: number
  myGuess: string | null
}

export interface PointLine {
  playerId: string
  amount: number
  reason: string
}

export interface RevealInfo {
  answerId: string
  text: string
  question: string | null
  authorId: string
  impersonating: string | null
  votes: { voterId: string; suspectId: string }[]
  distribution: { suspectId: string; count: number }[]
  correctVoters: string[]
  points: PointLine[]
  multiplier: number
  commentary: string
  eligibleCount: number
}

export interface RoundAnswerSummary {
  answerId: string
  authorId: string
  text: string
  question: string | null
  correct: number
  votes: number
}

export interface RoundSummary {
  round: number
  roundType: RoundType
  question: string
  leaderboard: { playerId: string; score: number; delta: number }[]
  answers: RoundAnswerSummary[]
  biggestDeception: { answerId: string; authorId: string; fooled: number } | null
  mostObvious: { answerId: string; authorId: string; correct: number; votes: number } | null
  mostSuspected: { playerId: string; wrongAccusations: number } | null
  recap: string[]
  passedCount: number
}

export interface Award {
  id: string
  title: string
  description: string
  winners: string[]
  stat: string
  badge: string
}

export interface FriendLine {
  friendId: string
  /** How often you identified this friend's answers. */
  youGotThem: { correct: number; total: number }
  /** How often this friend identified your answers. */
  theyGotYou: { correct: number; total: number }
}

export interface PlayerReport {
  playerId: string
  accuracy: { correct: number; total: number }
  predictability: { identified: number; total: number }
  friends: FriendLine[]
  mostConfused: { truthId: string; guessedId: string; count: number } | null
  bestDeception: { text: string; fooled: number; votes: number } | null
  blindSpot: { friendId: string; correct: number; total: number } | null
  soulmate: { friendId: string; rate: number; samples: number } | null
  reactions: { sent: number; received: number; favorite: string | null }
  commentary: string[]
  headline: string
}

export interface Moment {
  answerId: string
  authorId: string
  text: string
  question: string | null
  why: string
}

export interface FinalResults {
  leaderboard: { playerId: string; score: number; rank: number }[]
  awards: Award[]
  reports: Record<string, PlayerReport>
  matrix: { ids: string[]; cells: number[][] }
  moments: Moment[]
  group: {
    accuracy: { correct: number; total: number }
    answers: number
    rounds: number
    reactions: number
    verdict: string
  }
}

export interface GameView {
  round: number
  totalRounds: number
  roundType: RoundType
  rules: string
  question: { id: string; text: string; deck: string; placeholder: string | null } | null
  answerLimit: number
  submittedCount: number
  eligibleCount: number
  mine: { text: string | null; passed: boolean } | null
  impersonate: string | null
  skip: { votes: number; needed: number; mine: boolean; used: boolean }
  current: CurrentAnswer | null
  reveal: RevealInfo | null
  summary: RoundSummary | null
  final: FinalResults | null
  multiplier: number
}

export interface RoomView {
  code: string
  you: { id: string; role: 'player' | 'spectator'; isHost: boolean }
  players: PublicPlayer[]
  settings: GameSettings
  customDecks: { id: string; name: string; color: string; icon: string; count: number }[]
  phase: Phase
  pausedFrom: Phase | null
  pauseReason: string | null
  step: number
  deadline: number | null
  serverNow: number
  game: GameView | null
  gamesPlayed: number
}

export interface ReactionEvent {
  playerId: string
  emoji: Reaction
  at: number
}

export interface ServerToClient {
  'game:state': (view: RoomView) => void
  'reaction:new': (r: ReactionEvent) => void
  'game:error': (e: { message: string }) => void
  'room:kicked': (e: { message: string }) => void
}

export type AckFor<E extends ClientEvent> = E extends 'room:create' | 'room:join' | 'room:reconnect'
  ? Ack<JoinResult>
  : Ack

export type ClientToServer = {
  [E in ClientEvent]: (payload: Payload<E>, ack: AckFor<E>) => void
}

export const ROUND_RULES: Record<RoundType, { name: string; rule: string; short: string }> = {
  classic: {
    name: 'Classic',
    short: 'answer honestly-ish',
    rule: 'Everyone gets the same question. Answer anonymously, then figure out who wrote what.',
  },
  'identity-theft': {
    name: 'Identity Theft',
    short: 'answer as someone else',
    rule: 'You have been secretly assigned another suspect. Answer in their style. The group must catch the real writer, not the victim.',
  },
  'two-brain-cells': {
    name: 'Two Brain Cells',
    short: 'three words max',
    rule: 'Your answer can be three words at most. The server counts. It is not merciful.',
  },
  'wrong-answers': {
    name: 'Wrong Answers Only',
    short: 'be confidently wrong',
    rule: 'Give the most gloriously incorrect answer you can. Accuracy is a crime this round.',
  },
  alibi: {
    name: 'The Alibi',
    short: 'invent an excuse',
    rule: 'You stand accused of something ridiculous. Write your alibi. Make it airtight. Or at least damp.',
  },
  'plot-twist': {
    name: 'Plot Twist',
    short: 'everyone gets a different question',
    rule: 'Every suspect secretly gets a different question. During guessing you will see each answer next to its question.',
  },
  'pr-disaster': {
    name: 'PR Disaster',
    short: 'write the public apology',
    rule: 'You caused an absurd public incident. Write the official apology your publicist begged you not to post.',
  },
  complaints: {
    name: 'Anonymous Complaints',
    short: 'file a complaint about the group',
    rule: 'Submit a humorous complaint to group management. HR is a pixel cat. It cannot help you.',
  },
  'speed-demon': {
    name: 'Speed Demon',
    short: '10 seconds',
    rule: 'You have ten seconds. No drafts. No thoughts. Only instincts.',
  },
  'unsent-message': {
    name: 'Unsent Message',
    short: 'the text you would never send',
    rule: 'Write a fictional message you would absolutely never actually send. Drafts folder energy.',
  },
  'final-boss': {
    name: 'Final Boss',
    short: 'double points',
    rule: 'The last round. Every point counts twice. Friendships may not survive.',
  },
}

export function clampSettings(s: GameSettings): GameSettings {
  return { ...s, rounds: Math.max(1, Math.min(20, Math.round(s.rounds))) }
}
