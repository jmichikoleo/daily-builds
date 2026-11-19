// src/components/RestoreDialog.tsx
// pick a .hum file, see what's inside, then choose to restore it. never overwrites a song that's already here.
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArchiveRestore, Loader2, X } from "lucide-react";
import { asCopy, readBackup, BackupError, type ParsedBackup } from "../lib/backup";
import { importBackup, songExists } from "../lib/db";
import { toast } from "./ui";

export function RestoreButton({ onRestored, className = "chip" }: { onRestored: (songId: string) => void; className?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [exists, setExists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (f: File) => {
    setError(null);
    setParsed(null);
    setBusy(true);
    try {
      const p = await readBackup(f);
      setExists(await songExists(p.song.id));
      setParsed(p);
    } catch (e) {
      setError(e instanceof BackupError ? e.message : "that file couldn't be read as a hum. backup");
    } finally {
      setBusy(false);
    }
  };

  const restore = async (copy: boolean) => {
    if (!parsed) return;
    setBusy(true);
    try {
      const song = await importBackup(copy ? asCopy(parsed) : parsed);
      toast("restored ♡");
      setParsed(null);
      onRestored(song.id);
    } catch {
      setError("couldn't restore it. nothing on this device was changed");
    } finally {
      setBusy(false);
    }
  };

  const open = !!parsed || !!error;
  return (
    <>
      <button className={className} onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy && !open ? <Loader2 size={13} className="animate-spin" /> : <ArchiveRestore size={13} />} restore project
      </button>
      <input ref={fileRef} type="file" accept=".hum,.zip,application/zip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
      {open && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 backdrop-blur-sm" onPointerDown={(e) => { if (e.target === e.currentTarget) { setParsed(null); setError(null); } }}>
          <div className="panel w-full max-w-md !bg-white p-5 animate-pop" role="dialog" aria-label="restore project">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-hand text-xl leading-none text-rose-deep">from a backup</p>
                <h2 className="font-display text-xl font-semibold">{parsed ? parsed.info.title : "hmm, that didn't work"}</h2>
              </div>
              <button className="chip !px-2" onClick={() => { setParsed(null); setError(null); }} aria-label="close"><X size={14} /></button>
            </div>
            {error && <p className="rounded-xl bg-butter px-3 py-2 text-sm" role="alert">{error}</p>}
            {parsed && (
              <>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  <Fact label="saved" value={parsed.info.exportedAt ? new Date(parsed.info.exportedAt).toLocaleString() : "unknown"} />
                  <Fact label="notes" value={String(parsed.info.notes)} />
                  <Fact label="versions" value={String(parsed.info.versions)} />
                  <Fact label="recordings and pictures" value={String(parsed.info.recordings)} />
                  <Fact label="lyrics sections with words" value={String(parsed.info.lyrics)} />
                  <Fact label="file size" value={`${(parsed.info.bytes / 1024 / 1024).toFixed(2)} MB`} />
                </ul>
                {exists && <p className="mt-3 rounded-xl bg-lavender/40 px-3 py-2 text-sm">this song is already on this device, so it'll come in as a copy. your current one stays exactly as it is</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {!exists && <button className="key px-4 py-2" style={{ background: "#39343B", color: "#fff" }} onClick={() => restore(false)} disabled={busy}>restore</button>}
                  <button className={exists ? "key px-4 py-2" : "chip"} style={exists ? { background: "#39343B", color: "#fff" } : undefined} onClick={() => restore(true)} disabled={busy}>restore as a copy</button>
                  <button className="chip ml-auto" onClick={() => setParsed(null)} disabled={busy}>cancel</button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-xl border border-line bg-pearl px-3 py-2">
      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-soft">{label}</span>
      <span className="font-bold">{value}</span>
    </li>
  );
}
