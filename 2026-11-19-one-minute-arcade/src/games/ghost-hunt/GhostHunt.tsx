// src/games/ghost-hunt/GhostHunt.tsx
// a cute haunted bedroom. ghosts peek, giggle and hop between hiding spots.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { GameProps } from "../../engine/types";
import { useFrameRender } from "../../hooks/useGame";
import { SPOTS, newHaunt, stepHaunt, tapSpot, type Haunt, type Spook } from "./logic";

const ink = "#2b2340";

// where each hiding spot sits in the room, in percent of the room box
const LAYOUT: { x: number; y: number; w: number; h: number; peek: "top" | "left" | "right" }[] = [
  { x: 3, y: 18, w: 20, h: 58, peek: "right" }, // wardrobe
  { x: 56, y: 58, w: 40, h: 26, peek: "top" }, // bed
  { x: 84, y: 22, w: 12, h: 34, peek: "left" }, // lamp
  { x: 27, y: 6, w: 16, h: 50, peek: "right" }, // curtain
  { x: 61, y: 8, w: 18, h: 40, peek: "top" }, // bookshelf
  { x: 6, y: 80, w: 22, h: 16, peek: "top" }, // toy chest
  { x: 45, y: 12, w: 13, h: 16, peek: "top" }, // painting
  { x: 32, y: 62, w: 20, h: 30, peek: "top" }, // armchair
];

// a taller room for phones held upright
const PORTRAIT: typeof LAYOUT = [
  { x: 3, y: 14, w: 26, h: 40, peek: "right" }, // wardrobe
  { x: 42, y: 72, w: 55, h: 17, peek: "top" }, // bed
  { x: 84, y: 36, w: 13, h: 26, peek: "left" }, // lamp
  { x: 35, y: 4, w: 20, h: 34, peek: "right" }, // curtain
  { x: 68, y: 6, w: 26, h: 28, peek: "left" }, // bookshelf
  { x: 4, y: 84, w: 32, h: 12, peek: "top" }, // toy chest
  { x: 44, y: 44, w: 17, h: 11, peek: "top" }, // painting
  { x: 10, y: 61, w: 28, h: 21, peek: "top" }, // armchair
];

function usePortrait() {
  const q = "(max-aspect-ratio: 4/5)";
  const [p, setP] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setP(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return p;
}

function Furniture({ i }: { i: number }) {
  const common = { stroke: ink, strokeWidth: 3, strokeLinejoin: "round" as const };
  const art: ReactNode[] = [
    <svg key="w" viewBox="0 0 60 150" preserveAspectRatio="none">
      <rect x="2" y="2" width="56" height="140" rx="4" fill="#8a7ad1" {...common} />
      <path d="M30 4v136" {...common} />
      <circle cx="25" cy="70" r="3" fill={ink} />
      <circle cx="35" cy="70" r="3" fill={ink} />
      <rect x="6" y="142" width="8" height="6" fill={ink} />
      <rect x="46" y="142" width="8" height="6" fill={ink} />
    </svg>,
    <svg key="b" viewBox="0 0 160 80" preserveAspectRatio="none">
      <rect x="4" y="10" width="14" height="66" rx="3" fill="#6a5ac0" {...common} />
      <rect x="14" y="34" width="142" height="36" rx="8" fill="#7fb4ef" {...common} />
      <rect x="20" y="22" width="40" height="20" rx="8" fill="#fff" {...common} />
      <path d="M70 34q40 10 84 0" fill="none" stroke="#fff" strokeWidth="3" opacity="0.6" />
    </svg>,
    <svg key="l" viewBox="0 0 50 140" preserveAspectRatio="none">
      <path d="M8 40L18 4h14l10 36z" fill="#ffe27a" {...common} />
      <path d="M25 40v86" {...common} />
      <rect x="10" y="124" width="30" height="10" rx="4" fill="#6a5ac0" {...common} />
    </svg>,
    <svg key="c" viewBox="0 0 60 180" preserveAspectRatio="none">
      <path d="M2 6h56" stroke={ink} strokeWidth="5" />
      <path d="M6 8q6 80 -2 168h44q-10-90 6-168z" fill="#ff8fc7" {...common} />
      <path d="M20 10q4 80 -4 164M34 10q4 80 -2 164" fill="none" stroke={ink} strokeWidth="1.5" opacity="0.4" />
    </svg>,
    <svg key="s" viewBox="0 0 70 150" preserveAspectRatio="none">
      <rect x="3" y="3" width="64" height="144" rx="4" fill="#b58a63" {...common} />
      {[40, 80, 120].map((y) => (
        <path key={y} d={`M3 ${y}h64`} {...common} />
      ))}
      {[10, 18, 26, 40, 48].map((x, k) => (
        <rect key={x} x={x} y={14 + (k % 2) * 4} width="7" height={22 - (k % 2) * 4} fill={["#ff5a5f", "#4aa8ff", "#ffc23c", "#3ccf91", "#8b5cf6"][k]} stroke={ink} strokeWidth="1.5" />
      ))}
      {[12, 22, 44].map((x, k) => (
        <rect key={x} x={x} y={56} width="8" height="20" fill={["#ffc23c", "#ff8fc7", "#4aa8ff"][k]} stroke={ink} strokeWidth="1.5" />
      ))}
    </svg>,
    <svg key="t" viewBox="0 0 100 70" preserveAspectRatio="none">
      <rect x="4" y="20" width="92" height="46" rx="6" fill="#ffc23c" {...common} />
      <path d="M4 34h92" {...common} />
      <rect x="40" y="28" width="20" height="12" rx="3" fill="#ff5a5f" {...common} />
      <rect x="2" y="10" width="96" height="14" rx="6" fill="#ffa23c" {...common} />
    </svg>,
    <svg key="p" viewBox="0 0 70 80" preserveAspectRatio="none">
      <rect x="4" y="4" width="62" height="72" rx="4" fill="#ffe7a1" {...common} />
      <rect x="12" y="12" width="46" height="56" fill="#bfe6ff" {...common} />
      <circle cx="35" cy="34" r="10" fill="#fff" stroke={ink} strokeWidth="2" />
      <path d="M22 62q13-16 26 0z" fill="#3ccf91" stroke={ink} strokeWidth="2" />
    </svg>,
    <svg key="a" viewBox="0 0 100 110" preserveAspectRatio="none">
      <rect x="10" y="6" width="80" height="60" rx="18" fill="#3ccf91" {...common} />
      <rect x="2" y="44" width="20" height="50" rx="8" fill="#2fae7a" {...common} />
      <rect x="78" y="44" width="20" height="50" rx="8" fill="#2fae7a" {...common} />
      <rect x="18" y="60" width="64" height="30" rx="6" fill="#56dda2" {...common} />
      <path d="M22 92v12M78 92v12" stroke={ink} strokeWidth="4" />
    </svg>,
  ];
  return <div className="spot-art">{art[i]}</div>;
}

function GhostArt({ s }: { s: Spook }) {
  if (s.kind === "decoy") {
    // a sheet on a hanger. no face, no feelings
    return (
      <svg viewBox="0 0 60 70" aria-hidden="true">
        <path d="M30 4v6" stroke={ink} strokeWidth="3" />
        <path d="M30 4q6 0 6 5" stroke={ink} strokeWidth="2.5" fill="none" />
        <path d="M8 66V30q0-18 22-20 22 2 22 20v36l-7-5-7 5-8-5-8 5-7-5z" fill="#f2f0ea" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M18 30q4 16 0 32M42 28q-4 18 0 34" stroke={ink} strokeWidth="1.5" fill="none" opacity="0.3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 70" aria-hidden="true">
      {s.kind === "rare" && <path d="M18 10l4-8 8 6 8-6 4 8z" fill="#ffc23c" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />}
      <path d="M8 66V32q0-20 22-22 22 2 22 22v34l-7-5-7 5-8-5-8 5-7-5z" fill={s.kind === "rare" ? "#fff6c9" : "#ffffff"} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="22" cy="34" rx="3.6" ry="4.6" fill={ink} />
      <ellipse cx="38" cy="34" rx="3.6" ry="4.6" fill={ink} />
      <circle cx="23" cy="32.5" r="1.3" fill="#fff" />
      <circle cx="39" cy="32.5" r="1.3" fill="#fff" />
      <path d="M26 44q4 4 8 0" stroke={ink} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="42" r="3" fill="#ff8fc7" />
      <circle cx="44" cy="42" r="3" fill="#ff8fc7" />
    </svg>
  );
}

export default function GhostHunt({ api }: GameProps) {
  const h = useRef<Haunt>(newHaunt());
  const [fx, setFx] = useState<{ spot: number; text: string; good: boolean; id: number } | null>(null);
  const fid = useRef(0);

  const bump = useFrameRender(
    api,
    (f) => {
      const ev = stepHaunt(h.current, f.dt, f.progress, f.urgent);
      if (ev.some((e) => e.type === "appear" && e.kind === "rare")) api.sfx("pop");
    },
    15,
  );

  const tap = useCallback(
    (spot: number) => {
      if (!api.isActive()) return;
      const r = tapSpot(h.current, spot);
      api.addScore(r.delta);
      const good = r.kind === "ghost" || r.kind === "rare";
      api.sfx(good ? (r.kind === "rare" ? "bigPoint" : "point") : "wrong");
      const text = good ? `+${r.delta}` : r.kind === "decoy" ? "just laundry -5" : "nobody here -5";
      setFx({ spot, text, good, id: ++fid.current });
      bump();
    },
    [api, bump],
  );

  useEffect(() => {
    if (!fx) return;
    const t = window.setTimeout(() => setFx((c) => (c?.id === fx.id ? null : c)), 700);
    return () => clearTimeout(t);
  }, [fx]);

  const portrait = usePortrait();
  const layout = portrait ? PORTRAIT : LAYOUT;
  const haunt = h.current;
  return (
    <div className="game-fill ghost-room-wrap">
      <div className={`ghost-room ${portrait ? "is-portrait" : ""}`} data-testid="ghost-room">
        <div className="ghost-window" aria-hidden="true">
          <span className="moonlet" />
        </div>
        <div className="ghost-rug" aria-hidden="true" />
        {SPOTS.map((name, i) => {
          const L = layout[i];
          const s = haunt.spooks.find((x) => x.spot === i);
          const appear = s ? Math.min(1, s.t / 0.15, (s.life - s.t) / 0.15) : 0;
          return (
            <button
              key={name}
              type="button"
              className={`spot spot-${i} ${s ? "has-spook" : ""}`}
              style={{ left: `${L.x}%`, top: `${L.y}%`, width: `${L.w}%`, height: `${L.h}%`, animationDelay: `${-i * 0.7}s` }}
              aria-label={`${name}${s ? (s.kind === "decoy" ? ", something white is hanging here" : ", something with eyes is peeking out") : ""}`}
              data-testid={`spot-${i}`}
              data-spook={s?.kind ?? ""}
              onPointerDown={(e) => {
                e.preventDefault();
                tap(i);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  tap(i);
                }
              }}
            >
              {s && (
                <span
                  key={`${s.id}-${s.spot}`}
                  className={`spook peek-${L.peek} ${s.kind}`}
                  style={{ opacity: s.alpha * Math.max(0, appear), ["--appear" as string]: Math.max(0, appear) }}
                >
                  <GhostArt s={s} />
                </span>
              )}
              <Furniture i={i} />
              {fx?.spot === i && (
                <span key={fx.id} className={`plot-float ${fx.good ? "" : "is-bad"}`} aria-hidden="true">
                  {fx.text}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="ghost-stats">
        {haunt.found} ghosts found{haunt.streak >= 3 ? `, streak ${haunt.streak}` : ""}
      </p>
    </div>
  );
}
