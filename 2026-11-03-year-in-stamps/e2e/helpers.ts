import { expect, type Download, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const OUTPUT_DIR = join(__dirname, "..", "e2e-output");

/** Width/height from a PNG's IHDR chunk. */
export function pngSize(path: string): { width: number; height: number } {
  const b = readFileSync(path);
  expect(b.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

export async function saveDownload(download: Download, name: string): Promise<string> {
  const path = join(OUTPUT_DIR, name);
  mkdirSync(dirname(path), { recursive: true });
  await download.saveAs(path);
  return path;
}

/**
 * Write a v4 draft with `count` real catalog places straight into storage,
 * the way a returning user's browser would have it.
 */
export async function seedDraft(page: Page, opts: { count: number; themeId: string; formatId: "story" | "square"; preset?: string; title?: string }) {
  await page.goto("/privacy"); // any same-origin page, before the studio reads storage
  await page.evaluate(async ({ count, themeId, formatId, preset, title }) => {
    const c = await (await fetch("/data/catalog.v1.json")).json();
    const names = new Map<string, string>(c.countries.map((x: [string, string]) => [x[0], x[1]]));
    const motifs = ["skyline", "houses", "columns", "tower", "temple", "wave", "palm", "sun"];
    const picks = c.cities.filter((x: number[]) => x[4] > 500).slice(0, count);
    const entries = picks.map((x: [number, string, string], i: number) => ({
      id: `seed-${i}`,
      placeId: `gn:${x[0]}`,
      place: { name: x[1], kind: "city", isoCode: x[2], countryName: names.get(x[2]), motif: motifs[i % motifs.length] },
      visit: i % 3 === 0 ? { precision: "month", date: `2026-${String((i % 12) + 1).padStart(2, "0")}` } : { precision: "unknown" },
      design: { variant: 0, showDate: true },
    }));
    const studio = {
      themeId,
      formatId,
      layout: preset ? { preset, seed: 1 } : { seed: 1 },
      text: { title: title ?? "", subtitle: "", footer: "", showCount: true, showAttribution: true },
      background: { showAccents: true },
      overrides: { story: {}, square: {} },
    };
    const draft = { year: 2026, nickname: "", entries, sort: "added", studio };
    localStorage.setItem("year-in-stamps:draft", JSON.stringify({ version: 4, savedAt: new Date().toISOString(), draft }));
  }, opts);
}

/** Open the export dialog and wait for the generated PNG preview. */
export async function openExport(page: Page) {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Save your passport/ });
  await expect(dialog).toBeVisible();
  await expectPreviewReady(page);
  return dialog;
}

export async function expectPreviewReady(page: Page) {
  await expect
    .poll(() => page.evaluate(() => (document.querySelector("dialog[open] img") as HTMLImageElement | null)?.naturalWidth ?? 0), { timeout: 30_000 })
    .toBeGreaterThan(0);
}

/**
 * Mean absolute RGB difference (0–255) between two images after scaling both
 * to 108 px wide — small text antialiasing differences barely register,
 * missing fonts, stamps or wrong colours do.
 */
export async function imageDifference(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ({ a, b }) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const [ia, ib] = await Promise.all([load(`data:image/png;base64,${a}`), load(`data:image/png;base64,${b}`)]);
      const w = 108;
      const h = Math.round((w * ia.naturalHeight) / ia.naturalWidth);
      const pixels = (img: HTMLImageElement) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const pa = pixels(ia);
      const pb = pixels(ib);
      let sum = 0;
      for (let i = 0; i < pa.length; i += 4) sum += Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
      return sum / ((pa.length / 4) * 3);
    },
    { a: a.toString("base64"), b: b.toString("base64") },
  );
}

/** The live (editable) collage SVG in the studio. */
export const liveCanvas = (page: Page) => page.locator('section[aria-label="Collage canvas"] svg[viewBox^="0 0 1080"]');
