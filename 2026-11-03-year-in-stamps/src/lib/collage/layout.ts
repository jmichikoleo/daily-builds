import { r2, seededRandom } from "../stamps/random";
import type { LayoutPreset } from "../studio/types";
import type { CollageFormatId } from "./formats";
import type { Rect } from "./frame";

export type { Rect } from "./frame";

/** What the layout engine needs to know about each stamp. */
export interface LayoutItem {
  id: string;
  /** Natural width / height of the stamp artwork. */
  aspect: number;
  /** The stamp's own deterministic tilt, in degrees. */
  baseRotation: number;
}

/** A positioned stamp in canvas units. */
export interface Placement {
  id: string;
  cx: number;
  cy: number;
  /** Unrotated stamp box. */
  w: number;
  h: number;
  rotation: number;
  z: number;
  /** Minimal Archive: a caption box under the stamp. */
  caption?: { x: number; y: number; width: number };
}

export interface PageLayout {
  placements: Placement[];
  /** Passport Pages: where the "spine" between the two facing pages falls. */
  foldY?: number;
}

/** Most stamps per page before a new page starts, so stamps stay readable. */
export const PAGE_CAPACITY: Record<CollageFormatId, Record<LayoutPreset, number>> = {
  story: { scattered: 16, passport: 18, postcard: 14, archive: 12 },
  square: { scattered: 9, passport: 12, postcard: 10, archive: 9 },
};

/** Split items into pages of near-equal size (40 stamps, capacity 16 → 14 + 13 + 13). */
export function paginate<T>(items: readonly T[], capacity: number): T[][] {
  if (items.length === 0) return [[]];
  const pages = Math.ceil(items.length / capacity);
  const out: T[][] = [];
  let start = 0;
  for (let p = 0; p < pages; p++) {
    const size = Math.ceil((items.length - start) / (pages - p));
    out.push(items.slice(start, start + size));
    start += size;
  }
  return out;
}

/** Half extents of a w×h box rotated by `deg`. */
export function rotatedExtents(w: number, h: number, deg: number): { hx: number; hy: number } {
  const t = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return { hx: (w * c + h * s) / 2, hy: (w * s + h * c) / 2 };
}

/** Shrink if needed, then move the stamp so its rotated box sits fully inside `area`. */
export function containPlacement(p: Placement, area: Rect): Placement {
  let { w, h } = p;
  let { hx, hy } = rotatedExtents(w, h, p.rotation);
  const shrink = Math.min(1, area.width / (2 * hx), area.height / (2 * hy));
  if (shrink < 1) {
    w *= shrink;
    h *= shrink;
    ({ hx, hy } = rotatedExtents(w, h, p.rotation));
  }
  const cx = Math.min(area.x + area.width - hx, Math.max(area.x + hx, p.cx));
  const cy = Math.min(area.y + area.height - hy, Math.max(area.y + hy, p.cy));
  return { ...p, cx: r2(cx), cy: r2(cy), w: r2(w), h: r2(h) };
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Column count that gives the largest cells for `n` stamps of the given mean aspect. */
function bestColumns(n: number, area: Rect, aspect: number, cellPad = 1): number {
  let best = 1;
  let bestSize = 0;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = area.width / cols;
    const ch = area.height / rows;
    const size = Math.min(cw, ch * aspect * cellPad);
    if (size > bestSize) {
      bestSize = size;
      best = cols;
    }
  }
  return best;
}

/** Fit a stamp of `aspect` into a cell, using `fill` of the limiting dimension. */
function fitIn(cw: number, ch: number, aspect: number, fill: number): { w: number; h: number } {
  const w = Math.min(cw, ch * aspect) * fill;
  return { w, h: w / aspect };
}

const meanAspect = (items: readonly LayoutItem[]) => items.reduce((s, i) => s + i.aspect, 0) / Math.max(1, items.length);
const clampRot = (deg: number, max: number) => Math.max(-max, Math.min(max, deg));

/** Grid cells centred in the area, with the short last row centred too. */
function gridCells(n: number, cols: number, area: Rect, rowGap = 0) {
  const rows = Math.ceil(n / cols);
  const cw = area.width / cols;
  const ch = (area.height - rowGap) / rows;
  const cells: { cx: number; cy: number; row: number }[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const left = area.x + (area.width - inRow * cw) / 2;
    const gap = rowGap && row >= Math.ceil(rows / 2) ? rowGap : 0;
    cells.push({ cx: left + cw * (col + 0.5), cy: area.y + ch * (row + 0.5) + gap, row });
  }
  return { cells, cw, ch, rows };
}

// ── 1. Scattered Memories ───────────────────────────────────────────────

function scattered(items: readonly LayoutItem[], area: Rect, rand: () => number): PageLayout {
  const order = shuffled(items, rand);
  const cols = bestColumns(order.length, area, meanAspect(order));
  const { cells, cw, ch } = gridCells(order.length, cols, area);
  const layers = shuffled(order.map((_, i) => i), rand);
  const placements = order.map((item, i) => {
    const cell = cells[i];
    const size = fitIn(cw, ch, item.aspect, 0.8 + rand() * 0.12);
    const stagger = cols > 1 && cell.row % 2 === 1 ? (rand() < 0.5 ? -1 : 1) * cw * 0.12 : 0;
    return {
      id: item.id,
      cx: cell.cx + stagger + (rand() - 0.5) * cw * 0.2,
      cy: cell.cy + (rand() - 0.5) * ch * 0.2,
      ...size,
      rotation: r2(clampRot(item.baseRotation * 1.3 + (rand() - 0.5) * 6, 12)),
      z: layers[i],
    };
  });
  return { placements };
}

// ── 2. Passport Pages ───────────────────────────────────────────────────

function passport(items: readonly LayoutItem[], area: Rect, rand: () => number): PageLayout {
  const order = shuffled(items, rand);
  const cols = bestColumns(order.length, area, meanAspect(order), 0.95);
  const rows = Math.ceil(order.length / cols);
  // Two facing pages once there are enough rows; the gap is the passport's spine.
  const spine = rows >= 2 ? Math.min(48, area.height * 0.05) : 0;
  const { cells, cw, ch } = gridCells(order.length, cols, area, spine);
  const placements = order.map((item, i) => {
    const cell = cells[i];
    return {
      id: item.id,
      cx: cell.cx + (rand() - 0.5) * cw * 0.05,
      cy: cell.cy + (rand() - 0.5) * ch * 0.05,
      ...fitIn(cw, ch, item.aspect, 0.84),
      rotation: r2(clampRot(item.baseRotation * 0.45, 4)),
      z: i,
    };
  });
  const firstLower = cells.find((c) => c.row === Math.ceil(rows / 2));
  const foldY = spine && firstLower ? firstLower.cy - ch / 2 - spine / 2 : undefined;
  return { placements, foldY };
}

// ── 3. Postcard Wall ────────────────────────────────────────────────────

function postcard(items: readonly LayoutItem[], area: Rect, rand: () => number): PageLayout {
  const order = shuffled(items, rand);
  const n = order.length;
  const heroes = n <= 1 ? 0 : n <= 4 ? 1 : n <= 9 ? 2 : 3;
  const aspect = meanAspect(order);

  // Find a grid with room for heroes (2×2 cells each) plus the rest.
  let cols = bestColumns(n + heroes * 3, area, aspect);
  let rows = Math.ceil((n + heroes * 3) / cols);
  if (cols < 2 && heroes) cols = 2;
  rows = Math.max(rows, heroes ? 2 : 1);

  for (let attempt = 0; attempt < 4; attempt++) {
    const grid: boolean[][] = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
    const spans: { r: number; c: number; size: number }[] = [];
    const free = (r: number, c: number, size: number) => {
      if (r + size > rows || c + size > cols) return false;
      for (let i = r; i < r + size; i++) for (let j = c; j < c + size; j++) if (grid[i][j]) return false;
      return true;
    };
    const take = (r: number, c: number, size: number) => {
      for (let i = r; i < r + size; i++) for (let j = c; j < c + size; j++) grid[i][j] = true;
      spans.push({ r, c, size });
    };
    // Heroes go to seeded positions first, everything else fills in reading order.
    let ok = true;
    for (let h = 0; h < heroes && ok; h++) {
      const options: [number, number][] = [];
      for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) if (free(r, c, 2)) options.push([r, c]);
      if (!options.length) ok = false;
      else take(...options[Math.floor(rand() * options.length)], 2);
    }
    for (let k = heroes; k < n && ok; k++) {
      let placed = false;
      for (let r = 0; r < rows && !placed; r++)
        for (let c = 0; c < cols && !placed; c++)
          if (free(r, c, 1)) {
            take(r, c, 1);
            placed = true;
          }
      if (!placed) ok = false;
    }
    if (!ok) {
      rows += 1; // not enough room for this hero arrangement — add a row and retry
      continue;
    }
    // Spans come back in placement order: heroes first, then singles in reading order.
    const cw = area.width / cols;
    const usedRows = Math.max(...spans.map((s) => s.r + s.size));
    const ch = area.height / usedRows;
    const placements = order.map((item, i) => {
      const s = spans[i];
      const hero = s.size === 2;
      return {
        id: item.id,
        cx: area.x + cw * (s.c + s.size / 2) + (rand() - 0.5) * cw * 0.1,
        cy: area.y + ch * (s.r + s.size / 2) + (rand() - 0.5) * ch * 0.1,
        ...fitIn(cw * s.size, ch * s.size, item.aspect, hero ? 0.9 : 0.86),
        rotation: r2(clampRot((rand() - 0.5) * 8 + item.baseRotation * 0.3, 6)),
        z: hero ? 0 : i + 1,
      };
    });
    return { placements };
  }
  return scattered(items, area, rand);
}

// ── 4. Minimal Archive ──────────────────────────────────────────────────

function archive(items: readonly LayoutItem[], area: Rect, rand: () => number): PageLayout {
  const order = shuffled(items, rand);
  // Leave room under each stamp for a two-line caption.
  const cols = bestColumns(order.length, area, meanAspect(order) * 1.35);
  const { cells, cw, ch } = gridCells(order.length, cols, area);
  const captionH = Math.min(56, ch * 0.24);
  const placements = order.map((item, i) => {
    const cell = cells[i];
    const size = fitIn(cw * 0.82, (ch - captionH) * 0.86, item.aspect, 1);
    const top = cell.cy - ch / 2;
    const cy = top + (ch - captionH) / 2;
    return {
      id: item.id,
      cx: cell.cx,
      cy,
      ...size,
      rotation: 0,
      z: i,
      caption: { x: cell.cx, y: cy + size.h / 2 + captionH * 0.42, width: cw * 0.86 },
    };
  });
  return { placements };
}

const ENGINES: Record<LayoutPreset, (items: readonly LayoutItem[], area: Rect, rand: () => number) => PageLayout> = {
  scattered,
  passport,
  postcard,
  archive,
};

/**
 * Lay out one page. Deterministic: the same items, area, preset and seed give
 * the same result. Every stamp's rotated box is kept inside `area`, which
 * already excludes the title and footer.
 */
export function layoutPage(preset: LayoutPreset, items: readonly LayoutItem[], area: Rect, seed: string): PageLayout {
  if (items.length === 0) return { placements: [] };
  const page = ENGINES[preset](items, area, seededRandom(`${preset}|${seed}`));
  const placements = page.placements.map((p) => {
    const contained = containPlacement(p, area);
    if (!p.caption) return contained;
    return { ...contained, caption: { ...p.caption, x: r2(contained.cx), y: r2(Math.min(area.y + area.height - 4, contained.cy + contained.h / 2 + (p.caption.y - p.cy - p.h / 2))) } };
  });
  return { ...page, placements };
}
