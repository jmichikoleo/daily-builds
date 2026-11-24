// tests/data.test.ts
// keeps the curated content honest as it grows.

import { describe, expect, it } from "vitest";
import { DESTINATIONS, REGULAR_DESTINATIONS, SECRET_DESTINATIONS } from "../src/data/destinations";
import { EXPEDITIONS } from "../src/data/expeditions";
import { ACHIEVEMENTS } from "../src/data/achievements";
import { STAMPS } from "../src/data/stamps";
import { TERRITORIES, REGULAR_TERRITORIES } from "../src/data/territories";
import { hasGlyph } from "../src/components/glyphs";

describe("curated content", () => {
  it("has enough of everything", () => {
    expect(DESTINATIONS.length).toBeGreaterThanOrEqual(80);
    expect(SECRET_DESTINATIONS.length).toBeGreaterThanOrEqual(8);
    expect(EXPEDITIONS.length).toBeGreaterThanOrEqual(12);
    for (const t of REGULAR_TERRITORIES) {
      expect(REGULAR_DESTINATIONS.filter((d) => d.territory === t.id).length, t.id).toBeGreaterThanOrEqual(8);
    }
  });

  it("uses unique ids and urls", () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const urls = DESTINATIONS.map((d) => d.url.replace(/\/$/, ""));
    expect(new Set(urls).size).toBe(urls.length);
    expect(new Set(STAMPS.map((s) => s.id)).size).toBe(STAMPS.length);
    expect(new Set(EXPEDITIONS.map((e) => e.id)).size).toBe(EXPEDITIONS.length);
  });

  it("has valid fields on every destination", () => {
    for (const d of DESTINATIONS) {
      expect(() => new URL(d.url), d.id).not.toThrow();
      expect(d.description.length, d.id).toBeGreaterThan(20);
      expect(d.tags.length, d.id).toBeGreaterThan(0);
      expect(d.minutes, d.id).toBeGreaterThan(0);
      expect(TERRITORIES.some((t) => t.id === d.territory), d.id).toBe(true);
      expect(hasGlyph(d.stamp.glyph), `${d.id} glyph ${d.stamp.glyph}`).toBe(true);
      if (d.territory === "hidden") {
        expect(d.secret, d.id).toBeTruthy();
        expect(d.rarity).toBe("secret");
      } else {
        expect(d.secret, d.id).toBeFalsy();
      }
    }
  });

  it("gives every stamp its own design", () => {
    const keys = STAMPS.map((s) => `${s.design.shape}/${s.design.glyph}`);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
    for (const s of STAMPS) expect(hasGlyph(s.design.glyph), s.id).toBe(true);
  });

  it("mixes stamp shapes", () => {
    const shapes = new Set(STAMPS.map((s) => s.design.shape));
    for (const shape of ["circle", "rect", "oval", "triangle", "blob"]) expect(shapes.has(shape as never)).toBe(true);
  });

  it("points expeditions at real destinations", () => {
    for (const e of EXPEDITIONS) {
      expect(e.destinationIds.length).toBeGreaterThanOrEqual(3);
      expect(e.destinationIds.length).toBeLessThanOrEqual(5);
      for (const id of e.destinationIds) {
        const d = DESTINATIONS.find((x) => x.id === id);
        expect(d, `${e.id} -> ${id}`).toBeTruthy();
        expect(d!.territory).not.toBe("hidden");
      }
    }
  });

  it("points unlock rules at real things", () => {
    for (const d of SECRET_DESTINATIONS) {
      const u = d.secret!.unlock;
      if (u.type === "stampCombo") for (const id of u.destinationIds) expect(REGULAR_DESTINATIONS.some((x) => x.id === id), id).toBe(true);
      if (u.type === "expeditionComplete") expect(EXPEDITIONS.some((e) => e.id === u.expeditionId)).toBe(true);
    }
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps ui copy free of em dashes and semicolons", () => {
    const text = JSON.stringify([DESTINATIONS.map((d) => [d.description, d.question, d.secret?.hint]), EXPEDITIONS, ACHIEVEMENTS, TERRITORIES]);
    expect(text).not.toMatch(/[—–;]/);
  });
});
