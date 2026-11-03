"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { passportActions } from "@/lib/passport/store";

/** "Clear My Data" with a confirmation step. Removes only this app's storage keys. */
export function ClearDataButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setDone(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-sm border border-[#A23B3B]/50 px-4 py-2.5 text-sm font-medium text-[#A23B3B] hover:bg-[#A23B3B]/5"
      >
        <Trash2 size={16} aria-hidden="true" /> Clear My Data
      </button>
      <p className="mt-2 min-h-[1.25rem] text-sm text-charcoal" role="status" aria-live="polite">
        {done !== null && (done > 0 ? "Done. Your passport and its backups were removed from this browser." : "There was nothing saved in this browser.")}
      </p>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-md bg-ivory p-0 text-charcoal shadow-2xl backdrop:bg-charcoal/50"
      >
        <div className="p-5">
          <h2 id={titleId} className="font-serif text-2xl">
            Clear your passport?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This deletes your stamps, dates, designs and the backup copies from this browser. It can’t be undone. Images you already saved are not affected, and
            nothing else in your browser is touched.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" autoFocus onClick={() => setOpen(false)} className="rounded-sm px-4 py-2 text-sm hover:text-burgundy">
              Keep my passport
            </button>
            <button
              type="button"
              onClick={() => {
                setDone(passportActions.clearAllData());
                setOpen(false);
              }}
              className="rounded-sm bg-[#A23B3B] px-4 py-2 text-sm font-medium text-ivory hover:bg-[#7f2d2d]"
            >
              Yes, clear it
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
