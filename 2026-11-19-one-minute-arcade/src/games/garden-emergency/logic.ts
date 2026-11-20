// src/games/garden-emergency/logic.ts
// a twelve plot garden. needs pop up over time, but never more at once than a
// person can reasonably handle, and that cap only rises slowly.

import { lerp } from "../../engine/random";

export const COLS = 4;
export const ROWS = 3;
export const PLOTS = COLS * ROWS;

export type Tool = "water" | "glove" | "sun";
export const TOOLS: Tool[] = ["water", "glove", "sun"];

export type PlotState =
  | { kind: "empty"; t: number } // regrows after a moment
  | { kind: "sprout" }
  | { kind: "thirsty"; t: number; limit: number; was: "sprout" | "bud" }
  | { kind: "bud"; t: number; limit: number }
  | { kind: "bloom"; t: number }
  | { kind: "weed"; t: number }
  | { kind: "wilted"; t: number };

export interface Garden {
  plots: PlotState[];
  eventIn: number;
  blooms: number;
  saves: number;
  weedsPulled: number;
  wilted: number;
}

export const POINTS = { bloom: 20, save: 10, weed: 5 };
export const REGROW = 1.4;
export const WILT_TIME = 4.5;
export const BLOOM_SHOW = 1.4;
export const WEED_SPREAD = 7;

export function newGarden(): Garden {
  const plots: PlotState[] = Array.from({ length: PLOTS }, () => ({ kind: "sprout" }) as PlotState);
  return { plots, eventIn: 1.2, blooms: 0, saves: 0, weedsPulled: 0, wilted: 0 };
}

export const isNeed = (p: PlotState) => p.kind === "thirsty" || p.kind === "bud" || p.kind === "weed";

export function needCount(g: Garden) {
  return g.plots.filter(isNeed).length;
}

/** how many plots may ask for help at the same time */
export function maxNeeds(progress: number) {
  return Math.floor(lerp(2, 6.4, progress));
}

export function pace(progress: number, urgent = false) {
  return {
    every: lerp(2.1, 0.75, progress) * (urgent ? 0.85 : 1),
    thirstLimit: lerp(7.5, 4.6, progress),
    budLimit: lerp(12, 8, progress),
  };
}

export type GardenEvent = { type: "need"; plot: number; kind: "thirsty" | "bud" | "weed" } | { type: "wilt"; plot: number } | { type: "spread"; plot: number };

export function neighbours(i: number) {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const out: number[] = [];
  if (r > 0) out.push(i - COLS);
  if (r < ROWS - 1) out.push(i + COLS);
  if (c > 0) out.push(i - 1);
  if (c < COLS - 1) out.push(i + 1);
  return out;
}

export function stepGarden(g: Garden, dt: number, progress: number, urgent = false, rng: () => number = Math.random): GardenEvent[] {
  const ev: GardenEvent[] = [];
  const p = pace(progress, urgent);
  g.plots.forEach((s, i) => {
    switch (s.kind) {
      case "empty":
        s.t += dt;
        if (s.t >= REGROW) g.plots[i] = { kind: "sprout" };
        break;
      case "thirsty":
        s.t += dt;
        if (s.t >= s.limit) {
          g.plots[i] = { kind: "wilted", t: 0 };
          g.wilted++;
          ev.push({ type: "wilt", plot: i });
        }
        break;
      case "bud":
        s.t += dt;
        // a bud left too long in the shade gets thirsty
        if (s.t >= s.limit) g.plots[i] = { kind: "thirsty", t: 0, limit: p.thirstLimit, was: "bud" };
        break;
      case "bloom":
        s.t += dt;
        if (s.t >= BLOOM_SHOW) g.plots[i] = { kind: "sprout" };
        break;
      case "wilted":
        s.t += dt;
        if (s.t >= WILT_TIME) g.plots[i] = { kind: "empty", t: 0 };
        break;
      case "weed":
        s.t += dt;
        if (s.t >= WEED_SPREAD) {
          s.t = 0;
          const targets = neighbours(i).filter((n) => g.plots[n].kind === "sprout" || g.plots[n].kind === "empty");
          if (targets.length) {
            const n = targets[Math.floor(rng() * targets.length) % targets.length];
            g.plots[n] = { kind: "weed", t: 0 };
            ev.push({ type: "spread", plot: n });
          }
        }
        break;
      default:
        break;
    }
  });

  g.eventIn -= dt;
  if (g.eventIn <= 0) {
    g.eventIn = p.every * (0.75 + rng() * 0.5);
    if (needCount(g) < maxNeeds(progress)) {
      const roll = rng();
      const kind: "thirsty" | "bud" | "weed" = roll < 0.4 ? "thirsty" : roll < 0.75 ? "bud" : "weed";
      const pool = g.plots.map((s, i) => ({ s, i })).filter(({ s }) => (kind === "weed" ? s.kind === "sprout" || s.kind === "empty" : s.kind === "sprout"));
      if (pool.length) {
        const { i } = pool[Math.floor(rng() * pool.length) % pool.length];
        if (kind === "thirsty") g.plots[i] = { kind: "thirsty", t: 0, limit: p.thirstLimit, was: "sprout" };
        else if (kind === "bud") g.plots[i] = { kind: "bud", t: 0, limit: p.budLimit };
        else g.plots[i] = { kind: "weed", t: 0 };
        ev.push({ type: "need", plot: i, kind });
      }
    }
  }
  return ev;
}

/** use a tool on a plot. returns the points earned, or null when the tool does nothing there */
export function applyTool(g: Garden, i: number, tool: Tool): number | null {
  const s = g.plots[i];
  if (tool === "water" && s.kind === "thirsty") {
    g.plots[i] = s.was === "bud" ? { kind: "bud", t: 0, limit: 6 } : { kind: "sprout" };
    g.saves++;
    return POINTS.save;
  }
  if (tool === "glove" && s.kind === "weed") {
    g.plots[i] = { kind: "empty", t: 0 };
    g.weedsPulled++;
    return POINTS.weed;
  }
  if (tool === "sun" && s.kind === "bud") {
    g.plots[i] = { kind: "bloom", t: 0 };
    g.blooms++;
    return POINTS.bloom;
  }
  return null;
}

/** the tool a plot is asking for, used for hints and the screen reader label */
export function toolFor(s: PlotState): Tool | null {
  if (s.kind === "thirsty") return "water";
  if (s.kind === "weed") return "glove";
  if (s.kind === "bud") return "sun";
  return null;
}
