// src/lib/db.ts
// IndexedDB storage (Dexie). songs + every audio/image blob, keyed by `${songId}:<name>`.
// the schema is the same as v1. new song fields are filled in when a song is read (see migrate.ts).
import Dexie, { type Table } from "dexie";
import type { CoverConfig, Song, StoredRecording } from "./types";
import { normalizeSong, rekeySong } from "./migrate";
import { referencedKeys } from "./versions";

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
  return normalizeSong({ id: crypto.randomUUID(), title: "untitled hum", createdAt: now, updatedAt: now, lyrics: DEFAULT_LYRICS() });
}

export const listSongs = async () => (await db.songs.orderBy("updatedAt").reverse().toArray()).map((s) => normalizeSong(s));
export const getSong = async (id: string) => { const s = await db.songs.get(id); return s ? normalizeSong(s) : undefined; };
export const songExists = async (id: string) => (await db.songs.where("id").equals(id).count()) > 0;
export const saveSong = (song: Song) => db.songs.put({ ...song, updatedAt: Date.now() });

const songKeys = (songId: string) => db.recordings.where("key").startsWith(`${songId}:`).primaryKeys();

export async function deleteSong(id: string) {
  await db.transaction("rw", db.songs, db.recordings, async () => {
    await db.songs.delete(id);
    await db.recordings.bulkDelete(await songKeys(id));
  });
}


export async function duplicateSong(id: string): Promise<Song | undefined> {
  const song = await getSong(id);
  if (!song) return;
  const copy = { ...rekeySong(song, crypto.randomUUID()), title: `${song.title} (copy)`, createdAt: Date.now() };
  await db.transaction("rw", db.songs, db.recordings, async () => {
    await saveSong(copy);
    const recs = await db.recordings.where("key").startsWith(`${id}:`).toArray();
    await db.recordings.bulkPut(recs.map((r) => ({ ...r, key: `${copy.id}:${r.key.slice(id.length + 1)}` })));
  });
  return copy;
}

export const newRecordingKey = (songId: string, kind: "rec" | "take" | "cover") => `${songId}:${kind}:${crypto.randomUUID()}`;
export const putBlob = (key: string, blob: Blob) => db.recordings.put({ key, blob, mime: blob.type });
export const getBlob = async (key: string | null | undefined) => (key ? (await db.recordings.get(key))?.blob ?? null : null);
export const getSongBlobs = (songId: string) => db.recordings.where("key").startsWith(`${songId}:`).toArray();

/** Delete blobs under this song that nothing references any more. Returns how many went. */
export async function cleanupBlobs(song: Song): Promise<number> {
  const keep = referencedKeys(song);
  const stale = (await songKeys(song.id)).filter((k) => !keep.has(String(k)));
  if (stale.length) await db.recordings.bulkDelete(stale);
  return stale.length;
}

/** Attach a cover to a song, storing a freshly uploaded picture under its own key. */
export async function withCover(song: Song, cover: CoverConfig, newImage: Blob | null): Promise<Song> {
  if (!newImage) return { ...song, cover };
  const key = newRecordingKey(song.id, "cover");
  await putBlob(key, newImage);
  return { ...song, cover: { ...cover, imageKey: key } };
}

/**
 * Put a checked backup into the database. Refuses to overwrite: if the id is already taken the
 * caller has to pass a copy (see asCopy in backup.ts). Song and blobs go in one transaction.
 */
export async function importBackup(p: { song: Song; files: { key: string; blob: Blob }[] }): Promise<Song> {
  await db.transaction("rw", db.songs, db.recordings, async () => {
    if (await db.songs.get(p.song.id)) throw new Error("a song with this id is already here");
    const clash = await db.recordings.where("key").anyOf(p.files.map((f) => f.key)).count();
    if (clash) throw new Error("these recordings are already here");
    await db.recordings.bulkAdd(p.files.map((f) => ({ key: f.key, blob: f.blob, mime: f.blob.type })));
    await db.songs.add({ ...p.song, updatedAt: Date.now() });
  });
  return p.song;
}
