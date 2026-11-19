// src/audio/instruments.ts
// the instrument library, 11 sampled instruments (FluidR3 GM, CC-BY 3.0)
// loaded on demand, 5 synthesized ones built with Tone.js, plus a synthesized drum kit.
import * as Tone from "tone";

export type Category = "keys" | "strings" | "synths" | "bass";

export interface InstrumentDef {
  id: string;
  name: string;
  category: Category;
  kind: "sampled" | "synth";
  blurb: string;
  color: string; // card tint
  gm?: string; // soundfont folder name
  octaves?: [number, number]; // sample octaves to load
  drumsOnly?: boolean;
  fallback?: () => Voice; // synth stand-in if samples fail to load
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "keys", label: "keys" },
  { id: "strings", label: "guitars & strings" },
  { id: "synths", label: "synths & atmosphere" },
  { id: "bass", label: "bass & rhythm" },
];

export interface Voice {
  output: Tone.ToneAudioNode;
  /** time is an AudioContext time, duration in seconds */
  play(midi: number, duration: number, time: number, velocity: number): void;
  releaseAll(): void;
  dispose(): void;
}

const SAMPLE_BASE = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/";
const SAMPLE_NOTES = ["C", "Eb", "Gb", "A"];
const SAMPLE_PC = [0, 3, 6, 9];

export const INSTRUMENTS: InstrumentDef[] = [
  { id: "piano", name: "Grand Piano", category: "keys", kind: "sampled", gm: "acoustic_grand_piano", octaves: [1, 6], blurb: "warm, classic, honest", color: "#F7DDE5" },
  { id: "epiano", name: "Electric Piano", category: "keys", kind: "sampled", gm: "electric_piano_1", octaves: [2, 6], blurb: "soft rhodes glow", color: "#FFF0BE" },
  { id: "musicbox", name: "Music Box", category: "keys", kind: "sampled", gm: "music_box", octaves: [3, 7], blurb: "tiny, twinkly, bedtime", color: "#DCD0F3" },
  { id: "organ", name: "Organ", category: "keys", kind: "sampled", gm: "drawbar_organ", octaves: [2, 6], blurb: "churchy and buzzy", color: "#D4EDE4" },
  { id: "aguitar", name: "Acoustic Guitar", category: "strings", kind: "sampled", gm: "acoustic_guitar_nylon", octaves: [2, 5], blurb: "nylon strings, campfire", color: "#FFF0BE" },
  { id: "eguitar", name: "Electric Guitar", category: "strings", kind: "sampled", gm: "electric_guitar_clean", octaves: [2, 5], blurb: "clean, jangly, indie", color: "#F7DDE5" },
  { id: "violin", name: "Violin", category: "strings", kind: "sampled", gm: "violin", octaves: [3, 6], blurb: "sings like a voice", color: "#DCD0F3" },
  { id: "cello", name: "Cello", category: "strings", kind: "sampled", gm: "cello", octaves: [2, 5], blurb: "deep and tender", color: "#D4EDE4" },
  { id: "harp", name: "Harp", category: "strings", kind: "sampled", gm: "orchestral_harp", octaves: [2, 6], blurb: "fairy-tale sparkle", color: "#FFF0BE" },
  { id: "synthlead", name: "Synth Lead", category: "synths", kind: "synth", blurb: "bright retro saw", color: "#F7DDE5" },
  { id: "pad", name: "Dreamy Pad", category: "synths", kind: "synth", blurb: "floaty cloud of sound", color: "#DCD0F3" },
  { id: "pluck", name: "Pluck Synth", category: "synths", kind: "synth", blurb: "bouncy little plinks", color: "#D4EDE4" },
  { id: "bells", name: "Ambient Bells", category: "synths", kind: "synth", blurb: "glassy FM chimes", color: "#FFF0BE" },
  { id: "ebass", name: "Electric Bass", category: "bass", kind: "sampled", gm: "electric_bass_finger", octaves: [1, 4], blurb: "round finger bass", color: "#D4EDE4" },
  { id: "synthbass", name: "Synth Bass", category: "bass", kind: "synth", blurb: "squelchy and low", color: "#DCD0F3" },
  { id: "drums", name: "Drum Kit", category: "bass", kind: "synth", blurb: "for the drum track", color: "#F7DDE5", drumsOnly: true },
];

export const getInstrument = (id: string) => INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];
export const MELODIC = INSTRUMENTS.filter((i) => !i.drumsOnly);

// ---------------------------------------------------------------------------
// Sample loading (on demand, cached as decoded AudioBuffers so they can be
// reused by both the live context and the offline WAV renderer).

export type LoadState = "idle" | "loading" | "ready" | "fallback";
const bufferCache = new Map<string, Promise<Map<number, AudioBuffer> | null>>();
const loadStates = new Map<string, LoadState>();
const listeners = new Set<() => void>();
export const onLoadStateChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const setState = (id: string, s: LoadState) => { loadStates.set(id, s); listeners.forEach((l) => l()); };
export const getLoadState = (id: string): LoadState => {
  const def = getInstrument(id);
  return def.kind === "synth" ? "ready" : loadStates.get(id) ?? "idle";
};

let decoder: OfflineAudioContext | null = null;
export async function decodeArrayBuffer(data: ArrayBuffer): Promise<AudioBuffer> {
  decoder ??= new OfflineAudioContext(1, 1, 44100);
  return decoder.decodeAudioData(data);
}

export function loadSamples(id: string): Promise<Map<number, AudioBuffer> | null> {
  const def = getInstrument(id);
  if (def.kind !== "sampled" || !def.gm || !def.octaves) return Promise.resolve(null);
  const cached = bufferCache.get(id);
  if (cached) return cached;
  setState(id, "loading");
  const jobs: Promise<[number, AudioBuffer]>[] = [];
  for (let oct = def.octaves[0]; oct <= def.octaves[1]; oct++) {
    SAMPLE_NOTES.forEach((name, i) => {
      const midi = (oct + 1) * 12 + SAMPLE_PC[i];
      jobs.push(
        fetch(`${SAMPLE_BASE}${def.gm}-mp3/${name}${oct}.mp3`)
          .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
          .then(decodeArrayBuffer)
          .then((b) => [midi, b] as [number, AudioBuffer]),
      );
    });
  }
  const p = Promise.all(jobs)
    .then((pairs) => { setState(id, "ready"); return new Map(pairs); })
    .catch((err) => {
      console.warn(`[hum] samples for ${id} failed, using synth stand-in`, err);
      setState(id, "fallback");
      bufferCache.delete(id); // allow a retry later
      return null;
    });
  bufferCache.set(id, p);
  return p;
}

// ---------------------------------------------------------------------------
// Voice factories. Everything is created in the *current* Tone context, so the
// same code builds live voices and offline (WAV) voices.

const note = (m: number) => Tone.Frequency(m, "midi").toNote();

function polyVoice(poly: Tone.PolySynth, chain: Tone.ToneAudioNode[] = []): Voice {
  const out = new Tone.Gain(1);
  const nodes = [poly, ...chain];
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  nodes[nodes.length - 1].connect(out);
  return {
    output: out,
    play: (m, dur, time, vel) => poly.triggerAttackRelease(note(m), dur, time, vel),
    releaseAll: () => poly.releaseAll(),
    dispose: () => { poly.releaseAll(); nodes.forEach((n) => n.dispose()); out.dispose(); },
  };
}

function samplerVoice(buffers: Map<number, AudioBuffer>, release: number, gain = 1): Voice {
  const urls: Record<number, AudioBuffer> = {};
  buffers.forEach((b, m) => { urls[m] = b; });
  const sampler = new Tone.Sampler({ urls, release });
  const out = new Tone.Gain(gain * 2.4); // FluidR3 samples are mastered quietly
  sampler.connect(out);
  return {
    output: out,
    play: (m, dur, time, vel) => sampler.triggerAttackRelease(note(m), dur, time, vel),
    releaseAll: () => sampler.releaseAll(),
    dispose: () => { sampler.releaseAll(); sampler.dispose(); out.dispose(); },
  };
}

const SAMPLE_RELEASE: Record<string, [number, number]> = {
  // [release seconds, gain]
  piano: [1, 1.2], epiano: [0.8, 1], musicbox: [1.5, 1], organ: [0.15, 0.9], aguitar: [0.6, 1.2],
  eguitar: [0.5, 1], violin: [0.35, 0.9], cello: [0.4, 1], harp: [1.5, 1.1], ebass: [0.2, 1.2],
};

const SYNTHS: Record<string, () => Voice> = {
  synthlead: () => {
    const poly = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.3 },
      filter: { Q: 2, type: "lowpass", rolloff: -24 },
      filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.4, baseFrequency: 400, octaves: 3.5 },
      volume: -15,
    });
    return polyVoice(poly, [new Tone.Vibrato(5, 0.08), new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.2, wet: 0.15 })]);
  },
  pad: () => {
    const poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fattriangle", count: 3, spread: 30 },
      envelope: { attack: 0.45, decay: 0.5, sustain: 0.8, release: 2.2 },
      volume: -14,
    });
    return polyVoice(poly, [new Tone.Chorus(0.8, 3.5, 0.6).start(), new Tone.Filter(2400, "lowpass")]);
  },
  pluck: () => {
    const poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "square8" },
      envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.12 },
      volume: -14,
    });
    return polyVoice(poly, [new Tone.Filter(1800, "lowpass"), new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.25, wet: 0.25 })]);
  },
  bells: () => {
    const poly = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 12,
      envelope: { attack: 0.001, decay: 2.2, sustain: 0, release: 1.6 },
      modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.5 },
      volume: -12,
    });
    return polyVoice(poly, [new Tone.FeedbackDelay({ delayTime: "4n", feedback: 0.3, wet: 0.2 })]);
  },
  synthbass: () => {
    const poly = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: "square" },
      envelope: { attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.15 },
      filter: { Q: 4, type: "lowpass", rolloff: -24 },
      filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.2, release: 0.2, baseFrequency: 120, octaves: 3 },
      volume: -14,
    });
    return polyVoice(poly);
  },
};

// Stand-ins used only if a sampled instrument can't be fetched (offline etc.).
const STAND_IN: Record<Category, () => Voice> = {
  keys: () => polyVoice(new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 1, sustain: 0.2, release: 0.8 }, volume: -8 })),
  strings: () => polyVoice(new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sawtooth" }, envelope: { attack: 0.08, decay: 0.3, sustain: 0.7, release: 0.5 }, volume: -16 }), [new Tone.Filter(1500, "lowpass")]),
  synths: () => SYNTHS.pad(),
  bass: () => SYNTHS.synthbass(),
};

/** Build a playable voice. Sampled instruments load (or reuse) their samples first. */
export async function createVoice(id: string): Promise<Voice & { standIn: boolean }> {
  const def = getInstrument(id);
  if (def.drumsOnly) return { ...createDrumVoice(), standIn: false };
  if (def.kind === "synth") return { ...SYNTHS[def.id](), standIn: false };
  const buffers = await loadSamples(id);
  if (!buffers) return { ...STAND_IN[def.category](), standIn: true };
  const [release, gain] = SAMPLE_RELEASE[id] ?? [0.8, 1];
  return { ...samplerVoice(buffers, release, gain), standIn: false };
}

// ---------------------------------------------------------------------------
// Drum kit: fully synthesized, so it works offline. `midi` picks the piece.

export const DRUM_MIDI = { kick: 36, snare: 38, hat: 42, openHat: 46, shaker: 70, rim: 37, tom: 45 } as const;

export function createDrumVoice(): Voice {
  const out = new Tone.Gain(1);
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 }, volume: -4 }).connect(out);
  const snareFilter = new Tone.Filter(1800, "bandpass").connect(out);
  const snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 }, volume: -8 }).connect(snareFilter);
  const snareBody = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0 }, volume: -16 }).connect(out);
  const hatFilter = new Tone.Filter(8000, "highpass").connect(out);
  const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 }, volume: -18 }).connect(hatFilter);
  const openHatFilter = new Tone.Filter(7000, "highpass").connect(out);
  const openHat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.32, sustain: 0 }, volume: -20 }).connect(openHatFilter);
  const shakerFilter = new Tone.Filter(5000, "bandpass").connect(out);
  const shaker = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.01, decay: 0.07, sustain: 0 }, volume: -16 }).connect(shakerFilter);
  const rim = new Tone.MembraneSynth({ pitchDecay: 0.005, octaves: 1, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -14 }).connect(out);
  const tom = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3, envelope: { attack: 0.001, decay: 0.6, sustain: 0 }, volume: -6 }).connect(out);
  const all = [kick, snare, snareBody, hat, openHat, shaker, rim, tom, snareFilter, hatFilter, openHatFilter, shakerFilter];
  return {
    output: out,
    play: (m, _dur, time, vel) => {
      switch (m) {
        case DRUM_MIDI.kick: kick.triggerAttackRelease("C1", 0.3, time, vel); break;
        case DRUM_MIDI.snare: snare.triggerAttackRelease(0.15, time, vel); snareBody.triggerAttackRelease("G2", 0.1, time, vel); break;
        case DRUM_MIDI.hat: hat.triggerAttackRelease(0.04, time, vel); break;
        case DRUM_MIDI.openHat: openHat.triggerAttackRelease(0.3, time, vel); break;
        case DRUM_MIDI.shaker: shaker.triggerAttackRelease(0.07, time, vel); break;
        case DRUM_MIDI.rim: rim.triggerAttackRelease("E4", 0.05, time, vel); break;
        case DRUM_MIDI.tom: tom.triggerAttackRelease("A1", 0.5, time, vel); break;
      }
    },
    releaseAll: () => {},
    dispose: () => { all.forEach((n) => n.dispose()); out.dispose(); },
  };
}
