// src/games/frog-traffic/logic.ts
// lanes of drifting lily pads. generation is constrained so every crossing
// can actually be made. no lane has a gap wider than a frog can wait out,
// pads are always longer than the frog and neighbouring lanes drift in
// opposite directions so a pad always comes along eventually.

export const W = 480;
export const H = 640;
export const ROWS = 9; // 0 is the near bank, ROWS - 1 the far bank
export const ROW_H = H / ROWS;
export const FROG_R = 17;
export const HOP_X = 56;
export const HOP_TIME = 0.15;
export const WRAP = W + 240; // pads loop over this length
export const MIN_PAD = 74;
export const MAX_GAP = 165;
export const MIN_GAP = 40;
export const MAX_SPEED = 150;

export interface Pad {
  offset: number; // position along the loop
  len: number;
  sinks: boolean;
  sinkPhase: number; // seconds into its sink cycle
}

export interface Lane {
  row: number;
  dir: 1 | -1;
  speed: number;
  shift: number;
  pads: Pad[];
}

export const SINK_CYCLE = 5.2;
export const SINK_WARN = 1.1;
export const SINK_DOWN = 1.2;

/** 0 normal, 1 wobbling, 2 under water */
export function sinkState(p: Pad): 0 | 1 | 2 {
  if (!p.sinks) return 0;
  const t = p.sinkPhase % SINK_CYCLE;
  const downAt = SINK_CYCLE - SINK_DOWN;
  if (t >= downAt) return 2;
  if (t >= downAt - SINK_WARN) return 1;
  return 0;
}

export function rowY(row: number) {
  return H - (row + 0.5) * ROW_H;
}

/** build the water lanes for a level. level starts at 1 */
export function makeLanes(level: number, rng: () => number): Lane[] {
  const lanes: Lane[] = [];
  const firstDir: 1 | -1 = rng() < 0.5 ? 1 : -1;
  for (let row = 1; row < ROWS - 1; row++) {
    const dir = ((row % 2 === 1 ? 1 : -1) * firstDir) as 1 | -1;
    const speed = Math.min(MAX_SPEED, 38 + level * 11 + rng() * 26);
    const padMax = Math.max(MIN_PAD + 10, 150 - level * 9);
    const gapMax = Math.min(MAX_GAP, 95 + level * 12);
    const pads: Pad[] = [];
    let x = rng() * 60;
    let sinkingPlaced = 0;
    while (true) {
      const len = MIN_PAD + rng() * (padMax - MIN_PAD);
      if (x + len > WRAP) break;
      const sinks = level >= 2 && sinkingPlaced < Math.min(2, level - 1) && rng() < 0.35;
      if (sinks) sinkingPlaced++;
      pads.push({ offset: x, len, sinks, sinkPhase: rng() * SINK_CYCLE });
      x += len + MIN_GAP + rng() * (gapMax - MIN_GAP);
    }
    // close the loop so the wrap gap respects the limit too
    const first = pads[0];
    const last = pads[pads.length - 1];
    const lastEnd = last.offset + last.len;
    const wrapGap = WRAP - lastEnd + first.offset;
    if (wrapGap > MAX_GAP) {
      const len = Math.min(padMax, Math.max(MIN_PAD, wrapGap - 2 * MIN_GAP));
      pads.push({ offset: lastEnd + (wrapGap - len) / 2, len, sinks: false, sinkPhase: 0 });
    }
    // never let every pad in a lane sink
    if (pads.every((p) => p.sinks)) pads[0].sinks = false;
    lanes.push({ row, dir, speed, shift: 0, pads });
  }
  return lanes;
}

/** gaps between consecutive pads, including the wrap around gap */
export function laneGaps(lane: Lane): number[] {
  const ps = [...lane.pads].sort((a, b) => a.offset - b.offset);
  const gaps: number[] = [];
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i];
    const b = ps[(i + 1) % ps.length];
    const end = a.offset + a.len;
    gaps.push(i === ps.length - 1 ? WRAP - end + b.offset : b.offset - end);
  }
  return gaps;
}

/** the check the tests run on every generated level */
export function isCrossable(lanes: Lane[]): boolean {
  for (let i = 0; i < lanes.length; i++) {
    const l = lanes[i];
    if (l.pads.length < 2) return false;
    if (l.speed > MAX_SPEED || l.speed <= 0) return false;
    if (l.pads.some((p) => p.len < MIN_PAD)) return false;
    if (laneGaps(l).some((g) => g > MAX_GAP + 0.001)) return false;
    if (l.pads.every((p) => p.sinks)) return false;
    if (i > 0 && lanes[i - 1].dir === l.dir) return false;
  }
  return true;
}

/** where a pad's left edge is on screen right now */
export function padX(lane: Lane, pad: Pad): number {
  const raw = pad.offset + lane.shift * lane.dir;
  const m = ((raw % WRAP) + WRAP) % WRAP;
  return m - 120;
}

/** a pad near the loop seam shows up on both sides, so check both copies */
export function padLefts(lane: Lane, pad: Pad): [number, number] {
  const left = padX(lane, pad);
  return [left, left - WRAP];
}

/** the pad under x in this lane, if it can hold a frog. returns the pad and its left edge */
export function padAt(lane: Lane, x: number, tolerance = 6): { pad: Pad; left: number } | null {
  for (const p of lane.pads) {
    if (sinkState(p) === 2) continue;
    for (const left of padLefts(lane, p)) {
      if (x >= left - tolerance && x <= left + p.len + tolerance) return { pad: p, left };
    }
  }
  return null;
}

export const POINTS = { newRow: 5, crossing: 40, perLevel: 10 };
export const crossingBonus = (level: number) => POINTS.crossing + POINTS.perLevel * (level - 1);
