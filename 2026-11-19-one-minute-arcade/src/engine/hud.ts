// src/engine/hud.ts
// a tiny external store for the numbers on screen (score, time, countdown).
// the hud subscribes to it, so the game itself never rerenders when they change.

import { useSyncExternalStore } from "react";

export interface HudState {
  score: number;
  remainingMs: number;
  urgent: boolean;
  countdown: string | null;
  pop: { id: number; delta: number } | null;
}

export function createHud(initial: HudState) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<HudState>) {
      state = { ...state, ...patch };
      subs.forEach((s) => s());
    },
    subscribe(cb: () => void) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

export type Hud = ReturnType<typeof createHud>;

export function useHud(hud: Hud) {
  return useSyncExternalStore(hud.subscribe, hud.get);
}
