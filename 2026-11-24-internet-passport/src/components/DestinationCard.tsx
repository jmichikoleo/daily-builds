// src/components/DestinationCard.tsx
// a destination in a directory: a luggage tag style card.

import type { Destination } from "../types";
import { territory } from "../data/territories";
import { usePassport } from "../lib/store";
import { hasVisited } from "../lib/logic";
import { host } from "../lib/format";
import { href } from "../lib/router";
import { CatalogStamp, RarityTag, Warnings } from "./bits";

export function FavoriteButton({ id, name }: { id: string; name: string }) {
  const { state, toggleFavorite } = usePassport();
  const on = state.favorites.includes(id);
  return (
    <button
      type="button"
      className={`fav ${on ? "on" : ""}`}
      aria-pressed={on}
      aria-label={on ? `remove ${name} from places i want to return to` : `save ${name} to places i want to return to`}
      title={on ? "saved to places i want to return to" : "save for later"}
      onClick={() => toggleFavorite(id)}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M6 3h12v18l-6-4-6 4z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function DestinationCard({ d }: { d: Destination }) {
  const { state } = usePassport();
  const t = territory(d.territory);
  const visited = hasVisited(state, d.id);
  const earned = state.stamps[`dest:${d.id}`]?.earnedAt;
  return (
    <article className={`dest-card ${visited ? "visited" : ""}`} style={{ ["--accent" as string]: t.color, ["--ink-accent" as string]: t.ink }}>
      <div className="dest-card-top">
        <span className="dest-territory">{t.short}</span>
        <FavoriteButton id={d.id} name={d.name} />
      </div>
      <h3 className="dest-name">
        <a href={href(`/destination/${d.id}`)}>{d.name}</a>
      </h3>
      <p className="dest-host mono">{host(d.url)}</p>
      <p className="dest-desc">{d.description}</p>
      <ul className="tags" aria-label="tags">
        {d.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <Warnings list={d.warnings} />
      {d.access && d.access.kind !== "free" && <p className="access small">{d.access.text}</p>}
      <div className="dest-card-foot">
        <span className="mono small">about {d.minutes} min</span>
        <RarityTag rarity={d.rarity} />
        <span className="dest-state">{visited ? "stamped" : "not yet visited"}</span>
      </div>
      <a className="btn btn-small" href={href(`/destination/${d.id}`)} aria-label={`${visited ? "revisit" : "visit"} ${d.name}`}>
        {visited ? "revisit" : "go to the gate"}
      </a>
      <div className="dest-card-stamp" aria-hidden="true">
        <CatalogStamp stampId={`dest:${d.id}`} earnedAt={earned} size={78} faded={!visited} />
      </div>
    </article>
  );
}
