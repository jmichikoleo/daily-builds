import type { CollageFormatId } from "../collage/formats";
import type { ThemeId } from "../themes";

export type LayoutPreset = "scattered" | "passport" | "postcard" | "archive";
export type FontPreset = "passport" | "postcard" | "atlas" | "typewriter";
export type TitleAlign = "left" | "center";
export type BackgroundTexture = "none" | "grain" | "aged" | "linen" | "dots" | "grid";
export type BackgroundBorder = "none" | "hairline" | "double" | "airmail" | "registration";

/**
 * A user's manual placement of one stamp, in normalised canvas coordinates
 * (0–1 of canvas width/height), so it survives any rendering size.
 */
export interface StampOverride {
  /** Centre, as a fraction of canvas width / height. */
  x: number;
  y: number;
  /** Stamp width as a fraction of canvas width. */
  w: number;
  /** Degrees. */
  rotation: number;
  /** Layer order; higher draws on top. */
  z: number;
}

/**
 * Everything about how the collage looks. Fields left undefined follow the
 * theme's defaults, so switching themes restyles the collage while explicit
 * choices survive.
 */
export interface StudioDesign {
  themeId: ThemeId;
  formatId: CollageFormatId;
  layout: {
    /** undefined → the theme's default preset. */
    preset?: LayoutPreset;
    /** Changing this ("Shuffle") rearranges without touching stamps. */
    seed: number;
  };
  text: {
    /** Empty → automatic title. */
    title: string;
    subtitle: string;
    /** Empty → stamp and country count (when shown). */
    footer: string;
    align?: TitleAlign;
    font?: FontPreset;
    /** undefined → theme text colour. */
    color?: string;
    showCount: boolean;
    showAttribution: boolean;
  };
  background: {
    paper?: string;
    texture?: BackgroundTexture;
    border?: BackgroundBorder;
    showAccents: boolean;
  };
  /** Manual placements per format, keyed by collection entry id. */
  overrides: Record<CollageFormatId, Record<string, StampOverride>>;
}

export const MAX_SUBTITLE_LENGTH = 60;
export const MAX_FOOTER_LENGTH = 48;

export function createDefaultStudio(): StudioDesign {
  return {
    themeId: "classic",
    formatId: "story",
    layout: { seed: 1 },
    text: { title: "", subtitle: "", footer: "", showCount: true, showAttribution: true },
    background: { showAccents: true },
    overrides: { story: {}, square: {} },
  };
}

export const LAYOUT_PRESETS: readonly { id: LayoutPreset; name: string; description: string }[] = [
  { id: "scattered", name: "Scattered Memories", description: "Organic scrapbook, gentle tilts" },
  { id: "passport", name: "Passport Pages", description: "Rows and columns, like a real passport" },
  { id: "postcard", name: "Postcard Wall", description: "Mixed sizes, editorial collage" },
  { id: "archive", name: "Minimal Archive", description: "Clean grid, captions, white space" },
];

export const TITLE_SUGGESTIONS = (year: number): string[] => [
  `${year}, in stamps.`,
  "Places I Went",
  "My Little World Tour",
  "A Year of Somewhere",
  "Collected Along the Way",
];

export function isLayoutPreset(v: unknown): v is LayoutPreset {
  return typeof v === "string" && LAYOUT_PRESETS.some((p) => p.id === v);
}
