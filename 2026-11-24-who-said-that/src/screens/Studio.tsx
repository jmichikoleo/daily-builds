// Custom deck studio: create, edit, preview, import and export decks (saved in this browser).
import { motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { LIMITS } from '../../shared/protocol.ts'
import { CHAOS_LEVELS } from '../../shared/questions.ts'
import { Btn, Tag, Window } from '../components/bits.tsx'
import { deleteDeck, exportDeck, importDecks, saveDeck, slug, useCustomDecks, validateDraft, type DraftDeck } from '../lib/customDecks.ts'

const COLORS = ['#FFD1D3', '#FFE9AE', '#DCCDF8', '#DCEBFC', '#DDEBCF', '#FFC9A8', '#CFF2EC', '#F9C6E0']
const ICONS = ['⭐', '🍕', '🎮', '👻', '🐸', '💅', '🧃', '🚨', '🫧', '🔥', '🎤', '🛸']

const blank = (): DraftDeck => ({ id: slug(), name: '', description: '', color: COLORS[0], icon: ICONS[0], questions: [{ id: slug(), text: '', chaos: 2 }] })

export function Studio() {
  const decks = useCustomDecks()
  const [draft, setDraft] = useState<DraftDeck>(blank)
  const [preview, setPreview] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const isSaved = decks.some((d) => d.id === draft.id)
  const filled = draft.questions.filter((q) => q.text.trim())
  const shown = filled[preview % Math.max(1, filled.length)]

  const setQ = (i: number, patch: Partial<DraftDeck['questions'][number]>) => setDraft({ ...draft, questions: draft.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) })

  const save = () => {
    const res = validateDraft(draft)
    if (!res.ok) {
      setErrors(res.errors)
      return
    }
    saveDeck(res.deck)
    setErrors([])
    setMsg(`saved “${res.deck.name}”. the host can switch it on in the lobby.`)
  }

  return (
    <div className="studio">
      <header className="library__head">
        <Tag>CARD CREATION STUDIO</Tag>
        <h1 className="display">Make your own deck</h1>
        <p>decks are saved in this browser only. when you host, switching one on sends it to the room for that session.</p>
      </header>
      <div className="studio__grid">
        <aside className="studio__list">
          <Window title="my_decks/" tone="yellow">
            <ul>
              {decks.map((d) => (
                <li key={d.id}>
                  <button className={`studio__deck ${draft.id === d.id ? 'on' : ''}`} onClick={() => setDraft({ ...d, description: d.description ?? '' })}>
                    <span className="custom-dot" style={{ background: d.color }}>
                      {d.icon}
                    </span>
                    {d.name} <span className="mono">({d.questions.length})</span>
                  </button>
                </li>
              ))}
              {decks.length === 0 && <li className="hint">no decks yet</li>}
            </ul>
            <div className="studio__listbtns">
              <Btn tone="pink" className="btn--sm" onClick={() => { setDraft(blank()); setErrors([]); setMsg(null) }}>
                + new deck
              </Btn>
              <Btn tone="cream" className="btn--sm" onClick={() => fileRef.current?.click()}>
                import json
              </Btn>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  if (f.size > 300_000) return setMsg('that file is too big for a deck.')
                  const res = importDecks(await f.text())
                  res.decks.forEach(saveDeck)
                  setMsg(`imported ${res.decks.length} deck(s)${res.errors ? `, skipped ${res.errors} invalid` : ''}.`)
                }}
              />
            </div>
          </Window>
        </aside>
        <section className="studio__edit">
          <Window title={`${draft.name || 'untitled'}.deck`} tone="pink">
            <div className="studio__meta">
              <label className="field">
                <span className="mono">deck name</span>
                <input value={draft.name} maxLength={32} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. the roommate files" />
              </label>
              <label className="field">
                <span className="mono">description</span>
                <input value={draft.description} maxLength={140} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="what is this deck about" />
              </label>
              <fieldset className="field">
                <legend className="mono">colour</legend>
                <div className="swatches">
                  {COLORS.map((c) => (
                    <button key={c} type="button" className={`swatch ${draft.color === c ? 'on' : ''}`} style={{ background: c }} aria-label={`colour ${c}`} aria-pressed={draft.color === c} onClick={() => setDraft({ ...draft, color: c })} />
                  ))}
                </div>
              </fieldset>
              <fieldset className="field">
                <legend className="mono">icon</legend>
                <div className="icon-row">
                  {ICONS.map((ic) => (
                    <button key={ic} type="button" className={`icon-pick ${draft.icon === ic ? 'on' : ''}`} aria-pressed={draft.icon === ic} aria-label={`icon ${ic}`} onClick={() => setDraft({ ...draft, icon: ic })}>
                      {ic}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            <h3 className="mono subhead">
              questions ({draft.questions.length}/{LIMITS.customQuestionsPerDeck})
            </h3>
            <ol className="studio__qs">
              {draft.questions.map((q, i) => (
                <li key={q.id}>
                  <label className="sr-only" htmlFor={`q-${q.id}`}>
                    Question {i + 1}
                  </label>
                  <textarea id={`q-${q.id}`} value={q.text} maxLength={LIMITS.customQuestionMax} rows={2} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="What would ___ never survive?" />
                  <label className="studio__chaos">
                    <span className="sr-only">chaos level</span>
                    <select value={q.chaos} onChange={(e) => setQ(i, { chaos: Number(e.target.value) })}>
                      {CHAOS_LEVELS.map((c) => (
                        <option key={c.level} value={c.level}>
                          {c.level} {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="mini danger" aria-label={`Delete question ${i + 1}`} onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                </li>
              ))}
            </ol>
            <div className="studio__actions">
              <Btn tone="cream" className="btn--sm" disabled={draft.questions.length >= LIMITS.customQuestionsPerDeck} onClick={() => setDraft({ ...draft, questions: [...draft.questions, { id: slug(), text: '', chaos: 2 }] })}>
                + add question
              </Btn>
              <Btn tone="cherry" onClick={save}>
                {isSaved ? 'save changes' : 'save deck'}
              </Btn>
              {isSaved && (
                <>
                  <Btn
                    tone="cream"
                    className="btn--sm"
                    onClick={() => {
                      const res = validateDraft(draft)
                      if (!res.ok) return setErrors(res.errors)
                      const blob = new Blob([exportDeck(res.deck)], { type: 'application/json' })
                      const a = document.createElement('a')
                      a.href = URL.createObjectURL(blob)
                      a.download = `${res.deck.name.replace(/\W+/g, '-').toLowerCase() || 'deck'}.json`
                      a.click()
                      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
                    }}
                  >
                    export json
                  </Btn>
                  <Btn
                    tone="cream"
                    className="btn--sm"
                    onClick={() => {
                      if (!confirm(`Delete “${draft.name}” from this browser?`)) return
                      deleteDeck(draft.id)
                      setDraft(blank())
                      setMsg('deck deleted.')
                    }}
                  >
                    delete deck
                  </Btn>
                </>
              )}
            </div>
            {errors.length > 0 && (
              <ul className="error" role="alert">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {msg && (
              <p className="mono hint" role="status">
                {msg}
              </p>
            )}
          </Window>
        </section>
        <aside className="studio__preview" aria-label="Card preview">
          <span className="mono">PREVIEW</span>
          <motion.button
            key={`${shown?.id}-${draft.color}`}
            className="qcard qcard--mini"
            style={{ '--deck': draft.color } as React.CSSProperties}
            initial={{ rotateY: 90 }}
            animate={{ rotateY: 0 }}
            onClick={() => setPreview((p) => p + 1)}
          >
            <span className="qcard__top">
              <span className="mono">{draft.icon} {draft.name || 'untitled deck'}</span>
              <span className="mono">LVL {shown?.chaos ?? '?'}</span>
            </span>
            <span className="qcard__text qcard__text--sm">{shown?.text || 'your question appears here'}</span>
            <span className="qcard__foot mono">tap for next card</span>
          </motion.button>
        </aside>
      </div>
    </div>
  )
}
