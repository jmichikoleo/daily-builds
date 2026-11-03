import { ExportError } from "./errors";
import { parseUnicodeRange, rangeCovers } from "./svg";

/** One @font-face from the page's own (same-origin, next/font) stylesheets. */
export interface PageFontFace {
  family: string;
  style: string;
  weight: string;
  unicodeRange: string;
  url: string;
}

const unquote = (s: string) => s.trim().replace(/^['"]|['"]$/g, "");

/** Read @font-face rules that load a real file (skips next/font's local() fallbacks). */
export function collectPageFontFaces(doc: Document = document): PageFontFace[] {
  const faces: PageFontFace[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet; ours are all same-origin
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const src = rule.style.getPropertyValue("src");
      const match = src.match(/url\(["']?([^"')]+)["']?\)/);
      if (!match) continue;
      faces.push({
        family: unquote(rule.style.getPropertyValue("font-family")),
        style: rule.style.getPropertyValue("font-style") || "normal",
        weight: rule.style.getPropertyValue("font-weight") || "400",
        unicodeRange: rule.style.getPropertyValue("unicode-range"),
        url: new URL(match[1], sheet.href ?? doc.baseURI).href,
      });
    }
  }
  return faces;
}

/**
 * Keep the faces this collage needs: its families, and only the subsets
 * (unicode ranges) its text uses. Faces sharing a file are merged into one
 * rule with a weight range, so each file is embedded once.
 */
export function selectFaces(faces: readonly PageFontFace[], families: ReadonlySet<string>, codePoints: ReadonlySet<number>): PageFontFace[] {
  const merged = new Map<string, PageFontFace & { min: number; max: number }>();
  for (const f of faces) {
    if (!families.has(f.family) || !rangeCovers(parseUnicodeRange(f.unicodeRange), codePoints)) continue;
    const [lo, hi = lo] = f.weight.split(/\s+/).map(Number);
    const key = `${f.family}|${f.style}|${f.url}`;
    const existing = merged.get(key);
    if (existing) {
      existing.min = Math.min(existing.min, lo);
      existing.max = Math.max(existing.max, hi);
    } else merged.set(key, { ...f, min: lo, max: hi });
  }
  return [...merged.values()].map(({ min, max, ...f }) => ({ ...f, weight: min === max ? String(min) : `${min} ${max}` }));
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const fileCache = new Map<string, Promise<string>>();

/**
 * Build @font-face CSS with the font files inlined as data URLs, so the SVG
 * needs nothing from the network when it is drawn. Any failure is an
 * ExportError("fonts"): we never silently export with substitute lettering.
 */
export async function embedFontCss(faces: readonly PageFontFace[], fetchFn: typeof fetch = fetch): Promise<string> {
  const rules = await Promise.all(
    faces.map(async (f) => {
      let data = fileCache.get(f.url);
      if (!data) {
        data = fetchFn(f.url).then(async (res) => {
          if (!res.ok) throw new Error(`${res.status} ${f.url}`);
          return toBase64(await res.arrayBuffer());
        });
        fileCache.set(f.url, data);
        data.catch(() => fileCache.delete(f.url));
      }
      try {
        const base64 = await data;
        const range = f.unicodeRange ? `unicode-range:${f.unicodeRange};` : "";
        return `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};${range}src:url(data:font/woff2;base64,${base64}) format("woff2");}`;
      } catch (err) {
        throw new ExportError("fonts", err instanceof Error ? err.message : String(err));
      }
    }),
  );
  return rules.join("");
}
