// src/games/garden-emergency/GardenEmergency.tsx
// a cozy garden that slowly turns into a small emergency.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { GameProps } from "../../engine/types";
import { useFrameRender } from "../../hooks/useGame";
import { COLS, PLOTS, TOOLS, applyTool, newGarden, stepGarden, toolFor, type Garden, type PlotState, type Tool } from "./logic";

const ink = "#2b2340";

const TOOL_INFO: Record<Tool, { label: string; key: string; glyph: string; tone: string }> = {
  water: { label: "watering can", key: "1", glyph: "💧", tone: "btn-sky" },
  glove: { label: "glove", key: "2", glyph: "🧤", tone: "btn-mint" },
  sun: { label: "sunshine", key: "3", glyph: "☀", tone: "btn-sun" },
};

function Plant({ s }: { s: PlotState }) {
  switch (s.kind) {
    case "empty":
      return (
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <path d="M28 60q12-8 24 0" stroke="#7b5636" strokeWidth="3" fill="none" />
        </svg>
      );
    case "sprout":
      return (
        <svg viewBox="0 0 80 80" aria-hidden="true" className="sway">
          <path d="M40 64V40" stroke="#3c9a4a" strokeWidth="4" strokeLinecap="round" />
          <path d="M40 46c-10 0-14-8-14-8s8-4 14 4M40 42c10 0 14-8 14-8s-8-4-14 4" fill="#6cc24a" stroke={ink} strokeWidth="2.5" />
        </svg>
      );
    case "thirsty":
      return (
        <svg viewBox="0 0 80 80" aria-hidden="true" className="droop">
          <path d="M40 64V44q0-6 8-10" stroke="#9aa65a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M48 36c-6 6-14 4-14 4s2-8 12-6" fill="#c7c46a" stroke={ink} strokeWidth="2.5" />
          <path d="M60 14c0 6-5 9-5 9s-5-3-5-9 5-10 5-10 5 4 5 10z" fill="#4aa8ff" stroke={ink} strokeWidth="2.2" />
          <text x="18" y="26" fontFamily="Bungee, sans-serif" fontSize="16" fill={ink}>!</text>
        </svg>
      );
    case "bud":
      return (
        <svg viewBox="0 0 80 80" aria-hidden="true" className="sway">
          <path d="M40 64V30" stroke="#3c9a4a" strokeWidth="4" strokeLinecap="round" />
          <path d="M40 50c-10 0-14-8-14-8s8-4 14 4" fill="#6cc24a" stroke={ink} strokeWidth="2.5" />
          <ellipse cx="40" cy="24" rx="9" ry="12" fill="#ff8fc7" stroke={ink} strokeWidth="2.5" />
          <path d="M33 30l7-6 7 6" fill="#6cc24a" stroke={ink} strokeWidth="2.2" />
          <circle cx="62" cy="14" r="7" fill="#ffc23c" stroke={ink} strokeWidth="2" strokeDasharray="3 2" />
        </svg>
      );
    case "bloom":
      return (
        <svg viewBox="0 0 80 80" aria-hidden="true" className="bloom-pop">
          <path d="M40 64V36" stroke="#3c9a4a" strokeWidth="4" strokeLinecap="round" />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="40" cy="16" rx="8" ry="12" fill="#ff8fc7" stroke={ink} strokeWidth="2.2" transform={`rotate(${a} 40 28)`} />
          ))}
          <circle cx="40" cy="28" r="7" fill="#ffc23c" stroke={ink} strokeWidth="2.5" />
        </svg>
      );
    case "weed":
      return (
        <svg viewBox="0 0 80 80" aria-hidden="true" className="wiggle-weed">
          <path d="M40 64L34 30M40 64l10-30M40 64L22 40M40 64l20-18" stroke="#557a2a" strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle cx="34" cy="28" r="5" fill="#8a6bbf" stroke={ink} strokeWidth="2" />
          <circle cx="50" cy="32" r="5" fill="#8a6bbf" stroke={ink} strokeWidth="2" />
          <circle cx="31" cy="27" r="1.4" fill="#fff" />
          <circle cx="37" cy="27" r="1.4" fill="#fff" />
          <path d="M31 31q3-2 6 0" stroke="#fff" strokeWidth="1.4" fill="none" />
        </svg>
      );
    case "wilted":
      return (
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <path d="M40 64V50q0-8-12-12" stroke="#8b7a5a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M28 38c-6 0-8 6-8 6s6 2 8-6" fill="#a58f6a" stroke={ink} strokeWidth="2" />
        </svg>
      );
  }
}

function describe(s: PlotState): string {
  switch (s.kind) {
    case "empty":
      return "bare soil";
    case "sprout":
      return "a happy sprout";
    case "thirsty":
      return "thirsty plant, needs water";
    case "bud":
      return "flower bud, needs sunshine";
    case "bloom":
      return "a bloomed flower";
    case "weed":
      return "weed, needs pulling";
    case "wilted":
      return "wilted plant";
  }
}

function urgency(s: PlotState): number {
  if (s.kind === "thirsty") return s.t / s.limit;
  if (s.kind === "bud") return s.t / s.limit;
  return 0;
}

export default function GardenEmergency({ api }: GameProps) {
  const g = useRef<Garden>(newGarden());
  const [tool, setTool] = useState<Tool>("water");
  const [focusIdx, setFocusIdx] = useState(0);
  const [feedback, setFeedback] = useState<{ i: number; text: string; id: number; good: boolean } | null>(null);
  const fid = useRef(0);
  const plotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const toolRef = useRef(tool);
  toolRef.current = tool;

  const bump = useFrameRender(
    api,
    (f) => {
      for (const e of stepGarden(g.current, f.dt, f.progress, f.urgent)) {
        if (e.type === "wilt") api.sfx("wrong");
        if (e.type === "need" && e.kind === "weed") api.sfx("pop");
      }
    },
    12,
  );

  const use = useCallback(
    (i: number, t: Tool = toolRef.current) => {
      if (!api.isActive()) return;
      const pts = applyTool(g.current, i, t);
      if (pts === null) {
        api.sfx("wrong");
        setFeedback({ i, text: toolFor(g.current.plots[i]) ? `try the ${TOOL_INFO[toolFor(g.current.plots[i])!].label}` : "nope", id: ++fid.current, good: false });
      } else {
        api.addScore(pts);
        api.sfx(pts >= 20 ? "bigPoint" : "point");
        setFeedback({ i, text: `+${pts}`, id: ++fid.current, good: true });
      }
      bump();
    },
    [api, bump],
  );

  useEffect(() => {
    return api.listen("keydown", (e) => {
      const t = TOOLS.find((x) => TOOL_INFO[x].key === e.key);
      if (t) {
        e.preventDefault();
        setTool(t);
        api.sfx("click");
      }
    });
  }, [api]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback((f) => (f?.id === feedback.id ? null : f)), 700);
    return () => clearTimeout(t);
  }, [feedback]);

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS };
    const d = moves[e.key];
    if (d === undefined) return;
    e.preventDefault();
    let n = focusIdx + d;
    if (n < 0 || n >= PLOTS) return;
    if ((d === 1 && n % COLS === 0) || (d === -1 && focusIdx % COLS === 0)) return;
    setFocusIdx(n);
    plotRefs.current[n]?.focus();
  };

  const garden = g.current;
  return (
    <div className="game-fill garden">
      <div className="garden-sky" aria-hidden="true">
        <span className="butterfly b1">🦋</span>
        <span className="butterfly b2">🦋</span>
      </div>
      <div className="garden-tools" role="toolbar" aria-label="tools">
        {TOOLS.map((t) => (
          <button
            key={t}
            type="button"
            className={`btn ${TOOL_INFO[t].tone} garden-tool ${tool === t ? "is-pressed is-selected" : ""}`}
            aria-pressed={tool === t}
            onClick={() => {
              setTool(t);
              api.sfx("click");
            }}
            data-testid={`tool-${t}`}
          >
            <span aria-hidden="true" className="text-xl">
              {TOOL_INFO[t].glyph}
            </span>
            <span>{TOOL_INFO[t].label}</span>
            <kbd>{TOOL_INFO[t].key}</kbd>
          </button>
        ))}
      </div>
      <div className="garden-grid" role="group" aria-label="garden plots. arrow keys move between plots" onKeyDown={onGridKey} data-tool={tool}>
        {garden.plots.map((s, i) => {
          const u = urgency(s);
          const need = toolFor(s);
          return (
            <button
              key={i}
              ref={(el) => {
                plotRefs.current[i] = el;
              }}
              type="button"
              tabIndex={i === focusIdx ? 0 : -1}
              className={`plot plot-${s.kind} ${need && need === tool ? "plot-match" : ""}`}
              aria-label={`plot ${i + 1}, ${describe(s)}`}
              data-testid={`plot-${i}`}
              data-kind={s.kind}
              onFocus={() => setFocusIdx(i)}
              onPointerDown={(e) => {
                e.preventDefault();
                setFocusIdx(i);
                use(i);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  use(i);
                }
              }}
            >
              {u > 0 && <span className="plot-timer" style={{ ["--u" as string]: u }} aria-hidden="true" />}
              <Plant s={s} />
              {need && (
                <span className="plot-need" aria-hidden="true">
                  {TOOL_INFO[need].glyph}
                </span>
              )}
              {feedback?.i === i && (
                <span key={feedback.id} className={`plot-float ${feedback.good ? "" : "is-bad"}`} aria-hidden="true">
                  {feedback.text}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="garden-stats" aria-live="off">
        {garden.blooms} bloomed, {garden.saves} saved, {garden.weedsPulled} weeds pulled, {garden.wilted} wilted
      </p>
    </div>
  );
}
