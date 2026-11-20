// src/engine/GameHost.tsx
// the shared session engine. it owns the lifecycle, the single animation loop,
// the 60 second clock, pause and resume, scoring, results and records.
// games plug in through the GameApi and never run their own timers.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playSfx, unlockAudio, type SfxName } from "../audio/sfx";
import { useStore } from "../app/store";
import { SessionClock } from "./clock";
import { debug } from "./debug";
import { createHud, type Hud } from "./hud";
import { COUNTDOWN_TOTAL_MS, URGENT_MS, applyScore, countdownLabel, isUrgent, nextPhase, type Phase, type SessionEvent } from "./session";
import type { Frame, GameApi, GameDefinition } from "./types";
import { Hud as HudBar, CountdownOverlay, PauseOverlay, ReadyOverlay, ResultsOverlay, TimesUpOverlay } from "../components/SessionOverlays";

export interface ResultInfo {
  score: number;
  best: number;
  previousBest: number;
  isNewBest: boolean;
  message: string;
}

interface Props {
  game: GameDefinition;
  onExit(): void;
  onRandom(): void;
}

const TIMES_UP_MS = 1300;

export function pickMessage(game: GameDefinition, score: number, rng: () => number = Math.random) {
  const tier = score >= game.scoring.great ? "high" : score >= game.scoring.good ? "mid" : "low";
  const list = game.messages[tier];
  return list[Math.floor(rng() * list.length) % list.length];
}

const GameSlot = memo(function GameSlot({ game, api }: { game: GameDefinition; api: GameApi }) {
  const C = game.Component;
  return <C api={api} />;
});

export function GameHost({ game, onExit, onRandom }: Props) {
  const { commitResult, reducedMotion } = useStore();
  const [phase, setPhase] = useState<Phase>("ready");
  const [runId, setRunId] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [result, setResult] = useState<ResultInfo | null>(null);

  const phaseRef = useRef<Phase>("ready");
  const clock = useRef(new SessionClock());
  const score = useRef(0);
  const subs = useRef(new Set<(f: Frame) => void>());
  const countdownStart = useRef(0);
  const finishedAt = useRef(0);
  const lastLabel = useRef<string | null>(null);
  const lastWholeSecond = useRef(60);
  const popId = useRef(0);
  const showResultsRef = useRef(false);
  const runDisposers = useRef<(() => void)[]>([]);
  const hud = useRef<Hud>(createHud({ score: 0, remainingMs: 60000, urgent: false, countdown: null, pop: null })).current;

  const send = useCallback((event: SessionEvent) => {
    const next = nextPhase(phaseRef.current, event);
    if (next === phaseRef.current) return false;
    phaseRef.current = next;
    debug.phase = next;
    setPhase(next);
    return true;
  }, []);

  const sfx = useCallback((name: SfxName) => playSfx(name), []);

  // one api object per run. a fresh run means fresh listeners and fresh game state
  const api = useMemo<GameApi>(() => {
    void runId;
    return {
      onFrame(cb) {
        subs.current.add(cb);
        return () => {
          subs.current.delete(cb);
        };
      },
      addScore(delta) {
        if (phaseRef.current !== "playing") return score.current;
        score.current = applyScore(score.current, delta);
        debug.score = score.current;
        hud.set({ score: score.current, pop: delta !== 0 ? { id: ++popId.current, delta } : hud.get().pop });
        return score.current;
      },
      getScore: () => score.current,
      isActive: () => phaseRef.current === "playing",
      sfx,
      listen(type, handler, opts) {
        let live = true;
        window.addEventListener(type, handler as EventListener, opts);
        debug.listeners++;
        const off = () => {
          if (!live) return;
          live = false;
          window.removeEventListener(type, handler as EventListener, opts);
          debug.listeners--;
        };
        runDisposers.current.push(off);
        return off;
      },
      reducedMotion,
    };
    // reducedMotion is read once per run on purpose
  }, [runId, hud, sfx]);

  useEffect(() => {
    return () => {
      runDisposers.current.forEach((d) => d());
      runDisposers.current = [];
      subs.current.clear();
    };
  }, [runId]);

  const finish = useCallback(
    (now: number) => {
      if (!send({ type: "timeUp" })) return;
      finishedAt.current = now;
      hud.set({ remainingMs: 0, urgent: false });
      playSfx("finish");
      const s = score.current;
      const saved = commitResult(game.id, s, clock.current.elapsedMs);
      setResult({ score: s, best: saved.best, previousBest: saved.previousBest, isNewBest: saved.isNewBest, message: pickMessage(game, s) });
      if (saved.isNewBest) window.setTimeout(() => playSfx("record"), 500);
    },
    [commitResult, game, hud, send],
  );

  // the single animation loop for this session
  useEffect(() => {
    let raf = 0;
    debug.loops++;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const p = phaseRef.current;
      if (p === "countdown") {
        const ms = now - countdownStart.current;
        const label = countdownLabel(Math.max(0, ms));
        if (label !== lastLabel.current) {
          lastLabel.current = label;
          hud.set({ countdown: label });
          if (label) playSfx(label === "GO!" ? "go" : "tick");
        }
        if (ms >= COUNTDOWN_TOTAL_MS) {
          clock.current.start(now);
          send({ type: "countdownDone" });
        }
      } else if (p === "playing") {
        const tick = clock.current.tick(now);
        const frame: Frame = {
          dt: tick.dt,
          t: tick.elapsedMs / 1000,
          remaining: tick.remainingMs / 1000,
          progress: tick.elapsedMs / clock.current.duration,
          urgent: isUrgent(tick.remainingMs),
        };
        if (tick.dt > 0) subs.current.forEach((cb) => cb(frame));
        const whole = Math.ceil(tick.remainingMs / 1000);
        if (whole !== lastWholeSecond.current) {
          lastWholeSecond.current = whole;
          if (whole === URGENT_MS / 1000) playSfx("warning");
          else if (whole > 0 && whole <= 3) playSfx("tick");
        }
        const h = hud.get();
        if (Math.ceil(h.remainingMs / 100) !== Math.ceil(tick.remainingMs / 100)) hud.set({ remainingMs: tick.remainingMs, urgent: frame.urgent });
        if (tick.done) finish(now);
      } else if (p === "finished" && !showResultsRef.current && now - finishedAt.current > TIMES_UP_MS) {
        showResultsRef.current = true;
        setShowResults(true);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      debug.loops--;
    };
  }, [finish, hud, send]);

  const begin = useCallback(() => {
    unlockAudio();
    playSfx("click");
    if (phaseRef.current !== "ready") return;
    countdownStart.current = performance.now();
    lastLabel.current = "3";
    hud.set({ countdown: "3" });
    playSfx("tick");
    send({ type: "start" });
  }, [hud, send]);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    clock.current.pause();
    send({ type: "pause" });
  }, [send]);

  const resume = useCallback(() => {
    unlockAudio();
    if (phaseRef.current !== "paused") return;
    clock.current.resume(performance.now());
    send({ type: "resume" });
  }, [send]);

  const resetRun = useCallback(() => {
    clock.current = new SessionClock();
    score.current = 0;
    debug.score = 0;
    lastWholeSecond.current = 60;
    showResultsRef.current = false;
    setShowResults(false);
    setResult(null);
    hud.set({ score: 0, remainingMs: 60000, urgent: false, countdown: null, pop: null });
    phaseRef.current = "ready";
    setPhase("ready");
    setRunId((r) => r + 1);
  }, [hud]);

  const playAgain = useCallback(() => {
    resetRun();
    // go straight into the countdown on replay
    countdownStart.current = performance.now();
    lastLabel.current = "3";
    hud.set({ countdown: "3" });
    phaseRef.current = "countdown";
    debug.phase = "countdown";
    setPhase("countdown");
    unlockAudio();
    playSfx("tick");
  }, [hud, resetRun]);

  // keyboard shortcuts and auto pause when the tab or window loses focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if ((e.key === "Escape" || e.key === "p" || e.key === "P") && (p === "playing" || p === "paused")) {
        e.preventDefault();
        if (p === "playing") pause();
        else resume();
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") pause();
    };
    const onBlur = () => pause();
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    debug.listeners += 3;
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onBlur);
      debug.listeners -= 3;
    };
  }, [pause, resume]);

  // no page scrolling or rubber banding while a game is on screen
  useEffect(() => {
    document.body.classList.add("is-playing");
    return () => document.body.classList.remove("is-playing");
  }, []);

  // a new game in the same host starts from scratch
  useEffect(() => {
    debug.phase = "ready";
    return () => {
      debug.phase = "none";
    };
  }, [game.id]);

  return (
    <div
      className="game-host"
      data-phase={phase}
      data-game={game.id}
      style={{ ["--game-bg" as string]: game.theme.bg, ["--game-accent" as string]: game.theme.accent, ["--game-ink" as string]: game.theme.ink }}
    >
      <HudBar hud={hud} game={game} phase={phase} onPause={pause} onResume={resume} onExit={onExit} />
      <div className="game-stage" aria-label={`${game.title} play area`}>
        <GameSlot key={runId} game={game} api={api} />
        {phase === "ready" && <ReadyOverlay game={game} onStart={begin} />}
        {phase === "countdown" && <CountdownOverlay hud={hud} />}
        {phase === "paused" && <PauseOverlay onResume={resume} onRestart={playAgain} onExit={onExit} />}
        {phase === "finished" && !showResults && <TimesUpOverlay />}
        {phase === "finished" && showResults && result && (
          <ResultsOverlay game={game} result={result} reducedMotion={reducedMotion} onAgain={playAgain} onRandom={onRandom} onExit={onExit} />
        )}
      </div>
    </div>
  );
}
