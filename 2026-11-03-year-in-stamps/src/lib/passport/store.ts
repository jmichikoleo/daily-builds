"use client";

import { useSyncExternalStore } from "react";
import type { PlaceSnapshot } from "../catalog/types";
import {
  DRAFT_BACKUP_KEY,
  DRAFT_STORAGE_KEY,
  backupDraft,
  clearAppStorage,
  getBrowserStorage,
  loadDraft,
  migrationBackupKey,
  saveDraft,
} from "../persistence/draft-storage";
import { nextVariant } from "../stamps/design";
import {
  MAX_NICKNAME_LENGTH,
  MAX_STAMPS,
  MAX_YEAR,
  MIN_YEAR,
  createEmptyDraft,
  newEntryId,
  type CollectionEntry,
  type CollectionSort,
  type PassportDraft,
  type StampDesignConfig,
  type VisitRecord,
} from "./types";
import { UNKNOWN_VISIT, hasYearConflict, isValidVisit } from "./visits";

/**
 * Passport state lives in a tiny external store backed by localStorage.
 *
 * Hydration: the server (and the hydration pass) always sees `{ status: "loading" }`;
 * the browser switches to the real draft right after hydration, so markup never
 * mismatches. Nothing is written on load — only user actions save — so an
 * existing draft is never overwritten by defaults.
 */
export type ReadyPassport = {
  status: "ready";
  draft: PassportDraft;
  /** Where the current draft came from. */
  origin: "new" | "restored" | "recovered";
  /** Set when the saved draft came from an older version of the app. */
  migratedFrom?: 1 | 2 | 3;
  /** Malformed saved entries that had no usable place. */
  droppedEntries: number;
  /** False when the browser blocks storage; edits then last only for this tab. */
  persistent: boolean;
};
export type PassportSnapshot = { status: "loading" } | ReadyPassport;

const LOADING: PassportSnapshot = { status: "loading" };

let snapshot: PassportSnapshot | null = null;
/** Data to copy aside before the first save overwrites it: [raw, backup key]. */
let pendingBackup: [string, string] | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): PassportSnapshot {
  const storage = getBrowserStorage();
  const result = loadDraft(storage);
  const fresh = () => createEmptyDraft(new Date().getFullYear());
  pendingBackup = null;
  const base = { status: "ready" as const, droppedEntries: 0, persistent: true };
  switch (result.status) {
    case "ok":
      if (result.raw && result.migratedFrom) pendingBackup = [result.raw, migrationBackupKey(result.migratedFrom)];
      return {
        ...base,
        draft: result.draft,
        origin: "restored",
        droppedEntries: result.droppedEntries,
        ...(result.migratedFrom ? { migratedFrom: result.migratedFrom } : {}),
      };
    case "invalid":
      pendingBackup = [result.raw, DRAFT_BACKUP_KEY];
      return { ...base, draft: fresh(), origin: "recovered" };
    case "empty":
      return { ...base, draft: fresh(), origin: "new" };
    case "unavailable":
      return { ...base, draft: fresh(), origin: "new", persistent: false };
  }
}

function getSnapshot(): PassportSnapshot {
  if (!snapshot) snapshot = readFromStorage();
  return snapshot;
}

function getServerSnapshot(): PassportSnapshot {
  return LOADING;
}

function emit() {
  for (const listener of listeners) listener();
}

/** Called when another tab replaces the draft (so e.g. undo history can be dropped). */
const reloadHandlers = new Set<() => void>();
export function onDraftReload(handler: () => void): () => void {
  reloadHandlers.add(handler);
  return () => reloadHandlers.delete(handler);
}

function onStorage(event: StorageEvent) {
  // Another tab changed the draft: re-read it.
  if (event.key === DRAFT_STORAGE_KEY || event.key === null) {
    snapshot = null;
    for (const handler of reloadHandlers) handler();
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function update(change: (draft: PassportDraft) => PassportDraft) {
  const current = getSnapshot();
  if (current.status !== "ready") return;
  const draft = change(current.draft);
  if (draft === current.draft) return;

  const storage = getBrowserStorage();
  if (pendingBackup) {
    backupDraft(storage, ...pendingBackup);
    pendingBackup = null;
  }
  const saved = saveDraft(storage, draft);
  snapshot = { ...current, draft, persistent: saved };
  emit();
}

/** Low-level draft update for sibling stores (the studio). Saves and notifies. */
export const updateDraft = update;

function updateEntry(id: string, change: (entry: CollectionEntry) => CollectionEntry) {
  update((d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? change(e) : e)) }));
}

export function usePassport(): PassportSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export type AddResult = "added" | "duplicate" | "full";

/** Current draft, for actions that report a result synchronously. */
export function currentDraft(): PassportDraft | null {
  const s = getSnapshot();
  return s.status === "ready" ? s.draft : null;
}

export const passportActions = {
  /** Changing the year never deletes stamps; dates that no longer fit are flagged instead. */
  setYear(year: number) {
    if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) return;
    update((d) => (d.year === year ? d : { ...d, year }));
  },
  setNickname(nickname: string) {
    update((d) => ({ ...d, nickname: nickname.slice(0, MAX_NICKNAME_LENGTH) }));
  },
  setSort(sort: CollectionSort) {
    update((d) => (d.sort === sort ? d : { ...d, sort }));
  },

  /**
   * Collect a place. A place already in the passport is NOT added again —
   * that's what `addVisit` is for — so a double click can't create duplicates.
   */
  addPlace(placeId: string, place: PlaceSnapshot): AddResult {
    const d = currentDraft();
    if (!d) return "full";
    if (d.entries.some((e) => e.placeId === placeId)) return "duplicate";
    if (d.entries.length >= MAX_STAMPS) return "full";
    update((draft) => ({
      ...draft,
      entries: [...draft.entries, { id: newEntryId(), placeId, place, visit: UNKNOWN_VISIT, design: { variant: 0, showDate: true } }],
    }));
    return "added";
  },

  /** Explicitly record another visit to a place already collected. */
  addVisit(placeId: string): AddResult {
    const d = currentDraft();
    const existing = d?.entries.find((e) => e.placeId === placeId);
    if (!d || !existing || d.entries.length >= MAX_STAMPS) return "full";
    update((draft) => {
      const entry: CollectionEntry = {
        id: newEntryId(),
        placeId,
        place: existing.place,
        ...(existing.unresolved ? { unresolved: true as const } : {}),
        visit: UNKNOWN_VISIT,
        design: { variant: nextVariant(draft.entries, placeId), showDate: true },
      };
      // Keep visits to the same place next to each other in "added" order.
      const lastIndex = draft.entries.findLastIndex((e) => e.placeId === placeId);
      const entries = [...draft.entries];
      entries.splice(lastIndex + 1, 0, entry);
      return { ...draft, entries };
    });
    return "added";
  },

  removeEntry(id: string) {
    // The manual placement stays in the studio design, so Undo puts the stamp back where it was;
    // sanitising on the next load drops placements whose stamp is gone.
    update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
  },

  /** Undo a removal: put the entry back where it was. */
  restoreEntry(entry: CollectionEntry, index: number) {
    update((d) => {
      if (d.entries.some((e) => e.id === entry.id)) return d;
      const entries = [...d.entries];
      entries.splice(Math.min(index, entries.length), 0, entry);
      return { ...d, entries };
    });
  },

  setVisit(id: string, visit: VisitRecord) {
    if (!isValidVisit(visit)) return;
    updateEntry(id, (e) => ({ ...e, visit }));
  },

  setDesign(id: string, design: StampDesignConfig) {
    updateEntry(id, (e) => ({ ...e, design }));
  },

  /** Point an unresolved (or wrong) entry at a catalog place, keeping its visit and design. */
  replacePlace(id: string, placeId: string, place: PlaceSnapshot) {
    updateEntry(id, (e) => ({ id: e.id, placeId, place, visit: e.visit, design: e.design }));
  },

  /** Resolve year conflicts by forgetting the dates that don't fit the passport year. */
  clearConflictingDates() {
    update((d) => {
      if (!d.entries.some((e) => hasYearConflict(e.visit, d.year))) return d;
      return {
        ...d,
        entries: d.entries.map((e) => (hasYearConflict(e.visit, d.year) ? { ...e, visit: UNKNOWN_VISIT } : e)),
      };
    });
  },

  /**
   * Delete everything this app stored in the browser (draft and backups) and
   * start over. Nothing is written afterwards until the user edits again.
   */
  clearAllData(): number {
    const removed = clearAppStorage(getBrowserStorage());
    pendingBackup = null;
    snapshot = { status: "ready", draft: createEmptyDraft(new Date().getFullYear()), origin: "new", droppedEntries: 0, persistent: true };
    for (const handler of reloadHandlers) handler();
    emit();
    return removed;
  },

  /** Start a fresh passport for the current year. */
  reset() {
    update(() => createEmptyDraft(new Date().getFullYear()));
  },
};
