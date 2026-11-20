// src/audio/sfx.ts
// tiny original sound effects made with the web audio api. no files.
// the audio context is only created after a user gesture, voices are capped
// and each sound has a short cooldown so a busy minute never turns into noise.

export type SfxName =
  | "tick"
  | "go"
  | "point"
  | "bigPoint"
  | "wrong"
  | "warning"
  | "record"
  | "finish"
  | "click"
  | "splash"
  | "hop"
  | "pop";

interface Note {
  f: number; // frequency
  to?: number; // slide target
  d: number; // duration seconds
  at?: number; // delay seconds
  type?: OscillatorType;
  g?: number; // gain
}

const SOUNDS: Record<SfxName, Note[]> = {
  tick: [{ f: 660, d: 0.08, type: "square", g: 0.25 }],
  go: [{ f: 523, d: 0.1, type: "square" }, { f: 784, d: 0.18, at: 0.08, type: "square" }],
  point: [{ f: 880, to: 1320, d: 0.08, type: "triangle" }],
  bigPoint: [{ f: 660, d: 0.07, type: "triangle" }, { f: 990, d: 0.07, at: 0.06, type: "triangle" }, { f: 1320, d: 0.12, at: 0.12, type: "triangle" }],
  wrong: [{ f: 220, to: 140, d: 0.18, type: "sawtooth", g: 0.35 }],
  warning: [{ f: 440, d: 0.12, type: "square", g: 0.3 }, { f: 440, d: 0.12, at: 0.2, type: "square", g: 0.3 }],
  record: [523, 659, 784, 1047].map((f, i) => ({ f, d: 0.14, at: i * 0.1, type: "triangle" as const })),
  finish: [{ f: 784, d: 0.12, type: "square", g: 0.3 }, { f: 523, d: 0.25, at: 0.12, type: "square", g: 0.3 }],
  click: [{ f: 1200, d: 0.03, type: "square", g: 0.15 }],
  splash: [{ f: 400, to: 80, d: 0.3, type: "sine", g: 0.5 }],
  hop: [{ f: 300, to: 600, d: 0.08, type: "sine", g: 0.4 }],
  pop: [{ f: 500, to: 900, d: 0.06, type: "sine", g: 0.4 }],
};

const COOLDOWN_MS = 45;
const MAX_VOICES = 8;
const MASTER = 0.12;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let voices = 0;
const lastPlayed = new Map<SfxName, number>();

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (!on && ctx && ctx.state === "running") void ctx.suspend().catch(() => {});
  if (on && ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
}

export function isSoundEnabled() {
  return enabled;
}

/** call from a click or key handler. browsers only allow audio after a gesture */
export function unlockAudio() {
  if (!enabled) return;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

export function playSfx(name: SfxName) {
  if (!enabled || !ctx || !master || ctx.state !== "running") return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -1e9) < COOLDOWN_MS) return;
  if (voices >= MAX_VOICES) return;
  lastPlayed.set(name, now);
  const t0 = ctx.currentTime;
  for (const n of SOUNDS[name]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const start = t0 + (n.at ?? 0);
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.f, start);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.d);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(n.g ?? 0.5, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
    osc.connect(g).connect(master);
    voices++;
    osc.onended = () => {
      voices--;
      osc.disconnect();
      g.disconnect();
    };
    osc.start(start);
    osc.stop(start + n.d + 0.02);
  }
}
