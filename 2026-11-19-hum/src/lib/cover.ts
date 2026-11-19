// src/lib/cover.ts
// song covers. one drawing function is used for the small preview, the library cards and the 1080px PNG.
import type { CoverConfig } from "./types";

export const COVER_SIZE = 1080;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const SWATCHES = ["#F7DDE5", "#DFA8C8", "#DCD0F3", "#FFF0BE", "#D4EDE4", "#E3EEF8", "#FFFDFB", "#39343B"];

export const defaultCover = (): CoverConfig => ({
  background: "gradient", color: "#F7DDE5", color2: "#DCD0F3", pattern: "dots", subtitle: "", textColor: "#39343B", imageKey: null,
});

/** Cheap checks before we try to decode anything. */
export function validateImageFile(f: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(f.type)) return "that file isn't a picture hum. can use. try a jpg, png, webp or gif";
  if (f.size > MAX_IMAGE_BYTES) return "that picture is too big, keep it under 15 MB";
  if (f.size === 0) return "that file is empty";
  return null;
}

/** Decode, shrink to at most 1080px and re-encode as jpeg so the database stays small. */
export async function compressImage(file: Blob, max = COVER_SIZE): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("couldn't read that picture");
  }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!out) throw new Error("couldn't shrink that picture");
  return out;
}

type Ctx = Pick<CanvasRenderingContext2D,
  "fillStyle" | "strokeStyle" | "font" | "textAlign" | "textBaseline" | "globalAlpha" | "lineWidth" |
  "fillRect" | "fillText" | "beginPath" | "arc" | "fill" | "save" | "restore" | "translate" | "rotate" |
  "moveTo" | "lineTo" | "stroke" | "createLinearGradient" | "drawImage" | "measureText" | "bezierCurveTo" | "ellipse" | "closePath">;

function heart(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.fill();
}

function noteGlyph(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.32, s * 0.24, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + s * 0.24, y - s, s * 0.08, s);
}

function drawPattern(ctx: Ctx, size: number, cover: CoverConfig) {
  ctx.fillStyle = cover.color;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = cover.color2;
  ctx.strokeStyle = cover.color2;
  const step = size / 9;
  switch (cover.pattern) {
    case "dots":
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
        ctx.beginPath();
        ctx.arc(x * step + (y % 2) * step / 2, y * step, step * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "stripes":
      ctx.lineWidth = step * 0.35;
      for (let i = -10; i < 20; i++) { ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step + size, size); ctx.stroke(); }
      break;
    case "checks":
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if ((x + y) % 2) ctx.fillRect(x * step, y * step, step, step);
      break;
    case "hearts":
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) heart(ctx, x * step + (y % 2) * step / 2 + step / 4, y * step + step * 0.2, step * 0.42);
      break;
    case "notes":
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) noteGlyph(ctx, x * step * 1.15 + (y % 2) * step / 2 + step / 3, y * step * 1.15 + step * 0.9, step * 0.55);
      break;
  }
}

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/** Draw a cover onto a square canvas of `size` px. */
export function drawCover(ctx: Ctx, size: number, cover: CoverConfig, title: string, image: CanvasImageSource | null) {
  const u = size / 100; // 1% of the cover
  ctx.save();
  if (cover.background === "solid") {
    ctx.fillStyle = cover.color;
    ctx.fillRect(0, 0, size, size);
  } else if (cover.background === "gradient") {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, cover.color);
    g.addColorStop(1, cover.color2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  } else if (cover.background === "pattern") {
    drawPattern(ctx, size, cover);
  } else {
    ctx.fillStyle = cover.color;
    ctx.fillRect(0, 0, size, size);
    if (image) {
      // cover-fit the picture
      const iw = (image as { width: number }).width;
      const ih = (image as { height: number }).height;
      const s = Math.max(size / iw, size / ih);
      ctx.drawImage(image, (size - iw * s) / 2, (size - ih * s) / 2, iw * s, ih * s);
      // soft band at the bottom so the title stays readable
      const g = ctx.createLinearGradient(0, size * 0.45, 0, size);
      g.addColorStop(0, "rgba(255,253,251,0)");
      g.addColorStop(1, "rgba(255,253,251,0.85)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  }

  // title
  ctx.fillStyle = cover.textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 ${9 * u}px Fraunces, Georgia, serif`;
  const lines = wrap(ctx, title || "untitled hum", 84 * u);
  const lineH = 10 * u;
  const subH = cover.subtitle ? 8 * u : 0;
  let y = size - 12 * u - subH - (lines.length - 1) * lineH;
  for (const l of lines) { ctx.fillText(l, 8 * u, y); y += lineH; }
  if (cover.subtitle) {
    ctx.font = `600 ${6 * u}px Caveat, "Comic Sans MS", cursive`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(cover.subtitle, 8 * u, y - 2 * u);
    ctx.globalAlpha = 1;
  }

  // small hum. mark
  ctx.textAlign = "right";
  ctx.font = `italic 600 ${4.4 * u}px Fraunces, Georgia, serif`;
  ctx.globalAlpha = 0.75;
  ctx.fillText("hum.", size - 6 * u, 9 * u);
  ctx.restore();
}

export async function loadImage(blob: Blob | null): Promise<ImageBitmap | null> {
  if (!blob) return null;
  try { return await createImageBitmap(blob); } catch { return null; }
}

/** The full-size PNG. Waits for the web fonts so the title isn't drawn in a fallback font. */
export async function coverToPng(cover: CoverConfig, title: string, imageBlob: Blob | null): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = COVER_SIZE;
  canvas.height = COVER_SIZE;
  const img = cover.background === "image" ? await loadImage(imageBlob) : null;
  drawCover(canvas.getContext("2d")!, COVER_SIZE, cover, title, img);
  img?.close();
  const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!png) throw new Error("couldn't make the png");
  return png;
}
