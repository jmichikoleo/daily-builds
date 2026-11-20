// src/games/wrong-delivery/logic.ts
// packages, doors and the combo maths.

import { lerp } from "../../engine/random";

export type Category = "food" | "space" | "magic";
export const CATEGORIES: Category[] = ["food", "space", "magic"];

export const CATEGORY_INFO: Record<Category, { door: number; key: string; color: string; name: string }> = {
  food: { door: 0, key: "1", color: "#ff5a5f", name: "food" },
  space: { door: 1, key: "2", color: "#4aa8ff", name: "space" },
  magic: { door: 2, key: "3", color: "#8b5cf6", name: "magic" },
};

export const ODD_PACKAGES: Record<Category, string[]> = {
  food: [
    "a sandwich with strong opinions",
    "soup. just soup. no container",
    "one extremely confident potato",
    "a cake that keeps whispering happy birthday",
    "spaghetti, tangled on purpose",
  ],
  space: [
    "a jar of slightly used moon dust",
    "a tiny astronaut asking for directions",
    "a comet, gift wrapped, still warm",
    "a black hole. handle with care. or do not",
    "one planet, some assembly required",
  ],
  magic: [
    "a hat that sneezes rabbits",
    "a wand with a low battery",
    "a cloak of mild invisibility",
    "a potion labelled do not shake. it is shaking",
    "a crystal ball showing this exact moment",
  ],
};

export const PLAIN_NAMES: Record<Category, string[]> = {
  food: ["groceries", "a fruit box", "lunch"],
  space: ["rocket parts", "star charts", "a telescope"],
  magic: ["spell books", "a box of wands", "potions"],
};

export const POINTS = { correct: 10, wrong: -5, missed: -3, comboEvery: 5, maxMultiplier: 4 };

export function multiplierFor(streak: number): number {
  if (streak <= 0) return 1;
  return Math.min(POINTS.maxMultiplier, 1 + Math.floor((streak - 1) / POINTS.comboEvery));
}

export interface Sorter {
  streak: number;
}

/** score one delivery. mutates the streak and returns the points */
export function deliver(s: Sorter, pkg: Category, door: Category): { delta: number; correct: boolean; multiplier: number } {
  if (pkg === door) {
    s.streak++;
    const multiplier = multiplierFor(s.streak);
    return { delta: POINTS.correct * multiplier, correct: true, multiplier };
  }
  s.streak = 0;
  return { delta: POINTS.wrong, correct: false, multiplier: 1 };
}

export function miss(s: Sorter): number {
  s.streak = 0;
  return POINTS.missed;
}

/** belt speed in px per second and seconds between packages */
export function beltAt(progress: number, urgent = false) {
  const k = urgent ? 1.15 : 1;
  return { speed: lerp(70, 165, progress) * k, every: lerp(1.75, 0.75, progress) / k, oddChance: lerp(0.12, 0.4, progress) };
}

export function categoryForDoorKey(key: string): Category | null {
  return CATEGORIES.find((c) => CATEGORY_INFO[c].key === key) ?? null;
}
