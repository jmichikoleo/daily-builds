import type { CollectionEntry, CollectionSort, VisitRecord } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Checks the shape and that the day exists in that month (no 31 April). */
export function isValidVisit(visit: VisitRecord): boolean {
  if (visit.precision === "unknown") return visit.date === undefined;
  if (!visit.date) return false;
  if (visit.precision === "month") return MONTH_RE.test(visit.date);
  const m = DAY_RE.exec(visit.date);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDate() === d;
}

export const UNKNOWN_VISIT: VisitRecord = { precision: "unknown" };

export function visitYear(visit: VisitRecord): number | null {
  return visit.date ? Number(visit.date.slice(0, 4)) : null;
}

/** A known date that falls outside the passport year. Never auto-deleted; the user resolves it. */
export function hasYearConflict(visit: VisitRecord, passportYear: number): boolean {
  const y = visitYear(visit);
  return y !== null && y !== passportYear;
}

/** "14 Mar 2026", "Mar 2026", or null when unknown. Locale-independent on purpose. */
export function formatVisit(visit: VisitRecord): string | null {
  if (!visit.date) return null;
  const y = visit.date.slice(0, 4);
  const month = MONTHS[Number(visit.date.slice(5, 7)) - 1];
  if (visit.precision === "month") return `${month} ${y}`;
  return `${Number(visit.date.slice(8, 10))} ${month} ${y}`;
}

/** Same day/month on two visits to one place looks like an accidental duplicate. */
export function isSameVisit(a: VisitRecord, b: VisitRecord): boolean {
  return a.precision !== "unknown" && a.precision === b.precision && a.date === b.date;
}

/** Order entries for display and for the collage. "added" keeps collection order. */
export function sortEntries(entries: readonly CollectionEntry[], sort: CollectionSort): CollectionEntry[] {
  const list = [...entries];
  if (sort === "name") {
    list.sort((a, b) => a.place.name.localeCompare(b.place.name, "en", { sensitivity: "base" }));
  } else if (sort === "date") {
    // Known dates first, earliest first; a month sorts before days within it. Unknown dates last.
    list.sort((a, b) => {
      const da = a.visit.date;
      const db = b.visit.date;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    });
  }
  return list;
}
