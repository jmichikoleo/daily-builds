// src/components/SessionOverlays.tsx
// everything the engine draws on top of a game. the hud bar, ready card,
// countdown, pause menu, time's up banner and the results card.

import { useEffect, useRef } from "react";
import type { Hud as HudStore } from "../engine/hud";
import { useHud } from "../engine/hud";
import { formatTime, type Phase } from "../engine/session";
import type { GameDefinition } from "../engine/types";
import type { ResultInfo } from "../engine/GameHost";
import { Button } from "./ui";

export function Hud({
  hud,
  game,
  phase,
  onPause,
  onResume,
  onExit,
}: {
  hud: HudStore;
  game: GameDefinition;
  phase: Phase;
  onPause(): void;
  onResume(): void;
  onExit(): void;
}) {
  const h = useHud(hud);
  const pct = (h.remainingMs / 60000) * 100;
  return (
    <div className="hud">
      <Button tone="paper" size="sm" onClick={onExit} aria-label="back to the arcade">
        <span aria-hidden="true">←</span>
        <span className="hide-narrow">arcade</span>
      </Button>
      <div className="hud-title" aria-hidden="true">
        {game.title}
      </div>
      <div className="hud-score" aria-live="off">
        <span className="hud-label">score</span>
        <span className="hud-value" data-testid="score">
          {h.score}
        </span>
        {h.pop && (
          <span key={h.pop.id} className={`hud-pop ${h.pop.delta < 0 ? "is-neg" : ""}`} aria-hidden="true">
            {h.pop.delta > 0 ? `+${h.pop.delta}` : h.pop.delta}
          </span>
        )}
      </div>
      <div className={`hud-timer ${h.urgent ? "is-urgent" : ""}`} role="timer" aria-label={`${Math.ceil(h.remainingMs / 1000)} seconds left`}>
        <span data-testid="timer">{formatTime(h.remainingMs)}</span>
        <span className="hud-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      </div>
      {phase === "paused" ? (
        <Button tone="mint" size="sm" onClick={onResume} aria-label="resume">
          ▶
        </Button>
      ) : (
        <Button tone="paper" size="sm" onClick={onPause} disabled={phase !== "playing"} aria-label="pause">
          ❚❚
        </Button>
      )}
    </div>
  );
}

function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

export function ReadyOverlay({ game, onStart }: { game: GameDefinition; onStart(): void }) {
  const start = useAutoFocus<HTMLButtonElement>();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="ready-title">
      <div className="overlay-card cart-in">
        <p className="eyebrow">sixty seconds of</p>
        <h1 id="ready-title" className="display text-3xl sm:text-4xl">
          {game.title}
        </h1>
        <p className="mt-2 text-lg font-bold">{game.objective}</p>
        <div className="mt-4 grid gap-3 text-left sm:grid-cols-2">
          <div className="info-box">
            <h2 className="eyebrow">controls</h2>
            <ul>
              {game.controls.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div className="info-box">
            <h2 className="eyebrow">points</h2>
            <ul>
              {game.scoring.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="tip">tip. {game.tip}</p>
        <button ref={start} type="button" className="btn btn-tomato btn-lg mt-4 w-full" onClick={onStart}>
          start
        </button>
        <p className="mt-2 text-sm opacity-70">esc or p pauses</p>
      </div>
    </div>
  );
}

export function CountdownOverlay({ hud }: { hud: HudStore }) {
  const { countdown } = useHud(hud);
  return (
    <div className="overlay overlay-clear" aria-live="assertive">
      {countdown && (
        <div key={countdown} className={`countdown ${countdown === "GO!" ? "is-go" : ""}`} data-testid="countdown">
          {countdown === "GO!" ? countdown : `${countdown}...`}
        </div>
      )}
    </div>
  );
}

export function PauseOverlay({ onResume, onRestart, onExit }: { onResume(): void; onRestart(): void; onExit(): void }) {
  const ref = useAutoFocus<HTMLButtonElement>();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="overlay-card">
        <h2 id="pause-title" className="display text-3xl">
          paused
        </h2>
        <p className="mt-1">the clock is frozen. nobody is moving. not even the stars.</p>
        <div className="mt-4 grid gap-2">
          <button ref={ref} type="button" className="btn btn-mint btn-lg" onClick={onResume}>
            resume
          </button>
          <Button tone="sun" onClick={onRestart}>
            restart
          </Button>
          <Button tone="paper" onClick={onExit}>
            back to arcade
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TimesUpOverlay() {
  return (
    <div className="overlay overlay-clear" role="status">
      <div className="times-up">TIME'S UP</div>
    </div>
  );
}

const CONFETTI_COLORS = ["#ff5a5f", "#ffc23c", "#3ccf91", "#4aa8ff", "#8b5cf6", "#ff8fc7"];

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 9) * 0.08}s`,
            animationDuration: `${1.6 + (i % 5) * 0.25}s`,
            transform: `rotate(${i * 29}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function ResultsOverlay({
  game,
  result,
  reducedMotion,
  onAgain,
  onRandom,
  onExit,
}: {
  game: GameDefinition;
  result: ResultInfo;
  reducedMotion: boolean;
  onAgain(): void;
  onRandom(): void;
  onExit(): void;
}) {
  const again = useAutoFocus<HTMLButtonElement>();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="results-title" data-testid="results">
      {result.isNewBest && !reducedMotion && <Confetti />}
      <div className="overlay-card cart-in">
        <p className="eyebrow">{game.title}</p>
        <h2 id="results-title" className="sr-only">
          results
        </h2>
        <div className="result-score" data-testid="final-score">
          {result.score}
        </div>
        {result.isNewBest ? (
          <p className="new-best" data-testid="new-best">
            new personal best
          </p>
        ) : (
          <p className="font-bold">personal best {result.best}</p>
        )}
        <p className="result-message">{result.message}</p>
        <div className="mt-5 grid gap-2">
          <button ref={again} type="button" className="btn btn-tomato btn-lg" onClick={onAgain}>
            play again
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Button tone="grape" onClick={onRandom}>
              random game
            </Button>
            <Button tone="paper" onClick={onExit}>
              back to arcade
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
