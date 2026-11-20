import { describe, expect, it } from "vitest";
import {
  RECORDS_KEY,
  emptyRecords,
  loadRecords,
  loadSettings,
  parseRecords,
  parseSettings,
  recordResult,
  saveRecords,
  saveSettings,
  summarize,
} from "../../src/storage/records";

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("personal bests", () => {
  it("records a first result as a new best", () => {
    const r = recordResult(emptyRecords(), "star-catcher", 120, 60_000, 5);
    expect(r.isNewBest).toBe(true);
    expect(r.records.games["star-catcher"]).toEqual({ best: 120, plays: 1, last: 120, lastPlayedAt: 5 });
    expect(r.records.totalPlayMs).toBe(60_000);
    expect(r.records.lastGameId).toBe("star-catcher");
  });

  it("only beats the best with a higher score", () => {
    let rec = recordResult(emptyRecords(), "g", 100, 60_000, 1).records;
    const lower = recordResult(rec, "g", 80, 60_000, 2);
    expect(lower.isNewBest).toBe(false);
    expect(lower.records.games.g.best).toBe(100);
    expect(lower.records.games.g.last).toBe(80);
    rec = lower.records;
    const tie = recordResult(rec, "g", 100, 60_000, 3);
    expect(tie.isNewBest).toBe(false);
    const higher = recordResult(tie.records, "g", 101, 60_000, 4);
    expect(higher.isNewBest).toBe(true);
    expect(higher.previousBest).toBe(100);
    expect(higher.records.games.g.plays).toBe(4);
  });

  it("does not celebrate a zero", () => {
    expect(recordResult(emptyRecords(), "g", 0, 60_000, 1).isNewBest).toBe(false);
  });

  it("does not mutate the old records", () => {
    const before = emptyRecords();
    recordResult(before, "g", 10, 1, 1);
    expect(before.games).toEqual({});
  });
});

describe("persistence", () => {
  it("round trips through storage", () => {
    const s = memoryStorage();
    const rec = recordResult(emptyRecords(), "ghost-hunt", 42, 60_000, 9).records;
    expect(saveRecords(rec, s)).toBe(true);
    expect(loadRecords(s)).toEqual(rec);
    saveSettings({ sound: false, reducedMotion: "on" }, s);
    expect(loadSettings(s)).toEqual({ sound: false, reducedMotion: "on" });
  });

  it("survives broken or hostile data", () => {
    expect(parseRecords("{not json")).toEqual(emptyRecords());
    expect(parseRecords("null")).toEqual(emptyRecords());
    expect(parseRecords("42")).toEqual(emptyRecords());
    const weird = parseRecords(JSON.stringify({ games: { a: { best: "lots", plays: -3 }, b: null }, totalPlayMs: NaN, lastGameId: 7 }));
    expect(weird.games.a).toEqual({ best: 0, plays: 0, last: 0, lastPlayedAt: 0 });
    expect(weird.games.b).toBeUndefined();
    expect(weird.totalPlayMs).toBe(0);
    expect(weird.lastGameId).toBeNull();
    expect(parseSettings('{"sound":"yes","reducedMotion":"sideways"}')).toEqual({ sound: true, reducedMotion: "system" });
  });

  it("copes when storage is missing or throws", () => {
    expect(loadRecords(null)).toEqual(emptyRecords());
    expect(saveRecords(emptyRecords(), null)).toBe(false);
    const angry = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadRecords(angry)).toEqual(emptyRecords());
    expect(saveRecords(emptyRecords(), angry)).toBe(false);
    expect(loadSettings(angry).sound).toBe(true);
  });

  it("uses a namespaced key", () => {
    const s = memoryStorage();
    saveRecords(emptyRecords(), s);
    expect([...s.m.keys()]).toEqual([RECORDS_KEY]);
  });
});

describe("record book summary", () => {
  it("finds the favorite and the most recent game", () => {
    let r = emptyRecords();
    r = recordResult(r, "a", 10, 60_000, 1).records;
    r = recordResult(r, "a", 10, 60_000, 2).records;
    r = recordResult(r, "b", 10, 30_000, 3).records;
    const s = summarize(r);
    expect(s.totalPlays).toBe(3);
    expect(s.totalMinutes).toBeCloseTo(2.5);
    expect(s.favorite).toBe("a");
    expect(s.recent).toBe("b");
  });

  it("is empty without plays", () => {
    expect(summarize(emptyRecords())).toEqual({ totalPlays: 0, totalMinutes: 0, favorite: null, recent: null });
  });
});
