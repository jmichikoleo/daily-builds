// src/components/Ceremony.tsx
// shows the award queue one at a time. a stamp lands on a passport page with
// an ink thump. a secret destination is revealed through clearing fog.

import { useEffect, useRef } from "react";
import { usePassport, useReducedMotion } from "../lib/store";
import { stampById } from "../data/stamps";
import { destination } from "../data/destinations";
import { ACHIEVEMENTS } from "../data/achievements";
import { CatalogStamp, RarityTag } from "./bits";
import { chime, thump } from "../lib/sound";
import { go } from "../lib/router";

const KIND_LINE: Record<string, string> = {
  welcome: "your first stamp, from the department itself",
  destination: "a new stamp for your passport",
  achievement: "a special achievement stamp",
  territory: "a whole territory explored",
  expedition: "expedition complete",
};

export function Ceremony() {
  const { queue, dismissAward, state } = usePassport();
  const reduced = useReducedMotion();
  const award = queue[0];
  const btn = useRef<HTMLButtonElement>(null);
  const key = award ? JSON.stringify(award) + queue.length : "";

  useEffect(() => {
    if (!award) return;
    btn.current?.focus();
    if (state.preferences.sound) {
      const t = setTimeout(() => (award.type === "secret" ? chime() : thump()), reduced ? 0 : 380);
      return () => clearTimeout(t);
    }
  }, [key, award, reduced, state.preferences.sound]);

  if (!award) return null;

  if (award.type === "secret") {
    const d = destination(award.destinationId);
    if (!d) return null;
    return (
      <div className="ceremony ceremony-secret" role="dialog" aria-modal="true" aria-label="hidden destination revealed">
        <div className="fog" aria-hidden="true" />
        <div className="ceremony-card paper reveal-card" key={key}>
          <p className="kicker">a hidden destination has been revealed</p>
          <div className="reveal-keyhole" aria-hidden="true">
            <CatalogStamp stampId={`dest:${d.id}`} size={150} mystery />
          </div>
          <h2 className="display">{d.name}</h2>
          <p className="handwritten">{d.secret?.hint}</p>
          <div className="row center">
            <button
              ref={btn}
              className="btn btn-primary"
              onClick={() => {
                dismissAward();
                go(`/destination/${d.id}`);
              }}
            >
              see where it leads
            </button>
            <button className="btn" onClick={dismissAward}>
              later
            </button>
          </div>
        </div>
      </div>
    );
  }

  const s = stampById(award.stampId);
  if (!s) return null;
  const earned = state.stamps[award.stampId]?.earnedAt;
  const ach = s.kind === "achievement" ? ACHIEVEMENTS.find((a) => a.id === s.sourceId) : null;

  return (
    <div className={`ceremony rarity-bg-${s.rarity}`} role="dialog" aria-modal="true" aria-label="stamp collected">
      <div className="ceremony-card paper" key={key}>
        <p className="kicker">{KIND_LINE[s.kind]}</p>
        <div className="stamp-landing">
          <div className="ink-splash" aria-hidden="true" />
          <div className="stamp-drop">
            <CatalogStamp stampId={s.id} earnedAt={earned} size={190} />
          </div>
        </div>
        <h2 className="display">{s.name}</h2>
        {ach && <p className="muted">{ach.description}</p>}
        <p>
          <RarityTag rarity={s.rarity} />
        </p>
        <div className="row center">
          <button ref={btn} className="btn btn-primary" onClick={dismissAward}>
            {queue.length > 1 ? `next, ${queue.length - 1} more` : "lovely, continue"}
          </button>
          {s.kind !== "welcome" && queue.length === 1 && (
            <button
              className="btn"
              onClick={() => {
                dismissAward();
                go("/passport");
              }}
            >
              open my passport
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
