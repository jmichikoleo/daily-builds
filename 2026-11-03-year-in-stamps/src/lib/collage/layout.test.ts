import { describe, expect, it } from "vitest";
import { createEmptyDraft, type CollectionEntry, type PassportDraft } from "../passport/types";
import { LAYOUT_PRESETS, type LayoutPreset } from "../studio/types";
import type { ThemeId } from "../themes";
import { composeCollage } from "./compose";
import type { CollageFormatId } from "./formats";
import { paginate, rotatedExtents } from "./layout";

function entries(n: number): CollectionEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e-${i}`,
    placeId: `gn:${1000 + i}`,
    place: { name: `Place ${i}`, kind: "city", isoCode: i % 2 ? "KR" : "JP", countryName: "Somewhere", motif: "houses" },
    visit: { precision: "unknown" },
    design: { variant: 0, showDate: true },
  }));
}

function draftWith(n: number, preset: LayoutPreset, formatId: CollageFormatId, seed = 1, themeId: ThemeId = "classic"): PassportDraft {
  const d = createEmptyDraft(2026);
  d.entries = entries(n);
  d.studio = { ...d.studio, themeId, formatId, layout: { preset, seed } };
  return d;
}

const EPS = 0.5;

describe("collage layout engine", () => {
  for (const { id: preset } of LAYOUT_PRESETS) {
    for (const formatId of ["story", "square"] as const) {
      it(`${preset} / ${formatId}: keeps 1–40 stamps inside the safe stamp area`, () => {
        for (const n of [1, 2, 3, 7, 15, 24, 40]) {
          const collage = composeCollage(draftWith(n, preset, formatId));
          const placed = collage.pages.flatMap((p) => p.layout.placements);
          expect(placed).toHaveLength(n);
          for (const page of collage.pages) {
            const a = page.frame.stampArea;
            // The stamp area sits between the header rule and the footer rule.
            expect(a.y).toBeGreaterThan(page.frame.headerRuleY);
            expect(a.y + a.height).toBeLessThan(page.frame.footerRuleY);
            for (const p of page.layout.placements) {
              const { hx, hy } = rotatedExtents(p.w, p.h, p.rotation);
              expect(p.cx - hx).toBeGreaterThanOrEqual(a.x - EPS);
              expect(p.cx + hx).toBeLessThanOrEqual(a.x + a.width + EPS);
              expect(p.cy - hy).toBeGreaterThanOrEqual(a.y - EPS);
              expect(p.cy + hy).toBeLessThanOrEqual(a.y + a.height + EPS);
              expect(Math.abs(p.rotation)).toBeLessThanOrEqual(12);
            }
          }
        }
      });
    }
  }

  it("uses several pages for large collections instead of tiny stamps", () => {
    const collage = composeCollage(draftWith(40, "scattered", "story"));
    expect(collage.pages.length).toBe(3);
    expect(collage.pages.map((p) => p.layout.placements.length)).toEqual([14, 13, 13]);
    const smallest = Math.min(...collage.pages.flatMap((p) => p.layout.placements.map((s) => s.w)));
    expect(smallest).toBeGreaterThan(150);
  });

  it("is deterministic for a seed and changes when shuffled", () => {
    const a = composeCollage(draftWith(12, "scattered", "story", 7)).pages[0].layout;
    const b = composeCollage(draftWith(12, "scattered", "story", 7)).pages[0].layout;
    const c = composeCollage(draftWith(12, "scattered", "story", 8)).pages[0].layout;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("shuffling keeps the same stamps and designs", () => {
    const a = composeCollage(draftWith(10, "postcard", "square", 1));
    const b = composeCollage(draftWith(10, "postcard", "square", 2));
    expect([...a.stamps.keys()].sort()).toEqual([...b.stamps.keys()].sort());
    for (const [id, s] of a.stamps) expect(b.stamps.get(id)!.design).toEqual(s.design);
  });

  it("gives Postcard Wall varied sizes and Minimal Archive no rotation", () => {
    const wall = composeCollage(draftWith(10, "postcard", "story")).pages[0].layout.placements;
    const areas = wall.map((p) => p.w * p.h);
    expect(Math.max(...areas) / Math.min(...areas)).toBeGreaterThan(2);
    const archive = composeCollage(draftWith(9, "archive", "story")).pages[0].layout.placements;
    expect(archive.every((p) => p.rotation === 0 && p.caption)).toBe(true);
  });

  it("keeps long titles inside the canvas", () => {
    const d = draftWith(3, "scattered", "story");
    d.studio.text.title = "A Very Long Title About Every Single Place I Visited This Wonderful Year";
    for (const themeId of ["classic", "pink", "editorial"] as const) {
      d.studio.themeId = themeId;
      const { frame } = composeCollage(d).pages[0];
      for (const line of frame.title) {
        const width = line.textLength ?? line.text.length * line.size * (line.face.glyph + line.face.tracking);
        expect(width).toBeLessThanOrEqual(frame.width - frame.margin * 2 + 1);
      }
      expect(frame.title.length).toBeLessThanOrEqual(2);
    }
  });

  it("splits pages evenly", () => {
    expect(paginate([1, 2, 3, 4, 5], 2).map((p) => p.length)).toEqual([2, 2, 1]);
    expect(paginate([], 5)).toEqual([[]]);
  });
});
