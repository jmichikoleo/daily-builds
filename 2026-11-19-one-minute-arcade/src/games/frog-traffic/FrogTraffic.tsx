// src/games/frog-traffic/FrogTraffic.tsx
// a tiny frog, a busy pond and a lot of lily pads with somewhere to be.

import { useCallback, useEffect, useRef } from "react";
import { StageCanvas, burst, drawFloats, drawParticles, stepFloats, stepParticles, type FloatText, type Particle, type StageCanvasHandle } from "../../engine/canvas";
import type { GameProps } from "../../engine/types";
import {
  FROG_R,
  H,
  HOP_TIME,
  HOP_X,
  POINTS,
  ROWS,
  ROW_H,
  W,
  crossingBonus,
  makeLanes,
  padAt,
  padLefts,
  rowY,
  sinkState,
  type Lane,
} from "./logic";

type Dir = "up" | "down" | "left" | "right";

interface Frog {
  row: number;
  x: number;
  hop: { fromX: number; fromRow: number; toX: number; toRow: number; t: number } | null;
  falling: number; // seconds of splash left
  facing: Dir;
  bestRow: number;
}

interface World {
  lanes: Lane[];
  level: number;
  frog: Frog;
  particles: Particle[];
  floats: FloatText[];
  t: number;
  celebrate: number;
  speedMul: number;
}

const startFrog = (): Frog => ({ row: 0, x: W / 2, hop: null, falling: 0, facing: "up", bestRow: 0 });

function makeWorld(): World {
  return { lanes: makeLanes(1, Math.random), level: 1, frog: startFrog(), particles: [], floats: [], t: 0, celebrate: 0, speedMul: 1 };
}

const ink = "#2b2340";

function drawPad(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, state: 0 | 1 | 2, t: number) {
  if (state === 2) {
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + len / 2, y, len / 2.2, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const bob = state === 1 ? Math.sin(t * 30) * 2 : 0;
  ctx.save();
  ctx.translate(0, bob);
  ctx.fillStyle = state === 1 ? "#a6d28a" : "#4fae5a";
  ctx.beginPath();
  ctx.ellipse(x + len / 2, y, len / 2, ROW_H * 0.3, 0, 0.25, Math.PI * 2 - 0.25);
  ctx.lineTo(x + len / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.strokeStyle = "rgba(43,35,64,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + len * 0.25, y - 4);
  ctx.lineTo(x + len * 0.45, y);
  ctx.moveTo(x + len * 0.3, y + 8);
  ctx.lineTo(x + len * 0.45, y + 2);
  ctx.stroke();
  if (state === 1) {
    // bubbles warn that this pad is about to dive
    ctx.fillStyle = "#e6fbff";
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const bx = x + len * (0.3 + i * 0.2);
      const by = y - 16 - ((t * 40 + i * 9) % 18);
      ctx.beginPath();
      ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFrog(ctx: CanvasRenderingContext2D, f: Frog, x: number, y: number, lift: number) {
  if (f.falling > 0) return;
  const s = 1 + lift * 0.25;
  ctx.save();
  ctx.translate(x, y - lift * 18);
  const rot = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[f.facing];
  ctx.rotate(rot);
  ctx.scale(s, s);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(0, 6 + lift * 14, FROG_R, FROG_R * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // legs
  ctx.fillStyle = "#6cc24a";
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * (FROG_R - 2), 8 + lift * 6, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // body
  ctx.fillStyle = "#8fdc5c";
  ctx.beginPath();
  ctx.ellipse(0, 0, FROG_R, FROG_R * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  // eyes
  for (const sx of [-1, 1]) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(sx * 8, -10, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(sx * 8, -11, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ff8fc7";
  ctx.beginPath();
  ctx.arc(-11, 0, 3, 0, Math.PI * 2);
  ctx.arc(11, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -1, 5, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, w: World) {
  // water
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#5bbfb0");
  g.addColorStop(1, "#7fd3c2");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  for (let r = 1; r < ROWS - 1; r++) {
    const y = rowY(r) + ROW_H * 0.38;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x / 30 + w.t * 2 + r) * 2);
    ctx.stroke();
  }
  // banks
  for (const r of [0, ROWS - 1]) {
    const y = H - (r + 1) * ROW_H;
    ctx.fillStyle = r === 0 ? "#9be07a" : "#b5ea86";
    ctx.fillRect(0, y, W, ROW_H);
    ctx.fillStyle = "#7cc75c";
    for (let x = 8; x < W; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, y + ROW_H - 6);
      ctx.lineTo(x + 4, y + ROW_H - 22);
      ctx.lineTo(x + 8, y + ROW_H - 6);
      ctx.fill();
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, r === 0 ? y : y + ROW_H);
    ctx.lineTo(W, r === 0 ? y : y + ROW_H);
    ctx.stroke();
  }
  // a goal flag on the far bank
  ctx.fillStyle = ink;
  ctx.font = "700 14px Silkscreen, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`far bank  level ${w.level}`, W / 2, H - (ROWS - 0.6) * ROW_H + 6);
  // pads
  for (const lane of w.lanes) {
    const y = rowY(lane.row);
    for (const p of lane.pads) {
      const st = sinkState(p);
      for (const left of padLefts(lane, p)) {
        if (left > W + 10 || left + p.len < -10) continue;
        drawPad(ctx, left, y, p.len, st, w.t);
      }
    }
  }
  // frog
  const f = w.frog;
  let fx = f.x;
  let fy = rowY(f.row);
  let lift = 0;
  if (f.hop) {
    const k = Math.min(1, f.hop.t / HOP_TIME);
    fx = f.hop.fromX + (f.hop.toX - f.hop.fromX) * k;
    fy = rowY(f.hop.fromRow) + (rowY(f.hop.toRow) - rowY(f.hop.fromRow)) * k;
    lift = Math.sin(k * Math.PI);
  }
  drawFrog(ctx, f, fx, fy, lift);
  if (f.falling > 0) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    const k = 1 - f.falling / 0.7;
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    ctx.ellipse(f.x, rowY(f.row), 10 + k * 34, 4 + k * 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawParticles(ctx, w.particles);
  drawFloats(ctx, w.floats);
  if (w.celebrate > 0) {
    ctx.globalAlpha = Math.min(1, w.celebrate * 2);
    ctx.font = "28px Bungee, sans-serif";
    ctx.lineWidth = 6;
    ctx.strokeStyle = ink;
    ctx.fillStyle = "#ffc23c";
    ctx.strokeText("CROSSED!", W / 2, H / 2);
    ctx.fillText("CROSSED!", W / 2, H / 2);
    ctx.globalAlpha = 1;
  }
}

export default function FrogTraffic({ api }: GameProps) {
  const stage = useRef<StageCanvasHandle>(null);
  const world = useRef<World>(makeWorld());

  const draw = useCallback(() => {
    const ctx = stage.current?.ctx();
    if (ctx) render(ctx, world.current);
  }, []);

  const splash = useCallback(
    (w: World) => {
      const f = w.frog;
      f.falling = 0.7;
      f.hop = null;
      burst(w.particles, f.x, rowY(f.row), "#e6fbff", api.reducedMotion ? 5 : 14, 120);
      w.floats.push({ x: f.x, y: rowY(f.row) - 20, text: "splash", color: "#e6fbff", life: 0 });
      api.sfx("splash");
    },
    [api],
  );

  const move = useCallback(
    (dir: Dir) => {
      const w = world.current;
      const f = w.frog;
      if (!api.isActive() || f.hop || f.falling > 0) return;
      let toRow = f.row;
      let toX = f.x;
      if (dir === "up") toRow = Math.min(ROWS - 1, f.row + 1);
      if (dir === "down") toRow = Math.max(0, f.row - 1);
      if (dir === "left") toX = Math.max(FROG_R, f.x - HOP_X);
      if (dir === "right") toX = Math.min(W - FROG_R, f.x + HOP_X);
      f.facing = dir;
      if (toRow === f.row && toX === f.x) return;
      f.hop = { fromX: f.x, fromRow: f.row, toX, toRow, t: 0 };
      api.sfx("hop");
    },
    [api],
  );

  useEffect(() => {
    draw();
    const offKey = api.listen("keydown", (e) => {
      const map: Record<string, Dir> = { arrowup: "up", w: "up", arrowdown: "down", s: "down", arrowleft: "left", a: "left", arrowright: "right", d: "right" };
      const dir = map[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();
      if (!e.repeat) move(dir);
    });
    const offFrame = api.onFrame((fr) => {
      const w = world.current;
      const dt = fr.dt;
      w.t = fr.t;
      w.speedMul = fr.urgent ? 1.15 : 1;
      for (const lane of w.lanes) {
        lane.shift += lane.speed * w.speedMul * dt;
        for (const p of lane.pads) if (p.sinks) p.sinkPhase += dt;
      }
      const f = w.frog;

      if (f.falling > 0) {
        f.falling -= dt;
        if (f.falling <= 0) {
          w.frog = startFrog();
        }
      } else if (f.hop) {
        f.hop.t += dt;
        // ride along with the lane we are hopping out of or into
        if (f.hop.t >= HOP_TIME) {
          const { toRow, toX } = f.hop;
          f.hop = null;
          f.row = toRow;
          f.x = toX;
          if (toRow === ROWS - 1) {
            const bonus = crossingBonus(w.level);
            api.addScore(bonus);
            api.sfx("bigPoint");
            w.floats.push({ x: f.x, y: rowY(toRow) + 10, text: `+${bonus}`, color: "#ffe27a", life: 0 });
            burst(w.particles, f.x, rowY(toRow), "#ffc23c", api.reducedMotion ? 6 : 18);
            w.level++;
            w.lanes = makeLanes(w.level, Math.random);
            w.frog = startFrog();
            w.celebrate = 1.1;
          } else if (toRow > 0) {
            const lane = w.lanes[toRow - 1];
            if (!padAt(lane, f.x)) splash(w);
            else if (toRow > f.bestRow) {
              f.bestRow = toRow;
              api.addScore(POINTS.newRow);
              w.floats.push({ x: f.x, y: rowY(toRow) - 22, text: `+${POINTS.newRow}`, color: "#ffe27a", life: 0 });
              api.sfx("point");
            }
          }
        }
      } else if (f.row > 0 && f.row < ROWS - 1) {
        // riding a pad
        const lane = w.lanes[f.row - 1];
        f.x += lane.speed * lane.dir * w.speedMul * dt;
        if (f.x < FROG_R * 0.5 || f.x > W - FROG_R * 0.5 || !padAt(lane, f.x, 2)) splash(w);
      }
      w.celebrate = Math.max(0, w.celebrate - dt);
      stepParticles(w.particles, dt);
      stepFloats(w.floats, dt);
      draw();
    });
    return () => {
      offKey();
      offFrame();
    };
  }, [api, draw, move, splash]);

  const pad = (dir: Dir, label: string, glyph: string) => (
    <button
      type="button"
      className="btn btn-paper dpad-btn"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        move(dir);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          move(dir);
        }
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div className="game-fill" style={{ background: "#5bbfb0" }}>
      <StageCanvas ref={stage} width={W} height={H} onResize={draw} label="a pond with drifting lily pads and a frog" />
      <div className="dpad" aria-label="frog controls">
        {pad("left", "hop left", "◀")}
        {pad("up", "hop forward", "▲")}
        {pad("down", "hop back", "▼")}
        {pad("right", "hop right", "▶")}
      </div>
    </div>
  );
}
