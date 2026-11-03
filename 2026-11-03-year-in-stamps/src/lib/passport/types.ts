import type { PlaceSnapshot } from "../catalog/types";
import type { StampStyle } from "../stamps/types";
import { createDefaultStudio, type StudioDesign } from "../studio/types";

export type DatePrecision = "unknown" | "month" | "day";

/** When a stamp's visit happened, as precisely as the user knows. */
export interface VisitRecord {
  precision: DatePrecision;
  /** `YYYY-MM` for month precision, `YYYY-MM-DD` for day precision, absent when unknown. */
  date?: string;
}

/** How a stamp looks. Everything but `variant` is an explicit user choice. */
export interface StampDesignConfig {
  /** Seed for the decorative details (tilt, border, serial, default style and ink). */
  variant: number;
  /** User-chosen silhouette; otherwise derived from the variant. */
  style?: StampStyle;
  /** User-chosen ink colour; otherwise taken from the collage theme. */
  ink?: string;
  showDate: boolean;
}

/** One collected stamp: a place plus one visit to it. */
export interface CollectionEntry {
  /** Unique per entry; two visits to Busan are two entries. */
  id: string;
  /** Catalog id (`iso:KR`, `gn:1838524`), or the original id for unresolved entries. */
  placeId: string;
  place: PlaceSnapshot;
  /** Set when a migrated stamp couldn't be matched to the catalog; the user can pick a match. */
  unresolved?: true;
  visit: VisitRecord;
  design: StampDesignConfig;
}

export type CollectionSort = "added" | "name" | "date";

/** The user's passport draft. This is what gets saved to localStorage. */
export interface PassportDraft {
  year: number;
  nickname: string;
  entries: CollectionEntry[];
  sort: CollectionSort;
  /** Collage design: theme, format, layout, text, background, manual placements. */
  studio: StudioDesign;
}

export const MAX_STAMPS = 40;
export const MAX_NICKNAME_LENGTH = 24;
export const MAX_TITLE_LENGTH = 48;
export const MIN_YEAR = 1950;
export const MAX_YEAR = 2100;

export function createEmptyDraft(year: number): PassportDraft {
  return {
    year,
    nickname: "",
    entries: [],
    sort: "added",
    studio: createDefaultStudio(),
  };
}

export const DEFAULT_DESIGN: StampDesignConfig = { variant: 0, showDate: true };

/** A fresh, collision-resistant entry id. Only called from user actions, never during render. */
export function newEntryId(): string {
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The title shown on the collage when the user hasn't written one. */
export function automaticTitle(draft: Pick<PassportDraft, "nickname">): string {
  const name = draft.nickname.trim();
  return name ? `${name}'s year in stamps` : "My year in stamps";
}

export function displayTitle(draft: Pick<PassportDraft, "nickname" | "studio">): string {
  return draft.studio.text.title.trim() || automaticTitle(draft);
}
