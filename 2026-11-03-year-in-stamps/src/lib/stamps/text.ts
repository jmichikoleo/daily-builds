import { r2 } from "./random";

/**
 * Text fitting for SVG stamps without measuring in the DOM (so it is
 * deterministic on server and client). Widths are estimated from an average
 * glyph width per typeface; when even the minimum size would overflow, the
 * caller gets a `textLength` to compress the line instead of clipping it.
 */
export const GLYPH_WIDTH = {
  /** Oswald, uppercase. */
  stamp: 0.58,
  /** Fraunces, mixed case. */
  serif: 0.52,
  /** DM Mono. */
  mono: 0.62,
} as const;

export interface FitOptions {
  maxWidth: number;
  maxSize: number;
  minSize: number;
  glyph: number;
  letterSpacing?: number;
}

export interface FittedLine {
  text: string;
  size: number;
  /** Set when the line must be compressed to this width to fit. */
  textLength?: number;
}

function sizeFor(text: string, { maxWidth, glyph, letterSpacing = 0 }: FitOptions): number {
  const n = Math.max(1, text.length);
  return (maxWidth / n - letterSpacing) / glyph;
}

/** Round down so a fitted size never overshoots its box. */
const floor2 = (n: number) => Math.floor(n * 100) / 100;

export function fitLine(text: string, opts: FitOptions): FittedLine {
  const ideal = sizeFor(text, opts);
  if (ideal >= opts.minSize) return { text, size: floor2(Math.min(opts.maxSize, ideal)) };
  return { text, size: opts.minSize, textLength: r2(opts.maxWidth) };
}

/** Candidate break points: after spaces, hyphens, en dashes and slashes. */
function splitIntoTwo(text: string): [string, string] | null {
  let best: [string, string] | null = null;
  let bestLongest = Infinity;
  for (let i = 1; i < text.length - 1; i++) {
    const ch = text[i];
    let first: string;
    let second: string;
    if (ch === " ") {
      first = text.slice(0, i);
      second = text.slice(i + 1);
    } else if (ch === "-" || ch === "–" || ch === "/") {
      first = text.slice(0, i + 1);
      second = text.slice(i + 1).trimStart();
    } else continue;
    first = first.trimEnd();
    if (!first || !second) continue;
    const longest = Math.max(first.length, second.length);
    if (longest < bestLongest) {
      bestLongest = longest;
      best = [first, second];
    }
  }
  return best;
}

export interface FittedBlock {
  lines: FittedLine[];
  size: number;
  /** Distance between baselines. */
  lineHeight: number;
}

/**
 * Fit a name into a box of `maxWidth × maxHeight`, on one line or two,
 * whichever allows the larger type. Uppercase cap height is ~0.72em.
 */
export function fitBlock(text: string, opts: FitOptions & { maxHeight: number; maxLines?: 1 | 2 }): FittedBlock {
  const capHeight = 0.74;
  const pitch = 1.02;
  const single = fitLine(text, { ...opts, maxSize: Math.min(opts.maxSize, opts.maxHeight / capHeight) });
  const pair = opts.maxLines === 1 ? null : splitIntoTwo(text);
  if (pair && (single.textLength || single.size < opts.maxSize * 0.8)) {
    const heightCap = opts.maxHeight / (capHeight + pitch);
    const longest = pair[0].length >= pair[1].length ? pair[0] : pair[1];
    const fitted = fitLine(longest, { ...opts, maxSize: Math.min(opts.maxSize, heightCap) });
    const size = fitted.size;
    if (size > single.size * 1.1 || single.textLength) {
      const lines = pair.map((t) => {
        const own = fitLine(t, { ...opts, maxSize: size });
        return own.textLength ? own : { text: t, size };
      });
      return { lines, size, lineHeight: r2(size * pitch) };
    }
  }
  return { lines: [single], size: single.size, lineHeight: r2(single.size * pitch) };
}
