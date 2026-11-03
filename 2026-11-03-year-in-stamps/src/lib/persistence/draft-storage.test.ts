import { describe, expect, it } from "vitest";
import { createEmptyDraft } from "../passport/types";
import { DRAFT_STORAGE_KEY, clearAppStorage, parseStoredDraft, saveDraft, loadDraft } from "./draft-storage";

const v1 = {
  version: 1,
  savedAt: "2026-11-03T00:00:00.000Z",
  draft: {
    year: 2026,
    nickname: "Mochi",
    title: "",
    themeId: "pink",
    formatId: "square",
    stamps: [
      { destinationId: "city:kr-busan", visitMonth: "2026-02" },
      { destinationId: "region:HK" },
      { destinationId: "country:KR" },
    ],
  },
};

const v2 = {
  version: 2,
  savedAt: "2026-11-03T00:00:00.000Z",
  draft: {
    year: 2026,
    nickname: "",
    title: "Trips",
    themeId: "classic",
    formatId: "story",
    stamps: [
      { id: "city:kr-busan~1", destinationId: "city:kr-busan" },
      { id: "city:kr-busan~2", destinationId: "city:kr-busan", visitMonth: "2026-07" },
      { id: "city:atlantis~1", destinationId: "city:atlantis" },
    ],
  },
};

function parseOk(value: unknown) {
  const result = parseStoredDraft(JSON.stringify(value));
  if (result.status !== "ok") throw new Error(`expected ok, got ${result.status}`);
  return result;
}

describe("migrating Phase 1 drafts", () => {
  it("maps v1 demo ids to catalog ids and keeps everything else", () => {
    const { draft, migratedFrom, droppedEntries } = parseOk(v1);
    expect(migratedFrom).toBe(1);
    expect(droppedEntries).toBe(0);
    expect(draft.nickname).toBe("Mochi");
    expect(draft.studio.themeId).toBe("pink");
    expect(draft.studio.formatId).toBe("square");
    expect(draft.entries.map((e) => e.placeId)).toEqual(["gn:1838524", "iso:HK", "iso:KR"]);
    expect(draft.entries[0].visit).toEqual({ precision: "month", date: "2026-02" });
    expect(draft.entries[1].place.kind).toBe("territory");
    expect(draft.entries.every((e) => !e.unresolved)).toBe(true);
  });

  it("keeps repeat visits from v2 with distinct variants", () => {
    const { draft, migratedFrom } = parseOk(v2);
    expect(migratedFrom).toBe(2);
    const busan = draft.entries.filter((e) => e.placeId === "gn:1838524");
    expect(busan).toHaveLength(2);
    expect(busan.map((e) => e.design.variant)).toEqual([0, 1]);
    expect(busan[1].visit).toEqual({ precision: "month", date: "2026-07" });
    expect(new Set(draft.entries.map((e) => e.id)).size).toBe(draft.entries.length);
  });

  it("preserves unknown ids as unresolved entries instead of dropping them", () => {
    const { draft } = parseOk(v2);
    const atlantis = draft.entries.find((e) => e.placeId === "city:atlantis");
    expect(atlantis?.unresolved).toBe(true);
    expect(atlantis?.place.name).toBe("Atlantis");
  });
});

describe("migrating Phase 2 (v3) drafts", () => {
  it("moves title, theme and format into the studio design and keeps stamp customisation", () => {
    const v3 = {
      version: 3,
      draft: {
        year: 2026,
        nickname: "Mochi",
        title: "Seoul & beyond",
        themeId: "editorial",
        formatId: "square",
        sort: "date",
        entries: [
          {
            id: "e-1",
            placeId: "gn:1838524",
            place: { name: "Busan", kind: "city", isoCode: "KR", countryName: "South Korea", motif: "wave" },
            visit: { precision: "day", date: "2026-05-04" },
            design: { variant: 1, style: "postage", ink: "#2F4A6D", showDate: false },
          },
        ],
      },
    };
    const { draft, migratedFrom } = parseOk(v3);
    expect(migratedFrom).toBe(3);
    expect(draft.studio.themeId).toBe("editorial");
    expect(draft.studio.formatId).toBe("square");
    expect(draft.studio.text.title).toBe("Seoul & beyond");
    expect(draft.studio.layout.preset).toBeUndefined();
    expect(draft.sort).toBe("date");
    expect(draft.entries[0].design).toEqual({ variant: 1, style: "postage", ink: "#2F4A6D", showDate: false });
    expect(draft.entries[0].visit).toEqual({ precision: "day", date: "2026-05-04" });
  });
});

describe("parsing v4 drafts", () => {
  it("keeps manual placements only for existing stamps and clamps them", () => {
    const draft = createEmptyDraft(2026);
    draft.entries.push({
      id: "e-1",
      placeId: "iso:KR",
      place: { name: "South Korea", kind: "country", isoCode: "KR", countryName: "South Korea", motif: "temple" },
      visit: { precision: "unknown" },
      design: { variant: 0, showDate: true },
    });
    const raw = {
      version: 4,
      draft: {
        ...draft,
        studio: {
          ...draft.studio,
          layout: { preset: "archive", seed: 9 },
          text: { ...draft.studio.text, align: "center", font: "atlas", color: "#123456", subtitle: "Hi" },
          background: { paper: "not-a-colour", texture: "linen", border: "airmail", showAccents: false },
          overrides: {
            story: { "e-1": { x: 1.4, y: 0.5, w: 0.2, rotation: 400, z: 3 }, "e-gone": { x: 0.5, y: 0.5, w: 0.2, rotation: 0, z: 0 } },
            square: { "e-1": { x: "left" } },
          },
        },
      },
    };
    const { draft: parsed } = parseOk(raw);
    expect(parsed.studio.layout).toEqual({ preset: "archive", seed: 9 });
    expect(parsed.studio.text).toMatchObject({ align: "center", font: "atlas", color: "#123456", subtitle: "Hi" });
    expect(parsed.studio.background).toEqual({ texture: "linen", border: "airmail", showAccents: false });
    expect(parsed.studio.overrides.story).toEqual({ "e-1": { x: 1, y: 0.5, w: 0.2, rotation: 180, z: 3 } });
    expect(parsed.studio.overrides.square).toEqual({});
  });

  it("round-trips a valid draft", () => {
    const draft = createEmptyDraft(2026);
    draft.entries.push({
      id: "e-1",
      placeId: "iso:KR",
      place: { name: "South Korea", kind: "country", isoCode: "KR", countryName: "South Korea", motif: "temple" },
      visit: { precision: "day", date: "2026-03-14" },
      design: { variant: 2, style: "postage", ink: "#2F4A6D", showDate: false },
    });
    const { draft: parsed, migratedFrom } = parseOk({ version: 4, savedAt: "", draft });
    expect(migratedFrom).toBeUndefined();
    expect(parsed).toEqual(draft);
  });

  it("repairs bad fields without losing the entry", () => {
    const { draft } = parseOk({
      version: 4,
      draft: {
        year: 2026,
        sort: "sideways",
        entries: [
          {
            id: "e-1",
            placeId: "iso:KR",
            place: { name: "South Korea", kind: "planet", isoCode: "KR", countryName: "South Korea", motif: "dragon" },
            visit: { precision: "day", date: "2026-02-31" },
            design: { variant: -3, style: "hexagon", ink: "url(evil)", showDate: "yes" },
          },
          { id: "e-1", placeId: "iso:JP", place: { name: "Japan", kind: "country", isoCode: "JP", countryName: "Japan", motif: "mountain" } },
          { id: "e-3", placeId: "iso:XX" },
        ],
      },
    });
    expect(draft.sort).toBe("added");
    expect(draft.entries).toHaveLength(2);
    const [kr, jp] = draft.entries;
    expect(kr.place.kind).toBe("city");
    expect(kr.place.motif).toBe("compass");
    expect(kr.visit).toEqual({ precision: "unknown" });
    expect(kr.design).toEqual({ variant: 0, showDate: true });
    expect(jp.id).not.toBe(kr.id);
  });

  it("rejects non-JSON, newer schemas and bad years", () => {
    expect(parseStoredDraft("{oops").status).toBe("invalid");
    expect(parseStoredDraft(JSON.stringify({ version: 5, draft: { year: 2026 } })).status).toBe("invalid");
    expect(parseStoredDraft(JSON.stringify({ version: 4, draft: { year: 1200 } })).status).toBe("invalid");
  });
});

/** A tiny in-memory Storage for persistence tests. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  };
}

describe("draft restoration and clearing", () => {
  it("restores exactly what was saved", () => {
    const storage = memoryStorage();
    const draft = createEmptyDraft(2026);
    draft.nickname = "Mochi";
    draft.studio.layout = { preset: "postcard", seed: 4 };
    draft.studio.overrides.story = { "e-1": { x: 0.5, y: 0.5, w: 0.3, rotation: 10, z: 2 } };
    draft.entries.push({
      id: "e-1",
      placeId: "iso:KR",
      place: { name: "South Korea", kind: "country", isoCode: "KR", countryName: "South Korea", motif: "temple" },
      visit: { precision: "unknown" },
      design: { variant: 0, showDate: true },
    });
    expect(saveDraft(storage, draft)).toBe(true);
    const loaded = loadDraft(storage);
    expect(loaded.status).toBe("ok");
    if (loaded.status === "ok") expect(loaded.draft).toEqual(draft);
  });

  it("reports unreadable data as invalid without throwing", () => {
    expect(loadDraft(memoryStorage({ [DRAFT_STORAGE_KEY]: "{broken" })).status).toBe("invalid");
    expect(loadDraft(memoryStorage()).status).toBe("empty");
    expect(loadDraft(null).status).toBe("unavailable");
  });

  it("Clear My Data removes only this app's keys", () => {
    const storage = memoryStorage({
      [DRAFT_STORAGE_KEY]: "{}",
      "year-in-stamps:draft:unreadable-backup": "x",
      "year-in-stamps:draft:pre-v3-backup": "y",
      "another-app:settings": "keep",
      theme: "dark",
    });
    expect(clearAppStorage(storage)).toBe(3);
    expect(storage.length).toBe(2);
    expect(storage.getItem("another-app:settings")).toBe("keep");
    expect(storage.getItem("theme")).toBe("dark");
    expect(clearAppStorage(null)).toBe(0);
  });
});
