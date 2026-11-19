// src/components/CoverEditor.tsx
// the cover maker (a small modal) and the cover thumbnail used on song cards.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ImagePlus, X } from "lucide-react";
import { SWATCHES, coverToPng, compressImage, defaultCover, drawCover, loadImage, validateImageFile } from "../lib/cover";
import { getBlob } from "../lib/db";
import { download, safeName } from "../lib/exporters";
import type { CoverConfig } from "../lib/types";
import { toast } from "./ui";

/** Draws a cover into a canvas at `px` resolution. */
export function CoverCanvas({ cover, title, image, px = 540, className = "" }: { cover: CoverConfig; title: string; image: Blob | null; px?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      await document.fonts?.ready;
      const bmp = cover.background === "image" ? await loadImage(image) : null;
      const c = ref.current;
      if (!alive || !c) { bmp?.close(); return; }
      drawCover(c.getContext("2d")!, px, cover, title, bmp);
      bmp?.close();
    })();
    return () => { alive = false; };
  }, [cover, title, image, px]);
  return <canvas ref={ref} width={px} height={px} className={className} aria-label={`cover for ${title}`} role="img" />;
}

/** Thumbnail for the library. Loads the stored picture by key. */
export function CoverThumb({ cover, title, className = "" }: { cover: CoverConfig; title: string; className?: string }) {
  const [img, setImg] = useState<Blob | null>(null);
  useEffect(() => { let alive = true; getBlob(cover.imageKey).then((b) => alive && setImg(b)); return () => { alive = false; }; }, [cover.imageKey]);
  return <CoverCanvas cover={cover} title={title} image={img} px={240} className={className} />;
}

interface Props {
  title: string;
  cover: CoverConfig | null;
  onSave: (cover: CoverConfig, newImage: Blob | null) => Promise<void> | void;
  onRemove: () => void;
  onClose: () => void;
}

export default function CoverEditor({ title, cover, onSave, onRemove, onClose }: Props) {
  const [draft, setDraft] = useState<CoverConfig>(cover ?? defaultCover());
  const [image, setImage] = useState<Blob | null>(null); // what the preview shows
  const [newImage, setNewImage] = useState<Blob | null>(null); // only set after a fresh upload
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<CoverConfig>) => setDraft((d) => ({ ...d, ...p }));

  useEffect(() => { getBlob(cover?.imageKey).then(setImage); }, [cover?.imageKey]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const upload = async (f: File) => {
    setError(null);
    const problem = validateImageFile(f);
    if (problem) { setError(problem); return; }
    setBusy(true);
    try {
      const small = await compressImage(f);
      setImage(small);
      setNewImage(small);
      set({ background: "image" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // portal to <body>: a parent with backdrop-filter (the .panel cards) would otherwise trap a fixed modal
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 backdrop-blur-sm" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel max-h-[92vh] w-full max-w-3xl overflow-y-auto !bg-white p-5 animate-pop" role="dialog" aria-label="edit cover">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-hand text-xl leading-none text-rose-deep">the cover</p>
            <h2 className="font-display text-xl font-semibold">give your song a face</h2>
          </div>
          <button className="chip !px-2" onClick={onClose} aria-label="close"><X size={14} /></button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <CoverCanvas cover={draft} title={title} image={image} className="aspect-square w-full rounded-2xl border border-line shadow-sm" />

          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 font-extrabold">background</p>
              <div className="flex flex-wrap gap-1.5">
                {(["solid", "gradient", "pattern", "image"] as const).map((b) => (
                  <button key={b} className="chip" aria-pressed={draft.background === b} onClick={() => (b === "image" && !image ? fileRef.current?.click() : set({ background: b }))}>{b}</button>
                ))}
              </div>
            </div>

            <Swatches label={draft.background === "solid" || draft.background === "image" ? "color" : "first color"} value={draft.color} onPick={(c) => set({ color: c })} />
            {(draft.background === "gradient" || draft.background === "pattern") && <Swatches label="second color" value={draft.color2} onPick={(c) => set({ color2: c })} />}

            {draft.background === "pattern" && (
              <div>
                <p className="mb-1 font-extrabold">pattern</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["dots", "stripes", "checks", "hearts", "notes"] as const).map((p) => (
                    <button key={p} className="chip" aria-pressed={draft.pattern === p} onClick={() => set({ pattern: p })}>{p}</button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1 font-extrabold">picture</p>
              <button className="chip" onClick={() => fileRef.current?.click()} disabled={busy}><ImagePlus size={13} /> {image ? "change picture" : "upload a picture"}</button>
              <input ref={fileRef} type="file" accept={"image/jpeg,image/png,image/webp,image/gif"} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
              {error && <p className="mt-2 rounded-xl bg-butter px-3 py-2 text-xs" role="alert">{error}</p>}
            </div>

            <label className="block">
              <span className="mb-1 block font-extrabold">little line under the title</span>
              <input value={draft.subtitle} onChange={(e) => set({ subtitle: e.target.value })} maxLength={60} placeholder="a demo, november nights..."
                className="w-full rounded-xl border border-line bg-white px-3 py-2" />
            </label>

            <Swatches label="text color" value={draft.textColor} onPick={(c) => set({ textColor: c })} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button className="key px-4 py-2" style={{ background: "#39343B", color: "#fff" }} disabled={busy}
            onClick={async () => { setBusy(true); try { await onSave(draft, newImage); toast("cover saved ♡"); onClose(); } finally { setBusy(false); } }}>
            save cover
          </button>
          <button className="chip" disabled={busy} onClick={async () => {
            try { download(await coverToPng(draft, title, image), `${safeName(title)}-cover.png`); toast("downloaded ♡"); }
            catch { toast("couldn't make the png, try again"); }
          }}><Download size={13} /> download png</button>
          {cover && <button className="chip ml-auto" onClick={() => { onRemove(); onClose(); }}>remove cover</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Swatches({ label, value, onPick }: { label: string; value: string; onPick: (c: string) => void }) {
  return (
    <div>
      <p className="mb-1 font-extrabold">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {SWATCHES.map((c) => (
          <button key={c} onClick={() => onPick(c)} aria-label={`color ${c}`} aria-pressed={value.toLowerCase() === c.toLowerCase()}
            className={`h-7 w-7 rounded-full border ${value.toLowerCase() === c.toLowerCase() ? "border-ink ring-2 ring-ink/40" : "border-line"}`} style={{ background: c }} />
        ))}
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} className="h-7 w-9 cursor-pointer rounded-md border border-line bg-white" aria-label={`custom ${label}`} />
      </div>
    </div>
  );
}
