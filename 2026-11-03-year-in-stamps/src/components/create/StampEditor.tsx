"use client";

import { RotateCcw, Shuffle, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Stamp } from "@/components/stamps/Stamp";
import { placeContext } from "@/lib/catalog/snapshot";
import { composeStamp } from "@/lib/collage/compose";
import { passportActions } from "@/lib/passport/store";
import type { CollectionEntry, DatePrecision, StampDesignConfig, VisitRecord } from "@/lib/passport/types";
import { isValidVisit } from "@/lib/passport/visits";
import { INK_SWATCHES, STAMP_STYLES, type StampStyle } from "@/lib/stamps/types";
import { THEMES, type ThemeId } from "@/lib/themes";

const PRECISIONS: { value: DatePrecision; label: string }[] = [
  { value: "unknown", label: "Not sure" },
  { value: "month", label: "Month" },
  { value: "day", label: "Exact date" },
];

/** The variant a stamp starts with: its position among visits to the same place. */
function defaultVariant(entry: CollectionEntry, entries: readonly CollectionEntry[]): number {
  return Math.max(0, entries.filter((e) => e.placeId === entry.placeId).findIndex((e) => e.id === entry.id));
}

function buildVisit(precision: DatePrecision, month: string, day: string): VisitRecord {
  if (precision === "month") return { precision, date: month };
  if (precision === "day") return { precision, date: day };
  return { precision: "unknown" };
}

/**
 * Edit one stamp: its visit date and its design, with a live preview.
 * Nothing is saved until "Save"; Escape or Cancel discards.
 */
export function StampEditor({
  entry,
  entries,
  year,
  themeId,
  onClose,
}: {
  entry: CollectionEntry;
  entries: readonly CollectionEntry[];
  year: number;
  themeId: ThemeId;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const dateErrorId = useId();
  const theme = THEMES[themeId];

  const [precision, setPrecision] = useState<DatePrecision>(entry.visit.precision);
  const [month, setMonth] = useState(entry.visit.precision === "month" ? entry.visit.date! : entry.visit.date?.slice(0, 7) ?? "");
  const [day, setDay] = useState(entry.visit.precision === "day" ? entry.visit.date! : "");
  const [design, setDesign] = useState<StampDesignConfig>(entry.design);

  // Open as a modal; on close, hand focus back to whatever opened it.
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const visit = buildVisit(precision, month, day);
  // An empty field is a prompt, not an error; a wrong year is an error.
  let dateError: string | null = null;
  let dateHint: string | null = null;
  if (precision !== "unknown") {
    if (!visit.date) dateHint = precision === "month" ? `Choose a month in ${year}.` : `Choose a date in ${year}.`;
    else if (!isValidVisit(visit)) dateError = "That date doesn't exist.";
    else if (Number(visit.date.slice(0, 4)) !== year) dateError = `This date is in ${visit.date.slice(0, 4)}, but this passport is for ${year}. Pick a date in ${year}, or change the passport year.`;
  }

  const blocked = !!dateError || !!dateHint;
  const previewEntry: CollectionEntry = { ...entry, visit: blocked ? { precision: "unknown" } : visit, design };
  const preview = composeStamp(previewEntry, year, theme.inks, theme.styles);
  const styleOptions = useMemo(
    () =>
      STAMP_STYLES.map((s) => ({
        ...s,
        stamp: composeStamp({ ...entry, design: { ...design, style: s.id } }, year, theme.inks, theme.styles),
      })),
    [entry, design, year, theme.inks, theme.styles],
  );

  const save = () => {
    if (blocked) return;
    passportActions.setVisit(entry.id, visit);
    passportActions.setDesign(entry.id, design);
    onClose();
  };

  const radioCard = "relative flex cursor-pointer flex-col items-center gap-1 rounded-sm border p-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-burgundy";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose(); // backdrop click
      }}
      className="m-0 mt-auto max-h-[92svh] w-full max-w-none overflow-hidden rounded-t-md bg-ivory p-0 text-charcoal shadow-2xl backdrop:bg-charcoal/45 sm:m-auto sm:max-h-[88svh] sm:max-w-2xl sm:rounded-md"
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="font-stamp text-[11px] uppercase tracking-[0.25em] text-muted">Edit stamp</p>
            <h2 id={titleId} className="truncate font-serif text-2xl">{entry.place.name}</h2>
            <p className="truncate text-xs text-muted">{placeContext(entry.place)}</p>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted hover:text-burgundy" aria-label="Close without saving">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="grid flex-1 gap-6 overflow-y-auto px-5 py-5 sm:grid-cols-[13rem_minmax(0,1fr)]">
          {/* Live preview */}
          <div className="flex flex-col items-center gap-2 sm:sticky sm:top-0 sm:self-start">
            <div className="flex aspect-square w-40 items-center justify-center rounded-sm bg-paper p-3 sm:w-full">
              <Stamp model={preview.model} design={preview.design} className="h-auto max-h-full w-full" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Preview</p>
          </div>

          <div className="space-y-6">
            {/* Visit */}
            <fieldset>
              <legend className="font-stamp text-xs uppercase tracking-[0.2em] text-muted">When did you visit?</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {PRECISIONS.map((p) => (
                  <label key={p.value} className={`${radioCard} ${precision === p.value ? "border-burgundy bg-blush/40" : "border-line"}`}>
                    <input type="radio" name="precision" value={p.value} checked={precision === p.value} onChange={() => setPrecision(p.value)} className="sr-only" />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
              {precision === "month" && (
                <label className="mt-3 block text-sm">
                  <span className="sr-only">Month of visit</span>
                  <input
                    type="month"
                    aria-label={`Month of visit, in ${year}`}
                    value={month}
                    min={`${year}-01`}
                    max={`${year}-12`}
                    onChange={(e) => setMonth(e.target.value)}
                    aria-invalid={!!dateError}
                    aria-describedby={dateError ? dateErrorId : undefined}
                    className="w-full rounded-sm border border-line bg-ivory px-3 py-2 focus:border-burgundy"
                  />
                </label>
              )}
              {precision === "day" && (
                <label className="mt-3 block text-sm">
                  <span className="sr-only">Date of visit</span>
                  <input
                    type="date"
                    aria-label={`Date of visit, in ${year}`}
                    value={day}
                    min={`${year}-01-01`}
                    max={`${year}-12-31`}
                    onChange={(e) => setDay(e.target.value)}
                    aria-invalid={!!dateError}
                    aria-describedby={dateError ? dateErrorId : undefined}
                    className="w-full rounded-sm border border-line bg-ivory px-3 py-2 focus:border-burgundy"
                  />
                </label>
              )}
              {dateError && (
                <p id={dateErrorId} className="mt-2 text-xs text-[#A23B3B]" role="alert">
                  {dateError}
                </p>
              )}
              {dateHint && <p className="mt-2 text-xs text-muted">{dateHint}</p>}
            </fieldset>

            {/* Silhouette */}
            <fieldset>
              <legend className="font-stamp text-xs uppercase tracking-[0.2em] text-muted">Stamp style</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {styleOptions.map((s) => {
                  const checked = preview.design.style === s.id;
                  return (
                    <label key={s.id} className={`${radioCard} ${checked ? "border-burgundy bg-blush/40" : "border-line hover:border-rose"}`}>
                      <input
                        type="radio"
                        name="style"
                        value={s.id}
                        checked={checked}
                        onChange={() => setDesign((d) => ({ ...d, style: s.id as StampStyle }))}
                        className="sr-only"
                      />
                      <span className="flex h-14 w-full items-center justify-center">
                        <Stamp model={s.stamp.model} design={s.stamp.design} className="h-auto max-h-14 w-full" decorative />
                      </span>
                      <span className="text-center text-[11px] leading-tight">{s.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Ink */}
            <fieldset>
              <legend className="font-stamp text-xs uppercase tracking-[0.2em] text-muted">Ink</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                <label className={`${radioCard} !flex-row px-2.5 ${!design.ink ? "border-burgundy bg-blush/40" : "border-line"}`}>
                  <input type="radio" name="ink" checked={!design.ink} onChange={() => setDesign((d) => ({ ...d, ink: undefined }))} className="sr-only" />
                  <span
                    className="h-5 w-5 rounded-full"
                    style={{ background: `conic-gradient(${[...new Set(theme.inks)].join(", ")}, ${theme.inks[0]})` }}
                    aria-hidden="true"
                  />
                  <span className="text-xs">Theme</span>
                </label>
                {INK_SWATCHES.map((swatch) => (
                  <label key={swatch.value} className={`${radioCard} ${design.ink === swatch.value ? "border-burgundy bg-blush/40" : "border-line"}`} title={swatch.name}>
                    <input
                      type="radio"
                      name="ink"
                      checked={design.ink === swatch.value}
                      onChange={() => setDesign((d) => ({ ...d, ink: swatch.value }))}
                      className="sr-only"
                      aria-label={swatch.name}
                    />
                    <span className="h-5 w-5 rounded-full" style={{ background: swatch.value }} aria-hidden="true" />
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Toggles and actions */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={design.showDate}
                  onChange={(e) => setDesign((d) => ({ ...d, showDate: e.target.checked }))}
                  className="h-4 w-4 accent-[#793F57]"
                />
                Show date on stamp
              </label>
              <button
                type="button"
                onClick={() => setDesign((d) => ({ ...d, variant: d.variant + 1 }))}
                className="inline-flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-sm hover:border-burgundy"
              >
                <Shuffle size={14} aria-hidden="true" /> Regenerate details
              </button>
              <button
                type="button"
                onClick={() => setDesign({ variant: defaultVariant(entry, entries), showDate: true })}
                className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-muted underline-offset-4 hover:text-burgundy hover:underline"
              >
                <RotateCcw size={14} aria-hidden="true" /> Reset design
              </button>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-sm px-4 py-2 text-sm text-charcoal hover:text-burgundy">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={blocked}
            className="rounded-sm bg-burgundy px-4 py-2 text-sm font-medium text-ivory hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save stamp
          </button>
        </footer>
      </div>
    </dialog>
  );
}
