// Suspect registration: nickname, pixel avatar and colour.
import { motion } from 'framer-motion'
import { useState } from 'react'
import { AVATARS, PLAYER_COLORS } from '../../shared/avatars.ts'
import { LIMITS, type Profile } from '../../shared/protocol.ts'
import { Btn, Fingerprint, Stamp, Tag } from '../components/bits.tsx'
import { PixelAvatar } from '../components/PixelAvatar.tsx'
import { loadProfile, saveProfile } from '../lib/prefs.ts'
import { navigate } from '../lib/router.ts'
import { createRoom, joinRoom } from '../lib/store.ts'
import { sfx } from '../lib/sound.ts'

export function ProfileForm({
  initial,
  submitLabel,
  heading,
  onSubmit,
  busy,
  error,
  extra,
}: {
  initial: Profile
  submitLabel: string
  heading: string
  onSubmit: (p: Profile) => void
  busy?: boolean
  error?: string | null
  extra?: React.ReactNode
}) {
  const [p, setP] = useState<Profile>(initial)
  const name = p.name.trim()
  return (
    <form
      className="regform"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name) return
        sfx('stamp')
        onSubmit({ ...p, name })
      }}
    >
      <div className="regform__paper">
        <header className="regform__head">
          <div>
            <Tag>FORM WST-12 · SUSPECT REGISTRATION</Tag>
            <h1 className="display regform__title">{heading}</h1>
          </div>
          <Stamp tone="blue" rotate={8}>
            pending
          </Stamp>
        </header>
        <div className="regform__grid">
          <div className="regform__mug">
            <div className="mugframe" style={{ '--c': p.color } as React.CSSProperties}>
              <span className="mugframe__lines" aria-hidden="true" />
              <motion.div key={`${p.avatar}-${p.color}`} initial={{ scale: 0.7, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                <PixelAvatar avatar={p.avatar} color={p.color} size={132} title={`your avatar, a ${AVATARS[p.avatar].name}`} />
              </motion.div>
              <span className="mugframe__plate mono">{name || 'UNKNOWN'}</span>
            </div>
            <Fingerprint className="regform__print" />
          </div>
          <div className="regform__fields">
            <label className="field">
              <span className="mono">1. ALIAS (what your friends call you)</span>
              <input
                className="typewriter"
                value={p.name}
                maxLength={LIMITS.nameMax}
                onChange={(e) => setP({ ...p, name: e.target.value })}
                placeholder="e.g. jamie"
                autoComplete="nickname"
                autoFocus
                required
              />
            </label>
            <fieldset className="field">
              <legend className="mono">2. DISGUISE</legend>
              <div className="avatar-grid" role="radiogroup" aria-label="Avatar">
                {AVATARS.map((a, i) => (
                  <button
                    type="button"
                    key={a.name}
                    role="radio"
                    aria-checked={p.avatar === i}
                    aria-label={a.name}
                    className={`avatar-pick ${p.avatar === i ? 'on' : ''}`}
                    onClick={() => {
                      setP({ ...p, avatar: i })
                      sfx('pop')
                    }}
                  >
                    <PixelAvatar avatar={i} color={p.color} size={40} />
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="field">
              <legend className="mono">3. SIGNATURE COLOUR</legend>
              <div className="swatches" role="radiogroup" aria-label="Avatar colour">
                {PLAYER_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    role="radio"
                    aria-checked={p.color === c}
                    aria-label={`colour ${c}`}
                    className={`swatch ${p.color === c ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setP({ ...p, color: c })}
                  />
                ))}
              </div>
            </fieldset>
            {extra}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Btn tone="cherry" className="btn--xl" type="submit" disabled={!name || busy}>
              {busy ? 'filing paperwork…' : submitLabel}
            </Btn>
          </div>
        </div>
      </div>
    </form>
  )
}

export function NewRoom() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="screen screen--paper">
      <ProfileForm
        initial={loadProfile()}
        heading="Open a new case"
        submitLabel="Create private room"
        busy={busy}
        error={error}
        onSubmit={async (p) => {
          setBusy(true)
          setError(null)
          saveProfile(p)
          const res = await createRoom(p)
          setBusy(false)
          if (res.ok && res.code) navigate(`/r/${res.code}`, true)
          else if (!res.ok) setError(res.error)
        }}
      />
    </div>
  )
}

export function JoinForm({ code }: { code: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="screen screen--paper">
      <ProfileForm
        initial={loadProfile()}
        heading={`Join room ${code}`}
        submitLabel="Enter the interrogation room"
        busy={busy}
        error={error}
        extra={
          <p className="mono hint">
            room <b>{code}</b> · no account needed. your answers stay anonymous until the reveal.
          </p>
        }
        onSubmit={async (p) => {
          setBusy(true)
          setError(null)
          saveProfile(p)
          const res = await joinRoom(code, p)
          setBusy(false)
          if (!res.ok) setError(res.error)
        }}
      />
    </div>
  )
}
