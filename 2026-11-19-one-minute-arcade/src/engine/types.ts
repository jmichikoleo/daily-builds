// src/engine/types.ts
// the contract between the shared engine and every game.

import type { ComponentType } from "react";
import type { SfxName } from "../audio/sfx";

export interface Frame {
  /** seconds since last frame, capped so physics never jumps */
  dt: number;
  /** seconds of active play so far, 0..60 */
  t: number;
  /** seconds left */
  remaining: number;
  /** 0..1 through the minute */
  progress: number;
  /** true in the final ten seconds */
  urgent: boolean;
}

export interface GameApi {
  /** subscribe to the engine's single animation loop. only called while playing */
  onFrame(cb: (f: Frame) => void): () => void;
  /** add (or remove) points. returns the new score */
  addScore(delta: number): number;
  getScore(): number;
  /** true only while the clock is running. ignore input otherwise */
  isActive(): boolean;
  /** play a short sound if sound is on */
  sfx(name: SfxName): void;
  /** add a window listener. returns a remover, and the engine also removes it when the run ends */
  listen<K extends keyof WindowEventMap>(type: K, handler: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions): () => void;
  reducedMotion: boolean;
}

export interface GameProps {
  api: GameApi;
}

export type Difficulty = 1 | 2 | 3;

export interface GameTheme {
  /** main background of the stage */
  bg: string;
  /** card accent */
  accent: string;
  /** readable text on the accent */
  ink: string;
}

export interface ScoringInfo {
  /** short lines shown on the ready screen */
  rules: string[];
  /** scores at or above these count as "good" and "great" for result messages */
  good: number;
  great: number;
}

export interface GameDefinition {
  id: string;
  title: string;
  description: string;
  objective: string;
  controls: string[];
  tip: string;
  difficulty: Difficulty;
  theme: GameTheme;
  scoring: ScoringInfo;
  messages: { low: string[]; mid: string[]; high: string[] };
  Thumbnail: ComponentType;
  Component: ComponentType<GameProps>;
}
