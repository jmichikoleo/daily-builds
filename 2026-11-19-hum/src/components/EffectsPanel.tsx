// src/components/EffectsPanel.tsx
// one small effects rack for the whole song. reverb, delay, tone, bypass and reset.
import { RotateCcw } from "lucide-react";
import { defaultEffects } from "../lib/moods";
import type { Effects } from "../lib/types";
import { SectionTitle } from "./ui";

interface Props { effects: Effects; onChange: (fx: Effects) => void }

export default function EffectsPanel({ effects, onChange }: Props) {
  const set = (patch: Partial<Effects>) => onChange({ ...effects, ...patch });
  const off = !effects.enabled;
  return (
    <div className="panel p-4 sm:p-5">
      <SectionTitle kicker="effects ♡" title="make it sound like a room, or a dream">
        <span className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={effects.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="h-4 w-4 accent-[#B9729B]" />
            {effects.enabled ? "on" : "bypassed"}
          </label>
          <button className="chip" onClick={() => onChange(defaultEffects())}><RotateCcw size={12} /> reset</button>
        </span>
      </SectionTitle>
      <p className="mb-4 text-xs text-ink-soft">these go on the whole song, every track goes through the same rack. the WAV export uses it too</p>
      <div className={`grid gap-4 sm:grid-cols-3 ${off ? "opacity-50" : ""}`}>
        <Knob label="reverb" hint="dry, then roomy, then huge" value={effects.reverb} min={0} max={1} onChange={(v) => set({ reverb: v })} disabled={off} />
        <Knob label="delay" hint="echoes that bounce after each note" value={effects.delay} min={0} max={1} onChange={(v) => set({ delay: v })} disabled={off} />
        <Knob label="tone" hint="darker to the left, brighter to the right" value={effects.tone} min={-1} max={1} onChange={(v) => set({ tone: v })} disabled={off} />
      </div>
    </div>
  );
}

function Knob({ label, hint, value, min, max, onChange, disabled }: { label: string; hint: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled: boolean }) {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  return (
    <label className="block rounded-2xl border border-line bg-white/80 p-3">
      <span className="flex items-baseline justify-between text-sm font-extrabold">{label}<span className="text-xs font-bold text-ink-soft tabular-nums">{pct}%</span></span>
      <input type="range" min={min} max={max} step={0.01} value={value} disabled={disabled} onChange={(e) => onChange(+e.target.value)} className="mt-2 w-full" aria-label={label} />
      <span className="block text-[11px] text-ink-soft">{hint}</span>
    </label>
  );
}
