// src/lib/db.ts — IndexedDB storage (Dexie): song projects + their raw recordings.
import Dexie, { type Table } from "dexie";
import type { Song, StoredRecording } from "./types";
import { defaultArrangement } from "./moods";

class HumDB extends Dexie {
  songs!: Table<Song, string>;
  recordings!: Table<StoredRecording, string>;
  constructor() {
    super("hum-studio");
    this.version(1).stores({ songs: "id, updatedAt", recordings: "key" });
  }
}

export const db = new HumDB();

export const DEFAULT_LYRICS = () =>
  ["Verse", "Pre-Chorus", "Chorus", "Bridge", "Outro"].map((title) => ({ id: crypto.randomUUID(), title, text: "" }));

export function newSong(): Song {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "untitled hum",
    createdAt: now,
    updatedAt: now,
    durationSec: 0,
    peaks: [],
    bpm: 90,
    transcribedBpm: 90,
    notes: [],
    originalNotes: [],
    leadInstrument: "piano",
    hasRecording: false,
    recordingMime: null,
    transcriptionWarning: null,
    arrangement: defaultArrangement(),
    layer: null,
    lyrics: DEFAULT_LYRICS(),
  };
}

export const listSongs = () => db.songs.orderBy("updatedAt").reverse().toArray();
export const getSong = (id: string) => db.songs.get(id);
export const saveSong = (song: Song) => db.songs.put({ ...song, updatedAt: Date.now() });

export async function deleteSong(id: string) {
  await db.transaction("rw", db.songs, db.recordings, async () => {
    await db.songs.delete(id);
    await db.recordings.bulkDelete([`${id}:lead`, `${id}:layer`]);
  });
}

export async function duplicateSong(id: string): Promise<Song | undefined> {
  const song = await db.songs.get(id);
  if (!song) return;
  const copy: Song = { ...structuredClone(song), id: crypto.randomUUID(), title: `${song.title} (copy)`, createdAt: Date.now() };
  await db.transaction("rw", db.songs, db.recordings, async () => {
    await saveSong(copy);
    for (const part of ["lead", "layer"]) {
      const rec = await db.recordings.get(`${id}:${part}`);
      if (rec) await db.recordings.put({ ...rec, key: `${copy.id}:${part}` });
    }
  });
  return copy;
}

export const putRecording = (songId: string, part: "lead" | "layer", blob: Blob) =>
  db.recordings.put({ key: `${songId}:${part}`, blob, mime: blob.type });
export const getRecording = (songId: string, part: "lead" | "layer") => db.recordings.get(`${songId}:${part}`);
export const deleteRecording = (songId: string, part: "lead" | "layer") => db.recordings.delete(`${songId}:${part}`);
