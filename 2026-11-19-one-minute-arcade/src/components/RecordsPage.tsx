// src/components/RecordsPage.tsx
// the little arcade record book.

import { useState } from "react";
import { useStore } from "../app/store";
import { navigate } from "../app/router";
import { summarize } from "../storage/records";
import { GAMES, getGame } from "../games/registry";
import { Button, Panel } from "./ui";

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="info-box text-center">
      <div className="eyebrow">{label}</div>
      <div className="display mt-1 text-2xl" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

export function RecordsPage() {
  const { records, resetRecords } = useStore();
  const [confirm, setConfirm] = useState(false);
  const s = summarize(records);
  const fav = s.favorite ? getGame(s.favorite)?.title ?? "?" : "nothing yet";
  const recent = s.recent ? getGame(s.recent)?.title ?? "?" : "nothing yet";
  const minutes = s.totalMinutes < 10 ? s.totalMinutes.toFixed(1) : String(Math.round(s.totalMinutes));

  return (
    <section className="mx-auto mt-8 max-w-3xl">
      <h1 className="display text-center text-3xl">my records</h1>
      <p className="mt-1 text-center opacity-80">scores from different games are not comparable. so we do not compare them.</p>
      <Panel className="mt-6 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="games played" value={String(s.totalPlays)} testId="total-plays" />
          <Stat label="minutes played" value={minutes} />
          <Stat label="favorite" value={fav} />
          <Stat label="last played" value={recent} />
        </div>
        <table className="mt-6 w-full border-separate border-spacing-y-2 text-left">
          <thead>
            <tr className="eyebrow">
              <th scope="col" className="px-2">game</th>
              <th scope="col" className="px-2 text-right">best</th>
              <th scope="col" className="px-2 text-right">last</th>
              <th scope="col" className="px-2 text-right">plays</th>
            </tr>
          </thead>
          <tbody>
            {GAMES.map((g) => {
              const r = records.games[g.id];
              return (
                <tr key={g.id} className="bg-white font-bold" data-testid={`record-${g.id}`}>
                  <th scope="row" className="rounded-l-xl border-y-2 border-l-2 border-ink px-3 py-2">
                    <a
                      href={`/play/${g.id}`}
                      className="underline decoration-2 underline-offset-2"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/play/${g.id}`);
                      }}
                    >
                      {g.title}
                    </a>
                  </th>
                  <td className="pixel border-y-2 border-ink px-2 text-right" data-testid={`best-${g.id}`}>
                    {r?.best ?? 0}
                  </td>
                  <td className="pixel border-y-2 border-ink px-2 text-right">{r ? r.last : "..."}</td>
                  <td className="pixel rounded-r-xl border-y-2 border-r-2 border-ink px-3 text-right">{r?.plays ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-6 flex justify-end">
          {confirm ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="font-bold">wipe every record for good?</span>
              <Button
                tone="tomato"
                size="sm"
                onClick={() => {
                  resetRecords();
                  setConfirm(false);
                }}
              >
                yes, wipe them
              </Button>
              <Button tone="paper" size="sm" onClick={() => setConfirm(false)}>
                keep them
              </Button>
            </div>
          ) : (
            <Button tone="paper" size="sm" onClick={() => setConfirm(true)}>
              reset records
            </Button>
          )}
        </div>
      </Panel>
    </section>
  );
}
