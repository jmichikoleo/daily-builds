// src/games/ghost-hunt/logic.ts
// ghosts peek out of hiding spots, sometimes hop to another one, and a few
// faceless sheets of laundry try to trick you.

import { lerp } from "../../engine/random";

export const SPOTS = ["wardrobe", "bed", "lamp", "curtain", "bookshelf", "toy chest", "painting", "armchair"] as const;
export type SpotId = (typeof SPOTS)[number];

export type Kind = "ghost" | "rare" | "decoy";

export interface Spook {
  id: number;
  kind: Kind;
  spot: number;
  t: number;
  life: number;
  alpha: number;
  /** a ghost that will hop to another spot instead of vanishing */
  hops: number;
}

export interface Haunt {
  spooks: Spook[];
  ghostIn: number;
  decoyIn: number;
  nextId: number;
  streak: number;
  found: number;
}

export const POINTS = { ghost: 10, rare: 30, wrong: -5 };

export function newHaunt(): Haunt {
  return { spooks: [], ghostIn: 0.6, decoyIn: 5, nextId: 1, streak: 0, found: 0 };
}

/** bonus on top of a ghost's points for a streak of correct taps */
export function comboBonus(streak: number) {
  return Math.min(15, 5 * Math.floor(streak / 3));
}

export function hauntAt(progress: number, urgent = false) {
  return {
    showFor: lerp(1.7, 0.8, progress) * (urgent ? 0.85 : 1),
    ghostEvery: lerp(1.15, 0.5, progress),
    maxGhosts: Math.round(lerp(1, 3, progress)),
    decoyEvery: lerp(6, 2.2, progress),
    maxDecoys: Math.round(lerp(0, 3, progress)),
    hopChance: lerp(0, 0.5, progress),
    fadeChance: progress < 0.4 ? 0 : lerp(0, 0.6, progress),
  };
}

function freeSpot(h: Haunt, rng: () => number, avoid = -1): number | null {
  const used = new Set(h.spooks.map((s) => s.spot));
  const free = SPOTS.map((_, i) => i).filter((i) => !used.has(i) && i !== avoid);
  if (!free.length) return null;
  return free[Math.floor(rng() * free.length) % free.length];
}

export type HauntEvent = { type: "appear"; kind: Kind } | { type: "hop" };

export function stepHaunt(h: Haunt, dt: number, progress: number, urgent = false, rng: () => number = Math.random): HauntEvent[] {
  const ev: HauntEvent[] = [];
  const cfg = hauntAt(progress, urgent);
  for (let i = h.spooks.length - 1; i >= 0; i--) {
    const s = h.spooks[i];
    s.t += dt;
    if (s.t >= s.life) {
      if (s.kind !== "decoy" && s.hops > 0) {
        const to = freeSpot(h, rng, s.spot);
        if (to !== null) {
          s.spot = to;
          s.t = 0;
          s.hops--;
          s.life = cfg.showFor;
          ev.push({ type: "hop" });
          continue;
        }
      }
      h.spooks.splice(i, 1);
    }
  }
  const ghosts = h.spooks.filter((s) => s.kind !== "decoy").length;
  const decoys = h.spooks.length - ghosts;
  h.ghostIn -= dt;
  if (h.ghostIn <= 0) {
    h.ghostIn = cfg.ghostEvery * (0.7 + rng() * 0.6);
    const spot = ghosts < cfg.maxGhosts ? freeSpot(h, rng) : null;
    if (spot !== null) {
      const rare = rng() < 0.09;
      h.spooks.push({
        id: h.nextId++,
        kind: rare ? "rare" : "ghost",
        spot,
        t: 0,
        life: cfg.showFor * (rare ? 0.75 : 1),
        alpha: rng() < cfg.fadeChance ? 0.45 : 1,
        hops: rng() < cfg.hopChance ? 1 + Math.floor(rng() * 2) : 0,
      });
      ev.push({ type: "appear", kind: rare ? "rare" : "ghost" });
    }
  }
  h.decoyIn -= dt;
  if (h.decoyIn <= 0) {
    h.decoyIn = cfg.decoyEvery * (0.7 + rng() * 0.6);
    const spot = decoys < cfg.maxDecoys ? freeSpot(h, rng) : null;
    if (spot !== null) {
      h.spooks.push({ id: h.nextId++, kind: "decoy", spot, t: 0, life: 2 + rng() * 1.5, alpha: 1, hops: 0 });
      ev.push({ type: "appear", kind: "decoy" });
    }
  }
  return ev;
}

export type TapResult = { kind: "ghost" | "rare"; delta: number; bonus: number } | { kind: "decoy" | "empty"; delta: number };

/** tap a hiding spot. mutates the haunt and returns what was there */
export function tapSpot(h: Haunt, spot: number): TapResult {
  const i = h.spooks.findIndex((s) => s.spot === spot);
  const s = i >= 0 ? h.spooks[i] : null;
  if (!s || s.kind === "decoy") {
    h.streak = 0;
    if (s) h.spooks.splice(i, 1);
    return { kind: s ? "decoy" : "empty", delta: POINTS.wrong };
  }
  h.spooks.splice(i, 1);
  h.streak++;
  h.found++;
  const bonus = comboBonus(h.streak);
  return { kind: s.kind, delta: (s.kind === "rare" ? POINTS.rare : POINTS.ghost) + bonus, bonus };
}
