// tests/transcribe.test.ts
// checks the hum transcriber against synthetic "hums" with known notes.
import { describe, expect, it } from "vitest";
import { transcribe, quantize } from "../src/audio/transcribe";

const SR = 44100;
const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** A hum-like voice: fundamental + soft harmonics, vibrato, soft attack/release, optional noise. */
function hum(parts: { midi: number | null; sec: number }[], opts: { noise?: number; legato?: boolean; rate?: number } = {}) {
  const rate = opts.rate ?? SR;
  const total = parts.reduce((s, p) => s + p.sec, 0);
  const out = new Float32Array(Math.ceil(total * rate));
  let phase = 0;
  let i = 0;
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const p of parts) {
    const n = Math.floor(p.sec * rate);
    for (let k = 0; k < n; k++, i++) {
      const t = k / rate;
      let s = 0;
      if (p.midi !== null) {
        const hz = midiToHz(p.midi) * (1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * (i / rate))); // ~10 cent vibrato
        phase += (2 * Math.PI * hz) / rate;
        const env = opts.legato ? 1 : Math.min(1, t / 0.03, (p.sec - t) / 0.04);
        s = env * 0.3 * (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase) + 0.1 * Math.sin(4 * phase));
      }
      out[i] = s + (opts.noise ?? 0) * rand();
    }
  }
  return out;
}

const pitches = (r: ReturnType<typeof transcribe>) => r.notes.map((n) => n.midi);

describe("transcribe", () => {
  it("recovers a simple detached melody", () => {
    const melody = [60, 64, 67, 64, 60];
    const audio = hum(melody.flatMap((m) => [{ midi: m, sec: 0.45 }, { midi: null, sec: 0.12 }]));
    const r = transcribe(audio, SR, 60);
    expect(pitches(r)).toEqual(melody);
    // at 60 bpm, 1 beat = 1 s: starts should be ~0.57 s apart
    r.notes.forEach((n, i) => {
      expect(Math.abs(n.start - i * 0.57)).toBeLessThan(0.08);
      expect(Math.abs(n.duration - 0.45)).toBeLessThan(0.1);
    });
    expect(r.quality.ok).toBe(true);
  });

  it("splits legato pitch changes without gaps", () => {
    const melody = [57, 59, 60, 62, 64];
    const audio = hum([{ midi: null, sec: 0.2 }, ...melody.map((m) => ({ midi: m, sec: 0.35 })), { midi: null, sec: 0.2 }], { legato: true });
    expect(pitches(transcribe(audio, SR, 90))).toEqual(melody);
  });

  it("handles a low male hum and a high voice", () => {
    expect(pitches(transcribe(hum([{ midi: 45, sec: 0.6 }, { midi: null, sec: 0.1 }, { midi: 50, sec: 0.6 }]), SR, 90))).toEqual([45, 50]);
    expect(pitches(transcribe(hum([{ midi: 76, sec: 0.5 }, { midi: null, sec: 0.1 }, { midi: 79, sec: 0.5 }]), SR, 90))).toEqual([76, 79]);
  });

  it("works at 48 kHz with light background noise", () => {
    const melody = [62, 62, 66, 69];
    const audio = hum(melody.flatMap((m) => [{ midi: m, sec: 0.4 }, { midi: null, sec: 0.15 }]), { noise: 0.02, rate: 48000 });
    const r = transcribe(audio, 48000, 90);
    expect(pitches(r)).toEqual(melody);
  });

  it("does not invent notes from noise or silence", () => {
    const silence = new Float32Array(SR * 2);
    const rs = transcribe(silence, SR, 90);
    expect(rs.notes).toHaveLength(0);
    expect(rs.quality.ok).toBe(false);

    const noise = hum([{ midi: null, sec: 2 }], { noise: 0.3 });
    const rn = transcribe(noise, SR, 90);
    expect(rn.notes.length).toBeLessThanOrEqual(1);
    expect(rn.quality.warning).not.toBeNull();
  });

  it("drops blips shorter than 80 ms", () => {
    const audio = hum([{ midi: 60, sec: 0.5 }, { midi: null, sec: 0.2 }, { midi: 72, sec: 0.04 }, { midi: null, sec: 0.2 }]);
    expect(pitches(transcribe(audio, SR, 90))).toEqual([60]);
  });

  it("quantize snaps to the grid", () => {
    const q = quantize([{ id: "a", midi: 60, start: 0.13, duration: 0.4, velocity: 1 }], 0.25);
    expect(q[0].start).toBe(0.25);
    expect(q[0].duration).toBe(0.5);
  });
});
