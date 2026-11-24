// Personal custom decks, saved in this browser only.
import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { customDeckSchema, LIMITS, type CustomDeck } from '../../shared/protocol.ts'

const KEY = 'wst:custom-decks'
let decks: CustomDeck[] = load()
const listeners = new Set<() => void>()

function load(): CustomDeck[] {
  try {
    const parsed = z.array(customDeckSchema).safeParse(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(decks))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export const getDecks = () => decks
export function useCustomDecks() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => decks,
  )
}

export const slug = () => Math.random().toString(36).slice(2, 10)

export function saveDeck(d: CustomDeck) {
  decks = decks.some((x) => x.id === d.id) ? decks.map((x) => (x.id === d.id ? d : x)) : [...decks, d]
  persist()
}
export function deleteDeck(id: string) {
  decks = decks.filter((d) => d.id !== id)
  persist()
}

/** Loose draft type used by the editor (may be invalid while typing). */
export interface DraftDeck {
  id: string
  name: string
  description: string
  color: string
  icon: string
  questions: { id: string; text: string; chaos: number }[]
}

export function validateDraft(d: DraftDeck): { ok: true; deck: CustomDeck } | { ok: false; errors: string[] } {
  const cleaned = { ...d, questions: d.questions.filter((q) => q.text.trim().length > 0) }
  const res = customDeckSchema.safeParse(cleaned)
  if (res.success) return { ok: true, deck: res.data }
  return {
    ok: false,
    errors: res.error.issues.slice(0, 5).map((i) => {
      const path = i.path.join(' ')
      if (path === 'questions' && i.code === 'too_small') return 'Add at least one question.'
      if (path === 'name') return 'Give the deck a name (1 to 32 characters).'
      if (path.startsWith('questions')) return `Question ${Number(i.path[1]) + 1}: keep it 1 to ${LIMITS.customQuestionMax} characters.`
      return `${path || 'deck'}: ${i.message}`
    }),
  }
}

/** Import: accepts one deck or a list. Returns valid decks with fresh ids, plus error count. */
export function importDecks(text: string): { decks: CustomDeck[]; errors: number } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { decks: [], errors: 1 }
  }
  const list = Array.isArray(data) ? data : [data]
  const out: CustomDeck[] = []
  let errors = 0
  for (const item of list.slice(0, 20)) {
    const raw = item as Partial<DraftDeck>
    const res = customDeckSchema.safeParse({
      ...raw,
      id: slug(),
      description: typeof raw?.description === 'string' ? raw.description.slice(0, 140) : '',
      questions: Array.isArray(raw?.questions)
        ? raw.questions.slice(0, LIMITS.customQuestionsPerDeck).map((q, i) => ({ id: `q${i}-${slug()}`, text: String(q?.text ?? ''), chaos: Number(q?.chaos ?? 2) }))
        : [],
    })
    if (res.success) out.push(res.data)
    else errors++
  }
  return { decks: out, errors }
}

export function exportDeck(d: CustomDeck) {
  const { name, description, color, icon, questions } = d
  return JSON.stringify({ name, description, color, icon, questions: questions.map(({ text, chaos }) => ({ text, chaos })) }, null, 2)
}
