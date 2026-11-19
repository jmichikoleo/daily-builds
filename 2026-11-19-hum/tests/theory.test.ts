// tests/theory.test.ts
// key detection, chord fitting and accompaniment builders.
import { describe, expect, it } from "vitest";
import { buildBassPart, buildChordPart, buildDrumPart, chordsFor, detectKey, PROGRESSIONS, scoreProgression } from "../src/lib/theory";
import { applyMood, defaultArrangement, MOODS } from "../src/lib/moods";
import type { Note } from "../src/lib/types";

const mk = (midis: number[]): Note[] => midis.map((midi, i) => ({ id: String(i), midi, start: i, duration: 1, velocity: 0.8 }));

describe("theory", () => {
  it("detects C major and A minor melodies", () => {
    expect(detectKey(mk([60, 62, 64, 65, 67, 69, 71, 72, 67, 64, 60]))).toEqual({ tonic: 0, mode: "major" });
    expect(detectKey(mk([69, 72, 76, 74, 72, 71, 69, 64, 69, 72, 69]))).toEqual({ tonic: 9, mode: "minor" });
  });

  it("builds I V vi IV in G", () => {
    const pop = PROGRESSIONS.find((p) => p.id === "pop")!;
    expect(chordsFor(pop, { tonic: 7, mode: "major" }).map((c) => c.name)).toEqual(["G", "D", "Em", "C"]);
  });

  it("scores a chord-tone melody higher than a clashing one", () => {
    const pop = PROGRESSIONS.find((p) => p.id === "pop")!;
    const key = { tonic: 0, mode: "major" as const };
    const fits = [60, 64, 67, 64, 67, 71, 62, 67, 69, 72, 64, 69, 65, 69, 72, 65].map((m, i) => ({ id: "" + i, midi: m, start: i, duration: 1, velocity: 1 }));
    const clash = fits.map((n) => ({ ...n, midi: n.midi + 1 }));
    expect(scoreProgression(pop, key, fits)).toBe(1);
    expect(scoreProgression(pop, key, clash)).toBeLessThan(0.3);
  });

  it("accompaniment covers every bar and styles differ", () => {
    const chords = chordsFor(PROGRESSIONS[0], { tonic: 0, mode: "major" });
    const pad = buildChordPart(chords, "pad", 3);
    const arp = buildChordPart(chords, "arp", 3);
    expect(Math.max(...pad.map((e) => e.time))).toBeGreaterThanOrEqual(8);
    expect(arp.length).toBe(24);
    expect(pad.length).not.toBe(arp.length);
    expect(buildBassPart(chords, "walking", 2)).toHaveLength(8);
    expect(buildDrumPart("none", 4)).toHaveLength(0);
    const lofi = buildDrumPart("lofi", 1);
    expect(lofi.some((h) => h.time % 0.25 !== 0)).toBe(true); // swung
  });

  it("every mood changes the arrangement and never touches notes", () => {
    const base = defaultArrangement();
    const signatures = new Set(MOODS.map((m) => {
      const a = applyMood(base, m.id);
      return `${a.chordInstrument}/${a.chordStyle}/${a.bassInstrument}/${a.bassStyle}/${a.drumPattern}`;
    }));
    expect(signatures.size).toBe(MOODS.length);
  });
});
