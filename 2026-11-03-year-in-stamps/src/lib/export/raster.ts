import { ExportError } from "./errors";

/**
 * Draw a self-contained SVG onto a canvas of exactly width × height pixels
 * and encode it as PNG. The SVG only contains inline data (fonts as data
 * URLs, no external images), so the canvas never becomes tainted.
 */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  if (typeof document === "undefined" || typeof Image === "undefined") throw new ExportError("unsupported");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.toBlob !== "function") throw new ExportError("unsupported");

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new ExportError("image", "SVG failed to load as an image"));
      img.src = url;
    });
    // Make sure the embedded fonts and filters are decoded before drawing.
    await img.decode().catch(() => undefined);
    ctx.drawImage(img, 0, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ExportError("canvas", "toBlob returned null"))), "image/png");
    } catch (err) {
      // SecurityError if the canvas were tainted.
      reject(new ExportError("canvas", err instanceof Error ? err.message : String(err)));
    }
  });
}

/** Width and height stored in a PNG's IHDR chunk. */
export function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
