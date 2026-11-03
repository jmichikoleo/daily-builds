import type { MotifId } from "../stamps/motifs";

/**
 * - `country`: a sovereign state, per Natural Earth.
 * - `territory`: has its own ISO code but belongs to a sovereign state
 *   (Hong Kong → China, Greenland → Denmark, Puerto Rico → United States).
 * - `city`: a populated place from GeoNames.
 */
export type PlaceKind = "country" | "territory" | "city";

/** A searchable destination, decoded from public/data/catalog.v1.json. */
export interface Place {
  /** Stable id: `iso:KR` for countries/territories, `gn:1838524` (GeoNames id) for cities. */
  id: string;
  kind: PlaceKind;
  name: string;
  /** ISO 3166-1 alpha-2 of the place (cities: of their country or territory). */
  isoCode: string;
  /** City → its country/territory name; territory → sovereign name; country → own name. */
  countryName: string;
  /** Territory → sovereign ISO code. */
  sovereignIso?: string;
  /** City → state/province name. */
  regionName?: string;
  /** e.g. "Special Administrative Region of China", "Territory of Denmark". */
  designation?: string;
  /** Thousands of people. */
  populationK?: number;
  isCapital?: boolean;
  alternateNames: readonly string[];
}

/**
 * What a collected stamp remembers about its place. Stored in the draft, so
 * the studio and collage render without loading the catalog, and old stamps
 * survive future catalog changes.
 */
export interface PlaceSnapshot {
  name: string;
  kind: PlaceKind;
  isoCode: string;
  countryName: string;
  regionName?: string;
  designation?: string;
  motif: MotifId;
}

/** Compact on-disk format written by scripts/build-catalog.mjs. */
export interface RawCatalog {
  version: 1;
  generatedAt: string;
  sources: Record<string, string>;
  /** [iso, name, kind c|t, sovereignIso, designation, alternateNames, populationK] */
  countries: [string, string, "c" | "t", string, string, string[], number][];
  admin1: string[];
  /** [geonameId, name, iso, admin1Index, populationK, flags (1 = capital), alternateNames] */
  cities: [number, string, string, number, number, number, string[]][];
}
