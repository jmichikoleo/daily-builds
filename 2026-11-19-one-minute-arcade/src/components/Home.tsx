// src/components/Home.tsx
// the cartridge shelf. six games, one big surprise button.

import { navigate } from "../app/router";
import { useStore } from "../app/store";
import type { Shuffle } from "../app/App";
import { GAMES } from "../games/registry";
import { Button, DifficultyPips } from "./ui";

export function Home({ shuffle, onSurprise }: { shuffle: Shuffle; onSurprise(): void }) {
  const { records } = useStore();
  return (
    <>
      <section className="mt-6 flex flex-col items-center gap-3 text-center">
        <p className="max-w-md text-lg font-bold">Got a minute? Waste it beautifully.</p>
        <p className="max-w-md opacity-80">six little games. sixty seconds each. absolutely no idea what happens next.</p>
        <Button tone="tomato" size="lg" onClick={onSurprise} disabled={shuffle.active} className="mt-2 px-8" data-testid="surprise">
          <span className="display text-xl tracking-wide normal-case">SURPRISE ME</span>
        </Button>
        <p className="sr-only" aria-live="polite">
          {shuffle.chosen ? `loading ${GAMES.find((g) => g.id === shuffle.chosen)?.title}` : shuffle.active ? "shuffling the cartridges" : ""}
        </p>
      </section>

      <section aria-label="all games" className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g, i) => {
          const rec = records.games[g.id];
          const isChosen = shuffle.chosen === g.id;
          const cls = shuffle.active ? (shuffle.chosen ? (isChosen ? "is-chosen" : "opacity-50") : "is-shuffling") : "";
          return (
            <article
              key={g.id}
              className={`cart ${cls}`}
              style={{ ["--cart-color" as string]: g.theme.accent, animationDelay: `${i * -0.07}s` }}
              data-testid={`cart-${g.id}`}
            >
              <div className="cart-label">
                <g.Thumbnail />
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <h2 className="display text-xl leading-tight" style={{ color: "#2b2340" }}>
                  {g.title}
                </h2>
                <span className="best-chip shrink-0" title="personal best">
                  best {rec?.best ?? 0}
                </span>
              </div>
              <p className="mt-1 flex-1 font-bold">{g.description}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <DifficultyPips level={g.difficulty} />
                <Button tone="ink" onClick={() => navigate(`/play/${g.id}`)} aria-label={`play ${g.title}`}>
                  play ▶
                </Button>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
