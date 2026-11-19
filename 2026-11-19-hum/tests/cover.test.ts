// tests/cover.test.ts
// cover config, picture checks, and that drawing runs with every option.
import { describe, expect, it } from "vitest";
import { defaultCover, drawCover, validateImageFile } from "../src/lib/cover";
import { normalizeSong } from "../src/lib/migrate";
import { referencedKeys } from "../src/lib/versions";
import type { CoverConfig } from "../src/lib/types";

/** A fake 2d context that just records what was drawn. */
function fakeCtx() {
  const calls: string[] = [];
  const texts: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, k: string) {
      if (k === "measureText") return (s: string) => ({ width: s.length * 10 });
      if (k === "createLinearGradient") return () => ({ addColorStop: () => {} });
      if (k === "fillText") return (s: string) => { texts.push(s); calls.push(k); };
      return (..._a: unknown[]) => { calls.push(k); };
    },
    set() { return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, texts };
}

describe("covers", () => {
  it("checks picture files before decoding", () => {
    expect(validateImageFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "text/plain", size: 10 })).toMatch(/picture/);
    expect(validateImageFile({ type: "image/svg+xml", size: 10 })).toMatch(/picture/); // svg can carry scripts, not allowed
    expect(validateImageFile({ type: "image/jpeg", size: 50 * 1024 * 1024 })).toMatch(/too big/);
    expect(validateImageFile({ type: "image/jpeg", size: 0 })).toMatch(/empty/);
  });

  it("draws every background and pattern with the title and the hum. mark", () => {
    const backgrounds: CoverConfig["background"][] = ["solid", "gradient", "pattern", "image"];
    const patterns: CoverConfig["pattern"][] = ["dots", "stripes", "hearts", "notes", "checks"];
    for (const background of backgrounds) for (const pattern of patterns) {
      const { ctx, texts } = fakeCtx();
      drawCover(ctx, 540, { ...defaultCover(), background, pattern, subtitle: "demo" }, "a very long song title that has to wrap onto more lines", null);
      expect(texts).toContain("hum.");
      expect(texts).toContain("demo");
      expect(texts.length).toBeGreaterThan(3); // wrapped title lines + subtitle + mark
    }
  });

  it("is stored with the song, cleaned on load, and its picture stays referenced", () => {
    const s = normalizeSong({ id: "s", cover: { background: "image", color: "javascript:alert(1)", pattern: "lol", imageKey: "s:cover:1", subtitle: "x".repeat(200) } });
    expect(s.cover?.color).toBe("#F7DDE5");
    expect(s.cover?.pattern).toBe("dots");
    expect(s.cover?.subtitle).toHaveLength(60);
    expect(referencedKeys(s).has("s:cover:1")).toBe(true);
    expect(normalizeSong({ id: "t" }).cover).toBeNull();
  });
});
