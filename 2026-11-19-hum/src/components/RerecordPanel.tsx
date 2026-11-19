// src/components/RerecordPanel.tsx
// hum one part again. pick the range, record, hear it in place, then apply or cancel.
// nothing is saved until you press apply, and your original recording is never touched.
import { useEffect, useMemo, useState } from "react";
import { Check, Headphones, Play, X } from "lucide-react";
import { decodeArrayBuffer } from "../audio/instruments";
import { toMono } from "../audio/recorder";
import { transcribe } from "../audio/transcribe";
import { player } from "../audio/player";
import { placeTake, replaceRange, type Align } from "../lib/rerecord";
import type { Note, Song } from "../lib/types";
import RecorderDeck from "./RecorderDeck";
import { computePeaks } from "./ui";

interface Props {
  song: Song;
  region: { start: number; end: number };
  onRegion: (r: { start: number; end: number }) => void;
  onPreviewNotes: (notes: Note[] | null) => void; // shown faintly in the piano roll
  onApply: (notes: Note[], take: Blob, region: { start: number; end: number }) => Promise<void>;
  onCancel: () => void;
}

const beatLabel = (b: number) => `bar ${Math.floor(b / 4) + 1}, beat ${Math.round(((b % 4) + 1) * 100) / 100}`;

export default function RerecordPanel({ song, region, onRegion, onPreviewNotes, onApply, onCancel }: Props) {
  const [take, setTake] = useState<{ blob: Blob; notes: Note[]; peaks: number[]; duration: number; warning: string | null } | null>(null);
  const [align, setAlign] = useState<Align>("firstNote");
  const [busy, setBusy] = useState(false);

  const placed = useMemo(() => (take ? placeTake(take.notes, region.start, region.end, align) : []), [take, region, align]);
  const result = useMemo(() => replaceRange(song.notes, placed, region.start, region.end), [song.notes, placed, region]);

  useEffect(() => { onPreviewNotes(take ? placed : null); }, [take, placed, onPreviewNotes]);
  useEffect(() => () => onPreviewNotes(null), [onPreviewNotes]);

  const capture = async (blob: Blob) => {
    setBusy(true);
    try {
      const buf = await decodeArrayBuffer(await blob.arrayBuffer());
      const mono = toMono(buf);
      const r = transcribe(mono, buf.sampleRate, song.bpm); // you hummed along at the current tempo
      setTake({ blob, notes: r.notes, peaks: computePeaks(mono), duration: r.durationSec, warning: r.quality.warning });
    } catch {
      setTake(null);
    } finally {
      setBusy(false);
    }
  };

  /** Play a bit before the section up to its end, with or without the new notes. */
  const hear = (withChange: boolean) => {
    const from = Math.max(0, region.start - 2);
    const s = { ...song, notes: withChange ? result.notes : song.notes };
    player.play(s, { from });
    const ms = ((region.end - from) * 60 / song.bpm) * 1000 + 600;
    const stopAt = Date.now() + ms;
    window.setTimeout(() => { if (player.playing && Date.now() >= stopAt - 50) player.stop(); }, ms);
  };

  const setStart = (v: number) => onRegion({ start: Math.max(0, Math.min(v, region.end - 0.25)), end: region.end });
  const setEnd = (v: number) => onRegion({ start: region.start, end: Math.max(region.start + 0.25, v) });
  const secs = ((region.end - region.start) * 60) / song.bpm;

  return (
    <div className="mt-3 rounded-2xl border-2 border-dashed border-rose-deep/40 bg-butter/40 p-3 sm:p-4 animate-pop">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-hand text-xl leading-none text-rose-deep">fix just this bit</p>
          <p className="font-display text-lg font-semibold">rerecord {beatLabel(region.start)} to {beatLabel(region.end)}</p>
          <p className="text-xs text-ink-soft">that's {secs.toFixed(1)} seconds at {song.bpm} bpm. hum it at that speed</p>
        </div>
        <button className="chip !px-2" onClick={() => { player.stop(); onCancel(); }} aria-label="cancel rerecording"><X size={13} /></button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm font-bold">
        <label className="flex items-center gap-1">from beat
          <input type="number" min={0} step={0.25} value={region.start} onChange={(e) => setStart(+e.target.value)} className="w-20 rounded-full border border-line bg-white px-2 py-1" aria-label="start beat" />
        </label>
        <label className="flex items-center gap-1">to beat
          <input type="number" min={0} step={0.25} value={region.end} onChange={(e) => setEnd(+e.target.value)} className="w-20 rounded-full border border-line bg-white px-2 py-1" aria-label="end beat" />
        </label>
        <button className="chip" onClick={() => hear(false)}><Headphones size={12} /> hear this part now</button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <RecorderDeck side="B" label="new take" recording={take?.blob ?? null} peaks={take?.peaks ?? []} durationSec={take?.duration ?? 0} busy={busy} onCaptured={capture} compact />
        <div className="space-y-2 text-sm">
          {!take ? (
            <p className="text-ink-soft">record or upload the new version of this part. it gets turned into notes and you can listen before anything changes</p>
          ) : (
            <>
              {take.warning && <p className="rounded-xl bg-butter px-3 py-2">{take.warning}</p>}
              <p>
                <b>{placed.length}</b> new {placed.length === 1 ? "note" : "notes"} will replace <b>{result.removed}</b>
                {result.trimmed ? <>, and <b>{result.trimmed}</b> note before it gets shortened so it stops in time</> : null}. everything outside this part stays the same
              </p>
              <fieldset className="space-y-1">
                <label className="flex items-center gap-2"><input type="radio" checked={align === "firstNote"} onChange={() => setAlign("firstNote")} className="accent-[#B9729B]" /> start my first note right at the start</label>
                <label className="flex items-center gap-2"><input type="radio" checked={align === "recordingStart"} onChange={() => setAlign("recordingStart")} className="accent-[#B9729B]" /> keep the little pause before my first note</label>
              </fieldset>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="chip" onClick={() => hear(true)} disabled={!placed.length && !result.removed}><Play size={12} /> hear it with the change</button>
                <button className="key px-4 py-2 text-sm" style={{ background: "#39343B", color: "#fff" }} disabled={busy}
                  onClick={async () => { setBusy(true); player.stop(); try { await onApply(result.notes, take.blob, region); } finally { setBusy(false); } }}>
                  <Check size={14} /> apply
                </button>
                <button className="chip" onClick={() => { player.stop(); onCancel(); }}>cancel</button>
              </div>
              <p className="text-[11px] text-ink-soft">you can undo it after, and the new take is kept with the song</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
