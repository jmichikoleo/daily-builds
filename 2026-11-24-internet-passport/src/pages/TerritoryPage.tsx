// src/pages/TerritoryPage.tsx
// one territory: emblem, progress, completion reward and its directory.
// the hidden territories show hints for places not yet revealed.

import { usePassport } from "../lib/store";
import { TERRITORIES } from "../data/territories";
import { SECRET_DESTINATIONS, destinationsIn } from "../data/destinations";
import { conditionProgress, hasVisited, territoryComplete, visitsIn } from "../lib/logic";
import { CatalogStamp, Emblem, Empty, Progress } from "../components/bits";
import { Directory } from "../components/Directory";
import { DestinationCard } from "../components/DestinationCard";
import { href } from "../lib/router";
import type { TerritoryId } from "../types";

function HiddenTerritory() {
  const { state } = usePassport();
  const t = TERRITORIES.find((x) => x.id === "hidden")!;
  const revealed = SECRET_DESTINATIONS.filter((d) => state.unlockedSecrets[d.id]);
  const locked = SECRET_DESTINATIONS.filter((d) => !state.unlockedSecrets[d.id]);
  return (
    <main id="main" className="page territory-page hidden-page" tabIndex={-1} style={{ ["--accent" as string]: t.color, ["--ink-accent" as string]: t.ink }}>
      <a className="back" href={href("/atlas")}>
        back to the atlas
      </a>
      <header className="territory-banner">
        <Emblem t={t} size={120} />
        <div>
          <p className="kicker">terra incognita</p>
          <h1 className="display big">{t.name}</h1>
          <p className="lede">{t.blurb}</p>
          <p className="mono small">
            {revealed.length} of {SECRET_DESTINATIONS.length} revealed, {visitsIn(state, "hidden")} visited
          </p>
        </div>
      </header>

      {revealed.length > 0 && (
        <section aria-labelledby="rev-h">
          <h2 id="rev-h" className="display">
            revealed so far
          </h2>
          <div className="cards">
            {revealed.map((d) => (
              <DestinationCard key={d.id} d={d} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="hint-h">
        <h2 id="hint-h" className="display">
          rumours from other travellers
        </h2>
        {locked.length === 0 ? (
          <Empty title="every hidden place has been found">
            <p>the department has nothing left to whisper about. well done.</p>
          </Empty>
        ) : (
          <ul className="rumours">
            {locked.map((d, i) => {
              const p = conditionProgress(state, d.secret!.unlock);
              const showCount = !["discovery", "nightVisit"].includes(d.secret!.unlock.type);
              return (
                <li key={d.id} className="rumour paper">
                  <span className="rumour-no mono">rumour no. {String(i + 1).padStart(2, "0")}</span>
                  <CatalogStamp stampId={`dest:${d.id}`} size={70} faded mystery title="unknown stamp" />
                  <p className="handwritten">{d.secret!.hint}</p>
                  {showCount && (
                    <>
                      <Progress value={p.have} total={p.need} label="rumour progress" color={t.ink} />
                      <span className="mono small">
                        {p.have} of {p.need}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted small">
          a note from the department. these secrets live in your browser, so a determined traveller could peek at the code. it is more fun to find them.
        </p>
      </section>
    </main>
  );
}

export function TerritoryPage({ id }: { id: string }) {
  const { state } = usePassport();
  const t = TERRITORIES.find((x) => x.id === id);
  if (!t) {
    return (
      <main id="main" className="page" tabIndex={-1}>
        <Empty title="that land is not on any map">
          <a className="btn" href={href("/atlas")}>
            back to the atlas
          </a>
        </Empty>
      </main>
    );
  }
  if (t.id === "hidden") return <HiddenTerritory />;

  const tid = t.id as TerritoryId;
  const all = destinationsIn(tid);
  const n = visitsIn(state, tid);
  const done = territoryComplete(state, tid);
  const reward = state.stamps[`terr:${tid}`];
  const left = all.filter((d) => !hasVisited(state, d.id)).length;

  return (
    <main id="main" className="page territory-page" tabIndex={-1} style={{ ["--accent" as string]: t.color, ["--ink-accent" as string]: t.ink }}>
      <a className="back" href={href("/atlas")}>
        back to the atlas
      </a>
      <header className="territory-banner">
        <Emblem t={t} size={120} />
        <div>
          <p className="kicker">territory code {t.code}</p>
          <h1 className="display big">{t.name}</h1>
          <p className="ticket-territory">{t.theme}</p>
          <p className="lede">{t.blurb}</p>
          <Progress value={n} total={all.length} label={`${t.name} exploration progress`} color={t.ink} />
          <p className="mono small">
            {n} of {all.length} destinations explored
          </p>
        </div>
        <figure className="reward">
          <CatalogStamp stampId={`terr:${tid}`} earnedAt={reward?.earnedAt} size={130} faded={!reward} title={`completion stamp for ${t.name}`} />
          <figcaption className="small">
            {done ? "completion stamp earned" : `completion reward. ${left} more to go`}
          </figcaption>
        </figure>
      </header>
      <Directory fixedTerritory={tid} />
    </main>
  );
}
