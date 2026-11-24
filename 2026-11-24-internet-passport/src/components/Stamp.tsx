// src/components/Stamp.tsx
// draws one passport stamp as svg from its design: an outline shape, a border
// style, a glyph, a label and some rarity ornaments, all in one ink with a
// rough ink filter. the same component renders in the passport, in cards and
// (as static markup) in exported images.

import type { Rarity, StampDesign, StampShape } from "../types";
import { Glyph } from "./glyphs";

const C = 60;

function polygon(n: number, r: number, offset: number) {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((offset + (360 / n) * i) * Math.PI) / 180;
    pts.push(`${(C + r * Math.cos(a)).toFixed(1)} ${(C + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

function scallopedRect(x0: number, y0: number, x1: number, y1: number, r: number) {
  // perforated postage edge. bites go inward, traced clockwise
  const parts = [`M${x0} ${y0}`];
  const edge = (ax: number, ay: number, bx: number, by: number) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(3, Math.round(len / (r * 3.2)));
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const seg = len / n;
    for (let i = 0; i < n; i++) {
      const s = i * seg + seg / 2 - r;
      const e = i * seg + seg / 2 + r;
      parts.push(`L${(ax + ux * s).toFixed(1)} ${(ay + uy * s).toFixed(1)}`);
      parts.push(`A${r} ${r} 0 0 0 ${(ax + ux * e).toFixed(1)} ${(ay + uy * e).toFixed(1)}`);
    }
    parts.push(`L${bx} ${by}`);
  };
  edge(x0, y0, x1, y0);
  edge(x1, y0, x1, y1);
  edge(x1, y1, x0, y1);
  edge(x0, y1, x0, y0);
  return parts.join(" ") + " Z";
}

function starBurst(points: number, outer: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    pts.push(`${(C + r * Math.cos(a)).toFixed(1)} ${(C + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

function cloud(bumps: number, r: number) {
  const pts = Array.from({ length: bumps }, (_, i) => {
    const a = (Math.PI * 2 * i) / bumps;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  });
  const br = ((2 * Math.PI * r) / bumps) * 0.62;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i <= bumps; i++) {
    const p = pts[i % bumps];
    d += ` A${br.toFixed(1)} ${br.toFixed(1)} 0 0 1 ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  }
  return d + " Z";
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function blob(seed: string) {
  let h = hash(seed);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return h / 4294967296;
  };
  const n = 9;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n;
    const r = 44 + rand() * 12;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  });
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  let d = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return d + " Z";
}

function outline(shape: StampShape, seed: string): string {
  switch (shape) {
    case "circle":
      return "M6 60 A54 54 0 1 1 114 60 A54 54 0 1 1 6 60 Z";
    case "oval":
      return "M3 60 A57 42 0 1 1 117 60 A57 42 0 1 1 3 60 Z";
    case "rect":
      return "M8 20 H112 V100 H8 Z";
    case "triangle":
      return "M60 5 L116 106 H4 Z";
    case "hexagon":
      return polygon(6, 56, 0);
    case "octagon":
      return polygon(8, 56, 22.5);
    case "postage":
      return scallopedRect(12, 10, 108, 110, 3.4);
    case "shield":
      return "M60 6 L106 18 V58 C106 86 86 104 60 115 C34 104 14 86 14 58 V18 Z";
    case "ticket":
      return "M6 24 H114 V48 A12 12 0 0 0 114 72 V96 H6 V72 A12 12 0 0 0 6 48 Z";
    case "star":
      return starBurst(16, 57, 49);
    case "diamond":
      return "M60 2 L118 60 L60 118 L2 60 Z";
    case "cloud":
      return cloud(11, 45);
    case "arch":
      return "M12 114 V56 A48 48 0 0 1 108 56 V114 Z";
    case "blob":
      return blob(seed);
  }
}

type Layout = { curved: boolean; glyphY: number; glyphScale: number; labelY: number; dateY: number; arc?: string };

function layout(shape: StampShape): Layout {
  switch (shape) {
    case "circle":
    case "octagon":
    case "star":
    case "cloud":
    case "blob":
    case "hexagon":
      return { curved: true, glyphY: 58, glyphScale: 0.5, labelY: 0, dateY: 92, arc: "M20 62 A40 40 0 0 1 100 62" };
    case "oval":
      return { curved: true, glyphY: 60, glyphScale: 0.42, labelY: 0, dateY: 90, arc: "M14 62 A46 33 0 0 1 106 62" };
    case "triangle":
      return { curved: false, glyphY: 68, glyphScale: 0.4, labelY: 98, dateY: 40 };
    case "diamond":
      return { curved: false, glyphY: 55, glyphScale: 0.44, labelY: 82, dateY: 30 };
    case "arch":
      return { curved: false, glyphY: 66, glyphScale: 0.48, labelY: 104, dateY: 34 };
    case "shield":
      return { curved: false, glyphY: 54, glyphScale: 0.48, labelY: 84, dateY: 28 };
    case "ticket":
      return { curved: false, glyphY: 60, glyphScale: 0.42, labelY: 88, dateY: 37 };
    case "rect":
      return { curved: false, glyphY: 57, glyphScale: 0.48, labelY: 92, dateY: 32 };
    case "postage":
      return { curved: false, glyphY: 58, glyphScale: 0.52, labelY: 97, dateY: 24 };
  }
}

const BORDER: Record<StampDesign["border"], { outer: number; dash?: string; inner: number; innerDash?: string }> = {
  double: { outer: 3, inner: 1.6 },
  dashed: { outer: 3, dash: "7 4", inner: 1.2 },
  dotted: { outer: 3.6, dash: "0.1 6", inner: 1.4 },
  solid: { outer: 4.2, inner: 0 },
  rays: { outer: 2.4, inner: 6, innerDash: "1.2 3.2" },
  thick: { outer: 6.5, inner: 1.2 },
};

function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path d={`M${x} ${y - 5 * s} L${x + 1.4 * s} ${y - 1.4 * s} L${x + 5 * s} ${y} L${x + 1.4 * s} ${y + 1.4 * s} L${x} ${y + 5 * s} L${x - 1.4 * s} ${y + 1.4 * s} L${x - 5 * s} ${y} L${x - 1.4 * s} ${y - 1.4 * s} Z`} fill="currentColor" stroke="none" />;
}

export interface StampArtProps {
  design: StampDesign;
  rarity: Rarity;
  date?: string; // already formatted
  size?: number | string;
  faded?: boolean; // not collected yet
  mystery?: boolean; // hide glyph and label
  id: string; // stable id for text paths
  title?: string;
  className?: string;
  /** set for exported images: include the ink filter inline */
  standalone?: boolean;
}

/** shared ink filter, rendered once near the app root */
export function InkFilters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <InkFilterDefs />
    </svg>
  );
}

function InkFilterDefs() {
  return (
    <defs>
      <filter id="ink-rough" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="3" seed="3" result="blot" />
        <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.62" result="mask" />
        <feComposite in="rough" in2="mask" operator="in" />
      </filter>
    </defs>
  );
}

export function StampArt({ design, rarity, date, size = 120, faded, mystery, id, title, className, standalone }: StampArtProps) {
  const L = layout(design.shape);
  const b = BORDER[design.border];
  const path = outline(design.shape, id);
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const arcId = `arc-${safe}`;
  const label = mystery ? "? ? ?" : design.label.toUpperCase();
  const fontSize = Math.max(6.4, Math.min(11, (L.curved ? 150 : 104) / Math.max(label.length, 6)));
  const ink = faded ? "#9c9188" : design.ink;
  const inner = "translate(60 60) scale(0.84) translate(-60 -60)";

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ color: ink, overflow: "visible" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {standalone && <InkFilterDefs />}
      <g transform={`rotate(${design.tilt} 60 60)`} opacity={faded ? 0.7 : 0.92} filter={faded ? undefined : "url(#ink-rough)"}>
        <path d={path} fill="none" stroke="currentColor" strokeWidth={b.outer} strokeDasharray={b.dash} strokeLinecap="round" strokeLinejoin="round" />
        {b.inner > 0 && (
          <path
            d={path}
            transform={inner}
            fill="none"
            stroke="currentColor"
            strokeWidth={b.inner}
            strokeDasharray={b.innerDash}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        )}

        {mystery ? (
          <text x="60" y={L.glyphY + 12} textAnchor="middle" fontSize="34" fill="currentColor" fontFamily="Fraunces Variable, Georgia, serif">
            ?
          </text>
        ) : (
          <g
            transform={`translate(60 ${L.glyphY}) scale(${L.glyphScale}) translate(-50 -50)`}
            fill="none"
            stroke="currentColor"
            strokeWidth={4.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Glyph name={design.glyph} />
          </g>
        )}

        <g fill="currentColor" fontFamily="Courier Prime, Courier New, monospace" fontWeight="700" letterSpacing="0.6">
          {L.curved && L.arc ? (
            <>
              <path id={arcId} d={L.arc} fill="none" stroke="none" />
              <text fontSize={fontSize} textAnchor="middle">
                <textPath href={`#${arcId}`} startOffset="50%">
                  {label}
                </textPath>
              </text>
            </>
          ) : (
            <text x="60" y={L.labelY} textAnchor="middle" fontSize={fontSize}>
              {label}
            </text>
          )}
          {date && (
            <text x="60" y={L.curved ? L.dateY : L.dateY} textAnchor="middle" fontSize="7.5" letterSpacing="1">
              {date}
            </text>
          )}
        </g>

        {!faded && rarity === "rare" && (
          <>
            <Sparkle x={L.curved ? 24 : 22} y={L.glyphY} />
            <Sparkle x={L.curved ? 96 : 98} y={L.glyphY} />
          </>
        )}
        {!faded && rarity === "legendary" && (
          <>
            <Sparkle x={46} y={L.curved ? 104 : L.dateY - 10} s={0.8} />
            <Sparkle x={60} y={L.curved ? 106 : L.dateY - 12} s={1.1} />
            <Sparkle x={74} y={L.curved ? 104 : L.dateY - 10} s={0.8} />
          </>
        )}
        {!faded && rarity === "secret" && (
          <g transform={`translate(${L.curved ? 98 : 100} ${L.curved ? 30 : 24}) scale(0.16) translate(-50 -50)`} fill="none" stroke="currentColor" strokeWidth={9}>
            <Glyph name="keyhole" />
          </g>
        )}
      </g>
    </svg>
  );
}
