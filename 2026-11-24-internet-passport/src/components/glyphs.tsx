// src/components/glyphs.tsx
// hand drawn line glyphs used in the middle of stamps and territory emblems.
// each glyph is drawn in a 100x100 box, centered on 50,50, stroke only.
// stroke colour and width come from the parent <g>.

import type { ReactElement } from "react";

const G: Record<string, ReactElement> = {
  // creative republic
  palette: (
    <>
      <path d="M50 22c-17 0-30 12-30 27 0 14 11 25 25 25 5 0 6-4 4-7-2-4 0-7 5-7h6c10 0 20-7 20-17 0-12-13-21-30-21z" />
      <circle cx="37" cy="40" r="4" /><circle cx="50" cy="33" r="4" /><circle cx="63" cy="39" r="4" /><circle cx="34" cy="55" r="4" />
    </>
  ),
  brush: (
    <>
      <path d="M68 24 46 52" /><path d="M72 20l6 6-26 30-6-6z" />
      <path d="M44 54c-8-1-14 4-15 11-1 5-4 8-8 9 10 3 24 0 27-9 1-4 0-8-4-11z" />
    </>
  ),
  frame: (
    <>
      <rect x="24" y="26" width="52" height="48" /><rect x="31" y="33" width="38" height="34" />
      <path d="M31 62l11-12 9 9 6-6 12 14" /><circle cx="60" cy="42" r="3" />
    </>
  ),
  eye: (
    <>
      <path d="M20 50c8-12 18-18 30-18s22 6 30 18c-8 12-18 18-30 18s-22-6-30-18z" />
      <circle cx="50" cy="50" r="10" /><circle cx="50" cy="50" r="3" />
    </>
  ),
  camera: (
    <>
      <rect x="22" y="34" width="56" height="36" rx="4" /><path d="M38 34l4-8h16l4 8" />
      <circle cx="50" cy="52" r="11" /><circle cx="50" cy="52" r="5" /><path d="M68 41h4" />
    </>
  ),
  swatch: (
    <>
      <rect x="26" y="24" width="14" height="52" /><path d="M40 70 70 40l-9-9-21 21" /><path d="M40 76h36V62H55" />
      <circle cx="33" cy="68" r="2.5" />
    </>
  ),
  type: (
    <>
      <path d="M24 72 38 28h4l14 44" /><path d="M29 57h22" />
      <path d="M74 50c-3-4-15-4-15 5v9c0 8 12 8 15 3" /><path d="M74 47v25" />
    </>
  ),
  column: (
    <>
      <path d="M22 36 50 22l28 14z" /><path d="M24 36h52M26 74h48M22 79h56" />
      <path d="M31 40v32M42 40v32M58 40v32M69 40v32" />
    </>
  ),
  chart: (
    <>
      <path d="M24 76h54M26 24v52" /><rect x="32" y="52" width="9" height="22" /><rect x="46" y="38" width="9" height="36" />
      <rect x="60" y="46" width="9" height="28" /><path d="M32 42l12-12 12 8 16-14" />
    </>
  ),
  figure: (
    <>
      <circle cx="50" cy="28" r="7" /><path d="M50 35v20M50 41l-14 8M50 41l13-10M50 55l-10 18M50 55l11 17" />
      <path d="M28 70c4-3 8-3 12 0" />
    </>
  ),
  pencil: (
    <>
      <path d="M30 74l4-14 34-34 10 10-34 34z" /><path d="M34 60l10 10M62 32l10 10" /><path d="M30 74l4-1" />
    </>
  ),
  vase: (
    <>
      <path d="M40 24h20M42 24c0 8-10 12-10 26 0 14 8 24 18 24s18-10 18-24c0-14-10-18-10-26" />
      <path d="M33 48c10 4 24 4 34 0M36 60c8 3 20 3 28 0" />
    </>
  ),
  // science federation
  planet: (
    <>
      <circle cx="50" cy="50" r="15" /><ellipse cx="50" cy="50" rx="30" ry="9" transform="rotate(-20 50 50)" />
      <circle cx="74" cy="28" r="2" /><circle cx="26" cy="72" r="1.5" />
    </>
  ),
  telescope: (
    <>
      <path d="M26 46 66 28l5 11-40 18z" /><path d="M66 28l4-2 6 13-4 2" /><path d="M48 50 40 76M50 50l10 26M45 64h11" />
      <circle cx="28" cy="28" r="2" /><circle cx="40" cy="22" r="1.5" />
    </>
  ),
  star: <path d="M50 20l8 20 22 2-17 14 6 22-19-12-19 12 6-22-17-14 22-2z" />,
  moon: (
    <>
      <path d="M58 22a28 28 0 1 0 20 40 22 22 0 1 1-20-40z" /><circle cx="44" cy="54" r="3" /><circle cx="52" cy="66" r="2" />
    </>
  ),
  atom: (
    <>
      <ellipse cx="50" cy="50" rx="30" ry="11" /><ellipse cx="50" cy="50" rx="30" ry="11" transform="rotate(60 50 50)" />
      <ellipse cx="50" cy="50" rx="30" ry="11" transform="rotate(-60 50 50)" /><circle cx="50" cy="50" r="3" />
    </>
  ),
  flask: (
    <>
      <path d="M42 22h16M45 22v18L28 70c-2 4 0 7 4 7h36c4 0 6-3 4-7L55 40V22" /><path d="M35 58h30" />
      <circle cx="46" cy="66" r="2.5" /><circle cx="56" cy="62" r="1.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="50" cy="50" r="27" /><ellipse cx="50" cy="50" rx="12" ry="27" /><path d="M23 50h54M27 36h46M27 64h46" />
    </>
  ),
  lightning: <path d="M56 20 32 54h16l-6 26 26-36H52z" />,
  tree: (
    <>
      <path d="M50 80V54" /><path d="M50 22c-12 0-20 9-20 18 0 4 2 8 4 10-2 3-2 9 4 12 4 2 8 1 12-1 4 2 8 3 12 1 6-3 6-9 4-12 2-2 4-6 4-10 0-9-8-18-20-18z" />
      <path d="M50 62l-8-7M50 58l7-6" />
    </>
  ),
  fish: (
    <>
      <path d="M22 50c10-14 30-16 44-4l12-10v28L66 54c-14 12-34 10-44-4z" /><circle cx="34" cy="47" r="2.5" />
      <path d="M46 40c3 6 3 14 0 20" />
    </>
  ),
  dna: (
    <>
      <path d="M36 20c0 15 28 15 28 30S36 65 36 80" /><path d="M64 20c0 15-28 15-28 30s28 15 28 30" />
      <path d="M40 28h20M40 72h20M44 50h12" />
    </>
  ),
  comet: (
    <>
      <circle cx="64" cy="36" r="9" /><path d="M57 42 24 74M60 46 34 76M54 38 22 64" />
    </>
  ),
  satellite: (
    <>
      <rect x="42" y="42" width="16" height="16" transform="rotate(45 50 50)" /><path d="M40 40 26 26M60 60l14 14" />
      <rect x="16" y="22" width="14" height="8" transform="rotate(45 23 26)" /><rect x="70" y="70" width="14" height="8" transform="rotate(45 77 74)" />
      <path d="M56 44c4-4 10-4 14 0" />
    </>
  ),
  mountain: (
    <>
      <path d="M18 74 40 38l10 14 10-18 22 40z" /><path d="M35 46l5 4 5-4M55 42l5 4 4-3" /><circle cx="72" cy="28" r="5" />
    </>
  ),
  magnifier: (
    <>
      <circle cx="44" cy="44" r="17" /><path d="M56 56l18 18" /><path d="M36 38c2-4 6-6 10-6" />
    </>
  ),
  leaf: (
    <>
      <path d="M26 74c0-30 18-48 50-50-2 32-20 50-50 50z" /><path d="M26 74 62 38M40 60h12M48 52V40" />
    </>
  ),
  pin: (
    <>
      <path d="M50 78S28 56 28 40a22 22 0 0 1 44 0c0 16-22 38-22 38z" /><circle cx="50" cy="40" r="8" />
    </>
  ),
  // sound islands
  note: (
    <>
      <path d="M40 70V28l32-8v42" /><ellipse cx="33" cy="70" rx="8" ry="6" /><ellipse cx="65" cy="62" rx="8" ry="6" /><path d="M40 38l32-8" />
    </>
  ),
  radio: (
    <>
      <rect x="20" y="36" width="60" height="40" rx="4" /><path d="M30 36 62 22" /><circle cx="62" cy="56" r="10" />
      <path d="M28 48h18M28 56h18M28 64h18" />
    </>
  ),
  record: (
    <>
      <circle cx="50" cy="50" r="28" /><circle cx="50" cy="50" r="9" /><circle cx="50" cy="50" r="2" />
      <path d="M50 30a20 20 0 0 1 18 12M32 58a20 20 0 0 0 10 10" />
    </>
  ),
  headphones: (
    <>
      <path d="M26 62V50a24 24 0 0 1 48 0v12" /><rect x="20" y="58" width="12" height="18" rx="3" /><rect x="68" y="58" width="12" height="18" rx="3" />
    </>
  ),
  speaker: (
    <>
      <path d="M24 42h12l16-14v44L36 58H24z" /><path d="M62 40c4 6 4 14 0 20M70 32c8 10 8 26 0 36" />
    </>
  ),
  drum: (
    <>
      <ellipse cx="50" cy="40" rx="26" ry="9" /><path d="M24 40v24c0 5 12 9 26 9s26-4 26-9V40" /><path d="M30 48l8 22M50 50v22M70 48l-8 22" />
      <path d="M64 18 52 36M78 22 60 36" />
    </>
  ),
  keys: (
    <>
      <rect x="18" y="32" width="64" height="38" /><path d="M31 32v38M44 32v38M57 32v38M70 32v38" />
      <path d="M27 32v22h8V32M40 32v22h8V32M63 32v22h8V32" />
    </>
  ),
  bird: (
    <>
      <path d="M22 58c8 2 16 0 22-6 6-10 14-16 24-14l10 4-8 3c2 14-10 26-26 26-10 0-18-5-22-13z" /><circle cx="64" cy="43" r="1.8" />
      <path d="M44 52c4 6 12 8 18 6" /><path d="M30 70 22 78" />
    </>
  ),
  shell: (
    <>
      <path d="M50 76 24 46c0-14 12-24 26-24s26 10 26 24z" /><path d="M50 76 34 30M50 76V24M50 76l16-46M50 76 26 44M50 76l24-32" />
    </>
  ),
  cassette: (
    <>
      <rect x="18" y="30" width="64" height="42" rx="4" /><circle cx="38" cy="48" r="6" /><circle cx="62" cy="48" r="6" />
      <path d="M44 48h12M30 72l5-10h30l5 10" />
    </>
  ),
  wavesound: <path d="M18 50h8l4-12 6 26 6-34 6 40 6-30 6 20 4-10h18" />,
  bubble: (
    <>
      <path d="M24 30h52v32H48L34 74V62H24z" /><path d="M36 46h4M48 46h4M60 46h4" />
    </>
  ),
  tuning: (
    <>
      <path d="M40 22v28c0 6 4 10 10 10s10-4 10-10V22" /><path d="M50 60v20" /><path d="M24 30c-4 6-4 14 0 20M76 30c4 6 4 14 0 20" />
    </>
  ),
  // digital frontier
  gear: (
    <>
      <circle cx="50" cy="50" r="12" />
      <path d="M46 20h8l2 9 7 3 8-5 6 6-5 8 3 7 9 2v8l-9 2-3 7 5 8-6 6-8-5-7 3-2 9h-8l-2-9-7-3-8 5-6-6 5-8-3-7-9-2v-8l9-2 3-7-5-8 6-6 8 5 7-3z" />
    </>
  ),
  chip: (
    <>
      <rect x="32" y="32" width="36" height="36" /><rect x="42" y="42" width="16" height="16" />
      <path d="M40 22v10M50 22v10M60 22v10M40 68v10M50 68v10M60 68v10M22 40h10M22 50h10M22 60h10M68 40h10M68 50h10M68 60h10" />
    </>
  ),
  cursor: <path d="M32 20v52l14-12 10 20 8-4-10-20h18z" />,
  terminal: (
    <>
      <rect x="18" y="26" width="64" height="48" rx="4" /><path d="M18 36h64M30 48l10 8-10 8M46 64h16" />
    </>
  ),
  cube: (
    <>
      <path d="M50 20 76 34v32L50 80 24 66V34z" /><path d="M24 34l26 14 26-14M50 48v32" />
    </>
  ),
  nodes: (
    <>
      <circle cx="30" cy="30" r="6" /><circle cx="70" cy="34" r="6" /><circle cx="50" cy="56" r="6" /><circle cx="28" cy="74" r="5" /><circle cx="74" cy="72" r="5" />
      <path d="M35 33l29 1M33 35l13 16M66 39 54 51M46 61 32 70M55 60l15 9" />
    </>
  ),
  handshake: (
    <>
      <path d="M18 44l14-10 14 6 8-4 14 2 14 10" /><path d="M30 50l14 14c3 3 7 3 9 0l17-16" /><path d="M42 58l6-6M48 64l6-6M56 52l-8-8" />
    </>
  ),
  polygons: (
    <>
      <path d="M22 70 38 40l16 30z" /><rect x="56" y="34" width="22" height="22" /><circle cx="64" cy="70" r="6" /><path d="M26 32h14" />
    </>
  ),
  pi: (
    <>
      <path d="M24 32c6-4 10-4 18-2h34" /><path d="M40 30c0 18-4 32-12 42" /><path d="M62 30v34c0 8 4 10 12 6" />
    </>
  ),
  branch: (
    <>
      <circle cx="34" cy="26" r="6" /><circle cx="34" cy="74" r="6" /><circle cx="68" cy="40" r="6" />
      <path d="M34 32v36M68 46c0 14-34 8-34 22" />
    </>
  ),
  anchor: (
    <>
      <circle cx="50" cy="24" r="5" /><path d="M50 29v48M38 38h24" /><path d="M24 56c0 12 12 21 26 21s26-9 26-21" /><path d="M20 60l4-4 4 4M72 60l4-4 4 4" />
    </>
  ),
  circuit: (
    <>
      <path d="M20 50h14l6-12h20l6 12h14" /><circle cx="20" cy="50" r="3" /><circle cx="80" cy="50" r="3" />
      <path d="M50 38V24M50 62v14M40 62h20" /><circle cx="50" cy="22" r="3" />
    </>
  ),
  lens: (
    <>
      <path d="M26 30h48M26 70h48" /><path d="M50 30c10 8 10 32 0 40-10-8-10-32 0-40z" /><path d="M20 50h14M66 50h14" />
    </>
  ),
  // oddlands
  spiral: <path d="M50 50c0-3 4-4 6-2 4 4 1 10-4 11-8 2-14-6-12-13 3-10 15-13 23-7 10 8 9 23-1 31-12 9-30 5-37-8-8-16 0-35 17-40" />,
  cat: (
    <>
      <path d="M28 40 26 20l14 10h20l14-10-2 20c4 6 6 12 6 18 0 14-12 22-28 22S22 72 22 58c0-6 2-12 6-18z" />
      <circle cx="40" cy="50" r="2.5" /><circle cx="60" cy="50" r="2.5" /><path d="M46 60l4 3 4-3M30 62H18M70 62h12" />
    </>
  ),
  hand: (
    <>
      <path d="M40 76V40a5 5 0 0 1 10 0v-14a5 5 0 0 1 10 0v24" /><path d="M60 46a5 5 0 0 1 10 0v6a5 5 0 0 1 10 0v8c0 10-8 18-18 18H48c-6 0-10-3-12-8l-8-14a5 5 0 0 1 9-5l3 5" />
    </>
  ),
  sandwich: (
    <>
      <path d="M20 44 50 26l30 18z" /><path d="M20 44c10 4 20 4 30 0s20-4 30 0" /><path d="M22 52h56M20 60h60" /><path d="M20 60l30 14 30-14" />
    </>
  ),
  horse: (
    <>
      <path d="M32 76V52c0-10 6-18 16-22l6-10 4 8c8 2 14 8 14 16l-8 4-8-6v10l4 24" /><path d="M52 34l-6-4" /><circle cx="58" cy="34" r="1.6" />
    </>
  ),
  cow: (
    <>
      <path d="M30 34c-8 0-12-6-10-10 6 0 10 2 12 6M70 34c8 0 12-6 10-10-6 0-10 2-12 6" />
      <path d="M32 30h36c4 10 4 24-2 32H34c-6-8-6-22-2-32z" /><ellipse cx="50" cy="70" rx="16" ry="9" />
      <circle cx="44" cy="70" r="2" /><circle cx="56" cy="70" r="2" /><circle cx="42" cy="44" r="2.5" /><circle cx="58" cy="44" r="2.5" />
    </>
  ),
  dog: (
    <>
      <path d="M30 30c-8 4-10 18-4 22l8-6M70 30c8 4 10 18 4 22l-8-6" /><path d="M34 30h32c4 8 4 30-4 40H38c-8-10-8-32-4-40z" />
      <circle cx="43" cy="46" r="2.5" /><circle cx="57" cy="46" r="2.5" /><path d="M46 58h8l-4 5z" />
    </>
  ),
  eel: (
    <>
      <path d="M18 60c10-16 18-16 26 0s16 16 24 0c4-8 8-10 14-8" /><circle cx="78" cy="50" r="1.8" /><path d="M82 54l-6 4" />
    </>
  ),
  koala: (
    <>
      <circle cx="30" cy="34" r="12" /><circle cx="70" cy="34" r="12" /><circle cx="50" cy="54" r="22" />
      <ellipse cx="50" cy="58" rx="6" ry="8" /><circle cx="41" cy="48" r="2" /><circle cx="59" cy="48" r="2" />
    </>
  ),
  gift: (
    <>
      <rect x="24" y="44" width="52" height="34" /><rect x="20" y="34" width="60" height="10" /><path d="M50 34v44" />
      <path d="M50 34c-4-10-18-14-18-4 0 4 8 4 18 4zM50 34c4-10 18-14 18-4 0 4-8 4-18 4z" />
    </>
  ),
  duck: (
    <>
      <path d="M26 58c0 12 10 18 26 18s24-8 24-20c0-6-4-10-10-12 2-12-6-20-16-20-8 0-14 6-14 14 0 4 2 8 4 10-6 0-14 4-14 10z" />
      <path d="M38 34l-10 2 9 5" /><circle cx="46" cy="32" r="1.8" />
    </>
  ),
  rug: (
    <>
      <rect x="22" y="30" width="56" height="40" /><rect x="30" y="38" width="40" height="24" /><path d="M18 30v40M82 30v40" />
      <path d="M44 44c4-4 8-4 12 0M42 54h16" />
    </>
  ),
  question: (
    <>
      <path d="M36 36c0-10 6-16 14-16s14 6 14 14c0 12-14 12-14 24v4" /><circle cx="50" cy="76" r="3" />
    </>
  ),
  keyboard: (
    <>
      <rect x="16" y="34" width="68" height="32" rx="3" />
      <path d="M24 42h4M34 42h4M44 42h4M54 42h4M64 42h4M74 42h2M26 50h4M36 50h4M46 50h4M56 50h4M66 50h4M32 58h36" />
    </>
  ),
  // archive kingdom
  scroll: (
    <>
      <path d="M30 24h40c4 0 6 3 6 6s-2 6-6 6H64v34c0 4-3 6-6 6H26c-4 0-6-3-6-6s2-6 6-6h6V30c0-3 2-6-2-6z" />
      <path d="M40 40h16M40 48h16M40 56h12" />
    </>
  ),
  book: (
    <>
      <path d="M50 30c-8-6-18-8-30-6v48c12-2 22 0 30 6 8-6 18-8 30-6V24c-12-2-22 0-30 6z" /><path d="M50 30v48" />
      <path d="M28 36c6 0 10 1 14 3M28 46c6 0 10 1 14 3M58 39c4-2 8-3 14-3M58 49c4-2 8-3 14-3" />
    </>
  ),
  map: (
    <>
      <path d="M20 28l18-6 24 8 18-6v50l-18 6-24-8-18 6z" /><path d="M38 22v50M62 30v50" /><path d="M28 46l6 4 8-6 8 6 6-4" />
    </>
  ),
  hourglass: (
    <>
      <path d="M30 22h40M30 78h40M34 22c0 16 14 20 14 28s-14 12-14 28M66 22c0 16-14 20-14 28s14 12 14 28" /><path d="M42 72c2-4 14-4 16 0" />
    </>
  ),
  lantern: (
    <>
      <path d="M42 22h16M50 16v6M38 30h24l-2 40H40z" /><path d="M36 70h28M38 30c0-4 4-8 12-8s12 4 12 8" /><path d="M50 40c-4 6-4 12 0 18 4-6 4-12 0-18z" />
    </>
  ),
  key: (
    <>
      <circle cx="32" cy="50" r="12" /><circle cx="32" cy="50" r="4" /><path d="M44 50h36M68 50v10M76 50v8" />
    </>
  ),
  crown: (
    <>
      <path d="M22 70 18 34l16 14 16-22 16 22 16-14-4 36z" /><path d="M24 62h52" /><circle cx="50" cy="44" r="3" />
    </>
  ),
  compass: (
    <>
      <circle cx="50" cy="50" r="28" /><path d="M50 26 56 50 50 74 44 50z" /><path d="M26 50h8M66 50h8" /><circle cx="50" cy="50" r="2" />
    </>
  ),
  quill: (
    <>
      <path d="M74 22C50 26 34 42 28 72c10-10 20-14 30-16-4-2-8-2-12-2 10-4 18-12 28-32z" /><path d="M28 72 22 80" />
    </>
  ),
  joystick: (
    <>
      <rect x="22" y="58" width="56" height="18" rx="4" /><path d="M50 58V36" /><circle cx="50" cy="30" r="8" /><circle cx="68" cy="66" r="3" />
    </>
  ),
  building: (
    <>
      <path d="M26 78V34l24-12 24 12v44" /><path d="M20 78h60" /><rect x="44" y="60" width="12" height="18" />
      <path d="M34 42h6M60 42h6M34 52h6M60 52h6" />
    </>
  ),
  timeline: (
    <>
      <path d="M18 60h64" /><path d="M26 60V38M40 60V28M54 60V44M68 60V34" /><circle cx="26" cy="36" r="3" /><circle cx="40" cy="26" r="3" />
      <circle cx="54" cy="42" r="3" /><circle cx="68" cy="32" r="3" /><path d="M18 72h64" />
    </>
  ),
  candle: (
    <>
      <rect x="40" y="40" width="20" height="36" /><path d="M50 40v-6" /><path d="M50 18c-6 8-6 14 0 16 6-2 6-8 0-16z" /><path d="M32 76h36" />
    </>
  ),
  envelope: (
    <>
      <rect x="20" y="30" width="60" height="40" /><path d="M20 30l30 22 30-22M20 70l22-20M80 70 58 50" />
    </>
  ),
  // playground
  dice: (
    <>
      <rect x="24" y="24" width="52" height="52" rx="8" /><circle cx="37" cy="37" r="4" /><circle cx="63" cy="37" r="4" /><circle cx="50" cy="50" r="4" />
      <circle cx="37" cy="63" r="4" /><circle cx="63" cy="63" r="4" />
    </>
  ),
  puzzle: (
    <path d="M24 32h14c-2-8 4-12 8-12s10 4 8 12h14v14c8-2 12 4 12 8s-4 10-12 8v14H54c2-8-4-10-8-10s-10 2-8 10H24V62c8 2 10-4 10-8s-2-10-10-8z" />
  ),
  fire: (
    <>
      <path d="M50 78c-14 0-22-8-22-20 0-14 14-20 12-36 10 6 16 16 14 26 4-2 6-6 6-10 6 6 12 12 12 22 0 10-8 18-22 18z" />
      <path d="M50 78c-6 0-10-4-10-10 0-6 6-8 8-14 4 4 12 8 12 14s-4 10-10 10z" />
    </>
  ),
  sand: (
    <>
      <path d="M20 76c10-8 18-6 26-2s18 6 34-2" /><path d="M26 66c8-6 14-4 22-1s16 4 28-3" />
      <circle cx="40" cy="30" r="2" /><circle cx="50" cy="40" r="2" /><circle cx="60" cy="28" r="2" /><circle cx="46" cy="52" r="2" /><circle cx="56" cy="50" r="2" />
    </>
  ),
  frog: (
    <>
      <circle cx="36" cy="34" r="8" /><circle cx="64" cy="34" r="8" /><path d="M28 40c-6 6-8 14-6 22 4 10 14 14 28 14s24-4 28-14c2-8 0-16-6-22" />
      <path d="M38 58c6 4 18 4 24 0" /><circle cx="36" cy="34" r="2" /><circle cx="64" cy="34" r="2" />
    </>
  ),
  coin: (
    <>
      <circle cx="50" cy="50" r="26" /><circle cx="50" cy="50" r="20" /><path d="M56 40c-2-3-12-4-12 2s12 4 12 10-10 6-12 2M50 34v32" />
    </>
  ),
  orb: (
    <>
      <circle cx="50" cy="50" r="26" /><path d="M30 60c6-4 10 0 14-2s6-8 12-6 8 6 14 4" /><path d="M40 70c2-6 6-6 8-4" />
      <path d="M38 34c4-4 10-6 16-4" /><circle cx="62" cy="42" r="2" />
    </>
  ),
  tiles: (
    <>
      <rect x="22" y="22" width="26" height="26" rx="3" /><rect x="52" y="22" width="26" height="26" rx="3" /><rect x="22" y="52" width="26" height="26" rx="3" />
      <rect x="52" y="52" width="26" height="26" rx="3" /><path d="M32 35h6M62 62h6M65 59v6" />
    </>
  ),
  wordbox: (
    <>
      <rect x="18" y="38" width="20" height="24" /><rect x="40" y="38" width="20" height="24" /><rect x="62" y="38" width="20" height="24" />
      <path d="M24 56l4-12 4 12M46 44h6c4 0 4 6 0 6h-6v6h6M74 44c-4-2-8 0-8 6s4 8 8 6" />
    </>
  ),
  flag: (
    <>
      <path d="M30 80V20" /><path d="M30 22c12-6 20 6 32 0s12-4 14-2v26c-2-2-6-4-14 2s-20-6-32 0" />
    </>
  ),
  pinwheel: (
    <>
      <path d="M50 50 50 22c12 0 16 14 0 28zM50 50h28c0 12-14 16-28 0zM50 50v28c-12 0-16-14 0-28zM50 50H22c0-12 14-16 28 0z" />
      <path d="M50 50 58 82" />
    </>
  ),
  // quiet coast
  wave: (
    <>
      <path d="M16 46c6-6 12-6 18 0s12 6 18 0 12-6 18 0 10 6 14 2" /><path d="M16 60c6-6 12-6 18 0s12 6 18 0 12-6 18 0 10 6 14 2" />
      <path d="M16 32c6-6 12-6 18 0s12 6 18 0" />
    </>
  ),
  cloud: (
    <>
      <path d="M30 62c-8 0-12-6-12-11s5-11 12-10c1-8 8-14 16-14 7 0 13 4 15 10 2-1 4-2 7-2 7 0 12 6 12 13 0 8-6 14-14 14z" />
    </>
  ),
  rain: (
    <>
      <path d="M30 52c-7 0-10-5-10-9s4-10 10-9c1-7 7-12 14-12 6 0 11 4 13 9 2-1 4-2 6-2 6 0 10 5 10 11s-5 12-12 12z" />
      <path d="M32 62l-4 10M46 62l-4 12M60 62l-4 10" />
    </>
  ),
  cup: (
    <>
      <path d="M24 44h44v8c0 14-10 24-22 24S24 66 24 52z" /><path d="M68 48c8 0 12 4 12 8s-4 8-12 8" /><path d="M18 80h56" />
      <path d="M38 24c-4 4 4 8 0 12M50 22c-4 4 4 8 0 12" />
    </>
  ),
  sun: (
    <>
      <circle cx="50" cy="50" r="14" /><path d="M50 18v10M50 72v10M18 50h10M72 50h10M27 27l7 7M66 66l7 7M27 73l7-7M66 34l7-7" />
    </>
  ),
  lamp: (
    <>
      <path d="M34 22h32l8 26H26z" /><path d="M50 48v24M36 78h28M42 72h16" />
    </>
  ),
  palm: (
    <>
      <path d="M52 80c-2-18 0-32 4-44" /><path d="M56 36c-10-8-22-8-30 0 8-2 16 0 22 4M56 36c4-10 14-14 24-10-8 2-14 6-18 12M56 36c10-2 20 4 22 14-6-6-14-8-22-8M56 36c-8 2-14 10-14 20" />
      <path d="M24 80h52" />
    </>
  ),
  windowpane: (
    <>
      <rect x="26" y="20" width="48" height="60" /><path d="M50 20v60M26 50h48" /><path d="M32 74c8-10 16-14 30-14" /><circle cx="62" cy="32" r="4" />
    </>
  ),
  feather: (
    <>
      <path d="M70 20C44 24 30 44 30 70l40-40" /><path d="M30 70 24 80M40 56h14M46 46h14M36 64h8" />
    </>
  ),
  campfire: (
    <>
      <path d="M24 76 76 64M24 64l52 12" /><path d="M50 64c-8 0-12-5-12-11 0-8 8-12 8-22 6 4 10 10 10 16 3-2 4-4 4-6 3 4 6 8 6 12 0 6-6 11-16 11z" />
    </>
  ),
  boat: (
    <>
      <path d="M20 62h60l-8 12H28z" /><path d="M50 62V20l22 34H50" /><path d="M48 28 32 54h16" /><path d="M14 80c8-4 14-4 20 0s14 4 20 0 14-4 20 0" />
    </>
  ),
  bench: (
    <>
      <path d="M20 54h60M22 46h56M24 54v20M76 54v20M30 46V32h40v14" /><path d="M30 38h40" />
    </>
  ),
  // hidden and special
  keyhole: (
    <>
      <circle cx="50" cy="40" r="12" /><path d="M44 48 38 76h24l-6-28" />
    </>
  ),
  door: (
    <>
      <path d="M30 80V30a20 20 0 0 1 40 0v50z" /><path d="M22 80h56" /><circle cx="60" cy="56" r="3" /><path d="M38 38h24" />
    </>
  ),
  infinity: <path d="M50 50c-8-10-14-14-22-14-8 0-14 6-14 14s6 14 14 14c8 0 14-4 22-14s14-14 22-14c8 0 14 6 14 14s-6 14-14 14c-8 0-14-4-22-14z" />,
  bottle: (
    <>
      <path d="M44 18h12v14c8 4 12 12 12 22v20c0 4-3 6-6 6H38c-3 0-6-2-6-6V54c0-10 4-18 12-22z" /><path d="M40 52h20v18H40z" /><path d="M44 58h12M44 64h8" />
    </>
  ),
  clock: (
    <>
      <circle cx="50" cy="50" r="27" /><path d="M50 30v20l14 8" /><path d="M50 24v3M50 73v3M24 50h3M73 50h3" />
    </>
  ),
  pyramid: (
    <>
      <path d="M50 18 82 76H18z" /><circle cx="50" cy="52" r="8" /><circle cx="50" cy="52" r="3" /><path d="M36 66h28" />
    </>
  ),
  paperclip: <path d="M40 30v34c0 6 4 10 10 10s10-4 10-10V26c0-4-3-7-7-7s-7 3-7 7v36c0 2 1 4 4 4s4-2 4-4V32" />,
  pixel: (
    <>
      <path d="M30 34h10v-8h20v8h10v10h8v20H70v8H60v8H40v-8H30v-8H22V44h8z" /><path d="M40 46h6v6h-6zM56 46h6v6h-6z" />
    </>
  ),
  basketball: (
    <>
      <circle cx="50" cy="50" r="26" /><path d="M24 50h52M50 24v52M32 32c8 8 8 28 0 36M68 32c-8 8-8 28 0 36" />
    </>
  ),
  galaxy: (
    <>
      <path d="M50 50c4-2 6 2 4 4-4 4-12 0-12-6 0-10 14-14 22-8 12 8 6 28-10 30-18 2-30-14-24-30 6-14 22-18 34-12" />
      <circle cx="76" cy="26" r="2" /><circle cx="24" cy="76" r="2" />
    </>
  ),
  laurel: (
    <>
      <path d="M50 78C30 72 22 54 26 32M50 78c20-6 28-24 24-46" />
      <path d="M30 42c-6-2-8-8-6-12 6 2 8 6 6 12zM28 56c-6 0-10-6-8-10 6 0 9 4 8 10zM36 68c-6 2-10-2-10-6 6-2 10 2 10 6zM70 42c6-2 8-8 6-12-6 2-8 6-6 12zM72 56c6 0 10-6 8-10-6 0-9 4-8 10zM64 68c6 2 10-2 10-6-6-2-10 2-10 6z" />
    </>
  ),
  plane: (
    <path d="M18 54 30 52 44 38 40 22h6l16 26 16-2c4 0 6 2 6 4s-2 4-6 4l-16-2-16 26h-6l4-16-14-14-12-2z" />
  ),
  seal: (
    <>
      <circle cx="50" cy="50" r="22" /><path d="M50 36l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" />
    </>
  ),
  footprints: (
    <>
      <ellipse cx="36" cy="60" rx="7" ry="11" /><ellipse cx="62" cy="40" rx="7" ry="11" />
      <circle cx="30" cy="44" r="2.5" /><circle cx="36" cy="43" r="2.5" /><circle cx="42" cy="45" r="2.5" />
      <circle cx="56" cy="24" r="2.5" /><circle cx="62" cy="23" r="2.5" /><circle cx="68" cy="25" r="2.5" />
    </>
  ),
  postcard: (
    <>
      <rect x="18" y="28" width="64" height="44" /><path d="M54 34v32M24 40h22M24 48h22M24 56h16" /><rect x="62" y="34" width="12" height="14" />
    </>
  ),
  owl: (
    <>
      <path d="M30 30l6 6h28l6-6v30c0 12-8 20-20 20S30 72 30 60z" /><circle cx="42" cy="46" r="6" /><circle cx="58" cy="46" r="6" />
      <path d="M48 54l2 4 2-4M38 66c8 4 16 4 24 0" />
    </>
  ),
};

export const GLYPH_KEYS = Object.keys(G);

export function Glyph({ name }: { name: string }) {
  return G[name] ?? G.question;
}

export function hasGlyph(name: string) {
  return name in G;
}
