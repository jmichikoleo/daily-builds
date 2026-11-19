// src/components/PianoRoll.tsx
// simplified piano roll, drag notes to change pitch/time,
// drag the right edge to resize, double-click to add/delete, keyboard nudges.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Note, SectionMarker } from "../lib/types";
import { isBlackKey, midiName } from "../lib/theory";
import { sectionInfo } from "../lib/markers";
import { noteColor } from "./ui";

interface Props {
  notes: Note[];
  ghostNotes?: Note[]; // e.g. the extra hummed layer, drawn faintly
  onCommit: (notes: Note[]) => void;
  onPreview: (midi: number) => void;
  playhead: number | null; // beats
  pxPerBeat: number;
  snap: number; // beats, 0 = free
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  compact?: boolean;
  markers?: SectionMarker[];
  selectedMarkerId?: string | null;
  onSelectMarker?: (id: string | null) => void;
  onMoveMarker?: (id: string, beat: number) => void;
  region?: { start: number; end: number } | null; // highlighted range (rerecording)
}

type MarkerDrag = { id: string; x0: number; beat0: number; moved: boolean };

type Drag = { id: string; mode: "move" | "resize"; x0: number; y0: number; orig: Note; moved: boolean };

const KEY_W = 46;

export default function PianoRoll({ notes, ghostNotes = [], onCommit, onPreview, playhead, pxPerBeat, snap, selectedId, onSelect, compact,
  markers = [], selectedMarkerId = null, onSelectMarker, onMoveMarker, region = null }: Props) {
  const ROW = compact ? 11 : 15;
  const [draft, setDraft] = useState<Note[] | null>(null);
  const drag = useRef<Drag | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const shown = draft ?? notes;
  const mDrag = useRef<MarkerDrag | null>(null);
  const [mDraft, setMDraft] = useState<{ id: string; beat: number } | null>(null);
  const shownMarkers = markers.map((m) => (mDraft?.id === m.id ? { ...m, beat: mDraft.beat } : m)).sort((a, b) => a.beat - b.beat);

  const [lo, hi] = useMemo(() => {
    const all = [...notes, ...ghostNotes];
    if (!all.length) return [55, 79];
    let a = Math.min(...all.map((n) => n.midi)) - 4;
    let b = Math.max(...all.map((n) => n.midi)) + 4;
    while (b - a < 20) { a--; b++; }
    return [a, b];
  }, [notes, ghostNotes]);
  const rows = hi - lo + 1;
  const endBeat = Math.max(16, ...shown.map((n) => n.start + n.duration), ...ghostNotes.map((n) => n.start + n.duration), ...markers.map((m) => m.beat + 4), region?.end ?? 0) + 4;
  const bars = Math.ceil(endBeat / 4);
  const width = bars * 4 * pxPerBeat;
  const height = rows * ROW;
  const yOf = (midi: number) => (hi - midi) * ROW;
  const snapTo = (b: number) => (snap ? Math.round(b / snap) * snap : Math.round(b * 100) / 100);

  // keep the playhead in view
  useEffect(() => {
    const el = scroller.current;
    if (!el || playhead === null) return;
    const x = KEY_W + playhead * pxPerBeat;
    if (x > el.scrollLeft + el.clientWidth - 60 || x < el.scrollLeft + KEY_W) el.scrollLeft = Math.max(0, x - KEY_W - 40);
  }, [playhead, pxPerBeat]);

  const onPointerDown = (e: React.PointerEvent, n: Note, mode: Drag["mode"]) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { id: n.id, mode, x0: e.clientX, y0: e.clientY, orig: n, moved: false };
    onSelect(n.id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    d.moved = true;
    const dBeats = dx / pxPerBeat;
    const next = notes.map((n) => {
      if (n.id !== d.id) return n;
      if (d.mode === "resize") return { ...n, duration: Math.max(snap || 0.1, snapTo(d.orig.duration + dBeats)) };
      const midi = Math.max(lo, Math.min(hi, d.orig.midi - Math.round(dy / ROW)));
      return { ...n, start: Math.max(0, snapTo(d.orig.start + dBeats)), midi };
    });
    const moved = next.find((n) => n.id === d.id)!;
    const before = (draft ?? notes).find((n) => n.id === d.id)!;
    if (moved.midi !== before.midi) onPreview(moved.midi);
    setDraft(next);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) { onPreview(d.orig.midi); setDraft(null); return; }
    if (draft) onCommit(draft);
    setDraft(null);
  };

  const pointToNote = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const beat = snapTo(Math.max(0, (e.clientX - rect.left) / pxPerBeat - (snap || 0.25) / 2));
    const midi = hi - Math.floor((e.clientY - rect.top) / ROW);
    return { beat, midi };
  };

  const addAt = (e: React.MouseEvent) => {
    const { beat, midi } = pointToNote(e);
    const n: Note = { id: crypto.randomUUID(), midi, start: beat, duration: Math.max(snap, 0.5) || 0.5, velocity: 0.8 };
    onCommit([...notes, n].sort((a, b) => a.start - b.start));
    onSelect(n.id);
    onPreview(midi);
  };

  const gridBg = useMemo(() => {
    const beat = pxPerBeat;
    return {
      backgroundImage: `linear-gradient(to right, rgba(185,114,155,.22) 1px, transparent 1px), linear-gradient(to right, rgba(57,52,59,.06) 1px, transparent 1px)`,
      backgroundSize: `${beat * 4}px 100%, ${beat}px 100%`,
    };
  }, [pxPerBeat]);

  return (
    <div ref={scroller} className="relative overflow-x-auto overflow-y-hidden rounded-2xl border border-line bg-white" style={{ touchAction: "pan-x" }}>
      {/* section lane */}
      <div className="relative flex border-b border-line" style={{ width: width + KEY_W, height: 26 }}>
        <div className="sticky left-0 z-20 flex shrink-0 items-center justify-center border-r border-line bg-pearl text-[9px] font-extrabold uppercase tracking-wider text-ink-soft" style={{ width: KEY_W }}>parts</div>
        <div className="relative" style={{ width }} onPointerDown={() => onSelectMarker?.(null)}
          onPointerMove={(e) => {
            const d = mDrag.current;
            if (!d) return;
            const dx = e.clientX - d.x0;
            if (!d.moved && Math.abs(dx) < 3) return;
            d.moved = true;
            const raw = Math.max(0, d.beat0 + dx / pxPerBeat);
            setMDraft({ id: d.id, beat: snap ? Math.round(raw) : Math.round(raw * 100) / 100 });
          }}
          onPointerUp={() => {
            const d = mDrag.current;
            mDrag.current = null;
            if (!d) return;
            if (d.moved && mDraft) onMoveMarker?.(d.id, mDraft.beat);
            else onSelectMarker?.(d.id);
            setMDraft(null);
          }}
          onPointerCancel={() => { mDrag.current = null; setMDraft(null); }}
        >
          {shownMarkers.map((m, i) => {
            const next = shownMarkers[i + 1]?.beat ?? bars * 4;
            const info = sectionInfo(m.type);
            const sel = m.id === selectedMarkerId;
            return (
              <div key={m.id}
                role="button"
                aria-label={`${m.label} section at beat ${m.beat}`}
                aria-pressed={sel}
                onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture(e.pointerId); mDrag.current = { id: m.id, x0: e.clientX, beat0: m.beat, moved: false }; }}
                className={`absolute top-1 flex h-[18px] cursor-grab touch-none select-none items-center overflow-hidden rounded-md border px-1.5 text-[10px] font-extrabold active:cursor-grabbing ${sel ? "border-ink" : "border-black/10"}`}
                style={{ left: m.beat * pxPerBeat, width: Math.max(18, (next - m.beat) * pxPerBeat - 2), background: info.color }}
              >
                <span className="truncate">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="relative flex" style={{ width: width + KEY_W, height }}>
        {/* keyboard column */}
        <div className="sticky left-0 z-20 shrink-0 border-r border-line bg-pearl" style={{ width: KEY_W, height }}>
          {Array.from({ length: rows }, (_, i) => {
            const m = hi - i;
            return (
              <button
                key={m}
                tabIndex={-1}
                onClick={() => onPreview(m)}
                className={`flex w-full items-center justify-end pr-1.5 text-[9px] font-bold ${isBlackKey(m) ? "bg-ink/80 text-white/70" : "bg-white text-ink-soft"} border-b border-line/70 hover:bg-blush`}
                style={{ height: ROW }}
                aria-label={`preview ${midiName(m)}`}
              >
                {m % 12 === 0 || !compact ? (m % 12 === 0 ? midiName(m) : "") : ""}
              </button>
            );
          })}
        </div>

        {/* note grid */}
        <div
          className="relative"
          style={{ width, height, ...gridBg }}
          onDoubleClick={addAt}
          onPointerDown={() => onSelect(null)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {Array.from({ length: rows }, (_, i) => isBlackKey(hi - i) && (
            <div key={i} className="pointer-events-none absolute left-0 right-0 bg-lavender/25" style={{ top: i * ROW, height: ROW }} />
          ))}
          {Array.from({ length: bars }, (_, b) => (
            <span key={b} className="pointer-events-none absolute top-0.5 text-[9px] font-bold text-rose-deep/60" style={{ left: b * 4 * pxPerBeat + 3 }}>{b + 1}</span>
          ))}

          {shownMarkers.map((m) => (
            <div key={`ml${m.id}`} className="pointer-events-none absolute top-0 h-full w-px bg-rose-deep/30" style={{ left: m.beat * pxPerBeat }} />
          ))}
          {region && (
            <div className="pointer-events-none absolute top-0 h-full border-x-2 border-dashed border-rose-deep/60 bg-butter/50"
              style={{ left: region.start * pxPerBeat, width: Math.max(2, (region.end - region.start) * pxPerBeat) }} />
          )}

          {ghostNotes.map((n) => (
            <div key={`g${n.id}`} className="pointer-events-none absolute rounded-md border border-dashed border-ink/25 bg-mint/50"
              style={{ left: n.start * pxPerBeat, top: yOf(n.midi) + 1, width: Math.max(4, n.duration * pxPerBeat - 1), height: ROW - 2 }} />
          ))}

          {shown.map((n) => {
            const selected = n.id === selectedId;
            return (
              <div
                key={n.id}
                role="button"
                aria-label={`${midiName(n.midi)} at beat ${n.start.toFixed(2)}`}
                aria-pressed={selected}
                onPointerDown={(e) => onPointerDown(e, n, "move")}
                onDoubleClick={(e) => { e.stopPropagation(); onCommit(notes.filter((x) => x.id !== n.id)); onSelect(null); }}
                className={`group absolute cursor-grab touch-none select-none rounded-md border transition-shadow active:cursor-grabbing ${selected ? "z-10 border-ink shadow-[0_0_0_2px_#fff,0_0_0_4px_#39343B]" : "border-black/10 hover:shadow-md"}`}
                style={{ left: n.start * pxPerBeat, top: yOf(n.midi) + 1, width: Math.max(6, n.duration * pxPerBeat - 1), height: ROW - 2, background: noteColor(n.midi) }}
              >
                {!compact && n.duration * pxPerBeat > 34 && (
                  <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-extrabold text-ink/70">{midiName(n.midi)}</span>
                )}
                <span
                  onPointerDown={(e) => onPointerDown(e, n, "resize")}
                  className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-md bg-ink/0 group-hover:bg-ink/20"
                  aria-hidden
                />
              </div>
            );
          })}

          {playhead !== null && (
            <div className="pointer-events-none absolute top-0 z-30 h-full w-0.5 bg-rose-deep" style={{ left: playhead * pxPerBeat }}>
              <div className="-ml-1 h-2.5 w-2.5 rounded-full bg-rose-deep" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
