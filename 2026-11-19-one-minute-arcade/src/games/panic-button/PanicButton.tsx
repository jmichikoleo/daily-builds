// src/games/panic-button/PanicButton.tsx
// a ridiculous machine with three gauges and far too many buttons.

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../../engine/types";
import { useFrameRender } from "../../hooks/useGame";
import { levelOf, newMachine, pressReset, stepMachine, type Level, type Machine, type MachineEvent, type SystemId } from "./logic";

const ink = "#2b2340";

const STATUS: Record<SystemId, Record<Level, string>> = {
  heat: { low: "too cold", ok: "cozy", warn: "warm", danger: "HOT!" },
  pressure: { low: "flat", ok: "fine", warn: "tight", danger: "BURSTING" },
  power: { low: "calm", ok: "steady", warn: "buzzy", danger: "SPARKING" },
};

function zoneArcs(id: SystemId) {
  // [from, to, color] in gauge units 0..100
  return id === "power"
    ? ([[0, 55, "#3ccf91"], [55, 85, "#ffc23c"], [85, 100, "#ff5a5f"]] as const)
    : ([[0, 18, "#7cc3ff"], [18, 70, "#3ccf91"], [70, 85, "#ffc23c"], [85, 100, "#ff5a5f"]] as const);
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (v: number) => {
    const a = Math.PI + (v / 100) * Math.PI;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`;
}

function Gauge({ id, label, value, x }: { id: SystemId; label: string; value: number; x: number }) {
  const lv = levelOf(id, value);
  const angle = -90 + value * 1.8;
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x="-62" y="96" width="124" height="104" rx="14" fill="#fffaf2" stroke={ink} strokeWidth="4" />
      {zoneArcs(id).map(([a, b, c]) => (
        <path key={a} d={arcPath(0, 168, 44, a, b)} stroke={c} strokeWidth="12" fill="none" />
      ))}
      <path d={arcPath(0, 168, 51, 0, 100)} stroke={ink} strokeWidth="3" fill="none" />
      <line x1="0" y1="168" x2="0" y2="128" stroke={ink} strokeWidth="5" strokeLinecap="round" style={{ transform: `rotate(${angle}deg)`, transformOrigin: "0px 168px", transition: "transform 60ms linear" }} />
      <circle cx="0" cy="168" r="7" fill={ink} />
      <text x="0" y="116" textAnchor="middle" fontFamily="Silkscreen, monospace" fontSize="13" fill={ink}>
        {label}
      </text>
      <rect x="-50" y="182" width="100" height="22" rx="8" fill={lv === "danger" ? "#ff5a5f" : lv === "warn" ? "#ffc23c" : lv === "low" ? "#7cc3ff" : "#3ccf91"} stroke={ink} strokeWidth="3" />
      <text x="0" y="198" textAnchor="middle" fontFamily="Nunito, sans-serif" fontWeight="900" fontSize="13" fill={ink}>
        {STATUS[id][lv]}
      </text>
    </g>
  );
}

const SILLY = ["do not press", "nope", "why", "fine. it does nothing", "the button is sulking", "stop it", "ok one more", "that was the last one"];

export default function PanicButton({ api }: GameProps) {
  const m = useRef<Machine>(newMachine());
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [silly, setSilly] = useState(0);
  const flash = useRef(0);
  const toastId = useRef(0);

  const say = (text: string) => setToast({ id: ++toastId.current, text });

  const handle = (events: MachineEvent[]) => {
    for (const e of events) {
      if (e.type === "points") {
        api.addScore(e.amount);
        if (e.reason === "recovery") {
          api.sfx("bigPoint");
          say("phew. saved it +25");
        } else if (e.reason === "streak") {
          api.sfx("point");
          say("perfect streak +25");
        }
      } else if (e.type === "meltdown") {
        api.sfx("splash");
        api.sfx("wrong");
        flash.current = 1;
        say("KA-BLOOEY. rebooting...");
      } else if (e.type === "gremlin") {
        api.sfx("warning");
        say(e.system === "heat" ? "a gremlin lit a candle" : e.system === "pressure" ? "someone sat on a pipe" : "a squirrel bit a wire");
      } else if (e.type === "reset") {
        api.sfx("pop");
      } else if (e.type === "resetFizzle") {
        api.sfx("wrong");
      }
    }
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  const bump = useFrameRender(
    api,
    (f) => {
      handleRef.current(stepMachine(m.current, f.dt, f.progress, f.urgent));
      flash.current = Math.max(0, flash.current - f.dt);
    },
    24,
  );

  // controls
  const setCooling = (on: boolean) => {
    if (!api.isActive() && on) return;
    const next = on && m.current.rebooting <= 0;
    if (next === m.current.cooling) return;
    m.current.cooling = next;
    bump();
  };
  const toggleValve = () => {
    if (!api.isActive() || m.current.rebooting > 0) return;
    m.current.valveOpen = !m.current.valveOpen;
    api.sfx("click");
    bump();
  };
  const reset = () => {
    if (!api.isActive()) return;
    handleRef.current([pressReset(m.current)]);
    bump();
  };
  const controls = useRef({ setCooling, toggleValve, reset });
  controls.current = { setCooling, toggleValve, reset };

  useEffect(() => {
    const offs = [
      api.listen("keydown", (e) => {
        if (e.repeat) {
          if (e.key.toLowerCase() === "q") e.preventDefault();
          return;
        }
        const k = e.key.toLowerCase();
        if (k === "q") controls.current.setCooling(true);
        else if (k === "w") controls.current.toggleValve();
        else if (k === "e") controls.current.reset();
        else return;
        e.preventDefault();
      }),
      api.listen("keyup", (e) => {
        if (e.key.toLowerCase() === "q") controls.current.setCooling(false);
      }),
      api.listen("blur", () => controls.current.setCooling(false)),
      api.listen("pointerup", () => controls.current.setCooling(false)),
    ];
    return () => offs.forEach((o) => o());
  }, [api]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), 1400);
    return () => clearTimeout(t);
  }, [toast]);

  const s = m.current;
  const danger = (["heat", "pressure", "power"] as SystemId[]).filter((id) => levelOf(id, s[id]) === "danger").length;
  const rebooting = s.rebooting > 0;
  const shake = !api.reducedMotion && (danger > 0 || rebooting);
  const eye = rebooting ? "x" : danger >= 2 ? "panic" : danger === 1 ? "worried" : "calm";

  return (
    <div className="game-fill panic" data-testid="panic">
      <div className="panic-machine-wrap">
        <svg viewBox="0 0 520 290" className={`panic-machine ${shake ? "is-shaking" : ""}`} role="img" aria-label={`machine. heat ${STATUS.heat[levelOf("heat", s.heat)]}, pressure ${STATUS.pressure[levelOf("pressure", s.pressure)]}, power ${STATUS.power[levelOf("power", s.power)]}`}>
          {/* pipes */}
          <path d="M0 140h40M480 120h40M470 60v-40h30" stroke={ink} strokeWidth="14" fill="none" />
          <path d="M0 140h40M480 120h40M470 60v-40h30" stroke="#9aa9b8" strokeWidth="8" fill="none" />
          {/* chimney */}
          <rect x="410" y="10" width="44" height="60" fill="#c9b6a0" stroke={ink} strokeWidth="4" />
          {s.valveOpen &&
            [0, 1, 2].map((i) => <circle key={i} className="steam" cx={432 + (i - 1) * 10} cy={0} r={12 + i * 3} fill="#fff" stroke={ink} strokeWidth="2.5" style={{ animationDelay: `${i * 0.18}s` }} />)}
          {/* body */}
          <rect x="40" y="54" width="440" height="226" rx="26" fill={rebooting ? "#c7c0d6" : "#9ad7c8"} stroke={ink} strokeWidth="5" />
          {[60, 460].flatMap((x) => [76, 258].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="5" fill={ink} />))}
          {/* eyes */}
          <g transform="translate(260 76)">
            {[-30, 30].map((dx) => (
              <g key={dx} transform={`translate(${dx} 0)`}>
                <circle r="13" fill="#fff" stroke={ink} strokeWidth="3.5" />
                {eye === "x" ? (
                  <path d="M-6 -6l12 12M6 -6l-12 12" stroke={ink} strokeWidth="3.5" />
                ) : (
                  <circle r={eye === "panic" ? 3 : 5.5} cx={eye === "worried" ? 3 : 0} cy={eye === "calm" ? 2 : -2} fill={ink} />
                )}
              </g>
            ))}
          </g>
          {/* lights */}
          {[0, 1, 2, 3, 4].map((i) => (
            <circle
              key={i}
              cx={110 + i * 22}
              cy="76"
              r="7"
              className={danger > 0 || rebooting ? "blink" : ""}
              style={{ animationDelay: `${i * 0.12}s` }}
              fill={["#ff5a5f", "#ffc23c", "#3ccf91", "#4aa8ff", "#ff8fc7"][i]}
              stroke={ink}
              strokeWidth="2.5"
            />
          ))}
          {[0, 1, 2].map((i) => (
            <rect key={i} x={340 + i * 22} y="68" width="14" height="16" rx="3" fill={i === 1 ? "#ffc23c" : "#fffaf2"} stroke={ink} strokeWidth="2.5" />
          ))}
          <Gauge id="heat" label="heat" value={s.heat} x={125} />
          <Gauge id="pressure" label="pressure" value={s.pressure} x={260} />
          <Gauge id="power" label="power" value={s.power} x={395} />
          <text x="260" y="226" textAnchor="middle" fontFamily="Silkscreen, monospace" fontSize="11" fill={ink} opacity="0.6">
            model 9000. probably safe
          </text>
          {s.greenFor > 0 && !rebooting && (
            <text x="260" y="258" textAnchor="middle" fontFamily="Silkscreen, monospace" fontSize="15" fill={ink}>
              all green {Math.floor(s.greenFor)}s
            </text>
          )}
          {rebooting && (
            <text x="260" y="260" textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize="22" fill="#ff5a5f" stroke={ink} strokeWidth="1.5">
              REBOOTING
            </text>
          )}
        </svg>
        {flash.current > 0 && !api.reducedMotion && <div className="panic-flash" style={{ opacity: flash.current }} />}
        {toast && (
          <div key={toast.id} className="panic-toast" role="status">
            {toast.text}
          </div>
        )}
      </div>

      <div className="panic-controls">
        <button
          type="button"
          className={`btn btn-sky panic-btn ${s.cooling ? "is-pressed" : ""}`}
          aria-pressed={s.cooling}
          aria-label="cool. hold to lower heat. key q"
          onPointerDown={(e) => {
            e.preventDefault();
            setCooling(true);
          }}
          onPointerUp={() => setCooling(false)}
          onPointerLeave={() => setCooling(false)}
          onPointerCancel={() => setCooling(false)}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              setCooling(true);
            }
          }}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") setCooling(false);
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="panic-icon" aria-hidden="true">❄</span>
          <span>hold to cool</span>
          <kbd>q</kbd>
        </button>
        <button
          type="button"
          className={`btn ${s.valveOpen ? "btn-mint is-pressed" : "btn-paper"} panic-btn`}
          aria-pressed={s.valveOpen}
          aria-label={`pressure valve ${s.valveOpen ? "open" : "closed"}. key w`}
          onClick={toggleValve}
        >
          <span className="panic-icon" aria-hidden="true">{s.valveOpen ? "◎" : "⊗"}</span>
          <span>valve {s.valveOpen ? "open" : "shut"}</span>
          <kbd>w</kbd>
        </button>
        <button
          type="button"
          className={`btn btn-sun panic-btn ${s.resetLock > 0 ? "is-locked" : ""}`}
          aria-label="reset the power. key e"
          onClick={reset}
        >
          <span className="panic-icon" aria-hidden="true">⚡</span>
          <span>{s.resetLock > 0 ? "charging" : "reset power"}</span>
          <kbd>e</kbd>
        </button>
        <button
          type="button"
          className="btn btn-tomato panic-silly"
          onClick={() => {
            setSilly((n) => n + 1);
            say(SILLY[Math.min(SILLY.length - 1, silly + 1)]);
          }}
          aria-label="a button that does nothing"
        >
          {SILLY[Math.min(silly, SILLY.length - 1)]}
        </button>
      </div>
    </div>
  );
}
