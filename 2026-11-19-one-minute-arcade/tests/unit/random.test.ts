import { describe, expect, it } from "vitest";
import { lerp, mulberry32, pickRandomGame } from "../../src/engine/random";

const IDS = ["a", "b", "c", "d", "e", "f"];

describe("random game", () => {
  it("always returns a valid game", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 500; i++) expect(IDS).toContain(pickRandomGame(IDS, null, rng));
  });

  it("avoids the game you just played", () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 500; i++) expect(pickRandomGame(IDS, "c", rng)).not.toBe("c");
  });

  it("covers every other game eventually", () => {
    const rng = mulberry32(3);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(pickRandomGame(IDS, "a", rng));
    expect([...seen].sort()).toEqual(["b", "c", "d", "e", "f"]);
  });

  it("handles edge cases", () => {
    expect(pickRandomGame(["solo"], "solo")).toBe("solo");
    expect(pickRandomGame(IDS, "a", () => 0.9999999)).toBe("f");
    expect(() => pickRandomGame([], null)).toThrow();
  });

  it("lerps and clamps", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, -1)).toBe(0);
    expect(lerp(0, 10, 2)).toBe(10);
  });
});
