import type { Place, RawCatalog } from "./types";

/** Lowercase, strip accents and punctuation: "São Paulo" → "sao paulo". */
export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface IndexedPlace {
  place: Place;
  name: string;
  words: string[];
  alts: string[];
  /** Country, sovereign and region names, for queries like "paris france". */
  context: string[];
  boost: number;
}

export interface PlaceCatalog {
  places: readonly Place[];
  byId: ReadonlyMap<string, Place>;
  index: readonly IndexedPlace[];
  sources: Record<string, string>;
}

/** Decode the compact JSON into places plus a precomputed search index. */
export function buildCatalog(raw: RawCatalog): PlaceCatalog {
  const places: Place[] = [];
  const countryNames = new Map(raw.countries.map((c) => [c[0], c[1]]));

  for (const [iso, name, kind, sovereignIso, designation, alts, populationK] of raw.countries) {
    places.push({
      id: `iso:${iso}`,
      kind: kind === "t" ? "territory" : "country",
      name,
      isoCode: iso,
      countryName: kind === "t" ? (countryNames.get(sovereignIso) ?? name) : name,
      ...(kind === "t" ? { sovereignIso } : {}),
      ...(designation ? { designation } : {}),
      populationK,
      alternateNames: alts,
    });
  }
  for (const [id, name, iso, admin1, populationK, flags, alts] of raw.cities) {
    places.push({
      id: `gn:${id}`,
      kind: "city",
      name,
      isoCode: iso,
      countryName: countryNames.get(iso) ?? iso,
      ...(admin1 >= 0 && raw.admin1[admin1] !== name ? { regionName: raw.admin1[admin1] } : {}),
      populationK,
      isCapital: (flags & 1) === 1,
      alternateNames: alts,
    });
  }

  const byId = new Map(places.map((p) => [p.id, p]));
  const index = places.map((place): IndexedPlace => {
    const name = normalizeText(place.name);
    const context = [place.countryName, place.regionName ?? ""].map(normalizeText).filter(Boolean);
    if (place.kind === "city") {
      const country = byId.get(`iso:${place.isoCode}`);
      if (country?.sovereignIso) context.push(normalizeText(countryNames.get(country.sovereignIso) ?? ""));
    }
    // Countries/territories first, then bigger places; capped so a megacity doesn't beat an exact match.
    const size = Math.log10((place.populationK ?? 0) + 1);
    const boost = place.kind === "city" ? Math.min(14, size * 3.5) + (place.isCapital ? 2 : 0) : 18 + size * 0.5;
    return { place, name, words: name.split(" "), alts: place.alternateNames.map(normalizeText), context, boost };
  });

  return { places, byId, index, sources: raw.sources };
}

/** True when every query token is a prefix of some word in `words`. */
function tokensPrefixWords(tokens: readonly string[], words: readonly string[]): boolean {
  return tokens.every((t) => words.some((w) => w.startsWith(t)));
}

/** Levenshtein distance ≤ 1, for small typos ("pariss", "barcelna"). */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function scoreEntry(entry: IndexedPlace, q: string, tokens: readonly string[]): number {
  const { name, words, alts, context } = entry;
  if (name === q) return 100;
  if (name.startsWith(q)) return 85;
  if (tokensPrefixWords(tokens, words)) return 75;
  if (alts.includes(q)) return 70;
  if (alts.some((a) => a.startsWith(q))) return 60;
  // "paris france", "busan korea": at least one token names the place, the rest its country/region.
  if (tokens.length > 1) {
    const nameHit = tokens.some((t) => words.some((w) => w.startsWith(t)));
    if (nameHit) {
      const contextWords = context.flatMap((c) => c.split(" "));
      if (tokens.every((t) => words.some((w) => w.startsWith(t)) || contextWords.some((w) => w.startsWith(t)))) return 55;
    }
  }
  if (q.length >= 3 && name.includes(q)) return 40;
  if (q.length >= 3 && alts.some((a) => a.includes(q))) return 30;
  return 0;
}

/**
 * Rank places for a query. Case-, accent- and punctuation-insensitive; matches
 * names, word prefixes, alternate spellings, "city country" pairs and, when
 * little else matches, one-letter typos.
 */
export function searchPlaces(catalog: PlaceCatalog, query: string, limit = 30): Place[] {
  const q = normalizeText(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const hits: { place: Place; score: number }[] = [];
  for (const entry of catalog.index) {
    const base = scoreEntry(entry, q, tokens);
    if (base > 0) hits.push({ place: entry.place, score: base + entry.boost });
  }
  if (hits.length < 5 && q.length >= 4) {
    for (const entry of catalog.index) {
      if (hits.some((h) => h.place === entry.place)) continue;
      // Whole-name typo ("pariss") or a typo within the first letters ("barcelna…").
      if (withinOneEdit(q, entry.name) || withinOneEdit(q, entry.name.slice(0, q.length))) {
        hits.push({ place: entry.place, score: 20 + entry.boost });
      }
    }
  }
  return hits
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
    .slice(0, limit)
    .map((h) => h.place);
}
