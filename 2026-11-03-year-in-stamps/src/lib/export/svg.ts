/**
 * Turning the collage's SVG markup into a self-contained document that renders
 * identically as an <img>: CSS variables resolved, fonts embedded, explicit
 * pixel size. Pure string work, so it is unit-tested in Node.
 */

const VAR_RE = /var\((--[a-zA-Z0-9-]+)\)/g;

/**
 * Replace `var(--name)` with its value (repeatedly, for variables that refer
 * to variables). Values are escaped for use inside a double-quoted attribute.
 */
export function resolveCssVars(markup: string, lookup: (name: string) => string | undefined): string {
  let out = markup;
  for (let pass = 0; pass < 4; pass++) {
    const next = out.replace(VAR_RE, (whole, name: string) => {
      const value = lookup(name)?.trim();
      return value ? value.replace(/"/g, "&quot;").replace(/'/g, "&#x27;") : whole;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

const decodeEntities = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Font families named in `font-family:` declarations, e.g. {"Fraunces", "DM Mono"}. */
export function usedFontFamilies(markup: string): Set<string> {
  const families = new Set<string>();
  // Decode each style attribute first: entity-escaped quotes (&quot;) contain ";".
  for (const attr of markup.matchAll(/\sstyle="([^"]*)"/g)) {
    for (const decl of decodeEntities(attr[1]).split(";")) {
      const m = decl.match(/^\s*font-family\s*:(.*)$/);
      if (!m) continue;
      for (const part of m[1].split(",")) {
        const name = part.trim().replace(/^['"]|['"]$/g, "");
        if (name) families.add(name);
      }
    }
  }
  return families;
}

/** Every character drawn as text, as code points (for picking font subsets). */
export function usedCodePoints(markup: string): Set<number> {
  const points = new Set<number>();
  for (const m of markup.matchAll(/>([^<>]+)</g)) {
    for (const ch of decodeEntities(m[1])) points.add(ch.codePointAt(0)!);
  }
  return points;
}

/** Parse a CSS `unicode-range` ("U+0-FF, U+131, U+2??") into inclusive ranges. */
export function parseUnicodeRange(range: string): [number, number][] {
  if (!range.trim()) return [[0, 0x10ffff]];
  return range.split(",").map((raw) => {
    const part = raw.trim().replace(/^U\+/i, "");
    if (part.includes("?")) return [parseInt(part.replace(/\?/g, "0"), 16), parseInt(part.replace(/\?/g, "F"), 16)];
    const [a, b] = part.split("-");
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });
}

export function rangeCovers(ranges: [number, number][], points: Iterable<number>): boolean {
  for (const p of points) if (ranges.some(([a, b]) => p >= a && p <= b)) return true;
  return false;
}

/** Give the SVG an explicit pixel size and put `css` in a <style> right after the opening tag. */
export function finalizeSvg(markup: string, width: number, height: number, css: string): string {
  const open = markup.match(/^<svg\b[^>]*>/);
  if (!open) throw new Error("Not an SVG document");
  let tag = open[0].replace(/\s(width|height)="[^"]*"/g, "");
  if (!/xmlns=/.test(tag)) tag = tag.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  tag = tag.replace("<svg", `<svg width="${width}" height="${height}"`);
  const style = css ? `<style>${css.replace(/<\//g, "<\\/")}</style>` : "";
  return `${tag}${style}${markup.slice(open[0].length)}`;
}
