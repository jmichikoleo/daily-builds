// Award ceremony, Friendship Intelligence Report and shareable cards.
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { Award, PlayerReport } from '../../shared/protocol.ts'
import { Badge } from '../components/Badges.tsx'
import { Btn, Stamp, Tag } from '../components/bits.tsx'
import { Confetti } from '../components/Confetti.tsx'
import { PixelAvatar } from '../components/PixelAvatar.tsx'
import { Mugshot } from '../components/Suspect.tsx'
import { download, groupCard, playerCard } from '../lib/shareCard.ts'
import { leaveRoom, send } from '../lib/store.ts'
import { navigate } from '../lib/router.ts'
import { useRoom } from './RoomScreen.tsx'

type Tab = 'ceremony' | 'report' | 'share'
const pct = (c: number, t: number) => (t ? `${Math.round((c / t) * 100)}%` : 'n/a')

export function Final() {
  const { view, me, isHost } = useRoom()
  const final = view.game!.final!
  const [tab, setTab] = useState<Tab>('ceremony')
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="stage stage--final">
      <Confetti count={60} />
      <div className="tabs tabs--big" role="tablist" aria-label="Results">
        {(
          [
            ['ceremony', 'award ceremony'],
            ['report', 'intelligence report'],
            ['share', 'share results'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'ceremony' && <Ceremony />}
      {tab === 'report' && <Report initial={final.reports[me.id] ? me.id : final.leaderboard[0]?.playerId} />}
      {tab === 'share' && <Share />}
      <div className="host-row host-row--final">
        {isHost ? (
          <Btn
            tone="cherry"
            className="btn--xl"
            onClick={async () => {
              const r = await send('game:rematch', {})
              setErr(r.ok ? null : r.error)
            }}
          >
            rematch, same suspects →
          </Btn>
        ) : (
          <span className="mono hint">waiting for the host to call a rematch…</span>
        )}
        <Btn
          tone="cream"
          onClick={async () => {
            await leaveRoom()
            navigate('/')
          }}
        >
          leave room
        </Btn>
        {err && <span className="error">{err}</span>}
      </div>
    </div>
  )
}

function Ceremony() {
  const { view, byId, name } = useRoom()
  const final = view.game!.final!
  const podium = final.leaderboard.slice(0, 3)
  const order = [podium[1], podium[0], podium[2]].filter(Boolean)
  return (
    <div className="ceremony">
      <header className="ceremony__head">
        <Tag>THE {final.group.rounds} ROUND INVESTIGATION HAS CONCLUDED</Tag>
        <h1 className="display ceremony__title">And the lead detective is…</h1>
      </header>
      <div className="podium" aria-label="Podium">
        {order.map((l) => {
          const p = byId.get(l.playerId)
          if (!p) return null
          const h = l.rank === 1 ? 170 : l.rank === 2 ? 120 : 90
          return (
            <motion.div key={l.playerId} className={`podium__spot podium__spot--${l.rank}`} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: l.rank === 1 ? 0.9 : l.rank === 2 ? 0.5 : 0.2, type: 'spring', stiffness: 160, damping: 14 }}>
              {l.rank === 1 && <span className="podium__crown" aria-hidden="true">👑</span>}
              <Mugshot player={p} size={l.rank === 1 ? 96 : 72} />
              <span className="podium__name">{p.name}</span>
              <span className="mono podium__score">{l.score} pts</span>
              <span className="podium__block" style={{ height: h }}>
                <b className="display">{l.rank}</b>
              </span>
            </motion.div>
          )
        })}
      </div>
      {final.leaderboard.length > 3 && (
        <ol className="standings standings--rest" start={4}>
          {final.leaderboard.slice(3).map((l) => {
            const p = byId.get(l.playerId)
            return (
              <li key={l.playerId}>
                <span className="standings__rank mono">{l.rank}</span>
                {p && <PixelAvatar avatar={p.avatar} color={p.color} size={28} />}
                <span className="standings__name">{name(l.playerId)}</span>
                <span className="standings__score mono">{l.score}</span>
              </li>
            )
          })}
        </ol>
      )}
      <h2 className="section-title">Personal awards</h2>
      {final.awards.length === 0 && <p className="hint">not enough evidence for awards this time. play more rounds, cowards.</p>}
      <div className="awards">
        {final.awards.map((a, i) => (
          <AwardCard key={a.id} award={a} index={i} />
        ))}
      </div>
      {final.moments.length > 0 && (
        <>
          <h2 className="section-title">Most surprising reveals</h2>
          <ul className="moments">
            {final.moments.map((m) => (
              <li key={m.answerId} className="moment">
                <span className="mono moment__why">{m.why}</span>
                <p>“{m.text}”</p>
                <span className="mono">
                  by {name(m.authorId)} · re {m.question}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function AwardCard({ award, index }: { award: Award; index: number }) {
  const { byId, name } = useRoom()
  return (
    <motion.article className="award" initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay: 1.2 + index * 0.2, type: 'spring', stiffness: 140, damping: 16 }}>
      <Badge kind={award.badge} />
      <h3 className="award__title">{award.title}</h3>
      <div className="award__winners">
        {award.winners.map((w) => {
          const p = byId.get(w)
          return (
            <span key={w} className="award__winner">
              {p && <PixelAvatar avatar={p.avatar} color={p.color} size={26} />}
              {name(w)}
            </span>
          )
        })}
      </div>
      <p className="award__desc">{award.description}</p>
      <span className="mono award__stat">{award.stat}</span>
    </motion.article>
  )
}

function Report({ initial }: { initial: string }) {
  const { view, byId, name, me } = useRoom()
  const final = view.game!.final!
  const [who, setWho] = useState(initial)
  const r: PlayerReport | undefined = final.reports[who]
  const p = byId.get(who)
  if (!r || !p) return <p className="hint">no report on file.</p>
  const g = final.group
  return (
    <article className="dossier">
      <div className="dossier__tab mono">CONFIDENTIAL · FRIENDSHIP INTELLIGENCE REPORT</div>
      <header className="dossier__head">
        <Mugshot player={p} size={96} />
        <div>
          <Tag>SUBJECT FILE</Tag>
          <h1 className="display">{p.name}</h1>
          <p className="dossier__headline">{r.headline}</p>
        </div>
        <label className="field dossier__pick">
          <span className="mono">view file</span>
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            {final.leaderboard.map((l) => (
              <option key={l.playerId} value={l.playerId}>
                {name(l.playerId)}
                {l.playerId === me.id ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </label>
        <Stamp tone="cherry" rotate={10}>
          for entertainment only
        </Stamp>
      </header>
      <div className="dossier__stats">
        <Stat label="guessing accuracy" value={pct(r.accuracy.correct, r.accuracy.total)} sub={`${r.accuracy.correct} of ${r.accuracy.total} guesses`} />
        <Stat label="answer predictability" value={pct(r.predictability.identified, r.predictability.total)} sub={`identified in ${r.predictability.identified} of ${r.predictability.total} votes`} />
        <Stat label="best deception" value={r.bestDeception ? `${r.bestDeception.fooled} fooled` : 'none'} sub={r.bestDeception ? `of ${r.bestDeception.votes} votes` : 'no successful lies on record'} />
        <Stat label="reactions" value={`${r.reactions.received}`} sub={`received · ${r.reactions.sent} sent${r.reactions.favorite ? ` · fav ${r.reactions.favorite}` : ''}`} />
      </div>
      <section className="dossier__notes">
        <h2 className="mono">INVESTIGATOR'S NOTES</h2>
        <ul>
          {r.commentary.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
        {r.mostConfused && (
          <p className="mono hint">
            most common mix up · thought {name(r.mostConfused.truthId)}'s answers were {name(r.mostConfused.guessedId)}'s ({r.mostConfused.count}×)
          </p>
        )}
        {r.soulmate && (
          <p className="mono hint">
            strongest connection · {name(r.soulmate.friendId)} · {Math.round(r.soulmate.rate * 100)}% mutual over {r.soulmate.samples} guesses
          </p>
        )}
        {r.blindSpot && (
          <p className="mono hint">
            biggest blind spot · {name(r.blindSpot.friendId)} ({r.blindSpot.correct}/{r.blindSpot.total})
          </p>
        )}
      </section>
      <section className="dossier__friends">
        <h2 className="mono">KNOWN ASSOCIATES</h2>
        <table className="assoc">
          <thead>
            <tr>
              <th scope="col">friend</th>
              <th scope="col">you identified them</th>
              <th scope="col">they identified you</th>
            </tr>
          </thead>
          <tbody>
            {r.friends.map((f) => {
              const fp = byId.get(f.friendId)
              return (
                <tr key={f.friendId}>
                  <th scope="row">
                    {fp && <PixelAvatar avatar={fp.avatar} color={fp.color} size={22} />} {name(f.friendId)}
                  </th>
                  <td>
                    <Meter c={f.youGotThem.correct} t={f.youGotThem.total} />
                  </td>
                  <td>
                    <Meter c={f.theyGotYou.correct} t={f.theyGotYou.total} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      <section className="dossier__matrix">
        <h2 className="mono">GROUP CONFUSION MATRIX</h2>
        <p className="hint">rows are who actually wrote it, columns are who got accused. the diagonal is correct guesses.</p>
        <Matrix />
        <p className="dossier__verdict">
          <b>group verdict</b> {g.verdict} <span className="mono">({pct(g.accuracy.correct, g.accuracy.total)} accuracy over {g.accuracy.total} guesses)</span>
        </p>
      </section>
    </article>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="stat">
      <span className="mono stat__label">{label}</span>
      <span className="display stat__value">{value}</span>
      <span className="stat__sub">{sub}</span>
    </div>
  )
}

function Meter({ c, t }: { c: number; t: number }) {
  if (!t) return <span className="mono hint">no data</span>
  return (
    <span className="meter" aria-label={`${c} of ${t}`}>
      <span className="meter__bar">
        <span style={{ width: `${(c / t) * 100}%` }} />
      </span>
      <span className="mono">
        {c}/{t}
      </span>
    </span>
  )
}

function Matrix() {
  const { view, byId } = useRoom()
  const { ids, cells } = view.game!.final!.matrix
  const max = Math.max(1, ...cells.flat())
  return (
    <div className="matrix-wrap" tabIndex={0} role="region" aria-label="Confusion matrix">
      <table className="matrix">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">author / accused</span>
            </th>
            {ids.map((id) => {
              const p = byId.get(id)
              return <th key={id} scope="col">{p ? <PixelAvatar avatar={p.avatar} color={p.color} size={22} title={p.name} /> : '?'}</th>
            })}
          </tr>
        </thead>
        <tbody>
          {ids.map((row, r) => {
            const p = byId.get(row)
            return (
              <tr key={row}>
                <th scope="row">{p ? <PixelAvatar avatar={p.avatar} color={p.color} size={22} title={p.name} /> : '?'}</th>
                {ids.map((col, c) => {
                  const v = cells[r][c]
                  return (
                    <td key={col} className={r === c ? 'diag' : ''} style={{ '--a': v / max } as React.CSSProperties} aria-label={`${byId.get(row)?.name} accused as ${byId.get(col)?.name}: ${v}`}>
                      {v || ''}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Share() {
  const { view, me, byId, name } = useRoom()
  const final = view.game!.final!
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const mine = final.leaderboard.find((l) => l.playerId === me.id)
  const myAward = final.awards.find((a) => a.winners.includes(me.id)) ?? null
  const report = final.reports[me.id]
  const text = useMemo(() => {
    const lines = [`🕵️ Who Said That? case report (room ${view.code})`]
    final.leaderboard.slice(0, 5).forEach((l) => lines.push(`${l.rank === 1 ? '👑' : `#${l.rank}`} ${name(l.playerId)} · ${l.score} pts`))
    final.awards.slice(0, 5).forEach((a) => lines.push(`🏅 ${a.title}: ${a.winners.map(name).join(' & ')}`))
    lines.push(`verdict ${final.group.verdict}`)
    return lines.join('\n')
  }, [final, name, view.code])

  const make = async (kind: 'me' | 'group') => {
    setBusy(kind)
    try {
      const blob =
        kind === 'me' && mine && report
          ? await playerCard({
              player: byId.get(me.id)!,
              rank: mine.rank,
              total: final.leaderboard.length,
              score: mine.score,
              award: myAward,
              accuracy: report.accuracy,
              summary: report.commentary[0] ?? report.headline,
            })
          : await groupCard({ players: view.players, final, code: view.code })
      download(blob, kind === 'me' ? `who-said-that-${me.name.replace(/\W+/g, '-')}.png` : `who-said-that-${view.code}.png`)
      setMsg('saved. drop it in the discord.')
    } catch {
      setMsg('could not render the card in this browser.')
    }
    setBusy(null)
  }

  return (
    <div className="share">
      <div className="share__cards">
        {mine && (
          <article className="share-preview share-preview--me">
            <Tag>YOUR CARD</Tag>
            <Mugshot player={byId.get(me.id)!} size={80} />
            <span className="display">#{mine.rank} · {mine.score} pts</span>
            <span>{myAward?.title ?? 'Person of Interest'}</span>
            <Btn tone="cherry" disabled={!!busy} onClick={() => make('me')}>
              {busy === 'me' ? 'developing…' : 'download my card (PNG)'}
            </Btn>
          </article>
        )}
        <article className="share-preview share-preview--group">
          <Tag>GROUP CARD</Tag>
          <div className="share-preview__row">
            {final.leaderboard.slice(0, 6).map((l) => {
              const p = byId.get(l.playerId)
              return p ? <PixelAvatar key={l.playerId} avatar={p.avatar} color={p.color} size={40} /> : null
            })}
          </div>
          <span>{final.group.verdict}</span>
          <Btn tone="yellow" disabled={!!busy} onClick={() => make('group')}>
            {busy === 'group' ? 'developing…' : 'download group card (PNG)'}
          </Btn>
        </article>
      </div>
      <div className="share__text">
        <label htmlFor="share-text" className="mono">
          TEXT SUMMARY (no answers included)
        </label>
        <textarea id="share-text" readOnly value={text} rows={8} />
        <Btn
          tone="lavender"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setMsg('copied to clipboard.')
            } catch {
              setMsg('clipboard blocked. select the text and copy it by hand.')
            }
          }}
        >
          copy text summary
        </Btn>
      </div>
      {msg && (
        <p className="mono hint" role="status">
          {msg}
        </p>
      )}
    </div>
  )
}
