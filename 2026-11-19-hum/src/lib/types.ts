// src/lib/types.ts
// shared data shapes for songs, notes and arrangements.

export interface Note {
  id: string;
  midi: number; // MIDI pitch (60 = middle C)
  start: number; // beats
  duration: number; // beats
  velocity: number; // 0..1
}

export type MoodId = "dreamy" | "acoustic" | "lofi" | "rnb" | "cinematic";
export type ChordStyle = "pad" | "strum" | "arp" | "stabs" | "block";
export type BassStyle = "roots" | "rootFifth" | "octaves" | "syncopated" | "walking";
export type DrumRow = "kick" | "snare" | "closedHat" | "openHat" | "perc";
export const DRUM_ROWS: DrumRow[] = ["kick", "snare", "closedHat", "openHat", "perc"];

/** An editable 16-step drum bar. Every row is exactly 16 booleans. */
export interface DrumGrid {
  steps: Record<DrumRow, boolean[]>;
  percSound: "shaker" | "rim" | "tom";
  swing: number; // 0..1, delays every other 16th
  preset: string | null; // preset it came from, null once edited
}

/** One shared effects rack on the whole mix. */
export interface Effects {
  enabled: boolean; // false = bypass
  reverb: number; // 0..1 wet amount
  delay: number; // 0..1 intensity (wet and feedback, feedback capped)
  tone: number; // -1 (dark) .. 1 (bright)
}

export type SectionType = "intro" | "verse" | "preChorus" | "chorus" | "postChorus" | "bridge" | "instrumental" | "outro" | "custom";

export interface SectionMarker {
  id: string;
  type: SectionType;
  label: string;
  beat: number; // where the section starts
  lyricId: string | null; // linked lyrics section (stable id), if any
}

export interface TrackMix {
  volume: number; // 0..1
  muted: boolean;
  solo: boolean;
}

export interface Arrangement {
  enabled: boolean; // when false, only the melody (and layer) play
  mood: MoodId | null;
  key: { tonic: number; mode: "major" | "minor" }; // tonic as pitch class 0..11
  progressionId: string;
  chordInstrument: string;
  chordStyle: ChordStyle;
  bassInstrument: string;
  bassStyle: BassStyle;
  drums: DrumGrid;
  effects: Effects;
  tracks: { lead: TrackMix; chords: TrackMix; bass: TrackMix; drums: TrackMix; layer: TrackMix };
}

export interface HumLayer {
  notes: Note[];
  originalNotes: Note[];
  instrument: string;
  offset: number; // beats
  hasRecording: boolean;
  recordingKey: string | null; // key in the recordings store
}

export interface LyricSection {
  id: string;
  title: string;
  text: string;
}

export interface Song {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  durationSec: number; // length of the original recording
  peaks: number[]; // tiny waveform for the library card
  bpm: number;
  transcribedBpm: number; // tempo the hum was converted at (voice stays in sync only at this tempo)
  notes: Note[];
  originalNotes: Note[]; // untouched transcription, for "reset"
  leadInstrument: string;
  hasRecording: boolean;
  recordingMime: string | null;
  transcriptionWarning: string | null;
  arrangement: Arrangement;
  layer: HumLayer | null;
  lyrics: LyricSection[]; // shared by every version
  // --- added in v1.1 (schemaVersion 2) ---
  schemaVersion: number;
  leadRecordingKey: string | null; // key in the recordings store
  markers: SectionMarker[];
  versions: MelodyVersion[];
  activeVersionId: string;
  cover: CoverConfig | null; // shared by every version
  takes: ReplacementTake[]; // rerecorded sections, kept forever
}

/** Everything musical. A version stores one of these, the song's top level holds the active one. */
export const VERSION_FIELDS = [
  "durationSec", "peaks", "bpm", "transcribedBpm", "notes", "originalNotes", "leadInstrument", "hasRecording",
  "recordingMime", "transcriptionWarning", "arrangement", "layer", "leadRecordingKey", "markers",
] as const;
export type VersionData = Pick<Song, (typeof VERSION_FIELDS)[number]>;

export interface MelodyVersion {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: VersionData | null; // null for the active version (its data lives on the song)
}

export interface CoverConfig {
  background: "solid" | "gradient" | "pattern" | "image";
  color: string;
  color2: string;
  pattern: "dots" | "stripes" | "hearts" | "notes" | "checks";
  subtitle: string;
  textColor: string;
  imageKey: string | null; // compressed upload in the recordings store
}

export interface ReplacementTake {
  id: string;
  recordingKey: string;
  start: number; // beats
  end: number;
  createdAt: number;
}

export interface StoredRecording {
  key: string; // `${songId}:lead` or `${songId}:layer`
  blob: Blob;
  mime: string;
}
