import { describe, expect, it } from "vitest";
import { composeCollage } from "../collage/compose";
import { createEmptyDraft, type CollectionEntry, type PassportDraft } from "../passport/types";
import { THEMES, type ThemeId } from "../themes";
import { ExportError } from "./errors";
import { exportFilename, slugify } from "./filename";
import { embedFontCss, selectFaces, type PageFontFace } from "./fonts";
import { pngDimensions } from "./raster";
import { renderPageMarkup } from "./render";
import { finalizeSvg, parseUnicodeRange, resolveCssVars, usedCodePoints, usedFontFamilies } from "./svg";
import { createZip, crc32 } from "./zip";

function entry(i: number, name = `Place ${i}`, date?: string): CollectionEntry {
  return {
    id: `e-${i}`,
    placeId: `gn:${100 + i}`,
    place: { name, kind: "city", isoCode: "KR", countryName: "South Korea", motif: "houses" },
    visit: date ? { precision: "month", date } : { precision: "unknown" },
    design: { variant: 0, showDate: true },
  };
}

function draft(n: number, opts: { themeId?: ThemeId; formatId?: "story" | "square"; title?: string } = {}): PassportDraft {
  const d = createEmptyDraft(2026);
  d.entries = Array.from({ length: n }, (_, i) => entry(i));
  d.studio = { ...d.studio, themeId: opts.themeId ?? "classic", formatId: opts.formatId ?? "story", text: { ...d.studio.text, title: opts.title ?? "" } };
  return d;
}

const stampCount = (svg: string) => (svg.match(/data-entry="/g) ?? []).length;

describe("export SVG (the same renderer as the studio)", () => {
  it("uses the Story and Square canvas sizes", () => {
    expect(renderPageMarkup(composeCollage(draft(3)), 0)).toMatch(/viewBox="0 0 1080 1920"/);
    expect(renderPageMarkup(composeCollage(draft(3, { formatId: "square" })), 0)).toMatch(/viewBox="0 0 1080 1080"/);
    const sized = finalizeSvg(renderPageMarkup(composeCollage(draft(3)), 0), 1080, 1920, "");
    expect(sized).toMatch(/^<svg width="1080" height="1920"/);
  });

  it("contains every stamp on the page, at the composed coordinates", () => {
    const collage = composeCollage(draft(5));
    const svg = renderPageMarkup(collage, 0);
    expect(stampCount(svg)).toBe(5);
    const first = collage.pages[0].layout.placements[0];
    expect(svg).toContain(`translate(${first.cx} ${first.cy}) rotate(${first.rotation})`);
  });

  it("splits large collections into pages with page numbers, and exports each separately", () => {
    for (const [n, pages] of [
      [1, 1],
      [5, 1],
      [15, 1],
      [25, 2],
      [40, 3],
    ] as const) {
      const collage = composeCollage({ ...draft(n), studio: { ...draft(n).studio, layout: { preset: "scattered", seed: 1 } } });
      expect(collage.pages).toHaveLength(pages);
      const counts = collage.pages.map((_, i) => stampCount(renderPageMarkup(collage, i)));
      expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
      if (pages > 1) expect(renderPageMarkup(collage, pages - 1)).toContain(`${pages} / ${pages}`);
    }
  });

  it("uses each theme's paper and ink colours", () => {
    for (const themeId of ["classic", "pink", "editorial"] as const) {
      const svg = renderPageMarkup(composeCollage(draft(3, { themeId })), 0);
      expect(svg).toContain(`fill="${THEMES[themeId].paper}"`);
      expect(THEMES[themeId].inks.some((ink) => svg.includes(ink))).toBe(true);
    }
  });

  it("renders the title and the attribution line", () => {
    const svg = renderPageMarkup(composeCollage(draft(2, { title: "Places I Went" })), 0);
    expect(svg).toContain(">Places I Went<");
    expect(svg).toContain("Made with Your Year in Stamps");
    const noCredit = draft(2);
    noCredit.studio.text.showAttribution = false;
    expect(renderPageMarkup(composeCollage(noCredit), 0)).not.toContain("Made with Your Year in Stamps");
  });

  it("fits long destination names and handles missing dates", () => {
    const d = draft(0);
    d.entries = [entry(1, "Setor Complementar de Indústria e Abastecimento"), entry(2, "Busan", "2026-03")];
    const svg = renderPageMarkup(composeCollage(d), 0);
    expect(stampCount(svg)).toBe(2);
    expect(svg).not.toMatch(/undefined|NaN/);
    expect(svg).toContain("MAR 2026");
    expect(svg).toContain("2026"); // stamps without a date print the passport year
  });
});

describe("making the SVG self-contained", () => {
  const markup = `<svg viewBox="0 0 10 10"><text style="font-family:var(--font-stamp), &#x27;Arial Narrow&#x27;, sans-serif">Hé</text></svg>`;
  const vars: Record<string, string> = { "--font-stamp": `var(--font-oswald), "Oswald Fallback"`, "--font-oswald": `"Oswald"` };

  it("resolves nested CSS variables safely inside attributes", () => {
    const out = resolveCssVars(markup, (n) => vars[n]);
    expect(out).not.toContain("var(");
    expect(out).toContain("font-family:&quot;Oswald&quot;, &quot;Oswald Fallback&quot;");
    expect(usedFontFamilies(out)).toEqual(new Set(["Oswald", "Oswald Fallback", "Arial Narrow", "sans-serif"]));
    expect(usedCodePoints(out)).toEqual(new Set(["H".codePointAt(0), "é".codePointAt(0)]));
  });

  it("embeds only the font subsets the text needs, each file once", () => {
    const faces: PageFontFace[] = [
      { family: "Oswald", style: "normal", weight: "400", unicodeRange: "U+0-FF", url: "/a.woff2" },
      { family: "Oswald", style: "normal", weight: "700", unicodeRange: "U+0-FF", url: "/a.woff2" },
      { family: "Oswald", style: "normal", weight: "400", unicodeRange: "U+400-45F", url: "/cyrillic.woff2" },
      { family: "Inter", style: "normal", weight: "400", unicodeRange: "U+0-FF", url: "/inter.woff2" },
    ];
    const chosen = selectFaces(faces, new Set(["Oswald"]), new Set([72, 233]));
    expect(chosen).toEqual([{ family: "Oswald", style: "normal", weight: "400 700", unicodeRange: "U+0-FF", url: "/a.woff2" }]);
    expect(parseUnicodeRange("U+2??, U+131")).toEqual([
      [0x200, 0x2ff],
      [0x131, 0x131],
    ]);
  });

  it("inlines fonts as data URLs", async () => {
    const fakeFetch = (async () => new Response(new Uint8Array([1, 2, 3]))) as typeof fetch;
    const css = await embedFontCss([{ family: "Oswald", style: "normal", weight: "400 700", unicodeRange: "U+0-FF", url: "https://x/ok.woff2" }], fakeFetch);
    expect(css).toContain('font-family:"Oswald"');
    expect(css).toContain("url(data:font/woff2;base64,AQID)");
  });

  it("fails with a clear error when a font can't be loaded", async () => {
    const failing = (async () => new Response("nope", { status: 404 })) as typeof fetch;
    const result = embedFontCss([{ family: "Oswald", style: "normal", weight: "400", unicodeRange: "", url: "https://x/missing.woff2" }], failing);
    await expect(result).rejects.toBeInstanceOf(ExportError);
    await expect(result).rejects.toMatchObject({ code: "fonts" });
  });
});

describe("files", () => {
  it("names files safely", () => {
    expect(exportFilename({ nickname: "", year: 2026, format: "story" })).toBe("my-2026-passport-story.png");
    expect(exportFilename({ nickname: "Mochi 🍡 / Café", year: 2026, format: "square" })).toBe("mochi-cafe-2026-passport-square.png");
    expect(exportFilename({ nickname: "", year: 2026, format: "story", page: 2, pages: 3 })).toBe("my-2026-passport-story-page-2.png");
    expect(exportFilename({ nickname: "", year: 2026, format: "story", ext: "zip" })).toBe("my-2026-passport-story-all-pages.zip");
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
  });

  it("reads PNG dimensions", () => {
    const header = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 4, 56, 0, 0, 7, 128]);
    expect(pngDimensions(header)).toEqual({ width: 1080, height: 1920 });
    expect(pngDimensions(new Uint8Array(10))).toBeNull();
  });

  it("writes a valid stored ZIP", () => {
    const a = new TextEncoder().encode("hello");
    const b = new Uint8Array([0, 255, 7]);
    const zip = createZip([
      { name: "a.png", data: a },
      { name: "b.png", data: b },
    ]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(14, true)).toBe(crc32(a));
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926); // standard check value
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
  });
});
