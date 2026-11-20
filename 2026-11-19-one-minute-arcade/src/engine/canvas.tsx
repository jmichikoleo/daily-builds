// src/engine/canvas.tsx
// a canvas that keeps a fixed game coordinate system, scales to fit its box,
// stays sharp on high dpi screens and maps pointer positions back to game space.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

export interface StageCanvasHandle {
  ctx(): CanvasRenderingContext2D | null;
  /** client coordinates to game coordinates */
  toGame(clientX: number, clientY: number): { x: number; y: number };
  el(): HTMLCanvasElement | null;
}

interface Props {
  width: number;
  height: number;
  /** called after every resize so the scene can be redrawn while paused */
  onResize?: () => void;
  label: string;
  className?: string;
}

export const StageCanvas = forwardRef<StageCanvasHandle, Props>(function StageCanvas({ width, height, onResize, label, className = "" }, ref) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const resizeCb = useRef(onResize);
  resizeCb.current = onResize;

  const fit = useCallback(() => {
    const w = wrap.current;
    const c = canvas.current;
    if (!w || !c) return;
    const scale = Math.max(0.1, Math.min(w.clientWidth / width, w.clientHeight / height));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cssW = Math.floor(width * scale);
    const cssH = Math.floor(height * scale);
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
    c.width = Math.max(1, Math.round(cssW * dpr));
    c.height = Math.max(1, Math.round(cssH * dpr));
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.setTransform(c.width / width, 0, 0, c.height / height, 0, 0);
      ctxRef.current = ctx;
    }
    resizeCb.current?.();
  }, [width, height]);

  useEffect(() => {
    fit();
    const ro = new ResizeObserver(() => fit());
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [fit]);

  useImperativeHandle(
    ref,
    () => ({
      ctx: () => ctxRef.current,
      el: () => canvas.current,
      toGame(clientX, clientY) {
        const c = canvas.current;
        if (!c) return { x: 0, y: 0 };
        const r = c.getBoundingClientRect();
        return { x: ((clientX - r.left) / r.width) * width, y: ((clientY - r.top) / r.height) * height };
      },
    }),
    [width, height],
  );

  return (
    <div ref={wrap} className={`stage-canvas-wrap ${className}`}>
      <canvas ref={canvas} role="img" aria-label={label} className="stage-canvas" />
    </div>
  );
});

/** a rounded rectangle path, used all over the games */
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export function burst(list: Particle[], x: number, y: number, color: string, count = 10, speed = 140) {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const s = speed * (0.5 + Math.random() * 0.7);
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0, max: 0.5 + Math.random() * 0.3, color, size: 2 + Math.random() * 3 });
  }
}

export function stepParticles(list: Particle[], dt: number, gravity = 300) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life += dt;
    if (p.life >= p.max) {
      list.splice(i, 1);
      continue;
    }
    p.vy += gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
  for (const p of list) {
    ctx.globalAlpha = 1 - p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export function stepFloats(list: FloatText[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    list[i].life += dt;
    list[i].y -= 40 * dt;
    if (list[i].life > 0.9) list.splice(i, 1);
  }
}

export function drawFloats(ctx: CanvasRenderingContext2D, list: FloatText[]) {
  ctx.textAlign = "center";
  ctx.font = "700 20px Silkscreen, monospace";
  for (const f of list) {
    ctx.globalAlpha = 1 - f.life / 0.9;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#2b2340";
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
