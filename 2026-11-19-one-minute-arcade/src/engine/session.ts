// src/engine/session.ts
// the session lifecycle as a tiny pure state machine.
// ready -> countdown -> playing <-> paused -> finished, and back to ready on replay.

export type Phase = "ready" | "countdown" | "playing" | "paused" | "finished";

export type SessionEvent =
  | { type: "start" }
  | { type: "countdownDone" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "timeUp" }
  | { type: "reset" };

const transitions: Record<Phase, Partial<Record<SessionEvent["type"], Phase>>> = {
  ready: { start: "countdown", reset: "ready" },
  countdown: { countdownDone: "playing", reset: "ready" },
  playing: { pause: "paused", timeUp: "finished", reset: "ready" },
  paused: { resume: "playing", reset: "ready" },
  finished: { reset: "ready" },
};

/** returns the next phase, or the same phase when the event does not apply */
export function nextPhase(phase: Phase, event: SessionEvent): Phase {
  return transitions[phase][event.type] ?? phase;
}

export const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"] as const;
export const COUNTDOWN_STEP_MS = 650;
export const COUNTDOWN_TOTAL_MS = COUNTDOWN_STEP_MS * COUNTDOWN_STEPS.length;

/** which countdown label to show after `ms` of countdown */
export function countdownLabel(ms: number): string | null {
  const i = Math.floor(ms / COUNTDOWN_STEP_MS);
  return i < COUNTDOWN_STEPS.length ? COUNTDOWN_STEPS[i] : null;
}

/** the final stretch where everything gets a bit louder */
export const URGENT_MS = 10_000;
export const isUrgent = (remainingMs: number) => remainingMs <= URGENT_MS && remainingMs > 0;

/** scores never drop below zero */
export function applyScore(score: number, delta: number): number {
  return Math.max(0, Math.round(score + delta));
}

/** a timer label like 0:59. rounds up so the clock reads 1:00 at the very start */
export function formatTime(remainingMs: number): string {
  const s = Math.ceil(remainingMs / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
