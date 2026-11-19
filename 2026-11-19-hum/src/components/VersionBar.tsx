// src/components/VersionBar.tsx
// pick, save, duplicate, rename and delete melody versions.
import { useState } from "react";
import { Check, Copy, GitBranch, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Song } from "../lib/types";

interface Props {
  song: Song;
  onSwitch: (id: string) => void;
  onSaveNew: (name: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function VersionBar({ song, onSwitch, onSaveNew, onDuplicate, onRename, onDelete }: Props) {
  const [mode, setMode] = useState<"idle" | "new" | "rename" | "delete">("idle");
  const [name, setName] = useState("");
  const active = song.versions.find((v) => v.id === song.activeVersionId) ?? song.versions[0];

  const submit = () => {
    if (mode === "new") onSaveNew(name || `version ${song.versions.length + 1}`);
    if (mode === "rename") onRename(active.id, name);
    setMode("idle");
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-2xl bg-lavender/30 px-2 py-1.5">
      <GitBranch size={14} className="ml-1 text-rose-deep" aria-hidden />
      {mode === "new" || mode === "rename" ? (
        <form className="flex flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
            placeholder={mode === "new" ? "name this version, like slower chorus" : "version name"}
            className="min-w-0 flex-1 rounded-full border border-line bg-white px-3 py-1 text-sm" aria-label="version name" />
          <button className="chip !px-2" aria-label="ok"><Check size={13} /></button>
          <button type="button" className="chip !px-2" onClick={() => setMode("idle")} aria-label="cancel"><X size={13} /></button>
        </form>
      ) : mode === "delete" ? (
        <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
          <span>delete <b>{active.name}</b>? your recordings stay safe</span>
          <button className="chip !bg-rose-deep !text-white" onClick={() => { onDelete(active.id); setMode("idle"); }}>delete</button>
          <button className="chip" onClick={() => setMode("idle")}>keep</button>
        </div>
      ) : (
        <>
          <select value={active.id} onChange={(e) => onSwitch(e.target.value)}
            className="max-w-[12rem] rounded-full border border-line bg-white px-3 py-1 text-sm font-bold" aria-label="melody version">
            {song.versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <button className="chip" onClick={() => { setName(""); setMode("new"); }} title="save what you have now as a new version and keep going in it"><Plus size={13} /> save version</button>
          <button className="chip !px-2" onClick={() => onDuplicate(active.id)} title="make a copy of this version" aria-label="duplicate version"><Copy size={13} /></button>
          <button className="chip !px-2" onClick={() => { setName(active.name); setMode("rename"); }} title="rename this version" aria-label="rename version"><Pencil size={13} /></button>
          <button className="chip !px-2" onClick={() => setMode("delete")} disabled={song.versions.length <= 1} title="delete this version" aria-label="delete version"><Trash2 size={13} /></button>
          <span className="ml-auto hidden text-[11px] text-ink-soft sm:inline">switching saves your work first, lyrics are shared</span>
        </>
      )}
    </div>
  );
}
