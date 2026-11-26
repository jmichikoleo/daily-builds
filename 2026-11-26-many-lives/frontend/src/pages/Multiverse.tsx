// frontend/src/pages/Multiverse.tsx: a hallway of doors, one per alternate self, and each self's room.
// documented facts and fiction sit side by side but are always labelled apart.
import { useState } from "react";
import { api } from "../api";
import { ArtifactObject, Door, Room } from "../components/Art";
import { EvidenceButton, Tag } from "../components/Evidence";
import { month, useData } from "../hooks";
import { Back, Empty, Loading } from "../App";

export default function Multiverse({ id }: { id?: string }) {
  return id ? <SelfRoom id={id} /> : <Hallway />;
}

function Hallway() {
  const { data } = useData("/api/selves");
  if (!data) return <Loading what="the multiverse" />;
  const selves = data.selves;
  const active = selves.filter((s: any) => s.status === "active");
  const past = selves.filter((s: any) => s.status !== "active");
  return (
    <div className="multiverse page">
      <Back />
      <header className="page-head">
        <p className="eyebrow">the multiverse</p>
        <h1>other versions of you</h1>
        <p className="lede">each door was found in the records, not invented first. the names, rooms and little habits behind them are fiction, the interests and projects are not.</p>
      </header>
      {!selves.length && <Empty>no other selves yet. they appear once enough records point the same way.</Empty>}
      <div className="hallway">
        {active.map((s: any) => <DoorCard key={s.key} s={s} />)}
      </div>
      {past.length > 0 && (
        <>
          <h2 className="section-title">historical selves</h2>
          <p className="muted">quiet for months. the doors still open.</p>
          <div className="hallway past">{past.map((s: any) => <DoorCard key={s.key} s={s} />)}</div>
        </>
      )}
    </div>
  );
}

function DoorCard({ s }: { s: any }) {
  return (
    <a className="door-card" href={`#/multiverse/${s.key}`}>
      <Door palette={s.palette} motif={s.motif} seed={s.key} faded={s.status !== "active"} />
      <strong>{s.name}</strong>
      <span className="muted small">{s.interest_labels?.slice(0, 2).join(", ") || s.title}</span>
      <span className="muted small">{month(s.first_seen)} to {s.status === "active" ? "now" : month(s.last_seen)}</span>
    </a>
  );
}

function SelfRoom({ id }: { id: string }) {
  const { data, reload } = useData(`/api/selves/${id}`);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  if (!data) return <Loading what="a room" />;
  const s = data.self;
  const tl = Object.entries(s.timeline || {}) as [string, number][];
  const max = Math.max(1, ...tl.map(([, v]) => v));

  async function rename(value: string | null) {
    await api.post("/api/annotate", { target: `self:${s.key}`, field: "name", value });
    setRenaming(false);
    reload();
  }

  return (
    <div className="self-room page" style={{ ["--self-a" as any]: s.palette[0], ["--self-b" as any]: s.palette[2] }}>
      <Back to="/multiverse" label="back to the hallway" />
      <header className="page-head">
        <p className="eyebrow">{s.status === "historical" ? "a historical self" : "an alternate self"}</p>
        {renaming ? (
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); rename(name.trim() || null); }}>
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label="new name" autoFocus />
            <button className="btn">save</button>
            <button type="button" className="link" onClick={() => setRenaming(false)}>cancel</button>
          </form>
        ) : (
          <h1>{s.name} <button className="link small" onClick={() => { setName(s.name); setRenaming(true); }}>rename</button></h1>
        )}
        {s.edited?.name && <p className="muted small">you renamed this self. the archive called them {s.generated_name}. <button className="link" onClick={() => rename(null)}>undo</button></p>}
        <p className="lede">{s.room}.</p>
      </header>

      <Room self={s} />

      <div className="two-col">
        <section>
          <h2 className="section-title">what the records say</h2>
          {s.facts.map((f: any, i: number) => <p key={i} className="block"><Tag kind={f.kind} /> {f.text}</p>)}
          <EvidenceButton ids={s.evidence} title={`why ${s.name} exists`} />
          <h2 className="section-title">a short biography</h2>
          {s.lore.map((f: any, i: number) => <p key={i} className="block lore"><Tag kind="lore" /> {f.text}</p>)}
          <p className="muted small">fiction written from the facts above. it is not a personality assessment.</p>
        </section>
        <section>
          <h2 className="section-title">recurring interests</h2>
          <ul className="chips">{s.interest_labels.map((l: string) => <li key={l}>{l}</li>)}</ul>
          {s.traits_lore?.length > 0 && (<><h2 className="section-title">habits <Tag kind="lore" /></h2><ul className="plain">{s.traits_lore.map((t: string) => <li key={t}>{t}</li>)}</ul></>)}
          {s.favorite_activities?.length > 0 && (<><h2 className="section-title">favourite activities</h2><ul className="plain">{s.favorite_activities.map((t: string) => <li key={t}>{t}</li>)}</ul></>)}
          {tl.length > 0 && (
            <>
              <h2 className="section-title">timeline</h2>
              <div className="sparkbars" role="img" aria-label={`activity from ${month(tl[0][0])} to ${month(tl[tl.length - 1][0])}`}>
                {tl.map(([m, v]) => <span key={m} style={{ height: `${(v / max) * 100}%` }} title={`${month(m)}, ${v}`} />)}
              </div>
              <p className="muted small">{month(tl[0][0])} to {month(tl[tl.length - 1][0])}</p>
            </>
          )}
          {s.connections?.length > 0 && (
            <>
              <h2 className="section-title">crossovers</h2>
              <ul className="plain">{s.connections.map((c: any) => <li key={c.self}><a href={`#/multiverse/${c.self}`}>{data.names[c.self]}</a> <span className="muted">{c.why}</span></li>)}</ul>
            </>
          )}
        </section>
      </div>

      {data.projects.length > 0 && (
        <section>
          <h2 className="section-title">the projects in this room</h2>
          <ul className="shelf">{data.projects.map((p: any) => <li key={p.key}><a href={`#/artifact/project-${p.key}`}><ArtifactObject kind="floppy" seed={p.key} size={64} /><span>{p.name}</span></a></li>)}</ul>
        </section>
      )}
      {data.artifacts.length > 0 && (
        <section>
          <h2 className="section-title">significant artifacts</h2>
          <ul className="shelf">{data.artifacts.slice(0, 12).map((a: any) => <li key={a.key}><a href={`#/artifact/${a.key}`}><ArtifactObject kind={a.object} seed={a.key} size={64} /><span>{a.title}</span></a></li>)}</ul>
        </section>
      )}
      {data.chapters.length > 0 && (
        <section>
          <h2 className="section-title">appears in the library</h2>
          <ul className="plain">{data.chapters.map((c: any) => <li key={c.key}><a href={`#/library/${c.key}`}>{c.title}</a></li>)}</ul>
        </section>
      )}
    </div>
  );
}
