// frontend/src/pages/Studio.tsx: the data sources studio. discover, approve, sync, pause, preview, delete.
// nothing is read until you approve it. folder sources only read the folders you list here.
import { useState } from "react";
import { api } from "../api";
import { day, useData } from "../hooks";
import { Back, Loading } from "../App";

const STATUS_WORDS: Record<string, string> = {
  discovered: "discovered", available: "available to connect", "available to connect": "available to connect",
  "authorization required": "authorization required", "export required": "export required", importing: "importing",
  connected: "connected", "partially available": "partially available", "synchronization failed": "synchronization failed", unsupported: "unsupported",
};

export default function Studio() {
  const { data, reload } = useData("/api/sources");
  const [tab, setTab] = useState<"sources" | "activity" | "safety">("sources");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  if (!data) return <Loading what="the studio" />;

  async function act(label: string, fn: () => Promise<any>) {
    setBusy(label); setMsg("");
    try {
      const r = await fn();
      if (r?.status === "failed") setMsg(`that sync failed. ${r.error}`);
      else if (r?.added !== undefined) setMsg(`done. ${r.added} new, ${r.updated} changed, ${r.skipped} unchanged.`);
    } catch (e: any) { setMsg(e.message); }
    setBusy(""); reload();
  }

  const connected = data.sources.filter((s: any) => s.state.enabled);
  const groups = ["code", "projects", "conversations", "music", "google", "files", "academic"];

  return (
    <div className="studio page">
      <Back />
      <header className="page-head">
        <p className="eyebrow">data sources studio</p>
        <h1>where the universe comes from</h1>
        <p className="lede">{connected.length ? `${connected.length} sources connected, ${data.stats?.records || 0} records.` : "nothing connected yet. start with discover, then approve what you are comfortable with."}
          {data.universe === "demo" && " you are in the demo universe, changes here do not touch your real one."}</p>
        <div className="row wrap">
          <button className="btn" disabled={!!busy} onClick={() => act("discover", () => api.post("/api/sources/discover"))}>{busy === "discover" ? "looking around" : "discover available sources"}</button>
          <button className="btn ghost" disabled={!!busy} onClick={() => act("rebuild", () => api.post("/api/rebuild"))}>{busy === "rebuild" ? "rebuilding" : "rebuild discoveries"}</button>
          <button className="link" onClick={() => act("pause", () => api.post("/api/pause-all", { paused: !data.paused_all }))}>{data.paused_all ? "resume all automatic syncing" : "pause all automatic syncing"}</button>
        </div>
        {msg && <p className="notice" role="status">{msg}</p>}
        {data.paused_all && <p className="notice">automatic syncing is paused everywhere.</p>}
      </header>
      <div className="tabs">
        {(["sources", "activity", "safety"] as const).map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t === "sources" ? "sources" : t === "activity" ? "sync log" : "backups and audit"}</button>)}
      </div>
      {tab === "sources" && (
        <>
          <p className="muted small">official exports go in the inbox folder <code>{data.inbox}</code>. drop the zip there and the matching importer picks it up within the hour, or press sync.</p>
          {groups.map((g) => {
            const list = data.sources.filter((s: any) => s.group === g);
            if (!list.length) return null;
            return (
              <section key={g} className="source-group">
                <h2 className="section-title">{g}</h2>
                {list.map((s: any) => <Source key={s.id} s={s} busy={busy} act={act} />)}
              </section>
            );
          })}
          <section className="source-group">
            <h2 className="section-title">not built yet, or not possible</h2>
            <p className="muted small">listed honestly so nothing pretends to work. sensitive ones stay off unless you ask for them separately.</p>
            <ul className="planned">{data.planned.map((p: any) => <li key={p.id}><strong>{p.name}</strong> <span className={`status s-unsupported`}>{p.group === "sensitive" ? "off, sensitive" : "unsupported"}</span> <span className="muted small">{p.notes}</span></li>)}</ul>
          </section>
        </>
      )}
      {tab === "activity" && <Jobs />}
      {tab === "safety" && <Safety universe={data.universe} />}
    </div>
  );
}

function Source({ s, busy, act }: any) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const [cats, setCats] = useState<string[]>(s.state.categories || []);
  const [preview, setPreview] = useState<any>(null);
  const st = s.state;
  const status = st.enabled ? (st.paused ? "paused" : st.status) : st.status || "discovered";
  const approve = (paths: string[]) => act(`approve-${s.id}`, () => api.post(`/api/sources/${s.id}/approve`, { paths, categories: cats }));

  return (
    <article className={`source ${st.enabled ? "on" : ""}`}>
      <header onClick={() => setOpen(!open)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(!open)} aria-expanded={open}>
        <div>
          <strong>{s.name}</strong>
          <span className={`status s-${status.replace(/\s/g, "-")}`}>{STATUS_WORDS[status] || status}</span>
          {s.privacy === "sensitive" && <span className="status s-sensitive">sensitive</span>}
        </div>
        <span className="muted small">{st.records ? `${st.records} records, ${day(st.earliest)} to ${day(st.latest)}` : st.coverage || s.method}</span>
      </header>
      {open && (
        <div className="source-body">
          <dl className="facts">
            <dt>method</dt><dd>{s.method}, {s.auth}</dd>
            <dt>data</dt><dd>{s.data_types.join(", ")}</dd>
            <dt>permissions</dt><dd>{s.permissions}</dd>
            <dt>first import</dt><dd>{s.initial}</dd>
            <dt>later syncs</dt><dd>{s.incremental}, every {s.interval_hours < 1 ? `${s.interval_hours * 60} minutes` : `${s.interval_hours} hours`}</dd>
            <dt>last sync</dt><dd>{st.last_sync ? day(st.last_sync.replace(/(\d{2})(\d{2})$/, "$1:$2")) : "never"}{st.next_sync && st.enabled ? `, next ${day(st.next_sync)}` : ""}</dd>
            {st.last_error && (<><dt>error</dt><dd className="error">{st.last_error}</dd></>)}
            {s.validated && (<><dt>tested</dt><dd>{s.validated}</dd></>)}
            {s.notes && (<><dt>note</dt><dd>{s.notes}</dd></>)}
          </dl>
          {s.categories.length > 0 && (
            <fieldset className="cats">
              <legend>what it may read</legend>
              {s.categories.map((c: any) => (
                <label key={c.id} className="toggle"><input type="checkbox" checked={cats.includes(c.id)} onChange={() => setCats((x) => x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id])} /> {c.label}</label>
              ))}
            </fieldset>
          )}
          {s.needs_paths && (
            <div className="paths">
              <p className="small">approved folders, read only</p>
              <ul className="plain">{s.paths.map((p: string) => <li key={p}><code>{p}</code> <button className="link small" onClick={() => act("unpath", () => api.post(`/api/sources/${s.id}/unapprove-path`, { path: p }))}>remove</button></li>)}</ul>
              {!s.paths.length && <p className="muted small">no folder approved. suggestions {s.suggested_paths.map((p: string) => <button key={p} className="link" onClick={() => setPath(p)}>{p}</button>)}</p>}
              <form className="row" onSubmit={(e) => { e.preventDefault(); if (path) { approve([path]); setPath(""); } }}>
                <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="~/Documents/notes" aria-label="folder to approve" />
                <button className="btn small" disabled={!path}>approve folder</button>
              </form>
            </div>
          )}
          <div className="row wrap actions">
            {!st.enabled && s.implemented && !s.needs_paths && status !== "unsupported" && <button className="btn small" onClick={() => approve([])}>connect</button>}
            {s.id === "spotify_api" && !st.enabled && <a className="btn small" href="/api/spotify/login">authorize with spotify</a>}
            {st.enabled && <button className="btn small" disabled={!!busy} onClick={() => act(`sync-${s.id}`, () => api.post(`/api/sources/${s.id}/sync`))}>{busy === `sync-${s.id}` ? "syncing" : "sync now"}</button>}
            {st.enabled && s.categories.length > 0 && <button className="link" onClick={() => approve([])}>save permissions</button>}
            {st.enabled && <button className="link" onClick={() => act("p", () => api.post(`/api/sources/${s.id}/${st.paused ? "resume" : "pause"}`))}>{st.paused ? "resume" : "pause"}</button>}
            {st.records > 0 && <button className="link" onClick={async () => setPreview(await api.get(`/api/sources/${s.id}/preview`))}>preview records</button>}
            {st.enabled && <button className="link" onClick={() => confirm(`disconnect ${s.name}? imported records stay until you delete them.`) && act("d", () => api.post(`/api/sources/${s.id}/disconnect`))}>disconnect</button>}
            {st.records > 0 && <button className="link danger" onClick={() => confirm(`delete all ${st.records} records from ${s.name}? everything built from them is rebuilt. this cannot be undone, except by restoring a backup.`) && act("del", () => api.del(`/api/sources/${s.id}/data`))}>delete imported data</button>}
          </div>
          {preview && (
            <div className="preview">
              <p className="small">{preview.kinds.map((k: any) => `${k.n} ${k.kind}`).join(", ")}</p>
              <ol className="plain small">{preview.records.map((r: any) => (
                <li key={r.id}><time className="muted">{day(r.ts)}</time> <strong>{r.title}</strong> {r.sensitive ? <span className="status s-sensitive">sensitive</span> : <span className="muted">{(r.body || "").slice(0, 120)}</span>}
                  <button className="link small" onClick={async () => { await api.post(`/api/records/${r.id}/hide`, { hidden: !r.hidden }); setPreview(await api.get(`/api/sources/${s.id}/preview`)); }}>{r.hidden ? "unhide" : "hide"}</button></li>
              ))}</ol>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Jobs() {
  const { data } = useData("/api/jobs");
  if (!data) return <Loading what="the log" />;
  return (
    <table className="jobs">
      <thead><tr><th>when</th><th>source</th><th>why</th><th>result</th><th>new</th><th>changed</th><th>same</th></tr></thead>
      <tbody>{data.jobs.map((j: any) => (
        <tr key={j.id} className={j.status}><td>{day(j.started.replace(/(\d{2})(\d{2})$/, "$1:$2"))}</td><td>{j.source_id}</td><td>{j.kind}</td><td title={j.error || j.log || ""}>{j.status}{j.error ? `, ${j.error.slice(0, 80)}` : ""}</td><td>{j.added}</td><td>{j.updated}</td><td>{j.skipped}</td></tr>
      ))}</tbody>
    </table>
  );
}

function Safety({ universe }: { universe: string }) {
  const { data, reload } = useData("/api/backups");
  const { data: au } = useData("/api/audit");
  const [msg, setMsg] = useState("");
  return (
    <div className="two-col">
      <section>
        <h2 className="section-title">backups</h2>
        <p className="muted small">saved to <code>{data?.dir}</code> every night at 4 and whenever you press the button. restoring keeps a safety copy first.</p>
        {universe !== "demo" && <button className="btn" onClick={async () => { const r = await api.post("/api/backups"); setMsg(`saved ${r.file}`); reload(); }}>back up now</button>}
        {msg && <p className="notice">{msg}</p>}
        <ul className="plain small">{data?.backups.map((b: any) => (
          <li key={b.name}><code>{b.name}</code> <span className="muted">{(b.size / 1e6).toFixed(1)} mb, {b.at}</span>
            {universe !== "demo" && <button className="link small" onClick={async () => { if (confirm(`restore ${b.name}? the current universe is saved as a safety copy first.`)) { const r = await api.post("/api/backups/restore", { name: b.name }); setMsg(`restored. safety copy ${r.safety_copy}`); reload(); } }}>restore</button>}</li>
        ))}</ul>
      </section>
      <section>
        <h2 className="section-title">audit log</h2>
        <ol className="plain small audit">{au?.audit.map((a: any) => <li key={a.id}><time className="muted">{a.at.slice(0, 16).replace("T", " ")}</time> {a.actor} {a.action} <span className="muted">{a.detail?.slice(0, 120)}</span></li>)}</ol>
      </section>
    </div>
  );
}
