// src/engine/random.ts
// picks a random game, avoiding the one you just played when there is a choice.

export function pickRandomGame(ids: readonly string[], lastId: string | null, rng: () => number = Math.random): string {
  if (ids.length === 0) throw new Error("no games to pick from");
  const pool = ids.length > 1 && lastId ? ids.filter((id) => id !== lastId) : [...ids];
  const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[i];
}

/** a small seeded random number generator, handy for tests and level layouts */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** linear ramp from a to b as p goes 0..1 */
export const lerp = (a: number, b: number, p: number) => a + (b - a) * Math.max(0, Math.min(1, p));
