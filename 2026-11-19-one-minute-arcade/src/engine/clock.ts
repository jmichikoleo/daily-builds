// src/engine/clock.ts
// the one and only game timer. it counts active play time from real timestamps,
// never from frame counts. pausing freezes it. long gaps between ticks (a hidden
// tab, a frozen laptop) only count a little, so nobody loses their minute.

export const GAME_DURATION_MS = 60_000;
/** the longest gap between two ticks that still counts as real play time */
export const MAX_TICK_GAP_MS = 250;
/** physics never sees a step longer than this, in seconds */
export const MAX_DT_S = 0.05;

export interface Tick {
  /** seconds to advance the simulation, capped */
  dt: number;
  elapsedMs: number;
  remainingMs: number;
  done: boolean;
}

export class SessionClock {
  private elapsed = 0;
  private last: number | null = null;
  private running = false;
  readonly duration: number;

  constructor(duration = GAME_DURATION_MS) {
    this.duration = duration;
  }

  start(now: number) {
    this.elapsed = 0;
    this.last = now;
    this.running = true;
  }

  pause() {
    this.running = false;
    this.last = null;
  }

  resume(now: number) {
    if (this.elapsed >= this.duration) return;
    this.running = true;
    this.last = now;
  }

  get isRunning() {
    return this.running;
  }

  get elapsedMs() {
    return this.elapsed;
  }

  get remainingMs() {
    return Math.max(0, this.duration - this.elapsed);
  }

  tick(now: number): Tick {
    if (!this.running || this.last === null) {
      return { dt: 0, elapsedMs: this.elapsed, remainingMs: this.remainingMs, done: this.elapsed >= this.duration };
    }
    let gap = now - this.last;
    this.last = now;
    if (gap < 0) gap = 0;
    if (gap > MAX_TICK_GAP_MS) gap = MAX_DT_S * 1000; // treat as an interruption
    const before = this.elapsed;
    this.elapsed = Math.min(this.duration, this.elapsed + gap);
    const advanced = this.elapsed - before;
    const done = this.elapsed >= this.duration;
    if (done) this.running = false;
    return {
      dt: Math.min(MAX_DT_S, advanced / 1000),
      elapsedMs: this.elapsed,
      remainingMs: this.remainingMs,
      done,
    };
  }
}
