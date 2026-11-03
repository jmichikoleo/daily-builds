import { stampLabelOf } from "../catalog/snapshot";
import type { CollectionEntry } from "../passport/types";
import { formatVisit, hasYearConflict } from "../passport/visits";
import { hashString } from "./random";
import { STAMP_STYLES, type StampBorder, type StampDesign, type StampModel, type StampStyle } from "./types";

const BORDERS: readonly StampBorder[] = ["double", "dashed", "dotted"];

/**
 * What the stamp prints. Dates outside the passport year (an unresolved
 * conflict) and unknown dates print just the passport year.
 */
export function stampModelOf(entry: CollectionEntry, passportYear: number): StampModel {
  let dateText: string | undefined;
  if (entry.design.showDate) {
    const known = hasYearConflict(entry.visit, passportYear) ? null : formatVisit(entry.visit);
    dateText = (known ?? String(passportYear)).toUpperCase();
  }
  return {
    id: entry.id,
    name: entry.place.name,
    label: stampLabelOf(entry.place),
    kind: entry.place.kind,
    code: entry.place.isoCode,
    motif: entry.place.motif,
    dateText,
  };
}

/**
 * Resolve the visual treatment. Deterministic: decorative details come from
 * the place id + variant (so "Regenerate" just bumps the variant), and the
 * user's explicit style/ink choices win over the derived ones.
 */
export function designStampFor(
  entry: Pick<CollectionEntry, "placeId" | "design">,
  inks: readonly string[],
  styles: readonly StampStyle[] = STAMP_STYLES.map((s) => s.id),
): StampDesign {
  const { variant, style, ink } = entry.design;
  const h = hashString(`${entry.placeId}#${variant}`);
  return {
    style: style ?? styles[h % styles.length],
    border: BORDERS[(h >>> 4) % BORDERS.length],
    ink: ink ?? inks[(h >>> 8) % inks.length],
    rotation: ((h >>> 12) % 15) - 7,
    seed: (h >>> 16) % 97,
    serial: `No. ${String((h >>> 3) % 10000).padStart(4, "0")}`,
  };
}

/** The variant a new visit to a place should use, so it looks different from earlier visits. */
export function nextVariant(entries: readonly CollectionEntry[], placeId: string): number {
  let max = -1;
  for (const e of entries) if (e.placeId === placeId && e.design.variant > max) max = e.design.variant;
  return max + 1;
}
