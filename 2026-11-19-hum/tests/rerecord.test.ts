// tests/rerecord.test.ts
// rerecording a section. placement, boundaries, cancel and keeping the takes.
import { describe, expect, it } from "vitest";
import v1 from "./fixtures/v1-song.json";
import { placeTake, replaceRange } from "../src/lib/rerecord";
import { normalizeSong } from "../src/lib/migrate";
import { referencedKeys, saveAsNewVersion, switchVersion } from "../src/lib/versions";
import type { Note } from "../src/lib/types";

const n = (id: string, midi: number, start: number, duration = 1): Note => ({ id, midi, start, duration, velocity: 0.8 });
const melody = [n("a", 60, 0, 1), n("b", 62, 1.5, 1.5), n("c", 64, 4), n("d", 65, 5), n("e", 67, 7.5, 1), n("f", 69, 8), n("g", 71, 12)];

describe("placeTake", () => {
  const take = [n("x", 72, 0.4, 0.5), n("y", 74, 1, 0.5), n("z", 76, 3.8, 1)];
  it("lines the first note up with the section start", () => {
    const p = placeTake(take, 4, 8, "firstNote");
    expect(p.map((x) => [x.midi, x.start, x.duration])).toEqual([[72, 4, 0.5], [74, 4.6, 0.5], [76, 7.4, 0.6]]); // last one cut at the end
  });
  it("or keeps the pause before the first note", () => {
    const p = placeTake(take, 4, 8, "recordingStart");
    expect(p.map((x) => [x.start, x.duration])).toEqual([[4.4, 0.5], [5, 0.5], [7.8, 0.2]]); // z starts inside and is cut at the end
  });
  it("drops notes past the end and gives new ids", () => {
    const p = placeTake([n("x", 72, 0, 1), n("y", 74, 5, 1)], 0, 4, "firstNote");
    expect(p).toHaveLength(1);
    expect(p[0].id).not.toBe("x");
    expect(placeTake(take, 4, 4, "firstNote")).toEqual([]);
    expect(placeTake([], 0, 4, "firstNote")).toEqual([]);
  });
});

describe("replaceRange", () => {
  it("only touches notes inside the section and trims ones ringing into it", () => {
    const repl = [n("new1", 80, 4, 1), n("new2", 81, 6, 1)];
    const { notes, removed, trimmed } = replaceRange(melody, repl, 3, 8);
    // c (4) and d (5) and e (7.5) start inside → removed. b (1.5..3) ends exactly at 3 → untouched.
    expect(removed).toBe(3);
    expect(trimmed).toBe(0);
    expect(notes.map((x) => x.id)).toEqual(["a", "b", "new1", "new2", "f", "g"]);
    // f starts at the end boundary and is untouched, a/b/g identical objects
    expect(notes.find((x) => x.id === "f")).toBe(melody.find((x) => x.id === "f"));
  });
  it("cuts a note that rings into the section", () => {
    const { notes, trimmed } = replaceRange(melody, [], 2, 4);
    expect(trimmed).toBe(1);
    expect(notes.find((x) => x.id === "b")?.duration).toBe(0.5); // 1.5 → stops at 2
    expect(notes.map((x) => x.id)).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
  });
  it("notes outside the section stay exactly as they were", () => {
    const before = melody.filter((x) => x.start + x.duration <= 3 || x.start >= 8);
    const { notes } = replaceRange(melody, [n("z", 50, 3)], 3, 8);
    for (const b of before) expect(notes).toContainEqual(b);
  });
  it("cancel means nothing changes (the input is never mutated)", () => {
    const copy = structuredClone(melody);
    replaceRange(melody, [n("z", 50, 3)], 3, 8);
    expect(melody).toEqual(copy);
  });
});

describe("takes and versions", () => {
  it("takes stay referenced in every version, and the old notes live on in the version you saved", () => {
    let s = normalizeSong(v1);
    s = saveAsNewVersion(s, "before the new chorus"); // keep the old notes
    const oldVersion = s.versions[0].id;
    const { notes } = replaceRange(s.notes, [n("z", 50, 1, 0.5)], 1, 3);
    s = { ...s, notes, takes: [...s.takes, { id: "t", recordingKey: `${s.id}:take:t`, start: 1, end: 3, createdAt: 1 }] };
    expect(referencedKeys(s).has(`${s.id}:take:t`)).toBe(true);
    expect(referencedKeys(s).has(`${s.id}:lead`)).toBe(true); // the original recording is still there
    s = switchVersion(s, oldVersion);
    expect(s.notes).toEqual(normalizeSong(v1).notes);
    expect(referencedKeys(s).has(`${s.id}:take:t`)).toBe(true);
  });
});
