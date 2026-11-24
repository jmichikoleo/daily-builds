import { MotionConfig } from 'framer-motion'
import { useEffect } from 'react'
import { navigate, parse, usePath } from './lib/router.ts'
import { connect, useStore } from './lib/store.ts'
import { usePrefs } from './lib/prefs.ts'
import { TopBar } from './screens/TopBar.tsx'
import { Landing } from './screens/Landing.tsx'
import { NewRoom } from './screens/Identity.tsx'
import { RoomScreen } from './screens/RoomScreen.tsx'
import { DeckLibrary } from './screens/Decks.tsx'
import { Studio } from './screens/Studio.tsx'
import { HowToPlay } from './screens/How.tsx'

export function App() {
  const path = usePath()
  const route = parse(path)
  const prefs = usePrefs()
  const { status } = useStore()
  useEffect(() => connect(), [])
  useEffect(() => {
    const titles: Record<string, string> = {
      home: 'Who Said That?',
      new: 'Register a suspect · Who Said That?',
      room: 'Case file · Who Said That?',
      decks: 'Deck library · Who Said That?',
      studio: 'Deck studio · Who Said That?',
      how: 'How to play · Who Said That?',
    }
    document.title = titles[route.name]
  }, [route.name])
  const reduced = prefs.reducedMotion === 'system' ? 'user' : prefs.reducedMotion === 'on' ? 'always' : 'never'
  return (
    <MotionConfig reducedMotion={reduced}>
      <div className={`app ${prefs.reducedMotion === 'on' ? 'reduce-motion' : ''}`}>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <TopBar route={route} />
        {status === 'offline' && route.name === 'room' && (
          <div className="offline-banner" role="status">
            connection lost. reconnecting to the case file…
          </div>
        )}
        <main id="main" tabIndex={-1}>
          {route.name === 'home' && <Landing />}
          {route.name === 'new' && <NewRoom />}
          {route.name === 'room' && <RoomScreen code={route.code} />}
          {route.name === 'decks' && <DeckLibrary />}
          {route.name === 'studio' && <Studio />}
          {route.name === 'how' && <HowToPlay />}
        </main>
        {route.name !== 'room' && (
          <footer className="footer mono">
            <span>WHO_SAID_THAT.EXE · v1.0</span>
            <span>an unauthorized investigation into your friend group</span>
            <button className="linkish" onClick={() => navigate('/how')}>
              how to play
            </button>
          </footer>
        )}
      </div>
    </MotionConfig>
  )
}
