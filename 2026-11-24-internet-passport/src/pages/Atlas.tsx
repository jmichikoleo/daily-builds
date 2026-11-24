// src/pages/Atlas.tsx
// the illustrated map of the internet, plus an accessible list view and the
// full destination directory underneath.

import { usePassport } from "../lib/store";
import { REGULAR_TERRITORIES, territory } from "../data/territories";
import { destinationsIn } from "../data/destinations";
import { territoryComplete, visitsIn } from "../lib/logic";
import { Emblem, Progress } from "../components/bits";
import { Directory } from "../components/Directory";
import { Glyph } from "../components/glyphs";
import { go, href } from "../lib/router";
import type { TerritoryId } from "../types";

function land(cx: number, cy: number, rx: number, ry: number, seed: number, n = 14) {
  let h = seed * 9301 + 49297;
  const rand = () => {
    h = (h * 9301 + 49297) % 233280;
    return h / 233280;
  };
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n;
    const k = 0.78 + rand() * 0.34;
    return [cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)];
  });
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const s = mid(pts[n - 1], pts[0]);
  let d = `M${s[0].toFixed(0)} ${s[1].toFixed(0)}`;
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    d += ` Q${pts[i][0].toFixed(0)} ${pts[i][1].toFixed(0)} ${m[0].toFixed(0)} ${m[1].toFixed(0)}`;
  }
  return d + " Z";
}

const PLACES: Record<Exclude<TerritoryId, "hidden">, { x: number; y: number; shapes: string[] }> = {
  creative: { x: 175, y: 165, shapes: [land(175, 165, 135, 95, 3)] },
  science: { x: 495, y: 130, shapes: [land(495, 130, 150, 85, 7), land(645, 70, 32, 22, 2)] },
  sound: { x: 840, y: 190, shapes: [land(810, 150, 62, 44, 11, 10), land(900, 220, 48, 36, 5, 9), land(800, 245, 34, 26, 9, 8), land(905, 120, 22, 16, 4, 7)] },
  frontier: { x: 165, y: 420, shapes: [land(165, 420, 120, 100, 13)] },
  oddlands: { x: 480, y: 365, shapes: [land(480, 365, 125, 80, 17, 16), land(600, 300, 26, 34, 21, 8)] },
  archive: { x: 810, y: 430, shapes: [land(810, 430, 125, 92, 23)] },
  playground: { x: 420, y: 575, shapes: [land(420, 575, 135, 62, 29)] },
  quiet: { x: 760, y: 610, shapes: [land(700, 610, 70, 40, 31, 10), land(830, 615, 95, 38, 37, 12)] },
};

function WorldMap() {
  const { state, discover } = usePassport();
  const bottleFound = Boolean(state.discoveries.bottle);
  const hidden = territory("hidden");
  const hiddenOpen = Object.keys(state.unlockedSecrets).length;

  return (
    <div className="map-wrap paper">
      <svg viewBox="0 0 1000 700" className="world-map" role="group" aria-label="illustrated map of the internet territories">
        <defs>
          <pattern id="sea" width="40" height="22" patternUnits="userSpaceOnUse">
            <path d="M0 11 q10 -8 20 0 t20 0" fill="none" stroke="#496B8A" strokeOpacity="0.18" strokeWidth="1.4" />
          </pattern>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#382D29" strokeOpacity="0.12" strokeWidth="2" />
          </pattern>
          <radialGradient id="fogg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8C6A8F" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#F8F1E5" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1000" height="700" fill="#DCE6EA" />
        <rect width="1000" height="700" fill="url(#sea)" />
        <rect x="8" y="8" width="984" height="684" fill="none" stroke="#382D29" strokeWidth="2" />
        <rect x="16" y="16" width="968" height="668" fill="none" stroke="#382D29" strokeWidth="0.8" strokeDasharray="4 4" />

        <g fill="none" stroke="#783B49" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" opacity="0.55" aria-hidden="true">
          <path d="M260 170 Q340 90 380 120" />
          <path d="M630 130 Q720 120 760 160" />
          <path d="M200 260 Q170 300 170 330" />
          <path d="M290 420 Q360 380 380 375" />
          <path d="M590 380 Q660 420 700 425" />
          <path d="M470 445 Q450 500 440 515" />
          <path d="M800 520 Q790 560 790 575" />
        </g>

        {(Object.keys(PLACES) as Exclude<TerritoryId, "hidden">[]).map((id) => {
          const t = territory(id);
          const pl = PLACES[id];
          const total = destinationsIn(id).length;
          const n = visitsIn(state, id);
          const done = territoryComplete(state, id);
          return (
            <a
              key={id}
              href={href(`/atlas/${id}`)}
              className="territory-land"
              aria-label={`${t.name}, ${n} of ${total} destinations visited${done ? ", complete" : ""}`}
            >
              {pl.shapes.map((d, i) => (
                <g key={i}>
                  <path d={d} fill={t.color} stroke={t.ink} strokeWidth="2.5" strokeLinejoin="round" />
                  <path d={d} fill="url(#hatch)" />
                </g>
              ))}
              <circle cx={pl.x} cy={pl.y - 14} r="26" fill="#F8F1E5" stroke={t.ink} strokeWidth="2" />
              <g transform={`translate(${pl.x} ${pl.y - 14}) scale(0.34) translate(-50 -50)`} fill="none" stroke={t.ink} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
                <Glyph name={t.emblem} />
              </g>
              <text x={pl.x} y={pl.y + 32} textAnchor="middle" className="map-label" fill="#382D29">
                {t.name.replace(/^The /, "the ")}
              </text>
              <text x={pl.x} y={pl.y + 52} textAnchor="middle" className="map-count" fill={t.ink}>
                {done ? "fully explored" : `${n} of ${total} visited`}
              </text>
            </a>
          );
        })}

        <a href={href("/atlas/hidden")} className="territory-land" aria-label={`${hidden.name}, ${hiddenOpen} revealed`}>
          <ellipse cx="110" cy="610" rx="110" ry="72" fill="url(#fogg)" />
          <path d={land(110, 615, 52, 30, 41, 9)} fill="#8C6A8F" fillOpacity="0.45" stroke="#4A2A4F" strokeWidth="2" strokeDasharray="5 5" />
          <text x="110" y="624" textAnchor="middle" fontSize="30" fill="#4A2A4F" fontFamily="Fraunces Variable, serif">
            ?
          </text>
          <text x="110" y="672" textAnchor="middle" className="map-count" fill="#4A2A4F">
            {hiddenOpen ? `${hiddenOpen} hidden places revealed` : "here be secrets"}
          </text>
        </a>

        <g transform="translate(948 302) scale(0.8)" aria-hidden="true" fill="none" stroke="#382D29" strokeWidth="1.6">
          <circle r="38" />
          <circle r="30" strokeDasharray="2 4" />
          <path d="M0 -46 L7 0 L0 46 L-7 0 Z" fill="#783B49" fillOpacity="0.8" />
          <path d="M-46 0 L0 7 L46 0 L0 -7 Z" fill="#F8F1E5" />
          <text y="-50" textAnchor="middle" fontSize="12" fill="#382D29" stroke="none" fontFamily="Courier Prime, monospace">
            N
          </text>
        </g>

        <text x="560" y="470" className="map-note" fill="#4B5277" transform="rotate(-6 560 470)" aria-hidden="true">
          here be eels
        </text>
        <text x="300" y="300" className="map-note" fill="#4B5277" transform="rotate(4 300 300)" aria-hidden="true">
          the sea of open tabs
        </text>

        <g aria-hidden="true" transform="translate(262 470) scale(0.5)" fill="none" stroke="#2F4F6E" strokeWidth="5" strokeLinecap="round">
          <Glyph name="boat" />
        </g>

        {!bottleFound && (
          <g
            className="bottle"
            role="button"
            tabIndex={0}
            aria-label="something small floating in the sea"
            onClick={() => discover("bottle")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                discover("bottle");
              }
            }}
          >
            <rect x="606" y="210" width="40" height="40" fill="transparent" />
            <g transform="translate(626 230) rotate(60) scale(0.2) translate(-50 -50)" fill="#F8F1E5" stroke="#2F4F6E" strokeWidth="7">
              <Glyph name="bottle" />
            </g>
          </g>
        )}
      </svg>
      <p className="map-caption handwritten">drawn from memory by the department. not to scale. not to any scale.</p>
    </div>
  );
}

function ListView() {
  const { state } = usePassport();
  return (
    <ul className="territory-list">
      {[...REGULAR_TERRITORIES, territory("hidden")].map((t) => {
        const total = destinationsIn(t.id).length;
        const n = visitsIn(state, t.id);
        const isHidden = t.id === "hidden";
        const revealed = Object.keys(state.unlockedSecrets).length;
        return (
          <li key={t.id} style={{ ["--accent" as string]: t.color }}>
            <a href={href(`/atlas/${t.id}`)} className="territory-row">
              <Emblem t={t} size={56} />
              <span className="territory-row-text">
                <strong>{t.name}</strong>
                <small>{t.theme}</small>
              </span>
              <span className="territory-row-progress">
                <span className="mono small">{isHidden ? `${revealed} revealed, ${n} visited` : `${n} of ${total}`}</span>
                <Progress value={n} total={total} label={`${t.name} progress`} color={t.ink} />
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function Atlas({ query }: { query: Record<string, string> }) {
  const { state, setPreferences } = usePassport();
  const view = state.preferences.atlasView;
  return (
    <main id="main" className="page" tabIndex={-1}>
      <header className="page-head">
        <p className="kicker">world atlas</p>
        <h1 className="display big">a map of the internet, roughly</h1>
        <p className="lede">eight territories and one place that is not on the map. pick a land to see its destinations.</p>
        <div className="segmented" role="group" aria-label="atlas view">
          <button aria-pressed={view === "map"} onClick={() => setPreferences({ atlasView: "map" })}>
            illustrated map
          </button>
          <button aria-pressed={view === "list"} onClick={() => setPreferences({ atlasView: "list" })}>
            list view
          </button>
        </div>
      </header>
      {view === "map" ? <WorldMap /> : <ListView />}
      {view === "map" && (
        <p className="muted small center">
          prefer words to maps? switch to the{" "}
          <button className="link-btn" onClick={() => setPreferences({ atlasView: "list" })}>
            list view
          </button>
          , or jump to <button className="link-btn" onClick={() => go("/atlas/hidden")}>the hidden territories</button>.
        </p>
      )}
      <Directory initialTag={query.tag} />
    </main>
  );
}
