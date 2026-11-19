// src/lib/versions.ts
// melody versions. the song's top level always holds the active version's data,
// other versions keep a snapshot. switching saves the current work into the version you leave,
// so nothing is ever silently thrown away. lyrics and the cover are shared by every version.
import type { MelodyVersion, Song, VersionData } from "./types";
import { pickVersionData } from "./migrate";

const now = () => Date.now();
export const activeVersion = (s: Song) => s.versions.find((v) => v.id === s.activeVersionId) ?? s.versions[0];

function applyData(s: Song, d: VersionData): Song {
  return { ...s, ...pickVersionData(d) };
}

/** Switch to another version. The work in the current one is saved into it first. */
export function switchVersion(s: Song, id: string): Song {
  const target = s.versions.find((v) => v.id === id);
  if (!target || id === s.activeVersionId || !target.data) return s;
  const current = pickVersionData(s);
  const versions = s.versions.map((v) =>
    v.id === s.activeVersionId ? { ...v, data: current, updatedAt: now() } : v.id === id ? { ...v, data: null } : v,
  );
  return { ...applyData(s, target.data), versions, activeVersionId: id };
}

/** Save the current state as a new version and keep working in it. The old one stays as it was. */
export function saveAsNewVersion(s: Song, name: string): Song {
  const current = pickVersionData(s);
  const fresh: MelodyVersion = { id: crypto.randomUUID(), name: cleanName(name, s), createdAt: now(), updatedAt: now(), data: null };
  const versions = s.versions.map((v) => (v.id === s.activeVersionId ? { ...v, data: current, updatedAt: now() } : v));
  return { ...s, versions: [...versions, fresh], activeVersionId: fresh.id };
}

/** Copy any version (without switching to it). */
export function duplicateVersion(s: Song, id: string): Song {
  const src = s.versions.find((v) => v.id === id);
  if (!src) return s;
  const data = id === s.activeVersionId ? pickVersionData(s) : pickVersionData(src.data!);
  const copy: MelodyVersion = { id: crypto.randomUUID(), name: cleanName(`${src.name} copy`, s), createdAt: now(), updatedAt: now(), data };
  const i = s.versions.findIndex((v) => v.id === id);
  const versions = [...s.versions];
  versions.splice(i + 1, 0, copy);
  return { ...s, versions };
}

export function renameVersion(s: Song, id: string, name: string): Song {
  return { ...s, versions: s.versions.map((v) => (v.id === id ? { ...v, name: cleanName(name, s, id) } : v)) };
}

/** Delete a version. You can't delete the last one. Deleting the active one switches to a neighbour. */
export function deleteVersion(s: Song, id: string): Song {
  if (s.versions.length <= 1 || !s.versions.some((v) => v.id === id)) return s;
  let song = s;
  if (id === s.activeVersionId) {
    const i = s.versions.findIndex((v) => v.id === id);
    const next = s.versions[i + 1] ?? s.versions[i - 1];
    song = switchVersion(s, next.id);
  }
  return { ...song, versions: song.versions.filter((v) => v.id !== id) };
}

function cleanName(name: string, s: Song, selfId?: string): string {
  const base = name.trim().slice(0, 40) || "untitled version";
  const taken = new Set(s.versions.filter((v) => v.id !== selfId).map((v) => v.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/**
 * Every recording key the song still needs: the active state, every version snapshot,
 * every rerecorded take and the cover image. Anything else under this song can be cleaned up.
 */
export function referencedKeys(s: Song): Set<string> {
  const keys = new Set<string>();
  const add = (d: Pick<VersionData, "leadRecordingKey" | "layer">) => {
    if (d.leadRecordingKey) keys.add(d.leadRecordingKey);
    if (d.layer?.recordingKey) keys.add(d.layer.recordingKey);
  };
  add(s);
  s.versions.forEach((v) => v.data && add(v.data));
  s.takes.forEach((t) => keys.add(t.recordingKey));
  if (s.cover?.imageKey) keys.add(s.cover.imageKey);
  return keys;
}
