import { memo, useId, type KeyboardEvent, type PointerEvent } from "react";
import { StampGraphic } from "@/components/stamps/StampGraphic";
import type { ComposedCollage, ComposedStamp } from "@/lib/collage/compose";
import type { TextLine } from "@/lib/collage/frame";
import type { Placement } from "@/lib/collage/layout";
import { formatVisit } from "@/lib/passport/visits";
import { fitLine } from "@/lib/stamps/text";
import { STAMP_VIEWBOX } from "@/lib/stamps/types";
import { CollageBackground } from "./CollageBackground";

export type HandleKind = "resize" | "rotate";

/** Editing hooks. Omit for a static render (thumbnails, export). */
export interface CanvasInteraction {
  selectedId: string | null;
  /** A stamp being dragged, resized or rotated; shown instead of its stored placement. */
  transient: Placement | null;
  /** Canvas units per CSS pixel, so handles stay finger-sized at any zoom. */
  unitsPerPx: number;
  onStampPointerDown: (id: string, event: PointerEvent<SVGGElement>) => void;
  onHandlePointerDown: (kind: HandleKind, event: PointerEvent<SVGElement>) => void;
  onStampKeyDown: (id: string, event: KeyboardEvent<SVGGElement>) => void;
  onBackgroundPointerDown: () => void;
}

const MONO = "var(--font-mono), ui-monospace, monospace";

function SvgText({ line, fill, anchor }: { line: TextLine; fill: string; anchor: "start" | "middle" | "end" }) {
  const { face } = line;
  return (
    <text
      x={line.x}
      y={line.y}
      textAnchor={anchor}
      fill={fill}
      style={{ fontFamily: face.family }}
      fontWeight={face.weight}
      fontStyle={face.italic ? "italic" : "normal"}
      fontSize={line.size}
      letterSpacing={line.textLength ? 0 : Math.round(face.tracking * line.size * 100) / 100}
      {...(line.textLength ? { textLength: line.textLength, lengthAdjust: "spacingAndGlyphs" } : {})}
    >
      {line.text}
    </text>
  );
}

/** One placed stamp. Memoised so dragging one stamp doesn't re-render the others. */
const PlacedStamp = memo(function PlacedStamp({
  stamp,
  placement,
  interactive,
  selected,
  onPointerDown,
  onKeyDown,
}: {
  stamp: ComposedStamp;
  placement: Placement;
  interactive: boolean;
  selected: boolean;
  onPointerDown?: (id: string, event: PointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: string, event: KeyboardEvent<SVGGElement>) => void;
}) {
  const box = STAMP_VIEWBOX[stamp.design.style];
  const s = Math.round((placement.w / box.width) * 10000) / 10000;
  const transform = `translate(${placement.cx} ${placement.cy}) rotate(${placement.rotation}) translate(${-placement.w / 2} ${-placement.h / 2}) scale(${s})`;
  if (!interactive) {
    return (
      <g transform={transform} data-entry={stamp.entry.id}>
        <StampGraphic model={stamp.model} design={stamp.design} />
      </g>
    );
  }
  return (
    <g
      transform={transform}
      data-entry={stamp.entry.id}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-label={`${stamp.model.name} stamp. Drag to move, or use arrow keys. Plus and minus resize, brackets rotate.`}
      onPointerDown={(e) => onPointerDown?.(stamp.entry.id, e)}
      onKeyDown={(e) => onKeyDown?.(stamp.entry.id, e)}
      style={{ cursor: "grab", touchAction: "none" }}
      className="collage-stamp"
    >
      {/* Hit area over the whole stamp, including its transparent parts. */}
      <rect width={box.width} height={box.height} fill="transparent" />
      <StampGraphic model={stamp.model} design={stamp.design} />
    </g>
  );
});

function SelectionFrame({
  placement,
  unitsPerPx: u,
  color,
  onHandlePointerDown,
}: {
  placement: Placement;
  unitsPerPx: number;
  color: string;
  onHandlePointerDown: CanvasInteraction["onHandlePointerDown"];
}) {
  const pad = 8 * u;
  const hw = placement.w / 2 + pad;
  const hh = placement.h / 2 + pad;
  const r = 10 * u;
  const stem = 28 * u;
  return (
    <g transform={`translate(${placement.cx} ${placement.cy}) rotate(${placement.rotation})`} aria-hidden="true">
      <rect x={-hw} y={-hh} width={hw * 2} height={hh * 2} fill="none" stroke={color} strokeWidth={2 * u} strokeDasharray={`${6 * u} ${4 * u}`} pointerEvents="none" />
      <line x1={0} y1={-hh} x2={0} y2={-hh - stem} stroke={color} strokeWidth={2 * u} pointerEvents="none" />
      {/* Each handle: a visible mark plus a 44px transparent touch target. */}
      <g style={{ cursor: "grab", touchAction: "none" }} onPointerDown={(e) => onHandlePointerDown("rotate", e)}>
        <circle cx={0} cy={-hh - stem} r={22 * u} fill="transparent" />
        <circle cx={0} cy={-hh - stem} r={r} fill="#fff" stroke={color} strokeWidth={2.5 * u} />
      </g>
      <g style={{ cursor: "nwse-resize", touchAction: "none" }} onPointerDown={(e) => onHandlePointerDown("resize", e)}>
        <circle cx={hw} cy={hh} r={22 * u} fill="transparent" />
        <rect x={hw - r} y={hh - r} width={r * 2} height={r * 2} fill="#fff" stroke={color} strokeWidth={2.5 * u} />
      </g>
    </g>
  );
}

/** Minimal Archive captions: place name and a small country/date line. */
function Captions({ data, placements }: { data: ComposedCollage; placements: readonly Placement[] }) {
  const { fonts, textColor, theme } = data.resolved;
  const size = data.format.id === "story" ? 21 : 15;
  return (
    <g aria-hidden="true">
      {placements.map((p) => {
        const stamp = data.stamps.get(p.id);
        if (!p.caption || !stamp) return null;
        const { place } = stamp.entry;
        const name = fitLine(place.name, { maxWidth: p.caption.width, maxSize: size, minSize: size * 0.6, glyph: fonts.title.glyph + fonts.title.tracking });
        const sub = [place.kind === "country" ? "" : place.countryName, formatVisit(stamp.entry.visit) ?? ""].filter(Boolean).join(" · ").toUpperCase();
        const subFit = fitLine(sub, { maxWidth: p.caption.width, maxSize: size * 0.6, minSize: size * 0.42, glyph: 0.64, letterSpacing: 1 });
        return (
          <g key={p.id}>
            <text
              x={p.caption.x}
              y={p.caption.y}
              textAnchor="middle"
              fill={textColor}
              style={{ fontFamily: fonts.title.family }}
              fontSize={name.size}
              fontWeight={fonts.title.weight}
              fontStyle={fonts.title.italic ? "italic" : "normal"}
              {...(name.textLength ? { textLength: name.textLength, lengthAdjust: "spacingAndGlyphs" } : {})}
            >
              {name.text}
            </text>
            {sub && (
              <text
                x={p.caption.x}
                y={p.caption.y + size * 1.05}
                textAnchor="middle"
                fill={theme.muted}
                style={{ fontFamily: MONO }}
                fontSize={subFit.size}
                letterSpacing={subFit.textLength ? 0 : 1}
                {...(subFit.textLength ? { textLength: subFit.textLength, lengthAdjust: "spacingAndGlyphs" } : {})}
              >
                {subFit.text}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function EmptyPage({ data }: { data: ComposedCollage }) {
  const a = data.pages[0].frame.stampArea;
  const { theme, fonts } = data.resolved;
  const cx = a.x + a.width / 2;
  const cy = a.y + a.height / 2;
  return (
    <g aria-hidden="true">
      <rect x={a.x + 30} y={a.y + 30} width={a.width - 60} height={a.height - 60} fill="none" stroke={theme.muted} strokeWidth="3" strokeDasharray="14 12" opacity="0.6" />
      <circle cx={cx} cy={cy - 60} r="64" fill="none" stroke={theme.muted} strokeWidth="3" strokeDasharray="8 8" opacity="0.7" />
      <text x={cx} y={cy + 60} textAnchor="middle" fill={theme.text} style={{ fontFamily: fonts.title.family }} fontStyle="italic" fontSize="42">
        Your stamps will land here
      </text>
    </g>
  );
}

/**
 * One page of the collage as a single SVG in canvas units (1080 wide).
 * The live editor passes `interaction`; without it this is a static render,
 * the same one a high-resolution export will rasterise.
 */
export const CollageCanvas = memo(function CollageCanvas({
  data,
  pageIndex = 0,
  className,
  interaction,
}: {
  data: ComposedCollage;
  pageIndex?: number;
  className?: string;
  interaction?: CanvasInteraction;
}) {
  const uid = `collage-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const page = data.pages[Math.min(pageIndex, data.pages.length - 1)];
  const { frame, layout } = page;
  const { resolved } = data;
  const { theme } = resolved;
  const transient = interaction?.transient;
  const placements = layout.placements.map((p) => (transient && transient.id === p.id ? transient : p)).sort((a, b) => a.z - b.z);
  const selected = interaction?.selectedId ? placements.find((p) => p.id === interaction.selectedId) : undefined;
  const names = placements.map((p) => data.stamps.get(p.id)?.model.name).filter(Boolean).join(", ");
  const anchor = frame.anchor;

  return (
    <svg
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      className={className}
      role="img"
      aria-label={`${data.title}, ${data.year}${data.pages.length > 1 ? `, page ${page.index + 1} of ${data.pages.length}` : ""}. ${names ? `Stamps: ${names}.` : "No stamps yet."}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g onPointerDown={interaction?.onBackgroundPointerDown}>
        <CollageBackground frame={frame} resolved={resolved} uid={uid} />
      </g>

      <g aria-hidden="true" pointerEvents="none">
        <SvgText line={frame.kicker} fill={theme.muted} anchor={anchor} />
        <SvgText line={frame.year} fill={resolved.textColor} anchor={anchor} />
        {frame.title.map((line, i) => (
          <SvgText key={i} line={line} fill={resolved.titleColor} anchor={anchor} />
        ))}
        {frame.subtitle && <SvgText line={frame.subtitle} fill={theme.muted} anchor={anchor} />}
        <line x1={frame.margin} y1={frame.headerRuleY} x2={frame.width - frame.margin} y2={frame.headerRuleY} stroke={resolved.textColor} strokeWidth="2.5" opacity="0.8" />
        {layout.foldY !== undefined && (
          <line x1={frame.margin} y1={layout.foldY} x2={frame.width - frame.margin} y2={layout.foldY} stroke={theme.muted} strokeWidth="2" strokeDasharray="3 9" strokeLinecap="round" opacity="0.5" />
        )}
      </g>

      {data.stamps.size === 0 ? (
        <EmptyPage data={data} />
      ) : (
        placements.map((p) => {
          const stamp = data.stamps.get(p.id);
          if (!stamp) return null;
          return (
            <PlacedStamp
              key={p.id}
              stamp={stamp}
              placement={p}
              interactive={!!interaction}
              selected={interaction?.selectedId === p.id}
              onPointerDown={interaction?.onStampPointerDown}
              onKeyDown={interaction?.onStampKeyDown}
            />
          );
        })
      )}

      {resolved.preset === "archive" && <Captions data={data} placements={placements} />}

      <g aria-hidden="true" pointerEvents="none">
        <line x1={frame.margin} y1={frame.footerRuleY} x2={frame.width - frame.margin} y2={frame.footerRuleY} stroke={resolved.textColor} strokeWidth="1.5" opacity="0.7" />
        {frame.footerLeft && <SvgText line={frame.footerLeft} fill={resolved.textColor} anchor="start" />}
        {frame.footerRight && <SvgText line={frame.footerRight} fill={theme.muted} anchor="end" />}
      </g>

      {interaction && selected && (
        <SelectionFrame placement={selected} unitsPerPx={interaction.unitsPerPx} color={theme.accent} onHandlePointerDown={interaction.onHandlePointerDown} />
      )}
    </svg>
  );
});
