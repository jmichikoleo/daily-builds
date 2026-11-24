// In game screens. Everything shown here comes from the server's per player projection.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DECK_META } from '../../shared/bank.ts'
import { ROUND_RULES } from '../../shared/protocol.ts'
import { Btn, CaseNo, Envelope, Stamp, Tag, Timer, useRemaining } from '../components/bits.tsx'
import { Confetti } from '../components/Confetti.tsx'
import { PixelAvatar } from '../components/PixelAvatar.tsx'
import { Mugshot } from '../components/Suspect.tsx'
import { sfx } from '../lib/sound.ts'
import { send } from '../lib/store.ts'
import { useRoom } from './RoomScreen.tsx'

const LETTERS = 'ABCDEFGHIJKLMNOP'

function deckLabel(deck: string, customName?: string) {
  if (deck.startsWith('custom:')) return customName ?? 'Custom deck'
  if (deck === 'case-files') return 'Case Files'
  return DECK_META[deck]?.name ?? deck
}

function RoundBadge() {
  const { view } = useRoom()
  const g = view.game!
  const special = g.roundType !== 'classic'
  return (
    <div className="roundbadge">
      <span className="mono">
        ROUND {g.round}/{g.totalRounds}
      </span>
      <span className={`roundbadge__type ${special ? 'roundbadge__type--special' : ''}`}>{ROUND_RULES[g.roundType].name}</span>
      {g.multiplier > 1 && <span className="roundbadge__x">×{g.multiplier} points</span>}
    </div>
  )
}

function useError() {
  const [error, setError] = useState<string | null>(null)
  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p
    setError(r.ok ? null : (r.error ?? 'failed'))
    return r.ok
  }
  return { error, run, setError }
}

// ---------- QUESTION ----------

export function QuestionCard() {
  const { view } = useRoom()
  const g = view.game!
  const q = g.question
  const custom = view.customDecks.find((d) => q?.deck === `custom:${d.id}`)
  const special = g.roundType !== 'classic'
  return (
    <div className="stage stage--question">
      <RoundBadge />
      <div className="qcard-wrap">
        <motion.div
          className={`qcard ${special ? 'qcard--special' : ''}`}
          initial={{ rotateY: 180, scale: 0.6, y: 80 }}
          animate={{ rotateY: 0, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 140, damping: 16 }}
          style={{ '--deck': q && DECK_META[q.deck]?.color } as React.CSSProperties}
        >
          <div className="qcard__top">
            <span className="mono">{q ? deckLabel(q.deck, custom?.name) : 'Plot Twist'}</span>
            <CaseNo seed={q?.id ?? String(g.round)} />
          </div>
          {special && (
            <div className="qcard__special">
              <Stamp tone="cherry" rotate={-6} animate>
                {ROUND_RULES[g.roundType].name}
              </Stamp>
              <p>{g.rules}</p>
            </div>
          )}
          <p className="qcard__text">{g.roundType === 'plot-twist' ? 'Everyone is getting a different question. Shh.' : (q?.text ?? '')}</p>
          <span className="qcard__foot mono">get ready to answer…</span>
        </motion.div>
      </div>
    </div>
  )
}

// ---------- ANSWERING ----------

export function Answering() {
  const { view, me, name, byId } = useRoom()
  const g = view.game!
  const [text, setText] = useState(g.mine?.text ?? '')
  const { error, run, setError } = useError()
  const locked = !!g.mine
  const participant = me.role === 'player' && !(g.roundType === 'plot-twist' && g.question === null)
  const limit = g.answerLimit
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const twoBrain = g.roundType === 'two-brain-cells'
  const tooLong = text.length > limit || (twoBrain && words > 3)
  const target = g.impersonate ? byId.get(g.impersonate) : null
  const total = (g.roundType === 'speed-demon' ? 10 : view.settings.answerSeconds) * 1000
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!locked) area.current?.focus({ preventScroll: true })
  }, [locked])

  const submit = async () => {
    if (!text.trim() || tooLong) return
    if (await run(send('answer:submit', { step: view.step, text }))) sfx('submit')
  }

  if (me.role === 'spectator' || !participant)
    return (
      <div className="stage stage--answer">
        <RoundBadge />
        <div className="witness">
          <Tag>WITNESS MODE</Tag>
          <p className="qcard__text qcard__text--sm">{g.question?.text ?? 'Everyone got a different question this round.'}</p>
          <p className="mono">
            {g.submittedCount}/{g.eligibleCount} anonymous tips received
          </p>
          <Timer deadline={view.deadline} total={total} />
          <p className="hint">you joined mid case. you will be a suspect next game.</p>
        </div>
      </div>
    )

  return (
    <div className="stage stage--answer">
      <div className="answer-head">
        <RoundBadge />
        <Timer deadline={view.deadline} total={total} tick />
      </div>
      <div className="composer-layout">
        <div className="composer-q">
          <Tag>{g.roundType === 'plot-twist' ? 'YOUR SECRET QUESTION' : 'QUESTION'}</Tag>
          <p className="qcard__text qcard__text--sm">{g.question?.text}</p>
          {g.roundType !== 'classic' && <p className="rules-strip">{g.rules}</p>}
          {target && (
            <div className="impersonate" aria-live="polite">
              <PixelAvatar avatar={target.avatar} color={target.color} size={44} />
              <span>
                you are secretly answering as <b>{name(target.id)}</b>. copy their vibe.
              </span>
            </div>
          )}
        </div>
        <div className={`composer ${locked ? 'composer--locked' : ''}`}>
          <div className="composer__bar">
            <span>anonymous_tip.txt</span>
            <span className="mono">to: the group · from: ████</span>
          </div>
          {!locked ? (
            <>
              <label htmlFor="answer" className="sr-only">
                Your anonymous answer
              </label>
              <textarea
                id="answer"
                ref={area}
                className="composer__text"
                value={text}
                maxLength={limit + 20}
                placeholder={g.question?.placeholder ?? (twoBrain ? 'three words. max.' : 'type your answer. nobody will know. yet.')}
                onChange={(e) => {
                  setText(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit()
                }}
                rows={4}
                aria-describedby="answer-count"
              />
              <div className="composer__foot">
                <span id="answer-count" className={`mono counter ${tooLong ? 'counter--over' : ''}`} aria-live="polite">
                  {twoBrain ? `${words}/3 words · ` : ''}
                  {text.length}/{limit}
                </span>
                <Btn tone="cherry" onClick={submit} disabled={!text.trim() || tooLong}>
                  seal &amp; send
                </Btn>
              </div>
            </>
          ) : (
            <div className="sealed">
              <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
                <Envelope sealed />
              </motion.div>
              <div>
                {g.mine?.passed ? (
                  <p>
                    <b>you pleaded the fifth.</b> nobody will know you passed.
                  </p>
                ) : (
                  <>
                    <p className="mono">SEALED AND DELIVERED</p>
                    <p className="sealed__text">“{g.mine?.text}”</p>
                  </>
                )}
                <Btn
                  tone="cream"
                  className="btn--sm"
                  onClick={async () => {
                    if (!g.mine?.passed) setText(g.mine?.text ?? '')
                    await run(send('answer:unlock', { step: view.step }))
                  }}
                >
                  {g.mine?.passed ? 'actually, let me answer' : 'unseal to edit'}
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="answer-status">
        <div className="inbox" aria-label={`${g.submittedCount} of ${g.eligibleCount} answers received`}>
          {Array.from({ length: g.eligibleCount }, (_, i) => (
            <span key={i} className={`inbox__slot ${i < g.submittedCount ? 'in' : ''}`} aria-hidden="true">
              <Envelope sealed={i < g.submittedCount} />
            </span>
          ))}
          <span className="mono">
            {g.submittedCount}/{g.eligibleCount} tips in
          </span>
        </div>
        <div className="answer-status__opts">
          {!locked && (
            <Btn tone="cream" className="btn--sm" onClick={() => run(send('answer:pass', { step: view.step }))}>
              plead the fifth (pass)
            </Btn>
          )}
          {!g.skip.used && (
            <Btn tone="cream" className="btn--sm" disabled={g.skip.mine} onClick={() => run(send('answer:skip-request', { step: view.step }))}>
              {g.skip.mine ? 'skip requested' : 'request another question'} · {g.skip.votes}/{g.skip.needed}
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- GUESSING ----------

export function Guessing() {
  const { view, me, byId, name } = useRoom()
  const g = view.game!
  const cur = g.current!
  const [pick, setPick] = useState<string | null>(cur.myGuess)
  const { error, run } = useError()
  const locked = !!cur.myGuess
  const canVote = cur.suspects.length > 0
  const impersonated = cur.impersonating ? byId.get(cur.impersonating) : null

  return (
    <div className="stage stage--guess">
      <div className="answer-head">
        <RoundBadge />
        <span className="mono">
          EVIDENCE {cur.index + 1} OF {cur.total}
        </span>
        <Timer deadline={view.deadline} total={view.settings.guessSeconds * 1000} tick={canVote && !locked} />
      </div>
      <div className="evidence-wrap">
        <motion.article className="evidence" initial={{ y: -40, rotate: -6, opacity: 0 }} animate={{ y: 0, rotate: -1.5, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
          <span className="evidence__hole" aria-hidden="true" />
          <span className="evidence__label mono">EXHIBIT {LETTERS[cur.index]}</span>
          {cur.question && <p className="evidence__q">Q: {cur.question}</p>}
          {impersonated && (
            <p className="evidence__imp mono">
              written in the style of <b>{impersonated.name}</b>
            </p>
          )}
          <p className="evidence__text">{cur.text}</p>
          <span className="evidence__foot mono">who said that?</span>
        </motion.article>
      </div>
      {cur.youAreAuthor ? (
        <div className="author-wait" role="status">
          <p className="display">act natural.</p>
          <p>this is your answer. you cannot vote on it. maintain a neutral facial expression in the call.</p>
          <p className="mono">
            {cur.guessedCount}/{cur.eligibleCount} detectives have voted
          </p>
        </div>
      ) : !canVote ? (
        <div className="author-wait" role="status">
          <p className="mono">WITNESS MODE · {cur.guessedCount}/{cur.eligibleCount} votes in</p>
        </div>
      ) : (
        <>
          <fieldset className="lineup-pick" disabled={locked}>
            <legend className="sr-only">Who wrote this answer?</legend>
            {cur.suspects.map((id, i) => {
              const p = byId.get(id)
              if (!p) return null
              const on = pick === id
              return (
                <button
                  key={id}
                  type="button"
                  className={`pick ${on ? 'pick--on' : ''} ${locked && on ? 'pick--locked' : ''}`}
                  aria-pressed={on}
                  style={{ '--c': p.color, '--tilt': `${[-2, 1.5, -1, 2.5, -2.5, 1][i % 6]}deg` } as React.CSSProperties}
                  onClick={() => {
                    setPick(id)
                    sfx('pop')
                  }}
                >
                  <PixelAvatar avatar={p.avatar} color={p.color} size={56} />
                  <span className="pick__name">{p.name}</span>
                  {on && <span className="pick__mark" aria-hidden="true">{locked ? 'ACCUSED' : '?'}</span>}
                </button>
              )
            })}
          </fieldset>
          <div className="guess-foot">
            <span className="mono">
              {cur.guessedCount}/{cur.eligibleCount} votes in
            </span>
            {locked ? (
              <span className="locked-note">
                accusation filed against <b>{name(cur.myGuess!)}</b>
              </span>
            ) : (
              <Btn
                tone="cherry"
                className="btn--xl"
                disabled={!pick}
                onClick={async () => {
                  if (pick && (await run(send('guess:submit', { step: view.step, suspectId: pick })))) sfx('lock')
                }}
              >
                {pick ? `accuse ${name(pick)}` : 'pick a suspect'}
              </Btn>
            )}
          </div>
        </>
      )}
      {me.role === 'spectator' && <p className="hint">you are watching this case as a witness.</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// ---------- REVEAL ----------

export function Reveal() {
  const { view, me, byId, name, isHost } = useRoom()
  const g = view.game!
  const rev = g.reveal!
  const reduce = useReducedMotion()
  const total = view.settings.revealSeconds * 1000
  const remaining = useRemaining(view.deadline)
  const [mountElapsed] = useState(() => Math.max(0, total - remaining))
  const [t, setT] = useState(reduce ? 99_000 : mountElapsed)
  useEffect(() => {
    if (reduce) return
    const start = performance.now() - mountElapsed
    let raf = 0
    const loop = () => {
      setT(performance.now() - start)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduce, mountElapsed])

  // Timeline scaled so short reveal settings still fit.
  const scale = Math.min(1, total / 11_000)
  const STAGE_VOTES = 0
  const STAGE_SUSPENSE = 1500 * scale
  const STAGE_OPEN = 3000 * scale
  const STAGE_POINTS = 4300 * scale
  const stage = t >= STAGE_POINTS ? 3 : t >= STAGE_OPEN ? 2 : t >= STAGE_SUSPENSE ? 1 : STAGE_VOTES

  const author = byId.get(rev.authorId)
  const myVote = rev.votes.find((v) => v.voterId === me.id)
  const iWasRight = myVote && myVote.suspectId === rev.authorId
  const isAuthor = rev.authorId === me.id
  const maxCount = Math.max(1, ...rev.distribution.map((d) => d.count))
  const nobody = rev.correctVoters.length === 0 && rev.votes.length >= 2
  const everyone = rev.votes.length >= 2 && rev.correctVoters.length === rev.votes.length

  const played = useRef(new Set<number>())
  useEffect(() => {
    if (!view.settings.sound || played.current.has(stage)) return
    played.current.add(stage)
    if (stage === 2) {
      sfx('stamp')
      if (myVote) setTimeout(() => sfx(iWasRight ? 'correct' : 'wrong'), 250)
      else if (isAuthor) setTimeout(() => sfx(nobody ? 'correct' : 'pop'), 250)
    }
  }, [stage, myVote, iWasRight, isAuthor, nobody, view.settings.sound])

  const groups = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const v of rev.votes) m.set(v.suspectId, [...(m.get(v.suspectId) ?? []), v.voterId])
    return m
  }, [rev.votes])

  return (
    <div className="stage stage--reveal">
      <div className="answer-head">
        <RoundBadge />
        <span className="mono">CASE FILE {g.current ? g.current.index + 1 : ''}</span>
      </div>
      <div className="reveal-grid">
        <section className="votes-board" aria-label="Vote distribution">
          <h2 className="mono">THE ACCUSATIONS</h2>
          <p className="reveal-answer">“{rev.text}”</p>
          {rev.question && <p className="evidence__q">Q: {rev.question}</p>}
          {rev.votes.length === 0 && <p className="hint">no votes were cast. the case went cold.</p>}
          <ul className="bars">
            {rev.distribution.map((d, i) => {
              const p = byId.get(d.suspectId)
              const correct = d.suspectId === rev.authorId
              return (
                <motion.li
                  key={d.suspectId}
                  className={`bar ${stage >= 2 ? (correct ? 'bar--right' : 'bar--wrong') : ''}`}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduce ? 0 : i * 0.15 }}
                >
                  <span className="bar__who">
                    {p && <PixelAvatar avatar={p.avatar} color={p.color} size={28} />}
                    {name(d.suspectId)}
                  </span>
                  <span className="bar__track">
                    <motion.span
                      className="bar__fill"
                      style={{ background: p?.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(d.count / maxCount) * 100}%` }}
                      transition={{ delay: reduce ? 0 : 0.2 + i * 0.15, duration: reduce ? 0 : 0.6 }}
                    />
                  </span>
                  <span className="bar__n mono">{d.count}</span>
                  <span className="bar__voters" aria-label={`voted by ${(groups.get(d.suspectId) ?? []).map(name).join(', ')}`}>
                    {(groups.get(d.suspectId) ?? []).map((v) => {
                      const vp = byId.get(v)
                      return vp ? <PixelAvatar key={v} avatar={vp.avatar} color={vp.color} size={18} title={vp.name} /> : null
                    })}
                  </span>
                </motion.li>
              )
            })}
          </ul>
        </section>

        <section className="casefile" aria-live="polite">
          <div className={`folder ${stage >= 2 ? 'folder--open' : ''} ${stage === 1 ? 'folder--shake' : ''}`}>
            <div className="folder__tab mono">CONFIDENTIAL · AUTHOR</div>
            <div className="folder__front" aria-hidden={stage >= 2}>
              <span className="display">{stage === 0 ? 'votes are in' : 'opening the file…'}</span>
              <Stamp tone="cherry" rotate={-10}>
                Top secret
              </Stamp>
            </div>
            <AnimatePresence>
              {stage >= 2 && author && (
                <motion.div className="folder__inside" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
                  <span className="mono">THE AUTHOR WAS</span>
                  <Mugshot player={author} size={120} className="mugshot--big" />
                  <motion.span className="author-name display" initial={{ scale: 2.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 16, delay: 0.1 }}>
                    {author.name}
                  </motion.span>
                  {rev.impersonating && <span className="mono">disguised as {name(rev.impersonating)}</span>}
                  <Stamp tone={nobody ? 'green' : everyone ? 'ink' : 'cherry'} rotate={-12} animate className="verdict-stamp">
                    {nobody ? 'Untouchable' : everyone ? 'Busted' : 'Case closed'}
                  </Stamp>
                  {myVote && <p className={`you-were ${iWasRight ? 'right' : 'wrong'}`}>{iWasRight ? 'you cracked it ✓' : `you accused ${name(myVote.suspectId)} ✗`}</p>}
                  {isAuthor && <p className="you-were right">{nobody ? 'nobody suspected you. iconic.' : `${rev.correctVoters.length} of ${rev.votes.length} saw through you`}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <section className={`points ${stage >= 3 ? 'points--in' : ''}`} aria-label="Points awarded">
          {stage >= 3 && (
            <>
              <motion.p className="bubble" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                {rev.commentary}
              </motion.p>
              <ul className="pointlist">
                {rev.points.length === 0 && <li className="hint">no points on this one.</li>}
                {rev.points.map((p, i) => (
                  <motion.li key={`${p.playerId}-${i}`} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: reduce ? 0 : i * 0.08 }}>
                    <b className="mono">+{p.amount}</b> {name(p.playerId)} <span>{p.reason}</span>
                  </motion.li>
                ))}
              </ul>
              {rev.multiplier > 1 && <p className="mono hint">final boss · every point doubled</p>}
              <p className="mono hint">
                +100 correct guess · +50 per detective fooled · +150 if nobody got you (2+ votes)
              </p>
            </>
          )}
        </section>
      </div>
      {stage >= 2 && (nobody || iWasRight) && <Confetti count={nobody ? 70 : 36} />}
      {isHost && stage >= 3 && (
        <div className="host-row">
          <Btn tone="cream" className="btn--sm" onClick={() => send('round:advance', { step: view.step })}>
            next evidence →
          </Btn>
        </div>
      )}
    </div>
  )
}

// ---------- ROUND RESULTS ----------

export function RoundResults() {
  const { view, byId, name, isHost } = useRoom()
  const g = view.game!
  const s = g.summary!
  const manual = view.settings.progression === 'manual'
  const remaining = useRemaining(view.deadline)
  const last = g.round >= g.totalRounds
  return (
    <div className="stage stage--results">
      <article className="tabloid">
        <header className="tabloid__mast">
          <span className="mono">VOL. {g.round} · ROUND {s.round} EDITION · {ROUND_RULES[s.roundType].name.toUpperCase()}</span>
          <h1 className="tabloid__name">The Daily Suspect</h1>
          <span className="mono">all the gossip that fits, and some that doesn't</span>
        </header>
        <h2 className="tabloid__headline">{s.recap[0] ?? 'Investigation continues'}</h2>
        <div className="tabloid__cols">
          <section className="tabloid__board">
            <h3 className="mono">STANDINGS</h3>
            <ol className="standings">
              {s.leaderboard.map((l, i) => {
                const p = byId.get(l.playerId)
                return (
                  <motion.li key={l.playerId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <span className="standings__rank mono">{i + 1}</span>
                    {p && <PixelAvatar avatar={p.avatar} color={p.color} size={30} />}
                    <span className="standings__name">{name(l.playerId)}</span>
                    {l.delta > 0 && <span className="standings__delta mono">+{l.delta}</span>}
                    <span className="standings__score mono">{l.score}</span>
                  </motion.li>
                )
              })}
            </ol>
          </section>
          <section className="tabloid__stories">
            {s.biggestDeception && (
              <div className="story story--pink">
                <span className="mono">BIGGEST DECEPTION</span>
                <b>{name(s.biggestDeception.authorId)}</b> fooled {s.biggestDeception.fooled}
              </div>
            )}
            {s.mostObvious && (
              <div className="story story--yellow">
                <span className="mono">MOST OBVIOUS</span>
                <b>{name(s.mostObvious.authorId)}</b> caught by {s.mostObvious.correct}/{s.mostObvious.votes}
              </div>
            )}
            {s.mostSuspected && (
              <div className="story story--blue">
                <span className="mono">MOST WRONGLY SUSPECTED</span>
                <b>{name(s.mostSuspected.playerId)}</b> accused {s.mostSuspected.wrongAccusations}× for nothing
              </div>
            )}
            <ul className="recap">
              {s.recap.slice(1).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        </div>
        {s.answers.length > 0 && (
          <section className="tabloid__answers">
            <h3 className="mono">THE EVIDENCE, DECLASSIFIED</h3>
            <ul>
              {s.answers.map((a) => (
                <li key={a.answerId}>
                  “{a.text}” <span className="mono">by {name(a.authorId)} · {a.correct}/{a.votes} caught</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      <div className="host-row">
        {isHost ? (
          <Btn tone="cherry" className="btn--xl" onClick={() => send('round:advance', { step: view.step })}>
            {last ? 'to the award ceremony →' : 'next round →'}
          </Btn>
        ) : (
          <span className="mono hint">{manual ? 'waiting for the host to continue…' : ''}</span>
        )}
        {!manual && <span className="mono hint">{last ? 'ceremony' : 'next round'} in {Math.ceil(remaining / 1000)}s</span>}
      </div>
    </div>
  )
}

export function NextRound() {
  const { view } = useRoom()
  const g = view.game!
  return (
    <div className="stage stage--next">
      <motion.div className="next-card" initial={{ scale: 0.3, rotate: -20 }} animate={{ scale: 1, rotate: -3 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
        <span className="mono">INCOMING</span>
        <span className="display">Round {g.round + 1}</span>
        {g.round + 1 === g.totalRounds && <span className="mono">final round</span>}
      </motion.div>
    </div>
  )
}

export function Paused() {
  const { view, isHost } = useRoom()
  return (
    <div className="screen center-card">
      <div className="notice">
        <Stamp tone="ink">On hold</Stamp>
        <p>{view.pauseReason}</p>
        <p className="mono hint">share the room code {view.code} to bring suspects back. the game resumes on its own.</p>
        {isHost && (
          <Btn tone="yellow" onClick={() => send('game:end', {})}>
            end the game and show results
          </Btn>
        )}
      </div>
    </div>
  )
}
