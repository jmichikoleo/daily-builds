import { useId, type ReactNode } from "react";
import { MOTIF_PATHS, type MotifId } from "@/lib/stamps/motifs";
import { r2 } from "@/lib/stamps/random";
import { GLYPH_WIDTH, fitBlock, fitLine, type FittedBlock } from "@/lib/stamps/text";
import type { StampBorder, StampDesign, StampModel } from "@/lib/stamps/types";

const STAMP_FONT = { fontFamily: "var(--font-stamp), 'Arial Narrow', sans-serif" } as const;
const SERIF_FONT = { fontFamily: "var(--font-serif), Georgia, serif" } as const;
const MONO_FONT = { fontFamily: "var(--font-mono), ui-monospace, monospace" } as const;

interface StyleProps {
  model: StampModel;
  design: StampDesign;
  uid: string;
}

// ── Shared primitives ────────────────────────────────────────────────────

function outerStroke(border: StampBorder) {
  switch (border) {
    case "double":
      return { strokeWidth: 4 };
    case "dashed":
      return { strokeWidth: 3.5, strokeDasharray: "11 5" };
    case "dotted":
      return { strokeWidth: 5.5, strokeDasharray: "0 9", strokeLinecap: "round" as const };
  }
}

function Motif({ id, x, y, size, ink }: { id: MotifId; x: number; y: number; size: number; ink: string }) {
  const s = size / 40;
  return (
    <g
      transform={`translate(${r2(x)} ${r2(y)}) scale(${r2(s)})`}
      fill="none"
      stroke={ink}
      strokeWidth={r2(Math.min(3.2, 2.3 / Math.max(s, 0.6)))}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {MOTIF_PATHS[id].map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}

/** Slight ink spread plus uneven coverage, seeded per stamp. */
function InkFilter({ id, seed, rough = 2 }: { id: string; seed: number; rough?: number }) {
  return (
    <filter id={id} x="-4%" y="-4%" width="108%" height="108%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} result="grain" />
      <feDisplacementMap in="SourceGraphic" in2="grain" scale={rough} xChannelSelector="R" yChannelSelector="G" result="rough" />
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed={seed + 11} result="blot" />
      <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.5" result="wear" />
      <feComposite in="rough" in2="wear" operator="in" />
    </filter>
  );
}

/** A centred (or left-aligned) one- or two-line block whose cap-height box is centred on `cy`. */
function NameBlock({
  block,
  x,
  cy,
  ink,
  anchor = "middle",
  font = STAMP_FONT,
  weight = 700,
  letterSpacing = 1,
  maxWidth,
}: {
  block: FittedBlock;
  x: number;
  cy: number;
  ink: string;
  anchor?: "middle" | "start";
  font?: { fontFamily: string };
  weight?: number;
  letterSpacing?: number;
  maxWidth: number;
}) {
  const capHeight = block.size * 0.74;
  const total = capHeight + (block.lines.length - 1) * block.lineHeight;
  const firstBaseline = cy - total / 2 + capHeight;
  return (
    <text fill={ink} style={font} fontWeight={weight} letterSpacing={letterSpacing} textAnchor={anchor}>
      {block.lines.map((line, i) => (
        <tspan
          key={i}
          x={x}
          y={r2(firstBaseline + i * block.lineHeight)}
          fontSize={line.size}
          {...(line.textLength ? { textLength: Math.min(line.textLength, maxWidth), lengthAdjust: "spacingAndGlyphs" } : {})}
        >
          {line.text}
        </tspan>
      ))}
    </text>
  );
}

/** Text along an arc path; shrinks, then compresses, rather than overflowing. */
function ArcText({
  pathId,
  text,
  length,
  maxSize,
  minSize,
  ink,
  weight = 500,
  letterSpacing = 2,
}: {
  pathId: string;
  text: string;
  length: number;
  maxSize: number;
  minSize: number;
  ink: string;
  weight?: number;
  letterSpacing?: number;
}) {
  const fit = fitLine(text, { maxWidth: length, maxSize, minSize, glyph: GLYPH_WIDTH.stamp, letterSpacing });
  return (
    <text fill={ink} style={STAMP_FONT} fontWeight={weight} fontSize={fit.size} letterSpacing={fit.textLength ? 0 : letterSpacing}>
      <textPath
        href={`#${pathId}`}
        startOffset="50%"
        textAnchor="middle"
        {...(fit.textLength ? { textLength: fit.textLength, lengthAdjust: "spacingAndGlyphs" } : {})}
      >
        {text}
      </textPath>
    </text>
  );
}

function SingleLine({
  text,
  x,
  y,
  maxWidth,
  maxSize,
  minSize = 7,
  ink,
  anchor = "start",
  font = "stamp",
  letterSpacing = 2,
  weight = 400,
}: {
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  maxSize: number;
  minSize?: number;
  ink: string;
  anchor?: "start" | "middle" | "end";
  font?: "stamp" | "mono" | "serif";
  letterSpacing?: number;
  weight?: number;
}) {
  const fit = fitLine(text, { maxWidth, maxSize, minSize, glyph: GLYPH_WIDTH[font], letterSpacing });
  const style = font === "mono" ? MONO_FONT : font === "serif" ? SERIF_FONT : STAMP_FONT;
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill={ink}
      style={style}
      fontSize={fit.size}
      fontWeight={weight}
      letterSpacing={fit.textLength ? 0 : letterSpacing}
      {...(fit.textLength ? { textLength: fit.textLength, lengthAdjust: "spacingAndGlyphs" } : {})}
    >
      {text}
    </text>
  );
}

const upper = (s: string) => s.toUpperCase();
/** "ADMITTED · KR", or just "ADMITTED" for unresolved places without a code. */
const withCode = (label: string, code: string) => (code ? `${label} · ${code}` : label);

// ── 1. Circular immigration stamp ───────────────────────────────────────

function ImmigrationStamp({ model, design, uid }: StyleProps) {
  const { ink, border } = design;
  const date = model.dateText;
  return (
    <>
      <defs>
        <path id={`${uid}-top`} d="M 37 100 A 63 63 0 0 1 163 100" />
        <path id={`${uid}-bottom`} d="M 29 100 A 71 71 0 0 0 171 100" />
      </defs>
      <circle cx="100" cy="100" r="93" fill="none" stroke={ink} {...outerStroke(border)} />
      <circle cx="100" cy="100" r="84" fill="none" stroke={ink} strokeWidth="1.5" />
      <circle cx="100" cy="100" r="56" fill="none" stroke={ink} strokeWidth="1.5" />
      <ArcText pathId={`${uid}-top`} text={upper(model.name)} length={160} maxSize={19} minSize={10} ink={ink} weight={600} letterSpacing={1.5} />
      <ArcText pathId={`${uid}-bottom`} text={upper(model.label)} length={150} maxSize={12.5} minSize={8} ink={ink} />
      <circle cx="31" cy="100" r="2.6" fill={ink} />
      <circle cx="169" cy="100" r="2.6" fill={ink} />
      {date ? (
        <>
          <Motif id={model.motif} x={80} y={60} size={40} ink={ink} />
          <line x1="62" y1="110" x2="138" y2="110" stroke={ink} strokeWidth="1.2" />
          <SingleLine text={date} x={100} y={127} maxWidth={96} maxSize={12.5} anchor="middle" font="mono" letterSpacing={1} ink={ink} />
          <SingleLine text={model.code} x={100} y={142} maxWidth={40} maxSize={9} anchor="middle" letterSpacing={2.5} ink={ink} />
        </>
      ) : (
        <>
          <Motif id={model.motif} x={74} y={62} size={52} ink={ink} />
          <SingleLine text={model.code} x={100} y={136} maxWidth={40} maxSize={10} anchor="middle" letterSpacing={3} ink={ink} />
        </>
      )}
    </>
  );
}

// ── 2. Oval entry stamp ─────────────────────────────────────────────────

function EntryStamp({ model, design, uid }: StyleProps) {
  const { ink, border } = design;
  const name = fitBlock(upper(model.name), { maxWidth: 150, maxHeight: 30, maxSize: 26, minSize: 9, glyph: GLYPH_WIDTH.stamp, letterSpacing: 1.5 });
  return (
    <>
      <defs>
        <path id={`${uid}-top`} d="M 30 80 A 90 54 0 0 1 210 80" />
        <path id={`${uid}-bottom`} d="M 24 80 A 96 60 0 0 0 216 80" />
      </defs>
      <ellipse cx="120" cy="80" rx="113" ry="73" fill="none" stroke={ink} {...outerStroke(border)} />
      <ellipse cx="120" cy="80" rx="104" ry="64" fill="none" stroke={ink} strokeWidth="1.4" />
      <ArcText pathId={`${uid}-top`} text={upper(model.label)} length={130} maxSize={11.5} minSize={7.5} ink={ink} letterSpacing={2.5} />
      <ArcText pathId={`${uid}-bottom`} text={withCode("ADMITTED", model.code)} length={130} maxSize={10.5} minSize={7} ink={ink} weight={400} letterSpacing={3} />
      <Motif id={model.motif} x={107} y={32} size={26} ink={ink} />
      <line x1="44" y1="64" x2="196" y2="64" stroke={ink} strokeWidth="1.2" />
      <NameBlock block={name} x={120} cy={82} ink={ink} letterSpacing={1.5} maxWidth={150} />
      <line x1="44" y1="100" x2="196" y2="100" stroke={ink} strokeWidth="1.2" />
      {model.dateText && (
        <SingleLine text={model.dateText} x={120} y={116} maxWidth={110} maxSize={11.5} anchor="middle" font="mono" letterSpacing={1} ink={ink} />
      )}
    </>
  );
}

// ── 3. Rectangular border-control stamp ─────────────────────────────────

function BorderStamp({ model, design }: StyleProps) {
  const { ink, border } = design;
  const name = fitBlock(upper(model.name), { maxWidth: 116, maxHeight: 44, maxSize: 30, minSize: 9, glyph: GLYPH_WIDTH.stamp, letterSpacing: 1 });
  return (
    <>
      <rect x="7" y="7" width="226" height="156" rx="3" fill="none" stroke={ink} {...outerStroke(border)} />
      <rect x="16" y="16" width="208" height="138" rx="1.5" fill="none" stroke={ink} strokeWidth="1.3" />
      <text x="28" y="36" fill={ink} style={STAMP_FONT} fontSize="11" fontWeight="500" letterSpacing="2.5">
        {withCode("BORDER", model.code)}
      </text>
      <text x="212" y="36" textAnchor="end" fill={ink} style={MONO_FONT} fontSize="10">
        {design.serial}
      </text>
      <line x1="26" y1="45" x2="214" y2="45" stroke={ink} strokeWidth="1.2" />
      <Motif id={model.motif} x={26} y={58} size={50} ink={ink} />
      <line x1="86" y1="56" x2="86" y2="112" stroke={ink} strokeWidth="1" strokeDasharray="2 3" />
      <NameBlock block={name} x={98} cy={77} anchor="start" ink={ink} maxWidth={116} />
      <SingleLine text={upper(model.label)} x={98} y={110} maxWidth={116} maxSize={11} ink={ink} />
      <line x1="26" y1="122" x2="214" y2="122" stroke={ink} strokeWidth="1.2" />
      <text x="28" y="142" fill={ink} style={STAMP_FONT} fontSize="11" letterSpacing="2.5">
        ARRIVED
      </text>
      {model.dateText ? (
        <SingleLine text={model.dateText} x={212} y={142} maxWidth={120} maxSize={13} anchor="end" font="mono" letterSpacing={1} ink={ink} />
      ) : (
        <text x="212" y="142" textAnchor="end" fill={ink} style={STAMP_FONT} fontSize="11" letterSpacing="4">
          ★ ★ ★
        </text>
      )}
    </>
  );
}

// ── 4. Vintage postage stamp ────────────────────────────────────────────

/** A rectangle whose edges are bitten by semicircular perforations. */
function perforatedRect(x: number, y: number, w: number, h: number, r: number, step: number): string {
  const edge = (len: number) => {
    const n = Math.max(2, Math.round(len / step));
    return { n, gap: len / n };
  };
  const top = edge(w);
  const side = edge(h);
  let d = `M ${x} ${y}`;
  // Each slot: straight run, inward semicircle, straight run. Sweep 0 = inward on a clockwise path.
  const run = (dx: number, dy: number, gap: number, n: number) => {
    const ux = dx === 0 ? 0 : Math.sign(dx);
    const uy = dy === 0 ? 0 : Math.sign(dy);
    for (let i = 0; i < n; i++) {
      const half = (gap - 2 * r) / 2;
      d += ` l ${r2(ux * half)} ${r2(uy * half)}`;
      d += ` a ${r} ${r} 0 0 0 ${r2(ux * 2 * r)} ${r2(uy * 2 * r)}`;
      d += ` l ${r2(ux * half)} ${r2(uy * half)}`;
    }
  };
  run(1, 0, top.gap, top.n);
  run(0, 1, side.gap, side.n);
  run(-1, 0, top.gap, top.n);
  run(0, -1, side.gap, side.n);
  return `${d} Z`;
}

const POSTAGE_EDGE = perforatedRect(6, 6, 168, 208, 4.5, 13);

function PostageStamp({ model, design }: StyleProps) {
  const { ink, border, seed } = design;
  const name = fitBlock(upper(model.name), { maxWidth: 128, maxHeight: 26, maxSize: 22, minSize: 8, glyph: GLYPH_WIDTH.stamp, letterSpacing: 1 });
  const denomination = `${(seed % 9) * 10 + 15}c`;
  return (
    <>
      <path d={POSTAGE_EDGE} fill={ink} fillOpacity="0.07" stroke={ink} strokeWidth="1.4" />
      <rect
        x="18"
        y="18"
        width="144"
        height="184"
        fill="none"
        stroke={ink}
        strokeWidth={border === "double" ? 2.4 : 1.4}
        strokeDasharray={border === "dashed" ? "6 3" : undefined}
      />
      {border === "double" && <rect x="22" y="22" width="136" height="176" fill="none" stroke={ink} strokeWidth="0.9" />}
      <text x="30" y="40" fill={ink} style={SERIF_FONT} fontSize="17" fontWeight="600">
        {denomination}
      </text>
      <text x="150" y="38" textAnchor="end" fill={ink} style={STAMP_FONT} fontSize="11" letterSpacing="2.5">
        {model.code}
      </text>
      <rect x="30" y="48" width="120" height="96" fill="none" stroke={ink} strokeWidth="1" />
      {/* Engraved sky lines behind the motif. */}
      <g stroke={ink} strokeWidth="0.6" opacity="0.45">
        {[56, 62, 68, 74].map((y) => (
          <line key={y} x1="34" y1={y} x2="146" y2={y} />
        ))}
      </g>
      <Motif id={model.motif} x={55} y={62} size={70} ink={ink} />
      {model.dateText && (
        <SingleLine text={model.dateText} x={90} y={158} maxWidth={110} maxSize={10} anchor="middle" font="mono" letterSpacing={1} ink={ink} />
      )}
      <NameBlock block={name} x={90} cy={model.dateText ? 176 : 170} ink={ink} maxWidth={128} />
      <SingleLine text={upper(model.label)} x={90} y={195} maxWidth={120} maxSize={9.5} anchor="middle" ink={ink} />
    </>
  );
}

// ── 5. Double-ring postmark with date bar ───────────────────────────────

function DoubleRingStamp({ model, design, uid }: StyleProps) {
  const { ink, border } = design;
  const barText = model.dateText ?? (model.code ? `· ${model.code} ·` : "★ ★ ★");
  return (
    <>
      <defs>
        <path id={`${uid}-top`} d="M 30 100 A 70 70 0 0 1 170 100" />
        <path id={`${uid}-bottom`} d="M 22 100 A 78 78 0 0 0 178 100" />
        {/* Rings stop where the date bar crosses them. */}
        <mask id={`${uid}-bar`}>
          <rect width="200" height="200" fill="white" />
          <rect x="14" y="87" width="172" height="26" fill="black" />
        </mask>
      </defs>
      <g mask={`url(#${uid}-bar)`} fill="none" stroke={ink}>
        <circle cx="100" cy="100" r="93" {...outerStroke(border)} />
        <circle cx="100" cy="100" r="87" strokeWidth="1.2" />
        <circle cx="100" cy="100" r="61" strokeWidth="3" />
        <circle cx="100" cy="100" r="56" strokeWidth="1" />
      </g>
      <ArcText pathId={`${uid}-top`} text={upper(model.name)} length={150} maxSize={17} minSize={9} ink={ink} weight={600} letterSpacing={1.5} />
      <ArcText pathId={`${uid}-bottom`} text={upper(model.label)} length={140} maxSize={11} minSize={7} ink={ink} />
      <line x1="16" y1="88" x2="184" y2="88" stroke={ink} strokeWidth="1.6" />
      <line x1="16" y1="112" x2="184" y2="112" stroke={ink} strokeWidth="1.6" />
      <SingleLine text={barText} x={100} y={105} maxWidth={150} maxSize={14} anchor="middle" font="mono" letterSpacing={1.5} ink={ink} weight={500} />
      <Motif id={model.motif} x={85} y={50} size={30} ink={ink} />
      <text x="100" y="140" textAnchor="middle" fill={ink} style={STAMP_FONT} fontSize="11" letterSpacing="4">
        ★ ★ ★
      </text>
    </>
  );
}

// ── 6. Minimal editorial location stamp ─────────────────────────────────

function EditorialStamp({ model, design }: StyleProps) {
  const { ink, border } = design;
  const name = fitBlock(model.name, { maxWidth: 196, maxHeight: 50, maxSize: 40, minSize: 11, glyph: GLYPH_WIDTH.serif });
  return (
    <>
      <rect
        x="8"
        y="8"
        width="224"
        height="134"
        fill="none"
        stroke={ink}
        strokeWidth="1.5"
        strokeDasharray={border === "dashed" ? "8 4" : border === "dotted" ? "1 4" : undefined}
        strokeLinecap="round"
      />
      <text x="22" y="32" fill={ink} style={STAMP_FONT} fontSize="10" letterSpacing="3">
        {withCode("VISITED", model.code)}
      </text>
      <Motif id={model.motif} x={192} y={16} size={26} ink={ink} />
      <NameBlock block={name} x={22} cy={76} anchor="start" ink={ink} font={SERIF_FONT} weight={400} letterSpacing={0} maxWidth={196} />
      <line x1="22" y1="112" x2="218" y2="112" stroke={ink} strokeWidth="1" />
      <SingleLine text={upper(model.label)} x={22} y={130} maxWidth={model.dateText ? 110 : 196} maxSize={10} ink={ink} />
      {model.dateText && (
        <SingleLine text={model.dateText} x={218} y={130} maxWidth={84} maxSize={11} anchor="end" font="mono" letterSpacing={0.5} ink={ink} />
      )}
    </>
  );
}

const STYLES: Record<StampDesign["style"], (props: StyleProps) => ReactNode> = {
  immigration: ImmigrationStamp,
  entry: EntryStamp,
  border: BorderStamp,
  postage: PostageStamp,
  doubleRing: DoubleRingStamp,
  editorial: EditorialStamp,
};

/**
 * The stamp artwork as an SVG group in its own viewBox coordinates
 * (see STAMP_VIEWBOX). Place it inside any <svg> with a transform.
 */
export function StampGraphic({ model, design }: { model: StampModel; design: StampDesign }) {
  const uid = `stamp-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const filterId = `${uid}-ink`;
  const Style = STYLES[design.style];
  return (
    <g style={{ mixBlendMode: "multiply" }}>
      <defs>
        <InkFilter id={filterId} seed={design.seed} rough={design.style === "editorial" ? 1 : 2} />
      </defs>
      <g filter={`url(#${filterId})`} opacity="0.92">
        <Style model={model} design={design} uid={uid} />
      </g>
    </g>
  );
}
