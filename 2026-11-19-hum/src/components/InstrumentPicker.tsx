// src/components/InstrumentPicker.tsx — instrument library: browse by category, preview, select.
// Sidebar on desktop, horizontal carousel on mobile.
import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Loader2, Volume2 } from "lucide-react";
import { CATEGORIES, INSTRUMENTS, getLoadState, onLoadStateChange, type Category } from "../audio/instruments";
import { previewInstrument } from "../audio/player";
import { INSTRUMENT_ICON, SectionTitle } from "./ui";

interface Props {
  selected: string;
  onSelect: (id: string) => void;
  volume: number;
  onVolume: (v: number) => void;
}

const useLoadStates = () => useSyncExternalStore(onLoadStateChange, () => INSTRUMENTS.map((i) => getLoadState(i.id)).join(","));

export default function InstrumentPicker({ selected, onSelect, volume, onVolume }: Props) {
  const [cat, setCat] = useState<Category | "all">("all");
  useLoadStates();
  const list = INSTRUMENTS.filter((i) => cat === "all" || i.category === cat);

  return (
    <div className="panel p-4 sm:p-5">
      <SectionTitle kicker="the instrument shelf" title="what should your melody sound like?" />
      <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button className="chip shrink-0" aria-pressed={cat === "all"} onClick={() => setCat("all")}>all 16</button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className="chip shrink-0" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
      </div>

      <ul className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 lg:grid lg:max-h-[460px] lg:grid-cols-2 lg:overflow-y-auto lg:overflow-x-hidden">
        {list.map((inst) => {
          const Icon = INSTRUMENT_ICON[inst.id];
          const isSel = inst.id === selected;
          const state = getLoadState(inst.id);
          return (
            <li key={inst.id} className="w-36 shrink-0 snap-start lg:w-auto">
              <div
                className={`relative h-full rounded-2xl border p-3 transition ${isSel ? "border-ink bg-white shadow-[0_0_0_2px_#39343B]" : "border-line bg-white/70 hover:-translate-y-0.5 hover:border-rose"}`}
              >
                <button
                  className="block w-full text-left disabled:cursor-not-allowed"
                  onClick={() => { if (!inst.drumsOnly) { onSelect(inst.id); previewInstrument(inst.id); } else previewInstrument(inst.id); }}
                  aria-pressed={isSel}
                  title={inst.drumsOnly ? "the drum kit plays the drum track in “arrange”" : `use ${inst.name} for the melody`}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: inst.color }}>
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <span className="mt-2 block text-sm font-extrabold leading-tight">{inst.name}</span>
                  <span className="block text-[11px] leading-snug text-ink-soft">{inst.blurb}</span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-rose-deep/80">
                    {inst.drumsOnly ? "drum track only" : inst.kind === "sampled" ? (state === "fallback" ? "synth stand-in" : "sampled") : "synthesized"}
                  </span>
                </button>
                <button
                  onClick={() => previewInstrument(inst.id)}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-pearl hover:bg-blush"
                  aria-label={`preview ${inst.name}`}
                >
                  {state === "loading" ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
                </button>
                {isSel && <span className="absolute bottom-2 right-2 grid h-5 w-5 place-items-center rounded-full bg-ink text-white"><Check size={12} /></span>}
              </div>
            </li>
          );
        })}
      </ul>

      <label className="mt-3 flex items-center gap-3 text-sm font-bold">
        melody volume
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onVolume(+e.target.value)} className="flex-1" />
      </label>
      <SampleNote />
    </div>
  );
}

function SampleNote() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);
  return (
    <p className="mt-2 text-[11px] text-ink-soft">
      {offline
        ? "you're offline — sampled instruments will use a synth stand-in until you reconnect."
        : "sampled instruments load the first time you pick them."}
    </p>
  );
}
