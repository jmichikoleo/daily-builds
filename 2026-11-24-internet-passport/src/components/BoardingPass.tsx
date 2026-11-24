// src/components/BoardingPass.tsx
// a personalised boarding pass for one destination, with a tear off stub.

import type { Destination } from "../types";
import { territory } from "../data/territories";
import { flightCode, explorerTitle } from "../lib/logic";
import { usePassport } from "../lib/store";
import { clock, host, niceDate } from "../lib/format";
import { CatalogStamp } from "./bits";

function seat(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${(h % 38) + 1}${"ABCDEF"[h % 6]}`;
}

export function BoardingPass({ d, mystery, stamped }: { d: Destination; mystery?: boolean; stamped?: boolean }) {
  const { state } = usePassport();
  const t = territory(d.territory);
  const now = new Date();
  const p = state.profile!;
  return (
    <article className="boarding-pass" style={{ ["--accent" as string]: t.color, ["--ink-accent" as string]: t.ink }} aria-label={`boarding pass to ${d.name}`}>
      <div className="bp-main">
        <header className="bp-head">
          <span className="bp-airline">dept. of internet exploration</span>
          <span className="bp-class">boarding pass</span>
        </header>
        <div className="bp-route">
          <div>
            <small>from</small>
            <strong>your usual tabs</strong>
          </div>
          <svg viewBox="0 0 100 100" width="34" height="34" aria-hidden="true" className="bp-plane">
            <path d="M18 54 30 52 44 38 40 22h6l16 26 16-2c4 0 6 2 6 4s-2 4-6 4l-16-2-16 26h-6l4-16-14-14-12-2z" fill="currentColor" />
          </svg>
          <div>
            <small>to</small>
            <strong>{mystery ? "somewhere new" : d.name}</strong>
          </div>
        </div>
        <dl className="bp-grid">
          <div>
            <dt>passenger</dt>
            <dd>{p.name}</dd>
          </div>
          <div>
            <dt>flight</dt>
            <dd>{flightCode(d)}</dd>
          </div>
          <div>
            <dt>territory</dt>
            <dd>{t.short}</dd>
          </div>
          <div>
            <dt>seat</dt>
            <dd>{seat(d.id)}</dd>
          </div>
          <div>
            <dt>boards</dt>
            <dd>{clock(now)}</dd>
          </div>
          <div>
            <dt>trip length</dt>
            <dd>about {d.minutes} min</dd>
          </div>
        </dl>
        <p className="bp-foot">
          {explorerTitle(state.visits.length)} class, {niceDate(now)}
          {!mystery && <span className="bp-host">{host(d.url)}</span>}
        </p>
      </div>
      <div className="bp-stub" aria-hidden="true">
        <span className="bp-stub-code">{flightCode(d)}</span>
        <CatalogStamp stampId={`dest:${d.id}`} size={74} faded={!stamped} mystery={mystery} />
        <span className="bp-barcode" />
      </div>
    </article>
  );
}
