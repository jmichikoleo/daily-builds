#!/usr/bin/env node
/**
 * Builds public/data/catalog.v1.json from open geographic datasets.
 *
 *   node scripts/build-catalog.mjs            # use files already in data/raw
 *   node scripts/build-catalog.mjs --download # (re)download the sources first
 *
 * Sources (see DATA_SOURCES.md for licences and attribution):
 *   - GeoNames countryInfo.txt, admin1CodesASCII.txt, cities15000.zip (CC BY 4.0)
 *   - Natural Earth 1:10m Admin 0 – Countries and Map Units (public domain),
 *     used only to classify territories and find their sovereign state.
 *
 * Output is a compact, array-based JSON so the browser can fetch it once,
 * lazily, on the passport page. Nothing here is hand-invented: every id,
 * name and code comes from the sources above.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data", "raw");
const OUT = join(ROOT, "public", "data", "catalog.v1.json");

const SOURCES = {
  "countryInfo.txt": "https://download.geonames.org/export/dump/countryInfo.txt",
  "admin1CodesASCII.txt": "https://download.geonames.org/export/dump/admin1CodesASCII.txt",
  "cities15000.zip": "https://download.geonames.org/export/dump/cities15000.zip",
  "ne_10m_admin_0_countries.geojson":
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson",
  "ne_10m_admin_0_map_units.geojson":
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_units.geojson",
  NE_VERSION: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/VERSION",
};

/** Populated-place feature codes we skip: city sections, historical, abandoned, destroyed. */
const SKIP_FEATURE_CODES = new Set(["PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"]);
/** Same-named capitals of territories smaller than this (km²) are the territory itself (Hong Kong, Singapore, Monaco…). */
const CITY_STATE_MAX_AREA = 2000;
/** Codes GeoNames still lists but ISO 3166-1 has withdrawn (Serbia and Montenegro, Netherlands Antilles). */
const WITHDRAWN_CODES = new Set(["CS", "AN"]);

async function download() {
  mkdirSync(RAW, { recursive: true });
  for (const [file, url] of Object.entries(SOURCES)) {
    process.stdout.write(`Downloading ${file}… `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    writeFileSync(join(RAW, file), Buffer.from(await res.arrayBuffer()));
    console.log("ok");
  }
  execFileSync("unzip", ["-oq", join(RAW, "cities15000.zip"), "-d", RAW]);
}

const readLines = (file) =>
  readFileSync(join(RAW, file), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"));

const normalize = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Alternate spellings worth searching: plain-ASCII Latin names, properly
 * capitalised, no airport codes. Accented variants are skipped because search
 * strips diacritics anyway ("Busán" already matches "Busan").
 */
function pickAlternates(candidates, ...exclude) {
  const seen = new Set(exclude.map(normalize));
  const alts = [];
  for (const raw of candidates) {
    const a = raw.trim();
    if (!a || a.length > 24 || /^[A-Z]{2,4}$/.test(a)) continue;
    if (!/^[A-Z]/.test(a) || !/^[A-Za-z\s'.\-()]+$/.test(a)) continue;
    const key = normalize(a);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    alts.push(a);
  }
  return alts;
}

async function main() {
  if (process.argv.includes("--download") || !existsSync(join(RAW, "cities15000.txt"))) await download();

  // ── Natural Earth: territory → sovereign ──────────────────────────────
  const ne = JSON.parse(readFileSync(join(RAW, "ne_10m_admin_0_countries.geojson"), "utf8"));
  const neIso = (p) => (p.ISO_A2_EH !== "-99" ? p.ISO_A2_EH : p.ISO_A2);
  const neByIso = new Map();
  const neIsoByAdmin = new Map();
  for (const { properties: p } of ne.features) {
    const iso = neIso(p);
    if (!iso || iso === "-99") continue;
    neByIso.set(iso, p);
    neIsoByAdmin.set(p.ADMIN, iso);
  }
  // Map units split some countries into parts (French Guiana, Svalbard, Tokelau…);
  // they're only consulted for codes the countries file folds into their sovereign.
  const mapUnits = JSON.parse(readFileSync(join(RAW, "ne_10m_admin_0_map_units.geojson"), "utf8"));
  const unitByIso = new Map();
  for (const { properties: p } of mapUnits.features) {
    const iso = neIso(p);
    if (iso && iso !== "-99" && !unitByIso.has(iso)) unitByIso.set(iso, p);
  }

  // ── GeoNames countries & territories ──────────────────────────────────
  const countryRows = readLines("countryInfo.txt")
    .map((l) => l.split("\t"))
    .filter((c) => !WITHDRAWN_CODES.has(c[0]));
  const countryName = new Map(countryRows.map((c) => [c[0], c[4].trim()]));
  const countries = [];
  const cityStates = new Map(); // iso → capital name, for tiny territories
  const unmatched = [];
  for (const c of countryRows) {
    const [iso, , , , rawName, capital, area, population] = c;
    const name = rawName.trim();
    const p = neByIso.get(iso);
    let kind = "c";
    let sovereign = "";
    let designation = "";
    const alts = [];
    if (p) {
      if (p.SOVEREIGNT !== p.ADMIN) {
        const sovIso = neIsoByAdmin.get(p.SOVEREIGNT) ?? "";
        if (sovIso && sovIso !== iso) {
          kind = "t";
          sovereign = sovIso;
          designation = /S\.A\.R/.test(p.ADMIN)
            ? `Special Administrative Region of ${countryName.get(sovIso)}`
            : `Territory of ${countryName.get(sovIso)}`;
        }
      }
      for (const v of [p.NAME, p.NAME_LONG, p.FORMAL_EN, p.NAME_ALT, p.ADMIN, p.NAME_EN]) {
        if (typeof v === "string" && v) alts.push(v.replace(/ S\.A\.R\.?$/, ""));
      }
    } else if (unitByIso.has(iso)) {
      const u = unitByIso.get(iso);
      const sovIso = neIsoByAdmin.get(u.SOVEREIGNT) ?? "";
      if (sovIso && sovIso !== iso) {
        kind = "t";
        sovereign = sovIso;
        designation = `Territory of ${countryName.get(sovIso)}`;
      }
      alts.push(u.GEOUNIT, u.NAME_LONG);
    } else {
      unmatched.push(`${iso} ${name}`);
    }
    const uniqueAlts = pickAlternates(alts, name);
    countries.push([iso, name, kind, sovereign, designation, uniqueAlts, Math.round(Number(population) / 1000)]);
    if (Number(area) > 0 && Number(area) < CITY_STATE_MAX_AREA && capital) cityStates.set(iso, normalize(capital));
  }

  // ── GeoNames admin1 (state / province) names ─────────────────────────
  const admin1Index = new Map();
  const admin1Names = [];
  for (const l of readLines("admin1CodesASCII.txt")) {
    const [code, name] = l.split("\t");
    admin1Index.set(code, admin1Names.length);
    admin1Names.push(name);
  }

  // ── GeoNames cities (population ≥ 15,000) ────────────────────────────
  const rows = readLines("cities15000.txt")
    .map((l) => l.split("\t"))
    .filter((r) => !SKIP_FEATURE_CODES.has(r[7]) && countryName.has(r[8]))
    .sort((a, b) => Number(b[14]) - Number(a[14]));

  const seen = new Set();
  const cities = [];
  let skippedCityStates = 0;
  let skippedDuplicates = 0;
  let skippedSubdivisions = 0;
  for (const r of rows) {
    const [id, rawName, ascii, alternates, , , , fcode, iso, , admin1] = r;
    const name = rawName.trim();
    const population = Number(r[14]);
    // "Hong Kong, Hong Kong" — the territory entry already covers it.
    if (cityStates.get(iso) === normalize(name) && normalize(name) === normalize(countryName.get(iso))) {
      skippedCityStates++;
      continue;
    }
    // Several entries sharing name + region (e.g. a district named like its city): keep the most populous.
    const key = `${iso}|${admin1}|${normalize(name)}`;
    if (seen.has(key)) {
      skippedDuplicates++;
      continue;
    }
    // Numbered city districts ("Paris 15 Vaugirard", "Marseille 08") when the city itself is listed.
    const district = /^(.*\S) \d{1,2}(?:\s|$)/.exec(name);
    if (district && seen.has(`${iso}|${admin1}|${normalize(district[1])}`)) {
      skippedSubdivisions++;
      continue;
    }
    seen.add(key);
    const a1 = admin1Index.get(`${iso}.${admin1}`) ?? -1;
    const flags = fcode === "PPLC" ? 1 : 0;
    cities.push([Number(id), name, iso, a1, Math.round(population / 1000), flags, pickAlternates(alternates.split(","), name, ascii)]);
  }

  // Keep only admin1 names that are referenced, and remap indexes.
  const used = [...new Set(cities.map((c) => c[3]).filter((i) => i >= 0))].sort((a, b) => a - b);
  const remap = new Map(used.map((old, i) => [old, i]));
  for (const c of cities) c[3] = c[3] >= 0 ? remap.get(c[3]) : -1;

  const neVersion = readFileSync(join(RAW, "NE_VERSION"), "utf8").trim();
  const catalog = {
    version: 1,
    generatedAt: new Date().toISOString().slice(0, 10),
    sources: {
      geonames: "GeoNames (geonames.org), CC BY 4.0 — countryInfo, admin1CodesASCII, cities15000",
      naturalEarth: `Natural Earth 1:10m Admin 0 Countries + Map Units v${neVersion}, public domain`,
    },
    countries,
    admin1: used.map((i) => admin1Names[i]),
    cities,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(catalog));

  const kb = Math.round(readFileSync(OUT).length / 1024);
  console.log(
    `Wrote ${OUT}\n  ${countries.length} countries/territories (${countries.filter((c) => c[2] === "t").length} territories)` +
      `\n  ${cities.length} cities (skipped ${skippedCityStates} city-state duplicates, ${skippedDuplicates} same-name duplicates, ${skippedSubdivisions} numbered districts)` +
      `\n  ${used.length} regions, ${kb} KB` +
      `\n  No Natural Earth match (kept as country): ${unmatched.join(", ") || "none"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
