// frontend/src/pages/Inbox.tsx: the discovery inbox. letters from the investigator, each with its evidence.
// confirm, correct, reject, save, hide or annotate. rejected discoveries are not found again.
import { useState } from "react";
import { api } from "../api";
import { EvidenceButton, sourceName } from "../components/Evidence";
import { month, useData } from "../hooks";
import { Back, Empty, Loading } from "../App";

const PLACE_NAMES: Record<string, string> = { museum: "the museum", observatory: "the observatory", multiverse: "the multiverse", library: "the library", unknown: "the unknown room", archive: "the archive" };

export default function Inbox() {
  const { data, reload } = useData("/api/discoveries");
  const [filter, setFilter] = useState<"new" | "all" | "saved">("new");
  if (!data) return <Loading what="the inbox" />;
  const list = data.discoveries.filter((d: any) => filter === "all" || (filter === "new" ? d.state === "new" : d.state === "saved" || d.state === "confirmed"));
  return (
    <div className="inbox page">
      <Back />
      <header className="page-head">
        <p className="eyebrow">discovery inbox</p>
        <h1>letters from the investigator</h1>
        <p className="lede">each one comes from records that were connected or processed. none are made up to fill a quota. order in time is shown, causes are not claimed.</p>
      </header>
      <div className="tabs">
        {(["new", "saved", "all"] as const).map((f) => <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f === "new" ? "unread" : f === "saved" ? "kept" : "everything"}</button>)}
      </div>
      {!list.length && <Empty>{filter === "new" ? "no unread discoveries. new ones arrive when new records do." : "nothing here yet."}</Empty>}
      <ol className="letters">{list.map((d: any) => <Letter key={d.key} d={d} reload={reload} />)}</ol>
      {data.hidden > 0 && <p className="muted small">{data.hidden} hidden.</p>}
    </div>
  );
}

function Letter({ d, reload }: { d: any; reload: () => void }) {
  const [note, setNote] = useState(d.note || "");
  const [noting, setNoting] = useState(false);
  const set = (state: string | null, extra: any = {}) => api.post(`/api/discoveries/${d.key}`, { state, ...extra }).then(reload);
  return (
    <li className={`letter st-${d.state}`}>
      <div className="letter-top">
        <span className="postmark">{d.kind}</span>
        <span className="muted small">{d.start ? `${month(d.start)}${d.end && d.end !== d.start ? ` to ${month(d.end)}` : ""}` : ""}</span>
        <span className={`confidence c-${d.confidence.label}`}>{d.confidence.label} confidence</span>
      </div>
      <h3>{d.title}</h3>
      <p>{d.explanation}</p>
      {d.sources?.length > 0 && <p className="muted small">from {d.sources.map(sourceName).join(", ")}</p>}
      {d.note && !noting && <p className="your-note">your note. {d.note}</p>}
      <div className="row wrap">
        <EvidenceButton ids={d.evidence} title={d.title} />
        {d.links?.map((l: any, i: number) => l.key && (
          <a key={i} className="link" href={l.place === "museum" ? `#/artifact/${l.key}` : l.place === "multiverse" ? `#/multiverse/${l.key}` : l.place === "library" ? `#/library/${l.key}` : `#/${l.place}`}>go to {PLACE_NAMES[l.place]}</a>
        ))}
      </div>
      <div className="row wrap actions">
        {d.state === "new" && <button className="link" onClick={() => set("seen")}>mark read</button>}
        <button className="link" onClick={() => set("confirmed")}>this is right</button>
        <button className="link" onClick={() => setNoting(true)}>correct it</button>
        <button className="link" onClick={() => set("saved")}>keep</button>
        <button className="link" onClick={() => set("rejected")}>this is wrong</button>
        <button className="link" onClick={() => set("hidden")}>hide</button>
      </div>
      {noting && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); set("corrected", { note }); setNoting(false); }}>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="what is actually true" aria-label="your correction" />
          <div className="row"><button className="btn small">save note</button><button type="button" className="link" onClick={() => setNoting(false)}>cancel</button></div>
        </form>
      )}
    </li>
  );
}
