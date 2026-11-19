// src/lib/tempo.ts
// bpm limits and tap tempo.
//
// how timing works in hum.
// notes are stored in beats. the hum was converted to beats at `transcribedBpm`.
// changing `bpm` changes playback speed. notes, chords, bass and drums all follow it, and so do
// MIDI and WAV exports, because they all read the same beat positions and the same bpm.
// "fit the beat to my hum" is different. it rescales note positions so your hum keeps its real
// timing in seconds while the bar lines and drums move to the new tempo.
// the original recording is never stretched. it only lines up when bpm equals transcribedBpm.
import type { Note } from "./types";

export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 90;

export const clampBpm = (bpm: number) => (Number.isFinite(bpm) ? Math.round(Math.max(MIN_BPM, Math.min(MAX_BPM, bpm))) : DEFAULT_BPM);

/** Parse what someone typed. Returns null for anything that isn't a usable number. */
export function parseBpm(text: string): number | null {
  const n = Number(String(text).trim());
  if (!String(text).trim() || !Number.isFinite(n) || n <= 0) return null;
  return clampBpm(n);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Tap tempo. Keeps the last few taps, forgets everything after a pause,
 * and uses the median gap so one sloppy tap doesn't throw it off.
 */
export class TapTempo {
  private taps: number[] = [];
  constructor(private window = 8, private resetAfterMs = 2500) {}

  /** Register a tap at time `now` (ms). Returns the bpm once there are at least 2 taps. */
  tap(now: number): number | null {
    const last = this.taps[this.taps.length - 1];
    if (last !== undefined && (now - last > this.resetAfterMs || now <= last)) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > this.window) this.taps.shift();
    return this.bpm();
  }

  bpm(): number | null {
    if (this.taps.length < 2) return null;
    const gaps: number[] = [];
    for (let i = 1; i < this.taps.length; i++) gaps.push(this.taps[i] - this.taps[i - 1]);
    // drop gaps that are way off the median (a double tap or a missed beat)
    const m = median(gaps);
    const good = gaps.filter((g) => g > m * 0.6 && g < m * 1.6);
    const gap = median(good.length ? good : gaps);
    return gap > 0 ? clampBpm(60000 / gap) : null;
  }

  get count() { return this.taps.length; }
  reset() { this.taps = []; }
}

/**
 * Keep the hum's real timing but put it on a new beat grid.
 * A note at beat b (at oldBpm) is at b * 60 / oldBpm seconds, which is b * newBpm / oldBpm beats at newBpm.
 */
export function regridNotes(notes: Note[], oldBpm: number, newBpm: number): Note[] {
  const k = newBpm / oldBpm;
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return notes.map((n) => ({ ...n, start: r(n.start * k), duration: r(n.duration * k) }));
}
