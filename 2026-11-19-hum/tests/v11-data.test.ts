// tests/v11-data.test.ts
// tempo, migration from v1, versions, markers, drum grid and effects.
import { describe, expect, it } from "vitest";
import v1 from "./fixtures/v1-song.json";
import { normalizeSong, SCHEMA_VERSION } from "../src/lib/migrate";
import { TapTempo, clampBpm, parseBpm, regridNotes } from "../src/lib/tempo";
import { deleteVersion, duplicateVersion, referencedKeys, renameVersion, saveAsNewVersion, switchVersion } from "../src/lib/versions";
import { addMarker, deleteMarker, markerRange, moveMarker, pruneLyricLinks } from "../src/lib/markers";
import { buildDrumPart, cleanGrid, gridIsEmpty, presetGrid, toggleStep, DRUM_PRESETS } from "../src/lib/theory";
import { effectParams } from "../src/lib/effects";
import { applyMood, MOODS } from "../src/lib/moods";
import { DRUM_ROWS } from "../src/lib/types";

describe("tempo", () => {
  it("taps at 120 bpm give 120", () => {
    const t = new TapTempo();
    let bpm: number | null = null;
    for (let i = 0; i < 6; i++) bpm = t.tap(1000 + i * 500);
    expect(bpm).toBe(120);
  });
  it("one sloppy tap doesn't throw it off", () => {
    const t = new TapTempo();
    [0, 600, 1200, 1500, 2400, 3000, 3600].forEach((ms) => t.tap(ms)); // 100 bpm with one early tap
    expect(t.bpm()).toBe(100);
  });
  it("needs two taps and resets after a pause", () => {
    const t = new TapTempo(8, 2500);
    expect(t.tap(0)).toBeNull();
    expect(t.tap(500)).toBe(120);
    expect(t.tap(10000)).toBeNull(); // long pause starts over
    expect(t.count).toBe(1);
  });
  it("clamps and rejects bad values", () => {
    expect(clampBpm(10)).toBe(40);
    expect(clampBpm(999)).toBe(240);
    expect(clampBpm(NaN)).toBe(90);
    expect(parseBpm("abc")).toBeNull();
    expect(parseBpm("")).toBeNull();
    expect(parseBpm("-5")).toBeNull();
    expect(parseBpm("128.4")).toBe(128);
  });
  it("regrid keeps real timing", () => {
    const [n] = regridNotes([{ id: "a", midi: 60, start: 3, duration: 1.5, velocity: 1 }], 90, 120);
    // 3 beats at 90 = 2 s = 4 beats at 120
    expect(n.start).toBe(4);
    expect(n.duration).toBe(2);
  });
});

describe("migration from v1", () => {
  const song = normalizeSong(v1);
  it("keeps notes, ids, lyrics and recordings", () => {
    expect(song.id).toBe(v1.id);
    expect(song.notes).toEqual(v1.notes);
    expect(song.lyrics).toEqual(v1.lyrics);
    expect(song.leadRecordingKey).toBe(`${v1.id}:lead`);
    expect(song.layer?.recordingKey).toBe(`${v1.id}:layer`);
    expect(song.schemaVersion).toBe(SCHEMA_VERSION);
  });
  it("turns the old drum preset and reverb into the new grid and effects", () => {
    expect(song.arrangement.drums.preset).toBe("cinematic");
    expect(song.arrangement.drums.percSound).toBe("tom");
    expect(song.arrangement.effects.reverb).toBe(0.7);
    expect("drumPattern" in song.arrangement).toBe(false);
    const none = normalizeSong({ ...v1, arrangement: { ...v1.arrangement, drumPattern: "none" } });
    expect(gridIsEmpty(none.arrangement.drums)).toBe(true);
  });
  it("starts with one stable version and is idempotent", () => {
    expect(song.versions).toHaveLength(1);
    expect(song.versions[0].id).toBe(`${v1.id}:v1`);
    expect(normalizeSong(normalizeSong(v1))).toEqual(song);
  });
  it("survives junk", () => {
    const s = normalizeSong({ id: "x", notes: [{ midi: "a" }, null, { midi: 60, start: 0, duration: 1 }], markers: "nope", arrangement: { drums: { steps: { kick: [1, 0] } } } });
    expect(s.notes).toHaveLength(1);
    expect(s.markers).toEqual([]);
    expect(s.arrangement.drums.steps.kick).toHaveLength(16);
    expect(s.arrangement.drums.steps.kick[0]).toBe(true);
  });
});

describe("versions", () => {
  const base = normalizeSong(v1);
  it("save, change, switch back, switch again", () => {
    let s = saveAsNewVersion(base, "faster");
    expect(s.versions).toHaveLength(2);
    s = { ...s, bpm: 120, notes: s.notes.slice(0, 2), leadInstrument: "harp" };
    const original = s.versions[0].id;
    const faster = s.activeVersionId;
    s = switchVersion(s, original);
    expect(s.bpm).toBe(90);
    expect(s.notes).toHaveLength(6);
    expect(s.leadInstrument).toBe("eguitar");
    s = switchVersion(s, faster);
    expect(s.bpm).toBe(120);
    expect(s.notes).toHaveLength(2);
    expect(s.leadInstrument).toBe("harp");
  });
  it("lyrics are shared across versions", () => {
    let s = saveAsNewVersion(base, "b");
    s = { ...s, lyrics: [{ id: "l", title: "Verse", text: "new words" }] };
    s = switchVersion(s, s.versions[0].id);
    expect(s.lyrics[0].text).toBe("new words");
  });
  it("duplicate, rename, delete", () => {
    let s = duplicateVersion(base, base.activeVersionId);
    expect(s.versions).toHaveLength(2);
    expect(s.versions[1].data?.notes).toEqual(base.notes);
    s = renameVersion(s, s.versions[1].id, "  ");
    expect(s.versions[1].name).toBe("untitled version");
    s = renameVersion(s, s.versions[1].id, "original melody"); // name clash gets a number
    expect(s.versions[1].name).toBe("original melody 2");
    const kept = s.versions[1].id;
    s = deleteVersion(s, s.activeVersionId); // deleting the active one switches over
    expect(s.versions).toHaveLength(1);
    expect(s.activeVersionId).toBe(kept);
    expect(deleteVersion(s, kept)).toBe(s); // can't delete the last one
  });
  it("recordings used by any version stay referenced", () => {
    let s = saveAsNewVersion(base, "new hum");
    s = { ...s, leadRecordingKey: `${base.id}:rec:new`, layer: null };
    const keys = referencedKeys(s);
    expect(keys.has(`${base.id}:lead`)).toBe(true); // still used by "original melody"
    expect(keys.has(`${base.id}:layer`)).toBe(true);
    expect(keys.has(`${base.id}:rec:new`)).toBe(true);
    s = deleteVersion(s, s.versions[0].id);
    expect(referencedKeys(s).has(`${base.id}:lead`)).toBe(false); // now nothing needs it
  });
});

describe("markers", () => {
  const lyrics = [{ id: "v", title: "Verse", text: "" }, { id: "c", title: "Chorus", text: "la" }];
  it("adds, links to lyrics, moves and deletes", () => {
    let r = addMarker([], lyrics, "chorus", 8);
    expect(r.marker.lyricId).toBe("c");
    expect(r.lyrics).toHaveLength(2);
    r = addMarker(r.markers, r.lyrics, "verse", 0);
    expect(r.markers.map((m) => m.label)).toEqual(["verse", "chorus"]);
    const r2 = addMarker(r.markers, r.lyrics, "chorus", 16); // second chorus gets its own lyrics
    expect(r2.marker.label).toBe("chorus 2");
    expect(r2.lyrics.find((l) => l.id === r2.marker.lyricId)?.title).toBe("Chorus 2");
    const moved = moveMarker(r2.markers, r2.markers[0].id, 20);
    expect(moved[moved.length - 1].label).toBe("verse");
    expect(markerRange(r2.markers, r2.markers[1].id, 30)).toEqual({ start: 8, end: 16 });
    expect(deleteMarker(r2.markers, r2.marker.id)).toHaveLength(2);
  });
  it("deleting lyrics just unlinks the marker", () => {
    const r = addMarker([], lyrics, "chorus", 0);
    expect(pruneLyricLinks(r.markers, [lyrics[0]])[0].lyricId).toBeNull();
  });
});

describe("drum grid", () => {
  it("presets fill all rows with 16 steps", () => {
    for (const p of DRUM_PRESETS) {
      const g = presetGrid(p.id);
      for (const r of DRUM_ROWS) expect(g.steps[r]).toHaveLength(16);
      expect(gridIsEmpty(g)).toBe(false);
    }
    const four = presetGrid("fourFloor");
    expect(four.steps.kick.filter(Boolean)).toHaveLength(4);
  });
  it("toggle flips one step and drops the preset name", () => {
    const g = toggleStep(presetGrid("softPop"), "snare", 2);
    expect(g.steps.snare[2]).toBe(true);
    expect(g.preset).toBeNull();
    expect(toggleStep(g, "snare", 2).steps.snare[2]).toBe(false);
    expect(toggleStep(g, "kick", 16)).toBe(g);
  });
  it("hits land on the grid with GM drum notes", () => {
    const g = cleanGrid(null);
    g.steps.kick[0] = true; g.steps.openHat[2] = true; g.steps.closedHat[4] = true;
    const hits = buildDrumPart(g, 2);
    expect(hits.map((h) => [h.time, h.midi])).toEqual([[0, 36], [0.5, 46], [1, 42], [4, 36], [4.5, 46], [5, 42]]);
  });
  it("moods load different grids", () => {
    const grids = new Set(MOODS.map((m) => JSON.stringify(applyMood(normalizeSong(v1).arrangement, m.id).drums)));
    expect(grids.size).toBe(MOODS.length);
  });
});

describe("effects", () => {
  it("bypass zeroes everything", () => {
    expect(effectParams({ enabled: false, reverb: 1, delay: 1, tone: 1 })).toEqual({ reverbSend: 0, delaySend: 0, delayFeedback: 0, lowDb: 0, highDb: 0 });
  });
  it("feedback never runs away and values are clamped", () => {
    const p = effectParams({ enabled: true, reverb: 5, delay: 9, tone: -3 });
    expect(p.delayFeedback).toBeLessThan(0.55);
    expect(p.reverbSend).toBeCloseTo(0.55);
    expect(p.highDb).toBeLessThan(0);
    expect(effectParams({ enabled: true, reverb: 0.5, delay: 0, tone: 0.5 }).highDb).toBeGreaterThan(0);
  });
});
