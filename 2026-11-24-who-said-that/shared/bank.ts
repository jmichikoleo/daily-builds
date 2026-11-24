// Assembles and validates the built in question bank.
import petty from '../data/decks/01-petty.ts'
import chaos from '../data/decks/02-chaos.ts'
import groupchat from '../data/decks/03-groupchat.ts'
import delulu from '../data/decks/04-delulu.ts'
import thatsMe from '../data/decks/05-thats-me.ts'
import fightMe from '../data/decks/06-fight-me.ts'
import neverLeaving from '../data/decks/07-never-leaving.ts'
import mainCharacter from '../data/decks/08-main-character.ts'
import outOfContext from '../data/decks/09-out-of-context.ts'
import online from '../data/decks/10-online.ts'
import caseFiles from '../data/decks/11-case-files.ts'
import {
  DECK_IDS,
  FAMILIARITY,
  ROUND_TYPES,
  SPECIAL_POOL_ID,
  SPECIAL_POOL_ROUND_TYPES,
  type DeckMeta,
  type DeckQuestion,
  type Question,
} from './questions.ts'

export const DECKS: DeckMeta[] = [
  { id: 'petty', number: '01', name: 'Chronically Petty', blurb: 'grudges, icks and imaginary arguments you won', color: '#FFD1D3', ink: '#B8324B', icon: '😤', pattern: 'zigzag' },
  { id: 'chaos', number: '02', name: 'No Thoughts, Just Chaos', blurb: 'absurd hypotheticals for your last brain cell', color: '#FFE9AE', ink: '#9A6A00', icon: '🌀', pattern: 'waves' },
  { id: 'groupchat', number: '03', name: 'The Group Chat Files', blurb: 'friend group dynamics, leaked', color: '#DCEBFC', ink: '#2F5F9E', icon: '💬', pattern: 'grid' },
  { id: 'delulu', number: '04', name: 'Delulu Department', blurb: 'romance, crushes and questionable logic', color: '#F9C6E0', ink: '#A3246B', icon: '💘', pattern: 'hearts' },
  { id: 'thats-me', number: '05', name: "Unfortunately, That's Me", blurb: 'self roasts and personality bugs', color: '#DDEBCF', ink: '#3F7A2E', icon: '🫠', pattern: 'dots' },
  { id: 'fight-me', number: '06', name: 'Fight Me', blurb: 'unpopular opinions, harmless hills to die on', color: '#FFC9A8', ink: '#B04A12', icon: '🥊', pattern: 'stripes' },
  { id: 'never-leaving', number: '07', name: 'Never Leaving This Room', blurb: 'confessions under the cone of silence', color: '#DCCDF8', ink: '#5B3BA8', icon: '🤫', pattern: 'checker' },
  { id: 'main-character', number: '08', name: 'Main Character Syndrome', blurb: 'villain arcs, reality shows and your biopic', color: '#FFF1A8', ink: '#8A5A00', icon: '🎬', pattern: 'stars' },
  { id: 'out-of-context', number: '09', name: 'Out of Context', blurb: 'finish the sentence, ruin your reputation', color: '#CFF2EC', ink: '#1F7A6C', icon: '✂️', pattern: 'plus' },
  { id: 'online', number: '10', name: 'Terminally Online', blurb: 'patch notes for your personality', color: '#D6E4FF', ink: '#3346A8', icon: '💾', pattern: 'scan' },
]

export const DECK_META: Record<string, DeckMeta> = Object.fromEntries(DECKS.map((d) => [d.id, d]))

const RAW: [string, DeckQuestion[]][] = [
  ['petty', petty],
  ['chaos', chaos],
  ['groupchat', groupchat],
  ['delulu', delulu],
  ['thats-me', thatsMe],
  ['fight-me', fightMe],
  ['never-leaving', neverLeaving],
  ['main-character', mainCharacter],
  ['out-of-context', outOfContext],
  ['online', online],
  [SPECIAL_POOL_ID, caseFiles],
]

export const ALL_QUESTIONS: Question[] = RAW.flatMap(([deck, qs]) => qs.map((q) => ({ ...q, deck })))
export const DECK_QUESTIONS = ALL_QUESTIONS.filter((q) => q.deck !== SPECIAL_POOL_ID)
export const SPECIAL_QUESTIONS = ALL_QUESTIONS.filter((q) => q.deck === SPECIAL_POOL_ID)
export const QUESTION_BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]))

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Returns a list of problems. Empty means the bank is valid. */
export function validateBank(questions: Question[]): string[] {
  const problems: string[] = []
  const ids = new Set<string>()
  const texts = new Map<string, string>()
  const validDecks = new Set<string>([...DECK_IDS, SPECIAL_POOL_ID])
  for (const q of questions) {
    if (!q.id) problems.push('question without id')
    if (ids.has(q.id)) problems.push(`duplicate id ${q.id}`)
    ids.add(q.id)
    if (!q.text || q.text.trim().length < 8) problems.push(`${q.id}: text missing or too short`)
    const key = normalise(q.text ?? '')
    const prev = texts.get(key)
    if (prev) problems.push(`${q.id}: duplicate of ${prev}`)
    texts.set(key, q.id)
    if (!validDecks.has(q.deck)) problems.push(`${q.id}: invalid deck ${q.deck}`)
    if (![1, 2, 3, 4, 5].includes(q.chaos)) problems.push(`${q.id}: invalid chaos ${q.chaos}`)
    if (!Array.isArray(q.rounds) || q.rounds.length === 0) problems.push(`${q.id}: no rounds`)
    for (const r of q.rounds ?? []) {
      if (!(ROUND_TYPES as readonly string[]).includes(r)) problems.push(`${q.id}: invalid round ${r}`)
      const special = (SPECIAL_POOL_ROUND_TYPES as readonly string[]).includes(r)
      if (special !== (q.deck === SPECIAL_POOL_ID)) problems.push(`${q.id}: round ${r} not allowed in deck ${q.deck}`)
    }
    if (!Array.isArray(q.tags) || q.tags.length === 0) problems.push(`${q.id}: no tags`)
    if (!(FAMILIARITY as readonly string[]).includes(q.familiarity)) problems.push(`${q.id}: invalid familiarity`)
    if (!q.id.startsWith(q.deck + '-')) problems.push(`${q.id}: id does not match deck ${q.deck}`)
  }
  return problems
}
