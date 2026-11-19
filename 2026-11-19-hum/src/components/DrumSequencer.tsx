// src/components/DrumSequencer.tsx
// a 16-step drum grid. toggle steps, load presets, clear, and loop it at the song's bpm.
import { useEffect, useRef, useState } from "react";
import { Eraser, Play, Square } from "lucide-react";
import { player } from "../audio/player";
import { DRUM_PRESETS, cleanGrid, presetGrid, toggleStep } from "../lib/theory";
import type { DrumGrid, DrumRow, Effects } from "../lib/types";
import { SectionTitle } from "./ui";

interface Props {
  grid: DrumGrid;
  bpm: number;
  volume: number;
  effects: Effects;
  bandOn: boolean;
  onChange: (g: DrumGrid) => void;
}

const ROWS: { id: DrumRow; label: string; color: string }[] = [
  { id: "kick", label: "kick", color: "#DFA8C8" },
  { id: "snare", label: "snare", color: "#C9B6EE" },
  { id: "closedHat", label: "closed hat", color: "#A9DCC8" },
  { id: "openHat", label: "open hat", color: "#F6D98A" },
  { id: "perc", label: "extra", color: "#F2B9CB" },
];

export default function DrumSequencer({ grid, bpm, volume, effects, bandOn, onChange }: Props) {
  const [looping, setLooping] = useState(false);
  const [step, setStep] = useState(-1);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const fxRef = useRef(effects);
  fxRef.current = effects;

  // stop the loop when something else starts playing or this panel closes
  useEffect(() => player.subscribe(() => { if (!player.playing) { setLooping(false); setStep(-1); } }), []);
  const loopingRef = useRef(false);
  loopingRef.current = looping;
  useEffect(() => () => { if (loopingRef.current) player.stop(); }, []);

  // a bpm change restarts the loop at the new speed
  useEffect(() => { if (loopingRef.current) startLoop(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bpm]);

  const startLoop = () => {
    setLooping(true);
    player.playDrumLoop(() => gridRef.current, bpm, volume, () => fxRef.current, setStep);
  };

  return (
    <div className="panel p-4 sm:p-5">
      <SectionTitle kicker="the beat" title="make your own drum pattern">
        <span className="flex flex-wrap items-center gap-1.5">
          {looping ? (
            <button className="chip" onClick={() => player.stop()}><Square size={12} fill="currentColor" /> stop</button>
          ) : (
            <button className="chip" onClick={startLoop}><Play size={12} fill="currentColor" /> loop it</button>
          )}
          <button className="chip" onClick={() => onChange({ ...cleanGrid(null), percSound: grid.percSound })}><Eraser size={12} /> clear</button>
        </span>
      </SectionTitle>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {DRUM_PRESETS.map((p) => (
          <button key={p.id} className="chip" aria-pressed={grid.preset === p.id} onClick={() => onChange(presetGrid(p.id))}>{p.name}</button>
        ))}
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[560px] space-y-1.5">
          {ROWS.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs font-extrabold">
                {r.id === "perc" ? (
                  <select value={grid.percSound} onChange={(e) => onChange({ ...grid, percSound: e.target.value as DrumGrid["percSound"] })}
                    className="w-full rounded-full border border-line bg-white px-1 py-0.5 text-[11px] font-bold" aria-label="extra sound">
                    <option value="shaker">shaker</option>
                    <option value="rim">rim</option>
                    <option value="tom">tom</option>
                  </select>
                ) : r.label}
              </span>
              <div className="grid flex-1 grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((group) => (
                  <div key={group} className="grid grid-cols-4 gap-1">
                    {[0, 1, 2, 3].map((i) => {
                      const s = group * 4 + i;
                      const on = grid.steps[r.id][s];
                      return (
                        <button
                          key={s}
                          onClick={() => onChange(toggleStep(grid, r.id, s))}
                          aria-pressed={on}
                          aria-label={`${r.label} step ${s + 1}`}
                          className={`h-8 rounded-lg border transition ${s === step ? "ring-2 ring-ink/60" : ""} ${on ? "border-black/10 shadow-sm" : "border-line bg-white hover:bg-pearl"}`}
                          style={on ? { background: r.color } : undefined}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <label className="mt-3 flex max-w-sm items-center gap-3 text-sm font-bold">
        swing
        <input type="range" min={0} max={1} step={0.05} value={grid.swing} onChange={(e) => onChange({ ...grid, swing: +e.target.value })} className="flex-1" aria-label="swing" />
      </label>
      <p className="mt-2 text-xs text-ink-soft">
        loops at {bpm} bpm.{" "}
        {bandOn ? "this beat plays under your melody when you press play" : "turn the band on in arrange to hear this beat under your melody"}
      </p>
    </div>
  );
}
