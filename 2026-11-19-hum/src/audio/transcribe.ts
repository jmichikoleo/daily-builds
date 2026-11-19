// src/audio/transcribe.ts
// turns a mono hum recording into notes.
// Pure function (no Web Audio), so it can be tested with synthetic melodies.
import { PitchDetector } from "pitchy";
import type { Note } from "../lib/types";

export interface Frame {
  time: number; // seconds (frame centre)
  rms: number;
  midi: number | null; // fractional MIDI pitch, null when unvoiced
  clarity: number;
}

export interface TranscriptionQuality {
  voicedRatio: number; // share of loud frames that had a clear pitch
  meanClarity: number;
  peakRms: number;
  ok: boolean;
  warning: string | null;
}

export interface TranscriptionResult {
  notes: Note[]; // times in beats at `bpm`
  frames: Frame[];
  quality: TranscriptionQuality;
  durationSec: number;
}

const FRAME = 2048;
const HOP = 512;
const MIN_HZ = 70;
const MAX_HZ = 1100;
const MIN_CLARITY = 0.86;
const MIN_NOTE_SEC = 0.08;
const MAX_GAP_FRAMES = 3; // unvoiced frames bridged inside one note (~35ms)
const CHANGE_FRAMES = 4; // a new pitch must hold this long to split a note (~46ms)

export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Downsample by an integer factor with a crude box filter (pitch detection does not need 48k). */
function downsample(data: Float32Array, sampleRate: number): { data: Float32Array; sampleRate: number } {
  const factor = Math.max(1, Math.floor(sampleRate / 16000));
  if (factor === 1) return { data, sampleRate };
  const out = new Float32Array(Math.floor(data.length / factor));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += data[i * factor + j];
    out[i] = sum / factor;
  }
  return { data: out, sampleRate: sampleRate / factor };
}

export function analyseFrames(input: Float32Array, inputRate: number): Frame[] {
  const { data, sampleRate } = downsample(input, inputRate);
  const frameSize = Math.min(FRAME, 1024); // at ~16k, 1024 samples = 64ms window
  const hop = Math.round(HOP * (sampleRate / 44100)) || 160;
  const detector = PitchDetector.forFloat32Array(frameSize);
  detector.minVolumeDecibels = -45;
  const frames: Frame[] = [];
  const buf = new Float32Array(frameSize);
  for (let start = 0; start + frameSize <= data.length; start += hop) {
    buf.set(data.subarray(start, start + frameSize));
    let sq = 0;
    for (let i = 0; i < frameSize; i++) sq += buf[i] * buf[i];
    const rms = Math.sqrt(sq / frameSize);
    const [hz, clarity] = detector.findPitch(buf, sampleRate);
    const voiced = clarity >= MIN_CLARITY && hz >= MIN_HZ && hz <= MAX_HZ;
    frames.push({ time: (start + frameSize / 2) / sampleRate, rms, midi: voiced ? hzToMidi(hz) : null, clarity });
  }
  return frames;
}

/** Median-smooth the pitch track and drop single-frame octave jumps. */
function smooth(frames: Frame[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].midi === null) { out.push(null); continue; }
    const win: number[] = [];
    for (let k = -2; k <= 2; k++) {
      const m = frames[i + k]?.midi;
      if (m !== null && m !== undefined) win.push(m);
    }
    out.push(median(win));
  }
  return out;
}

export function transcribe(input: Float32Array, sampleRate: number, bpm: number): TranscriptionResult {
  const durationSec = input.length / sampleRate;
  const frames = analyseFrames(input, sampleRate);
  const peakRms = frames.reduce((m, f) => Math.max(m, f.rms), 0);
  const gate = Math.max(0.006, peakRms * 0.12);
  // A frame counts only when it is loud enough AND has a clear pitch.
  const pitched = smooth(frames).map((m, i) => (frames[i].rms >= gate ? m : null));

  const loud = frames.filter((f) => f.rms >= gate);
  const voiced = loud.filter((f) => f.midi !== null);
  const voicedRatio = loud.length ? voiced.length / loud.length : 0;
  const meanClarity = voiced.length ? voiced.reduce((s, f) => s + f.clarity, 0) / voiced.length : 0;

  // --- segment into notes ---------------------------------------------------
  interface Seg { start: number; end: number; pitches: number[] }
  const segs: Seg[] = [];
  let cur: Seg | null = null;
  let gap = 0;
  let pending: number[] = []; // frames that disagree with the current note

  const close = () => {
    if (cur) segs.push(cur);
    cur = null;
    pending = [];
    gap = 0;
  };

  for (let i = 0; i < frames.length; i++) {
    const m = pitched[i];
    if (m === null) {
      gap++;
      if (gap > MAX_GAP_FRAMES) close();
      continue;
    }
    gap = 0;
    if (!cur) { cur = { start: i, end: i, pitches: [m] }; continue; }
    const centre = Math.round(median(cur.pitches));
    if (Math.abs(m - centre) <= 0.6) {
      // back on the current note: forget a brief wobble
      cur.pitches.push(...pending, m);
      pending = [];
      cur.end = i;
    } else {
      pending.push(m);
      const pendingCentre = Math.round(median(pending));
      const consistent = pending.every((p) => Math.abs(p - pendingCentre) <= 0.7);
      if (!consistent) pending = [m];
      else if (pending.length >= CHANGE_FRAMES) {
        const newStart = i - pending.length + 1;
        cur.end = newStart - 1;
        segs.push(cur);
        cur = { start: newStart, end: i, pitches: pending };
        pending = [];
      }
    }
  }
  close();

  const hopSec = frames.length > 1 ? frames[1].time - frames[0].time : 0.03;
  const secToBeat = (s: number) => (s * bpm) / 60;
  const notes: Note[] = [];
  for (const s of segs) {
    const startSec = frames[s.start].time - hopSec / 2;
    const endSec = frames[s.end].time + hopSec / 2;
    if (endSec - startSec < MIN_NOTE_SEC) continue;
    const midi = Math.round(median(s.pitches));
    notes.push({
      id: crypto.randomUUID(),
      midi,
      start: round3(secToBeat(Math.max(0, startSec))),
      duration: round3(secToBeat(endSec - startSec)),
      velocity: 0.8,
    });
  }

  let warning: string | null = null;
  if (peakRms < 0.01) warning = "that was really quiet, try humming a bit closer to the mic";
  else if (notes.length === 0) warning = "couldn't hear a clear melody. try a steady \"mmm\" or \"doo\" somewhere quiet";
  else if (voicedRatio < 0.35 || meanClarity < 0.9)
    warning = "it was a bit noisy so some notes might be off. a quieter room or a clearer \"doo\" helps";

  return {
    notes,
    frames,
    durationSec,
    quality: { voicedRatio, meanClarity, peakRms, ok: warning === null, warning },
  };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Snap note starts/durations to a grid (in beats). Used by the "tidy timing" button. */
export function quantize(notes: Note[], grid = 0.25): Note[] {
  return notes.map((n) => ({
    ...n,
    start: Math.round(n.start / grid) * grid,
    duration: Math.max(grid, Math.round(n.duration / grid) * grid),
  }));
}
