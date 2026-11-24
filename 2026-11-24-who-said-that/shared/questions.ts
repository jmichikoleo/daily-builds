// Question bank types shared by the server, the client and the tests.

export const DECK_IDS = [
  'petty',
  'chaos',
  'groupchat',
  'delulu',
  'thats-me',
  'fight-me',
  'never-leaving',
  'main-character',
  'out-of-context',
  'online',
] as const
export type BuiltInDeckId = (typeof DECK_IDS)[number]

/** Special prompts live in their own pool, not in a selectable deck. */
export const SPECIAL_POOL_ID = 'case-files'

export const ROUND_TYPES = [
  'classic',
  'identity-theft',
  'two-brain-cells',
  'wrong-answers',
  'alibi',
  'plot-twist',
  'pr-disaster',
  'complaints',
  'speed-demon',
  'unsent-message',
  'final-boss',
] as const
export type RoundType = (typeof ROUND_TYPES)[number]

/** Round types that draw from the ten normal decks. */
export const DECK_ROUND_TYPES = [
  'classic',
  'identity-theft',
  'two-brain-cells',
  'wrong-answers',
  'plot-twist',
  'speed-demon',
  'final-boss',
] as const satisfies readonly RoundType[]

/** Round types that draw from the special prompt pool. */
export const SPECIAL_POOL_ROUND_TYPES = [
  'alibi',
  'pr-disaster',
  'complaints',
  'unsent-message',
] as const satisfies readonly RoundType[]

export type ChaosLevel = 1 | 2 | 3 | 4 | 5

export const FAMILIARITY = ['strangers', 'friends', 'close'] as const
export type Familiarity = (typeof FAMILIARITY)[number]

/** What a deck file contains. The deck id is added when the bank is assembled. */
export interface DeckQuestion {
  id: string
  text: string
  chaos: ChaosLevel
  rounds: RoundType[]
  tags: string[]
  familiarity: Familiarity
  placeholder?: string
}

export interface Question extends DeckQuestion {
  deck: string
}

export interface DeckMeta {
  id: string
  number: string
  name: string
  blurb: string
  color: string
  ink: string
  icon: string
  pattern: 'dots' | 'stripes' | 'grid' | 'zigzag' | 'stars' | 'checker' | 'waves' | 'hearts' | 'plus' | 'scan'
}

export const CHAOS_LEVELS: { level: ChaosLevel; name: string; blurb: string }[] = [
  { level: 1, name: 'Innocent', blurb: 'safe for new friends and the coworker you just added' },
  { level: 2, name: 'Silly', blurb: 'absurd, creative, nobody gets hurt' },
  { level: 3, name: 'Chaotic', blurb: 'personal, petty, slightly unhinged' },
  { level: 4, name: 'Unfiltered', blurb: 'embarrassing confessions and romantic crimes' },
  { level: 5, name: 'Friendship on Trial', blurb: 'roasts and close friend chaos' },
]
