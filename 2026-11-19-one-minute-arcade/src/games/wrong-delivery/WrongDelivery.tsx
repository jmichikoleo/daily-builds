// src/games/wrong-delivery/WrongDelivery.tsx
// a toy factory conveyor belt full of parcels that need to go somewhere.

import { useCallback, useEffect, useRef, useState } from "react";
import { StageCanvas, burst, drawFloats, drawParticles, stepFloats, stepParticles, type FloatText, type Particle, type StageCanvasHandle } from "../../engine/canvas";
import type { GameProps } from "../../engine/types";
import { CATEGORIES, CATEGORY_INFO, ODD_PACKAGES, PLAIN_NAMES, beltAt, categoryForDoorKey, deliver, miss, multiplierFor, type Category, type Sorter } from "./logic";

const W = 480;
const H = 330;
const BELT_Y = 120;
const BELT_END = W - 62;
const PKG = 50;
const DOOR_X = [80, 240, 400];
const ink = "#2b2340";

interface Pkg {
  id: number;
  cat: Category;
  name: string;
  odd: boolean;
  x: number;
  wob: number;
  hue: number;
  fly: { door: number; t: number; fromX: number; correct: boolean } | null;
}

interface World {
  pkgs: Pkg[];
  spawnIn: number;
  nextId: number;
  sorter: Sorter;
  t: number;
  belt: number;
  particles: Particle[];
  floats: FloatText[];
  doorFlash: [number, number, number];
}

function drawSymbol(ctx: CanvasRenderingContext2D, cat: Category, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = ink;
  if (cat === "food") {
    // an apple with a leaf
    ctx.fillStyle = "#ff5a5f";
    ctx.beginPath();
    ctx.arc(-4, 2, 8, 0, Math.PI * 2);
    ctx.arc(4, 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, 2);
    ctx.bezierCurveTo(-12, 14, 12, 14, 12, 2);
    ctx.bezierCurveTo(12, -10, 0, -8, 0, -6);
    ctx.bezierCurveTo(0, -8, -12, -10, -12, 2);
    ctx.stroke();
    ctx.fillStyle = "#3ccf91";
    ctx.beginPath();
    ctx.ellipse(4, -10, 5, 2.5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (cat === "space") {
    // a ringed planet
    ctx.fillStyle = "#4aa8ff";
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 4.5, -0.35, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // a sparkly star
    ctx.fillStyle = "#b58cf6";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 12 : 4.5;
      const a = (Math.PI * i) / 4 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawPkg(ctx: CanvasRenderingContext2D, p: Pkg, isFront: boolean, t: number) {
  let x = p.x;
  let y = BELT_Y - PKG / 2 - 2;
  let rot = Math.sin(t * 8 + p.wob) * 0.04;
  let scale = 1;
  if (p.fly) {
    const k = Math.min(1, p.fly.t / 0.35);
    x = p.fly.fromX + (DOOR_X[p.fly.door] - p.fly.fromX) * k;
    y = y + (H - 40 - y) * k - Math.sin(k * Math.PI) * 50;
    rot = k * (p.fly.correct ? 6 : -9);
    scale = 1 - k * 0.45;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  if (isFront) {
    ctx.strokeStyle = "#ffc23c";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(-PKG / 2 - 7, -PKG / 2 - 7, PKG + 14, PKG + 14, 12);
    ctx.stroke();
  }
  // cardboard box
  ctx.fillStyle = `hsl(${p.hue} 55% 72%)`;
  ctx.beginPath();
  ctx.roundRect(-PKG / 2, -PKG / 2, PKG, PKG, 6);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-4, -PKG / 2 + 2, 8, PKG - 4);
  // sticker
  ctx.fillStyle = "#fffaf2";
  ctx.beginPath();
  ctx.arc(0, 2, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  drawSymbol(ctx, p.cat, 0, 2, 0.95);
  if (p.odd) {
    ctx.fillStyle = "#ffc23c";
    ctx.font = "900 14px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = ink;
    ctx.strokeText("?!", PKG / 2 - 4, -PKG / 2 + 6);
    ctx.fillText("?!", PKG / 2 - 4, -PKG / 2 + 6);
  }
  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, w: World, front: Pkg | null) {
  ctx.fillStyle = "#ffd9e6";
  ctx.fillRect(0, 0, W, H);
  // wallpaper dots
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  for (let y = 12; y < 80; y += 22) for (let x = (y / 2) % 22; x < W; x += 22) ctx.fillRect(x, y, 4, 4);
  // window with clouds
  ctx.fillStyle = "#bfe6ff";
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(30, 14, 90, 52, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(55 + ((w.t * 8) % 60), 40, 9, 0, Math.PI * 2);
  ctx.arc(66 + ((w.t * 8) % 60), 36, 11, 0, Math.PI * 2);
  ctx.fill();
  // the machine the parcels come out of
  ctx.fillStyle = "#ffc23c";
  ctx.beginPath();
  ctx.roundRect(-10, 50, 50, 80, 8);
  ctx.fill();
  ctx.stroke();
  // belt
  ctx.fillStyle = "#7a6a8a";
  ctx.fillRect(0, BELT_Y, W, 24);
  ctx.strokeRect(-4, BELT_Y, W + 8, 24);
  ctx.fillStyle = "#b9acc7";
  const off = w.belt % 28;
  for (let x = -28 + off; x < W + 28; x += 28) {
    ctx.beginPath();
    ctx.arc(x, BELT_Y + 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // the end of the belt is a sad bin
  ctx.fillStyle = "#cfc6d8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(BELT_END + 4, BELT_Y + 22, 40, 50, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.font = "700 10px Silkscreen, monospace";
  ctx.textAlign = "center";
  ctx.fillText("oops", BELT_END + 22, BELT_Y + 52);
  // doors
  CATEGORIES.forEach((c, i) => {
    const x = DOOR_X[i];
    const flash = w.doorFlash[i];
    ctx.fillStyle = flash > 0 ? "#fff6b0" : "#fffaf2";
    ctx.lineWidth = 3;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.roundRect(x - 52, H - 92, 104, 86, [40, 40, 6, 6]);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = CATEGORY_INFO[c].color;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.roundRect(x - 40, H - 80, 80, 70, [32, 32, 4, 4]);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawSymbol(ctx, c, x, H - 52, 1.4);
  });
  for (const p of w.pkgs) drawPkg(ctx, p, p === front, w.t);
  drawParticles(ctx, w.particles);
  drawFloats(ctx, w.floats);
}

function frontOf(w: World): Pkg | null {
  let best: Pkg | null = null;
  for (const p of w.pkgs) if (!p.fly && (!best || p.x > best.x)) best = p;
  return best;
}

export default function WrongDelivery({ api }: GameProps) {
  const stage = useRef<StageCanvasHandle>(null);
  const world = useRef<World>({ pkgs: [], spawnIn: 0.2, nextId: 1, sorter: { streak: 0 }, t: 0, belt: 0, particles: [], floats: [], doorFlash: [0, 0, 0] });
  const [front, setFront] = useState<{ id: number; cat: Category; name: string; odd: boolean } | null>(null);
  const [streak, setStreak] = useState(0);

  const draw = useCallback(() => {
    const ctx = stage.current?.ctx();
    if (ctx) render(ctx, world.current, frontOf(world.current));
  }, []);

  const sync = useCallback(() => {
    const f = frontOf(world.current);
    setFront((cur) => (cur?.id === f?.id ? cur : f ? { id: f.id, cat: f.cat, name: f.name, odd: f.odd } : null));
    setStreak(world.current.sorter.streak);
  }, []);

  const send = useCallback(
    (door: Category) => {
      if (!api.isActive()) return;
      const w = world.current;
      const p = frontOf(w);
      const di = CATEGORY_INFO[door].door;
      w.doorFlash[di] = 0.2;
      if (!p) return;
      const r = deliver(w.sorter, p.cat, door);
      p.fly = { door: di, t: 0, fromX: p.x, correct: r.correct };
      api.addScore(r.delta);
      w.floats.push({
        x: DOOR_X[di],
        y: H - 100,
        text: r.correct ? `+${r.delta}${r.multiplier > 1 ? ` x${r.multiplier}` : ""}` : `${r.delta}`,
        color: r.correct ? "#ffe27a" : "#ff6b78",
        life: 0,
      });
      if (r.correct) {
        api.sfx(r.multiplier > 1 ? "bigPoint" : "point");
      } else api.sfx("wrong");
      sync();
    },
    [api, sync],
  );

  useEffect(() => {
    draw();
    const offKey = api.listen("keydown", (e) => {
      if (e.repeat) return;
      const cat = categoryForDoorKey(e.key);
      if (!cat) return;
      e.preventDefault();
      send(cat);
    });
    const offFrame = api.onFrame((f) => {
      const w = world.current;
      const b = beltAt(f.progress, f.urgent);
      w.t = f.t;
      w.belt += b.speed * f.dt;
      let changed = false;
      w.spawnIn -= f.dt;
      const last = w.pkgs.filter((p) => !p.fly).reduce((m, p) => Math.min(m, p.x), Infinity);
      if (w.spawnIn <= 0 && last > PKG + 30) {
        w.spawnIn = b.every * (0.8 + Math.random() * 0.4);
        const cat = CATEGORIES[Math.floor(Math.random() * 3)];
        const odd = Math.random() < b.oddChance;
        const names = odd ? ODD_PACKAGES[cat] : PLAIN_NAMES[cat];
        w.pkgs.push({ id: w.nextId++, cat, odd, name: names[Math.floor(Math.random() * names.length)], x: 10, wob: Math.random() * 6, hue: 25 + Math.random() * 20, fly: null });
        changed = true;
      }
      for (let i = w.pkgs.length - 1; i >= 0; i--) {
        const p = w.pkgs[i];
        if (p.fly) {
          p.fly.t += f.dt;
          if (p.fly.t >= 0.35) {
            if (p.fly.correct) burst(w.particles, DOOR_X[p.fly.door], H - 50, CATEGORY_INFO[p.cat].color, api.reducedMotion ? 4 : 10);
            w.pkgs.splice(i, 1);
          }
          continue;
        }
        p.x += b.speed * f.dt;
        if (p.x > BELT_END) {
          w.pkgs.splice(i, 1);
          api.addScore(miss(w.sorter));
          w.floats.push({ x: BELT_END, y: BELT_Y - 10, text: "-3", color: "#ff6b78", life: 0 });
          api.sfx("wrong");
          changed = true;
        }
      }
      w.doorFlash = w.doorFlash.map((d) => Math.max(0, d - f.dt)) as [number, number, number];
      stepParticles(w.particles, f.dt);
      stepFloats(w.floats, f.dt);
      if (changed) sync();
      draw();
    });
    return () => {
      offKey();
      offFrame();
    };
  }, [api, draw, send, sync]);

  const mult = multiplierFor(streak);

  return (
    <div className="game-fill delivery" style={{ background: "#ffd9e6" }}>
      <StageCanvas ref={stage} width={W} height={H} onResize={draw} label="a conveyor belt with packages and three doors" />
      <div className="delivery-bottom">
        <div className="delivery-caption" aria-live="polite" data-testid="front-package" data-category={front?.cat ?? ""}>
          {front ? (
            <>
              <span className="eyebrow">next up</span> <strong>{front.name}</strong>
              <span className="sr-only">. sticker says {front.cat}</span>
            </>
          ) : (
            <span className="opacity-70">waiting for parcels...</span>
          )}
          <span className="delivery-combo" aria-label={`combo ${mult} times, streak ${streak}`}>
            x{mult} <small>{streak} in a row</small>
          </span>
        </div>
        <div className="delivery-doors">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className="btn btn-paper delivery-door"
              style={{ ["--door" as string]: CATEGORY_INFO[c].color }}
              onPointerDown={(e) => {
                e.preventDefault();
                send(c);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  send(c);
                }
              }}
              aria-label={`send to the ${c} door. key ${CATEGORY_INFO[c].key}`}
              data-testid={`door-${c}`}
            >
              <DoorIcon cat={c} />
              <span>{c}</span>
              <kbd>{CATEGORY_INFO[c].key}</kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DoorIcon({ cat }: { cat: Category }) {
  if (cat === "food")
    return (
      <svg viewBox="-14 -14 28 28" width="28" height="28" aria-hidden="true">
        <path d="M-12 2C-12 14 12 14 12 2 12-10 0-8 0-6 0-8-12-10-12 2z" fill="#ff5a5f" stroke={ink} strokeWidth="2.2" />
        <ellipse cx="4" cy="-10" rx="5" ry="2.5" transform="rotate(-28 4 -10)" fill="#3ccf91" stroke={ink} strokeWidth="2" />
      </svg>
    );
  if (cat === "space")
    return (
      <svg viewBox="-16 -14 32 28" width="30" height="28" aria-hidden="true">
        <circle r="9" fill="#4aa8ff" stroke={ink} strokeWidth="2.2" />
        <ellipse rx="15" ry="4.5" transform="rotate(-20)" fill="none" stroke={ink} strokeWidth="2.2" />
      </svg>
    );
  return (
    <svg viewBox="-14 -14 28 28" width="28" height="28" aria-hidden="true">
      <path d="M0-12L3.2-3.2 12 0 3.2 3.2 0 12-3.2 3.2-12 0-3.2-3.2z" fill="#b58cf6" stroke={ink} strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}
