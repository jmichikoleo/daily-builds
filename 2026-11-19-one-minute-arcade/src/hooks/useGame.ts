// src/hooks/useGame.ts
// small helpers games share. one keeps a set of held keys, one rerenders a dom
// game at a capped rate instead of every frame.

import { useEffect, useReducer, useRef } from "react";
import type { Frame, GameApi } from "../engine/types";

/** keys currently held down, lowercased. cleared when the window loses focus */
export function useHeldKeys(api: GameApi, watch: string[]) {
  const held = useRef(new Set<string>());
  const watchRef = useRef(new Set(watch.map((k) => k.toLowerCase())));
  useEffect(() => {
    const w = watchRef.current;
    const h = held.current;
    const offs = [
      api.listen("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (w.has(k)) {
          e.preventDefault();
          h.add(k);
        }
      }),
      api.listen("keyup", (e) => h.delete(e.key.toLowerCase())),
      api.listen("blur", () => h.clear()),
    ];
    return () => offs.forEach((off) => off());
  }, [api]);
  return held;
}

/**
 * run `step` every frame and rerender the component at most `hz` times a second.
 * fine for dom games with a handful of elements.
 */
export function useFrameRender(api: GameApi, step: (f: Frame) => void, hz = 20) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    let acc = 0;
    return api.onFrame((f) => {
      stepRef.current(f);
      acc += f.dt;
      if (acc >= 1 / hz) {
        acc = 0;
        bump();
      }
    });
  }, [api, hz]);
  return bump;
}
