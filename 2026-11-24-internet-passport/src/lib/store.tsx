// src/lib/store.tsx
// one react context that holds the passport, saves it on every change and
// keeps a queue of awards (stamps, secret reveals) for the ceremony overlay.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Award, DiscoveryKey, ExplorerProfile, JournalEntry, PassportState, UserPreferences } from "../types";
import * as rules from "./logic";
import { load, quarantine, save } from "./storage";

interface Store {
  state: PassportState;
  problem: "none" | "corrupted" | "newer";
  saveFailed: boolean;
  queue: Award[];
  dismissAward: () => void;
  issue: (profile: ExplorerProfile) => void;
  updateProfile: (profile: ExplorerProfile) => void;
  depart: (destinationId: string) => void;
  cancelDeparture: () => void;
  visit: (destinationId: string, reflection?: string) => rules.VisitResult;
  discover: (key: DiscoveryKey) => boolean;
  toggleFavorite: (id: string) => void;
  saveJournal: (entry: JournalEntry) => void;
  deleteJournal: (id: string) => void;
  setPreferences: (p: Partial<UserPreferences>) => void;
  replaceAll: (s: PassportState) => void;
  reset: () => void;
  acknowledgeProblem: () => void;
}

const Ctx = createContext<Store | null>(null);

export function PassportProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => load(), []);
  const [state, setState] = useState<PassportState>(initial.state);
  const [problem, setProblem] = useState(initial.problem);
  const [queue, setQueue] = useState<Award[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const ref = useRef(state);
  ref.current = state;
  const firstSave = useRef(true);

  useEffect(() => {
    // do not overwrite unreadable data on the very first render
    if (firstSave.current) {
      firstSave.current = false;
      if (problem !== "none") return;
    }
    setSaveFailed(!save(state));
  }, [state, problem]);

  // keep two tabs of the app in step
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "internet-passport:v1") return;
      const fresh = load();
      if (fresh.problem === "none") setState(fresh.state);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback((next: PassportState, awards: Award[] = []) => {
    ref.current = next;
    setState(next);
    if (awards.length) setQueue((q) => [...q, ...awards]);
  }, []);

  const now = () => new Date().toISOString();

  const store: Store = {
    state,
    problem,
    saveFailed,
    queue,
    dismissAward: () => setQueue((q) => q.slice(1)),
    issue: (profile) => {
      const base = { ...ref.current, profile };
      const r = rules.issuePassport(base, now());
      commit(r.state, r.awards);
    },
    updateProfile: (profile) => commit({ ...ref.current, profile }),
    depart: (id) => commit(rules.depart(ref.current, id, now())),
    cancelDeparture: () => commit({ ...ref.current, departure: null }),
    visit: (id, reflection = "") => {
      const r = rules.confirmVisit(ref.current, id, now(), reflection);
      if (r.ok) commit(r.state, r.awards);
      else commit(r.state);
      return r;
    },
    discover: (key) => {
      if (ref.current.discoveries[key]) return false;
      const r = rules.recordDiscovery(ref.current, key, now());
      commit(r.state, r.awards);
      return true;
    },
    toggleFavorite: (id) => commit(rules.toggleFavorite(ref.current, id)),
    saveJournal: (entry) => {
      const r = rules.saveJournalEntry(ref.current, entry, now());
      commit(r.state, r.awards);
    },
    deleteJournal: (id) => commit(rules.deleteJournalEntry(ref.current, id)),
    setPreferences: (p) => commit({ ...ref.current, preferences: { ...ref.current.preferences, ...p } }),
    replaceAll: (s) => {
      setProblem("none");
      setQueue([]);
      commit(s);
    },
    reset: () => {
      setProblem("none");
      setQueue([]);
      commit(rules.emptyState());
    },
    acknowledgeProblem: () => {
      quarantine();
      setProblem("none");
      commit(rules.emptyState());
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function usePassport(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("usePassport outside provider");
  return s;
}

/** true when animations should be skipped */
export function useReducedMotion(): boolean {
  const { state } = usePassport();
  const [system, setSystem] = useState(() =>
    typeof matchMedia !== "undefined" ? matchMedia("(prefers-reduced-motion: reduce)").matches : false,
  );
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setSystem(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const m = state.preferences.motion;
  return m === "reduced" || (m === "system" && system);
}
