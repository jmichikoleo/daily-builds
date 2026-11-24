// src/lib/storage.ts
// saving and loading the passport. one json document in localStorage under a
// versioned key. backups are the same document wrapped with a small header.
// everything coming in (localStorage or an imported file) goes through
// sanitize(), which keeps what is valid and drops what is not.

import type {
  CollectedStamp,
  ExpeditionProgress,
  ExplorerProfile,
  JournalEntry,
  PassportState,
  TerritoryId,
  Visit,
} from "../types";
import { SCHEMA_VERSION, emptyState } from "./logic";
import { destination } from "../data/destinations";
import { stampById } from "../data/stamps";
import { expedition } from "../data/expeditions";
import { TERRITORIES } from "../data/territories";

export const STORAGE_KEY = "internet-passport:v1";
export const BACKUP_KIND = "internet-passport-backup";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = "", max = 2000) => (typeof v === "string" ? v.slice(0, max) : fallback);
const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const TERRITORY_IDS = new Set<string>(TERRITORIES.map((t) => t.id));

function sanitizeProfile(v: unknown): ExplorerProfile | null {
  if (!isObj(v)) return null;
  const name = str(v.name, "", 60).trim();
  const passportNumber = str(v.passportNumber, "", 20);
  if (!name || !passportNumber) return null;
  const photo = typeof v.photo === "string" && v.photo.startsWith("data:image/") && v.photo.length < 2_000_000 ? v.photo : null;
  return {
    name,
    alias: str(v.alias, "", 60),
    photo,
    homeCountry: str(v.homeCountry, "", 60),
    favoriteTerritories: Array.isArray(v.favoriteTerritories)
      ? (v.favoriteTerritories.filter((t) => typeof t === "string" && TERRITORY_IDS.has(t)) as TerritoryId[]).slice(0, 8)
      : [],
    motto: str(v.motto, "", 140),
    coverColor: /^#[0-9a-fA-F]{6}$/.test(str(v.coverColor)) ? str(v.coverColor) : "#783B49",
    passportNumber,
    issuedAt: isIso(v.issuedAt) ? v.issuedAt : new Date().toISOString(),
    classification: str(v.classification, "class i, general explorer", 80),
  };
}

/** turns anything into a valid PassportState. returns null only if it is not a passport at all */
export function sanitize(raw: unknown): PassportState | null {
  if (!isObj(raw)) return null;
  const version = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
  if (version > SCHEMA_VERSION) return null; // from a newer app, refuse rather than damage it
  const migrated = migrate(raw, version);
  const base = emptyState();

  const visits: Visit[] = [];
  const seen = new Set<string>();
  if (Array.isArray(migrated.visits)) {
    for (const v of migrated.visits) {
      if (!isObj(v)) continue;
      const id = str(v.destinationId);
      if (!destination(id) || seen.has(id) || !isIso(v.visitedAt)) continue; // also drops duplicates
      seen.add(id);
      visits.push({ id: str(v.id) || `v-${id}`, destinationId: id, visitedAt: v.visitedAt, reflection: str(v.reflection, "", 4000) });
    }
  }

  const stamps: Record<string, CollectedStamp> = {};
  if (isObj(migrated.stamps)) {
    for (const [k, v] of Object.entries(migrated.stamps)) {
      if (!stampById(k) || !isObj(v) || !isIso(v.earnedAt)) continue;
      stamps[k] = { stampId: k, earnedAt: v.earnedAt };
    }
  }

  const unlockedSecrets: Record<string, string> = {};
  if (isObj(migrated.unlockedSecrets)) {
    for (const [k, v] of Object.entries(migrated.unlockedSecrets)) {
      if (destination(k)?.territory === "hidden" && isIso(v)) unlockedSecrets[k] = v;
    }
  }

  const discoveries: Record<string, string> = {};
  if (isObj(migrated.discoveries)) {
    for (const [k, v] of Object.entries(migrated.discoveries)) {
      if (["bottle", "clock", "emblem"].includes(k) && isIso(v)) discoveries[k] = v;
    }
  }

  const expeditions: Record<string, ExpeditionProgress> = {};
  if (isObj(migrated.expeditions)) {
    for (const [k, v] of Object.entries(migrated.expeditions)) {
      if (!expedition(k) || !isObj(v) || !isIso(v.startedAt)) continue;
      expeditions[k] = { expeditionId: k, startedAt: v.startedAt, completedAt: isIso(v.completedAt) ? v.completedAt : null };
    }
  }

  const journal: JournalEntry[] = [];
  if (Array.isArray(migrated.journal)) {
    for (const j of migrated.journal) {
      if (!isObj(j) || typeof j.id !== "string") continue;
      const destId = typeof j.destinationId === "string" && destination(j.destinationId) ? j.destinationId : null;
      const rating = typeof j.rating === "number" ? Math.max(0, Math.min(5, Math.round(j.rating))) : 0;
      journal.push({
        id: j.id,
        destinationId: destId,
        date: /^\d{4}-\d{2}-\d{2}$/.test(str(j.date)) ? str(j.date) : new Date().toISOString().slice(0, 10),
        rating,
        favorite: str(j.favorite, "", 500),
        reflection: str(j.reflection, "", 6000),
        tags: Array.isArray(j.tags) ? j.tags.filter((t): t is string => typeof t === "string").map((t) => t.slice(0, 30)).slice(0, 12) : [],
        revisit: Boolean(j.revisit),
        createdAt: isIso(j.createdAt) ? j.createdAt : new Date().toISOString(),
        updatedAt: isIso(j.updatedAt) ? j.updatedAt : new Date().toISOString(),
      });
    }
  }

  const favorites = Array.isArray(migrated.favorites)
    ? [...new Set(migrated.favorites.filter((f): f is string => typeof f === "string" && Boolean(destination(f))))]
    : [];

  const p = isObj(migrated.preferences) ? migrated.preferences : {};
  const preferences = {
    motion: p.motion === "reduced" || p.motion === "full" ? p.motion : "system",
    sound: p.sound === true,
    atlasView: p.atlasView === "list" ? "list" : "map",
  } as PassportState["preferences"];

  const dep = isObj(migrated.departure) && destination(str(migrated.departure.destinationId)) && isIso(migrated.departure.at)
    ? { destinationId: str(migrated.departure.destinationId), at: migrated.departure.at as string }
    : null;

  return {
    ...base,
    schemaVersion: SCHEMA_VERSION,
    profile: sanitizeProfile(migrated.profile),
    visits,
    stamps,
    unlockedSecrets,
    discoveries,
    expeditions,
    journal,
    favorites,
    preferences,
    departure: dep,
  };
}

/** future schema changes go here, one step at a time */
function migrate(raw: Obj, from: number): Obj {
  const out = { ...raw };
  if (from < 1) {
    // version 0 never shipped. nothing to change, just stamp the version.
    out.schemaVersion = 1;
  }
  return out;
}

export type LoadResult = { state: PassportState; problem: "none" | "corrupted" | "newer" };

export function load(storage: Pick<Storage, "getItem"> | null = safeStorage()): LoadResult {
  if (!storage) return { state: emptyState(), problem: "none" };
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: emptyState(), problem: "none" };
  }
  if (!text) return { state: emptyState(), problem: "none" };
  try {
    const parsed = JSON.parse(text);
    if (isObj(parsed) && typeof parsed.schemaVersion === "number" && parsed.schemaVersion > SCHEMA_VERSION) {
      return { state: emptyState(), problem: "newer" };
    }
    const s = sanitize(parsed);
    return s ? { state: s, problem: "none" } : { state: emptyState(), problem: "corrupted" };
  } catch {
    return { state: emptyState(), problem: "corrupted" };
  }
}

export function save(state: PassportState, storage: Pick<Storage, "setItem"> | null = safeStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** keeps the unreadable text aside so nothing is silently thrown away */
export function quarantine(storage: Storage | null = safeStorage()) {
  if (!storage) return;
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (text) storage.setItem(`${STORAGE_KEY}:unreadable-${Date.now()}`, text);
  } catch {
    // nothing else to do
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function makeBackup(state: PassportState, at = new Date()) {
  return JSON.stringify({ kind: BACKUP_KIND, exportedAt: at.toISOString(), data: state }, null, 2);
}

export type RestoreResult = { ok: true; state: PassportState } | { ok: false; error: string };

export function readBackup(text: string): RestoreResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "that file is not valid json." };
  }
  if (!isObj(parsed) || parsed.kind !== BACKUP_KIND || !isObj(parsed.data)) {
    return { ok: false, error: "that file is not an internet passport backup." };
  }
  if (typeof parsed.data.schemaVersion === "number" && parsed.data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: "that backup comes from a newer version of the app." };
  }
  const s = sanitize(parsed.data);
  if (!s || !s.profile) return { ok: false, error: "the backup has no passport inside it." };
  return { ok: true, state: s };
}
