// src/components/MarkerEditor.tsx
// shows under the piano roll when a section marker is picked. rename it, change its type,
// connect it to lyrics, jump there, rerecord it or delete it.
import { Mic, NotebookPen, Play, Trash2, X } from "lucide-react";
import { SECTION_TYPES, sectionInfo } from "../lib/markers";
import type { LyricSection, SectionMarker, SectionType } from "../lib/types";

interface Props {
  marker: SectionMarker;
  lyrics: LyricSection[];
  onChange: (patch: Partial<Omit<SectionMarker, "id">>) => void;
  onDelete: () => void;
  onJump: () => void;
  onOpenLyrics: () => void;
  onRerecord?: () => void;
  onClose: () => void;
}

export default function MarkerEditor({ marker, lyrics, onChange, onDelete, onJump, onOpenLyrics, onRerecord, onClose }: Props) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-2xl border border-line p-2 animate-pop" style={{ background: sectionInfo(marker.type).color }}>
      <input value={marker.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={40}
        className="w-28 rounded-full border border-line bg-white px-3 py-1 text-sm font-bold" aria-label="section name" />
      <select value={marker.type} onChange={(e) => onChange({ type: e.target.value as SectionType })}
        className="rounded-full border border-line bg-white px-2 py-1 text-xs font-bold" aria-label="section type">
        {SECTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <select value={marker.lyricId ?? ""} onChange={(e) => onChange({ lyricId: e.target.value || null })}
        className="max-w-[9rem] rounded-full border border-line bg-white px-2 py-1 text-xs font-bold" aria-label="lyrics for this section">
        <option value="">no lyrics</option>
        {lyrics.map((l) => <option key={l.id} value={l.id}>lyrics, {l.title}</option>)}
      </select>
      <span className="text-[11px] font-bold text-ink/60">beat {Math.round(marker.beat * 100) / 100}</span>
      <span className="ml-auto flex flex-wrap gap-1">
        <button className="chip" onClick={onJump}><Play size={12} /> play from here</button>
        <button className="chip" onClick={onOpenLyrics} disabled={!marker.lyricId}><NotebookPen size={12} /> lyrics</button>
        {onRerecord && <button className="chip" onClick={onRerecord}><Mic size={12} /> rerecord</button>}
        <button className="chip !px-2" onClick={onDelete} aria-label="delete section"><Trash2 size={12} /></button>
        <button className="chip !px-2" onClick={onClose} aria-label="close"><X size={12} /></button>
      </span>
    </div>
  );
}
