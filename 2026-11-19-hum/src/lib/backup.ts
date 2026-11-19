// src/lib/backup.ts
// .hum project backups. a zip with manifest.json (the whole song) and files/N.ext (its recordings and cover).
// reading one is strict. it checks size, every path, the schema version and that every recording is there,
// and it never touches the database. importing is a separate step (db.ts) the user confirms first.
import JSZip from "jszip";
import type { Song } from "./types";
import { SCHEMA_VERSION, normalizeSong, rekeySong } from "./migrate";
import { referencedKeys } from "./versions";

export const BACKUP_FORMAT = "hum-backup";
export const BACKUP_VERSION = 1;
export const LIMITS = {
  archiveBytes: 250 * 1024 * 1024,
  entries: 200,
  fileBytes: 100 * 1024 * 1024,
  totalBytes: 400 * 1024 * 1024,
};
const PATH_OK = /^(manifest\.json|files\/\d{1,4}\.[a-z0-9]{1,5})$/;
const MIME_OK = /^(audio\/[\w.+-]+|image\/(jpeg|png|webp|gif))(;.*)?$/;

export class BackupError extends Error {}

interface ManifestFile { key: string; path: string; mime: string; bytes: number }
interface Manifest {
  format: string;
  backupVersion: number;
  schemaVersion: number;
  exportedAt: number;
  song: Song;
  files: ManifestFile[];
}

const ext = (mime: string) =>
  mime.includes("webm") ? "webm" : mime.includes("mp4") || mime.includes("m4a") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav"
  : mime.includes("mpeg") ? "mp3" : mime.includes("jpeg") ? "jpg" : mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "bin";

/** Make a backup of one song with every blob it still references. */
export async function buildBackup(song: Song, blobs: { key: string; blob: Blob }[]): Promise<Blob> {
  const keep = referencedKeys(song);
  const zip = new JSZip();
  const files: ManifestFile[] = [];
  blobs
    .filter((b) => keep.has(b.key) && b.key.startsWith(`${song.id}:`))
    .forEach((b, i) => {
      const mime = b.blob.type || "application/octet-stream";
      const path = `files/${i}.${ext(mime)}`;
      files.push({ key: b.key, path, mime, bytes: b.blob.size });
      zip.file(path, b.blob, { compression: "STORE" }); // audio and jpegs are already compressed
    });
  const manifest: Manifest = { format: BACKUP_FORMAT, backupVersion: BACKUP_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: Date.now(), song, files };
  zip.file("manifest.json", JSON.stringify(manifest), { compression: "DEFLATE" });
  return zip.generateAsync({ type: "blob", mimeType: "application/zip" });
}

export interface ParsedBackup {
  song: Song;
  files: { key: string; blob: Blob }[];
  info: { title: string; exportedAt: number; notes: number; versions: number; recordings: number; lyrics: number; bytes: number; schemaVersion: number };
}

/** Read and check a backup. Throws BackupError with a friendly message if anything is off. */
export async function readBackup(file: Blob): Promise<ParsedBackup> {
  if (file.size === 0) throw new BackupError("that file is empty");
  if (file.size > LIMITS.archiveBytes) throw new BackupError("that file is too big to be a hum. backup");

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new BackupError("that isn't a hum. backup (it couldn't be opened)");
  }

  const entries = Object.values(zip.files);
  if (entries.length > LIMITS.entries) throw new BackupError("that backup has way too many files in it");
  let total = 0;
  for (const e of entries) {
    if (e.dir) {
      if (e.name === "files/") continue; // zip tools add this folder entry on their own
      throw new BackupError("that backup has folders hum. doesn't expect");
    }
    if (!PATH_OK.test(e.name)) throw new BackupError("that backup has files with names hum. doesn't trust");
    // the size the zip says it will unpack to, checked before unpacking anything
    const size = (e as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (typeof size === "number") {
      if (size > LIMITS.fileBytes) throw new BackupError("a file in that backup is too big");
      total += size;
    }
  }
  if (total > LIMITS.totalBytes) throw new BackupError("that backup unpacks to something way too big");

  const mf = zip.file("manifest.json");
  if (!mf) throw new BackupError("that isn't a hum. backup (no manifest inside)");
  let manifest: Manifest;
  try {
    manifest = JSON.parse(await mf.async("string"));
  } catch {
    throw new BackupError("the backup's manifest is broken");
  }
  if (!manifest || manifest.format !== BACKUP_FORMAT) throw new BackupError("that isn't a hum. backup");
  if (typeof manifest.schemaVersion !== "number" || manifest.schemaVersion > SCHEMA_VERSION || manifest.backupVersion > BACKUP_VERSION)
    throw new BackupError("that backup was made by a newer hum. than this one");
  if (!manifest.song || typeof manifest.song !== "object" || typeof manifest.song.id !== "string" || !/^[\w-]{1,64}$/.test(manifest.song.id))
    throw new BackupError("the song inside that backup is broken");
  if (!Array.isArray(manifest.files)) throw new BackupError("the backup's file list is broken");

  const song = normalizeSong(manifest.song);
  const files: { key: string; blob: Blob }[] = [];
  for (const f of manifest.files) {
    if (!f || typeof f.key !== "string" || typeof f.path !== "string" || !PATH_OK.test(f.path) || f.path === "manifest.json")
      throw new BackupError("the backup's file list is broken");
    if (!f.key.startsWith(`${song.id}:`) || !/^[\w:-]+$/.test(f.key)) throw new BackupError("the backup's file list is broken");
    const mime = typeof f.mime === "string" && MIME_OK.test(f.mime) ? f.mime : null;
    if (!mime) throw new BackupError("that backup has a file type hum. won't open");
    const entry = zip.file(f.path);
    if (!entry) throw new BackupError("a recording is missing from that backup");
    const data = await entry.async("uint8array");
    if (data.byteLength > LIMITS.fileBytes) throw new BackupError("a file in that backup is too big");
    files.push({ key: f.key, blob: new Blob([data as BlobPart], { type: mime }) });
  }
  const have = new Set(files.map((f) => f.key));
  for (const k of referencedKeys(song)) if (!have.has(k)) throw new BackupError("a recording is missing from that backup");

  return {
    song,
    files,
    info: {
      title: song.title,
      exportedAt: typeof manifest.exportedAt === "number" ? manifest.exportedAt : 0,
      notes: song.notes.length,
      versions: song.versions.length,
      recordings: files.length,
      lyrics: song.lyrics.filter((l) => l.text.trim()).length,
      bytes: file.size,
      schemaVersion: manifest.schemaVersion,
    },
  };
}

/** The same backup under a brand new id (and new blob keys), so it never collides with what's already here. */
export function asCopy(p: ParsedBackup, newId: string = crypto.randomUUID()): ParsedBackup {
  const song = { ...rekeySong(p.song, newId), title: `${p.song.title} (restored)` };
  const files = p.files.map((f) => ({ key: `${newId}:${f.key.slice(p.song.id.length + 1)}`, blob: f.blob }));
  return { ...p, song, files };
}
