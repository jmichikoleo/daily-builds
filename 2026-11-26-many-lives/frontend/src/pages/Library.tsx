// frontend/src/pages/Library.tsx: the autobiography machine. volumes on a shelf, chapters in reading mode.
// the biographer's draft and your own text are stored apart, so a rebuild never overwrites your writing.
import { useState } from "react";
import { api, exportUrl } from "../api";
import { ArtifactObject } from "../components/Art";
import { EvidenceButton, Tag, useEvidence } from "../components/Evidence";
import { day, month, useData } from "../hooks";
import { Back, Empty, Loading } from "../App";

export default function Library({ id }: { id?: string }) {
  return id ? <Chapter id={id} /> : <Shelf />;
}

function Shelf() {
  const { data } = useData("/api/library");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"book" | "months" | "stories">("book");
  if (!data) return <Loading what="the library" />;
  const vols = data.volumes;
  return (
    <div className="library page">
      <Back />
      <header className="page-head">
        <p className="eyebrow">the library</p>
        <h1>the book of you, so far</h1>
        <p className="lede">written from records and rewritten as they grow. anything the records cannot know is marked as interpretation, and your own words always win.</p>
        <div className="row">
          <a className="btn" href={exportUrl("md")}>export markdown</a>
          <a className="btn" href={exportUrl("html")}>export html</a>
          <a className="btn" href={exportUrl("print")} target="_blank" rel="noopener">printable book, save as pdf</a>
        </div>
      </header>
      <div className="tabs" role="tablist">
        {(["book", "months", "stories"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "book" ? "volumes" : t === "months" ? "monthly appendix" : "short stories"}
          </button>
        ))}
      </div>
      {tab === "book" && (
        <>
          <input className="search-in" placeholder="find a chapter" value={q} onChange={(e) => setQ(e.target.value)} aria-label="find a chapter" />
          {!vols.length && <Empty>no chapters yet. the first one is written as soon as there are records.</Empty>}
          <div className="bookshelf">
            {vols.map((v: any, i: number) => (
              <section key={v.year} className="volume">
                <h2 className="spine-title"><span>volume {i + 1}</span> {v.year}</h2>
                <ol className="spines">
                  {v.chapters.filter((c: any) => !q || c.title.toLowerCase().includes(q.toLowerCase())).map((c: any, j: number) => (
                    <li key={c.key}>
                      <a href={`#/library/${c.key}`} className={`spine spine-${(i + j) % 5} ${c.kind}`} style={{ height: `${150 + (c.title.length % 5) * 12}px` }}>
                        <span>{c.title}</span>
                        {c.user_body && <em className="yours">yours</em>}
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}
      {tab === "months" && (
        <ol className="retros">
          {[...data.retros].reverse().map((r: any) => (
            <li key={r.month}>
              <h3>{month(r.month)}</h3>
              <p>{r.records} records{r.top_project ? `, mostly ${r.top_project}` : ""}{r.top_interest ? `, thinking about ${r.top_interest}` : ""}.</p>
              {r.started.length > 0 && <p className="muted">began {r.started.join(", ")}</p>}
            </li>
          ))}
        </ol>
      )}
      {tab === "stories" && (
        <div className="stories">
          {data.stories.map((s: any) => (
            <article key={s.key} className="story">
              <h3>{s.name}</h3>
              {s.lore.map((l: any, i: number) => <p key={i}>{l.text}</p>)}
              <p className="muted small"><Tag kind="lore" /> a short story built on the records. <a href={`#/multiverse/${s.key}`}>visit the room</a></p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Chapter({ id }: { id: string }) {
  const { data, reload } = useData(`/api/chapters/${id}`);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [version, setVersion] = useState<any>(null);
  const { open } = useEvidence();
  if (!data) return <Loading what="the chapter" />;
  const c = data.chapter;
  let fn = 0;

  async function save() {
    await api.put(`/api/chapters/${c.key}`, { title: title.trim() || null, body: body.trim() || null });
    setEdit(false);
    reload();
  }
  function startEdit() {
    setTitle(c.user_title || c.title);
    setBody(c.user_body || c.blocks.map((b: any) => (b.kind === "interpretation" ? `(interpretation) ${b.text}` : b.text)).join("\n\n"));
    setEdit(true);
  }

  return (
    <div className="chapter page">
      <Back to="/library" label="back to the shelf" />
      <article className="reading">
        <header>
          <p className="eyebrow">volume {c.volume}, {c.kind === "era" ? "a chapter" : "a retrospective"}</p>
          <h1>{c.title}</h1>
          <p className="muted">{month(c.start)} to {month(c.end)}</p>
        </header>
        {edit ? (
          <div className="stack editor">
            <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="chapter title" />
            <textarea rows={18} value={body} onChange={(e) => setBody(e.target.value)} aria-label="chapter text" />
            <p className="muted small">your version is saved next to the biographer's draft. clear the text and save to go back to the draft.</p>
            <div className="row"><button className="btn" onClick={save}>save my version</button><button className="link" onClick={() => setEdit(false)}>cancel</button></div>
          </div>
        ) : c.user_body ? (
          <>
            <p className="byline"><Tag kind="owner" /> written by you, {day(c.user_updated)}</p>
            {c.draft_changed_since_edit && <p className="notice">the biographer has new material since your edit. your text was not touched. open the drafts below to compare.</p>}
            {c.user_body.split(/\n\s*\n/).map((p: string, i: number) => <p key={i} className={i === 0 ? "drop" : ""}>{p}</p>)}
          </>
        ) : (
          <>
            {c.blocks.map((b: any, i: number) => {
              const n = b.evidence?.length ? ++fn : 0;
              return (
                <p key={i} className={`blk blk-${b.kind} ${i === 0 ? "drop" : ""}`}>
                  {b.kind !== "fact" && <Tag kind={b.kind} />} {b.text}
                  {n > 0 && <button className="fn" onClick={() => open(b.evidence, `footnote ${n}`)} aria-label={`footnote ${n}, show evidence`}>{n}</button>}
                </p>
              );
            })}
          </>
        )}
        {!edit && <div className="row"><button className="btn" onClick={startEdit}>{c.user_body ? "edit your version" : "write your own version"}</button></div>}
      </article>

      {data.artifacts.length > 0 && (
        <section>
          <h2 className="section-title">objects from this chapter</h2>
          <ul className="shelf">{data.artifacts.map((a: any) => <li key={a.key}><a href={`#/artifact/${a.key}`}><ArtifactObject kind={a.object} seed={a.key} size={60} /><span>{a.title}</span></a></li>)}</ul>
        </section>
      )}
      {c.selves?.length > 0 && <p>characters in this chapter {c.selves.map((s: string) => <a key={s} className="pill" href={`#/multiverse/${s}`}>{s}</a>)}</p>}
      <section className="versions">
        <h2 className="section-title">version history</h2>
        <ol className="plain">
          {data.versions.map((v: any) => (
            <li key={v.id}>
              <button className="link" onClick={() => api.get(`/api/chapters/${c.key}/versions/${v.id}`).then(setVersion)}>{v.author === "owner" ? "your edit" : "biographer's draft"}</button>
              <span className="muted small"> {day(v.created_at.replace(/(\d{2})(\d{2})$/, "$1:$2"))}</span>
            </li>
          ))}
        </ol>
        {version && (
          <div className="version-view">
            <p className="eyebrow">{version.author === "owner" ? "your edit" : "biographer's draft"}</p>
            {(version.body || "").split("\n").map((l: string, i: number) => <p key={i}>{l}</p>)}
            <button className="link" onClick={() => setVersion(null)}>close</button>
          </div>
        )}
      </section>
      <EvidenceButton ids={c.blocks.flatMap((b: any) => b.evidence || []).slice(0, 60)} title="every source in this chapter" />
    </div>
  );
}
