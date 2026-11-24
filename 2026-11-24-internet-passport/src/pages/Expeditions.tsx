// src/pages/Expeditions.tsx
// curated journeys. every expedition stays open forever. one is featured each
// week by calendar arithmetic (featuredExpedition in lib/logic.ts).

import { usePassport } from "../lib/store";
import { EXPEDITIONS, expedition } from "../data/expeditions";
import { destination } from "../data/destinations";
import { territory } from "../data/territories";
import { expeditionProgress, featuredExpedition, hasVisited } from "../lib/logic";
import { CatalogStamp, Empty, Progress } from "../components/bits";
import { Glyph } from "../components/glyphs";
import { href } from "../lib/router";
import { niceDate } from "../lib/format";
import type { Expedition } from "../types";

/** an illustrated travel poster, drawn from the expedition's colours and motif */
export function ExpeditionPoster({ e, small }: { e: Expedition; small?: boolean }) {
  const n = String(e.number).padStart(3, "0");
  return (
    <svg viewBox="0 0 300 400" className={`poster ${small ? "poster-small" : ""}`} role="img" aria-label={`travel poster for ${e.title}`}>
      <rect width="300" height="400" fill="#F8F1E5" />
      <rect x="14" y="14" width="272" height="372" fill={e.poster.sky} />
      <circle cx="210" cy="120" r="56" fill="#FFE9AE" opacity="0.85" />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1="14" x2="286" y1={60 + i * 18} y2={60 + i * 18} stroke="#F8F1E5" strokeOpacity="0.18" strokeWidth="6" />
      ))}
      <path d="M14 270 Q80 220 150 250 T286 236 V386 H14 Z" fill={e.poster.ground} />
      <path d="M14 310 Q100 280 170 300 T286 292 V386 H14 Z" fill="#382D29" opacity="0.18" />
      <circle cx="150" cy="196" r="64" fill={e.poster.ground} stroke="#F8F1E5" strokeWidth="4" />
      <circle cx="150" cy="196" r="54" fill="none" stroke="#F8F1E5" strokeWidth="1.5" strokeDasharray="3 5" />
      <g transform="translate(150 196) scale(0.95) translate(-50 -50)" fill="none" stroke="#F8F1E5" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <Glyph name={e.poster.motif} />
      </g>
      <rect x="14" y="14" width="272" height="372" fill="none" stroke="#382D29" strokeWidth="3" />
      <rect x="26" y="32" width="150" height="28" fill={e.poster.ground} />
      <text x="34" y="52" fill="#F8F1E5" fontFamily="Courier Prime, monospace" fontSize="15" letterSpacing="3" fontWeight="700">
        EXPEDITION {n}
      </text>
      <foreignObject x="26" y="300" width="248" height="80">
        <p className="poster-title">{e.title.toLowerCase()}</p>
      </foreignObject>
    </svg>
  );
}

export function ExpeditionsPage() {
  const { state } = usePassport();
  const featured = featuredExpedition(new Date());
  const fp = expeditionProgress(state, featured);
  const done = EXPEDITIONS.filter((e) => expeditionProgress(state, e).complete).length;
  return (
    <main id="main" className="page" tabIndex={-1}>
      <header className="page-head">
        <p className="kicker">expeditions</p>
        <h1 className="display big">curated journeys</h1>
        <p className="lede">
          small guided trips through connected corners of the web. a new one is featured every monday, and every past one stays open. {done} of{" "}
          {EXPEDITIONS.length} completed.
        </p>
      </header>

      <section className="featured paper" aria-labelledby="feat-h">
        <a href={href(`/expeditions/${featured.id}`)} className="poster-link" aria-hidden="true" tabIndex={-1}>
          <ExpeditionPoster e={featured} />
        </a>
        <div>
          <p className="kicker">featured this week</p>
          <h2 id="feat-h" className="display big">
            <a href={href(`/expeditions/${featured.id}`)}>{featured.title}</a>
          </h2>
          <p className="lede">{featured.intro}</p>
          <Progress value={fp.visited} total={fp.total} label="featured expedition progress" />
          <p className="small">{fp.complete ? "complete" : `${fp.visited} of ${fp.total} stops`}</p>
          <a className="btn btn-primary" href={href(`/expeditions/${featured.id}`)}>
            {fp.visited ? "continue the expedition" : "begin the expedition"}
          </a>
        </div>
      </section>

      <ul className="poster-wall">
        {EXPEDITIONS.map((e) => {
          const p = expeditionProgress(state, e);
          return (
            <li key={e.id} className={p.complete ? "complete" : ""}>
              <a href={href(`/expeditions/${e.id}`)} className="poster-card">
                <ExpeditionPoster e={e} small />
                <span className="poster-card-title">{e.title}</span>
                <span className="mono small">{p.complete ? "complete" : p.visited ? `${p.visited} of ${p.total}, in progress` : `${p.total} stops`}</span>
                {e.id === featured.id && <span className="badge">this week</span>}
                {p.complete && (
                  <span className="poster-seal" aria-hidden="true">
                    <CatalogStamp stampId={`exp:${e.id}`} size={70} />
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

export function ExpeditionDetail({ id }: { id: string }) {
  const { state } = usePassport();
  const e = expedition(id);
  if (!e) {
    return (
      <main id="main" className="page" tabIndex={-1}>
        <Empty title="no such expedition">
          <a className="btn" href={href("/expeditions")}>
            see all expeditions
          </a>
        </Empty>
      </main>
    );
  }
  const p = expeditionProgress(state, e);
  const rec = state.expeditions[e.id];
  const seal = state.stamps[`exp:${e.id}`];
  return (
    <main id="main" className="page expedition-page" tabIndex={-1}>
      <a className="back" href={href("/expeditions")}>
        all expeditions
      </a>
      <header className="expedition-head">
        <ExpeditionPoster e={e} />
        <div>
          <p className="kicker">expedition {String(e.number).padStart(3, "0")}</p>
          <h1 className="display big">{e.title}</h1>
          <p className="lede">{e.intro}</p>
          <Progress value={p.visited} total={p.total} label={`${e.title} progress`} />
          <p className="small">
            {p.complete
              ? `completed ${niceDate(rec?.completedAt ?? new Date())}`
              : rec
                ? `started ${niceDate(rec.startedAt)}, ${p.visited} of ${p.total} stops`
                : "not started yet. visit any stop to begin."}
          </p>
        </div>
        <figure className={`seal ${p.complete ? "sealed" : ""}`}>
          <CatalogStamp stampId={`exp:${e.id}`} earnedAt={seal?.earnedAt} size={140} faded={!seal} title={`completion seal for ${e.title}`} />
          <figcaption className="small">{seal ? "sealed in your passport" : "completion seal"}</figcaption>
        </figure>
      </header>

      <section aria-labelledby="route-h">
        <h2 id="route-h" className="display">
          the route
        </h2>
        <ol className="route">
          {e.destinationIds.map((did, i) => {
            const d = destination(did)!;
            const v = hasVisited(state, did);
            const t = territory(d.territory);
            return (
              <li key={did} className={v ? "done" : ""} style={{ ["--accent" as string]: t.color, ["--ink-accent" as string]: t.ink }}>
                <span className="route-no mono">stop {i + 1}</span>
                <div className="route-body">
                  <a href={href(`/destination/${did}`)} className="route-name">
                    {d.name}
                  </a>
                  <p className="small">{d.description}</p>
                </div>
                <span className="route-state">
                  {v ? <CatalogStamp stampId={`dest:${did}`} earnedAt={state.stamps[`dest:${did}`]?.earnedAt} size={64} /> : <span className="mono small">to visit</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="expedition-extras">
        <section className="paper" aria-labelledby="obj-h">
          <h2 id="obj-h" className="display">
            objectives
          </h2>
          <ul className="objectives">
            {e.objectives.map((o, i) => (
              <li key={o} className={i === 0 && p.complete ? "done" : ""}>
                {o}
                {i === 0 ? <span className="mono small"> ({p.visited} of {p.total})</span> : <span className="muted small"> on your honour</span>}
              </li>
            ))}
          </ul>
        </section>
        <section className="paper" aria-labelledby="pr-h">
          <h2 id="pr-h" className="display">
            journal prompts
          </h2>
          <ul className="prompts">
            {e.prompts.map((pr) => (
              <li key={pr}>
                <a href={href(`/journal/new?prompt=${encodeURIComponent(pr)}&dest=${p.remaining.length < e.destinationIds.length ? e.destinationIds.find((x) => hasVisited(state, x)) : ""}`)}>
                  {pr}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
