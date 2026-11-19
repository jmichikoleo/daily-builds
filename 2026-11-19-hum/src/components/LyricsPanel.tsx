// src/components/LyricsPanel.tsx
// the lyrics notebook, sections you can add, rename, reorder and delete.
import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { LyricSection } from "../lib/types";
import { SectionTitle } from "./ui";

interface Props { sections: LyricSection[]; onChange: (s: LyricSection[]) => void; saveState: string; highlightId?: string | null; partNames?: Record<string, string> }

const SUGGESTED = ["Verse", "Pre-Chorus", "Chorus", "Bridge", "Outro", "Intro", "Hook"];

export default function LyricsPanel({ sections, onChange, saveState, highlightId = null, partNames = {} }: Props) {
  const refs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    if (highlightId) refs.current[highlightId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);
  const patch = (id: string, p: Partial<LyricSection>) => onChange(sections.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => {
    const used = new Set(sections.map((s) => s.title));
    const title = SUGGESTED.find((t) => !used.has(t)) ?? `Verse ${sections.length + 1}`;
    onChange([...sections, { id: crypto.randomUUID(), title, text: "" }]);
  };

  return (
    <div className="panel p-4 sm:p-5" style={{ background: "linear-gradient(180deg,#fffdf6 0%,#fff 100%)" }}>
      <SectionTitle kicker="the notebook" title="the words behind the music.">
        <span className="text-xs text-ink-soft">{saveState === "saving" ? "saving..." : saveState === "error" ? "couldn't save" : "saved"}</span>
      </SectionTitle>
      {sections.length === 0 && <p className="mb-3 text-sm text-ink-soft">nothing here yet. add a section and write whatever the melody makes you feel</p>}
      <div className="space-y-4">
        {sections.map((s, i) => (
          <section key={s.id} ref={(el) => { refs.current[s.id] = el; }}
            className={`group rounded-2xl border bg-white p-3 transition-shadow ${s.id === highlightId ? "border-rose-deep shadow-[0_0_0_3px_#F7DDE5]" : "border-line"}`}>
            {partNames[s.id] && <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-deep/70">goes with the {partNames[s.id]} part</p>}
            <div className="mb-1 flex items-center gap-1">
              <input
                value={s.title}
                onChange={(e) => patch(s.id, { title: e.target.value })}
                className="min-w-0 flex-1 rounded-md bg-transparent px-1 font-display text-lg font-semibold italic text-rose-deep hover:bg-pearl"
                aria-label="section name"
                maxLength={40}
              />
              <button className="rounded-lg p-1.5 text-ink-soft hover:bg-pearl disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`move ${s.title} up`}><ArrowUp size={14} /></button>
              <button className="rounded-lg p-1.5 text-ink-soft hover:bg-pearl disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={`move ${s.title} down`}><ArrowDown size={14} /></button>
              <button className="rounded-lg p-1.5 text-ink-soft hover:bg-blush" onClick={() => { if (!s.text.trim() || confirm(`delete "${s.title}"?`)) onChange(sections.filter((x) => x.id !== s.id)); }} aria-label={`delete ${s.title}`}><Trash2 size={14} /></button>
            </div>
            <textarea
              value={s.text}
              onChange={(e) => patch(s.id, { text: e.target.value })}
              placeholder={i === 0 ? "start with one honest line..." : "..."}
              rows={Math.max(3, s.text.split("\n").length + 1)}
              className="notebook w-full resize-none rounded-md bg-transparent px-1 font-hand text-2xl leading-8 outline-none placeholder:text-ink/25"
              aria-label={`${s.title} lyrics`}
            />
          </section>
        ))}
      </div>
      <button className="chip mt-4" onClick={add}><Plus size={13} /> add section</button>
    </div>
  );
}
