import { motion } from 'framer-motion'
import { useState } from 'react'
import { DECKS, DECK_QUESTIONS } from '../../shared/bank.ts'
import { PLAYER_COLORS } from '../../shared/avatars.ts'
import { navigate } from '../lib/router.ts'
import { Arrow, Btn, Envelope, Fingerprint, Heart, Marquee, Stamp, Star, Tag } from '../components/bits.tsx'
import { DeckCard } from '../components/DeckCard.tsx'
import { PixelAvatar } from '../components/PixelAvatar.tsx'

const TIPS = [
  { who: 'anonymous', text: 'i would sue a goose and win', tag: 'EXHIBIT A' },
  { who: '???', text: 'my last two brain cells are arguing about soup', tag: 'EXHIBIT B' },
  { who: 'unknown sender', text: 'house rule #1: nobody touches my fridge shelf', tag: 'EXHIBIT C' },
  { who: 'redacted', text: 'i once pretended to understand crypto for 45 minutes', tag: 'EXHIBIT D' },
]

const LINEUP = [
  { avatar: 0, name: 'the cat' },
  { avatar: 3, name: 'the alien' },
  { avatar: 1, name: 'the ghost' },
  { avatar: 7, name: 'the duck' },
  { avatar: 4, name: 'the robot' },
  { avatar: 9, name: 'the bear' },
]

export function Landing() {
  const [code, setCode] = useState('')
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero__copy">
          <Tag className="hero__tag">CONFIDENTIAL · DO NOT SHOW YOUR FRIENDS (show your friends)</Tag>
          <h1 className="logo" aria-label="Who Said That?">
            <span className="logo__line logo__line--1">Who</span>
            <span className="logo__line logo__line--2">Said</span>
            <span className="logo__line logo__line--3">
              That<span className="logo__q">?</span>
            </span>
          </h1>
          <p className="hero__tagline">Your friends. Your secrets. Your questionable guesses.</p>
          <p className="hero__lead">
            Think you know your friends?
            <br />
            <b>Let's put that under investigation.</b>
          </p>
          <div className="hero__actions">
            <Btn tone="cherry" className="btn--xl" onClick={() => navigate('/new')}>
              Open a case file
            </Btn>
            <form
              className="join-ticket"
              onSubmit={(e) => {
                e.preventDefault()
                if (clean.length === 6) navigate(`/r/${clean}`)
              }}
            >
              <label htmlFor="join-code" className="mono">
                GOT A ROOM CODE?
              </label>
              <div className="join-ticket__row">
                <input
                  id="join-code"
                  value={clean}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ABC123"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  inputMode="text"
                  maxLength={8}
                  aria-describedby="join-hint"
                />
                <Btn tone="yellow" type="submit" disabled={clean.length !== 6}>
                  Join
                </Btn>
              </div>
              <span id="join-hint" className="mono hint">
                6 characters. ask whoever is hosting.
              </span>
            </form>
          </div>
          <Arrow className="hero__arrow" />
        </div>
        <div className="hero__board" aria-hidden="true">
          {TIPS.map((t, i) => (
            <motion.div
              key={t.tag}
              className={`tip tip--${i}`}
              initial={{ opacity: 0, y: 40, rotate: 0 }}
              animate={{ opacity: 1, y: [0, -8, 0], rotate: [-4, 3, -2, 4][i] }}
              transition={{ delay: 0.2 + i * 0.18, y: { repeat: Infinity, duration: 4 + i, ease: 'easeInOut', delay: i * 0.4 } }}
            >
              <div className="tip__bar">
                <span>{t.who}</span>
                <span className="mono">{t.tag}</span>
              </div>
              <p>{t.text}</p>
              <span className="tip__who">who said that?</span>
            </motion.div>
          ))}
          <Stamp className="hero__stamp" rotate={-14}>
            Classified
          </Stamp>
          <Star className="st st--1" />
          <Heart className="st st--2" />
          <Star className="st st--3" color="#B79CF2" />
          <Envelope className="st st--4" sealed />
          <Fingerprint className="st st--5" />
        </div>
      </section>

      <Marquee items={['330 hand picked questions', '10 decks', '10 special rounds', '3 to 12 suspects', 'no accounts', 'zero chill', 'friendship intelligence reports']} />

      <section className="lineup" aria-labelledby="lineup-h">
        <h2 id="lineup-h" className="section-title">
          The usual suspects
        </h2>
        <div className="lineup__wall">
          <div className="lineup__ruler" aria-hidden="true">
            {[7, 6, 5, 4].map((f) => (
              <span key={f}>{f}′</span>
            ))}
          </div>
          <ul className="lineup__row">
            {LINEUP.map((s, i) => (
              <motion.li key={s.name} initial={{ y: 60, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <PixelAvatar avatar={s.avatar} color={PLAYER_COLORS[(i * 3) % PLAYER_COLORS.length]} size={88} />
                <span className="plate mono">
                  #{String(i + 1).padStart(2, '0')} {s.name}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
        <p className="lineup__caption">one of them wrote “i would sue a goose and win”. you have 25 seconds.</p>
      </section>

      <section className="howto" aria-labelledby="how-h">
        <h2 id="how-h" className="section-title">
          How the investigation works
        </h2>
        <ol className="howto__steps">
          {[
            { n: '01', t: 'Open a room', d: 'Share a 6 letter code in your Discord call. No accounts. No downloads.', c: 'pink' },
            { n: '02', t: 'Answer anonymously', d: 'Everyone gets the same unhinged question. Nobody sees who wrote what.', c: 'yellow' },
            { n: '03', t: 'Accuse your friends', d: 'Answers appear one by one. Vote on who you think wrote each one.', c: 'blue' },
            { n: '04', t: 'Dramatic reveal', d: 'The case file opens. Points for catching liars and for fooling detectives.', c: 'mint' },
          ].map((s, i) => (
            <li key={s.n} className={`polaroid polaroid--${s.c}`} style={{ rotate: `${[-2, 1.5, -1, 2][i]}deg` }}>
              <span className="polaroid__n">{s.n}</span>
              <b>{s.t}</b>
              <span>{s.d}</span>
            </li>
          ))}
        </ol>
        <Btn tone="lavender" onClick={() => navigate('/how')}>
          read the full rulebook
        </Btn>
      </section>

      <section className="deckpeek" aria-labelledby="decks-h">
        <div className="deckpeek__head">
          <h2 id="decks-h" className="section-title">
            Ten decks of questionable questions
          </h2>
          <Btn tone="yellow" onClick={() => navigate('/decks')}>
            browse the library
          </Btn>
        </div>
        <div className="deckpeek__fan" tabIndex={0} role="region" aria-label="Deck previews, scroll sideways">
          {DECKS.map((d) => (
            <DeckCard key={d.id} deck={d} count={DECK_QUESTIONS.filter((q) => q.deck === d.id).length} sample={DECK_QUESTIONS.find((q) => q.deck === d.id)?.text} />
          ))}
        </div>
      </section>

      <section className="finale">
        <Stamp tone="ink" rotate={4}>
          Warning
        </Stamp>
        <p className="finale__text">side effects include inside jokes, betrayal, and immediately asking for a rematch.</p>
        <Btn tone="cherry" className="btn--xl" onClick={() => navigate('/new')}>
          Start an investigation
        </Btn>
      </section>
    </div>
  )
}
