import type { PlaceSnapshot } from "./types";

/**
 * Phase 1 shipped a 24-place demo dataset with ids like `city:kr-busan`.
 * This table maps each of those ids to its catalog id and a snapshot, so
 * saved Phase 1 drafts migrate without loading the catalog. City ids are
 * the GeoNames ids found in public/data/catalog.v1.json.
 */
type LegacyEntry = { placeId: string; place: PlaceSnapshot };

const country = (iso: string, name: string, motif: PlaceSnapshot["motif"]): LegacyEntry => ({
  placeId: `iso:${iso}`,
  place: { name, kind: "country", isoCode: iso, countryName: name, motif },
});

const city = (
  geonameId: number,
  name: string,
  iso: string,
  countryName: string,
  regionName: string | undefined,
  motif: PlaceSnapshot["motif"],
): LegacyEntry => ({
  placeId: `gn:${geonameId}`,
  place: { name, kind: "city", isoCode: iso, countryName, ...(regionName ? { regionName } : {}), motif },
});

export const LEGACY_PLACES: Readonly<Record<string, LegacyEntry>> = {
  "country:KR": country("KR", "South Korea", "temple"),
  "country:JP": country("JP", "Japan", "mountain"),
  "country:CN": country("CN", "China", "lantern"),
  "country:SG": country("SG", "Singapore", "skyline"),
  "country:ID": country("ID", "Indonesia", "palm"),
  "country:ES": country("ES", "Spain", "spires"),
  "country:FR": country("FR", "France", "tower"),
  "region:HK": {
    placeId: "iso:HK",
    place: {
      name: "Hong Kong",
      kind: "territory",
      isoCode: "HK",
      countryName: "China",
      designation: "Special Administrative Region of China",
      motif: "boat",
    },
  },
  "city:kr-seoul": city(1835848, "Seoul", "KR", "South Korea", undefined, "temple"),
  "city:kr-busan": city(1838524, "Busan", "KR", "South Korea", undefined, "wave"),
  "city:kr-jeju": city(1846266, "Jeju City", "KR", "South Korea", "Jeju-do", "mountain"),
  "city:jp-tokyo": city(1850147, "Tokyo", "JP", "Japan", undefined, "blossom"),
  "city:jp-osaka": city(1853909, "Osaka", "JP", "Japan", undefined, "lantern"),
  "city:jp-kyoto": city(1857910, "Kyoto", "JP", "Japan", undefined, "temple"),
  "city:cn-beijing": city(1816670, "Beijing", "CN", "China", undefined, "temple"),
  "city:cn-shanghai": city(1796236, "Shanghai", "CN", "China", undefined, "skyline"),
  "city:cn-zhuhai": city(1790437, "Zhuhai", "CN", "China", "Guangdong", "wave"),
  "city:es-barcelona": city(3128760, "Barcelona", "ES", "Spain", "Catalonia", "spires"),
  "city:es-madrid": city(3117735, "Madrid", "ES", "Spain", undefined, "sun"),
  "city:fr-paris": city(2988507, "Paris", "FR", "France", "Île-de-France", "tower"),
  "city:fr-nice": city(2990440, "Nice", "FR", "France", "Provence-Alpes-Côte d'Azur", "wave"),
  "city:id-jakarta": city(1642911, "Jakarta", "ID", "Indonesia", undefined, "skyline"),
  "city:id-yogyakarta": city(1621177, "Yogyakarta", "ID", "Indonesia", undefined, "temple"),
  "city:id-denpasar": city(1645528, "Denpasar", "ID", "Indonesia", "Bali", "palm"),
};

/** Best-effort readable name for an id we can't map: `city:xx-new-york` → "New York". */
export function nameFromLegacyId(id: string): string {
  const tail = id.split(":").pop() ?? id;
  const words = tail.replace(/^[a-z]{2}-/, "").split(/[-_]+/).filter(Boolean);
  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return name || id;
}
