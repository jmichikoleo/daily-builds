"use client";

import { Check, CopyPlus, Loader2, Plus, RotateCcw, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MotifIcon } from "@/components/stamps/MotifIcon";
import { useCatalog } from "@/lib/catalog/load";
import { searchPlaces } from "@/lib/catalog/search";
import { kindLabel, motifFor, placeContext, snapshotOf } from "@/lib/catalog/snapshot";
import type { Place } from "@/lib/catalog/types";
import { passportActions } from "@/lib/passport/store";
import { MAX_STAMPS, type CollectionEntry } from "@/lib/passport/types";

const EXAMPLES = ["Seoul", "Paris", "Hong Kong", "Barcelona", "Japan"];

export interface ReplaceTarget {
  entryId: string;
  name: string;
}

/**
 * Search the destination catalog and collect stamps. A place already in the
 * passport can't be added twice by accident; "Another visit" is a separate,
 * explicit action. In replace mode, picking a result re-points an unresolved stamp.
 */
export function PlaceSearch({
  entries,
  replaceTarget,
  onReplaceDone,
}: {
  entries: readonly CollectionEntry[];
  replaceTarget: ReplaceTarget | null;
  onReplaceDone: () => void;
}) {
  const catalogState = useCatalog();
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Last place added, so a double-click on "Add" can't land on "Another visit". */
  const lastAdded = useRef<{ placeId: string; at: number } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputId = useId();
  const statusId = useId();

  const visitsByPlace = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.placeId, (counts.get(e.placeId) ?? 0) + 1);
    return counts;
  }, [entries]);
  const full = entries.length >= MAX_STAMPS;

  const results = useMemo(
    () => (catalogState.status === "ready" ? searchPlaces(catalogState.catalog, deferredQuery, 30) : []),
    [catalogState, deferredQuery],
  );
  const stale = query !== deferredQuery;

  // Entering replace mode: prefill with the old name (during render, React's
  // pattern for state derived from a prop change), then focus the search.
  const [seenTarget, setSeenTarget] = useState(replaceTarget);
  if (replaceTarget !== seenTarget) {
    setSeenTarget(replaceTarget);
    if (replaceTarget) setQuery(replaceTarget.name);
  }
  useEffect(() => {
    if (!replaceTarget) return;
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: "center" });
  }, [replaceTarget]);

  const refocusInput = () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const add = (place: Place, at: number) => {
    if (replaceTarget) {
      passportActions.replacePlace(replaceTarget.entryId, place.id, snapshotOf(place));
      setAnnouncement(`${replaceTarget.name} is now ${place.name}.`);
      onReplaceDone();
      setQuery("");
      return;
    }
    const result = passportActions.addPlace(place.id, snapshotOf(place));
    if (result === "added") lastAdded.current = { placeId: place.id, at };
    if (result === "added") setAnnouncement(`${place.name} stamped. ${entries.length + 1} ${entries.length === 0 ? "stamp" : "stamps"} in your passport.`);
    else if (result === "duplicate") setAnnouncement(`${place.name} is already in your passport. Use "Another visit" to add a second stamp.`);
    else setAnnouncement(`Your passport is full (${MAX_STAMPS} stamps).`);
    refocusInput();
  };

  const addVisit = (place: Place, at: number) => {
    const recent = lastAdded.current;
    if (recent && recent.placeId === place.id && at - recent.at < 800) return;
    const result = passportActions.addVisit(place.id);
    setAnnouncement(result === "added" ? `Another ${place.name} visit added.` : `Your passport is full (${MAX_STAMPS} stamps).`);
    refocusInput();
  };

  // Arrow keys move between result buttons; Escape returns to the input.
  const focusResult = (index: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-result]");
    if (!buttons?.length) return;
    if (index < 0) return inputRef.current?.focus();
    buttons[Math.min(index, buttons.length - 1)]?.focus();
  };
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusResult(0);
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
    }
  };
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const target = event.target as HTMLElement;
    const index = Number(target.closest("[data-index]")?.getAttribute("data-index") ?? -1);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusResult(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusResult(index - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      inputRef.current?.focus();
    }
  };

  let status: string;
  if (catalogState.status === "loading") status = "Opening the atlas…";
  else if (catalogState.status === "error") status = "The destination list didn't load.";
  else if (!query.trim()) status = "Countries, territories and 31,000+ cities.";
  else status = `${results.length === 30 ? "Top 30" : results.length} ${results.length === 1 ? "match" : "matches"}`;

  return (
    <div>
      {replaceTarget && (
        <div className="mb-3 flex items-center justify-between gap-3 border border-burgundy/30 bg-blush/40 px-3 py-2 text-sm text-burgundy">
          <p>
            Choose the place that matches <strong>{replaceTarget.name}</strong>.
          </p>
          <button type="button" onClick={() => { onReplaceDone(); setQuery(""); }} className="shrink-0 rounded-sm px-2 py-1 text-xs underline">
            Cancel
          </button>
        </div>
      )}

      <label htmlFor={inputId} className="sr-only">
        Search countries, territories and cities
      </label>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Search a country, territory or city"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={statusId}
          aria-controls={`${inputId}-results`}
          disabled={catalogState.status === "error"}
          className="w-full rounded-sm border border-line bg-ivory py-3 pl-10 pr-10 text-base text-charcoal placeholder:text-muted/70 focus:border-burgundy disabled:opacity-60"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:text-burgundy"
            aria-label="Clear search"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <p id={statusId} className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        {catalogState.status === "loading" && <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {status}
        {full && !replaceTarget && <span> · Passport full ({MAX_STAMPS} stamps)</span>}
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {catalogState.status === "error" && (
        <button type="button" onClick={catalogState.retry} className="mt-3 inline-flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm hover:border-burgundy">
          <RotateCcw size={14} aria-hidden="true" /> Try again
        </button>
      )}

      {catalogState.status === "ready" && !query.trim() && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => { setQuery(ex); inputRef.current?.focus(); }}
              className="rounded-sm border border-line bg-ivory px-2.5 py-1 text-xs text-charcoal hover:border-rose"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {catalogState.status === "ready" && !query.trim() && (
        <p className="mt-3 text-[11px] text-muted">
          Place data:{" "}
          <a href="https://www.geonames.org/" className="underline underline-offset-2 hover:text-burgundy">
            GeoNames
          </a>{" "}
          (CC BY 4.0) and{" "}
          <a href="https://www.naturalearthdata.com/" className="underline underline-offset-2 hover:text-burgundy">
            Natural Earth
          </a>
          .
        </p>
      )}

      {catalogState.status === "ready" && query.trim() && results.length === 0 && !stale && (
        <div className="mt-4 border border-dashed border-line px-4 py-8 text-center">
          <p className="font-serif text-lg italic text-charcoal">No place called “{query.trim()}”</p>
          <p className="mt-1 text-sm text-muted">Try another spelling, or the nearest city. Smaller towns (under 15,000 people) aren’t in the atlas yet.</p>
        </div>
      )}

      {results.length > 0 && (
        <ul
          ref={listRef}
          id={`${inputId}-results`}
          aria-label="Search results"
          onKeyDown={onListKeyDown}
          className={`mt-3 max-h-[28rem] overflow-y-auto border-y border-line transition-opacity ${stale ? "opacity-60" : ""}`}
        >
          {results.map((place, index) => {
            const visits = visitsByPlace.get(place.id) ?? 0;
            const context = placeContext(place);
            return (
              <li key={place.id} data-index={index} className="flex items-center gap-3 border-b border-line/70 py-2.5 pl-2 pr-1 last:border-b-0">
                <MotifIcon id={motifFor(place)} className={`h-7 w-7 shrink-0 ${visits ? "text-burgundy" : "text-muted"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-charcoal">{place.name}</p>
                  <p className="truncate text-xs text-muted">
                    <span className="sm:hidden">{kindLabel(place.kind)} · </span>
                    {context}
                  </p>
                </div>
                <span className="hidden shrink-0 rounded-sm bg-paper px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted sm:inline">
                  {kindLabel(place.kind)}
                </span>
                {replaceTarget ? (
                  <button
                    type="button"
                    data-result
                    onClick={(e) => add(place, e.timeStamp)}
                    aria-label={`Use ${place.name}, ${context}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-burgundy px-2.5 py-1.5 text-xs font-medium text-ivory hover:bg-charcoal"
                  >
                    Use this
                  </button>
                ) : visits > 0 ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs text-burgundy">
                      <Check size={14} aria-hidden="true" />
                      <span className="hidden sm:inline">{visits > 1 ? `${visits} visits` : "Collected"}</span>
                    </span>
                    <button
                      type="button"
                      data-result
                      disabled={full}
                      onClick={(e) => addVisit(place, e.timeStamp)}
                      aria-label={`Add another visit to ${place.name}, ${visits} so far`}
                      className="inline-flex items-center gap-1 rounded-sm border border-burgundy px-2.5 py-1.5 text-xs font-medium text-burgundy hover:bg-blush/50 disabled:opacity-50"
                    >
                      <CopyPlus size={14} aria-hidden="true" />
                      <span>Another visit</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-result
                    disabled={full}
                    onClick={(e) => add(place, e.timeStamp)}
                    aria-label={`Add ${place.name}, ${context}, ${kindLabel(place.kind).toLowerCase()}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-line bg-ivory px-2.5 py-1.5 text-xs font-medium text-charcoal hover:border-burgundy hover:text-burgundy disabled:opacity-50"
                  >
                    <Plus size={14} aria-hidden="true" />
                    Add
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
