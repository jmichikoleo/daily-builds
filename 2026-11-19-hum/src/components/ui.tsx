// src/components/ui.tsx
// small shared visual pieces, waveform, cassette reel, instrument icons, toasts.
import { useEffect, useState } from "react";
import {
  AudioLines, Bell, Church, Cloud, Droplet, Drum, Feather, Gift, Guitar, KeyboardMusic, Music3, Music4, Piano, Radio, Waves, Zap,
  type LucideIcon,
} from "lucide-react";

export const INSTRUMENT_ICON: Record<string, LucideIcon> = {
  piano: Piano, epiano: KeyboardMusic, musicbox: Gift, organ: Church, aguitar: Guitar, eguitar: Zap, violin: Music4,
  cello: Music3, harp: Feather, synthlead: Radio, pad: Cloud, pluck: Droplet, bells: Bell, ebass: AudioLines, synthbass: Waves, drums: Drum,
};

export const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const PITCH_COLORS = ["#DFA8C8", "#C9B6EE", "#A9DCC8", "#F6D98A", "#F2B9CB", "#B7C7F2"];
export const noteColor = (midi: number) => PITCH_COLORS[((midi % 12) + 12) % 12 % PITCH_COLORS.length];

/** Mirrored bar waveform from 0..1 peaks. */
export function PeaksWave({ peaks, className = "", color = "#DFA8C8" }: { peaks: number[]; className?: string; color?: string }) {
  const bars = peaks.length ? peaks : Array.from({ length: 48 }, (_, i) => 0.25 + 0.2 * Math.sin(i / 2.3) ** 2);
  const w = 100 / bars.length;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={className} aria-hidden>
      {bars.map((p, i) => {
        const h = Math.max(2, p * 36);
        return <rect key={i} x={i * w + w * 0.2} y={20 - h / 2} width={w * 0.6} height={h} rx={w * 0.3} fill={color} opacity={peaks.length ? 1 : 0.45} />;
      })}
    </svg>
  );
}

export function computePeaks(data: Float32Array, count = 64): number[] {
  const step = Math.max(1, Math.floor(data.length / count));
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    let max = 0;
    for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 4) max = Math.max(max, Math.abs(data[j]));
    peaks.push(max);
  }
  const top = Math.max(...peaks, 0.001);
  return peaks.map((p) => Math.round((p / top) * 100) / 100);
}

export function Reel({ spin, size = 64 }: { spin: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="reel" data-spin={spin} aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#fff" stroke="#E7D3DD" strokeWidth="2" />
      <circle cx="32" cy="32" r="21" fill="#F7DDE5" />
      <circle cx="32" cy="32" r="8" fill="#fff" stroke="#DFA8C8" strokeWidth="2" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x="30.5" y="13" width="3" height="9" rx="1.5" fill="#DFA8C8" transform={`rotate(${a} 32 32)`} />
      ))}
    </svg>
  );
}

// --- toasts ----------------------------------------------------------------
type ToastMsg = { id: number; text: string };
let pushToast: (text: string) => void = () => {};
export const toast = (text: string) => pushToast(text);

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    pushToast = (text) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, text }]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 2800);
    };
    return () => { pushToast = () => {}; };
  }, []);
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="animate-pop rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lg">{t.text}</div>
      ))}
    </div>
  );
}

export function SectionTitle({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="font-hand text-xl leading-none text-rose-deep">{kicker}</p>
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}
