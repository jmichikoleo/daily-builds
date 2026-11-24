// src/components/Directory.tsx
// searchable, filterable list of destinations. used by the atlas and by each territory.

import { useMemo, useState } from "react";
import type { Rarity, TerritoryId } from "../types";
import { DESTINATIONS } from "../data/destinations";
import { REGULAR_TERRITORIES, territory } from "../data/territories";
import { usePassport } from "../lib/store";
import { isOpen, visitedSet } from "../lib/logic";
import { DestinationCard } from "./DestinationCard";
import { Empty } from "./bits";

type Status = "all" | "visited" | "unvisited" | "saved";

export function Directory({ fixedTerritory, initialTag }: { fixedTerritory?: TerritoryId; initialTag?: string }) {
  const { state } = usePassport();
  const [q, setQ] = useState("");
  const [terr, setTerr] = useState<TerritoryId | "all">(fixedTerritory ?? "all");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [status, setStatus] = useState<Status>("all");
  const [tag, setTag] = useState(initialTag ?? "all");

  const open = useMemo(() => DESTINATIONS.filter((d) => isOpen(state, d)), [state]);
  const pool = fixedTerritory ? open.filter((d) => d.territory === fixedTerritory) : open;
  const tags = useMemo(() => [...new Set(pool.flatMap((d) => d.tags))].sort(), [pool]);
  const seen = visitedSet(state);

  const needle = q.trim().toLowerCase();
  const list = pool.filter((d) => {
    if (terr !== "all" && d.territory !== terr) return false;
    if (rarity !== "all" && d.rarity !== rarity) return false;
    if (status === "visited" && !seen.has(d.id)) return false;
    if (status === "unvisited" && seen.has(d.id)) return false;
    if (status === "saved" && !state.favorites.includes(d.id)) return false;
    if (tag !== "all" && !d.tags.includes(tag)) return false;
    if (needle) {
      const hay = `${d.name} ${d.description} ${d.tags.join(" ")} ${d.url} ${territory(d.territory).name}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const territoriesInPool = fixedTerritory ? [] : [...REGULAR_TERRITORIES, ...(open.some((d) => d.territory === "hidden") ? [territory("hidden")] : [])];
  const filtered = q || rarity !== "all" || status !== "all" || tag !== "all" || (!fixedTerritory && terr !== "all");

  return (
    <section className="directory" aria-labelledby="dir-h">
      <h2 id="dir-h" className="display">
        {fixedTerritory ? "destination directory" : "the destination directory"}
      </h2>
      <form className="filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="field grow">
          <span>search</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="radio, maps, cats..." />
        </label>
        {!fixedTerritory && (
          <label className="field">
            <span>territory</span>
            <select value={terr} onChange={(e) => setTerr(e.target.value as TerritoryId | "all")}>
              <option value="all">everywhere</option>
              {territoriesInPool.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.short}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>rarity</span>
          <select value={rarity} onChange={(e) => setRarity(e.target.value as Rarity | "all")}>
            <option value="all">any rarity</option>
            <option value="common">common</option>
            <option value="rare">rare</option>
            <option value="secret">secret</option>
          </select>
        </label>
        <label className="field">
          <span>status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="all">all</option>
            <option value="unvisited">not visited yet</option>
            <option value="visited">visited</option>
            <option value="saved">saved for later</option>
          </select>
        </label>
        <label className="field">
          <span>tag</span>
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="all">any tag</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </form>
      <p className="muted small" aria-live="polite">
        {list.length} of {pool.length} destinations
        {filtered && (
          <>
            {" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setQ("");
                setRarity("all");
                setStatus("all");
                setTag("all");
                if (!fixedTerritory) setTerr("all");
              }}
            >
              clear filters
            </button>
          </>
        )}
      </p>
      {list.length === 0 ? (
        <Empty title="no destinations match">
          <p>try a different word or loosen a filter. the internet is big, the search box is small.</p>
        </Empty>
      ) : (
        <div className="cards">
          {list.map((d) => (
            <DestinationCard key={d.id} d={d} />
          ))}
        </div>
      )}
    </section>
  );
}
