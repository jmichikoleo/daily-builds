import { describe, expect, it } from "vitest";
import { GAMES, GAME_IDS, getGame } from "../../src/games/registry";
import { pickMessage } from "../../src/engine/GameHost";
import { parseRoute } from "../../src/app/router";

describe("game registry", () => {
  it("has six games with unique ids and complete metadata", () => {
    expect(GAMES).toHaveLength(6);
    expect(new Set(GAME_IDS).size).toBe(6);
    for (const g of GAMES) {
      expect(g.id).toMatch(/^[a-z0-9-]+$/);
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.controls.length).toBeGreaterThan(0);
      expect(g.scoring.rules.length).toBeGreaterThan(0);
      expect(g.scoring.great).toBeGreaterThan(g.scoring.good);
      for (const tier of ["low", "mid", "high"] as const) expect(g.messages[tier].length).toBeGreaterThan(0);
      expect(typeof g.Component).toBe("function");
      expect(parseRoute(`/play/${g.id}`)).toEqual({ name: "play", id: g.id });
    }
    expect(getGame("nope")).toBeNull();
  });

  it("picks messages that match the score", () => {
    const g = getGame("star-catcher")!;
    expect(g.messages.low).toContain(pickMessage(g, 0, () => 0));
    expect(g.messages.mid).toContain(pickMessage(g, g.scoring.good, () => 0.5));
    expect(g.messages.high).toContain(pickMessage(g, g.scoring.great + 1, () => 0.99));
  });

  it("parses routes", () => {
    expect(parseRoute("/")).toEqual({ name: "home" });
    expect(parseRoute("/records/")).toEqual({ name: "records" });
    expect(parseRoute("/settings")).toEqual({ name: "settings" });
    expect(parseRoute("/play/../etc")).toEqual({ name: "notFound" });
  });
});
