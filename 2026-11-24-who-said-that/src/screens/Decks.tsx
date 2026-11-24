import { useMemo, useState } from 'react'
import { DECKS, DECK_QUESTIONS, SPECIAL_QUESTIONS } from '../../shared/bank.ts'
import { CHAOS_LEVELS } from '../../shared/questions.ts'
import { ROUND_RULES } from '../../shared/protocol.ts'
import { Btn, Stamp, Tag } from '../components/bits.tsx'
import { DeckCard } from '../components/DeckCard.tsx'
import { useCustomDecks } from '../lib/customDecks.ts'
import { navigate } from '../lib/router.ts'

export function DeckLibrary() {
  const [open, setOpen] = useState<string>(DECKS[0].id)
  const [chaos, setChaos] = useState(5)
  const custom = useCustomDecks()
  const deck = DECKS.find((d) => d.id === open)
  const questions = useMemo(() => DECK_QUESTIONS.filter((q) => q.deck === open && q.chaos <= chaos), [open, chaos])
  return (
    <div className="library">
      <header className="library__head">
        <Tag>EVIDENCE ROOM · SHELF B</Tag>
        <h1 className="display">The deck library</h1>
        <p>
          {DECK_QUESTIONS.length} hand picked questions across ten decks, plus {SPECIAL_QUESTIONS.length} special round prompts. the host picks decks and a chaos level. the chaos level filters
          every deck.
        </p>
      </header>
      <div className="library__shelf" role="tablist" aria-label="Decks">
        {DECKS.map((d) => (
          <div key={d.id} className={`shelf-slot ${open === d.id ? 'on' : ''}`}>
            <button role="tab" aria-selected={open === d.id} className="shelf-btn" onClick={() => setOpen(d.id)}>
              <DeckCard deck={d} count={DECK_QUESTIONS.filter((q) => q.deck === d.id).length} />
            </button>
          </div>
        ))}
      </div>
      {deck && (
        <section className="library__open" role="tabpanel" style={{ '--deck': deck.color, '--deck-ink': deck.ink } as React.CSSProperties}>
          <header>
            <span className="library__icon" aria-hidden="true">
              {deck.icon}
            </span>
            <div>
              <span className="mono">DECK {deck.number}</span>
              <h2 className="display">{deck.name}</h2>
              <p>{deck.blurb}</p>
            </div>
            <Stamp rotate={8} tone="ink">
              {questions.length} shown
            </Stamp>
          </header>
          <div className="chaos chaos--compact" role="radiogroup" aria-label="Filter by chaos level">
            {CHAOS_LEVELS.map((c) => (
              <button key={c.level} role="radio" aria-checked={chaos === c.level} className={`chaos__lvl chaos__lvl--${c.level} ${chaos === c.level ? 'on' : ''}`} onClick={() => setChaos(c.level)}>
                <b>{c.level}</b>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
          <ol className="qlist">
            {questions.map((q) => (
              <li key={q.id}>
                <span className={`lvl lvl--${q.chaos}`} title={`chaos ${q.chaos}`}>
                  {q.chaos}
                </span>
                <span className="qlist__text">{q.text}</span>
                <span className="qlist__tags mono">
                  {q.rounds
                    .filter((r) => r !== 'classic')
                    .map((r) => ROUND_RULES[r].name)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="library__custom">
        <h2 className="section-title">Your custom decks</h2>
        {custom.length === 0 ? <p className="hint">no custom decks yet. inside jokes deserve their own deck.</p> : null}
        <ul className="custom-shelf">
          {custom.map((d) => (
            <li key={d.id} className="custom-deck" style={{ '--deck': d.color } as React.CSSProperties}>
              <span className="custom-deck__icon">{d.icon}</span>
              <b>{d.name}</b>
              <span className="mono">{d.questions.length} cards</span>
            </li>
          ))}
        </ul>
        <Btn tone="lavender" onClick={() => navigate('/studio')}>
          open the deck studio
        </Btn>
      </section>
    </div>
  )
}
