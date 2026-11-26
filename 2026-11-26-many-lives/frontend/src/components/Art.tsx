// frontend/src/components/Art.tsx: the hand drawn illustration system (inline svg, no images, no emoji).
// museum objects, the rooms of each alternate self, and the five places of the universe map.
import { hashNum } from "../hooks";

const INK = "#40364D";
const PAPER = "#FFFDF8";

export function ArtifactObject({ kind, seed, size = 120, color }: { kind: string; seed: string; size?: number; color?: string }) {
  const pal = ["#FFD1D3", "#FFE9AE", "#D8C9EE", "#C8DDF2", "#F6C6B8", "#CFE8D6"];
  const c = color || pal[hashNum(seed) % pal.length];
  const c2 = pal[(hashNum(seed) + 2) % pal.length];
  const tilt = (hashNum(seed + "t") % 9) - 4;
  const s = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  let body: React.ReactNode;
  switch (kind) {
    case "floppy":
    case "project":
      body = (<g {...s}><rect x="20" y="18" width="80" height="84" rx="6" fill={c} /><rect x="36" y="18" width="46" height="26" fill={PAPER} /><rect x="66" y="22" width="9" height="18" fill={INK} /><rect x="32" y="60" width="56" height="36" rx="3" fill={PAPER} /><path d="M40 72h40M40 82h28" /></g>);
      break;
    case "seed":
    case "first":
      body = (<g {...s}><path d="M60 100c0-24 0-40 0-52" fill="none" /><path d="M60 62c-18-2-28-14-28-30 16 0 28 10 28 30z" fill={c} /><path d="M60 52c14-4 24-16 22-32-14 2-24 14-22 32z" fill={c2} /><ellipse cx="60" cy="102" rx="30" ry="6" fill={c2} /></g>);
      break;
    case "ribbon":
    case "milestone":
      body = (<g {...s}><path d="M44 70l-12 36 14-6 8 12 8-30M76 70l12 36-14-6-8 12-8-30" fill={c2} /><circle cx="60" cy="52" r="30" fill={c} /><circle cx="60" cy="52" r="19" fill={PAPER} /><path d="M52 52l6 6 10-12" fill="none" /></g>);
      break;
    case "cassette":
    case "lyric":
      body = (<g {...s}><rect x="14" y="30" width="92" height="60" rx="6" fill={c} /><rect x="26" y="40" width="68" height="26" rx="4" fill={PAPER} /><circle cx="44" cy="53" r="7" fill={c2} /><circle cx="76" cy="53" r="7" fill={c2} /><path d="M34 90l8-14h36l8 14" fill={c2} /></g>);
      break;
    case "diary":
    case "journal":
      body = (<g {...s}><rect x="28" y="16" width="64" height="88" rx="5" fill={c} /><path d="M38 16v88" /><rect x="48" y="34" width="34" height="16" rx="2" fill={PAPER} /><path d="M92 58h8v16h-8" fill={c2} /></g>);
      break;
    case "scroll":
    case "research":
    case "paper":
      body = (<g {...s}><path d="M30 22h56v76H30z" fill={PAPER} /><path d="M24 22a8 8 0 0 1 16 0v80a8 8 0 0 1-16 0z" fill={c} /><path d="M80 22a8 8 0 0 1 16 0v80a8 8 0 0 1-16 0z" fill={c} /><path d="M46 40h26M46 52h26M46 64h18M46 76h24" /></g>);
      break;
    case "letter":
    case "conversation":
      body = (<g {...s} transform="rotate(-6 60 60)"><rect x="16" y="30" width="88" height="60" rx="4" fill={PAPER} /><path d="M16 34l44 32 44-32" fill={c} /><circle cx="60" cy="66" r="8" fill={c2} /></g>);
      break;
    case "vinyl":
    case "music":
      body = (<g {...s}><rect x="14" y="14" width="64" height="92" rx="3" fill={c2} /><circle cx="70" cy="60" r="40" fill={INK} /><circle cx="70" cy="60" r="28" fill="none" stroke="#6b5f7c" /><circle cx="70" cy="60" r="12" fill={c} /><circle cx="70" cy="60" r="2.5" fill={INK} /></g>);
      break;
    case "photo":
      body = (<g {...s} transform={`rotate(${tilt * 1.5} 60 60)`}><rect x="22" y="18" width="76" height="86" rx="2" fill={PAPER} /><rect x="30" y="26" width="60" height="56" fill={c} /><path d="M30 72l18-18 14 12 10-8 18 16v8H30z" fill={c2} /><circle cx="76" cy="40" r="6" fill={PAPER} /></g>);
      break;
    case "ticket":
    case "wishlist":
    case "event":
      body = (<g {...s} transform="rotate(8 60 60)"><path d="M16 38h88v14a8 8 0 0 0 0 16v14H16V68a8 8 0 0 0 0-16z" fill={c} /><path d="M78 38v44" strokeDasharray="4 5" /><path d="M28 54h36M28 66h26" /></g>);
      break;
    case "jar":
    case "recipe":
      body = (<g {...s}><rect x="38" y="16" width="44" height="14" rx="3" fill={c2} /><path d="M34 34h52c6 0 8 6 8 12v48c0 6-4 10-10 10H36c-6 0-10-4-10-10V46c0-6 2-12 8-12z" fill={PAPER} /><path d="M30 64h60v30c0 6-4 10-10 10H40c-6 0-10-4-10-10z" fill={c} /><rect x="46" y="44" width="28" height="14" rx="2" fill={PAPER} /></g>);
      break;
    case "lightbulb":
    case "idea":
      body = (<g {...s}><path d="M60 16a30 30 0 0 1 18 54c-4 4-6 8-6 14H48c0-6-2-10-6-14a30 30 0 0 1 18-54z" fill={c} /><rect x="46" y="86" width="28" height="16" rx="3" fill={c2} /><path d="M52 60l8-10 8 10" fill="none" /></g>);
      break;
    default:
      body = (<g {...s} transform={`rotate(${tilt} 60 60)`}><rect x="24" y="20" width="72" height="80" fill={c} /><path d="M24 20l12-8h72l-12 8M96 20l12-8v80l-12 8" fill={c2} /><path d="M40 44h40M40 58h40M40 72h24" /></g>);
  }
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" className="artifact-object">
      {body}
    </svg>
  );
}

export function Door({ palette, motif, seed, faded }: { palette: string[]; motif: string; seed: string; faded?: boolean }) {
  const [a, ink, b] = palette;
  return (
    <svg viewBox="0 0 120 180" className={`door ${faded ? "faded" : ""}`} aria-hidden="true">
      <path d="M14 176V60a46 46 0 0 1 92 0v116z" fill={a} stroke={INK} strokeWidth="2.5" />
      <path d="M28 176V64a32 32 0 0 1 64 0v112z" fill={b} stroke={INK} strokeWidth="2" />
      <g transform="translate(60 78)">{Motif({ motif, ink, color: a })}</g>
      <circle cx="80" cy="128" r="4" fill={ink} />
      <rect x="6" y="172" width="108" height="8" rx="2" fill={INK} opacity=".85" />
    </svg>
  );
}

export function Motif({ motif, ink = INK, color = "#FFD1D3" }: { motif: string; ink?: string; color?: string }) {
  const s = { stroke: ink, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (motif) {
    case "study":
      return <g {...s}><path d="M-18 14h36M-14 14V0h28v14M-4 0l-6-14h20l-6 14" /><path d="M-10 -14l10-6 10 6" /></g>;
    case "booth":
      return <g {...s}><circle cx="0" cy="-4" r="9" /><path d="M0 5v10M-8 15h16M-14 -6a14 14 0 0 0 28 0" /></g>;
    case "arcade":
      return <g {...s}><rect x="-14" y="-16" width="28" height="32" rx="3" /><rect x="-9" y="-11" width="18" height="12" /><circle cx="-5" cy="9" r="2.5" /><path d="M5 6v6" /></g>;
    case "studio":
      return <g {...s}><path d="M-14 12c-6-20 14-30 26-20 8 6 0 12-6 10-6-2-6 8 0 10" /><circle cx="-6" cy="-4" r="2" /><circle cx="2" cy="-8" r="2" /></g>;
    case "workshop":
      return <g {...s}><circle cx="0" cy="0" r="7" /><path d="M0 -14v5M0 9v5M-14 0h5M9 0h5M-10 -10l4 4M6 6l4 4M-10 10l4-4M6 -6l4-4" /></g>;
    case "classroom":
      return <g {...s}><rect x="-16" y="-12" width="32" height="20" /><path d="M-10 -4h12M-10 2h20M-4 8l-4 8M4 8l4 8" /></g>;
    case "lab":
      return <g {...s}><rect x="-10" y="-10" width="20" height="16" rx="4" /><circle cx="-4" cy="-2" r="2" /><circle cx="4" cy="-2" r="2" /><path d="M0 -10v-6M-6 6v8M6 6v8" /></g>;
    case "craft":
      return <g {...s}><rect x="-14" y="-12" width="18" height="22" /><path d="M-14 -12l3 -3 3 3 3 -3 3 3 3 -3" /><circle cx="10" cy="4" r="7" /></g>;
    case "stall":
      return <g {...s}><path d="M-16 -6h32l-4-10h-24zM-14 -6v20M14 -6v20M-14 4h28" /></g>;
    case "rooftop":
      return <g {...s}><path d="M-16 16v-14h8v-8h8v22M4 16V0h12v16" /><path d="M8 -12a6 6 0 1 0 6 -6 5 5 0 0 1 -6 6z" fill={color} /></g>;
    case "attic":
      return <g {...s}><path d="M-18 14L0 -14l18 28z" /><path d="M-6 14v-10h12v10" /></g>;
    default:
      return <g {...s}><circle cx="0" cy="0" r="10" /><path d="M-4 -2h8M-4 3h5" /></g>;
  }
}

export function Room({ self }: { self: any }) {
  const [a, ink, b] = self.palette || ["#FFD1D3", INK, "#FFFDF8"];
  const h = hashNum(self.key);
  const objects = (self.project_names || []).slice(0, 6);
  return (
    <svg viewBox="0 0 640 300" className="room" role="img" aria-label={self.room}>
      <rect width="640" height="300" fill={b} />
      <rect y="210" width="640" height="90" fill={a} opacity=".7" />
      <path d="M0 210h640" stroke={INK} strokeWidth="2" />
      <rect x="440" y="40" width="130" height="110" rx="4" fill={PAPER} stroke={INK} strokeWidth="2.5" />
      <path d="M505 40v110M440 95h130" stroke={INK} strokeWidth="2" />
      {self.status === "historical" ? (
        <path d="M455 60h100M455 80h60" stroke="#b9aecb" strokeWidth="6" opacity=".5" />
      ) : (
        <circle cx={470 + (h % 60)} cy="70" r="12" fill="#FFE9AE" stroke={INK} strokeWidth="2" />
      )}
      <g transform="translate(70 120) scale(2.2)">{Motif({ motif: self.motif, ink: INK, color: a })}</g>
      <rect x="120" y="170" width="260" height="14" rx="3" fill={INK} />
      <path d="M140 184v60M360 184v60" stroke={INK} strokeWidth="4" />
      {objects.map((name: string, i: number) => {
        const x = 140 + i * 40;
        const hh = 20 + (hashNum(name) % 24);
        return (
          <g key={name}>
            <rect x={x} y={170 - hh} width="28" height={hh} rx="2" fill={i % 2 ? a : "#C8DDF2"} stroke={INK} strokeWidth="2" />
            <title>{name}</title>
          </g>
        );
      })}
      <rect x="430" y="214" width="160" height="40" rx="20" fill={b} stroke={INK} strokeWidth="2" opacity=".9" />
      <text x="510" y="239" textAnchor="middle" className="room-label">{self.given}'s room</text>
    </svg>
  );
}

export function PlaceArt({ place, lit }: { place: string; lit?: boolean }) {
  const s = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const glow = lit ? <circle cx="60" cy="60" r="58" fill="#FFE9AE" opacity=".1" /> : null;
  switch (place) {
    case "multiverse":
      return (<g>{glow}<ellipse cx="60" cy="96" rx="52" ry="14" fill="#D8C9EE" {...s} /><g {...s}><path d="M20 94V54a12 12 0 0 1 24 0v40" fill="#FFD1D3" /><path d="M48 94V40a12 12 0 0 1 24 0v54" fill="#FFE9AE" /><path d="M76 94V50a12 12 0 0 1 24 0v44" fill="#C8DDF2" /><circle cx="38" cy="76" r="1.8" fill={INK} /><circle cx="66" cy="70" r="1.8" fill={INK} /><circle cx="94" cy="74" r="1.8" fill={INK} /></g></g>);
    case "museum":
      return (<g>{glow}<g {...s}><path d="M14 46L60 18l46 28z" fill="#FFD1D3" /><rect x="18" y="46" width="84" height="8" fill="#FFFDF8" /><path d="M26 54v34M44 54v34M76 54v34M94 54v34" strokeWidth="5" stroke="#FFFDF8" /><path d="M26 54v34M44 54v34M76 54v34M94 54v34" strokeWidth="1.6" /><rect x="52" y="64" width="16" height="24" rx="8" fill="#FFE9AE" /><rect x="12" y="88" width="96" height="10" fill="#D8C9EE" /></g></g>);
    case "archive":
      return (<g>{glow}<g {...s}><rect x="24" y="22" width="72" height="76" fill="#FFE9AE" /><path d="M24 47h72M24 72h72" /><rect x="50" y="31" width="20" height="7" rx="2" fill="#FFFDF8" /><rect x="50" y="56" width="20" height="7" rx="2" fill="#FFFDF8" /><rect x="50" y="81" width="20" height="7" rx="2" fill="#FFFDF8" /><path d="M86 18l14-6 4 10-14 6z" fill="#FFD1D3" /></g></g>);
    case "library":
      return (<g>{glow}<g {...s}><rect x="22" y="30" width="14" height="66" fill="#D8C9EE" /><rect x="36" y="22" width="12" height="74" fill="#FFD1D3" /><rect x="48" y="36" width="16" height="60" fill="#C8DDF2" /><path d="M66 36l12-4 16 60-12 4z" fill="#FFE9AE" /><rect x="14" y="96" width="92" height="6" fill={INK} /></g></g>);
    case "observatory":
      return (<g>{glow}<g {...s}><path d="M24 70a36 36 0 0 1 72 0z" fill="#C8DDF2" /><path d="M58 34v36" /><path d="M54 52l34-26 4 6-34 26z" fill="#FFFDF8" /><rect x="20" y="70" width="80" height="26" fill="#FFFDF8" /><rect x="52" y="78" width="16" height="18" rx="8" fill="#D8C9EE" /><circle cx="96" cy="20" r="3" fill="#FFE9AE" /><circle cx="18" cy="30" r="2" fill="#FFE9AE" /></g></g>);
    case "unknown":
      return (<g {...s}><rect x="40" y="30" width="40" height="66" rx="2" fill="#2f2840" stroke="#8a7ea0" /><path d="M60 30v66" stroke="#8a7ea0" strokeDasharray="3 4" /><circle cx="70" cy="64" r="2" fill="#FFE9AE" stroke="none" /><path d="M44 96h32" stroke="#FFE9AE" opacity=".5" strokeWidth="4" /></g>);
    default:
      return null;
  }
}
