import { LEGACY_PLACES, nameFromLegacyId } from "../catalog/legacy";
import type { PlaceKind, PlaceSnapshot } from "../catalog/types";
import { isFormatId } from "../collage/formats";
import {
  MAX_NICKNAME_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_YEAR,
  MIN_YEAR,
  createEmptyDraft,
  type CollectionEntry,
  type CollectionSort,
  type PassportDraft,
  type StampDesignConfig,
  type VisitRecord,
} from "../passport/types";
import { UNKNOWN_VISIT, isValidVisit } from "../passport/visits";
import { isMotifId } from "../stamps/motifs";
import { isInk, isStampStyle } from "../stamps/types";
import {
  MAX_FOOTER_LENGTH,
  MAX_SUBTITLE_LENGTH,
  createDefaultStudio,
  isLayoutPreset,
  type BackgroundBorder,
  type BackgroundTexture,
  type FontPreset,
  type StampOverride,
  type StudioDesign,
  type TitleAlign,
} from "../studio/types";
import { isThemeId } from "../themes";

export const DRAFT_STORAGE_KEY = "year-in-stamps:draft";
/** Where an unreadable draft is copied before the first new save replaces it. */
export const DRAFT_BACKUP_KEY = "year-in-stamps:draft:unreadable-backup";
/** Where an older-schema draft is copied before it is first saved in the current schema. */
export function migrationBackupKey(fromVersion: number): string {
  // v1/v2 drafts used this key before v4 existed; keep it so backups land in one place.
  return fromVersion < 3 ? "year-in-stamps:draft:pre-v3-backup" : `year-in-stamps:draft:backup-from-v${fromVersion}`;
}

/**
 * Schema history:
 * - v1 (Phase 1): `stamps: { destinationId, visitMonth? }[]`, one per destination, demo ids.
 * - v2: stamps gained `id` (`<destinationId>~<visit>`) for repeat visits.
 * - v3 (Phase 2): `entries` with catalog ids, place snapshots, visit records
 *   with precision, per-stamp design config, and a collection sort.
 * - v4 (Phase 3): `title`, `themeId`, `formatId` move into `studio` together with
 *   layout preset/seed, typography, background and per-stamp manual placements.
 * Older versions are migrated on load; the next save writes v4.
 */
export const DRAFT_SCHEMA_VERSION = 4;

interface StoredDraftV4 {
  version: 4;
  savedAt: string;
  draft: PassportDraft;
}

export type DraftLoadResult =
  | { status: "empty" }
  | {
      status: "ok";
      draft: PassportDraft;
      /** Malformed entries that held no usable place at all. */
      droppedEntries: number;
      /** Set when the stored draft used an older schema; `raw` is the original text. */
      migratedFrom?: 1 | 2 | 3;
      raw?: string;
    }
  | { status: "invalid"; raw: string; reason: string }
  | { status: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

const KINDS: readonly PlaceKind[] = ["country", "territory", "city"];
const SORTS: readonly CollectionSort[] = ["added", "name", "date"];

/** Make ids unique within the draft, keeping the first occurrence as-is. */
function uniqueId(id: string, used: Set<string>, fallback: string): string {
  let candidate = id || fallback;
  let n = 2;
  while (used.has(candidate)) candidate = `${id || fallback}-${n++}`;
  used.add(candidate);
  return candidate;
}

// ── v1 / v2 → v3 ───────────────────────────────────────────────────────

function migrateLegacyStamps(value: unknown): { entries: CollectionEntry[]; dropped: number } {
  if (!Array.isArray(value)) return { entries: [], dropped: 0 };
  const entries: CollectionEntry[] = [];
  const used = new Set<string>();
  const variants = new Map<string, number>();
  let dropped = 0;
  value.forEach((raw, index) => {
    const destinationId = isRecord(raw) ? raw.destinationId : undefined;
    if (typeof destinationId !== "string" || !destinationId) {
      dropped++;
      return;
    }
    const legacy = LEGACY_PLACES[destinationId];
    const placeId = legacy?.placeId ?? destinationId;
    // Unknown ids are kept, flagged, and fixable in the UI — never dropped.
    const place: PlaceSnapshot = legacy?.place ?? {
      name: nameFromLegacyId(destinationId),
      kind: destinationId.startsWith("city:") ? "city" : "country",
      isoCode: "",
      countryName: "",
      motif: "compass",
    };
    const month = (raw as Record<string, unknown>).visitMonth;
    const visit: VisitRecord =
      typeof month === "string" && isValidVisit({ precision: "month", date: month })
        ? { precision: "month", date: month }
        : UNKNOWN_VISIT;
    // v2 ids end in "~<visit>"; later visits get later variants so they still look distinct.
    const variant = variants.get(placeId) ?? 0;
    variants.set(placeId, variant + 1);
    const oldId = typeof (raw as Record<string, unknown>).id === "string" ? String((raw as Record<string, unknown>).id) : destinationId;
    entries.push({
      id: uniqueId(`m-${oldId}`, used, `m-${index}`),
      placeId,
      place,
      ...(legacy ? {} : { unresolved: true as const }),
      visit,
      design: { variant, showDate: true },
    });
  });
  return { entries, dropped };
}

// ── v3 ────────────────────────────────────────────────────────────────

function sanitizePlace(value: unknown): PlaceSnapshot | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) return null;
  const kind = KINDS.includes(value.kind as PlaceKind) ? (value.kind as PlaceKind) : "city";
  return {
    name: value.name.slice(0, 120),
    kind,
    isoCode: typeof value.isoCode === "string" ? value.isoCode.slice(0, 3) : "",
    countryName: cleanText(value.countryName, 120),
    ...(typeof value.regionName === "string" && value.regionName ? { regionName: value.regionName.slice(0, 120) } : {}),
    ...(typeof value.designation === "string" && value.designation ? { designation: value.designation.slice(0, 120) } : {}),
    motif: isMotifId(value.motif) ? value.motif : "compass",
  };
}

function sanitizeVisit(value: unknown): VisitRecord {
  if (!isRecord(value)) return UNKNOWN_VISIT;
  const visit = { precision: value.precision, date: value.date } as VisitRecord;
  if (visit.precision === "unknown") return UNKNOWN_VISIT;
  return isValidVisit(visit) ? { precision: visit.precision, date: visit.date } : UNKNOWN_VISIT;
}

function sanitizeDesign(value: unknown): StampDesignConfig {
  const d = isRecord(value) ? value : {};
  return {
    variant: typeof d.variant === "number" && Number.isInteger(d.variant) && d.variant >= 0 ? d.variant : 0,
    ...(isStampStyle(d.style) ? { style: d.style } : {}),
    ...(isInk(d.ink) ? { ink: d.ink } : {}),
    showDate: typeof d.showDate === "boolean" ? d.showDate : true,
  };
}

function sanitizeEntries(value: unknown): { entries: CollectionEntry[]; dropped: number } {
  if (!Array.isArray(value)) return { entries: [], dropped: 0 };
  const entries: CollectionEntry[] = [];
  const used = new Set<string>();
  let dropped = 0;
  value.forEach((raw, index) => {
    const place = isRecord(raw) ? sanitizePlace(raw.place) : null;
    if (!isRecord(raw) || !place || typeof raw.placeId !== "string" || !raw.placeId) {
      dropped++;
      return;
    }
    entries.push({
      id: uniqueId(typeof raw.id === "string" ? raw.id.slice(0, 80) : "", used, `r-${index}`),
      placeId: raw.placeId.slice(0, 80),
      place,
      ...(raw.unresolved === true ? { unresolved: true as const } : {}),
      visit: sanitizeVisit(raw.visit),
      design: sanitizeDesign(raw.design),
    });
  });
  return { entries, dropped };
}

// ── v4 studio design ──────────────────────────────────────────────────

const HEX = /^#[0-9a-fA-F]{6}$/;
const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function sanitizeOverrides(value: unknown, entryIds: ReadonlySet<string>): Record<string, StampOverride> {
  const out: Record<string, StampOverride> = {};
  if (!isRecord(value)) return out;
  for (const [id, o] of Object.entries(value)) {
    if (!entryIds.has(id) || !isRecord(o)) continue;
    const nums = [o.x, o.y, o.w, o.rotation, o.z];
    if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    out[id] = {
      x: clamp(o.x as number, 0, 1),
      y: clamp(o.y as number, 0, 1),
      w: clamp(o.w as number, 0.04, 0.9),
      rotation: clamp(o.rotation as number, -180, 180),
      z: Math.round(o.z as number),
    };
  }
  return out;
}

/** Validate a studio design; anything unrecognised falls back to "theme default". */
export function sanitizeStudio(value: unknown, entryIds: ReadonlySet<string>): StudioDesign {
  const defaults = createDefaultStudio();
  const s = isRecord(value) ? value : {};
  const layout = isRecord(s.layout) ? s.layout : {};
  const text = isRecord(s.text) ? s.text : {};
  const bg = isRecord(s.background) ? s.background : {};
  const overrides = isRecord(s.overrides) ? s.overrides : {};
  const seed = typeof layout.seed === "number" && Number.isInteger(layout.seed) && layout.seed >= 0 ? layout.seed : defaults.layout.seed;
  const preset = isLayoutPreset(layout.preset) ? layout.preset : undefined;
  const align = pick<TitleAlign>(text.align, ["left", "center"]);
  const font = pick<FontPreset>(text.font, ["passport", "postcard", "atlas", "typewriter"]);
  const texture = pick<BackgroundTexture>(bg.texture, ["none", "grain", "aged", "linen", "dots", "grid"]);
  const border = pick<BackgroundBorder>(bg.border, ["none", "hairline", "double", "airmail", "registration"]);
  return {
    themeId: isThemeId(s.themeId) ? s.themeId : defaults.themeId,
    formatId: isFormatId(s.formatId) ? s.formatId : defaults.formatId,
    layout: { seed, ...(preset ? { preset } : {}) },
    text: {
      title: cleanText(text.title, MAX_TITLE_LENGTH),
      subtitle: cleanText(text.subtitle, MAX_SUBTITLE_LENGTH),
      footer: cleanText(text.footer, MAX_FOOTER_LENGTH),
      ...(align ? { align } : {}),
      ...(font ? { font } : {}),
      ...(typeof text.color === "string" && HEX.test(text.color) ? { color: text.color } : {}),
      showCount: typeof text.showCount === "boolean" ? text.showCount : true,
      showAttribution: typeof text.showAttribution === "boolean" ? text.showAttribution : true,
    },
    background: {
      ...(typeof bg.paper === "string" && HEX.test(bg.paper) ? { paper: bg.paper } : {}),
      ...(texture ? { texture } : {}),
      ...(border ? { border } : {}),
      showAccents: typeof bg.showAccents === "boolean" ? bg.showAccents : true,
    },
    overrides: {
      story: sanitizeOverrides(overrides.story, entryIds),
      square: sanitizeOverrides(overrides.square, entryIds),
    },
  };
}

/**
 * Parse, validate and migrate a stored draft. Pure — no storage access.
 * Broken fields fall back to defaults; non-JSON, a missing draft, a bad year
 * or an unknown (e.g. newer) schema version makes the whole thing `invalid`.
 */
export function parseStoredDraft(raw: string): DraftLoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", raw, reason: "not-json" };
  }
  if (!isRecord(parsed)) return { status: "invalid", raw, reason: "not-an-object" };
  const version = parsed.version;
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4) {
    return { status: "invalid", raw, reason: `unsupported-version:${String(version)}` };
  }
  const d = parsed.draft;
  if (!isRecord(d)) return { status: "invalid", raw, reason: "missing-draft" };

  const year = d.year;
  if (typeof year !== "number" || !Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return { status: "invalid", raw, reason: "bad-year" };
  }

  const { entries, dropped } = version >= 3 ? sanitizeEntries(d.entries) : migrateLegacyStamps(d.stamps);
  const defaults = createEmptyDraft(year);
  // Before v4 the theme, format and title lived at the top level of the draft.
  const studio =
    version === 4
      ? sanitizeStudio(d.studio, new Set(entries.map((e) => e.id)))
      : sanitizeStudio({ ...createDefaultStudio(), themeId: d.themeId, formatId: d.formatId, text: { ...createDefaultStudio().text, title: d.title } }, new Set());
  return {
    status: "ok",
    droppedEntries: dropped,
    ...(version !== 4 ? { migratedFrom: version, raw } : {}),
    draft: {
      year,
      nickname: cleanText(d.nickname, MAX_NICKNAME_LENGTH),
      entries,
      sort: SORTS.includes(d.sort as CollectionSort) ? (d.sort as CollectionSort) : defaults.sort,
      studio,
    },
  };
}

/** Returns localStorage, or null when it is missing or blocked (private mode, sandboxing). */
export function getBrowserStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    const probe = "year-in-stamps:probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function loadDraft(storage: Storage | null): DraftLoadResult {
  if (!storage) return { status: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return { status: "unavailable" };
  }
  if (raw === null) return { status: "empty" };
  return parseStoredDraft(raw);
}

/** Save the draft. Returns false if storage refused (quota, private mode). */
export function saveDraft(storage: Storage | null, draft: PassportDraft): boolean {
  if (!storage) return false;
  const envelope: StoredDraftV4 = {
    version: DRAFT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    draft,
  };
  try {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/** Keep a copy of data we couldn't read (or are about to migrate) so a save never destroys it. */
export function backupDraft(storage: Storage | null, raw: string, key: string): void {
  if (!storage) return;
  try {
    storage.setItem(key, raw);
  } catch {
    // Best effort only.
  }
}

/** Every localStorage key this app writes starts with this. */
export const APP_STORAGE_PREFIX = "year-in-stamps:";

/**
 * Remove only this app's keys (draft, backups, probe), leaving every other
 * site's or app's data alone. Returns how many keys were removed.
 */
export function clearAppStorage(storage: Storage | null): number {
  if (!storage) return 0;
  const ours: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(APP_STORAGE_PREFIX)) ours.push(key);
    }
    for (const key of ours) storage.removeItem(key);
  } catch {
    return 0;
  }
  return ours.length;
}
