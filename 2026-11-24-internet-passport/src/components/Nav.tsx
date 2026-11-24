// src/components/Nav.tsx
// airport wayfinding signs on wide screens, a pocket tab bar on phones.

import { Glyph } from "./glyphs";
import { href } from "../lib/router";

export const SECTIONS = [
  { key: "", label: "departure hall", short: "hall", gate: "A1", glyph: "plane" },
  { key: "atlas", label: "world atlas", short: "atlas", gate: "A2", glyph: "map" },
  { key: "passport", label: "my passport", short: "passport", gate: "B1", glyph: "book" },
  { key: "expeditions", label: "expeditions", short: "journeys", gate: "B2", glyph: "flag" },
  { key: "journal", label: "travel journal", short: "journal", gate: "C1", glyph: "postcard" },
  { key: "profile", label: "explorer profile", short: "profile", gate: "C2", glyph: "compass" },
];

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 100 100" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <Glyph name={name} />
      </g>
    </svg>
  );
}

export function Nav({ current }: { current: string }) {
  return (
    <>
      <nav className="signage" aria-label="main">
        <a className="signage-brand" href={href("/")}>
          <span className="brand-mark" aria-hidden="true">
            <Icon name="globe" />
          </span>
          <span>
            internet passport
            <small>the internet is a world worth exploring</small>
          </span>
        </a>
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.key}>
              <a href={href(`/${s.key}`)} aria-current={current === s.key ? "page" : undefined} className="sign">
                <span className="sign-gate">{s.gate}</span>
                <Icon name={s.glyph} />
                <span className="sign-label">{s.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <nav className="pocketbar" aria-label="main">
        {SECTIONS.map((s) => (
          <a key={s.key} href={href(`/${s.key}`)} aria-current={current === s.key ? "page" : undefined}>
            <Icon name={s.glyph} />
            <span>{s.short}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
