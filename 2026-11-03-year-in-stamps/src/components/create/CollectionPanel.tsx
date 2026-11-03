"use client";

import { AlertTriangle, CopyPlus, Pencil, Search, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Stamp } from "@/components/stamps/Stamp";
import { normalizeText } from "@/lib/catalog/search";
import { kindLabel, placeContext } from "@/lib/catalog/snapshot";
import { collectionStats, composeStamp } from "@/lib/collage/compose";
import { passportActions } from "@/lib/passport/store";
import { MAX_STAMPS, type CollectionEntry, type CollectionSort, type PassportDraft } from "@/lib/passport/types";
import { formatVisit, hasYearConflict, isSameVisit, sortEntries } from "@/lib/passport/visits";
import { THEMES } from "@/lib/themes";

const SORTS: { value: CollectionSort; label: string }[] = [
  { value: "added", label: "Order added" },
  { value: "name", label: "Name" },
  { value: "date", label: "Visit date" },
];

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-serif text-3xl leading-none text-charcoal">{value}</span>
      <span className="mt-1 text-[11px] leading-tight text-muted">{label}</span>
    </div>
  );
}

function CollectionCard({
  entry,
  draft,
  visitLabel,
  duplicateDate,
  onEdit,
  onRemove,
  onFindMatch,
}: {
  entry: CollectionEntry;
  draft: PassportDraft;
  visitLabel: string | null;
  duplicateDate: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onFindMatch: () => void;
}) {
  const theme = THEMES[draft.studio.themeId];
  const { model, design } = composeStamp(entry, draft.year, theme.inks, theme.styles);
  const conflict = hasYearConflict(entry.visit, draft.year);
  const date = formatVisit(entry.visit);
  const full = draft.entries.length >= MAX_STAMPS;
  const iconButton = "inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-blush/50 hover:text-burgundy disabled:opacity-40";

  return (
    <li className="stamp-press flex flex-col rounded-[3px] border border-line bg-ivory">
      <button type="button" onClick={onEdit} className="group flex h-28 items-center justify-center rounded-t-[3px] bg-paper/70 p-3" aria-label={`Edit ${entry.place.name} stamp`}>
        <Stamp model={model} design={design} className="h-auto max-h-full w-full transition-transform group-hover:scale-[1.03] motion-reduce:transition-none" decorative />
      </button>
      <div className="flex flex-1 flex-col gap-1 px-2.5 pb-1 pt-2">
        <p className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-medium" title={entry.place.name}>
            {entry.place.name}
          </span>
          {visitLabel && <span className="shrink-0 font-mono text-[10px] text-burgundy">{visitLabel}</span>}
        </p>
        <p className="truncate text-[11px] text-muted" title={placeContext(entry.place)}>
          {entry.place.kind === "country" ? "Country" : `${kindLabel(entry.place.kind)} · ${entry.place.countryName}`}
        </p>
        <p className={`text-[11px] ${conflict ? "text-[#A23B3B]" : "text-charcoal/80"}`}>{date ?? "Date not set"}</p>
        {conflict && (
          <p className="flex items-start gap-1 text-[11px] leading-snug text-[#A23B3B]">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            Outside {draft.year}.{" "}
            <button type="button" onClick={onEdit} className="underline">
              Fix
            </button>
          </p>
        )}
        {duplicateDate && !conflict && (
          <p className="flex items-start gap-1 text-[11px] leading-snug text-[#A23B3B]">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            Same date as another visit.
          </p>
        )}
        {entry.unresolved && (
          <p className="text-[11px] leading-snug text-[#A23B3B]">
            Not matched to the atlas.{" "}
            <button type="button" onClick={onFindMatch} className="underline">
              Find a match
            </button>
          </p>
        )}
      </div>
      <div className="flex items-center justify-end border-t border-line/70 px-1 py-0.5">
        <button type="button" onClick={onEdit} className={iconButton} aria-label={`Edit date and design of ${entry.place.name}${visitLabel ? ` (${visitLabel})` : ""}`} title="Edit">
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => passportActions.addVisit(entry.placeId)}
          disabled={full}
          className={iconButton}
          aria-label={`Add another visit to ${entry.place.name}`}
          title="Add another visit"
        >
          <CopyPlus size={15} aria-hidden="true" />
        </button>
        <button type="button" onClick={onRemove} className={iconButton} aria-label={`Remove ${entry.place.name}${visitLabel ? ` (${visitLabel})` : ""}`} title="Remove">
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

/**
 * The stamps collected so far: counts, filter, sort, conflict notices and
 * a compact card per stamp. Removing a stamp can be undone.
 */
export function CollectionPanel({
  draft,
  onEdit,
  onFindMatch,
}: {
  draft: PassportDraft;
  onEdit: (entry: CollectionEntry) => void;
  onFindMatch: (entry: CollectionEntry) => void;
}) {
  const [filter, setFilter] = useState("");
  const [removed, setRemoved] = useState<{ entry: CollectionEntry; index: number } | null>(null);
  const filterId = useId();
  const sortId = useId();
  const stats = collectionStats(draft.entries);

  // The undo offer fades after a while.
  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), 8000);
    return () => window.clearTimeout(timer);
  }, [removed]);

  const conflicts = draft.entries.filter((e) => hasYearConflict(e.visit, draft.year));
  const unresolved = draft.entries.filter((e) => e.unresolved).length;

  // "Visit 2" labels and same-date warnings for places collected more than once.
  const visitInfo = useMemo(() => {
    const info = new Map<string, { label: string | null; duplicateDate: boolean }>();
    const byPlace = new Map<string, CollectionEntry[]>();
    for (const e of draft.entries) byPlace.set(e.placeId, [...(byPlace.get(e.placeId) ?? []), e]);
    for (const group of byPlace.values()) {
      group.forEach((e, i) => {
        info.set(e.id, {
          label: group.length > 1 ? `Visit ${i + 1}` : null,
          duplicateDate: group.some((o) => o.id !== e.id && isSameVisit(o.visit, e.visit)),
        });
      });
    }
    return info;
  }, [draft.entries]);

  const visible = useMemo(() => {
    const sorted = sortEntries(draft.entries, draft.sort);
    const q = normalizeText(filter);
    if (!q) return sorted;
    return sorted.filter((e) => normalizeText(`${e.place.name} ${e.place.countryName} ${e.place.regionName ?? ""}`).includes(q));
  }, [draft.entries, draft.sort, filter]);

  const remove = (entry: CollectionEntry) => {
    setRemoved({ entry, index: draft.entries.findIndex((e) => e.id === entry.id) });
    passportActions.removeEntry(entry.id);
  };

  return (
    <section aria-labelledby="collection-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="collection-heading" className="font-serif text-2xl">
          Your collection
        </h2>
        <span className="font-mono text-xs text-muted" aria-label={`${stats.stamps} of ${MAX_STAMPS} stamps`}>
          {stats.stamps}/{MAX_STAMPS}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-y border-line py-4" aria-live="polite">
        <Stat value={stats.destinations} label={stats.destinations === 1 ? "destination" : "destinations"} />
        <Stat value={stats.countries} label={stats.countries === 1 ? "country or territory" : "countries & territories"} />
        <Stat value={stats.cities} label={stats.cities === 1 ? "city" : "cities"} />
      </div>

      {removed && (
        <div role="status" className="mt-3 flex items-center justify-between gap-3 bg-charcoal px-3 py-2 text-sm text-ivory">
          <span className="truncate">Removed {removed.entry.place.name}</span>
          <button
            type="button"
            onClick={() => {
              passportActions.restoreEntry(removed.entry, removed.index);
              setRemoved(null);
            }}
            className="shrink-0 rounded-sm px-2 py-1 font-medium text-blush underline underline-offset-2"
          >
            Undo
          </button>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="mt-3 border border-[#A23B3B]/30 bg-[#A23B3B]/5 px-3 py-2.5 text-sm text-charcoal">
          <p>
            <strong>{conflicts.length}</strong> {conflicts.length === 1 ? "stamp has a visit date" : "stamps have visit dates"} outside {draft.year}. They stay in
            your passport and show {draft.year} on the collage until you fix them.
          </p>
          <button type="button" onClick={passportActions.clearConflictingDates} className="mt-1.5 text-xs font-medium text-burgundy underline underline-offset-2">
            Clear {conflicts.length === 1 ? "that date" : "those dates"}
          </button>
        </div>
      )}

      {unresolved > 0 && (
        <p className="mt-3 border border-[#A23B3B]/30 bg-[#A23B3B]/5 px-3 py-2.5 text-sm">
          {unresolved === 1 ? "One stamp" : `${unresolved} stamps`} from an earlier version couldn’t be matched to the atlas. Use “Find a match” to fix{" "}
          {unresolved === 1 ? "it" : "them"}.
        </p>
      )}

      {draft.entries.length === 0 ? (
        <div className="mt-4 border border-dashed border-line px-5 py-10 text-center">
          <svg viewBox="0 0 80 80" className="mx-auto h-16 w-16 text-rose" aria-hidden="true">
            <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" />
            <circle cx="40" cy="40" r="25" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <p className="mt-3 font-serif text-lg italic">Your passport is waiting for its first stamp.</p>
          <p className="mt-1 text-sm text-muted">Search for a place you visited and add it.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label htmlFor={filterId} className="sr-only">
              Search your stamps
            </label>
            <div className="relative min-w-0 flex-1">
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                id={filterId}
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search your stamps"
                className="w-full rounded-sm border border-line bg-ivory py-1.5 pl-8 pr-2 text-sm focus:border-burgundy"
              />
            </div>
            <label htmlFor={sortId} className="sr-only">
              Sort stamps
            </label>
            <select
              id={sortId}
              value={draft.sort}
              onChange={(e) => passportActions.setSort(e.target.value as CollectionSort)}
              className="rounded-sm border border-line bg-ivory px-2 py-1.5 text-sm focus:border-burgundy"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {visible.length === 0 ? (
            <p className="mt-4 text-center text-sm text-muted">No stamps match “{filter.trim()}”.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Collected stamps">
              {visible.map((entry) => (
                <CollectionCard
                  key={entry.id}
                  entry={entry}
                  draft={draft}
                  visitLabel={visitInfo.get(entry.id)?.label ?? null}
                  duplicateDate={visitInfo.get(entry.id)?.duplicateDate ?? false}
                  onEdit={() => onEdit(entry)}
                  onRemove={() => remove(entry)}
                  onFindMatch={() => onFindMatch(entry)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
