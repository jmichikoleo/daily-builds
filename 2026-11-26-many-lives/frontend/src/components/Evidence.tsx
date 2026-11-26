// frontend/src/components/Evidence.tsx: the "why do you think that" drawer, shared by every place.
// opens with a list of record ids and shows each original record with its source and provenance.
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";
import { day } from "../hooks";

type Ctx = { open: (ids: number[], title?: string, note?: string) => void };
const EvidenceCtx = createContext<Ctx>({ open: () => {} });
export const useEvidence = () => useContext(EvidenceCtx);

const SOURCE_NAMES: Record<string, string> = {
  github: "github", git_local: "local git", project_docs: "project notes", claude_code: "claude code",
  chatgpt_export: "chatgpt export", claude_export: "claude.ai export", spotify_export: "spotify history",
  spotify_api: "spotify live", google_takeout: "google takeout", documents: "personal folders", zotero: "zotero", owner: "you",
};
export const sourceName = (s: string) => SOURCE_NAMES[s] || s;

export function EvidenceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ ids: number[]; title?: string; note?: string } | null>(null);
  const [records, setRecords] = useState<any[] | null>(null);
  useEffect(() => {
    if (!state) return;
    setRecords(null);
    if (!state.ids.length) return setRecords([]);
    api.get(`/api/evidence?ids=${state.ids.slice(0, 60).join(",")}`).then((d) => setRecords(d.records));
  }, [state]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setState(null);
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);
  return (
    <EvidenceCtx.Provider value={{ open: (ids, title, note) => setState({ ids, title, note }) }}>
      {children}
      {state && (
        <div className="drawer-wrap" onClick={() => setState(null)}>
          <aside className="drawer evidence" role="dialog" aria-label="evidence" onClick={(e) => e.stopPropagation()}>
            <header>
              <p className="eyebrow">the evidence</p>
              <h2>{state.title || "what this is based on"}</h2>
              {state.note && <p className="muted">{state.note}</p>}
              <button className="close" onClick={() => setState(null)} aria-label="close">close</button>
            </header>
            {!records && <p className="muted">fetching the original records...</p>}
            {records && !records.length && (
              <p className="muted">no single records back this one. it is computed from counts and dates across everything connected.</p>
            )}
            <ol className="records">
              {records?.map((r) => (
                <li key={r.id}>
                  <div className="rec-head">
                    <span className="src">{sourceName(r.source_id)}</span>
                    <span className="kind">{r.kind}</span>
                    <time>{day(r.ts)}</time>
                  </div>
                  <strong>{r.title}</strong>
                  {r.body && <p>{r.body.slice(0, 400)}</p>}
                  <small className="muted">
                    record #{r.id}
                    {r.meta?.repo ? ` from ${r.meta.repo}` : ""}
                    {r.imported_at ? `, imported ${day(r.imported_at)}` : ""}
                  </small>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </EvidenceCtx.Provider>
  );
}

export function EvidenceButton({ ids, title, note, label = "see the evidence" }: { ids: number[]; title?: string; note?: string; label?: string }) {
  const { open } = useEvidence();
  return (
    <button className="evidence-btn" onClick={() => open(ids || [], title, note)}>
      {label} <span className="count">{ids?.length || 0}</span>
    </button>
  );
}

export function Tag({ kind }: { kind: string }) {
  const names: Record<string, string> = {
    fact: "documented", stat: "statistic", interpretation: "interpretation", lore: "fiction", owner: "your words",
    discovery: "discovery", commentary: "commentary", uncertainty: "uncertain",
  };
  return <span className={`tag tag-${kind}`}>{names[kind] || kind}</span>;
}
