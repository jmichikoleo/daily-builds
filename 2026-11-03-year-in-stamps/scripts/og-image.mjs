#!/usr/bin/env node
/**
 * Regenerates src/app/opengraph-image.png (1200×630) from the real landing
 * page hero, so the social preview always matches the product.
 *
 *   npm run build && node scripts/og-image.mjs   (serves out/ on a local port)
 *
 * Uses the locally installed Google Chrome through Playwright. The image is
 * brand-only: it is rendered from a fresh browser with no saved passport.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3519;
const OUT = join(ROOT, "src", "app", "opengraph-image.png");

// The site is a static export, so any static file server works.
const server = spawn("npx", ["--yes", "serve@14", "out", "-l", String(PORT)], { cwd: ROOT, stdio: "ignore" });
try {
  const url = `http://localhost:${PORT}/`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // Hide the header so the hero (headline + stamp collage) fills the card.
  await page.addStyleTag({ content: "header{display:none!important} main>section:first-of-type{padding-top:44px!important}" });
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await browser.close();
  console.log(`Wrote ${OUT}`);
} finally {
  server.kill();
}
