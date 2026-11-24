// src/lib/logic.ts
// all the rules of the game as plain functions. no react, no storage.
// every action takes a PassportState and returns a new one plus any awards,
// so the rules are easy to test (see tests/logic.test.ts).

import type {
  Award,
  Destination,
  Expedition,
  JournalEntry,
  PassportState,
  TerritoryId,
  UnlockCondition,
  DiscoveryKey,
} from "../types";
import { DESTINATIONS, REGULAR_DESTINATIONS, SECRET_DESTINATIONS, destination } from "../data/destinations";
import { ACHIEVEMENTS } from "../data/achievements";
import { EXPEDITIONS } from "../data/expeditions";
import { REGULAR_TERRITORIES, territory } from "../data/territories";
import {
  WELCOME_STAMP_ID,
  achievementStampId,
  destinationStampId,
  expeditionStampId,
  territoryStampId,
} from "../data/stamps";

export const SCHEMA_VERSION = 1;

export function emptyState(): PassportState {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: null,
    visits: [],
    stamps: {},
    unlockedSecrets: {},
    discoveries: {},
    expeditions: {},
    journal: [],
    favorites: [],
    preferences: { motion: "system", sound: false, atlasView: "map" },
    departure: null,
  };
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------- identity ----------

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** like IP-KT 4829105. random, but only made once at issue time */
export function makePassportNumber(rand: () => number = Math.random): string {
  const a = LETTERS[Math.floor(rand() * LETTERS.length)];
  const b = LETTERS[Math.floor(rand() * LETTERS.length)];
  let digits = "";
  for (let i = 0; i < 7; i++) digits += Math.floor(rand() * 10);
  return `IP-${a}${b}${digits}`;
}

const CLASSES: Record<TerritoryId, string> = {
  creative: "gallery wanderer",
  science: "stargazing naturalist",
  sound: "sonic cartographer",
  frontier: "frontier tinkerer",
  oddlands: "connoisseur of the odd",
  archive: "keeper of old pages",
  playground: "professional player",
  quiet: "slow traveller",
  hidden: "seeker of hidden places",
};

/** explorer classification printed on the identity page */
export function classify(favorites: TerritoryId[]): string {
  if (favorites.length === 0) return "class i, general explorer";
  if (favorites.length >= 4) return "class iv, omnivorous explorer";
  const roman = ["i", "ii", "iii"][favorites.length - 1];
  return `class ${roman}, ${CLASSES[favorites[0]]}`;
}

export const TITLES: { min: number; title: string }[] = [
  { min: 0, title: "First-Time Traveler" },
  { min: 5, title: "Curious Wanderer" },
  { min: 15, title: "Digital Backpacker" },
  { min: 30, title: "Internet Cartographer" },
  { min: 50, title: "Seasoned Explorer" },
  { min: 75, title: "Citizen of the Internet" },
];

export function explorerTitle(visitCount: number): string {
  let t = TITLES[0].title;
  for (const row of TITLES) if (visitCount >= row.min) t = row.title;
  return t;
}

export function nextTitle(visitCount: number): { title: string; needed: number } | null {
  const next = TITLES.find((t) => t.min > visitCount);
  return next ? { title: next.title, needed: next.min - visitCount } : null;
}

// ---------- reading the state ----------

export function visitedSet(state: PassportState): Set<string> {
  return new Set(state.visits.map((v) => v.destinationId));
}

export function hasVisited(state: PassportState, id: string): boolean {
  return state.visits.some((v) => v.destinationId === id);
}

/** regular destinations are always open. hidden ones open once unlocked */
export function isOpen(state: PassportState, d: Destination): boolean {
  return d.territory !== "hidden" || Boolean(state.unlockedSecrets[d.id]);
}

export function visitsIn(state: PassportState, t: TerritoryId): number {
  const seen = visitedSet(state);
  return DESTINATIONS.filter((d) => d.territory === t && seen.has(d.id)).length;
}

export function territoriesExplored(state: PassportState): TerritoryId[] {
  return REGULAR_TERRITORIES.filter((t) => visitsIn(state, t.id) > 0).map((t) => t.id);
}

export function territoryComplete(state: PassportState, t: TerritoryId): boolean {
  const all = DESTINATIONS.filter((d) => d.territory === t);
  return all.length > 0 && visitsIn(state, t) === all.length;
}

export function expeditionProgress(state: PassportState, e: Expedition) {
  const seen = visitedSet(state);
  const done = e.destinationIds.filter((id) => seen.has(id));
  return {
    visited: done.length,
    total: e.destinationIds.length,
    complete: done.length === e.destinationIds.length,
    remaining: e.destinationIds.filter((id) => !seen.has(id)),
  };
}

export function completedExpeditions(state: PassportState): string[] {
  return EXPEDITIONS.filter((e) => expeditionProgress(state, e).complete).map((e) => e.id);
}

function isNight(iso: string): boolean {
  const h = new Date(iso).getHours();
  return h >= 0 && h < 4;
}

export function conditionMet(state: PassportState, c: UnlockCondition): boolean {
  switch (c.type) {
    case "totalVisits":
      return state.visits.length >= c.count;
    case "territoryVisits":
      return visitsIn(state, c.territory) >= c.count;
    case "territoriesExplored":
      return territoriesExplored(state).length >= c.count;
    case "expeditionComplete": {
      const e = EXPEDITIONS.find((x) => x.id === c.expeditionId);
      return e ? expeditionProgress(state, e).complete : false;
    }
    case "expeditionsCompleted":
      return completedExpeditions(state).length >= c.count;
    case "discovery":
      return Boolean(state.discoveries[c.key]);
    case "stampCombo":
      return c.destinationIds.every((id) => hasVisited(state, id));
    case "journalEntries":
      return state.journal.length >= c.count;
    case "secretsVisited":
      return visitsIn(state, "hidden") >= c.count;
    case "nightVisit":
      return state.visits.some((v) => isNight(v.visitedAt));
  }
}

/** human readable progress for a locked condition, like "2 of 3" */
export function conditionProgress(state: PassportState, c: UnlockCondition): { have: number; need: number } {
  switch (c.type) {
    case "totalVisits":
      return { have: Math.min(state.visits.length, c.count), need: c.count };
    case "territoryVisits":
      return { have: Math.min(visitsIn(state, c.territory), c.count), need: c.count };
    case "territoriesExplored":
      return { have: Math.min(territoriesExplored(state).length, c.count), need: c.count };
    case "expeditionComplete": {
      const e = EXPEDITIONS.find((x) => x.id === c.expeditionId);
      const p = e ? expeditionProgress(state, e) : { visited: 0, total: 1 };
      return { have: p.visited, need: p.total };
    }
    case "expeditionsCompleted":
      return { have: Math.min(completedExpeditions(state).length, c.count), need: c.count };
    case "stampCombo":
      return { have: c.destinationIds.filter((id) => hasVisited(state, id)).length, need: c.destinationIds.length };
    case "journalEntries":
      return { have: Math.min(state.journal.length, c.count), need: c.count };
    case "secretsVisited":
      return { have: Math.min(visitsIn(state, "hidden"), c.count), need: c.count };
    case "discovery":
    case "nightVisit":
      return { have: conditionMet(state, c) ? 1 : 0, need: 1 };
  }
}

// ---------- rules that award things ----------

function giveStamp(state: PassportState, stampId: string, at: string, awards: Award[]): PassportState {
  if (state.stamps[stampId]) return state; // never twice
  awards.push({ type: "stamp", stampId });
  return { ...state, stamps: { ...state.stamps, [stampId]: { stampId, earnedAt: at } } };
}

/**
 * checks every unlock rule until nothing changes. runs after any action.
 * order matters a little, so it loops: finishing an expedition can unlock a
 * secret, and so on.
 */
export function evaluate(state: PassportState, at: string): { state: PassportState; awards: Award[] } {
  const awards: Award[] = [];
  let s = state;
  for (let round = 0; round < 6; round++) {
    const before = awards.length;

    for (const d of SECRET_DESTINATIONS) {
      if (!d.secret || s.unlockedSecrets[d.id]) continue;
      if (conditionMet(s, d.secret.unlock)) {
        s = { ...s, unlockedSecrets: { ...s.unlockedSecrets, [d.id]: at } };
        awards.push({ type: "secret", destinationId: d.id });
      }
    }

    for (const t of REGULAR_TERRITORIES) {
      if (territoryComplete(s, t.id)) s = giveStamp(s, territoryStampId(t.id), at, awards);
    }

    for (const e of EXPEDITIONS) {
      const p = expeditionProgress(s, e);
      const rec = s.expeditions[e.id];
      if (p.visited > 0 && !rec) {
        s = { ...s, expeditions: { ...s.expeditions, [e.id]: { expeditionId: e.id, startedAt: at, completedAt: null } } };
      }
      if (p.complete && !s.expeditions[e.id]?.completedAt) {
        const startedAt = s.expeditions[e.id]?.startedAt ?? at;
        s = { ...s, expeditions: { ...s.expeditions, [e.id]: { expeditionId: e.id, startedAt, completedAt: at } } };
      }
      if (p.complete) s = giveStamp(s, expeditionStampId(e.id), at, awards);
    }

    for (const a of ACHIEVEMENTS) {
      if (conditionMet(s, a.condition)) s = giveStamp(s, achievementStampId(a.id), at, awards);
    }

    if (awards.length === before) break;
  }
  return { state: s, awards };
}

export type VisitResult =
  | { ok: true; state: PassportState; awards: Award[] }
  | { ok: false; reason: "already-visited" | "unknown" | "locked"; state: PassportState };

/** honour based. the explorer says they went, so they went. */
export function confirmVisit(state: PassportState, destinationId: string, at: string, reflection = ""): VisitResult {
  const d = destination(destinationId);
  if (!d) return { ok: false, reason: "unknown", state };
  if (!isOpen(state, d)) return { ok: false, reason: "locked", state };
  if (hasVisited(state, destinationId)) {
    return { ok: false, reason: "already-visited", state: { ...state, departure: null } };
  }
  const awards: Award[] = [];
  let s: PassportState = {
    ...state,
    visits: [...state.visits, { id: uid(), destinationId, visitedAt: at, reflection: reflection.trim() }],
    departure: null,
  };
  s = giveStamp(s, destinationStampId(destinationId), at, awards);
  const evaluated = evaluate(s, at);
  return { ok: true, state: evaluated.state, awards: [...awards, ...evaluated.awards] };
}

export function depart(state: PassportState, destinationId: string, at: string): PassportState {
  return { ...state, departure: { destinationId, at } };
}

export function recordDiscovery(state: PassportState, key: DiscoveryKey, at: string) {
  if (state.discoveries[key]) return { state, awards: [] as Award[] };
  return evaluate({ ...state, discoveries: { ...state.discoveries, [key]: at } }, at);
}

export function issuePassport(state: PassportState, at: string) {
  const awards: Award[] = [];
  const s = giveStamp(state, WELCOME_STAMP_ID, at, awards);
  return { state: s, awards };
}

export function toggleFavorite(state: PassportState, id: string): PassportState {
  const has = state.favorites.includes(id);
  return { ...state, favorites: has ? state.favorites.filter((f) => f !== id) : [...state.favorites, id] };
}

export function saveJournalEntry(state: PassportState, entry: JournalEntry, at: string) {
  const exists = state.journal.some((j) => j.id === entry.id);
  const journal = exists
    ? state.journal.map((j) => (j.id === entry.id ? { ...entry, updatedAt: at } : j))
    : [...state.journal, { ...entry, createdAt: at, updatedAt: at }];
  return evaluate({ ...state, journal }, at);
}

export function deleteJournalEntry(state: PassportState, id: string): PassportState {
  return { ...state, journal: state.journal.filter((j) => j.id !== id) };
}

export function updateRecordedReflection(state: PassportState, destinationId: string, reflection: string): PassportState {
  return {
    ...state,
    visits: state.visits.map((v) => (v.destinationId === destinationId ? { ...v, reflection } : v)),
  };
}

// ---------- calendar picks, no backend needed ----------

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** days since 2026-01-01 in local time. stable across timezones for the same calendar date */
export function dayNumber(d: Date): number {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((utc - Date.UTC(2026, 0, 1)) / 86_400_000);
}

/** weeks start on monday. week 0 began monday 2025-12-29 */
export function weekNumber(d: Date): number {
  return Math.floor((dayNumber(d) + 3) / 7);
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function featuredExpedition(d: Date): Expedition {
  return EXPEDITIONS[mod(weekNumber(d), EXPEDITIONS.length)];
}

/** spreads consecutive days across the list so neighbours are not from the same territory */
export function todaysDestination(d: Date): Destination {
  const list = REGULAR_DESTINATIONS;
  const step = 37; // coprime with the list length keeps it visiting everything
  return list[mod(dayNumber(d) * step + 11, list.length)];
}

/** small seeded random, so the departure board is stable for a while */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function flightCode(d: Destination): string {
  if (d.territory === "hidden") {
    const i = SECRET_DESTINATIONS.indexOf(d);
    return `XXX${String(i + 1).padStart(3, "0")}`;
  }
  const inT = DESTINATIONS.filter((x) => x.territory === d.territory);
  return `${territory(d.territory).code}${String(inT.indexOf(d) + 1).padStart(3, "0")}`;
}

export const BOARD_STATUSES = ["boarding", "on time", "final call", "gate open", "ready", "delayed by curiosity"] as const;

export function departureBoard(state: PassportState, now: Date, size = 7) {
  const seen = visitedSet(state);
  const rand = seeded(dayNumber(now) * 24 + now.getHours());
  const pool = REGULAR_DESTINATIONS.filter((d) => !seen.has(d.id));
  const source = pool.length >= size ? pool : REGULAR_DESTINATIONS;
  const shuffled = [...source].sort(() => rand() - 0.5).slice(0, size);
  return shuffled.map((d, i) => ({
    destination: d,
    code: flightCode(d),
    gate: `${String.fromCharCode(65 + (i % 6))}${1 + Math.floor(rand() * 24)}`,
    status: seen.has(d.id) ? "landed" : BOARD_STATUSES[Math.floor(rand() * BOARD_STATUSES.length)],
  }));
}

/** a random unvisited open destination, or null when the whole map is stamped */
export function surprise(state: PassportState, rand: () => number = Math.random, exclude?: string): Destination | null {
  const seen = visitedSet(state);
  const pool = DESTINATIONS.filter((d) => isOpen(state, d) && !seen.has(d.id) && d.id !== exclude);
  if (pool.length === 0) return null;
  return pool[Math.floor(rand() * pool.length)];
}

export function favoriteTerritory(state: PassportState): TerritoryId | null {
  let best: TerritoryId | null = null;
  let bestN = 0;
  for (const t of [...REGULAR_TERRITORIES.map((x) => x.id), "hidden" as TerritoryId]) {
    const n = visitsIn(state, t);
    if (n > bestN) {
      best = t;
      bestN = n;
    }
  }
  return best;
}
