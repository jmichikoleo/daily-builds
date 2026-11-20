// src/storage/records.ts
// personal bests, play counts and settings, kept in localStorage.
// everything is validated on read, and a broken or missing storage just
// means you start fresh instead of a crash.

export interface GameRecord {
  best: number;
  plays: number;
  last: number;
  lastPlayedAt: number; // epoch ms
}

export interface Records {
  version: 1;
  games: Record<string, GameRecord>;
  totalPlayMs: number;
  lastGameId: string | null;
}

export interface Settings {
  sound: boolean;
  /** "system" follows the os setting */
  reducedMotion: "system" | "on" | "off";
}

export const RECORDS_KEY = "one-minute-arcade:records";
export const SETTINGS_KEY = "one-minute-arcade:settings";

export const emptyRecords = (): Records => ({ version: 1, games: {}, totalPlayMs: 0, lastGameId: null });
export const defaultSettings = (): Settings => ({ sound: true, reducedMotion: "system" });

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function safeStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    return s;
  } catch {
    return null;
  }
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback);

/** turn whatever is stored into valid records, dropping anything odd */
export function parseRecords(raw: string | null): Records {
  if (!raw) return emptyRecords();
  try {
    const data = JSON.parse(raw) as Partial<Records> | null;
    if (!data || typeof data !== "object") return emptyRecords();
    const games: Record<string, GameRecord> = {};
    if (data.games && typeof data.games === "object") {
      for (const [id, g] of Object.entries(data.games)) {
        if (!g || typeof g !== "object") continue;
        games[id] = { best: num(g.best), plays: Math.floor(num(g.plays)), last: num(g.last), lastPlayedAt: num(g.lastPlayedAt) };
      }
    }
    return {
      version: 1,
      games,
      totalPlayMs: num(data.totalPlayMs),
      lastGameId: typeof data.lastGameId === "string" ? data.lastGameId : null,
    };
  } catch {
    return emptyRecords();
  }
}

export function parseSettings(raw: string | null): Settings {
  const d = defaultSettings();
  if (!raw) return d;
  try {
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: typeof s.sound === "boolean" ? s.sound : d.sound,
      reducedMotion: s.reducedMotion === "on" || s.reducedMotion === "off" ? s.reducedMotion : "system",
    };
  } catch {
    return d;
  }
}

/** pure. returns updated records and whether this was a new personal best */
export function recordResult(records: Records, gameId: string, score: number, playedMs: number, now: number) {
  const prev = records.games[gameId];
  const isNewBest = score > 0 && (!prev || score > prev.best);
  const game: GameRecord = {
    best: Math.max(prev?.best ?? 0, score),
    plays: (prev?.plays ?? 0) + 1,
    last: score,
    lastPlayedAt: now,
  };
  const next: Records = {
    ...records,
    games: { ...records.games, [gameId]: game },
    totalPlayMs: records.totalPlayMs + Math.max(0, playedMs),
    lastGameId: gameId,
  };
  return { records: next, isNewBest, previousBest: prev?.best ?? 0 };
}

export function loadRecords(storage: StorageLike | null = safeStorage()): Records {
  try {
    return parseRecords(storage?.getItem(RECORDS_KEY) ?? null);
  } catch {
    return emptyRecords();
  }
}

export function saveRecords(records: Records, storage: StorageLike | null = safeStorage()): boolean {
  try {
    storage?.setItem(RECORDS_KEY, JSON.stringify(records));
    return !!storage;
  } catch {
    return false;
  }
}

export function loadSettings(storage: StorageLike | null = safeStorage()): Settings {
  try {
    return parseSettings(storage?.getItem(SETTINGS_KEY) ?? null);
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings, storage: StorageLike | null = safeStorage()): boolean {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return !!storage;
  } catch {
    return false;
  }
}

/** the summary shown in the record book */
export function summarize(records: Records) {
  const entries = Object.entries(records.games);
  const totalPlays = entries.reduce((n, [, g]) => n + g.plays, 0);
  let favorite: string | null = null;
  let favPlays = 0;
  let recent: string | null = null;
  let recentAt = -1;
  for (const [id, g] of entries) {
    if (g.plays > favPlays) {
      favorite = id;
      favPlays = g.plays;
    }
    if (g.lastPlayedAt > recentAt) {
      recent = id;
      recentAt = g.lastPlayedAt;
    }
  }
  return { totalPlays, totalMinutes: records.totalPlayMs / 60000, favorite, recent };
}
