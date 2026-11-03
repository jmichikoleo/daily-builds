"use client";

import { AlertTriangle, Download, Files, Loader2, RotateCcw, Share2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ComposedCollage } from "@/lib/collage/compose";
import { FORMAT_LIST } from "@/lib/collage/formats";
import type { ExportedImage } from "@/lib/export";
import { canShareFiles, downloadBlob, filesFromBlobs, shareFiles } from "@/lib/export/share";
import { studioActions } from "@/lib/studio/store";

type Result = { key: string; image?: ExportedImage; url?: string; error?: string };
type Notice = { tone: "info" | "error"; text: string } | null;

/** Export code (React server renderer, font embedding, zip) loads only when needed. */
const loadExport = () => import("@/lib/export");

/**
 * Generates the real PNG as soon as it opens, shows that exact file as the
 * preview, and offers Save / Share / Export all pages. Because the file is
 * ready before the user taps Share, the share sheet opens within the tap.
 */
export function ExportDialog({ collage, nickname, initialPage, onClose }: { collage: ComposedCollage; nickname: string; initialPage: number; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [page, setPage] = useState(Math.min(initialPage, collage.pages.length - 1));
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [attempt, setAttempt] = useState(0);
  const pageIndex = Math.min(page, collage.pages.length - 1);
  // A new key whenever what we'd export changes (format, theme, layout, page…).
  const key = `${attempt}|${pageIndex}|${collage.format.id}|${collage.pages.length}|${collageSignature(collage, pageIndex)}`;
  const current = result?.key === key ? result : null;
  const generating = !current;
  // Latest collage for the export effect, which only re-runs when `key` changes.
  const collageRef = useRef(collage);
  useEffect(() => {
    collageRef.current = collage;
  }, [collage]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let url: string | undefined;
    loadExport()
      .then((m) => m.exportPage(collageRef.current, pageIndex, nickname))
      .then((image) => {
        url = URL.createObjectURL(image.blob);
        if (alive) setResult({ key, image, url });
        else URL.revokeObjectURL(url);
      })
      .catch((err: unknown) => alive && setResult({ key, error: err instanceof Error ? err.message : String(err) }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, nickname, pageIndex]);

  const image = current?.image;
  const files = image ? filesFromBlobs([image]) : [];
  const shareable = image ? canShareFiles(files) : false;
  const multi = collage.pages.length > 1;

  const save = () => {
    if (!image) return;
    const started = downloadBlob(image.blob, image.filename);
    setNotice(started ? { tone: "info", text: `Download started: ${image.filename}` } : { tone: "error", text: "This browser couldn't start a download." });
  };

  const share = async () => {
    if (!image) return;
    setBusy("share");
    const { outcome } = await shareFiles(files, { title: `${collage.title} · ${collage.year}`, text: "Made with Your Year in Stamps" });
    setBusy(null);
    if (outcome === "shared") setNotice({ tone: "info", text: "Sent to the share sheet." });
    else if (outcome === "cancelled") setNotice(null);
    else setNotice({ tone: "error", text: "Sharing didn't work on this device. Use “Save My Passport” instead, then post the image from your photos." });
  };

  const saveAll = async () => {
    setBusy("all");
    setNotice({ tone: "info", text: `Preparing page 1 of ${collage.pages.length}…` });
    try {
      const m = await loadExport();
      const images = await m.exportAllPages(collage, nickname, (done, total) =>
        setNotice({ tone: "info", text: done < total ? `Preparing page ${done + 1} of ${total}…` : "Packing pages…" }),
      );
      const zip = await m.zipImages(images, nickname, collage);
      const started = downloadBlob(zip.blob, zip.filename);
      setNotice(
        started
          ? { tone: "info", text: `Download started: ${zip.filename} (${images.length} PNG files)` }
          : { tone: "error", text: "This browser couldn't start a download." },
      );
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const button = "inline-flex items-center justify-center gap-2 rounded-sm px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const ratio = collage.format.width / collage.format.height;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      className="m-0 mt-auto max-h-[94svh] w-full max-w-none overflow-hidden rounded-t-md bg-ivory p-0 text-charcoal shadow-2xl backdrop:bg-charcoal/50 sm:m-auto sm:max-h-[90svh] sm:max-w-3xl sm:rounded-md"
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="font-stamp text-[11px] uppercase tracking-[0.25em] text-muted">Export</p>
            <h2 id={titleId} className="font-serif text-2xl">
              Save your <span className="italic text-burgundy">passport.</span>
            </h2>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-sm text-muted hover:text-burgundy" aria-label="Close export">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="grid flex-1 gap-6 overflow-y-auto px-5 py-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          {/* The generated file itself is the preview. */}
          <div className="mx-auto w-full max-w-[15rem]">
            <div className="relative overflow-hidden rounded-sm border border-line bg-paper shadow-[0_18px_40px_-24px_rgba(48,43,46,0.6)]" style={{ aspectRatio: `${ratio}` }}>
              {current?.url && (
                // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, not an optimisable asset
                <img src={current.url} alt={`Preview of the exported image: ${collage.title}, ${collage.year}${multi ? `, page ${pageIndex + 1}` : ""}`} className="h-full w-full" />
              )}
              {generating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted" role="status">
                  <Loader2 size={22} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  <span className="text-xs">Printing your passport…</span>
                </div>
              )}
              {current?.error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-xs" role="alert">
                  <AlertTriangle size={20} className="text-[#A23B3B]" aria-hidden="true" />
                  <p>{current.error}</p>
                  <button type="button" onClick={() => setAttempt((n) => n + 1)} className="inline-flex items-center gap-1 rounded-sm border border-line px-2 py-1 hover:border-burgundy">
                    <RotateCcw size={12} aria-hidden="true" /> Try again
                  </button>
                </div>
              )}
            </div>
            <p className="mt-2 text-center font-mono text-[11px] text-muted">
              PNG · {collage.format.width} × {collage.format.height}
              {multi && ` · page ${pageIndex + 1} of ${collage.pages.length}`}
            </p>
          </div>

          <div className="space-y-5">
            <fieldset>
              <legend className="font-stamp text-xs uppercase tracking-[0.2em] text-muted">Format</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {FORMAT_LIST.map((f) => {
                  const checked = f.id === collage.format.id;
                  return (
                    <label
                      key={f.id}
                      className={`cursor-pointer rounded-sm border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-burgundy ${checked ? "border-burgundy bg-blush/50" : "border-line hover:border-rose"}`}
                    >
                      <input type="radio" name="export-format" checked={checked} disabled={!!busy} onChange={() => studioActions.setFormat(f.id)} className="sr-only" />
                      <span className="block font-medium">
                        {f.name} {checked && <span className="sr-only">(selected)</span>}
                      </span>
                      <span className="block text-xs text-muted">
                        {f.ratioLabel} · {f.width}×{f.height}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {multi && (
              <fieldset>
                <legend className="font-stamp text-xs uppercase tracking-[0.2em] text-muted">Page</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {collage.pages.map((p) => (
                    <button
                      key={p.index}
                      type="button"
                      disabled={!!busy}
                      onClick={() => setPage(p.index)}
                      aria-pressed={p.index === pageIndex}
                      className={`h-9 min-w-9 rounded-sm border px-2 font-mono text-sm ${p.index === pageIndex ? "border-burgundy bg-burgundy text-ivory" : "border-line hover:border-rose"}`}
                    >
                      {p.index + 1}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted">Your {collage.stats.stamps} stamps fill {collage.pages.length} pages; each is its own image.</p>
              </fieldset>
            )}

            <div className="flex flex-col gap-2">
              <button type="button" onClick={save} disabled={!image || !!busy} className={`${button} bg-burgundy text-ivory hover:bg-charcoal`}>
                <Download size={17} aria-hidden="true" /> Save My Passport
              </button>
              {shareable && (
                <button type="button" onClick={share} disabled={!image || !!busy} className={`${button} border border-burgundy text-burgundy hover:bg-blush/40`}>
                  {busy === "share" ? <Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Share2 size={17} aria-hidden="true" />}
                  Share My Passport
                </button>
              )}
              {multi && (
                <button type="button" onClick={saveAll} disabled={!!busy} className={`${button} border border-line hover:border-burgundy`}>
                  {busy === "all" ? <Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Files size={17} aria-hidden="true" />}
                  Export All Pages (.zip)
                </button>
              )}
            </div>

            <p className={`min-h-[1.25rem] text-sm ${notice?.tone === "error" ? "text-[#A23B3B]" : "text-charcoal"}`} role={notice?.tone === "error" ? "alert" : "status"} aria-live="polite">
              {notice?.text}
            </p>

            <div className="border-t border-line pt-4 text-xs leading-relaxed text-muted">
              <p className="font-medium text-charcoal">Posting to Instagram Stories</p>
              <p className="mt-1">
                {shareable
                  ? "Tap “Share My Passport” and choose Instagram if your phone offers it. If it doesn’t appear, save the image and add it to your Story from your photos."
                  : "Save the image, open Instagram, start a new Story and pick the image from your photos."}{" "}
                The image is made on this device and isn’t uploaded anywhere.
              </p>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/** Cheap fingerprint of a page's rendered content, so any edit regenerates the preview. */
function collageSignature(collage: ComposedCollage, pageIndex: number): string {
  const page = collage.pages[pageIndex];
  const r = collage.resolved;
  const stamps = page.layout.placements.map((p) => {
    const s = collage.stamps.get(p.id);
    return `${p.id}:${p.cx}:${p.cy}:${p.w}:${p.rotation}:${p.z}:${s?.design.style}:${s?.design.ink}:${s?.model.dateText}`;
  });
  return [collage.title, collage.year, r.theme.id, r.preset, r.seed, r.paper, r.texture, r.border, r.fonts.id, r.textColor, r.align, r.showAccents, page.frame.subtitle?.text, page.frame.footerLeft?.text, page.frame.footerRight?.text, ...stamps].join("|");
}
