import type { MotifId } from "../stamps/motifs";
import type { Place, PlaceSnapshot } from "./types";

/**
 * Hand-picked motifs for a few well-known places. Keys are ISO codes for
 * countries/territories and `ISO:City name` for cities (names exactly as in
 * GeoNames). Everything else gets a category motif.
 */
const MOTIF_OVERRIDES: Record<string, MotifId> = {
  KR: "temple",
  JP: "mountain",
  CN: "lantern",
  HK: "boat",
  MO: "lantern",
  SG: "skyline",
  ID: "palm",
  ES: "spires",
  FR: "tower",
  "KR:Seoul": "temple",
  "KR:Busan": "wave",
  "KR:Jeju City": "mountain",
  "JP:Tokyo": "blossom",
  "JP:Osaka": "lantern",
  "JP:Kyoto": "temple",
  "CN:Beijing": "temple",
  "CN:Shanghai": "skyline",
  "CN:Zhuhai": "wave",
  "ES:Barcelona": "spires",
  "ES:Madrid": "sun",
  "FR:Paris": "tower",
  "FR:Nice": "wave",
  "ID:Jakarta": "skyline",
  "ID:Yogyakarta": "temple",
  "ID:Denpasar": "palm",
};

/** Location-specific motif if we have one, otherwise one for the kind of place. */
export function motifFor(place: Place): MotifId {
  const key = place.kind === "city" ? `${place.isoCode}:${place.name}` : place.isoCode;
  const override = MOTIF_OVERRIDES[key];
  if (override) return override;
  if (place.kind === "country") return "globe";
  if (place.kind === "territory") return "anchor";
  if (place.isCapital) return "columns";
  return (place.populationK ?? 0) >= 1000 ? "skyline" : "houses";
}

export function snapshotOf(place: Place): PlaceSnapshot {
  return {
    name: place.name,
    kind: place.kind,
    isoCode: place.isoCode,
    countryName: place.countryName,
    ...(place.regionName ? { regionName: place.regionName } : {}),
    ...(place.designation ? { designation: place.designation } : {}),
    motif: motifFor(place),
  };
}

const KIND_LABEL = { country: "Country", territory: "Territory", city: "City" } as const;

export function kindLabel(kind: Place["kind"]): string {
  return KIND_LABEL[kind];
}

/** Where a place is, for lists: "Busan, South Korea" / "Special Administrative Region of China". */
export function placeContext(p: Pick<PlaceSnapshot, "kind" | "countryName" | "regionName" | "designation">): string {
  if (p.kind === "city") return p.regionName ? `${p.regionName}, ${p.countryName}` : p.countryName;
  if (p.kind === "territory") return p.designation ?? `Territory of ${p.countryName}`;
  return "Sovereign country";
}

/** Second line printed on a stamp: country for cities, "SAR · China" style for territories. */
export function stampLabelOf(p: PlaceSnapshot): string {
  if (p.kind === "city") return p.countryName;
  if (p.kind === "territory") {
    return p.designation?.startsWith("Special Administrative Region") ? `SAR · ${p.countryName}` : `Territory · ${p.countryName}`;
  }
  return "Country";
}
