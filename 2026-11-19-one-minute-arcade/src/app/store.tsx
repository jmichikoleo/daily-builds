// src/app/store.tsx
// app-wide state: records and settings, saved to localStorage as they change.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setSoundEnabled } from "../audio/sfx";
import {
  loadRecords,
  loadSettings,
  recordResult,
  saveRecords,
  saveSettings,
  type Records,
  type Settings,
} from "../storage/records";

interface Store {
  records: Records;
  settings: Settings;
  reducedMotion: boolean;
  updateSettings(patch: Partial<Settings>): void;
  commitResult(gameId: string, score: number, playedMs: number): { isNewBest: boolean; previousBest: number; best: number };
  resetRecords(): void;
}

const StoreContext = createContext<Store | null>(null);

function useSystemReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia(query);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<Records>(() => loadRecords());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const systemReduced = useSystemReducedMotion();
  const reducedMotion = settings.reducedMotion === "system" ? systemReduced : settings.reducedMotion === "on";

  useEffect(() => {
    setSoundEnabled(settings.sound);
  }, [settings.sound]);

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
  }, [reducedMotion]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const commitResult = useCallback((gameId: string, score: number, playedMs: number) => {
    // read the latest saved copy so two tabs do not wipe each other
    const current = loadRecords();
    const { records: next, isNewBest, previousBest } = recordResult(current, gameId, score, playedMs, Date.now());
    saveRecords(next);
    setRecords(next);
    return { isNewBest, previousBest, best: next.games[gameId].best };
  }, []);

  const resetRecords = useCallback(() => {
    const empty: Records = { version: 1, games: {}, totalPlayMs: 0, lastGameId: null };
    saveRecords(empty);
    setRecords(empty);
  }, []);

  const value = useMemo(
    () => ({ records, settings, reducedMotion, updateSettings, commitResult, resetRecords }),
    [records, settings, reducedMotion, updateSettings, commitResult, resetRecords],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore needs StoreProvider");
  return s;
}
