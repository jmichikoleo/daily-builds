import type { ComposedCollage } from "../collage/compose";
import { ExportError, toExportError } from "./errors";
import { exportFilename } from "./filename";
import { collectPageFontFaces, embedFontCss, selectFaces } from "./fonts";
import { svgToPng } from "./raster";
import { renderPageMarkup } from "./render";
import { finalizeSvg, resolveCssVars, usedCodePoints, usedFontFamilies } from "./svg";
import { createZip } from "./zip";

export { ExportError } from "./errors";

export interface ExportedImage {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  page: number;
  pages: number;
}

/** Self-contained SVG for one page: variables resolved, used font subsets embedded. */
export async function buildExportSvg(collage: ComposedCollage, pageIndex: number, fetchFn: typeof fetch = fetch): Promise<string> {
  const rootStyle = getComputedStyle(document.documentElement);
  const markup = resolveCssVars(renderPageMarkup(collage, pageIndex), (name) => rootStyle.getPropertyValue(name));
  const faces = selectFaces(collectPageFontFaces(), usedFontFamilies(markup), usedCodePoints(markup));
  const css = await embedFontCss(faces, fetchFn);
  return finalizeSvg(markup, collage.format.width, collage.format.height, css);
}

/** Render one page to a PNG at the format's exact pixel size. */
export async function exportPage(collage: ComposedCollage, pageIndex: number, nickname: string): Promise<ExportedImage> {
  if (collage.stamps.size === 0) throw new ExportError("empty");
  try {
    const { width, height } = collage.format;
    const svg = await buildExportSvg(collage, pageIndex);
    const blob = await svgToPng(svg, width, height);
    const pages = collage.pages.length;
    return {
      blob,
      width,
      height,
      page: pageIndex + 1,
      pages,
      filename: exportFilename({ nickname, year: collage.year, format: collage.format.id, page: pageIndex + 1, pages }),
    };
  } catch (err) {
    throw toExportError(err, "image");
  }
}

/** Every page, one after another (keeps memory and main-thread use bounded). */
export async function exportAllPages(collage: ComposedCollage, nickname: string, onProgress?: (done: number, total: number) => void): Promise<ExportedImage[]> {
  const out: ExportedImage[] = [];
  for (let i = 0; i < collage.pages.length; i++) {
    out.push(await exportPage(collage, i, nickname));
    onProgress?.(i + 1, collage.pages.length);
  }
  return out;
}

/** Bundle several PNGs into one .zip for a single download. */
export async function zipImages(images: readonly ExportedImage[], nickname: string, collage: ComposedCollage): Promise<{ blob: Blob; filename: string }> {
  const entries = await Promise.all(images.map(async (img) => ({ name: img.filename, data: new Uint8Array(await img.blob.arrayBuffer()) })));
  return {
    blob: new Blob([createZip(entries) as BlobPart], { type: "application/zip" }),
    filename: exportFilename({ nickname, year: collage.year, format: collage.format.id, ext: "zip" }),
  };
}
