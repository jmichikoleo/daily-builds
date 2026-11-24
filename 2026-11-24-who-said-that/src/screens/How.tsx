import { CHAOS_LEVELS } from '../../shared/questions.ts'
import { ROUND_RULES, SPECIAL_TYPES } from '../../shared/protocol.ts'
import { Btn, Envelope, Fingerprint, Stamp, Tag } from '../components/bits.tsx'
import { PixelAvatar } from '../components/PixelAvatar.tsx'
import { navigate } from '../lib/router.ts'

export function HowToPlay() {
  return (
    <div className="how">
      <header className="library__head">
        <Tag>RULEBOOK · PLEASE ACTUALLY READ</Tag>
        <h1 className="display">How to play</h1>
        <p>3 to 12 friends, one voice call, everyone on their own phone or laptop. one person hosts and shares the room code.</p>
      </header>
      <ol className="comic">
        <li className="panel panel--pink">
          <span className="panel__n">1</span>
          <div className="panel__art" aria-hidden="true">
            <PixelAvatar avatar={0} color="#FF8FA3" size={56} />
            <span className="panel__bubble">code is K7XQ2M</span>
          </div>
          <b>Open a room.</b> The host creates a room and shares the six character code or invite link. Everyone picks an alias, a pixel disguise and a colour.
        </li>
        <li className="panel panel--yellow">
          <span className="panel__n">2</span>
          <div className="panel__art" aria-hidden="true">
            <Envelope sealed />
          </div>
          <b>Answer anonymously.</b> A question appears. Write your answer before the timer ends. You can edit until you seal it, plead the fifth to pass, or anonymously ask for another question.
        </li>
        <li className="panel panel--blue">
          <span className="panel__n">3</span>
          <div className="panel__art" aria-hidden="true">
            <Fingerprint />
          </div>
          <b>Accuse your friends.</b> Answers appear one at a time in a shuffled order. Pick who you think wrote each one. You never vote on your own answer, and nobody sees votes until the reveal.
        </li>
        <li className="panel panel--mint">
          <span className="panel__n">4</span>
          <div className="panel__art" aria-hidden="true">
            <Stamp tone="cherry" rotate={-8}>
              busted
            </Stamp>
          </div>
          <b>The reveal.</b> See who everyone accused, then the case file opens and the author is revealed. Points land, commentary happens, emojis fly.
        </li>
      </ol>

      <section className="rules-grid">
        <div className="rulecard rulecard--score">
          <h2 className="display">Scoring</h2>
          <table className="score-table">
            <tbody>
              <tr>
                <td className="mono">+100</td>
                <td>you correctly identify an author</td>
              </tr>
              <tr>
                <td className="mono">+50</td>
                <td>for each detective your answer fools</td>
              </tr>
              <tr>
                <td className="mono">+150</td>
                <td>nobody guesses your answer (needs at least 2 votes)</td>
              </tr>
              <tr>
                <td className="mono">+200</td>
                <td>you guess every answer right in a round (at least 2)</td>
              </tr>
              <tr>
                <td className="mono">×2</td>
                <td>everything in the Final Boss round</td>
              </tr>
            </tbody>
          </table>
          <p className="hint">missing votes, skipped votes and disconnected players never earn anyone points. all scoring happens on the server.</p>
        </div>
        <div className="rulecard">
          <h2 className="display">Chaos levels</h2>
          <ol className="chaos-list">
            {CHAOS_LEVELS.map((c) => (
              <li key={c.level}>
                <span className={`lvl lvl--${c.level}`}>{c.level}</span>
                <b>{c.name}</b> {c.blurb}
              </li>
            ))}
          </ol>
          <p className="hint">the chaos level decides which questions can appear, in every deck. nothing asks for trauma, private info or anyone else's secrets.</p>
        </div>
      </section>

      <section>
        <h2 className="section-title">Special rounds</h2>
        <ul className="special-cards">
          {SPECIAL_TYPES.map((t, i) => (
            <li key={t} className={`special-card special-card--${i % 5}`}>
              <b>{ROUND_RULES[t].name}</b>
              <span className="mono">{ROUND_RULES[t].short}</span>
              <p>{ROUND_RULES[t].rule}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rulecard">
        <h2 className="display">Good to know</h2>
        <ul className="notes">
          <li>Refresh or drop out? Open the same link and you take your seat back (within about 90 seconds).</li>
          <li>If the host disappears, host powers move to the next suspect automatically.</li>
          <li>People who join mid game watch as witnesses and become suspects in the rematch.</li>
          <li>If fewer than 3 players are left, the game pauses until someone comes back.</li>
          <li>Answers are only shown anonymously, and authors are only sent to anyone's device at the reveal.</li>
          <li>Rooms live in server memory only. They disappear when idle or when the server restarts.</li>
        </ul>
      </section>
      <div className="finale">
        <Btn tone="cherry" className="btn--xl" onClick={() => navigate('/new')}>
          Start an investigation
        </Btn>
      </div>
    </div>
  )
}
