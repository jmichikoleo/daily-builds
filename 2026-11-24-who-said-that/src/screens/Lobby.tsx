import { AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { LIMITS } from '../../shared/protocol.ts'
import { Btn, Stamp, Tag, Window } from '../components/bits.tsx'
import { SuspectCard } from '../components/Suspect.tsx'
import { leaveRoom, send } from '../lib/store.ts'
import { navigate } from '../lib/router.ts'
import { saveProfile } from '../lib/prefs.ts'
import { useRoom } from './RoomScreen.tsx'
import { SettingsPanel } from './Settings.tsx'
import { ProfileForm } from './Identity.tsx'

export function Lobby() {
  const { view, me, isHost } = useRoom()
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [menu, setMenu] = useState<string | null>(null)
  const players = view.players.filter((p) => p.role === 'player')
  const spectators = view.players.filter((p) => p.role === 'spectator')
  const connected = players.filter((p) => p.connected)
  const ready = players.filter((p) => p.ready || p.isHost)
  const link = `${location.origin}/r/${view.code}`

  const copy = async (what: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(what === 'link' ? link : view.code)
      setCopied(what)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      setCopied('failed')
    }
  }

  const act = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const res = await p
    setError(res.ok ? null : (res.error ?? 'failed'))
  }

  if (editing)
    return (
      <div className="screen screen--paper">
        <ProfileForm
          initial={{ name: me.name, avatar: me.avatar, color: me.color as never }}
          heading="Update your disguise"
          submitLabel="Save disguise"
          onSubmit={async (p) => {
            saveProfile(p)
            await act(send('player:update-profile', { profile: p }))
            setEditing(false)
          }}
        />
      </div>
    )

  return (
    <div className="lobby">
      <section className="lobby__ticket" aria-label="Room code">
        <div className="ticket">
          <span className="mono ticket__label">ROOM CODE</span>
          <button className="ticket__code" onClick={() => copy('code')} title="copy room code">
            {view.code}
            <span className="sr-only"> (copy room code)</span>
          </button>
          <div className="ticket__actions">
            <Btn tone="yellow" className="btn--sm" onClick={() => copy('link')}>
              {copied === 'link' ? 'link copied ✓' : 'copy invite link'}
            </Btn>
            <span className="mono ticket__link">{link.replace(/^https?:\/\//, '')}</span>
          </div>
          {copied === 'code' && <span className="mono ticket__copied">code copied</span>}
          {copied === 'failed' && <span className="mono ticket__copied">copy blocked. select the link by hand.</span>}
        </div>
        <div className="lobby__count">
          <span className="display">{players.length}</span>
          <span className="mono">
            / {LIMITS.maxPlayers} suspects
            <br />
            {connected.length < LIMITS.minPlayers ? `need ${LIMITS.minPlayers - connected.length} more` : `${ready.length} ready`}
          </span>
        </div>
      </section>

      <section className="lobby__board" aria-labelledby="suspects-h">
        <header className="board-head">
          <h1 id="suspects-h" className="display">
            The waiting room
          </h1>
          <Tag>{view.gamesPlayed > 0 ? `REMATCH NO. ${view.gamesPlayed}` : 'NEW INVESTIGATION'}</Tag>
        </header>
        <ul className="suspects">
          <AnimatePresence>
            {view.players.map((p, i) => (
              <SuspectCard key={p.id} player={p} index={i} you={p.id === me.id}>
                {isHost && p.id !== me.id && (
                  <div className="suspect__menu">
                    <button className="mini" aria-label={`Host options for ${p.name}`} aria-expanded={menu === p.id} onClick={() => setMenu(menu === p.id ? null : p.id)}>
                      ⋯
                    </button>
                    {menu === p.id && (
                      <div className="mini-menu">
                        <button
                          onClick={() => {
                            setMenu(null)
                            void act(send('room:transfer-host', { playerId: p.id }))
                          }}
                        >
                          make host
                        </button>
                        <button
                          className="danger"
                          onClick={() => {
                            setMenu(null)
                            if (confirm(`Remove ${p.name} from the room?`)) void act(send('room:kick', { playerId: p.id }))
                          }}
                        >
                          remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </SuspectCard>
            ))}
          </AnimatePresence>
          {Array.from({ length: Math.max(0, LIMITS.minPlayers - players.length) }, (_, i) => (
            <li key={`empty-${i}`} className="suspect suspect--empty" aria-label="empty seat">
              <span className="suspect__photo">?</span>
              <span className="suspect__name mono">awaiting suspect</span>
            </li>
          ))}
        </ul>
        {spectators.length > 0 && <p className="mono hint">{spectators.length} witness(es) watching. they join as players next game.</p>}
        <div className="lobby__me">
          {me.role === 'player' && (
            <Btn tone={me.ready ? 'mint' : 'pink'} onClick={() => act(send('player:ready', { ready: !me.ready }))} aria-pressed={me.ready}>
              {me.ready ? '✓ ready for questioning' : 'mark me ready'}
            </Btn>
          )}
          <Btn tone="cream" onClick={() => setEditing(true)}>
            change disguise
          </Btn>
          <Btn
            tone="cream"
            onClick={async () => {
              await leaveRoom()
              navigate('/')
            }}
          >
            leave room
          </Btn>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>

      <aside className="lobby__settings">
        {isHost ? (
          <SettingsPanel onError={setError} />
        ) : (
          <Window title="case_settings.txt" tone="blue">
            <ReadOnlySettings />
          </Window>
        )}
      </aside>
    </div>
  )
}

function ReadOnlySettings() {
  const { view, name } = useRoom()
  const s = view.settings
  const host = view.players.find((p) => p.isHost)
  return (
    <div className="ro-settings">
      <Stamp tone="ink" rotate={-4}>
        host only
      </Stamp>
      <dl className="mono">
        <dt>host</dt>
        <dd>{host ? name(host.id) : '?'}</dd>
        <dt>rounds</dt>
        <dd>{s.rounds}</dd>
        <dt>chaos</dt>
        <dd>level {s.chaos}</dd>
        <dt>decks</dt>
        <dd>{s.decks.length} selected{view.customDecks.length && s.customQuestions ? ` + ${view.customDecks.length} custom` : ''}</dd>
        <dt>special rounds</dt>
        <dd>{s.specialFrequency}</dd>
        <dt>answer timer</dt>
        <dd>{s.answerSeconds}s</dd>
      </dl>
      <p className="hint">the host is configuring the investigation. stretch. hydrate. prepare your lies.</p>
    </div>
  )
}
