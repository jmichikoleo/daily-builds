// src/components/TempoControl.tsx
// bpm box with minus, plus, typing, tap tempo and reset.
import { useEffect, useRef, useState } from "react";
import { Hand, Minus, Plus, RotateCcw } from "lucide-react";
import { DEFAULT_BPM, MAX_BPM, MIN_BPM, TapTempo, clampBpm, parseBpm } from "../lib/tempo";

interface Props {
  bpm: number;
  transcribedBpm: number;
  hasNotes: boolean;
  onSetBpm: (bpm: number) => void; // change playback speed
  onRegrid: (bpm: number) => void; // keep the hum's timing, move the beat grid
}

export default function TempoControl({ bpm, transcribedBpm, hasNotes, onSetBpm, onRegrid }: Props) {
  const [text, setText] = useState(String(bpm));
  const [tapOpen, setTapOpen] = useState(false);
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [taps, setTaps] = useState(0);
  const tapper = useRef(new TapTempo());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setText(String(bpm)), [bpm]);
  useEffect(() => {
    if (!tapOpen) return;
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setTapOpen(false); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [tapOpen]);

  const commit = () => {
    const v = parseBpm(text);
    if (v === null) setText(String(bpm));
    else if (v !== bpm) onSetBpm(v);
    else setText(String(v));
  };
  const tap = () => {
    const v = tapper.current.tap(performance.now());
    setTaps(tapper.current.count);
    setTapBpm(v);
  };
  const resetTo = transcribedBpm || DEFAULT_BPM;

  return (
    <div ref={box} className="relative flex items-center gap-1 text-sm font-bold">
      <span>bpm</span>
      <button className="chip !px-2" onClick={() => onSetBpm(clampBpm(bpm - 1))} disabled={bpm <= MIN_BPM} aria-label="slower"><Minus size={12} /></button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setText(String(bpm)); (e.target as HTMLInputElement).blur(); } }}
        inputMode="numeric"
        className="w-12 rounded-full border border-line bg-white px-1 py-1 text-center tabular-nums"
        aria-label={`tempo in bpm, ${MIN_BPM} to ${MAX_BPM}`}
      />
      <button className="chip !px-2" onClick={() => onSetBpm(clampBpm(bpm + 1))} disabled={bpm >= MAX_BPM} aria-label="faster"><Plus size={12} /></button>
      <button className="chip" onClick={() => { tapper.current.reset(); setTaps(0); setTapBpm(null); setTapOpen((o) => !o); }} aria-expanded={tapOpen}><Hand size={13} /> tap</button>
      {bpm !== resetTo && (
        <button className="chip !px-2" onClick={() => onSetBpm(resetTo)} title={`back to ${resetTo} bpm, the tempo your hum was turned into notes at`} aria-label="reset tempo"><RotateCcw size={12} /></button>
      )}

      {tapOpen && (
        <div className="panel absolute left-0 top-full z-40 mt-2 w-72 p-4 font-normal animate-pop">
          <p className="text-sm font-bold">tap along to the beat</p>
          <p className="text-xs text-ink-soft">hit the button (or the space bar) on every beat. a few taps is enough</p>
          <button
            className="key mt-3 h-20 w-full text-2xl tabular-nums"
            onPointerDown={(e) => { e.preventDefault(); tap(); }}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); tap(); } }}
            autoFocus
          >
            {tapBpm ?? (taps ? "again..." : "tap")}
          </button>
          <p className="mt-1 text-center text-[11px] text-ink-soft">{taps} {taps === 1 ? "tap" : "taps"}, stops counting after a short pause</p>
          <div className="mt-3 grid gap-2">
            <button className="chip justify-center" disabled={!tapBpm} onClick={() => { if (tapBpm) { onSetBpm(tapBpm); setTapOpen(false); } }}>
              play at {tapBpm ?? "..."} bpm
            </button>
            <button className="chip justify-center" disabled={!tapBpm || !hasNotes} onClick={() => { if (tapBpm) { onRegrid(tapBpm); setTapOpen(false); } }}
              title="keeps your hum at its real speed and moves the bars and drums to this tempo">
              fit the beat to my hum
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-soft">
            tip. play your voice, tap along, then pick "fit the beat to my hum" so the drums line up with how you actually sang it
          </p>
        </div>
      )}
    </div>
  );
}
