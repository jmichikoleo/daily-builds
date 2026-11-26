// frontend/src/pages/Universe.tsx: the home map. the origin in the middle, five places around it,
// projects as satellites, sparkles where new discoveries wait. drag to pan, scroll or pinch to zoom,
// and the time dial at the bottom rebuilds the sky as it was at the end of any month.
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { PlaceArt } from "../components/Art";
import { go, hashNum, month, useData } from "../hooks";
import { Loading } from "../App";

const PLACES = [
  { id: "multiverse", name: "the multiverse", line: "other versions of you", x: 230, y: 190 },
  { id: "museum", name: "the museum", line: "things worth keeping", x: 780, y: 175 },
  { id: "archive", name: "the archive", line: "the historian's files", x: 850, y: 470 },
  { id: "library", name: "the library", line: "the book of you", x: 520, y: 610 },
  { id: "observatory", name: "the observatory", line: "how it all connects", x: 170, y: 485 },
];
const UNKNOWN = { id: "unknown", name: "the unknown room", line: "what the records cannot explain", x: 880, y: 650 };

function monthsFrom(a: string, b: string) {
  const out: string[] = [];
  let [y, m] = a.split("-").map(Number);
  while (`${y}-${String(m).padStart(2, "0")}` <= b) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { y++; m = 1; }
  }
  return out;
}

export default function Universe() {
  const { data } = useData("/api/universe");
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [at, setAt] = useState<string | null>(null);
  const [travel, setTravel] = useState<any>(null);
  const [panel, setPanel] = useState<null | "origin" | "snapshots" | "trail">(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const months = useMemo(() => {
    if (!data?.stats?.first) return [];
    const now = new Date();
    return monthsFrom(data.stats.first.slice(0, 7), `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  }, [data]);

  useEffect(() => {
    if (!at) return setTravel(null);
    api.get(`/api/timetravel?at=${at}`).then(setTravel);
  }, [at]);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => ({ ...v, k: Math.min(3, Math.max(0.6, v.k * (e.deltaY < 0 ? 1.08 : 0.93))) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [data]);

  if (!data) return <Loading />;
  const empty = !data.stats?.records;
  const places = data.places;
  const unknownOpen = places.unknown.open;
  const sats = (data.satellites || []).filter((s: any) => !travel || travel.projects.includes(s.name));

  function down(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) setView((v) => ({ ...v, k: Math.min(3, Math.max(0.6, v.k * (d / pinch.current!))) }));
      pinch.current = d;
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    setView((v) => ({ ...v, x: d.vx + dx / v.k, y: d.vy + dy / v.k }));
  }
  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    if (pointers.current.size === 0) setTimeout(() => (drag.current = null), 0);
  }
  const enter = (id: string) => () => {
    if (drag.current?.moved) return;
    go(`/${id}`);
  };
  const key = (id: string) => (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && go(`/${id}`);
  const origin = data.origin;
  const era = travel ? travel.era : origin.current_era;

  return (
    <div className="universe">
      <header className="universe-head">
        <p className="eyebrow">{travel ? `reconstructed, the end of ${month(at)}` : "now"}</p>
        <h1>{empty ? "a very small universe" : era?.title || "the origin"}</h1>
        {empty ? (
          <p className="lede">nothing has been connected yet, so only the origin glows. open the sources and let it grow, or wander the demo universe of a made up person first.</p>
        ) : (
          <p className="lede">
            {data.stats.records} traces, {data.stats.projects} projects, {data.stats.selves} other selves.
            {data.new_discoveries > 0 && <> <a href="#/inbox">{data.new_discoveries} discoveries</a> are waiting.</>}
          </p>
        )}
      </header>

      <svg
        ref={svg}
        className="map"
        viewBox="0 0 1000 720"
        role="application"
        aria-label="map of your universe. drag to move, scroll to zoom"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <defs>
          <radialGradient id="originGlow">
            <stop offset="0" stopColor="#FFE9AE" stopOpacity=".9" />
            <stop offset=".5" stopColor="#FFD1D3" stopOpacity=".35" />
            <stop offset="1" stopColor="#FFD1D3" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform={`translate(500 360) scale(${view.k}) translate(${-500 + view.x} ${-360 + view.y})`}>
          <Stars n={empty ? 40 : 110} />
          {[150, 215, 285].map((r) => (
            <ellipse key={r} cx="500" cy="360" rx={r * 1.25} ry={r * 0.62} className="orbit-ring" />
          ))}
          {PLACES.map((p) => (
            <path key={p.id} d={`M500 360 Q ${(500 + p.x) / 2 + 40} ${(360 + p.y) / 2 - 40} ${p.x} ${p.y}`} className={`thread ${places[p.id].count ? "" : "dim"}`} />
          ))}
          {unknownOpen && <path d={`M500 360 Q 760 600 ${UNKNOWN.x} ${UNKNOWN.y}`} className="thread unknown-thread" />}

          <g className="satellites">
            {sats.map((s: any, i: number) => {
              const ring = s.status === "active" ? 150 : s.status === "resting" ? 215 : 285;
              const ang = (hashNum(s.key) % 360) * (Math.PI / 180);
              const x = 500 + Math.cos(ang) * ring * 1.25, y = 360 + Math.sin(ang) * ring * 0.62;
              const r = 2.5 + Math.min(7, Math.sqrt(s.commits || 1) / 2.4);
              return (
                <g key={s.key} className={`sat sat-${s.status}`} style={{ animationDelay: `${-(hashNum(s.key) % 40)}s` }}>
                  <circle cx={x} cy={y} r={r}><title>{`${s.name}, ${s.status}`}</title></circle>
                </g>
              );
            })}
          </g>

          <g className="origin" tabIndex={0} role="button" aria-label="the origin, you right now" onClick={() => !drag.current?.moved && setPanel("origin")} onKeyDown={(e) => e.key === "Enter" && setPanel("origin")}>
            <circle cx="500" cy="360" r="90" fill="url(#originGlow)" className="pulse" />
            <circle cx="500" cy="360" r="34" fill="#FFD1D3" stroke="#40364D" strokeWidth="2.5" />
            <ellipse cx="500" cy="372" rx="20" ry="6" fill="#FFE9AE" opacity=".8" />
            <circle cx="490" cy="354" r="2.6" fill="#40364D" />
            <circle cx="510" cy="354" r="2.6" fill="#40364D" />
            <path d="M494 364q6 5 12 0" stroke="#40364D" strokeWidth="2" fill="none" strokeLinecap="round" />
            <text x="500" y="420" textAnchor="middle" className="map-label">the origin</text>
          </g>

          {PLACES.map((p) => {
            const info = places[p.id];
            const quiet = !info.count;
            return (
              <g key={p.id} className={`place ${quiet ? "quiet" : ""}`} transform={`translate(${p.x - 60} ${p.y - 60})`} tabIndex={0} role="link"
                 aria-label={`${p.name}, ${p.line}${info.new ? `, ${info.new} new` : ""}`} onClick={enter(p.id)} onKeyDown={key(p.id)}>
                <rect x="-10" y="-10" width="140" height="160" fill="transparent" />
                <g className="place-art"><PlaceArt place={p.id} lit={!!info.new} /></g>
                <text x="60" y="122" textAnchor="middle" className="map-label">{p.name}</text>
                <text x="60" y="140" textAnchor="middle" className="map-sub">{quiet ? "still empty" : p.line}</text>
                {info.new > 0 && <Sparkle x={104} y={14} n={info.new} />}
              </g>
            );
          })}
          <g className={`place unknown ${unknownOpen ? "" : "sealed"}`} transform={`translate(${UNKNOWN.x - 60} ${UNKNOWN.y - 60})`}
             tabIndex={unknownOpen ? 0 : -1} role="link" aria-label={unknownOpen ? "the unknown room" : "a door you have not found yet"}
             onClick={unknownOpen ? enter("unknown") : undefined} onKeyDown={unknownOpen ? key("unknown") : undefined}>
            <PlaceArt place="unknown" />
            {unknownOpen && <text x="60" y="118" textAnchor="middle" className="map-label">{UNKNOWN.name}</text>}
            {!unknownOpen && <text x="60" y="118" textAnchor="middle" className="map-sub">a door is drawn here, faintly</text>}
          </g>
        </g>
      </svg>

      <div className="map-tools">
        <div className="zoom">
          <button onClick={() => setView((v) => ({ ...v, k: Math.min(3, v.k * 1.2) }))} aria-label="zoom in">+</button>
          <button onClick={() => setView((v) => ({ ...v, k: Math.max(0.6, v.k / 1.2) }))} aria-label="zoom out">−</button>
          <button onClick={() => setView({ x: 0, y: 0, k: 1 })}>center</button>
        </div>
        {months.length > 1 && (
          <div className="dial">
            <label htmlFor="dial">time</label>
            <input id="dial" type="range" min={0} max={months.length - 1} value={at ? months.indexOf(at) : months.length - 1}
                   onChange={(e) => { const m = months[+e.target.value]; setAt(+e.target.value === months.length - 1 ? null : m); }} />
            <span className="dial-label">{at ? month(at) : "now"}</span>
            {at && <button className="link" onClick={() => setAt(null)}>back to now</button>}
          </div>
        )}
        <div className="map-buttons">
          <button className="link" onClick={() => setPanel("snapshots")}>snapshots</button>
          <button className="link" onClick={() => setPanel("trail")}>your trail</button>
          {empty && <a className="btn" href="#/studio">connect sources</a>}
        </div>
      </div>
      {travel && <p className="reconstruction-note">{travel.note}</p>}

      {panel && (
        <div className="drawer-wrap" onClick={() => setPanel(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setPanel(null)}>close</button>
            {panel === "origin" && <OriginPanel origin={origin} travel={travel} />}
            {panel === "snapshots" && <Snapshots list={data.snapshots} eras={data.eras} onPick={(m: string) => { setAt(m); setPanel(null); }} />}
            {panel === "trail" && <Trail />}
          </aside>
        </div>
      )}
    </div>
  );
}

function OriginPanel({ origin, travel }: any) {
  if (travel) {
    return (
      <div>
        <p className="eyebrow">the origin at the end of {month(travel.at)}</p>
        <h2>{travel.era?.title || "between eras"}</h2>
        <p className="muted">{travel.note}</p>
        <h3>who was around</h3>
        <p>{travel.selves.map((s: any) => s.name).join(", ") || "nobody yet"}</p>
        <h3>what was on your mind that year</h3>
        <ul className="plain">{travel.interests.filter((i: any) => i.recent).map((i: any) => <li key={i.label}>{i.label}</li>)}</ul>
        <h3>projects that existed</h3>
        <p>{travel.projects.length} of them</p>
      </div>
    );
  }
  return (
    <div>
      <p className="eyebrow">the origin, you right now</p>
      <h2>{origin.current_era?.title || "no era yet"}</h2>
      {origin.current_era && <p className="muted">since {month(origin.current_era.start)}. era borders are statistical, a life does not change on the first of the month.</p>}
      <h3>selves awake now</h3>
      <ul className="plain">{origin.active_selves.map((s: any) => <li key={s.key}><a href={`#/multiverse/${s.key}`}>{s.name}</a></li>)}</ul>
      {origin.emerging.length > 0 && (<><h3>growing interests</h3><p>{origin.emerging.join(", ")}</p></>)}
      <h3>projects in motion</h3>
      <p>{origin.active_projects.join(", ") || "none right now"}</p>
    </div>
  );
}

function Snapshots({ list, eras, onPick }: any) {
  return (
    <div>
      <p className="eyebrow">time travel</p>
      <h2>snapshots</h2>
      <p className="muted">captured snapshots were saved at the moment they describe. reconstructions are rebuilt today from older records, which may be more complete than anything that existed back then.</p>
      <h3>jump to an era</h3>
      <ul className="plain">{eras.map((e: any) => <li key={e.key}><button className="link" onClick={() => onPick(e.end)}>{e.title}</button> <span className="muted">{month(e.start)} to {month(e.end)}</span></li>)}</ul>
      <h3>captured</h3>
      <ul className="plain">{list.map((s: any) => <li key={s.id}><SnapshotRow s={s} /></li>)}</ul>
    </div>
  );
}

function SnapshotRow({ s }: any) {
  const [d, setD] = useState<any>(null);
  return (
    <div>
      <button className="link" onClick={() => api.get(`/api/snapshots/${s.id}`).then(setD)}>{s.label}</button>
      {d && <p className="muted small">{d.data.stats.records} records, {d.data.selves.join(", ")}</p>}
    </div>
  );
}

function Trail() {
  const { data } = useData("/api/history");
  return (
    <div>
      <p className="eyebrow">exploration history</p>
      <h2>your trail</h2>
      <ol className="plain">{data?.visits.map((v: any, i: number) => <li key={i}>{v.place} <span className="muted">{new Date(v.at.replace(/(\d{2})(\d{2})$/, "$1:$2")).toLocaleString()}</span></li>)}</ol>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  const stars = useMemo(() => Array.from({ length: n }, (_, i) => ({ x: (hashNum("x" + i) % 1400) - 200, y: (hashNum("y" + i) % 1100) - 190, r: (hashNum("r" + i) % 10) / 10 + 0.4, d: hashNum("d" + i) % 6 })), [n]);
  return <g className="stars">{stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} style={{ animationDelay: `${s.d}s` }} />)}</g>;
}

function Sparkle({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g className="sparkle" transform={`translate(${x} ${y})`}>
      <path d="M0-11L3-3 11 0 3 3 0 11-3 3-11 0-3-3z" />
      <text x="14" y="4" className="sparkle-n">{n} new</text>
    </g>
  );
}
