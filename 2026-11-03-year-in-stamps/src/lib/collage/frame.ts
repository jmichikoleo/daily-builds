import { fitBlock, fitLine, type FittedLine } from "../stamps/text";
import type { StudioDesign } from "../studio/types";
import { FONT_PRESETS, type FontFace, type FontPairing } from "../themes/fonts";
import { THEMES, type CollageTheme } from "../themes";
import type { CollageFormat } from "./formats";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The studio design with every "theme default" filled in. */
export interface ResolvedStudio {
  theme: CollageTheme;
  fonts: FontPairing;
  align: "left" | "center";
  /** Year, rules and footer. */
  textColor: string;
  /** The title: the theme's accent unless the user picked a text colour. */
  titleColor: string;
  paper: string;
  texture: NonNullable<StudioDesign["background"]["texture"]>;
  border: NonNullable<StudioDesign["background"]["border"]>;
  showAccents: boolean;
  preset: NonNullable<StudioDesign["layout"]["preset"]>;
  seed: number;
}

export function resolveStudio(studio: StudioDesign): ResolvedStudio {
  const theme = THEMES[studio.themeId];
  return {
    theme,
    fonts: FONT_PRESETS[studio.text.font ?? theme.defaults.font],
    align: studio.text.align ?? theme.defaults.align,
    textColor: studio.text.color ?? theme.text,
    titleColor: studio.text.color ?? theme.accent,
    paper: studio.background.paper ?? theme.paper,
    texture: studio.background.texture ?? theme.defaults.texture,
    border: studio.background.border ?? theme.defaults.border,
    showAccents: studio.background.showAccents,
    preset: studio.layout.preset ?? theme.defaults.layout,
    seed: studio.layout.seed,
  };
}

export interface TextLine extends FittedLine {
  x: number;
  y: number;
  face: FontFace;
}

export interface Frame {
  width: number;
  height: number;
  /** Nothing is drawn outside this inset (borders sit between it and the edge). */
  margin: number;
  /** Where stamps may go: below the header, above the footer, inside the margins. */
  stampArea: Rect;
  anchor: "start" | "middle";
  kicker: TextLine;
  year: TextLine;
  title: TextLine[];
  subtitle?: TextLine;
  headerRuleY: number;
  footerRuleY: number;
  footerLeft?: TextLine;
  footerRight?: TextLine;
}

interface FrameMetrics {
  margin: number;
  kicker: number;
  year: number;
  title: { max: number; min: number };
  subtitle: number;
  footer: number;
  footerBand: number;
  gap: number;
}

const METRICS: Record<CollageFormat["id"], FrameMetrics> = {
  story: { margin: 80, kicker: 22, year: 230, title: { max: 70, min: 34 }, subtitle: 32, footer: 24, footerBand: 72, gap: 40 },
  square: { margin: 60, kicker: 17, year: 124, title: { max: 46, min: 24 }, subtitle: 22, footer: 18, footerBand: 52, gap: 26 },
};

const CAP = 0.72;

function line(text: string, face: FontFace, maxWidth: number, maxSize: number, minSize: number, x: number, y: number): TextLine {
  const shown = face.uppercase ? text.toUpperCase() : text;
  const fit = fitLine(shown, { maxWidth, maxSize, minSize, glyph: face.glyph + face.tracking });
  return { ...fit, x, y, face };
}

export interface FrameText {
  title: string;
  subtitle: string;
  year: number;
  footerLeft: string;
  footerRight: string;
}

/**
 * Lay out the collage's text and the safe area for stamps. Pure and
 * deterministic, so the preview and a future export produce the same image.
 */
export function computeFrame(format: CollageFormat, resolved: ResolvedStudio, text: FrameText): Frame {
  const m = METRICS[format.id];
  const { width: W, height: H } = format;
  const inner = W - m.margin * 2;
  const anchor = resolved.align === "center" ? "middle" : "start";
  const x = anchor === "middle" ? W / 2 : m.margin;
  const { fonts } = resolved;

  let y = m.margin + m.kicker * 1.1;
  const kicker = line(resolved.theme.kicker.replace("{year}", String(text.year)), fonts.kicker, inner, m.kicker, m.kicker * 0.6, x, y);

  y += m.gap * 0.4 + m.year * CAP;
  const year = line(String(text.year), fonts.year, inner, m.year, m.year * 0.5, anchor === "start" ? x - m.year * 0.03 : x, y);

  const titleText = fonts.title.uppercase ? text.title.toUpperCase() : text.title;
  const block = fitBlock(titleText, {
    maxWidth: inner,
    maxHeight: m.title.max * 2.1,
    maxSize: m.title.max,
    minSize: m.title.min,
    glyph: fonts.title.glyph + fonts.title.tracking,
  });
  const lineHeight = block.size * 1.1;
  y += m.gap * 0.5 + block.size * 0.8;
  const title = block.lines.map((l, i) => ({ ...l, x, y: y + i * lineHeight, face: fonts.title }));
  y += (block.lines.length - 1) * lineHeight;

  let subtitle: TextLine | undefined;
  if (text.subtitle.trim()) {
    y += m.subtitle * 1.5;
    subtitle = line(text.subtitle.trim(), fonts.body, inner, m.subtitle, m.subtitle * 0.6, x, y);
  }

  const headerRuleY = y + m.gap * 0.8;
  const footerRuleY = H - m.margin - m.footerBand;
  const footerY = H - m.margin - m.footer * 0.4;
  const half = inner / 2 - 12;
  const footerLeft = text.footerLeft ? line(text.footerLeft, fonts.body, half, m.footer, m.footer * 0.6, m.margin, footerY) : undefined;
  const footerRight = text.footerRight
    ? line(text.footerRight, { ...fonts.body, uppercase: false }, half, m.footer, m.footer * 0.6, W - m.margin, footerY)
    : undefined;

  const pad = m.gap * 0.6;
  const stampArea = {
    x: m.margin - 12,
    y: headerRuleY + pad,
    width: inner + 24,
    height: footerRuleY - pad - (headerRuleY + pad),
  };

  return { width: W, height: H, margin: m.margin, stampArea, anchor, kicker, year, title, subtitle, headerRuleY, footerRuleY, footerLeft, footerRight };
}
