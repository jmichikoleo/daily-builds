import { describe, expect, it } from "vitest";
import { GLYPH_WIDTH, fitBlock, fitLine } from "./text";

const opts = { maxWidth: 150, maxSize: 26, minSize: 10, glyph: GLYPH_WIDTH.stamp, maxHeight: 40 };

const estimated = (text: string, size: number) => text.length * size * GLYPH_WIDTH.stamp;

describe("stamp text fitting", () => {
  it("keeps short names at full size on one line", () => {
    const block = fitBlock("PARIS", opts);
    expect(block.lines).toHaveLength(1);
    expect(block.size).toBeGreaterThan(20);
  });

  it("splits long multi-word names over two lines instead of shrinking them to nothing", () => {
    const block = fitBlock("SOUTH GEORGIA AND THE SOUTH SANDWICH ISLANDS", opts);
    expect(block.lines).toHaveLength(2);
    for (const line of block.lines) {
      expect(line.textLength ?? estimated(line.text, line.size)).toBeLessThanOrEqual(opts.maxWidth + 0.01);
    }
  });

  it("breaks at hyphens and dashes", () => {
    const block = fitBlock("RIVIÈRE-DES-PRAIRIES–POINTE-AUX-TREMBLES", opts);
    expect(block.lines).toHaveLength(2);
    expect(block.lines[0].text.endsWith("–") || block.lines[0].text.endsWith("-")).toBe(true);
  });

  it("never overflows: compresses when the minimum size is still too wide", () => {
    const line = fitLine("A".repeat(60), { ...opts });
    expect(line.size).toBe(opts.minSize);
    expect(line.textLength).toBe(opts.maxWidth);
  });

  it("respects the box height for two lines", () => {
    const block = fitBlock("SAINT VINCENT AND THE GRENADINES", { ...opts, maxHeight: 24 });
    const height = block.size * 0.74 + (block.lines.length - 1) * block.lineHeight;
    expect(height).toBeLessThanOrEqual(24.5);
  });
});
