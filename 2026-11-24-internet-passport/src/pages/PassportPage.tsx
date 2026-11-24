// src/pages/PassportPage.tsx
// the passport booklet. a cover that opens, an identity page and stamp pages
// you can flip through (buttons, arrow keys or swipe), plus a collection view
// of every stamp in the catalog and png export.

import { useEffect, useMemo, useRef, useState } from "react";
import { usePassport, useReducedMotion } from "../lib/store";
import { STAMPS, stampById } from "../data/stamps";
import { destination } from "../data/destinations";
import { ACHIEVEMENTS } from "../data/achievements";
import { expedition } from "../data/expeditions";
import { TERRITORIES, territory } from "../data/territories";
import { explorerTitle } from "../lib/logic";
import { niceDate } from "../lib/format";
import { href } from "../lib/router";
import { CatalogStamp, ClosedPassport, CoverEmblem, Modal, RarityTag } from "../components/bits";
import type { CollectedStamp, PassportState } from "../types";

const PER_PAGE = 6;

function useWide() {
  const q = "(min-width: 880px)";
  const [wide, setWide] = useState(() => (typeof matchMedia !== "undefined" ? matchMedia(q).matches : true));
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

function jitter(seed: string, range: number) {
  let h = 7;
  for (const c of seed) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * 2 * range;
}

function StampDetail({ stampId, onClose }: { stampId: string; onClose: () => void }) {
  const { state } = usePassport();
  const s = stampById(stampId)!;
  const got = state.stamps[stampId];
  const d = s.kind === "destination" ? destination(s.sourceId) : undefined;
  const visit = d ? state.visits.find((v) => v.destinationId === d.id) : undefined;
  const ach = s.kind === "achievement" ? ACHIEVEMENTS.find((a) => a.id === s.sourceId) : undefined;
  const exp = s.kind === "expedition" ? expedition(s.sourceId) : undefined;
  const locked = !got;
  const mystery = locked && (s.rarity === "secret" || (d?.territory === "hidden" && !state.unlockedSecrets[d.id]));
  return (
    <Modal title={mystery ? "an unknown stamp" : s.name} onClose={onClose}>
      <div className="stamp-detail">
        <CatalogStamp stampId={stampId} earnedAt={got?.earnedAt} size={200} faded={locked} mystery={mystery} />
        <div>
          <p>
            <RarityTag rarity={s.rarity} />
          </p>
          {got ? <p className="mono small">collected {niceDate(got.earnedAt)}</p> : <p className="mono small">not collected yet</p>}
          {d && !mystery && (
            <>
              <p>
                {territory(d.territory).name}. {d.description}
              </p>
              {visit?.reflection && <blockquote className="handwritten">{visit.reflection}</blockquote>}
              <a className="btn btn-small" href={href(`/destination/${d.id}`)} onClick={onClose}>
                {got ? "see the destination" : "go to the gate"}
              </a>
            </>
          )}
          {ach && <p>{got ? ach.description : ach.rarity === "secret" ? ach.hint : `${ach.description} ${ach.hint}`}</p>}
          {exp && (
            <>
              <p>awarded for finishing expedition {String(exp.number).padStart(3, "0")}, {exp.title.toLowerCase()}.</p>
              <a className="btn btn-small" href={href(`/expeditions/${exp.id}`)} onClick={onClose}>
                see the expedition
              </a>
            </>
          )}
          {s.kind === "territory" && (
            <>
              <p>awarded for visiting every destination in {territory(s.sourceId as never).name.toLowerCase()}.</p>
              <a className="btn btn-small" href={href(`/atlas/${s.sourceId}`)} onClick={onClose}>
                see the territory
              </a>
            </>
          )}
          {s.kind === "welcome" && <p>issued by the department of internet exploration on the day your passport was made.</p>}
        </div>
      </div>
    </Modal>
  );
}

function IdentityPage({ state, onEmblem }: { state: PassportState; onEmblem: () => void }) {
  const p = state.profile!;
  const mrz1 = `IP<WWW${p.name.toUpperCase().replace(/[^A-Z]/g, "<")}`.padEnd(40, "<").slice(0, 40);
  const mrz2 = `${p.passportNumber.replace(/-/g, "")}<<FICTIONAL<COLLECTIBLE`.padEnd(40, "<").slice(0, 40);
  return (
    <div className="pp-page identity">
      <div className="guilloche" aria-hidden="true" />
      <header className="identity-head">
        <span>internet passport</span>
        <span className="mono">{p.passportNumber}</span>
      </header>
      <div className="identity-body">
        <div className="photo-frame">
          {p.photo ? <img src={p.photo} alt={`photograph of ${p.name}`} /> : <span aria-hidden="true">{p.name[0]?.toUpperCase()}</span>}
        </div>
        <dl>
          <dt>name</dt>
          <dd>{p.name}</dd>
          <dt>alias</dt>
          <dd>{p.alias || "none on file"}</dd>
          <dt>home</dt>
          <dd>{p.homeCountry || "the internet"}</dd>
          <dt>date of issue</dt>
          <dd>{niceDate(p.issuedAt)}</dd>
          <dt>classification</dt>
          <dd>{p.classification}</dd>
          <dt>explorer title</dt>
          <dd>{explorerTitle(state.visits.length)}</dd>
        </dl>
      </div>
      {p.motto && <p className="motto handwritten">"{p.motto}"</p>}
      <div className="identity-foot">
        <button type="button" className="mini-emblem" onClick={onEmblem} aria-label="department seal">
          <CoverEmblem />
        </button>
        <p className="tiny">a fictional digital collectible. not an official identity document.</p>
      </div>
      <div className="mrz mono" aria-label="decorative machine readable zone">
        <span>{mrz1}</span>
        <span>{mrz2}</span>
      </div>
    </div>
  );
}

function InsideCover({ state }: { state: PassportState }) {
  return (
    <div className="pp-page inside-cover">
      <div className="guilloche" aria-hidden="true" />
      <CoverEmblem />
      <p className="kicker">the department of internet exploration</p>
      <p className="handwritten big-hand">requests all websites to let the bearer pass freely, and to show them something wonderful.</p>
      <ol className="rules small">
        <li>stamps are given on the honour system.</li>
        <li>one stamp per destination, forever.</li>
        <li>wander more than you scroll.</li>
      </ol>
      <p className="tiny">
        bearer since {niceDate(state.profile!.issuedAt)}. this booklet is fictional, playful and private to this browser.
      </p>
    </div>
  );
}

function StampPage({ items, page, onPick }: { items: CollectedStamp[]; page: number; onPick: (id: string) => void }) {
  return (
    <div className="pp-page stamps-page">
      <div className="guilloche faint" aria-hidden="true" />
      <span className="page-no mono">visas {String(page).padStart(2, "0")}</span>
      {items.length === 0 && <p className="handwritten empty-page">space for future adventures</p>}
      <div className="stamp-scatter">
        {items.map((c, i) => {
          const s = stampById(c.stampId)!;
          const dx = jitter(c.stampId + "x", 14);
          const dy = jitter(c.stampId + "y", 12);
          const rot = jitter(c.stampId + "r", 7);
          return (
            <button
              key={c.stampId}
              className={`scatter-slot slot-${i}`}
              style={{ transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)` }}
              onClick={() => onPick(c.stampId)}
              aria-label={`${s.name}, ${s.rarity} stamp, collected ${niceDate(c.earnedAt)}`}
            >
              <CatalogStamp stampId={c.stampId} earnedAt={c.earnedAt} size="100%" title="" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Book() {
  const { state, discover } = usePassport();
  const reduced = useReducedMotion();
  const wide = useWide();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [pick, setPick] = useState<string | null>(null);
  const touch = useRef<number | null>(null);
  const p = state.profile!;

  const collected = useMemo(
    () => Object.values(state.stamps).sort((a, b) => a.earnedAt.localeCompare(b.earnedAt) || a.stampId.localeCompare(b.stampId)),
    [state.stamps],
  );
  const stampPages = Math.max(2, Math.ceil(collected.length / PER_PAGE) + (collected.length % PER_PAGE === 0 ? 1 : 0));
  const pages = [
    <InsideCover key="inside" state={state} />,
    <IdentityPage key="id" state={state} onEmblem={() => discover("emblem")} />,
    ...Array.from({ length: stampPages }, (_, i) => (
      <StampPage key={`s${i}`} page={i + 1} items={collected.slice(i * PER_PAGE, i * PER_PAGE + PER_PAGE)} onPick={setPick} />
    )),
  ];
  if (pages.length % 2) pages.push(<StampPage key="extra" page={stampPages + 1} items={[]} onPick={setPick} />);

  const max = wide ? pages.length / 2 - 1 : pages.length - 1;
  const at = Math.min(index, max);

  const goTo = (n: number) => {
    const next = Math.max(0, Math.min(max, n));
    if (next === at) return;
    setDir(next > at ? "next" : "prev");
    setIndex(next);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "ArrowRight") goTo(at + 1);
      if (e.key === "ArrowLeft") goTo(at - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) {
    return (
      <div className="book-stage">
        <button className={`booklet-btn ${reduced ? "" : "wobble"}`} onClick={() => setOpen(true)} aria-label="open your passport">
          <ClosedPassport color={p.coverColor} name={p.name} number={p.passportNumber} stamps={collected.length} />
        </button>
        <p className="muted small center">tap the cover to open</p>
      </div>
    );
  }

  const shown = wide ? [pages[at * 2], pages[at * 2 + 1]] : [pages[at]];
  const label = wide ? `pages ${at * 2 + 1} and ${at * 2 + 2} of ${pages.length}` : `page ${at + 1} of ${pages.length}`;

  return (
    <div className="book-stage">
      <div
        className={`book open ${wide ? "spread" : "single"}`}
        style={{ ["--cover" as string]: p.coverColor }}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 50) goTo(at + (dx < 0 ? 1 : -1));
        }}
        aria-roledescription="passport booklet"
        aria-label={label}
      >
        {shown.map((pg, i) => (
          <div key={`${at}-${i}`} className={`leaf leaf-${i === 0 && wide ? "left" : "right"} ${reduced ? "" : `turn-${dir}`}`}>
            {pg}
          </div>
        ))}
      </div>
      <div className="book-controls">
        <button className="btn" onClick={() => goTo(at - 1)} disabled={at === 0} aria-label="previous page">
          ← back
        </button>
        <span className="mono small" aria-live="polite">
          {label}
        </span>
        <button className="btn" onClick={() => goTo(at + 1)} disabled={at === max} aria-label="next page">
          next →
        </button>
      </div>
      <div className="row center wrap">
        <button className="btn btn-quiet" onClick={() => { setOpen(false); setIndex(0); }}>
          close the passport
        </button>
        <button className="btn btn-quiet" onClick={() => goTo(wide ? 1 : 2)}>
          jump to stamps
        </button>
        <button className="btn btn-quiet" onClick={() => goTo(max)}>
          latest page
        </button>
      </div>
      {pick && <StampDetail stampId={pick} onClose={() => setPick(null)} />}
    </div>
  );
}

function Collection() {
  const { state } = usePassport();
  const [pick, setPick] = useState<string | null>(null);
  const groups: { title: string; ids: string[] }[] = [
    { title: "special achievements", ids: STAMPS.filter((s) => s.kind === "achievement" || s.kind === "welcome").map((s) => s.id) },
    { title: "territory completion", ids: STAMPS.filter((s) => s.kind === "territory").map((s) => s.id) },
    { title: "expedition seals", ids: STAMPS.filter((s) => s.kind === "expedition").map((s) => s.id) },
    ...TERRITORIES.map((t) => ({
      title: t.name.toLowerCase(),
      ids: STAMPS.filter((s) => s.kind === "destination" && destination(s.sourceId)?.territory === t.id).map((s) => s.id),
    })),
  ];
  const total = STAMPS.length;
  const have = Object.keys(state.stamps).length;
  return (
    <div className="collection">
      <p className="lede">
        {have} of {total} stamps collected. faded stamps are still out there.
      </p>
      {groups.map((g) => {
        const got = g.ids.filter((id) => state.stamps[id]).length;
        return (
          <section key={g.title} className="collection-group" aria-label={g.title}>
            <h2 className="display">
              {g.title} <span className="mono small">{got} of {g.ids.length}</span>
            </h2>
            <ul className="collection-grid">
              {g.ids.map((id) => {
                const s = stampById(id)!;
                const c = state.stamps[id];
                const d = s.kind === "destination" ? destination(s.sourceId) : undefined;
                const mystery = !c && (s.rarity === "secret" || (d?.territory === "hidden" && !state.unlockedSecrets[d.id]));
                return (
                  <li key={id}>
                    <button className="collection-cell" onClick={() => setPick(id)} aria-label={`${mystery ? "unknown stamp" : s.name}, ${c ? "collected" : "not collected yet"}`}>
                      <CatalogStamp stampId={id} earnedAt={c?.earnedAt} size={92} faded={!c} mystery={mystery} title="" />
                      <span className="small">{mystery ? "???" : s.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {pick && <StampDetail stampId={pick} onClose={() => setPick(null)} />}
    </div>
  );
}

export function PassportPage({ view }: { view: "book" | "collection" }) {
  const { state } = usePassport();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setError("");
    try {
      await fn();
    } catch {
      setError("the image could not be made in this browser. try again, or try another browser.");
    } finally {
      setBusy("");
    }
  };
  return (
    <main id="main" className="page passport-page" tabIndex={-1}>
      <header className="page-head">
        <p className="kicker">my passport</p>
        <h1 className="display big">{view === "book" ? "your passport" : "the stamp collection"}</h1>
        <div className="segmented" role="group" aria-label="passport view">
          <a href={href("/passport")} aria-current={view === "book" ? "page" : undefined}>
            booklet
          </a>
          <a href={href("/passport/collection")} aria-current={view === "collection" ? "page" : undefined}>
            all stamps
          </a>
        </div>
      </header>
      {view === "book" ? <Book /> : <Collection />}
      <section className="export paper" aria-labelledby="export-h">
        <h2 id="export-h" className="display">
          take it with you
        </h2>
        <p className="small">save your identity page or your whole stamp sheet as an image. it is made in your browser.</p>
        <div className="row wrap">
          <button className="btn" disabled={Boolean(busy)} onClick={() => run("card", async () => (await import("../lib/exportImage")).exportIdentityCard(state))}>
            {busy === "card" ? "printing..." : "save identity card as png"}
          </button>
          <button className="btn" disabled={Boolean(busy)} onClick={() => run("sheet", async () => (await import("../lib/exportImage")).exportStampSheet(state))}>
            {busy === "sheet" ? "printing..." : "save stamp sheet as png"}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
