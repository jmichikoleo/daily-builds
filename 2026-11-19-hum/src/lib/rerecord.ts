// src/lib/rerecord.ts
// replacing one part of the melody with a new hum.
//
// the rules, so it's predictable.
// 1. the new take is converted to beats at the song's current bpm (you hum along at that speed).
// 2. "start at the section" moves the take so its first note lands on the section start.
//    "keep my pause" puts the start of the recording on the section start instead.
// 3. new notes that start after the section end are dropped, ones that run past it are cut at the end.
// 4. old notes that start inside the section are removed.
//    old notes that start before it but ring into it are cut so they stop where the section starts.
//    old notes that start at or after the section end are never touched.
import type { Note } from "./types";

export type Align = "firstNote" | "recordingStart";
const MIN_LEN = 0.05;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Put a freshly transcribed take (beats from the start of the recording) into [start, end). */
export function placeTake(take: Note[], start: number, end: number, align: Align): Note[] {
  if (!(end > start) || !take.length) return [];
  const first = Math.min(...take.map((n) => n.start));
  const shift = start - (align === "firstNote" ? first : 0);
  const out: Note[] = [];
  for (const n of [...take].sort((a, b) => a.start - b.start)) {
    const s = r3(n.start + shift);
    if (s < start - 1e-6 || s >= end) continue;
    const d = r3(Math.min(n.duration, end - s));
    if (d < MIN_LEN) continue;
    out.push({ ...n, id: crypto.randomUUID(), start: s, duration: d });
  }
  return out;
}

/** Swap the notes in [start, end) for `replacement`, following the rules above. */
export function replaceRange(notes: Note[], replacement: Note[], start: number, end: number): { notes: Note[]; removed: number; trimmed: number } {
  let removed = 0;
  let trimmed = 0;
  const kept: Note[] = [];
  for (const n of notes) {
    if (n.start >= start && n.start < end) { removed++; continue; }
    if (n.start < start && n.start + n.duration > start) {
      const d = r3(start - n.start);
      if (d < MIN_LEN) { removed++; continue; }
      trimmed++;
      kept.push({ ...n, duration: d });
      continue;
    }
    kept.push(n);
  }
  return { notes: [...kept, ...replacement].sort((a, b) => a.start - b.start), removed, trimmed };
}
