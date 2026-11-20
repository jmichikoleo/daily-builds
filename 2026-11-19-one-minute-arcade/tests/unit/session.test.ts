import { describe, expect, it } from "vitest";
import { COUNTDOWN_STEP_MS, COUNTDOWN_TOTAL_MS, applyScore, countdownLabel, formatTime, isUrgent, nextPhase } from "../../src/engine/session";

describe("session state machine", () => {
  it("walks the happy path", () => {
    let p = nextPhase("ready", { type: "start" });
    expect(p).toBe("countdown");
    p = nextPhase(p, { type: "countdownDone" });
    expect(p).toBe("playing");
    p = nextPhase(p, { type: "pause" });
    expect(p).toBe("paused");
    p = nextPhase(p, { type: "resume" });
    expect(p).toBe("playing");
    p = nextPhase(p, { type: "timeUp" });
    expect(p).toBe("finished");
    p = nextPhase(p, { type: "reset" });
    expect(p).toBe("ready");
  });

  it("ignores events that make no sense", () => {
    expect(nextPhase("ready", { type: "pause" })).toBe("ready");
    expect(nextPhase("finished", { type: "resume" })).toBe("finished");
    expect(nextPhase("paused", { type: "timeUp" })).toBe("paused");
    expect(nextPhase("countdown", { type: "pause" })).toBe("countdown");
    expect(nextPhase("playing", { type: "start" })).toBe("playing");
  });

  it("counts down 3 2 1 GO", () => {
    expect(countdownLabel(0)).toBe("3");
    expect(countdownLabel(COUNTDOWN_STEP_MS)).toBe("2");
    expect(countdownLabel(COUNTDOWN_STEP_MS * 2 + 10)).toBe("1");
    expect(countdownLabel(COUNTDOWN_STEP_MS * 3)).toBe("GO!");
    expect(countdownLabel(COUNTDOWN_TOTAL_MS)).toBeNull();
  });

  it("knows the final ten seconds", () => {
    expect(isUrgent(10_001)).toBe(false);
    expect(isUrgent(10_000)).toBe(true);
    expect(isUrgent(1)).toBe(true);
    expect(isUrgent(0)).toBe(false);
  });

  it("keeps scores whole and never below zero", () => {
    expect(applyScore(0, -15)).toBe(0);
    expect(applyScore(10, -15)).toBe(0);
    expect(applyScore(10, 25)).toBe(35);
    expect(applyScore(10, 0.4)).toBe(10);
  });

  it("formats the timer", () => {
    expect(formatTime(60_000)).toBe("1:00");
    expect(formatTime(59_001)).toBe("1:00");
    expect(formatTime(59_000)).toBe("0:59");
    expect(formatTime(9_500)).toBe("0:10");
    expect(formatTime(0)).toBe("0:00");
  });
});
