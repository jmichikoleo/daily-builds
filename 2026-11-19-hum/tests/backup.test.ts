// tests/backup.test.ts
// .hum backups. round trip, and every way a bad file should be turned away.
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import v1 from "./fixtures/v1-song.json";
import { asCopy, buildBackup, readBackup, BackupError } from "../src/lib/backup";
import { normalizeSong, SCHEMA_VERSION } from "../src/lib/migrate";
import { saveAsNewVersion } from "../src/lib/versions";
import { addMarker } from "../src/lib/markers";
import { toggleStep } from "../src/lib/theory";

const id = v1.id;
const audio = (n: number, type = "audio/wav") => new Blob([new Uint8Array(n).fill(7)], { type });

function richSong() {
  let s = normalizeSong(v1);
  const m = addMarker(s.markers, s.lyrics, "chorus", 8);
  s = { ...s, markers: m.markers, lyrics: m.lyrics };
  s = { ...s, arrangement: { ...s.arrangement, drums: toggleStep(s.arrangement.drums, "snare", 3), effects: { enabled: true, reverb: 0.4, delay: 0.3, tone: -0.2 } } };
  s = { ...s, cover: { background: "image", color: "#F7DDE5", color2: "#DCD0F3", pattern: "hearts", subtitle: "demo", textColor: "#39343B", imageKey: `${id}:cover:1` } };
  s = saveAsNewVersion(s, "second idea");
  s = { ...s, leadRecordingKey: `${id}:rec:2`, notes: s.notes.slice(0, 3) };
  s = { ...s, takes: [{ id: "t1", recordingKey: `${id}:take:1`, start: 4, end: 8, createdAt: 1 }] };
  const blobs = [
    { key: `${id}:lead`, blob: audio(1000) },
    { key: `${id}:layer`, blob: audio(500) },
    { key: `${id}:rec:2`, blob: audio(800, "audio/webm") },
    { key: `${id}:take:1`, blob: audio(300, "audio/webm") },
    { key: `${id}:cover:1`, blob: new Blob([new Uint8Array(200)], { type: "image/jpeg" }) },
    { key: `${id}:rec:orphan`, blob: audio(999) }, // nothing points to it, so it stays out of the backup
    { key: `other-song:lead`, blob: audio(10) }, // another song's file never sneaks in
  ];
  return { s, blobs };
}

async function zipWith(files: Record<string, string | Uint8Array>) {
  const z = new JSZip();
  for (const [k, v] of Object.entries(files)) z.file(k, v);
  return z.generateAsync({ type: "blob" });
}
const manifest = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ format: "hum-backup", backupVersion: 1, schemaVersion: SCHEMA_VERSION, exportedAt: 1, song: normalizeSong({ id: "abc" }), files: [], ...over });

describe("backup round trip", () => {
  it("keeps notes, versions, markers, lyrics, drums, effects, cover and every needed recording", async () => {
    const { s, blobs } = richSong();
    const zip = await buildBackup(s, blobs);
    const back = await readBackup(zip);
    expect(back.song).toEqual(normalizeSong(JSON.parse(JSON.stringify(s))));
    expect(back.song.versions.map((v) => v.name)).toEqual(["original melody", "second idea"]);
    expect(back.song.versions[0].data?.notes).toHaveLength(6); // the other version's notes came along
    expect(back.song.markers[0].label).toBe("chorus");
    expect(back.song.arrangement.drums.steps.snare[3]).toBe(true);
    expect(back.song.arrangement.effects.delay).toBe(0.3);
    expect(back.files.map((f) => f.key).sort()).toEqual([`${id}:cover:1`, `${id}:layer`, `${id}:lead`, `${id}:rec:2`, `${id}:take:1`]);
    const lead = back.files.find((f) => f.key === `${id}:lead`)!;
    expect(lead.blob.size).toBe(1000);
    expect(lead.blob.type).toBe("audio/wav");
    expect(back.info.versions).toBe(2);
  });

  it("can come back as a copy with fresh ids that point to its own files", async () => {
    const { s, blobs } = richSong();
    const copy = asCopy(await readBackup(await buildBackup(s, blobs)), "new-id");
    expect(copy.song.id).toBe("new-id");
    expect(copy.song.leadRecordingKey).toBe("new-id:rec:2");
    expect(copy.song.versions[0].data?.leadRecordingKey).toBe("new-id:lead");
    expect(copy.song.cover?.imageKey).toBe("new-id:cover:1");
    expect(copy.files.every((f) => f.key.startsWith("new-id:"))).toBe(true);
    expect(JSON.stringify(copy.song)).not.toContain(id);
  });
});

describe("bad backups are turned away", () => {
  const fails = async (blob: Blob, msg: RegExp) => {
    await expect(readBackup(blob)).rejects.toBeInstanceOf(BackupError);
    await expect(readBackup(blob)).rejects.toThrow(msg);
  };
  it("random bytes, empty files and plain zips", async () => {
    await fails(new Blob([new Uint8Array(500).map((_, i) => (i * 31) % 256)]), /couldn't be opened/);
    await fails(new Blob([]), /empty/);
    await fails(await zipWith({ "hello.txt": "hi" }), /names hum. doesn't trust/);
    await fails(await zipWith({ "files/0.wav": "x" }), /no manifest/);
  });
  it("unsafe paths", async () => {
    await fails(await zipWith({ "manifest.json": manifest(), "../evil.sh": "rm -rf" }), /doesn.t trust|folders/);
    await fails(await zipWith({ "manifest.json": manifest(), "files/../../x.wav": "x" }), /doesn.t trust|folders/);
  });
  it("broken or foreign manifests", async () => {
    await fails(await zipWith({ "manifest.json": "{not json" }), /manifest is broken/);
    await fails(await zipWith({ "manifest.json": manifest({ format: "something-else" }) }), /isn't a hum. backup/);
    await fails(await zipWith({ "manifest.json": manifest({ schemaVersion: SCHEMA_VERSION + 1 }) }), /newer hum/);
    await fails(await zipWith({ "manifest.json": manifest({ song: { id: "../../x" } }) }), /song inside/);
  });
  it("missing recordings and wrong file types", async () => {
    const { s, blobs } = richSong();
    const good = await JSZip.loadAsync(await buildBackup(s, blobs));
    const m = JSON.parse(await good.file("manifest.json")!.async("string"));
    // drop one file from the zip but keep it in the list
    good.remove(m.files[0].path);
    await fails(await good.generateAsync({ type: "blob" }), /missing/);
    // a file the list points at that isn't audio or a picture
    const z2 = await JSZip.loadAsync(await buildBackup(s, blobs));
    const m2 = JSON.parse(await z2.file("manifest.json")!.async("string"));
    m2.files[0].mime = "text/html";
    z2.file("manifest.json", JSON.stringify(m2));
    await fails(await z2.generateAsync({ type: "blob" }), /file type/);
    // a file key that belongs to some other song
    const z3 = await JSZip.loadAsync(await buildBackup(s, blobs));
    const m3 = JSON.parse(await z3.file("manifest.json")!.async("string"));
    m3.files[0].key = "someone-else:lead";
    z3.file("manifest.json", JSON.stringify(m3));
    await fails(await z3.generateAsync({ type: "blob" }), /file list is broken/);
  });
  it("zip bombs are refused before unpacking", async () => {
    const z = new JSZip();
    z.file("manifest.json", manifest());
    z.file("files/0.wav", new Uint8Array(120 * 1024 * 1024), { compression: "DEFLATE" }); // 120 MB of zeros squeezes to almost nothing
    const blob = await z.generateAsync({ type: "blob", compression: "DEFLATE" });
    expect(blob.size).toBeLessThan(1024 * 1024);
    await fails(blob, /too big/);
  }, 60000);
});
