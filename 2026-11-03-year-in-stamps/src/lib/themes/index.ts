import type { StampStyle } from "../stamps/types";
import type { BackgroundBorder, BackgroundTexture, FontPreset, LayoutPreset, TitleAlign } from "../studio/types";

export type ThemeId = "classic" | "pink" | "editorial";
export type AccentKind = "postmark" | "airmail" | "registration";

export interface CollageTheme {
  id: ThemeId;
  name: string;
  mood: string;
  /** Default paper colour, and a second tone for vignettes and bands. */
  paper: string;
  paperAlt: string;
  /** Main text colour, secondary text/rules, and the highlight colour. */
  text: string;
  muted: string;
  accent: string;
  /** Stamp inks; each stamp without a custom ink picks one deterministically. */
  inks: readonly string[];
  /** Stamp silhouettes used for stamps without a chosen style. */
  styles: readonly StampStyle[];
  /** Defaults the user can override in the studio. */
  defaults: {
    font: FontPreset;
    align: TitleAlign;
    layout: LayoutPreset;
    texture: BackgroundTexture;
    border: BackgroundBorder;
  };
  accents: AccentKind;
  /** Kicker printed above the year. */
  kicker: string;
  /** Curated choices offered by the background and text controls. */
  paperSwatches: readonly string[];
  textSwatches: readonly string[];
}

export const THEMES: Record<ThemeId, CollageTheme> = {
  classic: {
    id: "classic",
    name: "Classic Passport",
    mood: "Nostalgic, well-travelled, timeless",
    paper: "#F4ECDD",
    paperAlt: "#E6D8BF",
    text: "#23304A",
    muted: "#8A7C66",
    accent: "#793F57",
    inks: ["#23395B", "#793F57", "#23395B", "#8E3B46", "#2F4A6D"],
    styles: ["immigration", "border", "doubleRing", "entry"],
    defaults: { font: "passport", align: "left", layout: "passport", texture: "aged", border: "double" },
    accents: "postmark",
    kicker: "PASSPORT · YOUR YEAR IN STAMPS",
    paperSwatches: ["#F4ECDD", "#EFE3CC", "#F7F2E7", "#E9DDC8"],
    textSwatches: ["#23304A", "#793F57", "#2B2A33", "#8E3B46"],
  },
  pink: {
    id: "pink",
    name: "Pink Postcard",
    mood: "Dreamy, collectible, charming",
    paper: "#FBF5F2",
    paperAlt: "#F4DDE4",
    text: "#6E4A63",
    muted: "#B08A99",
    accent: "#C8879E",
    inks: ["#C8879E", "#6E4A63", "#A86A82", "#8E5A7C"],
    styles: ["postage", "entry", "immigration", "doubleRing"],
    defaults: { font: "postcard", align: "center", layout: "scattered", texture: "grain", border: "airmail" },
    accents: "airmail",
    kicker: "WISH YOU WERE HERE",
    paperSwatches: ["#FBF5F2", "#F4DDE4", "#F8EAEE", "#FFFFFF"],
    textSwatches: ["#6E4A63", "#C8879E", "#8E5A7C", "#302B2E"],
  },
  editorial: {
    id: "editorial",
    name: "Editorial Atlas",
    mood: "Sophisticated, contemporary, curated",
    paper: "#F5F3EE",
    paperAlt: "#E8E5DD",
    text: "#2E2B2C",
    muted: "#8A857F",
    accent: "#B8644A",
    inks: ["#2E2B2C", "#6F8370", "#B8644A", "#2E2B2C"],
    styles: ["editorial", "border", "immigration"],
    defaults: { font: "atlas", align: "left", layout: "postcard", texture: "none", border: "registration" },
    accents: "registration",
    kicker: "THE ATLAS · TRAVEL ISSUE",
    paperSwatches: ["#F5F3EE", "#FFFFFF", "#ECEAE3", "#E4E8E0"],
    textSwatches: ["#2E2B2C", "#B8644A", "#6F8370", "#23304A"],
  },
};

export const THEME_LIST: readonly CollageTheme[] = [THEMES.classic, THEMES.pink, THEMES.editorial];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in THEMES;
}

/** Inks used for stamps outside the collage (landing page, lists). */
export const UI_INKS: readonly string[] = ["#793F57", "#2F4A6D", "#A23B3B", "#C8879E", "#3F6B4E"];
