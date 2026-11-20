// src/games/panic-button/logic.ts
// the absurd machine. three systems drift toward disaster and the player nudges
// them back. all the rules live here so they can be tested without the ui.

import { lerp } from "../../engine/random";

export type SystemId = "heat" | "pressure" | "power";
export type Level = "low" | "ok" | "warn" | "danger";

export interface Machine {
  heat: number; // 0..100
  pressure: number;
  power: number; // instability, 0 is calm
  cooling: boolean;
  valveOpen: boolean;
  resetLock: number; // seconds until reset works again
  rebooting: number; // seconds of meltdown recovery left
  greenFor: number; // seconds of the current all green streak
  nextStreakAt: number;
  scoreCarry: number; // fractional points not yet paid out
  gremlinIn: number; // seconds until the next surprise surge
  inDanger: Record<SystemId, boolean>;
  meltdowns: number;
}

export const SAFE = { lowBelow: 18, warnAbove: 70, dangerAbove: 85, critical: 100 };
export const POWER_SAFE = { warnAbove: 55, dangerAbove: 85 };

export const POINTS = {
  greenPerSecond: 12,
  recovery: 25,
  streakEvery: 5,
  streakBonus: 25,
  dangerPerSecond: -4,
  meltdown: -50,
};

export function newMachine(): Machine {
  return {
    heat: 40,
    pressure: 40,
    power: 10,
    cooling: false,
    valveOpen: false,
    resetLock: 0,
    rebooting: 0,
    greenFor: 0,
    nextStreakAt: POINTS.streakEvery,
    scoreCarry: 0,
    gremlinIn: 7,
    inDanger: { heat: false, pressure: false, power: false },
    meltdowns: 0,
  };
}

export function levelOf(id: SystemId, v: number): Level {
  if (id === "power") {
    if (v >= POWER_SAFE.dangerAbove) return "danger";
    if (v >= POWER_SAFE.warnAbove) return "warn";
    return "ok";
  }
  if (v >= SAFE.dangerAbove) return "danger";
  if (v >= SAFE.warnAbove) return "warn";
  if (v < SAFE.lowBelow) return "low";
  return "ok";
}

export const allGreen = (m: Machine) =>
  levelOf("heat", m.heat) === "ok" && levelOf("pressure", m.pressure) === "ok" && levelOf("power", m.power) === "ok";

/** how quickly things go wrong. progress is 0..1 through the minute */
export function ratesAt(progress: number, urgent = false) {
  const k = urgent ? 1.3 : 1;
  return {
    heatUp: lerp(4.5, 10, progress) * k,
    pressureUp: lerp(5, 11, progress) * k,
    powerUp: lerp(3.5, 9, progress) * k,
    gremlinEvery: lerp(9, 3.5, progress),
  };
}

export const PAYOUT = 6;
export const COOL_RATE = 24;
export const VENT_RATE = 20;
export const RESET_MIN = 25; // reset only works on a wobbly grid
export const RESET_LOCK = 1.6;

export type MachineEvent =
  | { type: "points"; amount: number; reason: "green" | "streak" | "recovery" | "danger" | "meltdown" }
  | { type: "meltdown" }
  | { type: "gremlin"; system: SystemId }
  | { type: "resetFizzle" }
  | { type: "reset" };

/** press the reset switch. returns what happened */
export function pressReset(m: Machine): MachineEvent {
  if (m.rebooting > 0 || m.resetLock > 0 || m.power < RESET_MIN) {
    m.resetLock = Math.max(m.resetLock, 0.6);
    return { type: "resetFizzle" };
  }
  m.power = 0;
  m.resetLock = RESET_LOCK;
  return { type: "reset" };
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** advance the machine by dt seconds. mutates m and returns what happened */
export function stepMachine(m: Machine, dt: number, progress: number, urgent: boolean, rng: () => number = Math.random): MachineEvent[] {
  const ev: MachineEvent[] = [];
  const r = ratesAt(progress, urgent);
  m.resetLock = Math.max(0, m.resetLock - dt);

  if (m.rebooting > 0) {
    m.rebooting = Math.max(0, m.rebooting - dt);
    return ev;
  }

  // drift
  m.heat = clamp(m.heat + (m.cooling ? -COOL_RATE : r.heatUp) * dt);
  m.pressure = clamp(m.pressure + (m.valveOpen ? -VENT_RATE : r.pressureUp) * dt);
  m.power = clamp(m.power + r.powerUp * dt * (0.6 + rng() * 0.8));

  // gremlins. a sudden surge on one system, never during the first few seconds
  m.gremlinIn -= dt;
  if (m.gremlinIn <= 0) {
    m.gremlinIn = r.gremlinEvery * (0.75 + rng() * 0.5);
    const ids: SystemId[] = ["heat", "pressure", "power"];
    const sys = ids[Math.floor(rng() * 3) % 3];
    m[sys] = clamp(m[sys] + 22);
    ev.push({ type: "gremlin", system: sys });
  }

  // danger, recovery and meltdown
  let dangerCount = 0;
  for (const id of ["heat", "pressure", "power"] as SystemId[]) {
    const lv = levelOf(id, m[id]);
    if (lv === "danger") {
      dangerCount++;
      m.inDanger[id] = true;
    } else if (m.inDanger[id] && (lv === "ok" || lv === "low")) {
      m.inDanger[id] = false;
      ev.push({ type: "points", amount: POINTS.recovery, reason: "recovery" });
    }
  }
  if (m.heat >= 100 || m.pressure >= 100 || m.power >= 100) {
    m.meltdowns++;
    m.rebooting = 1.6;
    m.heat = 45;
    m.pressure = 45;
    m.power = 15;
    m.cooling = false;
    m.valveOpen = false;
    m.greenFor = 0;
    m.nextStreakAt = POINTS.streakEvery;
    m.inDanger = { heat: false, pressure: false, power: false };
    ev.push({ type: "meltdown" }, { type: "points", amount: POINTS.meltdown, reason: "meltdown" });
    return ev;
  }

  // scoring
  if (allGreen(m)) {
    m.greenFor += dt;
    m.scoreCarry += POINTS.greenPerSecond * dt;
    if (m.greenFor >= m.nextStreakAt) {
      m.nextStreakAt += POINTS.streakEvery;
      ev.push({ type: "points", amount: POINTS.streakBonus, reason: "streak" });
    }
  } else {
    m.greenFor = 0;
    m.nextStreakAt = POINTS.streakEvery;
  }
  m.scoreCarry += POINTS.dangerPerSecond * dangerCount * dt;
  // pay out in small chunks so the score ticks instead of fizzing
  if (Math.abs(m.scoreCarry) >= PAYOUT) {
    const whole = Math.trunc(m.scoreCarry);
    m.scoreCarry -= whole;
    ev.push({ type: "points", amount: whole, reason: whole > 0 ? "green" : "danger" });
  }
  return ev;
}
