import { describe, expect, it } from "vitest";
import type { CollectionEntry } from "./types";
import { formatVisit, hasYearConflict, isSameVisit, isValidVisit, sortEntries } from "./visits";

const entry = (id: string, name: string, date?: string): CollectionEntry => ({
  id,
  placeId: id,
  place: { name, kind: "city", isoCode: "KR", countryName: "South Korea", motif: "houses" },
  visit: date ? { precision: date.length === 7 ? "month" : "day", date } : { precision: "unknown" },
  design: { variant: 0, showDate: true },
});

describe("visit records", () => {
  it("validates precision against the date shape and real calendar days", () => {
    expect(isValidVisit({ precision: "unknown" })).toBe(true);
    expect(isValidVisit({ precision: "month", date: "2026-04" })).toBe(true);
    expect(isValidVisit({ precision: "day", date: "2026-04-30" })).toBe(true);
    expect(isValidVisit({ precision: "day", date: "2026-04-31" })).toBe(false);
    expect(isValidVisit({ precision: "day", date: "2028-02-29" })).toBe(true);
    expect(isValidVisit({ precision: "month", date: "2026-04-01" })).toBe(false);
  });

  it("formats without depending on locale", () => {
    expect(formatVisit({ precision: "day", date: "2026-03-04" })).toBe("4 Mar 2026");
    expect(formatVisit({ precision: "month", date: "2026-12" })).toBe("Dec 2026");
    expect(formatVisit({ precision: "unknown" })).toBeNull();
  });

  it("flags dates outside the passport year as conflicts", () => {
    expect(hasYearConflict({ precision: "month", date: "2025-12" }, 2026)).toBe(true);
    expect(hasYearConflict({ precision: "month", date: "2026-12" }, 2026)).toBe(false);
    expect(hasYearConflict({ precision: "unknown" }, 2026)).toBe(false);
  });

  it("detects identical visits", () => {
    expect(isSameVisit({ precision: "month", date: "2026-02" }, { precision: "month", date: "2026-02" })).toBe(true);
    expect(isSameVisit({ precision: "unknown" }, { precision: "unknown" })).toBe(false);
  });

  it("sorts by name and by date with unknown dates last", () => {
    const list = [entry("a", "Seoul", "2026-05-02"), entry("b", "busan"), entry("c", "Andong", "2026-02")];
    expect(sortEntries(list, "added").map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(sortEntries(list, "name").map((e) => e.id)).toEqual(["c", "b", "a"]);
    expect(sortEntries(list, "date").map((e) => e.id)).toEqual(["c", "a", "b"]);
  });
});
