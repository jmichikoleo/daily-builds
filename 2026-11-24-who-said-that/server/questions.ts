// Question eligibility, selection and round planning.
import { DECK_QUESTIONS, SPECIAL_QUESTIONS } from '../shared/bank.ts'
import {
  DECK_ROUND_TYPES,
  SPECIAL_POOL_ROUND_TYPES,
  type ChaosLevel,
  type Question,
  type RoundType,
} from '../shared/questions.ts'
import type { CustomDeck, GameSettings } from '../shared/protocol.ts'
import { shuffle, type Rng } from './model.ts'

export const usesSpecialPool = (t: RoundType) => (SPECIAL_POOL_ROUND_TYPES as readonly string[]).includes(t)

export function customToQuestions(decks: CustomDeck[]): Question[] {
  return decks.flatMap((d) =>
    d.questions.map((q) => ({
      id: `custom:${d.id}:${q.id}`,
      text: q.text,
      deck: `custom:${d.id}`,
      chaos: q.chaos as ChaosLevel,
      rounds: [...DECK_ROUND_TYPES],
      tags: ['custom'],
      familiarity: 'friends' as const,
    })),
  )
}

/** Every question the room's settings allow for a round type, ignoring history. */
export function eligibleQuestions(settings: GameSettings, customDecks: CustomDeck[], type: RoundType): Question[] {
  const chaosOk = (q: Question) => q.chaos <= settings.chaos
  if (usesSpecialPool(type)) return SPECIAL_QUESTIONS.filter((q) => q.rounds.includes(type) && chaosOk(q))
  const decks = new Set<string>(settings.decks)
  const built = DECK_QUESTIONS.filter((q) => decks.has(q.deck) && chaosOk(q) && q.rounds.includes(type))
  const custom = settings.customQuestions ? customToQuestions(customDecks).filter(chaosOk) : []
  return [...built, ...custom]
}

function weight(q: Question, level: number) {
  if (q.chaos === level) return 4
  if (q.chaos === level - 1) return 2
  return 1
}

function weightedPick(items: Question[], level: number, rng: Rng): Question {
  const total = items.reduce((s, q) => s + weight(q, level), 0)
  let r = rng() * total
  for (const q of items) {
    r -= weight(q, level)
    if (r <= 0) return q
  }
  return items[items.length - 1]
}

export interface PickInput {
  settings: GameSettings
  customDecks: CustomDeck[]
  type: RoundType
  used: Set<string>
  recent: Set<string>
  count: number
  rng: Rng
}

/**
 * Picks `count` distinct questions. Never repeats a question within a game.
 * Falls back gracefully: drop recent history, then relax round compatibility, then chaos.
 */
export function pickQuestions(input: PickInput): Question[] {
  const { settings, customDecks, type, used, recent, count, rng } = input
  const tiers: Question[][] = []
  const base = eligibleQuestions(settings, customDecks, type)
  tiers.push(base.filter((q) => !used.has(q.id) && !recent.has(q.id)))
  tiers.push(base.filter((q) => !used.has(q.id)))
  if (!usesSpecialPool(type)) {
    const classic = eligibleQuestions(settings, customDecks, 'classic')
    tiers.push(classic.filter((q) => !used.has(q.id)))
    const anyDeck = DECK_QUESTIONS.filter((q) => q.chaos <= settings.chaos && !used.has(q.id))
    tiers.push(anyDeck)
    tiers.push(DECK_QUESTIONS.filter((q) => !used.has(q.id)))
  } else {
    tiers.push(SPECIAL_QUESTIONS.filter((q) => q.rounds.includes(type) && !used.has(q.id)))
  }
  const picked: Question[] = []
  const taken = new Set<string>()
  for (const tier of tiers) {
    let pool = tier.filter((q) => !taken.has(q.id))
    while (picked.length < count && pool.length > 0) {
      const q = weightedPick(pool, settings.chaos, rng)
      picked.push(q)
      taken.add(q.id)
      pool = pool.filter((x) => x.id !== q.id)
    }
    if (picked.length >= count) break
  }
  return picked
}

export const FREQUENCY_P: Record<GameSettings['specialFrequency'], number> = {
  off: 0,
  sometimes: 0.3,
  often: 0.6,
  always: 1,
}

/** Decides the round type of every round up front. */
export function planRounds(settings: GameSettings, rng: Rng): RoundType[] {
  const p = FREQUENCY_P[settings.specialFrequency]
  const enabled = settings.specialTypes.filter((t) => t !== 'classic' && t !== 'final-boss')
  const finalBoss = p > 0 && settings.specialTypes.includes('final-boss') && settings.rounds >= 2
  const plan: RoundType[] = []
  let bag: RoundType[] = shuffle(enabled, rng)
  for (let i = 0; i < settings.rounds; i++) {
    const last = i === settings.rounds - 1
    if (last && finalBoss) {
      plan.push('final-boss')
      continue
    }
    // Keep the first round classic unless every round must be special, so people learn the loop.
    const allowSpecial = enabled.length > 0 && (i > 0 || p === 1)
    if (allowSpecial && rng() < p) {
      if (bag.length === 0) bag = shuffle(enabled, rng)
      let t = bag.shift()!
      if (t === plan[plan.length - 1] && bag.length > 0) {
        bag.push(t)
        t = bag.shift()!
      }
      plan.push(t)
    } else plan.push('classic')
  }
  return plan
}

/** Each player impersonates someone else (a random derangement). */
export function assignImpersonations(ids: string[], rng: Rng): Map<string, string> {
  if (ids.length < 2) return new Map()
  const order = shuffle(ids, rng)
  const map = new Map<string, string>()
  order.forEach((id, i) => map.set(id, order[(i + 1) % order.length]))
  return map
}

export const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
