import { describe, expect, it } from "vitest";
import { GAME_DURATION_MS, MAX_DT_S, SessionClock } from "../../src/engine/clock";

/** drive the clock with fake 60fps timestamps */
function run(clock: SessionClock, from: number, ms: number, step = 1000 / 60) {
  let t = from;
  let last = clock.tick(t);
  while (t < from + ms - 1e-9) {
    t = Math.min(from + ms, t + step);
    last = clock.tick(t);
  }
  return { t, last };
}

describe("SessionClock", () => {
  it("counts exactly 60 seconds of active play", () => {
    const c = new SessionClock();
    c.start(1000);
    const { last } = run(c, 1000, 61_000);
    expect(c.elapsedMs).toBe(GAME_DURATION_MS);
    expect(last.done).toBe(true);
    expect(c.remainingMs).toBe(0);
  });

  it("is driven by time, not by frame count", () => {
    const fast = new SessionClock();
    const slow = new SessionClock();
    fast.start(0);
    slow.start(0);
    run(fast, 0, 10_000, 1000 / 144);
    run(slow, 0, 10_000, 1000 / 30);
    expect(fast.elapsedMs).toBeCloseTo(10_000, 6);
    expect(slow.elapsedMs).toBeCloseTo(10_000, 6);
  });

  it("freezes while paused and resumes without a jump", () => {
    const c = new SessionClock();
    c.start(0);
    run(c, 0, 5_000);
    c.pause();
    // a long time passes while paused
    expect(c.tick(50_000).dt).toBe(0);
    expect(c.elapsedMs).toBeCloseTo(5_000, 6);
    c.resume(50_000);
    const first = c.tick(50_016);
    expect(first.dt).toBeCloseTo(0.016, 6);
    run(c, 50_016, 1_000);
    expect(c.elapsedMs).toBeCloseTo(6_016, 3);
  });

  it("does not let a hidden tab eat the minute", () => {
    const c = new SessionClock();
    c.start(0);
    run(c, 0, 2_000);
    // no frames for 30 seconds, then frames again
    const after = c.tick(32_000);
    expect(after.dt).toBeLessThanOrEqual(MAX_DT_S);
    expect(c.elapsedMs).toBeLessThan(2_100);
  });

  it("caps physics steps", () => {
    const c = new SessionClock();
    c.start(0);
    const t = c.tick(200); // a slow 200ms frame still counts as time
    expect(t.dt).toBe(MAX_DT_S);
    expect(c.elapsedMs).toBe(200);
  });

  it("never reports negative time when timestamps go backwards", () => {
    const c = new SessionClock();
    c.start(100);
    expect(c.tick(90).dt).toBe(0);
    expect(c.elapsedMs).toBe(0);
  });

  it("clips the final frame to exactly the remaining time", () => {
    const c = new SessionClock(1000);
    c.start(0);
    run(c, 0, 990, 10);
    const end = c.tick(1100);
    expect(end.done).toBe(true);
    expect(c.elapsedMs).toBe(1000);
    expect(end.dt).toBeCloseTo(0.01, 6);
    expect(c.tick(1200).dt).toBe(0);
  });
});
