import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../src/engine/random";
import * as star from "../../src/games/star-catcher/logic";
import * as panic from "../../src/games/panic-button/logic";
import * as frog from "../../src/games/frog-traffic/logic";
import * as delivery from "../../src/games/wrong-delivery/logic";
import * as garden from "../../src/games/garden-emergency/logic";
import * as ghost from "../../src/games/ghost-hunt/logic";

describe("star catcher", () => {
  it("scores each star kind as the rules say", () => {
    expect(star.STARS.gold.points).toBe(10);
    expect(star.STARS.blue.points).toBe(25);
    expect(star.STARS.red.points).toBe(-15);
    expect(star.STARS.rainbow.points).toBe(50);
  });

  it("gets harder in four acts", () => {
    const a = star.difficultyAt(5);
    const b = star.difficultyAt(20);
    const c = star.difficultyAt(35);
    const d = star.difficultyAt(50);
    expect(b.spawnEvery).toBeLessThan(a.spawnEvery); // more stars
    expect(c.fall).toBeGreaterThan(b.fall); // faster
    expect(a.wobble || b.wobble || c.wobble).toBe(false);
    expect(d.wobble).toBe(true); // unpredictable
    expect(star.difficultyAt(55, true).fall).toBeGreaterThan(d.fall);
  });

  it("never sends red stars in the first seconds", () => {
    const w = star.difficultyAt(1).weights;
    for (let r = 0; r < 1; r += 0.01) expect(star.pickKind(w, r)).not.toBe("red");
  });

  it("catches stars inside the basket and not beside it", () => {
    const y = star.BASKET_Y;
    expect(star.isCaught({ x: 200, y, r: 15 }, 200)).toBe(true);
    expect(star.isCaught({ x: 200 + star.BASKET_W, y, r: 15 }, 200)).toBe(false);
    expect(star.isCaught({ x: 200, y: 100, r: 15 }, 200)).toBe(false);
    expect(star.clampBasket(-50)).toBe(star.BASKET_W / 2);
    expect(star.clampBasket(9999)).toBe(star.W - star.BASKET_W / 2);
  });
});

describe("panic button", () => {
  const steps = (m: panic.Machine, seconds: number, progress = 0, rng = mulberry32(5)) => {
    const out: panic.MachineEvent[] = [];
    for (let t = 0; t < seconds; t += 0.05) out.push(...panic.stepMachine(m, 0.05, progress, false, rng));
    return out;
  };
  const points = (ev: panic.MachineEvent[], reason?: string) =>
    ev.reduce((n, e) => (e.type === "points" && (!reason || e.reason === reason) ? n + e.amount : n), 0);

  it("pays for keeping everything green", () => {
    const m = panic.newMachine();
    m.gremlinIn = 999;
    const ev = steps(m, 2);
    expect(points(ev, "green")).toBeGreaterThan(0);
  });

  it("gives a streak bonus every five green seconds", () => {
    const m = panic.newMachine();
    m.gremlinIn = 999;
    // hold everything still in the middle
    const rng = () => 0;
    const ev: panic.MachineEvent[] = [];
    for (let t = 0; t < 5.2; t += 0.05) {
      m.heat = 40;
      m.pressure = 40;
      m.power = 10;
      ev.push(...panic.stepMachine(m, 0.05, 0, false, rng));
    }
    expect(ev.filter((e) => e.type === "points" && e.reason === "streak")).toHaveLength(1);
  });

  it("drifts toward danger when ignored and melts down without ending the game", () => {
    const m = panic.newMachine();
    const ev = steps(m, 30, 0.5);
    expect(ev.some((e) => e.type === "meltdown")).toBe(true);
    expect(points(ev, "meltdown")).toBeLessThan(0);
    expect(points(ev, "danger")).toBeLessThan(0);
    expect(m.heat).toBeLessThan(100);
  });

  it("rewards rescuing a gauge from the red", () => {
    const m = panic.newMachine();
    m.gremlinIn = 999;
    m.heat = 90;
    panic.stepMachine(m, 0.05, 0, false, () => 0);
    expect(m.inDanger.heat).toBe(true);
    m.cooling = true;
    const ev = steps(m, 2);
    expect(points(ev, "recovery")).toBe(panic.POINTS.recovery);
  });

  it("controls do what their labels say", () => {
    const m = panic.newMachine();
    m.gremlinIn = 999;
    m.cooling = true;
    m.valveOpen = true;
    const h = m.heat;
    const p = m.pressure;
    steps(m, 1);
    expect(m.heat).toBeLessThan(h);
    expect(m.pressure).toBeLessThan(p);
    m.power = 60;
    expect(panic.pressReset(m).type).toBe("reset");
    expect(m.power).toBe(0);
    // spamming does nothing while it recharges, and a calm grid cannot be reset
    m.power = 60;
    expect(panic.pressReset(m).type).toBe("resetFizzle");
    const calm = panic.newMachine();
    expect(panic.pressReset(calm).type).toBe("resetFizzle");
  });

  it("deteriorates faster over time", () => {
    const early = panic.ratesAt(0);
    const late = panic.ratesAt(1);
    expect(late.heatUp).toBeGreaterThan(early.heatUp);
    expect(late.gremlinEvery).toBeLessThan(early.gremlinEvery);
    expect(panic.ratesAt(1, true).heatUp).toBeGreaterThan(late.heatUp);
  });

  it("labels levels without relying on color", () => {
    expect(panic.levelOf("heat", 10)).toBe("low");
    expect(panic.levelOf("heat", 40)).toBe("ok");
    expect(panic.levelOf("heat", 75)).toBe("warn");
    expect(panic.levelOf("heat", 90)).toBe("danger");
    expect(panic.levelOf("power", 0)).toBe("ok");
  });
});

describe("frog traffic", () => {
  it("every generated level is crossable", () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (let level = 1; level <= 12; level++) {
        const lanes = frog.makeLanes(level, mulberry32(seed * 100 + level));
        expect(lanes).toHaveLength(frog.ROWS - 2);
        if (!frog.isCrossable(lanes)) {
          throw new Error(`seed ${seed} level ${level} gaps ${lanes.map((l) => Math.max(...frog.laneGaps(l)).toFixed(0)).join(",")}`);
        }
      }
    }
  });

  it("gets harder with each crossing", () => {
    const avg = (level: number, f: (l: frog.Lane) => number) => {
      let n = 0;
      let sum = 0;
      for (let s = 1; s < 60; s++)
        for (const l of frog.makeLanes(level, mulberry32(s))) {
          sum += f(l);
          n++;
        }
      return sum / n;
    };
    expect(avg(5, (l) => l.speed)).toBeGreaterThan(avg(1, (l) => l.speed));
    const padLen = (l: frog.Lane) => l.pads.reduce((a, p) => a + p.len, 0) / l.pads.length;
    expect(avg(6, padLen)).toBeLessThan(avg(1, padLen));
    expect(frog.makeLanes(1, mulberry32(1)).some((l) => l.pads.some((p) => p.sinks))).toBe(false);
    const sinky = Array.from({ length: 20 }, (_, s) => frog.makeLanes(4, mulberry32(s))).some((ls) => ls.some((l) => l.pads.some((p) => p.sinks)));
    expect(sinky).toBe(true);
  });

  it("finds pads under the frog and drops it in the water otherwise", () => {
    const lane: frog.Lane = { row: 1, dir: 1, speed: 50, shift: 0, pads: [{ offset: 220, len: 100, sinks: false, sinkPhase: 0 }] };
    // offset 220 shows at x 100
    expect(frog.padAt(lane, 150)?.left).toBe(100);
    expect(frog.padAt(lane, 20)).toBeNull();
    lane.shift = 100;
    expect(frog.padAt(lane, 150)).toBeNull();
    expect(frog.padAt(lane, 250)).not.toBeNull();
  });

  it("sunk pads cannot hold a frog", () => {
    const p = { offset: 220, len: 100, sinks: true, sinkPhase: frog.SINK_CYCLE - 0.5 };
    expect(frog.sinkState(p)).toBe(2);
    expect(frog.padAt({ row: 1, dir: 1, speed: 50, shift: 0, pads: [p] }, 150)).toBeNull();
    expect(frog.sinkState({ ...p, sinkPhase: frog.SINK_CYCLE - frog.SINK_DOWN - 0.5 })).toBe(1);
    expect(frog.sinkState({ ...p, sinkPhase: 0.2 })).toBe(0);
  });

  it("pays more for later crossings", () => {
    expect(frog.crossingBonus(1)).toBe(40);
    expect(frog.crossingBonus(3)).toBe(60);
  });
});

describe("wrong delivery", () => {
  it("scores right, wrong and missed packages", () => {
    const s = { streak: 0 };
    expect(delivery.deliver(s, "food", "food").delta).toBe(10);
    expect(delivery.deliver(s, "food", "magic").delta).toBe(-5);
    expect(s.streak).toBe(0);
    delivery.deliver(s, "space", "space");
    expect(delivery.miss(s)).toBe(-3);
    expect(s.streak).toBe(0);
  });

  it("builds a combo every five in a row", () => {
    const s = { streak: 0 };
    const deltas = Array.from({ length: 22 }, () => delivery.deliver(s, "magic", "magic").delta);
    expect(deltas.slice(0, 5)).toEqual([10, 10, 10, 10, 10]);
    expect(deltas[5]).toBe(20);
    expect(deltas[10]).toBe(30);
    expect(deltas[15]).toBe(40);
    expect(deltas[21]).toBe(40); // capped
  });

  it("maps keys to doors", () => {
    expect(delivery.categoryForDoorKey("1")).toBe("food");
    expect(delivery.categoryForDoorKey("2")).toBe("space");
    expect(delivery.categoryForDoorKey("3")).toBe("magic");
    expect(delivery.categoryForDoorKey("4")).toBeNull();
  });

  it("speeds up over the minute", () => {
    expect(delivery.beltAt(1).speed).toBeGreaterThan(delivery.beltAt(0).speed);
    expect(delivery.beltAt(1).every).toBeLessThan(delivery.beltAt(0).every);
  });

  it("every odd package has a funny description", () => {
    for (const c of delivery.CATEGORIES) expect(delivery.ODD_PACKAGES[c].length).toBeGreaterThan(2);
  });
});

describe("garden emergency", () => {
  it("each tool only works on the plot that needs it", () => {
    const g = garden.newGarden();
    g.plots[0] = { kind: "thirsty", t: 0, limit: 5, was: "sprout" };
    g.plots[1] = { kind: "weed", t: 0 };
    g.plots[2] = { kind: "bud", t: 0, limit: 9 };
    expect(garden.applyTool(g, 0, "sun")).toBeNull();
    expect(garden.applyTool(g, 0, "water")).toBe(10);
    expect(garden.applyTool(g, 1, "glove")).toBe(5);
    expect(garden.applyTool(g, 2, "sun")).toBe(20);
    expect(g.plots[2].kind).toBe("bloom");
    expect(garden.applyTool(g, 3, "water")).toBeNull();
  });

  it("thirsty plants wilt if ignored", () => {
    const g = garden.newGarden();
    g.eventIn = 999;
    g.plots[5] = { kind: "thirsty", t: 0, limit: 1, was: "sprout" };
    const ev = garden.stepGarden(g, 1.1, 0);
    expect(ev).toContainEqual({ type: "wilt", plot: 5 });
    expect(g.plots[5].kind).toBe("wilted");
    expect(garden.applyTool(g, 5, "water")).toBeNull();
  });

  it("never asks for more than a person can handle", () => {
    for (let seed = 1; seed < 40; seed++) {
      const g = garden.newGarden();
      const rng = mulberry32(seed);
      for (let t = 0; t < 60; t += 0.05) {
        garden.stepGarden(g, 0.05, t / 60, t > 50, rng);
        // weeds can spread when neglected, everything else respects the cap
        const nonWeed = g.plots.filter((p) => p.kind === "thirsty" || p.kind === "bud").length;
        expect(nonWeed).toBeLessThanOrEqual(garden.maxNeeds(1));
      }
    }
    expect(garden.maxNeeds(0)).toBeLessThan(garden.maxNeeds(1));
  });

  it("knows its neighbours", () => {
    expect(garden.neighbours(0).sort()).toEqual([1, 4]);
    expect(garden.neighbours(5).sort((a, b) => a - b)).toEqual([1, 4, 6, 9]);
    expect(garden.neighbours(11).sort((a, b) => a - b)).toEqual([7, 10]);
  });
});

describe("ghost hunt", () => {
  it("scores ghosts, rare ghosts, decoys and empty spots", () => {
    const h = ghost.newHaunt();
    h.spooks.push({ id: 1, kind: "ghost", spot: 0, t: 0, life: 2, alpha: 1, hops: 0 });
    h.spooks.push({ id: 2, kind: "rare", spot: 1, t: 0, life: 2, alpha: 1, hops: 0 });
    h.spooks.push({ id: 3, kind: "decoy", spot: 2, t: 0, life: 2, alpha: 1, hops: 0 });
    expect(ghost.tapSpot(h, 0).delta).toBe(10);
    expect(ghost.tapSpot(h, 1).delta).toBe(30);
    expect(ghost.tapSpot(h, 2)).toEqual({ kind: "decoy", delta: -5 });
    expect(ghost.tapSpot(h, 3)).toEqual({ kind: "empty", delta: -5 });
    expect(h.streak).toBe(0);
    expect(h.found).toBe(2);
  });

  it("adds a combo bonus for streaks", () => {
    expect(ghost.comboBonus(1)).toBe(0);
    expect(ghost.comboBonus(3)).toBe(5);
    expect(ghost.comboBonus(6)).toBe(10);
    expect(ghost.comboBonus(30)).toBe(15);
  });

  it("ghosts appear, hop and get sneakier", () => {
    const h = ghost.newHaunt();
    const rng = mulberry32(9);
    let appeared = 0;
    let hops = 0;
    let decoys = 0;
    for (let t = 0; t < 60; t += 0.05) {
      for (const e of ghost.stepHaunt(h, 0.05, t / 60, t > 50, rng)) {
        if (e.type === "appear") appeared++;
        if (e.type === "hop") hops++;
        if (e.type === "appear" && e.kind === "decoy") decoys++;
      }
      // never two things in one spot
      const spots = h.spooks.map((s) => s.spot);
      expect(new Set(spots).size).toBe(spots.length);
    }
    expect(appeared).toBeGreaterThan(40);
    expect(hops).toBeGreaterThan(0);
    expect(decoys).toBeGreaterThan(0);
    const early = ghost.hauntAt(0);
    const late = ghost.hauntAt(1);
    expect(late.showFor).toBeLessThan(early.showFor);
    expect(late.maxDecoys).toBeGreaterThan(early.maxDecoys);
    expect(early.fadeChance).toBe(0);
    expect(late.fadeChance).toBeGreaterThan(0);
  });
});
