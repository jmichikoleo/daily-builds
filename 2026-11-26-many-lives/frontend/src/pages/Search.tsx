// frontend/src/pages/Search.tsx: ask the universe. keyword search with a little question sense.
import { useEffect, useState } from "react";
import { api } from "../api";
import { useEvidence } from "../components/Evidence";
import { day, query } from "../hooks";
import { Back } from "../App";

const EXAMPLES = ["when did i first get into research", "what projects have i forgotten about", "what was i creating last november",
  "which interests keep returning", "songs", "논문"];

export default function Search() {
  const [q, setQ] = useState(query("q") || "");
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const { open } = useEvidence();

  async function run(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    history.replaceState(null, "", `#/search?q=${encodeURIComponent(text)}`);
    setRes(await api.get(`/api/search?q=${encodeURIComponent(text)}`));
    setBusy(false);
  }
  useEffect(() => { if (q) run(q); }, []);

  function href(ref: string) {
    const [t, k] = [ref.split(":")[0], ref.slice(ref.indexOf(":") + 1)];
    return ({ project: `#/artifact/project-${k}`, artifact: `#/artifact/${k}`, self: `#/multiverse/${k}`, chapter: `#/library/${k}`,
      report: `#/archive/${k}`, discovery: "#/inbox", exhibition: `#/museum/${k}`, interest: "#/observatory", era: `#/library/${k}`, question: "#/unknown" } as any)[t];
  }

  return (
    <div className="search page">
      <Back />
      <header className="page-head">
        <p className="eyebrow">ask the universe</p>
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="search-form">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="when did i first..." aria-label="search the universe" />
          <button className="btn">{busy ? "looking" : "look"}</button>
        </form>
        <p className="muted small">try {EXAMPLES.map((x, i) => <button key={x} className="link" onClick={() => { setQ(x); run(x); }}>{x}{i < EXAMPLES.length - 1 ? "," : ""}</button>)}</p>
      </header>
      {res && (
        <section>
          {res.answer && <p className="answer">{res.answer}</p>}
          {res.mode.length > 0 && <p className="muted small">read as {res.mode.join(" and ")}{res.range[0] ? `, between ${res.range[0]} and ${res.range[1]}` : ""}</p>}
          {!res.results.length && <p className="muted">nothing in the universe matches that yet.</p>}
          <ol className="results">
            {res.results.map((r: any) => {
              const isRec = r.ref.startsWith("record:");
              const link = href(r.ref);
              return (
                <li key={r.ref}>
                  <span className="kind">{r.kind}</span>
                  {isRec ? <button className="link strong" onClick={() => open([+r.ref.split(":")[1]], r.title)}>{r.title}</button> : <a href={link}><strong>{r.title}</strong></a>}
                  {r.ts && <time className="muted small"> {day(r.ts)}</time>}
                  <p className="snippet">{(r.snippet || "").replace(/\[|\]/g, "")}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
