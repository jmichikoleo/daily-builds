// src/lib/types.ts — shared data shapes for songs, notes and arrangements.

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
export type DrumPatternId = "softPop" | "lofi" | "rnb" | "indie" | "acoustic" | "cinematic" | "none";

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
  drumPattern: DrumPatternId;
  reverb: number; // 0..1
  tracks: { lead: TrackMix; chords: TrackMix; bass: TrackMix; drums: TrackMix; layer: TrackMix };
}

export interface HumLayer {
  notes: Note[];
  originalNotes: Note[];
  instrument: string;
  offset: number; // beats
  hasRecording: boolean;
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
  lyrics: LyricSection[];
}

export interface StoredRecording {
  key: string; // `${songId}:lead` or `${songId}:layer`
  blob: Blob;
  mime: string;
}
