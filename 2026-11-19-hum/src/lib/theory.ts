// src/lib/theory.ts — small, rule-based music theory: key detection, chords, bass, drums.
import type { BassStyle, ChordStyle, DrumPatternId, Note } from "./types";

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const midiName = (m: number) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
export const isBlackKey = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
export const keyName = (k: { tonic: number; mode: "major" | "minor" }) =>
  `${NOTE_NAMES[k.tonic]} ${k.mode}`;

// Krumhansl–Kessler key profiles.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlate(a: number[], b: number[]) {
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Duration-weighted pitch-class histogram vs. key profiles. */
export function detectKey(notes: Note[]): { tonic: number; mode: "major" | "minor" } {
  if (!notes.length) return { tonic: 0, mode: "major" };
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[((n.midi % 12) + 12) % 12] += n.duration;
  let best = { tonic: 0, mode: "major" as "major" | "minor", score: -Infinity };
  for (let t = 0; t < 12; t++) {
    const rot = hist.map((_, i) => hist[(i + t) % 12]);
    const maj = correlate(rot, MAJOR);
    const min = correlate(rot, MINOR);
    if (maj > best.score) best = { tonic: t, mode: "major", score: maj };
    if (min > best.score) best = { tonic: t, mode: "minor", score: min };
  }
  return { tonic: best.tonic, mode: best.mode };
}

// Chords are written as scale degrees (0-based) + quality.
type Quality = "maj" | "min" | "dim";
interface Degree { deg: number; q: Quality; label: string }
export interface Progression { id: string; name: string; mode: "major" | "minor"; chords: Degree[] }

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const d = (deg: number, q: Quality, label: string): Degree => ({ deg, q, label });

export const PROGRESSIONS: Progression[] = [
  { id: "pop", name: "the pop classic", mode: "major", chords: [d(0, "maj", "I"), d(4, "maj", "V"), d(5, "min", "vi"), d(3, "maj", "IV")] },
  { id: "fifties", name: "sweet & nostalgic", mode: "major", chords: [d(0, "maj", "I"), d(5, "min", "vi"), d(3, "maj", "IV"), d(4, "maj", "V")] },
  { id: "sensitive", name: "bittersweet", mode: "major", chords: [d(5, "min", "vi"), d(3, "maj", "IV"), d(0, "maj", "I"), d(4, "maj", "V")] },
  { id: "lift", name: "hopeful lift", mode: "major", chords: [d(0, "maj", "I"), d(3, "maj", "IV"), d(5, "min", "vi"), d(4, "maj", "V")] },
  { id: "jazzy", name: "jazzy turnaround", mode: "major", chords: [d(1, "min", "ii"), d(4, "maj", "V"), d(0, "maj", "I"), d(5, "min", "vi")] },
  { id: "epic", name: "epic minor", mode: "minor", chords: [d(0, "min", "i"), d(5, "maj", "VI"), d(2, "maj", "III"), d(6, "maj", "VII")] },
  { id: "moody", name: "moody & slow", mode: "minor", chords: [d(0, "min", "i"), d(3, "min", "iv"), d(6, "maj", "VII"), d(2, "maj", "III")] },
  { id: "drift", name: "night drive", mode: "minor", chords: [d(0, "min", "i"), d(6, "maj", "VII"), d(5, "maj", "VI"), d(6, "maj", "VII")] },
];

export interface Chord { root: number; tones: number[]; label: string; name: string } // root as MIDI in octave 3

export function chordsFor(prog: Progression, key: { tonic: number; mode: "major" | "minor" }): Chord[] {
  // Progressions written for the other mode are borrowed onto the relative key.
  const tonic = prog.mode === key.mode ? key.tonic : key.mode === "major" ? (key.tonic + 9) % 12 : (key.tonic + 3) % 12;
  const progScale = prog.mode === "major" ? MAJOR_SCALE : MINOR_SCALE;
  return prog.chords.map((c) => {
    const rootPc = (tonic + progScale[c.deg]) % 12;
    const third = c.q === "maj" ? 4 : 3;
    const fifth = c.q === "dim" ? 6 : 7;
    const root = 48 + rootPc; // C3..B3
    const suffix = c.q === "min" ? "m" : c.q === "dim" ? "°" : "";
    return { root, tones: [0, third, fifth], label: c.label, name: `${NOTE_NAMES[rootPc]}${suffix}` };
  });
}

/** How well a progression fits the melody: share of note-time landing on chord tones. */
export function scoreProgression(prog: Progression, key: { tonic: number; mode: "major" | "minor" }, notes: Note[]): number {
  if (!notes.length) return 0;
  const chords = chordsFor(prog, key);
  let hit = 0, total = 0;
  for (const n of notes) {
    const bar = Math.floor(n.start / 4);
    const c = chords[bar % chords.length];
    const pcs = c.tones.map((t) => (c.root + t) % 12);
    total += n.duration;
    if (pcs.includes(((n.midi % 12) + 12) % 12)) hit += n.duration;
  }
  return total ? hit / total : 0;
}

export interface ScheduledNote { time: number; midi: number; duration: number; velocity: number } // beats

/** Chord accompaniment, one chord per bar, looped across `bars`. */
export function buildChordPart(chords: Chord[], style: ChordStyle, bars: number): ScheduledNote[] {
  const out: ScheduledNote[] = [];
  for (let b = 0; b < bars; b++) {
    const c = chords[b % chords.length];
    const t0 = b * 4;
    // voicing: lift to around middle C, spread a bit for pads
    const voice = c.tones.map((t) => c.root + 12 + t);
    if (style === "pad") voice.push(c.root + 24); // add octave on top
    switch (style) {
      case "pad":
        voice.forEach((m) => out.push({ time: t0, midi: m, duration: 3.9, velocity: 0.45 }));
        break;
      case "block":
        [0, 2].forEach((beat) => voice.forEach((m) => out.push({ time: t0 + beat, midi: m, duration: 1.9, velocity: 0.55 })));
        break;
      case "strum":
        // down strums on 1, 2-and, 3, 4 with a tiny spread between strings
        [0, 1.5, 2, 3].forEach((beat, i) => {
          const notes = [c.root, ...voice];
          notes.forEach((m, j) => out.push({ time: t0 + beat + j * 0.03, midi: m, duration: 1.2, velocity: i === 0 ? 0.65 : 0.5 }));
        });
        break;
      case "arp": {
        const seq = [voice[0], voice[1], voice[2], voice[1] + 12, voice[2], voice[1], voice[0] + 12, voice[1]];
        seq.forEach((m, i) => out.push({ time: t0 + i * 0.5, midi: m, duration: 0.9, velocity: 0.45 }));
        break;
      }
      case "stabs":
        // off-beat R&B stabs, 7th added
        [0.5, 1.75, 2.5, 3.5].forEach((beat) => [...voice, c.root + 12 + (c.tones[1] === 3 ? 10 : 11)].forEach((m) =>
          out.push({ time: t0 + beat, midi: m, duration: 0.4, velocity: 0.5 })));
        break;
    }
  }
  return out;
}

export function buildBassPart(chords: Chord[], style: BassStyle, bars: number): ScheduledNote[] {
  const out: ScheduledNote[] = [];
  for (let b = 0; b < bars; b++) {
    const c = chords[b % chords.length];
    const next = chords[(b + 1) % chords.length];
    const root = c.root - 12; // octave 2
    const fifth = root + 7;
    const t0 = b * 4;
    const n = (t: number, midi: number, dur: number, v = 0.8) => out.push({ time: t0 + t, midi, duration: dur, velocity: v });
    switch (style) {
      case "roots": n(0, root, 3.8); break;
      case "rootFifth": n(0, root, 1.8); n(2, fifth, 1.8, 0.7); break;
      case "octaves": [0, 1, 2, 3].forEach((t, i) => n(t, i % 2 ? root + 12 : root, 0.9, i % 2 ? 0.6 : 0.8)); break;
      case "syncopated": n(0, root, 1.4); n(1.5, root, 0.4, 0.6); n(2.5, fifth, 0.9, 0.7); n(3.5, root + 12, 0.4, 0.55); break;
      case "walking": {
        const target = next.root - 12;
        const approach = target > root ? target - 1 : target + 1;
        [root, root + c.tones[1], fifth, approach].forEach((m, i) => n(i, m, 0.95, i ? 0.65 : 0.8));
        break;
      }
    }
  }
  return out;
}

// 16-step drum grids (one bar of 16th notes). x = hit, o = ghost/soft.
export interface DrumPattern { id: DrumPatternId; name: string; swing: number; perc_kind: "shaker" | "rim" | "tom"; kick: string; snare: string; hat: string; perc: string }
export const DRUM_PATTERNS: DrumPattern[] = [
  { id: "softPop", perc_kind: "shaker", name: "soft pop", swing: 0, kick: "x.......x.x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", perc: "................" },
  { id: "lofi", perc_kind: "rim", name: "lo-fi", swing: 0.3, kick: "x......x..x.....", snare: "....x.......x..o", hat: "x.x.x.xox.x.x.xo", perc: "................" },
  { id: "rnb", perc_kind: "rim", name: "r&b", swing: 0.15, kick: "x.....x...x..x..", snare: "....x.......x...", hat: "x.xxx.x.x.xxx.x.", perc: "...o.......o...." },
  { id: "indie", perc_kind: "shaker", name: "indie", swing: 0, kick: "x...x...x...x...", snare: "....x.......x...", hat: "xxxxxxxxxxxxxxxx", perc: "................" },
  { id: "acoustic", perc_kind: "shaker", name: "simple acoustic", swing: 0.1, kick: "x.......x.......", snare: "................", hat: "................", perc: "..x...x...x...xo" },
  { id: "cinematic", perc_kind: "tom", name: "cinematic toms", swing: 0, kick: "x.........x.....", snare: "................", hat: "................", perc: "x...x.x.x...x.x." },
  { id: "none", perc_kind: "shaker", name: "no drums", swing: 0, kick: "", snare: "", hat: "", perc: "" },
];

const PIECE_MIDI = { kick: 36, snare: 38, hat: 42, shaker: 70, rim: 37, tom: 45 } as const;

export interface DrumHit { time: number; midi: number; velocity: number } // beats; midi = GM drum note

export function buildDrumPart(id: DrumPatternId, bars: number): DrumHit[] {
  const p = DRUM_PATTERNS.find((x) => x.id === id);
  if (!p || id === "none") return [];
  const out: DrumHit[] = [];
  for (let b = 0; b < bars; b++) {
    for (const piece of ["kick", "snare", "hat", "perc"] as const) {
      const grid = p[piece];
      const midi = piece === "perc" ? PIECE_MIDI[p.perc_kind] : PIECE_MIDI[piece];
      for (let s = 0; s < grid.length; s++) {
        if (grid[s] === ".") continue;
        const swing = s % 2 === 1 ? p.swing * 0.125 : 0; // delay off-beat 16ths
        out.push({ time: b * 4 + s * 0.25 + swing, midi, velocity: grid[s] === "o" ? 0.35 : 0.8 });
      }
    }
  }
  return out;
}
