"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { LoadingPassport } from "@/components/site/LoadingPassport";
import { passportActions, usePassport } from "@/lib/passport/store";
import { MAX_NICKNAME_LENGTH, type CollectionEntry, type PassportDraft } from "@/lib/passport/types";
import { visitYear } from "@/lib/passport/visits";
import { CollectionPanel } from "./CollectionPanel";
import { DraftNotice } from "./DraftNotice";
import { PlaceSearch, type ReplaceTarget } from "./PlaceSearch";
import { StampEditor } from "./StampEditor";

/** Recent years, plus any year the draft or its visit dates already use. */
function yearOptions(draft: PassportDraft): number[] {
  const current = new Date().getFullYear();
  const years = new Set<number>([draft.year]);
  for (let y = current + 1; y >= current - 15; y--) years.add(y);
  for (const e of draft.entries) {
    const y = visitYear(e.visit);
    if (y) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

function ContinueButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/studio"
      className={`inline-flex items-center justify-center gap-2 rounded-sm bg-burgundy px-5 py-3 font-medium text-ivory transition-colors hover:bg-charcoal ${className}`}
    >
      Continue to studio
      <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}

export function CreatePassport() {
  const snapshot = usePassport();
  const yearId = useId();
  const nicknameId = useId();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<ReplaceTarget | null>(null);

  if (snapshot.status === "loading") return <LoadingPassport label="Opening your passport…" />;

  const { draft } = snapshot;
  const count = draft.entries.length;
  const editing = editingId ? draft.entries.find((e) => e.id === editingId) : undefined;

  const findMatch = (entry: CollectionEntry) => setReplaceTarget({ entryId: entry.id, name: entry.place.name });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-8 sm:px-6 md:pb-16 md:pt-12">
      <div className="max-w-2xl">
        <p className="font-stamp text-xs uppercase tracking-[0.32em] text-burgundy">Step one</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
          Collect your <span className="italic text-burgundy">stamps.</span>
        </h1>
        <p className="mt-3 text-muted">Pick the year, then stamp every country, territory and city you visited.</p>
        <p className="mt-2 text-xs text-muted">
          Saved only in this browser, no account needed.{" "}
          <Link href="/privacy" className="text-burgundy underline underline-offset-2">
            Privacy &amp; your data
          </Link>
        </p>
      </div>

      <div className="mt-6">
        <DraftNotice snapshot={snapshot} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
        <div className="space-y-10">
          {/* Details */}
          <section aria-labelledby="details-heading">
            <h2 id="details-heading" className="font-serif text-2xl">
              Passport details
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[10rem_1fr]">
              <div>
                <label htmlFor={yearId} className="block font-stamp text-xs uppercase tracking-[0.2em] text-muted">
                  Year
                </label>
                <select
                  id={yearId}
                  value={draft.year}
                  onChange={(e) => passportActions.setYear(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-sm border border-line bg-ivory px-3 py-3 font-serif text-xl text-charcoal focus:border-burgundy"
                >
                  {yearOptions(draft).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={nicknameId} className="block font-stamp text-xs uppercase tracking-[0.2em] text-muted">
                  Nickname <span className="normal-case tracking-normal">(optional)</span>
                </label>
                <input
                  id={nicknameId}
                  type="text"
                  value={draft.nickname}
                  onChange={(e) => passportActions.setNickname(e.target.value)}
                  maxLength={MAX_NICKNAME_LENGTH}
                  placeholder="e.g. Mochi"
                  autoComplete="nickname"
                  className="mt-1.5 w-full rounded-sm border border-line bg-ivory px-3 py-3 text-lg text-charcoal placeholder:text-muted/60 focus:border-burgundy"
                />
              </div>
            </div>
          </section>

          {/* Search */}
          <section aria-labelledby="destinations-heading" className="lg:sticky lg:top-4">
            <h2 id="destinations-heading" className="font-serif text-2xl">
              Where did you go?
            </h2>
            <p className="mt-1 text-sm text-muted">Add each place once. Been back? Use “Another visit” for a second stamp.</p>
            <div className="mt-4">
              <PlaceSearch entries={draft.entries} replaceTarget={replaceTarget} onReplaceDone={() => setReplaceTarget(null)} />
            </div>
          </section>
        </div>

        <div>
          <CollectionPanel draft={draft} onEdit={(e) => setEditingId(e.id)} onFindMatch={findMatch} />
          {count > 0 && (
            <div className="mt-6 hidden md:block">
              <ContinueButton className="w-full" />
            </div>
          )}
        </div>
      </div>

      {editing && (
        <StampEditor
          key={editing.id}
          entry={editing}
          entries={draft.entries}
          year={draft.year}
          themeId={draft.studio.themeId}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 px-4 py-3 backdrop-blur-sm md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="font-mono text-xs text-muted">
            {count} {count === 1 ? "stamp" : "stamps"}
          </p>
          {count > 0 ? <ContinueButton /> : <p className="text-right text-xs text-muted">Add a destination to continue</p>}
        </div>
      </div>
    </div>
  );
}
