// src/lib/sound.ts
// optional sound effects made with the web audio api. off by default,
// switched on in the explorer profile. no audio files are downloaded.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** a soft rubber stamp thump */
export function thump() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.3);
}

/** two gentle notes for a discovery */
export function chime() {
  const a = audio();
  if (!a) return;
  [660, 990].forEach((f, i) => {
    const t = a.currentTime + i * 0.14;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}
