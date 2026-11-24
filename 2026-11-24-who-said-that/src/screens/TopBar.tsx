import { useState } from 'react'
import { navigate, type Route } from '../lib/router.ts'
import { setPrefs, usePrefs } from '../lib/prefs.ts'
import { sfx, unlockAudio } from '../lib/sound.ts'
import { useStore } from '../lib/store.ts'

export function TopBar({ route }: { route: Route }) {
  const prefs = usePrefs()
  const { status, view } = useStore()
  const [open, setOpen] = useState(false)
  const inRoom = route.name === 'room' && view
  return (
    <header className="topbar">
      <button className="topbar__logo" onClick={() => navigate('/')} aria-label="Who Said That? home">
        <span className="topbar__dot" aria-hidden="true" />
        WHO_SAID_THAT<span className="blink">?</span>
      </button>
      <nav className="topbar__nav" aria-label="Main">
        {!inRoom && (
          <>
            <button className={route.name === 'decks' ? 'on' : ''} onClick={() => navigate('/decks')}>
              decks
            </button>
            <button className={route.name === 'studio' ? 'on' : ''} onClick={() => navigate('/studio')}>
              studio
            </button>
            <button className={route.name === 'how' ? 'on' : ''} onClick={() => navigate('/how')}>
              how to play
            </button>
          </>
        )}
        {inRoom && (
          <span className="mono topbar__room">
            ROOM {view.code} · <i className={`dot dot--${status}`} aria-hidden="true" /> {status}
          </span>
        )}
      </nav>
      <div className="topbar__tools">
        <button
          className="icon-btn"
          aria-label={prefs.muted ? 'Unmute sound' : 'Mute sound'}
          aria-pressed={prefs.muted}
          onClick={() => {
            unlockAudio()
            setPrefs({ muted: !prefs.muted })
            if (prefs.muted) setTimeout(() => sfx('pop'), 30)
          }}
        >
          {prefs.muted ? '🔇' : '🔊'}
        </button>
        <button className="icon-btn" aria-label="Sound and motion settings" aria-expanded={open} onClick={() => setOpen(!open)}>
          ⚙
        </button>
        {open && (
          <div className="prefs-pop" role="dialog" aria-label="Sound and motion settings">
            <label className="field">
              <span className="mono">volume {Math.round(prefs.volume * 100)}%</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs.volume}
                onChange={(e) => setPrefs({ volume: Number(e.target.value), muted: false })}
                onPointerUp={() => sfx('pop')}
              />
            </label>
            <fieldset className="field">
              <legend className="mono">motion</legend>
              {(['system', 'on', 'off'] as const).map((m) => (
                <label key={m} className="radio">
                  <input type="radio" name="motion" checked={prefs.reducedMotion === m} onChange={() => setPrefs({ reducedMotion: m })} />
                  {m === 'system' ? 'follow my system' : m === 'on' ? 'reduce motion' : 'full chaos'}
                </label>
              ))}
            </fieldset>
            <button className="btn btn--cream btn--sm" onClick={() => setOpen(false)}>
              close
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
