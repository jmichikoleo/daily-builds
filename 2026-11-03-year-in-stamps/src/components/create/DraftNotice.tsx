"use client";

import { useState } from "react";
import { passportActions, type ReadyPassport } from "@/lib/passport/store";

/** Tells the user where their draft came from, and offers a confirmed "start over". */
export function DraftNotice({ snapshot }: { snapshot: ReadyPassport }) {
  const [confirming, setConfirming] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hasContent = snapshot.draft.entries.length > 0 || snapshot.draft.nickname !== "";

  let message: string | null = null;
  if (!snapshot.persistent) {
    message = "This browser is blocking local storage, so your passport will be lost when you close or refresh the page.";
  } else if (snapshot.origin === "recovered") {
    message = "We couldn't read a passport saved earlier in this browser, so we opened a fresh one. The old data was kept aside, not deleted.";
  } else if (snapshot.migratedFrom && hasContent) {
    message =
      "Your passport from the earlier version is here, upgraded to the full destination atlas. The original save is backed up in this browser before anything changes.";
  } else if (snapshot.origin === "restored" && hasContent) {
    message = "Welcome back. Your passport draft from this browser has been restored.";
  }
  if (message && snapshot.droppedEntries > 0) {
    message += ` ${snapshot.droppedEntries} saved ${snapshot.droppedEntries === 1 ? "entry was" : "entries were"} damaged beyond repair and left out.`;
  }
  if (!message || dismissed) return null;

  return (
    <div role="status" className="flex flex-col gap-3 border border-rose/40 bg-blush/40 px-4 py-3 text-sm text-burgundy sm:flex-row sm:items-center sm:justify-between">
      <p>{message}</p>
      {snapshot.origin === "restored" && snapshot.persistent && (
        <div className="flex shrink-0 items-center gap-2">
          {confirming ? (
            <>
              <span className="text-xs">Clear this passport?</span>
              <button
                type="button"
                className="rounded-sm bg-burgundy px-3 py-1.5 text-xs font-medium text-ivory"
                onClick={() => {
                  passportActions.reset();
                  setDismissed(true);
                }}
              >
                Yes, start over
              </button>
              <button type="button" className="rounded-sm px-3 py-1.5 text-xs underline" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" className="rounded-sm px-2 py-1.5 text-xs underline underline-offset-2" onClick={() => setConfirming(true)}>
              Start over
            </button>
          )}
        </div>
      )}
    </div>
  );
}
