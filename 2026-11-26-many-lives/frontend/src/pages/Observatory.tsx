// frontend/src/pages/Observatory.tsx: the knowledge graph as a sky. interests are planets, projects are
// satellites, selves are moons, favourite artifacts are stars, eras are galaxies on the time band.
// positions come from a force layout over the real edges, so things that share evidence pull together.
// dormant interests drift to the outer dark. click anything, or any line, to see why it is there.
import { forceCenter, forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation } from "d3-force";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { EvidenceButton } from "../components/Evidence";
import { month, useData } from "../hooks";
import { Back, Empty, Loading } from "../App";

const W = 1000, H = 700;
const COLORS: Record<string, string> = { interest: "#FFD1D3", project: "#C8DDF2", self: "#D8C9EE", star: "#FFE9AE" };

export default function Observatory() {
  const [at, setAt] = useState<string | null>(null);
  const { data } = useData(`/api/observatory${at ? `?at=${at}` : ""}`, [at]);
  const { data: full } = useData("/api/observatory");
  const [layout, setLayout] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [edgeSel, setEdgeSel] = useState<any>(null);
  const [show, setShow] = useState({ project: true, self: true, star: true });
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<any>(null);

  const months = useMemo(() => {
    const ms = new Set<string>();
    full?.nodes.forEach((n: any) => n.first && ms.add(n.first));
    return [...ms].sort();
  }, [full]);

  useEffect(() => {
    if (!data) return;
    const nodes = data.nodes.map((n: any) => ({ ...n }));
    const byId = new Map(nodes.map((n: any) => [n.id, n]));
    const links = data.edges.filter((e: any) => byId.has(e.a) && byId.has(e.b)).map((e: any) => ({ ...e, source: e.a, target: e.b }));
    const sim = forceSimulation(nodes)
      .force("link", forceLink(links).id((d: any) => d.id).distance((l: any) => (l.kind === "co-occurs" ? 170 : l.kind === "about" ? 95 : 120)).strength((l: any) => Math.min(1, l.weight + 0.1)))
      .force("charge", forceManyBody().strength((d: any) => (d.type === "interest" ? -520 : -110)))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide((d: any) => radius(d) + 6))
      .force("radial", forceRadial((d: any) => (d.distance === "far" || d.status === "abandoned" || d.status === "historical" ? 330 : d.type === "interest" ? 170 : 250), W / 2, H / 2).strength(0.05))
      .stop();
    for (let i = 0; i < 260; i++) sim.tick();
    setLayout(nodes);
    (window as any).__links = links;
  }, [data]);

  if (!data) return <Loading what="the observatory" />;
  if (!data.nodes.length) return <div className="observatory page"><Back /><Empty>the sky is dark. interests appear as planets once records arrive.</Empty></div>;

  const pos = new Map(layout.map((n) => [n.id, n]));
  const visible = (n: any) => n.type === "interest" || (show as any)[n.type];
  const edges = data.edges.filter((e: any) => pos.has(e.a) && pos.has(e.b) && visible(pos.get(e.a)) && visible(pos.get(e.b)));

  async function pick(n: any) {
    setEdgeSel(null);
    const d = await api.get(`/api/node/${encodeURIComponent(n.id.replace(/^star:/, "artifact:"))}`);
    setSel({ ...n, detail: d });
  }
  async function pickEdge(e: any) {
    setSel(null);
    const d = await api.get(`/api/edge?a=${encodeURIComponent(e.a)}&b=${encodeURIComponent(e.b)}`);
    setEdgeSel({ ...e, detail: d });
  }

  return (
    <div className="observatory page wide">
      <Back />
      <header className="page-head">
        <p className="eyebrow">the observatory</p>
        <h1>how it all connects</h1>
        <p className="lede">every line is a real link between records. thick lines share more evidence. the far dark is where quiet things drift.</p>
      </header>
      <div className="sky-tools">
        {(["project", "self", "star"] as const).map((t) => (
          <label key={t} className="toggle"><input type="checkbox" checked={show[t]} onChange={() => setShow((s) => ({ ...s, [t]: !s[t] }))} /> {t === "project" ? "satellites (projects)" : t === "self" ? "moons (selves)" : "stars (kept artifacts)"}</label>
        ))}
        <span className="legend"><i className="lg-interest" /> planets are interests</span>
      </div>
      <div className="sky-wrap">
        <svg className="sky" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="interest constellation map"
          onPointerDown={(e) => (drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y })}
          onPointerMove={(e) => drag.current && setView((v) => ({ ...v, x: drag.current.vx + (e.clientX - drag.current.x) / v.k, y: drag.current.vy + (e.clientY - drag.current.y) / v.k }))}
          onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}
          onWheel={(e) => setView((v) => ({ ...v, k: Math.min(3, Math.max(0.5, v.k * (e.deltaY < 0 ? 1.08 : 0.93))) }))}>
          <defs>
            <radialGradient id="planet"><stop offset="0" stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
          </defs>
          <circle cx={W / 2} cy={H / 2} r={330} className="far-ring" />
          <text x={W / 2} y={H / 2 - 336} textAnchor="middle" className="far-label">the far dark</text>
          <g transform={`translate(${W / 2} ${H / 2}) scale(${view.k}) translate(${-W / 2 + view.x} ${-H / 2 + view.y})`}>
            {edges.map((e: any, i: number) => {
              const a = pos.get(e.a), b = pos.get(e.b);
              const on = edgeSel && edgeSel.a === e.a && edgeSel.b === e.b;
              return (
                <g key={i} className={`edge edge-${e.kind} ${on ? "on" : ""}`} onClick={() => pickEdge(e)}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="hit" />
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={e.kind === "co-occurs" ? 0.6 + e.weight * 8 : 0.8} />
                </g>
              );
            })}
            {layout.filter(visible).map((n) => (
              <g key={n.id} className={`body body-${n.type} st-${n.status} ${sel?.id === n.id ? "on" : ""}`} transform={`translate(${n.x} ${n.y})`}
                 onClick={() => pick(n)} tabIndex={0} role="button" aria-label={`${n.type} ${n.label}`} onKeyDown={(e) => e.key === "Enter" && pick(n)}>
                {n.type === "interest" && <circle r={radius(n) + 8} fill="url(#planet)" opacity=".35" />}
                {n.type === "star" ? <path d="M0-7L2-2 7 0 2 2 0 7-2 2-7 0-2-2z" fill={COLORS.star} /> :
                  <circle r={radius(n)} fill={n.type === "self" ? n.palette?.[0] || COLORS.self : COLORS[n.type]} />}
                {n.type === "interest" && n.size > 30 && <ellipse rx={radius(n) + 7} ry={3.5} className="planet-ring" transform="rotate(-18)" />}
                {(n.type === "interest" || n.type === "self" || (n.type === "project" && n.size > 40)) && (
                  <text y={radius(n) + 14} textAnchor="middle" className={`sky-label sky-${n.type}`}>{n.label}</text>
                )}
              </g>
            ))}
          </g>
        </svg>
        <aside className="sky-panel" aria-live="polite">
          {!sel && !edgeSel && (
            <div>
              <p className="eyebrow">constellations</p>
              {data.constellations.length ? data.constellations.map((c: any) => (
                <div key={c.key} className="con"><strong>{c.title}</strong><p className="muted small">{c.labels.join(", ")}</p></div>
              )) : <p className="muted">no constellations yet. interests need to share records first.</p>}
              <p className="muted small">pick a planet or a line.</p>
            </div>
          )}
          {sel && <NodePanel n={sel} />}
          {edgeSel && (
            <div>
              <p className="eyebrow">why these are connected</p>
              <h3>{edgeSel.detail.a.title} and {edgeSel.detail.b.title}</h3>
              {edgeSel.detail.edges.map((e: any, i: number) => <p key={i}>{e.why} <span className="muted small">({e.kind}, strength {e.weight})</span></p>)}
              <EvidenceButton ids={edgeSel.detail.evidence} title="the shared evidence" />
            </div>
          )}
        </aside>
      </div>
      {months.length > 1 && (
        <div className="timeband">
          <div className="galaxies">
            {(full?.galaxies || []).map((g: any) => {
              const a = months.indexOf(g.start), b = months.indexOf(g.end);
              const left = (Math.max(0, a) / (months.length - 1)) * 100;
              const right = ((b < 0 ? months.length - 1 : b) / (months.length - 1)) * 100;
              return <span key={g.key} className="galaxy" style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%` }} title={g.title}>{g.title}</span>;
            })}
          </div>
          <input type="range" min={0} max={months.length - 1} value={at ? months.indexOf(at) : months.length - 1} aria-label="move through time"
                 onChange={(e) => setAt(+e.target.value === months.length - 1 ? null : months[+e.target.value])} />
          <p className="muted small">{at ? <>the sky at the end of {month(at)}. {data.note}.</> : "the sky now. slide back to watch it form."}</p>
        </div>
      )}
    </div>
  );
}

function radius(n: any) {
  if (n.type === "interest") return 8 + Math.min(26, Math.sqrt(n.size || 1) * 1.6);
  if (n.type === "project") return 3 + Math.min(9, Math.sqrt(n.size || 1) / 1.8);
  if (n.type === "self") return 9;
  return 5;
}

function NodePanel({ n }: { n: any }) {
  const o = n.detail.node;
  const ms = o.monthly ? (Object.entries(o.monthly) as [string, number][]) : [];
  const max = Math.max(1, ...ms.map(([, v]) => v));
  const link = n.type === "project" ? `#/artifact/project-${o.key}` : n.type === "self" ? `#/multiverse/${o.key}` : n.type === "star" ? `#/artifact/${o.key}` : null;
  return (
    <div>
      <p className="eyebrow">{n.type === "interest" ? `a planet, ${o.status}` : n.type === "project" ? `a satellite, ${o.status}` : n.type === "self" ? "a moon" : "a star"}</p>
      <h3>{n.label}</h3>
      {o.terms && <p className="muted small">words that define it {o.terms.join(", ")}</p>}
      {o.first_seen && <p>{month(o.first_seen)} to {month(o.last_seen)}, {o.records} records</p>}
      {o.description && <p>{o.description}</p>}
      {ms.length > 0 && <div className="sparkbars small">{ms.map(([m, v]) => <span key={m} style={{ height: `${(v / max) * 100}%` }} title={`${month(m)}, ${v}`} />)}</div>}
      <h4>connected to</h4>
      <ul className="plain small">{n.detail.links.slice(0, 10).map((l: any, i: number) => <li key={i}>{l.why}</li>)}</ul>
      {o.evidence && <EvidenceButton ids={o.evidence} title={n.label} />}
      {n.type === "interest" && (
        <p className="row wrap small">
          <button className="link" onClick={async () => { const v = prompt("what would you call this interest?", n.label); if (v !== null) { await api.post("/api/annotate", { target: n.id, field: "name", value: v.trim() || null }); location.reload(); } }}>rename it</button>
          <button className="link" onClick={async () => { if (confirm(`is ${n.label} not really an interest of yours? its words will be left out of the next rebuild.`)) { await api.post("/api/corrections", { target: n.id, verdict: "reject" }); await api.post("/api/rebuild"); location.reload(); } }}>this is not me</button>
        </p>
      )}
      {link && <p><a href={link}>open it</a></p>}
    </div>
  );
}
