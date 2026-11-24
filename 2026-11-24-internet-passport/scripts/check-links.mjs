// scripts/check-links.mjs
// opens every destination url and prints its status. run with `npm run links`.
// some sites sit behind bot protection and answer 403 to scripts while working
// fine in a browser, so those are listed separately for a manual look.

import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/data/destinations.ts", import.meta.url), "utf8");
const urls = [...src.matchAll(/url: "([^"]+)"/g)].map((m) => m[1]);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

async function check(url) {
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
    return { url, status: res.status, final: res.url };
  } catch (e) {
    return { url, status: 0, final: String(e.cause?.code ?? e.message) };
  }
}

const results = [];
for (let i = 0; i < urls.length; i += 12) {
  results.push(...(await Promise.all(urls.slice(i, i + 12).map(check))));
}

const ok = results.filter((r) => r.status >= 200 && r.status < 400);
const guarded = results.filter((r) => r.status === 403 || r.status === 429);
const broken = results.filter((r) => !ok.includes(r) && !guarded.includes(r));

console.log(`${ok.length} of ${results.length} answered ok`);
for (const r of guarded) console.log(`bot check, look by hand  ${r.status}  ${r.url}`);
for (const r of broken) console.log(`broken                   ${r.status}  ${r.url}  ${r.final}`);
const moved = ok.filter((r) => new URL(r.final).hostname.replace(/^www\./, "") !== new URL(r.url).hostname.replace(/^www\./, ""));
for (const r of moved) console.log(`redirects elsewhere      ${r.url} -> ${r.final}`);
process.exitCode = broken.length ? 1 : 0;
