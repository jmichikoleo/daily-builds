import type { FontPreset } from "../studio/types";

/**
 * Curated font pairings for collage text. All faces are self-hosted by
 * next/font (no runtime requests), referenced here through CSS variables.
 * `glyph` is the average glyph width used for deterministic text fitting.
 */
export interface FontFace {
  family: string;
  weight: number;
  italic: boolean;
  glyph: number;
  /** Letter spacing in em. */
  tracking: number;
  uppercase: boolean;
}

export interface FontPairing {
  id: FontPreset;
  name: string;
  title: FontFace;
  year: FontFace;
  kicker: FontFace;
  body: FontFace;
}

const FRAUNCES = "var(--font-fraunces), Georgia, serif";
const CORMORANT = "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif";
const GROTESK = "var(--font-grotesk), 'Space Grotesk', system-ui, sans-serif";
const OSWALD = "var(--font-oswald), 'Arial Narrow', sans-serif";
const MONO = "var(--font-mono), ui-monospace, monospace";

const face = (family: string, weight: number, glyph: number, extra: Partial<FontFace> = {}): FontFace => ({
  family,
  weight,
  glyph,
  italic: false,
  tracking: 0,
  uppercase: false,
  ...extra,
});

export const FONT_PRESETS: Record<FontPreset, FontPairing> = {
  passport: {
    id: "passport",
    name: "Passport",
    title: face(FRAUNCES, 500, 0.5, { tracking: -0.01 }),
    year: face(FRAUNCES, 400, 0.56, { tracking: -0.03 }),
    kicker: face(OSWALD, 500, 0.58, { tracking: 0.3, uppercase: true }),
    body: face(MONO, 400, 0.62, { tracking: 0.08, uppercase: true }),
  },
  postcard: {
    id: "postcard",
    name: "Postcard",
    title: face(CORMORANT, 500, 0.42, { italic: true }),
    year: face(CORMORANT, 500, 0.5, { italic: true, tracking: -0.02 }),
    kicker: face(CORMORANT, 600, 0.5, { tracking: 0.32, uppercase: true }),
    body: face(CORMORANT, 500, 0.45, { italic: true }),
  },
  atlas: {
    id: "atlas",
    name: "Atlas",
    title: face(GROTESK, 600, 0.55, { tracking: -0.03 }),
    year: face(GROTESK, 700, 0.6, { tracking: -0.05 }),
    kicker: face(MONO, 500, 0.62, { tracking: 0.22, uppercase: true }),
    body: face(MONO, 400, 0.62, { tracking: 0.06, uppercase: true }),
  },
  typewriter: {
    id: "typewriter",
    name: "Typewriter",
    title: face(MONO, 500, 0.62, { tracking: -0.02 }),
    year: face(MONO, 500, 0.62, { tracking: -0.04 }),
    kicker: face(MONO, 400, 0.62, { tracking: 0.25, uppercase: true }),
    body: face(MONO, 400, 0.62, { tracking: 0.05, uppercase: true }),
  },
};

export const FONT_PRESET_LIST: readonly FontPairing[] = [
  FONT_PRESETS.passport,
  FONT_PRESETS.postcard,
  FONT_PRESETS.atlas,
  FONT_PRESETS.typewriter,
];
