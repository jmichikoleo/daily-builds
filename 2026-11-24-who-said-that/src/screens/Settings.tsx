// Host control panel.
import { useEffect, useMemo, useRef, useState } from 'react'
import { DECKS, DECK_QUESTIONS } from '../../shared/bank.ts'
import { CHAOS_LEVELS, DECK_IDS, type ChaosLevel, type RoundType } from '../../shared/questions.ts'
import { DEFAULT_SETTINGS, LIMITS, QUICK_PLAY, ROUND_RULES, SPECIAL_TYPES, type GameSettings } from '../../shared/protocol.ts'
import { Btn, Window } from '../components/bits.tsx'
import { DeckCard } from '../components/DeckCard.tsx'
import { useCustomDecks } from '../lib/customDecks.ts'
import { navigate } from '../lib/router.ts'
import { send } from '../lib/store.ts'
import { useRoom } from './RoomScreen.tsx'

type Tab = 'quick' | 'decks' | 'rounds' | 'timers' | 'room'

export function SettingsPanel({ onError }: { onError: (e: string | null) => void }) {
  const { view } = useRoom()
  const s = view.settings
  const [tab, setTab] = useState<Tab>('quick')
  const [previewSeed, setPreviewSeed] = useState(0)
  const [ruleOpen, setRuleOpen] = useState<RoundType | null>(null)
  const myDecks = useCustomDecks()

  const update = async (patch: Partial<GameSettings>) => {
    const res = await send('room:update-settings', { settings: patch })
    onError(res.ok ? null : res.error)
  }

  const preview = useMemo(() => {
    const pool = DECK_QUESTIONS.filter((q) => q.chaos === s.chaos && (s.decks as string[]).includes(q.deck))
    const list = pool.length ? pool : DECK_QUESTIONS.filter((q) => q.chaos === s.chaos)
    return list[(previewSeed * 7919 + s.chaos * 31) % list.length]
  }, [s.chaos, s.decks, previewSeed])

  const activeCustom = new Set(view.customDecks.map((d) => d.id))
  const toggleCustom = async (id: string) => {
    const next = activeCustom.has(id) ? myDecks.filter((d) => activeCustom.has(d.id) && d.id !== id) : myDecks.filter((d) => activeCustom.has(d.id) || d.id === id)
    const res = await send('room:custom-decks', { decks: next.slice(0, LIMITS.customDeckMax) })
    onError(res.ok ? null : res.error)
  }

  const players = view.players.filter((p) => p.role === 'player' && p.connected)
  const ready = players.filter((p) => p.ready || p.isHost).length
  const canStart = players.length >= LIMITS.minPlayers

  return (
    <Window title="control_panel.exe" tone="lavender" className="settings">
      <div className="tabs" role="tablist" aria-label="Game settings">
        {(['quick', 'decks', 'rounds', 'timers', 'room'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="tabpanel" role="tabpanel">
        {tab === 'quick' && (
          <>
            <div className="preset-row">
              <Btn tone="yellow" className="btn--sm" onClick={() => update({ ...QUICK_PLAY })}>
                ⚡ quick play preset
              </Btn>
              <Btn tone="cream" className="btn--sm" onClick={() => update({ ...DEFAULT_SETTINGS })}>
                reset defaults
              </Btn>
            </div>
            <fieldset className="field">
              <legend className="mono">rounds</legend>
              <div className="seg">
                {[3, 5, 7, 10].map((n) => (
                  <button key={n} className={s.rounds === n ? 'on' : ''} aria-pressed={s.rounds === n} onClick={() => update({ rounds: n })}>
                    {n}
                  </button>
                ))}
                <label className="seg__custom">
                  <span className="sr-only">custom rounds</span>
                  <input type="number" min={1} max={20} value={s.rounds} onChange={(e) => update({ rounds: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
                </label>
              </div>
            </fieldset>
            <fieldset className="field">
              <legend className="mono">chaos level</legend>
              <div className="chaos">
                {CHAOS_LEVELS.map((c) => (
                  <button
                    key={c.level}
                    className={`chaos__lvl chaos__lvl--${c.level} ${s.chaos === c.level ? 'on' : ''}`}
                    aria-pressed={s.chaos === c.level}
                    onClick={() => {
                      update({ chaos: c.level as ChaosLevel })
                      setPreviewSeed((x) => x + 1)
                    }}
                  >
                    <b>{c.level}</b>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
              <p className="hint">{CHAOS_LEVELS[s.chaos - 1].blurb}. questions up to this level can appear.</p>
              {preview && (
                <button className="preview-card" onClick={() => setPreviewSeed((x) => x + 1)}>
                  <span className="mono">PREVIEW · LVL {s.chaos} · tap for another</span>
                  <span>{preview.text}</span>
                </button>
              )}
            </fieldset>
          </>
        )}
        {tab === 'decks' && (
          <>
            <div className="preset-row">
              <Btn tone="cream" className="btn--sm" onClick={() => update({ decks: [...DECK_IDS] })}>
                all decks
              </Btn>
              <Btn tone="cream" className="btn--sm" onClick={() => update({ decks: [] })}>
                none
              </Btn>
            </div>
            <div className="deck-picker">
              {DECKS.map((d) => {
                const on = (s.decks as string[]).includes(d.id)
                return (
                  <DeckCard
                    key={d.id}
                    deck={d}
                    small
                    selected={on}
                    count={DECK_QUESTIONS.filter((q) => q.deck === d.id && q.chaos <= s.chaos).length}
                    onToggle={() => update({ decks: on ? s.decks.filter((x) => x !== d.id) : [...s.decks, d.id as (typeof DECK_IDS)[number]] })}
                  />
                )
              })}
            </div>
            <h3 className="mono subhead">your custom decks</h3>
            <label className="check">
              <input type="checkbox" checked={s.customQuestions} onChange={(e) => update({ customQuestions: e.target.checked })} /> use custom questions
            </label>
            {myDecks.length === 0 && (
              <p className="hint">
                none saved in this browser yet.{' '}
                <button className="linkish" onClick={() => window.open('/studio', '_blank')}>
                  open the deck studio
                </button>
              </p>
            )}
            <ul className="custom-list">
              {myDecks.map((d) => (
                <li key={d.id}>
                  <label className="check">
                    <input type="checkbox" checked={activeCustom.has(d.id)} onChange={() => toggleCustom(d.id)} />
                    <span className="custom-dot" style={{ background: d.color }}>
                      {d.icon}
                    </span>
                    {d.name} <span className="mono">({d.questions.length})</span>
                  </label>
                </li>
              ))}
            </ul>
            {view.customDecks.length > 0 && <p className="hint">{view.customDecks.length} custom deck(s) sent to this room for this session only.</p>}
          </>
        )}
        {tab === 'rounds' && (
          <>
            <fieldset className="field">
              <legend className="mono">special round frequency</legend>
              <div className="seg">
                {(['off', 'sometimes', 'often', 'always'] as const).map((f) => (
                  <button key={f} className={s.specialFrequency === f ? 'on' : ''} aria-pressed={s.specialFrequency === f} onClick={() => update({ specialFrequency: f })}>
                    {f === 'off' ? 'classic only' : f}
                  </button>
                ))}
              </div>
              <p className="hint">special rounds are picked at random from the ones switched on. the first round stays classic unless set to always.</p>
            </fieldset>
            <ul className="special-list">
              {SPECIAL_TYPES.map((t) => {
                const on = s.specialTypes.includes(t)
                return (
                  <li key={t} className={on ? 'on' : ''}>
                    <label className="check">
                      <input type="checkbox" checked={on} onChange={() => update({ specialTypes: on ? s.specialTypes.filter((x) => x !== t) : [...s.specialTypes, t] })} />
                      <b>{ROUND_RULES[t].name}</b> <span className="mono">{ROUND_RULES[t].short}</span>
                    </label>
                    <button className="mini" aria-expanded={ruleOpen === t} onClick={() => setRuleOpen(ruleOpen === t ? null : t)} aria-label={`Preview ${ROUND_RULES[t].name} rules`}>
                      ?
                    </button>
                    {ruleOpen === t && <p className="rule-preview">{ROUND_RULES[t].rule}</p>}
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {tab === 'timers' && (
          <>
            <Slider label="answer timer" unit="s" min={20} max={180} step={5} value={s.answerSeconds} onChange={(v) => update({ answerSeconds: v })} />
            <Slider label="guess timer" unit="s" min={10} max={60} step={5} value={s.guessSeconds} onChange={(v) => update({ guessSeconds: v })} />
            <Slider label="reveal length" unit="s" min={5} max={30} step={1} value={s.revealSeconds} onChange={(v) => update({ revealSeconds: v })} />
            <Slider label="answer length" unit=" chars" min={40} max={280} step={10} value={s.answerLimit} onChange={(v) => update({ answerLimit: v })} />
          </>
        )}
        {tab === 'room' && (
          <>
            <fieldset className="field">
              <legend className="mono">after each round</legend>
              <div className="seg">
                <button className={s.progression === 'auto' ? 'on' : ''} aria-pressed={s.progression === 'auto'} onClick={() => update({ progression: 'auto' })}>
                  auto advance
                </button>
                <button className={s.progression === 'manual' ? 'on' : ''} aria-pressed={s.progression === 'manual'} onClick={() => update({ progression: 'manual' })}>
                  host advances
                </button>
              </div>
            </fieldset>
            <Toggle label="allow spectators (late joiners watch)" value={s.allowSpectators} onChange={(v) => update({ allowSpectators: v })} />
            <Toggle label="allow emoji reactions" value={s.allowReactions} onChange={(v) => update({ allowReactions: v })} />
            <Toggle label="sound effects for everyone" value={s.sound} onChange={(v) => update({ sound: v })} />
            <Toggle label="custom questions" value={s.customQuestions} onChange={(v) => update({ customQuestions: v })} />
            <button className="linkish" onClick={() => navigate('/how')}>
              scoring and rules
            </button>
          </>
        )}
      </div>
      <div className="settings__start">
        <span className="mono">
          {players.length} suspects · {ready}/{players.length} ready
        </span>
        <Btn
          tone="cherry"
          className="btn--xl"
          disabled={!canStart}
          onClick={async () => {
            if (ready < players.length && !confirm(`${players.length - ready} suspect(s) are not ready. Start anyway?`)) return
            const res = await send('game:start', {})
            onError(res.ok ? null : res.error)
          }}
        >
          {canStart ? 'Begin interrogation' : `need ${LIMITS.minPlayers - players.length} more suspect${LIMITS.minPlayers - players.length === 1 ? '' : 's'}`}
        </Btn>
      </div>
    </Window>
  )
}

function Slider({ label, unit, min, max, step, value, onChange }: { label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  // Local value while dragging or holding arrow keys; committed after a short pause so keys never fight the server echo.
  const [local, setLocal] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (local !== null && value === local) setLocal(null)
  }, [value, local])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const v = local ?? value
  return (
    <label className="field slider">
      <span className="mono">
        {label}: <b>{v}{unit}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => {
          const n = Number(e.target.value)
          setLocal(n)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => onChange(n), 350)
        }}
        onBlur={() => {
          // flush right away (e.g. the host taps Start straight after dragging)
          if (timer.current && local !== null) {
            clearTimeout(timer.current)
            timer.current = null
            onChange(local)
          }
        }}
      />
    </label>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  )
}
