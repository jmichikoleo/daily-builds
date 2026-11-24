// tests/logic.test.ts
// the rules: stamps, duplicates, secrets, achievements, expeditions, calendar.

import { describe, expect, it } from "vitest";
import {
  confirmVisit,
  emptyState,
  evaluate,
  explorerTitle,
  featuredExpedition,
  issuePassport,
  makePassportNumber,
  recordDiscovery,
  saveJournalEntry,
  surprise,
  todaysDestination,
  departureBoard,
  weekNumber,
  classify,
  flightCode,
} from "../src/lib/logic";
import type { PassportState } from "../src/types";
import { EXPEDITIONS } from "../src/data/expeditions";
import { DESTINATIONS, REGULAR_DESTINATIONS, destination } from "../src/data/destinations";
import { REGULAR_TERRITORIES } from "../src/data/territories";

const AT = "2026-11-24T12:00:00.000Z";

function withProfile(): PassportState {
  const s = emptyState();
  s.profile = {
    name: "test explorer",
    alias: "",
    photo: null,
    homeCountry: "",
    favoriteTerritories: [],
    motto: "",
    coverColor: "#783B49",
    passportNumber: "IP-AB1234567",
    issuedAt: AT,
    classification: "class i",
  };
  return issuePassport(s, AT).state;
}

function visitAll(s: PassportState, ids: string[], at = AT) {
  for (const id of ids) {
    const r = confirmVisit(s, id, at);
    if (r.ok) s = r.state;
  }
  return s;
}

describe("visits and stamps", () => {
  it("awards the welcome stamp once", () => {
    const s = withProfile();
    expect(s.stamps.welcome).toBeTruthy();
    expect(issuePassport(s, AT).awards).toEqual([]);
  });

  it("awards a destination stamp and first departure", () => {
    const r = confirmVisit(withProfile(), "radio-garden", AT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.stamps["dest:radio-garden"]).toBeTruthy();
    expect(r.awards).toContainEqual({ type: "stamp", stampId: "dest:radio-garden" });
    expect(r.awards).toContainEqual({ type: "stamp", stampId: "ach:first-departure" });
  });

  it("never stamps the same destination twice", () => {
    const r1 = confirmVisit(withProfile(), "radio-garden", AT);
    if (!r1.ok) throw new Error("first visit failed");
    const r2 = confirmVisit(r1.state, "radio-garden", AT);
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.reason).toBe("already-visited");
    expect(r2.state.visits.length).toBe(1);
  });

  it("refuses locked secret destinations and unknown ids", () => {
    const s = withProfile();
    const locked = confirmVisit(s, "library-of-babel", AT);
    expect(locked.ok).toBe(false);
    expect(confirmVisit(s, "not-a-place", AT).ok).toBe(false);
  });

  it("clears the pending departure on confirm", () => {
    const s = { ...withProfile(), departure: { destinationId: "silk", at: AT } };
    const r = confirmVisit(s, "silk", AT);
    expect(r.state.departure).toBeNull();
  });
});

describe("secret destinations", () => {
  it("unlocks by territory visits", () => {
    const sound = REGULAR_DESTINATIONS.filter((d) => d.territory === "sound").slice(0, 2).map((d) => d.id);
    let s = visitAll(withProfile(), sound);
    expect(s.unlockedSecrets["ishkurs-guide"]).toBeUndefined();
    const r = confirmVisit(s, REGULAR_DESTINATIONS.filter((d) => d.territory === "sound")[2].id, AT);
    if (!r.ok) throw new Error();
    s = r.state;
    expect(s.unlockedSecrets["ishkurs-guide"]).toBeTruthy();
    expect(r.awards).toContainEqual({ type: "secret", destinationId: "ishkurs-guide" });
  });

  it("unlocks by stamp combination", () => {
    const s = visitAll(withProfile(), ["tree-fm", "rainy-mood", "radio-garden"]);
    expect(s.unlockedSecrets["earth-fm"]).toBeTruthy();
  });

  it("unlocks by exploring five territories", () => {
    const one = REGULAR_TERRITORIES.slice(0, 5).map((t) => REGULAR_DESTINATIONS.find((d) => d.territory === t.id)!.id);
    const s = visitAll(withProfile(), one);
    expect(s.unlockedSecrets.floor796).toBeTruthy();
  });

  it("unlocks by finishing an expedition", () => {
    const e = EXPEDITIONS.find((x) => x.id === "forgotten-internet")!;
    const s = visitAll(withProfile(), e.destinationIds);
    expect(s.unlockedSecrets["camerons-world"]).toBeTruthy();
  });

  it("unlocks by discovery, only once", () => {
    const r = recordDiscovery(withProfile(), "bottle", AT);
    expect(r.state.unlockedSecrets.wiby).toBeTruthy();
    expect(recordDiscovery(r.state, "bottle", AT).awards).toEqual([]);
    const c = recordDiscovery(withProfile(), "clock", AT);
    expect(c.state.unlockedSecrets["space-jam-1996"]).toBeTruthy();
  });

  it("unlocks by journal entries and total visits", () => {
    let s = withProfile();
    for (let i = 0; i < 3; i++) {
      s = saveJournalEntry(s, { id: `j${i}`, destinationId: null, date: "2026-11-24", rating: 3, favorite: "", reflection: "hi", tags: [], revisit: false, createdAt: AT, updatedAt: AT }, AT).state;
    }
    expect(s.unlockedSecrets["library-of-babel"]).toBeTruthy();
    s = visitAll(s, REGULAR_DESTINATIONS.slice(0, 15).map((d) => d.id));
    expect(s.unlockedSecrets["universal-paperclips"]).toBeTruthy();
  });

  it("awards a secret stamp and off the beaten path when visiting an unlocked secret", () => {
    const s = recordDiscovery(withProfile(), "bottle", AT).state;
    const r = confirmVisit(s, "wiby", AT);
    if (!r.ok) throw new Error();
    expect(r.state.stamps["dest:wiby"]).toBeTruthy();
    expect(r.awards).toContainEqual({ type: "stamp", stampId: "ach:off-the-beaten-path" });
  });
});

describe("achievements, territories and expeditions", () => {
  it("counts frequent flyer, curious mind and certified weird", () => {
    const sci = REGULAR_DESTINATIONS.filter((d) => d.territory === "science").slice(0, 5).map((d) => d.id);
    const odd = REGULAR_DESTINATIONS.filter((d) => d.territory === "oddlands").slice(0, 5).map((d) => d.id);
    const s = visitAll(withProfile(), [...sci, ...odd]);
    expect(s.stamps["ach:curious-mind"]).toBeTruthy();
    expect(s.stamps["ach:certified-weird"]).toBeTruthy();
    expect(s.stamps["ach:frequent-flyer"]).toBeTruthy();
    expect(s.stamps["ach:citizen-of-the-internet"]).toBeFalsy();
  });

  it("awards globetrotter after all eight territories", () => {
    const one = REGULAR_TERRITORIES.map((t) => REGULAR_DESTINATIONS.find((d) => d.territory === t.id)!.id);
    const s = visitAll(withProfile(), one);
    expect(s.stamps["ach:internet-globetrotter"]).toBeTruthy();
  });

  it("completes an expedition with its stamp and record", () => {
    const e = EXPEDITIONS[0];
    let s = visitAll(withProfile(), e.destinationIds.slice(0, -1));
    expect(s.expeditions[e.id]?.completedAt).toBeNull();
    s = visitAll(s, e.destinationIds.slice(-1), "2026-11-25T10:00:00.000Z");
    expect(s.expeditions[e.id].completedAt).toBe("2026-11-25T10:00:00.000Z");
    expect(s.stamps[`exp:${e.id}`]).toBeTruthy();
    expect(s.stamps["ach:expedition-complete"]).toBeTruthy();
  });

  it("completes a whole territory with a legendary stamp", () => {
    const ids = DESTINATIONS.filter((d) => d.territory === "creative").map((d) => d.id);
    const s = visitAll(withProfile(), ids);
    expect(s.stamps["terr:creative"]).toBeTruthy();
  });

  it("awards night owl for a visit after midnight local time", () => {
    const night = new Date(2026, 10, 24, 2, 30).toISOString();
    const r = confirmVisit(withProfile(), "silk", night);
    if (!r.ok) throw new Error();
    expect(r.state.stamps["ach:night-owl"]).toBeTruthy();
  });

  it("is stable when evaluated again", () => {
    const s = visitAll(withProfile(), EXPEDITIONS[1].destinationIds);
    expect(evaluate(s, AT).awards).toEqual([]);
  });
});

describe("identity and progression", () => {
  it("makes passport numbers in the right shape", () => {
    expect(makePassportNumber()).toMatch(/^IP-[A-Z]{2}\d{7}$/);
  });

  it("titles follow the table", () => {
    expect(explorerTitle(0)).toBe("First-Time Traveler");
    expect(explorerTitle(4)).toBe("First-Time Traveler");
    expect(explorerTitle(5)).toBe("Curious Wanderer");
    expect(explorerTitle(29)).toBe("Digital Backpacker");
    expect(explorerTitle(50)).toBe("Seasoned Explorer");
    expect(explorerTitle(80)).toBe("Citizen of the Internet");
  });

  it("classifies by favourite territories", () => {
    expect(classify([])).toContain("general");
    expect(classify(["sound"])).toContain("sonic");
  });

  it("makes flight codes like ART001", () => {
    expect(flightCode(destination("google-arts-culture")!)).toBe("ART001");
  });
});

describe("calendar picks", () => {
  it("rotates the featured expedition weekly", () => {
    const mon = new Date(2026, 10, 23); // monday
    const sun = new Date(2026, 10, 29);
    const nextMon = new Date(2026, 10, 30);
    expect(weekNumber(mon)).toBe(weekNumber(sun));
    expect(featuredExpedition(mon).id).toBe(featuredExpedition(sun).id);
    expect(featuredExpedition(nextMon).id).not.toBe(featuredExpedition(mon).id);
    const seen = new Set<string>();
    for (let w = 0; w < EXPEDITIONS.length; w++) seen.add(featuredExpedition(new Date(2026, 0, 5 + w * 7)).id);
    expect(seen.size).toBe(EXPEDITIONS.length);
  });

  it("picks one destination per day, stable within the day", () => {
    const a = todaysDestination(new Date(2026, 10, 24, 1));
    const b = todaysDestination(new Date(2026, 10, 24, 23));
    const c = todaysDestination(new Date(2026, 10, 25, 1));
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
  });

  it("surprise only picks unvisited open places", () => {
    let s = withProfile();
    s = visitAll(s, REGULAR_DESTINATIONS.slice(0, -1).map((d) => d.id));
    const left = surprise(s, () => 0.99);
    expect(left).toBeTruthy();
    expect(s.visits.some((v) => v.destinationId === left!.id)).toBe(false);
  });

  it("builds a departure board of unvisited places", () => {
    const board = departureBoard(withProfile(), new Date(2026, 10, 24, 9));
    expect(board.length).toBe(7);
    expect(new Set(board.map((b) => b.destination.id)).size).toBe(7);
  });
});
