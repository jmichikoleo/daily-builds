// src/games/star-catcher/StarCatcher.tsx
// catch falling stars in a small, slightly smug basket.

import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { StageCanvas, burst, drawFloats, drawParticles, stepFloats, stepParticles, type FloatText, type Particle, type StageCanvasHandle } from "../../engine/canvas";
import type { GameProps } from "../../engine/types";
import { useHeldKeys } from "../../hooks/useGame";
import { BASKET_H, BASKET_SPEED, BASKET_W, BASKET_Y, H, STARS, W, clampBasket, difficultyAt, isCaught, pickKind, type Star } from "./logic";

interface World {
  basketX: number;
  basketVx: number;
  pointerX: number | null;
  stars: Star[];
  spawnIn: number;
  particles: Particle[];
  floats: FloatText[];
  shake: number;
  squash: number;
  sky: { x: number; y: number; r: number; p: number }[];
  t: number;
  urgent: boolean;
}

function makeWorld(): World {
  return {
    basketX: W / 2,
    basketVx: 0,
    pointerX: null,
    stars: [],
    spawnIn: 0.4,
    particles: [],
    floats: [],
    shake: 0,
    squash: 0,
    sky: Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * (H - 120), r: Math.random() * 1.6 + 0.4, p: Math.random() * 6 })),
    t: 0,
    urgent: false,
  };
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points: number, inner: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = rot + (Math.PI * i) / points - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, s: Star, t: number) {
  const rot = s.age * (s.kind === "red" ? 2.4 : 0.8);
  // trail
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = s.kind === "rainbow" ? `hsl(${(t * 300) % 360} 90% 70%)` : STARS[s.kind].color;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(s.x, s.y - i * 9, s.r * (0.6 - i * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (s.kind === "red") {
    // spiky and grumpy so it reads as bad without the color
    starPath(ctx, s.x, s.y, s.r * 1.1, 9, 0.55, rot);
    ctx.fillStyle = STARS.red.color;
  } else if (s.kind === "rainbow") {
    starPath(ctx, s.x, s.y, s.r * 1.15, 5, 0.5, rot);
    const g = ctx.createLinearGradient(s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r);
    ["#ff5a5f", "#ffc23c", "#3ccf91", "#4aa8ff", "#8b5cf6"].forEach((c, i) => g.addColorStop(i / 4, c));
    ctx.fillStyle = g;
  } else {
    starPath(ctx, s.x, s.y, s.r, 5, 0.5, rot);
    ctx.fillStyle = STARS[s.kind].color;
  }
  ctx.shadowColor = ctx.fillStyle as string;
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#2b2340";
  ctx.stroke();
  if (s.kind === "blue") {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 1.45, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(160,215,255,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // face
  ctx.fillStyle = "#2b2340";
  const e = s.r * 0.22;
  ctx.fillRect(s.x - e * 1.6, s.y - e * 0.6, e * 0.8, e * 1.2);
  ctx.fillRect(s.x + e * 0.8, s.y - e * 0.6, e * 0.8, e * 1.2);
  ctx.beginPath();
  if (s.kind === "red") ctx.arc(s.x, s.y + e * 2.4, e * 1.1, Math.PI * 1.15, Math.PI * 1.85);
  else ctx.arc(s.x, s.y + e * 0.9, e * 1.1, Math.PI * 0.15, Math.PI * 0.85);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2b2340";
  ctx.stroke();
}

function drawBasket(ctx: CanvasRenderingContext2D, w: World) {
  const x = w.basketX;
  const y = BASKET_Y;
  const sq = w.squash;
  const bw = BASKET_W * (1 + sq * 0.15);
  const bh = BASKET_H * (1 - sq * 0.2);
  const tilt = Math.max(-0.12, Math.min(0.12, w.basketVx / 4000));
  ctx.save();
  ctx.translate(x, y + BASKET_H - bh);
  ctx.rotate(tilt);
  // body
  ctx.beginPath();
  ctx.moveTo(-bw / 2, 0);
  ctx.lineTo(bw / 2, 0);
  ctx.lineTo(bw / 2 - 12, bh);
  ctx.lineTo(-bw / 2 + 12, bh);
  ctx.closePath();
  ctx.fillStyle = "#e2965a";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#2b2340";
  ctx.stroke();
  // weave
  ctx.strokeStyle = "rgba(43,35,64,0.35)";
  ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 13, 2);
    ctx.lineTo(i * 11, bh - 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-bw / 2 + 5, bh / 2);
  ctx.lineTo(bw / 2 - 5, bh / 2);
  ctx.stroke();
  // rim
  ctx.fillStyle = "#c46f3a";
  ctx.beginPath();
  ctx.roundRect(-bw / 2 - 5, -6, bw + 10, 10, 5);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#2b2340";
  ctx.stroke();
  // face
  ctx.fillStyle = "#2b2340";
  ctx.beginPath();
  ctx.arc(-12, bh * 0.5, 3, 0, Math.PI * 2);
  ctx.arc(12, bh * 0.5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8fc7";
  ctx.beginPath();
  ctx.arc(-21, bh * 0.62, 3.5, 0, Math.PI * 2);
  ctx.arc(21, bh * 0.62, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, w: World, reduced: boolean) {
  ctx.save();
  if (w.shake > 0 && !reduced) ctx.translate((Math.random() - 0.5) * w.shake * 14, (Math.random() - 0.5) * w.shake * 14);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, w.urgent ? "#3a1238" : "#1d1240");
  g.addColorStop(0.7, "#40236e");
  g.addColorStop(1, "#6b3f8f");
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  for (const s of w.sky) {
    ctx.globalAlpha = reduced ? 0.6 : 0.35 + 0.35 * Math.sin(w.t * 2 + s.p);
    ctx.fillStyle = "#fff6d8";
    ctx.fillRect(s.x, s.y, s.r * 1.6, s.r * 1.6);
  }
  ctx.globalAlpha = 1;
  // moon
  ctx.fillStyle = "#fff3c4";
  ctx.beginPath();
  ctx.arc(W - 70, 70, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1d1240";
  ctx.beginPath();
  ctx.arc(W - 58, 62, 27, 0, Math.PI * 2);
  ctx.fill();
  // hills
  ctx.fillStyle = "#2a1850";
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 50);
  ctx.quadraticCurveTo(W * 0.25, H - 90, W * 0.5, H - 45);
  ctx.quadraticCurveTo(W * 0.75, H - 10, W, H - 60);
  ctx.lineTo(W, H);
  ctx.fill();
  for (const s of w.stars) drawStar(ctx, s, w.t);
  drawBasket(ctx, w);
  drawParticles(ctx, w.particles);
  drawFloats(ctx, w.floats);
  ctx.restore();
}

export default function StarCatcher({ api }: GameProps) {
  const stage = useRef<StageCanvasHandle>(null);
  const world = useRef<World>(makeWorld());
  const keys = useHeldKeys(api, ["arrowleft", "arrowright", "a", "d"]);
  const reduced = api.reducedMotion;

  const draw = useCallback(() => {
    const ctx = stage.current?.ctx();
    if (ctx) render(ctx, world.current, reduced);
  }, [reduced]);

  useEffect(() => {
    draw();
    return api.onFrame((f) => {
      const w = world.current;
      const dt = f.dt;
      w.t = f.t;
      w.urgent = f.urgent;
      const d = difficultyAt(f.t, f.urgent);

      // basket. keys win over the pointer
      const left = keys.current.has("arrowleft") || keys.current.has("a");
      const right = keys.current.has("arrowright") || keys.current.has("d");
      const before = w.basketX;
      if (left || right) {
        w.pointerX = null;
        w.basketX += (right ? 1 : 0) * BASKET_SPEED * dt - (left ? 1 : 0) * BASKET_SPEED * dt;
      } else if (w.pointerX !== null) {
        w.basketX += (w.pointerX - w.basketX) * Math.min(1, dt * 18);
      }
      w.basketX = clampBasket(w.basketX);
      w.basketVx = dt > 0 ? (w.basketX - before) / dt : 0;

      // spawning
      w.spawnIn -= dt;
      if (w.spawnIn <= 0) {
        w.spawnIn = d.spawnEvery * (0.7 + Math.random() * 0.6);
        const kind = pickKind(d.weights, Math.random());
        const r = kind === "rainbow" ? 17 : 15;
        const x = 30 + Math.random() * (W - 60);
        w.stars.push({
          kind,
          x,
          baseX: x,
          y: -20,
          vy: d.fall * (0.85 + Math.random() * 0.3) * (kind === "rainbow" ? 1.2 : 1),
          r,
          wobble: d.wobble && Math.random() < 0.7 ? 40 + Math.random() * 60 : 0,
          phase: Math.random() * Math.PI * 2,
          age: 0,
        });
      }

      // stars
      for (let i = w.stars.length - 1; i >= 0; i--) {
        const s = w.stars[i];
        s.age += dt;
        s.y += s.vy * dt;
        if (s.wobble) {
          s.x = Math.max(s.r, Math.min(W - s.r, s.baseX + Math.sin(s.age * 3 + s.phase) * s.wobble));
        }
        if (isCaught(s, w.basketX)) {
          const pts = STARS[s.kind].points;
          api.addScore(pts);
          w.stars.splice(i, 1);
          w.floats.push({ x: s.x, y: BASKET_Y - 20, text: pts > 0 ? `+${pts}` : `${pts}`, color: pts > 0 ? "#ffe27a" : "#ff6b78", life: 0 });
          if (pts > 0) {
            burst(w.particles, s.x, BASKET_Y, s.kind === "rainbow" ? "#ff8fc7" : STARS[s.kind].color, reduced ? 4 : 12);
            w.squash = 1;
            api.sfx(pts >= 25 ? "bigPoint" : "point");
          } else {
            w.shake = 1;
            api.sfx("wrong");
          }
          continue;
        }
        if (s.y - s.r > H) {
          w.stars.splice(i, 1);
          if (s.kind !== "red") burst(w.particles, s.x, H - 4, "#9b8cc9", 4, 60);
        }
      }
      w.squash = Math.max(0, w.squash - dt * 5);
      w.shake = Math.max(0, w.shake - dt * 4);
      stepParticles(w.particles, dt);
      stepFloats(w.floats, dt);
      draw();
    });
  }, [api, draw, keys]);

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!api.isActive()) return;
    if (e.pointerType === "mouse" || e.buttons > 0 || e.type === "pointerdown") {
      world.current.pointerX = stage.current?.toGame(e.clientX, e.clientY).x ?? null;
    }
  };

  return (
    <div className="game-fill" style={{ background: "#1d1240" }} onPointerMove={onPointer} onPointerDown={onPointer}>
      <StageCanvas ref={stage} width={W} height={H} onResize={draw} label="a night sky with falling stars and a basket" />
      <div className="sr-only" aria-live="polite">
        move the basket with the arrow keys, a and d, the mouse or by dragging
      </div>
    </div>
  );
}
