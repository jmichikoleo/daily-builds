// frontend/src/pages/Museum.tsx: exhibition halls, single exhibitions and artifact plaques.
// you can rename, reorder, add, remove, favourite, hide and write your own exhibitions. edits survive rebuilds.
import { useState } from "react";
import { api } from "../api";
import { ArtifactObject } from "../components/Art";
import { EvidenceButton, sourceName } from "../components/Evidence";
import { day, go, month, useData } from "../hooks";
import { Back, Empty, Loading } from "../App";

export default function Museum({ exhibition, artifact }: { exhibition?: string; artifact?: string }) {
  if (artifact) return <Plaque id={artifact} />;
  return <Halls open={exhibition} />;
}

function Halls({ open }: { open?: string }) {
  const { data, reload } = useData("/api/museum");
  if (!data) return <Loading what="the museum" />;
  const ex = data.exhibitions.filter((e: any) => e.artifacts.some((k: string) => data.artifacts[k]) || !e.auto);
  if (open) {
    const e = ex.find((x: any) => x.key === open);
    if (!e) return <Empty>that exhibition closed.</Empty>;
    return <Hall e={e} arts={data.artifacts} reload={reload} />;
  }
  const favs = Object.values(data.artifacts).filter((a: any) => a.favorite);
  return (
    <div className="museum page">
      <Back />
      <header className="page-head">
        <p className="eyebrow">the museum</p>
        <h1>the museum of my existence</h1>
        <p className="lede">{Object.keys(data.artifacts).length} artifacts in {ex.length} exhibitions. nothing here is rare or ranked. it is kept because it happened.</p>
      </header>
      {favs.length > 0 && (
        <section className="hall-strip">
          <h2 className="section-title">your favourites</h2>
          <ul className="shelf">{favs.map((a: any) => <li key={a.key}><a href={`#/artifact/${a.key}`}><ArtifactObject kind={a.object} seed={a.key} size={70} /><span>{a.title}</span></a></li>)}</ul>
        </section>
      )}
      <div className="halls">
        {ex.map((e: any, i: number) => (
          <a key={e.key} className={`hall hall-${i % 4}`} href={`#/museum/${e.key}`}>
            <span className="hall-no">hall {String(i + 1).padStart(2, "0")}</span>
            <h3>{e.title}</h3>
            <p>{e.intro}</p>
            <div className="hall-objects" aria-hidden="true">
              {e.artifacts.slice(0, 4).map((k: string) => data.artifacts[k] && <ArtifactObject key={k} kind={data.artifacts[k].object} seed={k} size={46} />)}
            </div>
            <span className="muted small">{e.artifacts.filter((k: string) => data.artifacts[k]).length} objects{e.curated ? ", curated by you" : ""}</span>
          </a>
        ))}
      </div>
      <NewExhibition onDone={reload} />
    </div>
  );
}

function NewExhibition({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  return (
    <form className="new-exhibition" onSubmit={async (e) => {
      e.preventDefault();
      if (!title.trim()) return;
      const key = "mine-" + title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      await api.post(`/api/exhibitions/${key}`, { title: title.trim(), intro: "", artifacts: [] });
      setTitle("");
      onDone();
      go(`/museum/${key}`);
    }}>
      <label htmlFor="nx">open a new exhibition of your own</label>
      <input id="nx" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="a title, like the summer of small apps" />
      <button className="btn">open it</button>
    </form>
  );
}

function Hall({ e, arts, reload }: any) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(e.title);
  const [intro, setIntro] = useState(e.intro);
  const [adding, setAdding] = useState("");
  const keys: string[] = e.artifacts.filter((k: string) => arts[k]);

  async function save(next: Partial<{ title: string; intro: string; artifacts: string[] }>) {
    await api.post(`/api/exhibitions/${e.key}`, { title: next.title ?? title, intro: next.intro ?? intro, artifacts: next.artifacts ?? keys });
    reload();
  }
  const moveTo = (i: number, d: number) => {
    const a = [...keys];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    save({ artifacts: a });
  };
  const candidates = Object.values(arts).filter((a: any) => !keys.includes(a.key) && a.title.toLowerCase().includes(adding.toLowerCase())).slice(0, 8);

  return (
    <div className="hall-room page">
      <Back to="/museum" label="back to the halls" />
      <header className="page-head">
        <p className="eyebrow">{e.auto ? "an exhibition the curator found" : "your exhibition"}</p>
        {editing ? (
          <form className="stack" onSubmit={(ev) => { ev.preventDefault(); save({}); setEditing(false); }}>
            <input value={title} onChange={(ev) => setTitle(ev.target.value)} aria-label="title" />
            <textarea value={intro} onChange={(ev) => setIntro(ev.target.value)} aria-label="introduction" rows={3} />
            <div className="row"><button className="btn">save</button><button type="button" className="link" onClick={() => setEditing(false)}>cancel</button>
              {e.curated && e.auto && <button type="button" className="link" onClick={async () => { await api.del(`/api/exhibitions/${e.key}`); reload(); setEditing(false); }}>go back to the curator's version</button>}</div>
          </form>
        ) : (
          <>
            <h1>{e.title}</h1>
            <p className="lede">{e.intro || "no introduction yet."}</p>
            <button className="link" onClick={() => setEditing(true)}>curate this exhibition</button>
          </>
        )}
      </header>
      {!keys.length && <Empty>this room is empty. add objects below.</Empty>}
      <ol className="exhibit-wall">
        {keys.map((k, i) => {
          const a = arts[k];
          return (
            <li key={k} className="exhibit">
              <a href={`#/artifact/${k}`} className="exhibit-frame">
                <ArtifactObject kind={a.object} seed={k} size={110} />
              </a>
              <div className="label-card">
                <span className="accession">{a.accession}</span>
                <a href={`#/artifact/${k}`}><strong>{a.title}</strong></a>
                <span className="muted small">{month(a.period)}</span>
              </div>
              {editing && (
                <div className="row small">
                  <button className="link" onClick={() => moveTo(i, -1)} aria-label="move earlier">earlier</button>
                  <button className="link" onClick={() => moveTo(i, 1)} aria-label="move later">later</button>
                  <button className="link" onClick={() => save({ artifacts: keys.filter((x) => x !== k) })}>remove</button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {editing && (
        <section className="add-objects">
          <label htmlFor="add">add an object</label>
          <input id="add" value={adding} onChange={(ev) => setAdding(ev.target.value)} placeholder="search the collection" />
          <ul className="plain">{candidates.map((a: any) => <li key={a.key}><button className="link" onClick={() => save({ artifacts: [...keys, a.key] })}>add {a.title}</button></li>)}</ul>
        </section>
      )}
    </div>
  );
}

function Plaque({ id }: { id: string }) {
  const { data, reload } = useData(`/api/artifacts/${id}`);
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState("");
  if (!data) return <Loading what="the display case" />;
  const a = data.artifact;
  const ann = (field: string, value: string | null) => api.post("/api/annotate", { target: `artifact:${a.key}`, field, value }).then(reload);
  return (
    <div className="plaque page">
      <Back to="/museum" label="back to the museum" />
      <div className="plaque-grid">
        <div className="pedestal">
          <ArtifactObject kind={a.object} seed={a.key} size={260} />
          <div className="plinth" />
        </div>
        <article className="plaque-card">
          <span className="accession">{a.accession}</span>
          <p className="eyebrow">{a.category}</p>
          <h1>{a.title}</h1>
          <p className="muted">{a.date ? day(a.date) : "undated"}{a.period ? `, ${month(a.period)}` : ""}</p>
          <h2 className="section-title">curator's description</h2>
          {editing ? (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); ann("description", desc.trim() || null); setEditing(false); }}>
              <textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
              <div className="row"><button className="btn">save</button><button type="button" className="link" onClick={() => setEditing(false)}>cancel</button></div>
            </form>
          ) : (
            <p className="curator">{a.description} <button className="link small" onClick={() => { setDesc(a.description); setEditing(true); }}>{a.edited?.description ? "edit your text" : "write your own"}</button></p>
          )}
          {a.edited?.description && <p className="muted small">your words. the curator wrote {a.generated_description} <button className="link" onClick={() => ann("description", null)}>restore</button></p>}
          <h2 className="section-title">historical context</h2>
          <p>{a.context}</p>
          <h2 className="section-title">provenance</h2>
          <p>{a.provenance.map(sourceName).join(", ")}{a.url && <>, <a href={a.url} target="_blank" rel="noreferrer noopener">original link</a></>}</p>
          <EvidenceButton ids={a.evidence} title={`where ${a.title} comes from`} />
          <div className="row actions">
            <button className="btn" onClick={() => ann("favorite", a.favorite ? null : "1")}>{a.favorite ? "unfavourite" : "favourite"}</button>
            <button className="link" onClick={() => ann("hidden", "1").then(() => go("/museum"))}>hide from the museum</button>
          </div>
          {a.selves?.length > 0 && (<><h2 className="section-title">kept by</h2><p>{a.selves.map((k: string) => <a key={k} href={`#/multiverse/${k}`} className="pill">{data.selves[k] || k}</a>)}</p></>)}
          {data.chapter && (<><h2 className="section-title">in the library</h2><p><a href={`#/library/${data.chapter.key}`}>{data.chapter.title}</a></p></>)}
        </article>
      </div>
      {data.related.length > 0 && (
        <section>
          <h2 className="section-title">related artifacts</h2>
          <ul className="shelf">{data.related.map((r: any) => <li key={r.key}><a href={`#/artifact/${r.key}`}><ArtifactObject kind={r.object} seed={r.key} size={64} /><span>{r.title}</span></a></li>)}</ul>
        </section>
      )}
    </div>
  );
}
