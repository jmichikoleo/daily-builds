import { automaticTitle, displayTitle, type CollectionEntry, type PassportDraft } from "../passport/types";
import { sortEntries } from "../passport/visits";
import { designStampFor, stampModelOf } from "../stamps/design";
import { STAMP_VIEWBOX, type StampDesign, type StampModel } from "../stamps/types";
import type { StampOverride } from "../studio/types";
import type { CollageTheme } from "../themes";
import { COLLAGE_FORMATS, type CollageFormat } from "./formats";
import { computeFrame, resolveStudio, type Frame, type ResolvedStudio } from "./frame";
import { PAGE_CAPACITY, containPlacement, layoutPage, paginate, type PageLayout, type Placement } from "./layout";

export interface ComposedStamp {
  entry: CollectionEntry;
  model: StampModel;
  design: StampDesign;
  /** Natural width / height of the artwork. */
  aspect: number;
}

export interface CollectionStats {
  stamps: number;
  /** Distinct places (two Busan visits count once). */
  destinations: number;
  /** Distinct countries and territories represented, by ISO code. */
  countries: number;
  /** Distinct cities. */
  cities: number;
}

export function collectionStats(entries: readonly CollectionEntry[]): CollectionStats {
  const places = new Set<string>();
  const countries = new Set<string>();
  const cities = new Set<string>();
  for (const e of entries) {
    places.add(e.placeId);
    if (e.place.isoCode) countries.add(e.place.isoCode);
    if (e.place.kind === "city") cities.add(e.placeId);
  }
  return { stamps: entries.length, destinations: places.size, countries: countries.size, cities: cities.size };
}

export interface ComposedPage {
  index: number;
  frame: Frame;
  layout: PageLayout;
}

/** Everything the collage renderer needs, derived purely from the draft. */
export interface ComposedCollage {
  title: string;
  year: number;
  format: CollageFormat;
  resolved: ResolvedStudio;
  theme: CollageTheme;
  pages: ComposedPage[];
  stamps: ReadonlyMap<string, ComposedStamp>;
  stats: CollectionStats;
}

export function composeStamp(entry: CollectionEntry, year: number, inks: readonly string[], styles?: CollageTheme["styles"]): ComposedStamp {
  const design = designStampFor(entry, inks, styles);
  const box = STAMP_VIEWBOX[design.style];
  return { entry, model: stampModelOf(entry, year), design, aspect: box.width / box.height };
}

export function countSummary(stats: CollectionStats): string {
  if (stats.stamps === 0) return "";
  return `${stats.stamps} ${stats.stamps === 1 ? "stamp" : "stamps"} · ${stats.countries} ${stats.countries === 1 ? "country or territory" : "countries & territories"}`;
}

/** Turn a normalised manual placement back into canvas units, kept inside the canvas. */
export function placementFromOverride(id: string, o: StampOverride, aspect: number, format: CollageFormat, margin: number): Placement {
  const w = o.w * format.width;
  const inset = margin * 0.5;
  return containPlacement(
    { id, cx: o.x * format.width, cy: o.y * format.height, w, h: w / aspect, rotation: o.rotation, z: o.z },
    { x: inset, y: inset, width: format.width - inset * 2, height: format.height - inset * 2 },
  );
}

/** Normalise a placement for storage. */
export function overrideFromPlacement(p: Placement, format: CollageFormat): StampOverride {
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return { x: round(p.cx / format.width), y: round(p.cy / format.height), w: round(p.w / format.width), rotation: Math.round(p.rotation * 10) / 10, z: p.z };
}

/**
 * Compose the whole collage: resolve theme defaults, sort and paginate the
 * stamps, lay out each page, then apply the user's manual placements.
 */
export function composeCollage(draft: PassportDraft): ComposedCollage {
  const { studio } = draft;
  const resolved = resolveStudio(studio);
  const { theme } = resolved;
  const format = COLLAGE_FORMATS[studio.formatId];
  const stats = collectionStats(draft.entries);

  const sorted = sortEntries(draft.entries, draft.sort);
  const stamps = new Map(sorted.map((e) => [e.id, composeStamp(e, draft.year, theme.inks, theme.styles)]));
  const groups = paginate(sorted, PAGE_CAPACITY[format.id][resolved.preset]);
  const overrides = studio.overrides[format.id];
  const title = displayTitle(draft);
  const footerLeft = studio.text.footer.trim() || (studio.text.showCount ? countSummary(stats) : "");

  const pages = groups.map((group, index) => {
    const pageMark = groups.length > 1 ? `${index + 1} / ${groups.length}` : "";
    const footerRight = [studio.text.showAttribution ? "Made with Your Year in Stamps" : "", pageMark].filter(Boolean).join("  ·  ");
    const frame = computeFrame(format, resolved, { title, subtitle: studio.text.subtitle, year: draft.year, footerLeft, footerRight });
    const items = group.map((e) => {
      const s = stamps.get(e.id)!;
      return { id: e.id, aspect: s.aspect, baseRotation: s.design.rotation };
    });
    const layout = layoutPage(resolved.preset, items, frame.stampArea, `${resolved.seed}|${format.id}|${index}`);
    const placements = layout.placements.map((p) => {
      const o = overrides[p.id];
      if (!o) return p;
      // A manual placement replaces the automatic one; archive captions follow the stamp.
      const manual = placementFromOverride(p.id, o, stamps.get(p.id)!.aspect, format, frame.margin);
      return p.caption ? { ...manual, caption: { ...p.caption, x: manual.cx, y: manual.cy + manual.h / 2 + 22 } } : manual;
    });
    return { index, frame, layout: { ...layout, placements } };
  });

  return { title, year: draft.year, format, resolved, theme, pages, stamps, stats };
}

export { automaticTitle };
