// frontend/src/pages/Archive.tsx: the human archive. a drawer of dossiers kept by a slightly dry historian.
// every report keeps facts, statistics, interpretations, commentary and uncertainties in separate sections.
import { EvidenceButton, Tag } from "../components/Evidence";
import { month, useData } from "../hooks";
import { Back, Empty, Loading } from "../App";

export default function Archive({ id }: { id?: string }) {
  const { data } = useData("/api/archive");
  if (!data) return <Loading what="the archive" />;
  const reps = data.reports;
  const open = id ? reps.find((r: any) => r.key === id) : null;
  return (
    <div className="archive page">
      <Back />
      <header className="page-head">
        <p className="eyebrow">the human archive</p>
        <h1>files on the subject</h1>
        <p className="lede">kept by an archivist who has only ever seen your records. the humour is theirs, the evidence is yours.</p>
      </header>
      {!reps.length && <Empty>the drawers are empty. connect a source and the archivist will start a file.</Empty>}
      <div className="archive-grid">
        <nav className="drawer-tabs" aria-label="dossiers">
          {reps.map((r: any, i: number) => (
            <a key={r.key} href={`#/archive/${r.key}`} className={`file-tab ${open?.key === r.key ? "on" : ""}`} style={{ ["--i" as any]: i }}>
              <span className="file-no">no. {String(i + 1).padStart(3, "0")}</span>
              <span>{r.title}</span>
            </a>
          ))}
        </nav>
        <div className="file">
          {open ? <Report r={open} /> : (
            <div className="file-cover">
              <p className="stamp">confidential</p>
              <p>pick a file from the drawer.</p>
              {data.gaps.length > 0 && <p className="muted">the archive notes {data.gaps.length} periods where the records go silent. see <a href="#/unknown">the unknown room</a>.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Report({ r }: { r: any }) {
  const hours = r.hours ? Object.entries(r.hours as Record<string, number>) : null;
  const max = hours ? Math.max(...hours.map(([, v]) => v)) : 1;
  return (
    <article className="report">
      <header>
        <p className="file-meta">file {r.key} {r.date ? `, opened ${month(r.date)}` : ""}</p>
        <h2>{r.title}</h2>
      </header>
      <Section title="documented facts" kind="fact" items={r.facts} />
      <Section title="statistical observations" kind="stat" items={r.stats} />
      {hours && (
        <figure className="hours" aria-label="records by hour of the day">
          <div className="hour-bars">{Array.from({ length: 24 }, (_, h) => <span key={h} style={{ height: `${((r.hours[h] || 0) / max) * 100}%` }} title={`${h}:00, ${r.hours[h] || 0}`} />)}</div>
          <figcaption className="muted small">records by hour, midnight on the left</figcaption>
        </figure>
      )}
      <Section title="interpretations" kind="interpretation" items={r.interpretations} />
      <section className="commentary">
        <h3>the archivist's commentary <Tag kind="commentary" /></h3>
        <p>{r.commentary}</p>
      </section>
      <Section title="uncertainties" kind="uncertainty" items={r.uncertainties} />
      <EvidenceButton ids={r.evidence} title={r.title} label="inspect the supporting records" />
    </article>
  );
}

function Section({ title, kind, items }: { title: string; kind: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <section className={`rep-sec rep-${kind}`}>
      <h3>{title} <Tag kind={kind} /></h3>
      <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </section>
  );
}
