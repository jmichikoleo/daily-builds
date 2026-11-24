// src/lib/exportImage.ts
// png export of the identity page and the stamp sheet. loaded on demand
// because it pulls in react-dom/server to draw stamps as static svg.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PassportState } from "../types";
import { StampArt } from "../components/Stamp";
import { stampById } from "../data/stamps";
import { niceDate, stampDate } from "./format";
import { explorerTitle } from "./logic";
import { download } from "./image";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const c = canvas.getContext("2d");
      if (!c) return reject(new Error("no canvas"));
      c.scale(scale, scale);
      c.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("export failed"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("export failed"));
    };
    img.src = url;
  });
}


function stampMarkup(stampId: string, earnedAt: string, size: number) {
  const s = stampById(stampId);
  if (!s) return "";
  return renderToStaticMarkup(
    createElement(StampArt, { id: `x-${stampId}`, design: s.design, rarity: s.rarity, date: stampDate(earnedAt), size, standalone: false }),
  );
}

const FILTER = `<defs><filter id="ink-rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" result="rough"/><feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="3" seed="3" result="blot"/><feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.62" result="mask"/><feComposite in="rough" in2="mask" operator="in"/></filter></defs>`;

function mrz(state: PassportState) {
  const p = state.profile!;
  const name = p.name.toUpperCase().replace(/[^A-Z]/g, "<").slice(0, 26);
  const l1 = `IP<WWW${name}`.padEnd(44, "<").slice(0, 44);
  const l2 = `${p.passportNumber.replace(/-/g, "")}<<FICTIONAL<COLLECTIBLE<NOT<ID`.padEnd(44, "<").slice(0, 44);
  return [l1, l2];
}

/** the identity page as a png, about the size of a postcard */
export async function exportIdentityCard(state: PassportState) {
  const p = state.profile!;
  const W = 900;
  const H = 560;
  const collected = Object.values(state.stamps).sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
  const recent = collected.slice(-4);
  const photo = p.photo
    ? `<image href="${p.photo}" x="48" y="118" width="200" height="250" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="48" y="118" width="200" height="250" fill="#efe3cf"/><text x="148" y="250" text-anchor="middle" font-family="Georgia, serif" font-size="80" fill="#783B49">${esc(p.name[0]?.toUpperCase() ?? "?")}</text>`;
  const lines = mrz(state);
  const stamps = recent
    .map((c, i) => `<g transform="translate(${560 + (i % 2) * 150} ${300 + Math.floor(i / 2) * 120 - 150})">${stampMarkup(c.stampId, c.earnedAt, 130)}</g>`)
    .join("");
  const row = (y: number, label: string, value: string) =>
    `<text x="286" y="${y}" font-family="Courier New, monospace" font-size="13" fill="#7a6a5f" letter-spacing="1.5">${esc(label)}</text><text x="286" y="${y + 24}" font-family="Georgia, serif" font-size="22" fill="#382D29">${esc(value)}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${FILTER}
  <rect width="${W}" height="${H}" rx="22" fill="#F8F1E5"/>
  <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="16" fill="none" stroke="${p.coverColor}" stroke-width="3"/>
  ${Array.from({ length: 18 }, (_, i) => `<path d="M0 ${60 + i * 28} C 220 ${30 + i * 28}, 680 ${90 + i * 28}, ${W} ${50 + i * 28}" fill="none" stroke="#FFD1D3" stroke-width="1" opacity="0.7"/>`).join("")}
  <rect x="12" y="12" width="${W - 24}" height="74" fill="${p.coverColor}"/>
  <text x="48" y="58" font-family="Georgia, serif" font-size="30" font-style="italic" fill="#FFE9AE">internet passport</text>
  <text x="${W - 48}" y="58" text-anchor="end" font-family="Courier New, monospace" font-size="14" fill="#FFE9AE" letter-spacing="2">DEPT. OF INTERNET EXPLORATION</text>
  ${photo}
  <rect x="48" y="118" width="200" height="250" fill="none" stroke="#382D29" stroke-width="2"/>
  ${row(130, "NAME", p.name)}
  ${row(186, "ALIAS", p.alias || "none on file")}
  ${row(242, "PASSPORT NO.", p.passportNumber)}
  ${row(298, "ISSUED", niceDate(p.issuedAt))}
  ${row(354, "CLASS", explorerTitle(state.visits.length))}
  <text x="48" y="404" font-family="Georgia, serif" font-size="17" font-style="italic" fill="#783B49">${esc(p.motto ? `"${p.motto}"` : "")}</text>
  <text x="48" y="430" font-family="Courier New, monospace" font-size="12" fill="#7a6a5f">${esc(`${collected.length} stamps, ${state.visits.length} destinations, ${Object.keys(state.unlockedSecrets).length} secrets found`)}</text>
  ${stamps}
  <rect x="12" y="452" width="${W - 24}" height="96" fill="#efe3cf"/>
  <text x="48" y="490" font-family="Courier New, monospace" font-size="20" fill="#382D29" letter-spacing="3.4">${esc(lines[0])}</text>
  <text x="48" y="524" font-family="Courier New, monospace" font-size="20" fill="#382D29" letter-spacing="3.4">${esc(lines[1])}</text>
</svg>`;
  const blob = await svgToPng(svg, W, H);
  download(blob, `internet-passport-${p.passportNumber}.png`);
}

/** every collected stamp on one sheet */
export async function exportStampSheet(state: PassportState) {
  const p = state.profile!;
  const collected = Object.values(state.stamps).sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
  const cols = 6;
  const cell = 150;
  const rows = Math.max(1, Math.ceil(collected.length / cols));
  const W = cols * cell + 80;
  const H = rows * cell + 170;
  const stamps = collected
    .map((c, i) => {
      const x = 40 + (i % cols) * cell + 10;
      const y = 120 + Math.floor(i / cols) * cell;
      return `<g transform="translate(${x} ${y})">${stampMarkup(c.stampId, c.earnedAt, 130)}</g>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${FILTER}
  <rect width="${W}" height="${H}" fill="#F8F1E5"/>
  <text x="40" y="62" font-family="Georgia, serif" font-size="34" font-style="italic" fill="#783B49">${esc(p.name)}'s stamp collection</text>
  <text x="40" y="92" font-family="Courier New, monospace" font-size="14" fill="#7a6a5f" letter-spacing="1.5">${esc(`${p.passportNumber}   ${collected.length} STAMPS   INTERNET PASSPORT`)}</text>
  ${stamps}
  <text x="40" y="${H - 24}" font-family="Courier New, monospace" font-size="12" fill="#7a6a5f">a fictional digital collectible. not an identity document.</text>
</svg>`;
  const blob = await svgToPng(svg, W, H);
  download(blob, `internet-passport-stamps-${p.passportNumber}.png`);
}
