/**
 * Download and native sharing. The browser objects are passed in, so every
 * branch (supported, unsupported, cancelled, failed) is unit-testable.
 *
 * Note: the Web Share API hands files to the operating system's share sheet.
 * Whether Instagram (or any app) appears there is up to the device; a website
 * cannot post an Instagram Story directly.
 */

export interface ShareEnvironment {
  navigator?: Pick<Navigator, "share" | "canShare"> | Partial<Pick<Navigator, "share" | "canShare">>;
  File?: typeof File;
}

export function filesFromBlobs(items: readonly { blob: Blob; filename: string }[], FileCtor: typeof File = File): File[] {
  return items.map((i) => new FileCtor([i.blob], i.filename, { type: i.blob.type || "image/png" }));
}

/** Can this browser share these files through the native share sheet? */
export function canShareFiles(files: readonly File[], env: ShareEnvironment = { navigator: globalThis.navigator }): boolean {
  const nav = env.navigator;
  if (!nav || typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({ files: [...files] });
  } catch {
    return false;
  }
}

export type ShareOutcome = "shared" | "cancelled" | "unsupported" | "failed";

/** Open the share sheet. Must be called directly from a click/tap. */
export async function shareFiles(
  files: readonly File[],
  text: { title: string; text: string },
  env: ShareEnvironment = { navigator: globalThis.navigator },
): Promise<{ outcome: ShareOutcome; error?: unknown }> {
  if (!canShareFiles(files, env)) return { outcome: "unsupported" };
  try {
    await env.navigator!.share!({ files: [...files], title: text.title, text: text.text });
    return { outcome: "shared" };
  } catch (error) {
    // The user closing the share sheet is not an error.
    if (error instanceof DOMException && error.name === "AbortError") return { outcome: "cancelled" };
    if (typeof error === "object" && error !== null && (error as { name?: string }).name === "AbortError") return { outcome: "cancelled" };
    return { outcome: "failed", error };
  }
}

/**
 * Start a download of `blob`. Returns true once the browser has been asked to
 * download (a click on an <a download>); browsers don't report whether the
 * file was actually saved.
 */
export function downloadBlob(blob: Blob, filename: string, doc: Document = document): boolean {
  if (typeof URL.createObjectURL !== "function") return false;
  const url = URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  doc.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start reading the blob before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
