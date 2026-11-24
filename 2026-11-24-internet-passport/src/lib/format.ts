// src/lib/format.ts
// small text helpers shared across pages.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** 24 nov 2026 */
export function niceDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 24 NOV 26, for stamps */
export function stampDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()].toUpperCase()} ${String(d.getFullYear()).slice(2)}`;
}

export function clock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export const RARITY_LABEL = {
  common: "common",
  rare: "rare",
  legendary: "legendary",
  secret: "secret",
} as const;

export const WARNING_LABEL = {
  flashing: "flashing visuals",
  "sudden-audio": "sudden sound",
  audio: "plays sound",
  motion: "lots of motion",
  "random-links": "sends you to random sites",
  uploads: "uploads your drawing",
  "long-session": "easy to lose hours here",
} as const;
