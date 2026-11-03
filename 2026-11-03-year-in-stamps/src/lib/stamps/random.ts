/** FNV-1a 32-bit hash. Same input → same number, on server and client. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic pseudo-random generator (mulberry32) seeded from a string. */
export function seededRandom(seed: string): () => number {
  let s = hashString(seed) || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Round to 2 decimals so SVG attribute strings match exactly on server and client. */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
