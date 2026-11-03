"use client";

import { Download, Maximize, Minus, Plus, Redo2, Shuffle, Undo2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CollageCanvas, type CanvasInteraction, type HandleKind } from "@/components/collage/CollageCanvas";
import { overrideFromPlacement, placementFromOverride, type ComposedCollage } from "@/lib/collage/compose";
import type { Placement } from "@/lib/collage/layout";
import { studioActions, useStudioHistory } from "@/lib/studio/store";

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type Gesture = {
  kind: "move" | HandleKind;
  id: string;
  start: Placement;
  startPoint: { x: number; y: number };
  moved: boolean;
};

function normalizeAngle(deg: number): number {
  let a = ((deg + 180) % 360 + 360) % 360 - 180;
  if (Math.abs(a) < 2) a = 0; // gentle snap to level
  return Math.round(a * 10) / 10;
}

/**
 * The live canvas with direct manipulation. Pointer moves only update local
 * "transient" state; one history entry is committed when the gesture ends.
 */
export function CanvasEditor({
  collage,
  pageIndex,
  onPageChange,
  selectedId,
  onSelect,
  onExport,
  compact = false,
}: {
  collage: ComposedCollage;
  pageIndex: number;
  onPageChange: (index: number) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onExport: () => void;
  compact?: boolean;
}) {
  const history = useStudioHistory();
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [transient, setTransientState] = useState<Placement | null>(null);
  // Mirror of `transient` for the pointer-up handler, which must commit exactly once.
  const transientRef = useRef<Placement | null>(null);
  const setTransient = useCallback((p: Placement | null) => {
    transientRef.current = p;
    setTransientState(p);
  }, []);
  const [zoom, setZoom] = useState(1);
  const [unitsPerPx, setUnitsPerPx] = useState(3);
  const { format } = collage;
  const page = collage.pages[Math.min(pageIndex, collage.pages.length - 1)];

  // Keep handles a constant on-screen size whatever the zoom.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setUnitsPerPx(format.width / w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [format.width, zoom]);

  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const svg = wrapRef.current?.querySelector("svg");
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const clampToCanvas = useCallback(
    (p: Placement) => placementFromOverride(p.id, overrideFromPlacement(p, format), p.w / p.h, format, page.frame.margin),
    [format, page.frame.margin],
  );

  const findPlacement = useCallback((id: string) => page.layout.placements.find((p) => p.id === id), [page]);

  const startGesture = useCallback(
    (kind: Gesture["kind"], id: string, event: PointerEvent<Element>) => {
      const start = findPlacement(id);
      if (!start) return;
      event.preventDefault();
      event.stopPropagation();
      gesture.current = { kind, id, start, startPoint: toCanvas(event.clientX, event.clientY), moved: false };

      const onMove = (e: globalThis.PointerEvent) => {
        const g = gesture.current;
        if (!g) return;
        const pt = toCanvas(e.clientX, e.clientY);
        const dx = pt.x - g.startPoint.x;
        const dy = pt.y - g.startPoint.y;
        if (!g.moved && Math.hypot(dx, dy) < 4) return;
        g.moved = true;
        let next: Placement;
        if (g.kind === "move") {
          next = { ...g.start, cx: g.start.cx + dx, cy: g.start.cy + dy };
        } else if (g.kind === "resize") {
          const d0 = Math.hypot(g.startPoint.x - g.start.cx, g.startPoint.y - g.start.cy) || 1;
          const d1 = Math.hypot(pt.x - g.start.cx, pt.y - g.start.cy);
          const aspect = g.start.w / g.start.h;
          const w = Math.min(format.width * 0.85, Math.max(format.width * 0.06, g.start.w * (d1 / d0)));
          next = { ...g.start, w, h: w / aspect };
        } else {
          const angle = (Math.atan2(pt.y - g.start.cy, pt.x - g.start.cx) * 180) / Math.PI + 90;
          next = { ...g.start, rotation: normalizeAngle(e.shiftKey ? Math.round(angle / 15) * 15 : angle) };
        }
        setTransient(clampToCanvas(next));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        const g = gesture.current;
        const t = transientRef.current;
        gesture.current = null;
        if (g?.moved && t) studioActions.setOverride(t.id, overrideFromPlacement(t, format));
        setTransient(null);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [clampToCanvas, findPlacement, format, setTransient, toCanvas],
  );

  const onStampPointerDown = useCallback(
    (id: string, event: PointerEvent<SVGGElement>) => {
      if (event.button !== 0) return;
      onSelect(id);
      startGesture("move", id, event);
    },
    [onSelect, startGesture],
  );

  const onHandlePointerDown = useCallback(
    (kind: HandleKind, event: PointerEvent<SVGElement>) => {
      if (selectedId) startGesture(kind, selectedId, event);
    },
    [selectedId, startGesture],
  );

  const onStampKeyDown = useCallback(
    (id: string, event: KeyboardEvent<SVGGElement>) => {
      const p = findPlacement(id);
      if (!p) return;
      const step = (event.shiftKey ? 0.05 : 0.01) * format.width;
      let next: Placement | null = null;
      switch (event.key) {
        case "ArrowLeft":
          next = { ...p, cx: p.cx - step };
          break;
        case "ArrowRight":
          next = { ...p, cx: p.cx + step };
          break;
        case "ArrowUp":
          next = { ...p, cy: p.cy - step };
          break;
        case "ArrowDown":
          next = { ...p, cy: p.cy + step };
          break;
        case "+":
        case "=":
          next = { ...p, w: p.w * 1.06, h: p.h * 1.06 };
          break;
        case "-":
          next = { ...p, w: p.w / 1.06, h: p.h / 1.06 };
          break;
        case "[":
          next = { ...p, rotation: normalizeAngle(p.rotation - 3) };
          break;
        case "]":
          next = { ...p, rotation: normalizeAngle(p.rotation + 3) };
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          onSelect(id);
          return;
        case "Escape":
          onSelect(null);
          return;
        default:
          return;
      }
      event.preventDefault();
      onSelect(id);
      const w = Math.min(format.width * 0.85, Math.max(format.width * 0.06, next.w));
      studioActions.setOverride(id, overrideFromPlacement(clampToCanvas({ ...next, w, h: w / (p.w / p.h) }), format), `key:${id}`);
    },
    [clampToCanvas, findPlacement, format, onSelect],
  );

  const onBackgroundPointerDown = useCallback(() => onSelect(null), [onSelect]);

  // Deselect when the selected stamp moves to another page or disappears.
  useEffect(() => {
    if (selectedId && !findPlacement(selectedId)) onSelect(null);
  }, [findPlacement, onSelect, selectedId]);

  const interaction: CanvasInteraction = {
    selectedId,
    transient,
    unitsPerPx,
    onStampPointerDown,
    onHandlePointerDown,
    onStampKeyDown,
    onBackgroundPointerDown,
  };

  const ratio = format.width / format.height;
  const zoomIndex = ZOOMS.indexOf(zoom);
  const toolButton =
    "inline-flex h-11 min-w-11 lg:h-9 lg:min-w-9 items-center justify-center gap-1.5 rounded-sm px-2 text-sm text-charcoal hover:bg-blush/50 hover:text-burgundy disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

  return (
    <div className="flex min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-line pb-2" role="toolbar" aria-label="Canvas tools">
        <div className="flex items-center">
          <button type="button" className={toolButton} onClick={studioActions.undo} disabled={!history.canUndo} aria-label="Undo" title="Undo (Ctrl/⌘ Z)">
            <Undo2 size={17} aria-hidden="true" />
          </button>
          <button type="button" className={toolButton} onClick={studioActions.redo} disabled={!history.canRedo} aria-label="Redo" title="Redo (Ctrl/⌘ Shift Z)">
            <Redo2 size={17} aria-hidden="true" />
          </button>
          <button type="button" className={`${toolButton} ml-1`} onClick={studioActions.shuffle} disabled={collage.stamps.size < 2} title="New arrangement of the same stamps">
            <Shuffle size={16} aria-hidden="true" />
            <span className={compact ? "sr-only" : ""}>Shuffle</span>
          </button>
        </div>
        <div className="flex items-center">
          <button type="button" className={toolButton} onClick={() => setZoom(ZOOMS[Math.max(0, zoomIndex - 1)])} disabled={zoomIndex <= 0} aria-label="Zoom out">
            <Minus size={16} aria-hidden="true" />
          </button>
          <span className="w-12 text-center font-mono text-xs text-muted" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" className={toolButton} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomIndex + 1)])} disabled={zoomIndex >= ZOOMS.length - 1} aria-label="Zoom in">
            <Plus size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={toolButton}
            onClick={() => {
              setZoom(1);
              scrollRef.current?.scrollTo({ left: 0, top: 0 });
            }}
            aria-label="Reset view"
            title="Reset view"
          >
            <Maximize size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={collage.stamps.size === 0}
            title={collage.stamps.size === 0 ? "Add a stamp first" : "Save or share as PNG"}
            className="ml-1.5 inline-flex h-9 items-center gap-1.5 rounded-sm bg-burgundy px-3 text-sm font-medium text-ivory hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={15} aria-hidden="true" />
            Save
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto overscroll-contain py-3">
        <div
          ref={wrapRef}
          className="mx-auto shadow-[0_24px_50px_-28px_rgba(48,43,46,0.55)]"
          style={{ width: `calc(min(100%, var(--canvas-height) * ${ratio}) * ${zoom})` }}
        >
          <CollageCanvas data={collage} pageIndex={page.index} interaction={interaction} className="block h-auto w-full select-none" />
        </div>
      </div>

      {collage.pages.length > 1 && (
        <nav aria-label="Collage pages" className="flex items-center justify-center gap-1 pt-1">
          {collage.pages.map((p) => (
            <button
              key={p.index}
              type="button"
              onClick={() => onPageChange(p.index)}
              aria-current={p.index === page.index ? "page" : undefined}
              className={`h-8 min-w-8 rounded-sm px-2 font-mono text-xs ${p.index === page.index ? "bg-burgundy text-ivory" : "text-muted hover:bg-blush/50"}`}
            >
              {p.index + 1}
            </button>
          ))}
          <span className="ml-2 text-xs text-muted">
            Page {page.index + 1} of {collage.pages.length}
          </span>
        </nav>
      )}
    </div>
  );
}
