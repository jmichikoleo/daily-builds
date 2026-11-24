// tests/storage.test.ts
// saving, loading, backup and the guard rails around bad data.

import { describe, expect, it } from "vitest";
import { STORAGE_KEY, load, makeBackup, readBackup, sanitize, save } from "../src/lib/storage";
import { confirmVisit, emptyState, issuePassport } from "../src/lib/logic";
import type { PassportState } from "../src/types";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const AT = "2026-11-24T12:00:00.000Z";

function sample(): PassportState {
  let s = emptyState();
  s.profile = {
    name: "ada",
    alias: "the cartographer",
    photo: "data:image/jpeg;base64,AAAA",
    homeCountry: "korea",
    favoriteTerritories: ["sound", "quiet"],
    motto: "go see",
    coverColor: "#496B8A",
    passportNumber: "IP-ZZ0000001",
    issuedAt: AT,
    classification: "class ii, sonic cartographer",
  };
  s = issuePassport(s, AT).state;
  const r = confirmVisit(s, "radio-garden", AT, "lovely");
  if (r.ok) s = r.state;
  s.favorites = ["silk"];
  return s;
}

describe("storage", () => {
  it("round trips through localStorage", () => {
    const mem = new MemoryStorage();
    const s = sample();
    expect(save(s, mem)).toBe(true);
    const back = load(mem);
    expect(back.problem).toBe("none");
    expect(back.state).toEqual(s);
  });

  it("starts fresh when nothing is saved", () => {
    expect(load(new MemoryStorage()).state.profile).toBeNull();
  });

  it("reports corrupted storage instead of crashing", () => {
    const mem = new MemoryStorage();
    mem.setItem(STORAGE_KEY, "{not json");
    const r = load(mem);
    expect(r.problem).toBe("corrupted");
    expect(r.state.profile).toBeNull();
  });

  it("refuses data from a newer schema", () => {
    const mem = new MemoryStorage();
    mem.setItem(STORAGE_KEY, JSON.stringify({ ...sample(), schemaVersion: 99 }));
    expect(load(mem).problem).toBe("newer");
  });

  it("drops invalid pieces but keeps the rest", () => {
    const s = sample() as unknown as Record<string, unknown>;
    const dirty = {
      ...s,
      visits: [...(s.visits as unknown[]), { destinationId: "nope", visitedAt: AT }, { destinationId: "radio-garden", visitedAt: AT }, "junk"],
      stamps: { ...(s.stamps as object), "dest:fake": { earnedAt: AT } },
      favorites: ["silk", "silk", "fake"],
      preferences: { motion: "loud", sound: "yes" },
    };
    const clean = sanitize(dirty)!;
    expect(clean.visits.length).toBe(1);
    expect(clean.stamps["dest:fake"]).toBeUndefined();
    expect(clean.favorites).toEqual(["silk"]);
    expect(clean.preferences).toEqual({ motion: "system", sound: false, atlasView: "map" });
  });

  it("backs up and restores", () => {
    const s = sample();
    const r = readBackup(makeBackup(s));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state).toEqual(s);
  });

  it("rejects files that are not backups", () => {
    expect(readBackup("hello").ok).toBe(false);
    expect(readBackup(JSON.stringify({ kind: "something else" })).ok).toBe(false);
    expect(readBackup(JSON.stringify({ kind: "internet-passport-backup", data: emptyState() })).ok).toBe(false);
  });
});
