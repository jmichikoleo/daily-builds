// src/components/LayerPanel.tsx — "add another hum": record a second melody, pick its instrument,
// nudge its timing, and play it with the lead.
import { Trash2 } from "lucide-react";
import { MELODIC } from "../audio/instruments";
import type { Song } from "../lib/types";
import RecorderDeck from "./RecorderDeck";
import { SectionTitle } from "./ui";

interface Props {
  song: Song;
  recording: Blob | null;
  busy: boolean;
  warning: string | null;
  peaks: number[];
  durationSec: number;
  onCaptured: (blob: Blob) => void;
  onChange: (layer: Song["layer"]) => void;
  onRemove: () => void;
}

export default function LayerPanel({ song, recording, busy, warning, peaks, durationSec, onCaptured, onChange, onRemove }: Props) {
  const layer = song.layer;
  return (
    <div className="panel p-4 sm:p-5">
      <SectionTitle kicker="harmony, counter-melody, a little echo" title="add another hum">
        {layer && <button className="chip" onClick={onRemove}><Trash2 size={13} /> remove layer</button>}
      </SectionTitle>
      {!song.notes.length ? (
        <p className="text-sm text-ink-soft">record your main melody first — then hum a second part on top of it.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <RecorderDeck side="B" label="second hum" recording={recording} peaks={peaks} durationSec={durationSec} busy={busy} onCaptured={onCaptured} compact />
          <div className="space-y-3">
            {warning && <p className="rounded-xl bg-butter px-3 py-2 text-sm">{warning}</p>}
            {!layer ? (
              <p className="text-sm text-ink-soft">
                tip: press play on the main melody with headphones on, then record your second hum. it's added as its own track
                (shown as dashed mint notes in the melody editor) and you can slide it into place below.
              </p>
            ) : (
              <>
                <p className="text-sm"><b>{layer.notes.length}</b> notes in this layer.</p>
                <label className="block text-sm font-bold">
                  instrument
                  <select className="mt-1 block w-full rounded-xl border border-line bg-white px-2 py-2 text-sm font-normal" value={layer.instrument} onChange={(e) => onChange({ ...layer, instrument: e.target.value })}>
                    {MELODIC.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold">
                  timing offset: {layer.offset > 0 ? "+" : ""}{layer.offset.toFixed(2)} beats
                  <input type="range" min={-8} max={8} step={0.25} value={layer.offset} onChange={(e) => onChange({ ...layer, offset: +e.target.value })} className="mt-1 block w-full" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="chip" onClick={() => onChange({ ...layer, offset: 0 })}>reset offset</button>
                  <button className="chip" onClick={() => onChange({ ...layer, notes: layer.notes.map((n) => ({ ...n, midi: n.midi + 12 })) })}>octave up</button>
                  <button className="chip" onClick={() => onChange({ ...layer, notes: layer.notes.map((n) => ({ ...n, midi: n.midi - 12 })) })}>octave down</button>
                  <button className="chip" onClick={() => onChange({ ...layer, notes: layer.originalNotes })}>undo layer edits</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
