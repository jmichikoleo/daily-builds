// src/engine/debug.ts
// a tiny counter of live loops and listeners. tests read window.__oma to make
// sure switching games leaves nothing running behind.

export interface DebugState {
  loops: number;
  listeners: number;
  phase: string;
  score: number;
}

export const debug: DebugState = { loops: 0, listeners: 0, phase: "none", score: 0 };

if (typeof window !== "undefined") {
  (window as unknown as { __oma: DebugState }).__oma = debug;
}
