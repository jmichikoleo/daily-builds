// src/games/star-catcher/logic.ts
// the rules of star catcher, kept free of drawing so they are easy to test.

export const W = 480;
export const H = 640;
export const BASKET_W = 92;
export const BASKET_H = 34;
export const BASKET_Y = H - 70;
export const BASKET_SPEED = 470; // px per second with keys

export type StarKind = "gold" | "blue" | "red" | "rainbow";

export const STARS: Record<StarKind, { points: number; color: string; label: string }> = {
  gold: { points: 10, color: "#ffd23f", label: "golden" },
  blue: { points: 25, color: "#5ab8ff", label: "blue" },
  red: { points: -15, color: "#ff4f5e", label: "red" },
  rainbow: { points: 50, color: "#ffffff", label: "rainbow" },
};

export interface Difficulty {
  /** seconds between new stars */
  spawnEvery: number;
  /** pixels per second */
  fall: number;
  /** do stars swerve sideways */
  wobble: boolean;
  /** chance of each kind, roughly */
  weights: Record<StarKind, number>;
}

/** the four acts of star catcher. t is seconds of play */
export function difficultyAt(t: number, urgent = false): Difficulty {
  let d: Difficulty;
  if (t < 15) d = { spawnEvery: 0.85, fall: 135, wobble: false, weights: { gold: 70, blue: 18, red: t < 4 ? 0 : 9, rainbow: 3 } };
  else if (t < 30) d = { spawnEvery: 0.5, fall: 150, wobble: false, weights: { gold: 60, blue: 20, red: 15, rainbow: 5 } };
  else if (t < 45) d = { spawnEvery: 0.48, fall: 235, wobble: false, weights: { gold: 55, blue: 20, red: 19, rainbow: 6 } };
  else d = { spawnEvery: 0.42, fall: 255, wobble: true, weights: { gold: 50, blue: 21, red: 22, rainbow: 7 } };
  if (urgent) d = { ...d, fall: d.fall * 1.12, spawnEvery: d.spawnEvery * 0.9 };
  return d;
}

export function pickKind(weights: Record<StarKind, number>, r: number): StarKind {
  const kinds = Object.keys(weights) as StarKind[];
  const total = kinds.reduce((n, k) => n + weights[k], 0);
  let x = r * total;
  for (const k of kinds) {
    if (x < weights[k]) return k;
    x -= weights[k];
  }
  return "gold";
}

export interface Star {
  kind: StarKind;
  x: number;
  y: number;
  baseX: number;
  vy: number;
  r: number;
  wobble: number; // sideways amplitude
  phase: number;
  age: number;
}

/** is the star inside the basket's mouth this frame */
export function isCaught(star: Pick<Star, "x" | "y" | "r">, basketX: number): boolean {
  const top = BASKET_Y - 6;
  const inX = star.x >= basketX - BASKET_W / 2 - star.r * 0.4 && star.x <= basketX + BASKET_W / 2 + star.r * 0.4;
  const inY = star.y + star.r >= top && star.y - star.r <= top + BASKET_H * 0.6;
  return inX && inY;
}

export function clampBasket(x: number) {
  return Math.max(BASKET_W / 2, Math.min(W - BASKET_W / 2, x));
}
