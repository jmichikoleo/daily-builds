import type { PlaceKind } from "../catalog/types";
import type { MotifId } from "./motifs";

/** The six stamp silhouettes. */
export type StampStyle = "immigration" | "entry" | "border" | "postage" | "doubleRing" | "editorial";
export type StampBorder = "double" | "dashed" | "dotted";

export const STAMP_STYLES: readonly { id: StampStyle; name: string; description: string }[] = [
  { id: "immigration", name: "Immigration", description: "Circular, name on the rim" },
  { id: "entry", name: "Entry", description: "Oval entry stamp" },
  { id: "border", name: "Border control", description: "Rectangular with serial" },
  { id: "postage", name: "Postage", description: "Perforated postage stamp" },
  { id: "doubleRing", name: "Double ring", description: "Postmark with date bar" },
  { id: "editorial", name: "Editorial", description: "Minimal, serif lettering" },
];

export function isStampStyle(value: unknown): value is StampStyle {
  return typeof value === "string" && STAMP_STYLES.some((s) => s.id === value);
}

/** Everything a stamp prints. */
export interface StampModel {
  /** Collection entry id (unique per stamp). */
  id: string;
  name: string;
  /** Second line, e.g. "South Korea", "SAR · China", "Country". */
  label: string;
  kind: PlaceKind;
  /** ISO code printed on the stamp, e.g. "JP". */
  code: string;
  motif: MotifId;
  /** Printed date ("14 MAR 2026", "MAR 2026", "2026"), or undefined to print none. */
  dateText?: string;
}

/** Resolved visual treatment for a stamp. Pure function of the entry and the ink palette. */
export interface StampDesign {
  style: StampStyle;
  border: StampBorder;
  ink: string;
  /** Degrees, roughly -7…7. */
  rotation: number;
  /** Small integer used for the ink-texture noise. */
  seed: number;
  /** Decorative serial, e.g. "No. 0427". */
  serial: string;
}

/** Natural size of each style's viewBox. */
export const STAMP_VIEWBOX: Record<StampStyle, { width: number; height: number }> = {
  immigration: { width: 200, height: 200 },
  entry: { width: 240, height: 160 },
  border: { width: 240, height: 170 },
  postage: { width: 180, height: 220 },
  doubleRing: { width: 200, height: 200 },
  editorial: { width: 240, height: 150 },
};

/** Inks offered in the stamp editor (the theme's own inks are the default). */
export const INK_SWATCHES: readonly { value: string; name: string }[] = [
  { value: "#793F57", name: "Burgundy" },
  { value: "#C8879E", name: "Dusty rose" },
  { value: "#A23B3B", name: "Red" },
  { value: "#2F4A6D", name: "Navy" },
  { value: "#3F6B4E", name: "Green" },
  { value: "#5B4A7A", name: "Violet" },
  { value: "#B5763A", name: "Ochre" },
  { value: "#302B2E", name: "Charcoal" },
];

export function isInk(value: unknown): value is string {
  return typeof value === "string" && INK_SWATCHES.some((s) => s.value === value);
}
