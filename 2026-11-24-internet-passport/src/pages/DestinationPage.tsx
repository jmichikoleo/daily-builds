// src/pages/DestinationPage.tsx
// the travel flow for one destination:
// info -> boarding pass -> depart (new tab) -> come back -> confirm on your honour
// -> optional reflection -> stamp ceremony.

import { useEffect, useState } from "react";
import { usePassport } from "../lib/store";
import { destination } from "../data/destinations";
import { territory } from "../data/territories";
import { EXPEDITIONS } from "../data/expeditions";
import { hasVisited, isOpen, uid, localDateKey } from "../lib/logic";
import { BoardingPass } from "../components/BoardingPass";
import { FavoriteButton } from "../components/DestinationCard";
import { CatalogStamp, Empty, RarityTag, Warnings } from "../components/bits";
import { host, niceDate, plural } from "../lib/format";
import { href } from "../lib/router";

export function DestinationPage({ id }: { id: string }) {
  const { state, depart, visit, cancelDeparture, saveJournal } = usePassport();
  const d = destination(id);
  const [reflection, setReflection] = useState("");
  const [toJournal, setToJournal] = useState(false);
  const [honour, setHonour] = useState(false);
  const [back, setBack] = useState(false);

  const away = state.departure?.destinationId === id;

  // notice when the explorer comes back to this tab
  useEffect(() => {
    if (!away) return;
    const on = () => {
      if (document.visibilityState === "visible") setBack(true);
    };
    document.addEventListener("visibilitychange", on);
    window.addEventListener("focus", on);
    return () => {
      document.removeEventListener("visibilitychange", on);
      window.removeEventListener("focus", on);
    };
  }, [away]);

  if (!d) {
    return (
      <main id="main" className="page" tabIndex={-1}>
        <Empty title="no such destination">
          <p>this gate is not on the board. maybe it was renamed, or it never existed.</p>
          <a className="btn" href={href("/atlas")}>
            browse the atlas
          </a>
        </Empty>
      </main>
    );
  }

  const t = territory(d.territory);
  const open = isOpen(state, d);
  const visited = hasVisited(state, d.id);
  const visitRecord = state.visits.find((v) => v.destinationId === d.id);
  const earned = state.stamps[`dest:${d.id}`]?.earnedAt;
  const inExpeditions = EXPEDITIONS.filter((e) => e.destinationIds.includes(d.id));

  if (!open) {
    return (
      <main id="main" className="page narrow" tabIndex={-1}>
        <a className="back" href={href("/atlas/hidden")}>
          back to the hidden territories
        </a>
        <div className="paper notice locked-notice">
          <CatalogStamp stampId={`dest:${d.id}`} size={120} faded mystery title="unknown stamp" />
          <h1 className="display">a place not yet on your map</h1>
          <p className="handwritten">{d.secret?.hint}</p>
          <p className="muted small">keep exploring. it will reveal itself when the time is right.</p>
        </div>
      </main>
    );
  }

  const confirm = () => {
    const r = visit(d.id, reflection);
    if (r.ok && toJournal && reflection.trim()) {
      saveJournal({
        id: uid(),
        destinationId: d.id,
        date: localDateKey(new Date()),
        rating: 0,
        favorite: "",
        reflection: `${d.question}\n\n${reflection.trim()}`,
        tags: [],
        revisit: false,
        createdAt: "",
        updatedAt: "",
      });
    }
    setHonour(false);
    setBack(false);
  };

  const showConfirm = !visited && (away || honour);

  return (
    <main id="main" className="page destination-page" tabIndex={-1} style={{ ["--accent" as string]: t.color, ["--ink-accent" as string]: t.ink }}>
      <a className="back" href={href(`/atlas/${d.territory}`)}>
        back to {t.short}
      </a>

      <header className="dest-head">
        <div>
          <p className="kicker">
            {t.name}, gate {t.code}
          </p>
          <h1 className="display big">{d.name}</h1>
          <p className="mono dest-host">{host(d.url)}</p>
          <p className="lede">{d.description}</p>
          <div className="row wrap">
            <RarityTag rarity={d.rarity} />
            <span className="mono small">about {plural(d.minutes, "minute")}</span>
            <FavoriteButton id={d.id} name={d.name} />
          </div>
          <ul className="tags" aria-label="tags">
            {d.tags.map((tag) => (
              <li key={tag}>
                <a href={href(`/atlas?tag=${encodeURIComponent(tag)}`)}>{tag}</a>
              </li>
            ))}
          </ul>
          <Warnings list={d.warnings} />
          <p className="access small">{d.access ? d.access.text : "free to explore, no account needed"}</p>
          {inExpeditions.length > 0 && (
            <p className="small">
              part of{" "}
              {inExpeditions.map((e, i) => (
                <span key={e.id}>
                  {i > 0 && " and "}
                  <a href={href(`/expeditions/${e.id}`)}>{e.title.toLowerCase()}</a>
                </span>
              ))}
            </p>
          )}
        </div>
        <figure className="dest-stamp">
          <CatalogStamp stampId={`dest:${d.id}`} earnedAt={earned} size={170} faded={!visited} title={visited ? `your stamp from ${d.name}` : `stamp preview for ${d.name}`} />
          <figcaption className="small muted">{visited ? `stamped ${niceDate(earned!)}` : "stamp preview"}</figcaption>
        </figure>
      </header>

      {visited ? (
        <section className="paper visited-panel" aria-labelledby="vis-h">
          <h2 id="vis-h" className="display">
            you have been here
          </h2>
          <p>
            stamped on {niceDate(visitRecord!.visitedAt)}. revisits are always welcome, but each place gives one stamp, so your passport stays honest.
          </p>
          {visitRecord?.reflection && <blockquote className="handwritten">{visitRecord.reflection}</blockquote>}
          <div className="row wrap">
            <a className="btn btn-primary" href={d.url} target="_blank" rel="noopener noreferrer">
              visit again in a new tab
            </a>
            <a className="btn" href={href(`/journal/new?dest=${d.id}`)}>
              write a journal postcard
            </a>
          </div>
        </section>
      ) : (
        <section className="flight" aria-labelledby="flight-h">
          <h2 id="flight-h" className="visually-hidden">
            your boarding pass
          </h2>
          <BoardingPass d={d} />
          {!showConfirm && (
            <div className="depart-row">
              <a
                className="btn btn-primary btn-big"
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => depart(d.id)}
              >
                depart for {host(d.url)}
              </a>
              <p className="muted small">
                the website opens in a new tab. explore as long as you like, then come back here to get your stamp.
              </p>
              <button className="link-btn small" onClick={() => setHonour(true)}>
                been here before? confirm without departing
              </button>
            </div>
          )}

          {showConfirm && (
            <div className="paper confirm-panel" role="region" aria-labelledby="confirm-h">
              <h3 id="confirm-h" className="display">
                {back ? "welcome back, traveller" : away ? "bon voyage" : "a visit from memory"}
              </h3>
              <p>
                {away
                  ? `${d.name} is open in another tab. when you have had a proper look around, confirm your visit below.`
                  : "if you have explored this place before, you can confirm it now."}{" "}
                the passport runs on the honour system. opening a link does not prove anything, and nobody is checking.
              </p>
              <label className="field">
                <span className="field-q">
                  {d.question} <em>optional</em>
                </span>
                <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={3} maxLength={2000} placeholder="a line or two for future you" />
              </label>
              <label className="check">
                <input type="checkbox" checked={toJournal} onChange={(e) => setToJournal(e.target.checked)} disabled={!reflection.trim()} />
                also keep this as a postcard in my travel journal
              </label>
              <div className="row wrap">
                <button className="btn btn-primary btn-big" onClick={confirm}>
                  i explored it, stamp my passport
                </button>
                {away && (
                  <a className="btn" href={d.url} target="_blank" rel="noopener noreferrer">
                    reopen the website
                  </a>
                )}
                <button
                  className="btn btn-quiet"
                  onClick={() => {
                    if (away) cancelDeparture();
                    setHonour(false);
                  }}
                >
                  not yet
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
