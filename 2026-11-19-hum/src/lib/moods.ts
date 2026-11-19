// src/lib/moods.ts — arrangement mood presets and the default arrangement.
import type { Arrangement, MoodId } from "./types";

type MoodPatch = Pick<Arrangement, "chordInstrument" | "chordStyle" | "bassInstrument" | "bassStyle" | "drumPattern" | "reverb"> & {
  volumes: { chords: number; bass: number; drums: number };
};

export const MOODS: { id: MoodId; name: string; blurb: string; color: string; patch: MoodPatch }[] = [
  { id: "dreamy", name: "Dreamy Pop", blurb: "pads, soft kick, lots of space", color: "#DCD0F3",
    patch: { chordInstrument: "pad", chordStyle: "pad", bassInstrument: "synthbass", bassStyle: "roots", drumPattern: "softPop", reverb: 0.55, volumes: { chords: 0.6, bass: 0.55, drums: 0.45 } } },
  { id: "acoustic", name: "Acoustic", blurb: "strummed guitar, finger bass, shaker", color: "#FFF0BE",
    patch: { chordInstrument: "aguitar", chordStyle: "strum", bassInstrument: "ebass", bassStyle: "rootFifth", drumPattern: "acoustic", reverb: 0.2, volumes: { chords: 0.7, bass: 0.6, drums: 0.5 } } },
  { id: "lofi", name: "Lo-fi", blurb: "dusty keys, lazy swung beat", color: "#D4EDE4",
    patch: { chordInstrument: "epiano", chordStyle: "block", bassInstrument: "ebass", bassStyle: "roots", drumPattern: "lofi", reverb: 0.3, volumes: { chords: 0.55, bass: 0.6, drums: 0.6 } } },
  { id: "rnb", name: "R&B", blurb: "seventh-chord stabs, bouncy bass", color: "#F7DDE5",
    patch: { chordInstrument: "epiano", chordStyle: "stabs", bassInstrument: "synthbass", bassStyle: "syncopated", drumPattern: "rnb", reverb: 0.25, volumes: { chords: 0.55, bass: 0.65, drums: 0.6 } } },
  { id: "cinematic", name: "Cinematic", blurb: "harp arpeggios, cello, big toms", color: "#E9DDF5",
    patch: { chordInstrument: "harp", chordStyle: "arp", bassInstrument: "cello", bassStyle: "roots", drumPattern: "cinematic", reverb: 0.7, volumes: { chords: 0.6, bass: 0.6, drums: 0.55 } } },
];

const mix = (volume: number) => ({ volume, muted: false, solo: false });

export function defaultArrangement(): Arrangement {
  return {
    enabled: false,
    mood: null,
    key: { tonic: 0, mode: "major" },
    progressionId: "pop",
    chordInstrument: "piano",
    chordStyle: "block",
    bassInstrument: "ebass",
    bassStyle: "roots",
    drumPattern: "softPop",
    reverb: 0.25,
    tracks: { lead: mix(0.85), chords: mix(0.6), bass: mix(0.6), drums: mix(0.5), layer: mix(0.7) },
  };
}

export function applyMood(a: Arrangement, mood: MoodId): Arrangement {
  const m = MOODS.find((x) => x.id === mood)!;
  const { volumes, ...rest } = m.patch;
  return {
    ...a,
    ...rest,
    mood,
    enabled: true,
    tracks: {
      ...a.tracks,
      chords: { ...a.tracks.chords, volume: volumes.chords },
      bass: { ...a.tracks.bass, volume: volumes.bass },
      drums: { ...a.tracks.drums, volume: volumes.drums },
    },
  };
}
