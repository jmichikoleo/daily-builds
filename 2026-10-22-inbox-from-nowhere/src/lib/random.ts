/** Small, seedable PRNG (mulberry32) so roast generation is testable. */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickIndex(rng: Rng, length: number): number {
  return Math.floor(rng() * length);
}

/** Deterministic 32-bit string hash (FNV-1a). */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function makeId(prefix: string, rng: Rng = Math.random): string {
  const rand = Math.floor(rng() * 0xffffffff).toString(36);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}
