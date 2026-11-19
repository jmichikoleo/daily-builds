// src/lib/effects.ts
// turns the friendly 0..1 effect sliders into safe audio settings.
import type { Effects } from "./types";

export interface EffectParams {
  reverbSend: number; // gain into the reverb
  delaySend: number; // gain into the delay
  delayFeedback: number; // always below 0.55 so it can't run away
  lowDb: number; // tone tilt
  highDb: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

export function effectParams(fx: Effects): EffectParams {
  if (!fx.enabled) return { reverbSend: 0, delaySend: 0, delayFeedback: 0, lowDb: 0, highDb: 0 };
  const reverb = clamp01(fx.reverb);
  const delay = clamp01(fx.delay);
  const tone = Math.max(-1, Math.min(1, Number.isFinite(fx.tone) ? fx.tone : 0));
  return {
    reverbSend: reverb * 0.55,
    delaySend: delay * 0.45,
    delayFeedback: 0.15 + delay * 0.38, // max 0.53
    lowDb: tone < 0 ? -tone * 3 : -tone * 2,
    highDb: tone < 0 ? tone * 9 : tone * 6,
  };
}
