import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { LEGACY_PLACES } from "./legacy";
import { buildCatalog, searchPlaces, type PlaceCatalog } from "./search";
import { snapshotOf } from "./snapshot";
import type { RawCatalog } from "./types";

let catalog: PlaceCatalog;

beforeAll(() => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "public/data/catalog.v1.json"), "utf8")) as RawCatalog;
  catalog = buildCatalog(raw);
});

const top = (q: string) => searchPlaces(catalog, q, 5)[0];
const describeTop = (q: string) => {
  const p = top(q);
  return p ? `${p.name} (${p.kind}, ${p.countryName})` : "none";
};

describe("searchPlaces", () => {
  it("finds the spec examples first", () => {
    expect(describeTop("Korea")).toBe("South Korea (country, South Korea)");
    expect(describeTop("Busan")).toBe("Busan (city, South Korea)");
    expect(describeTop("Paris")).toBe("Paris (city, France)");
    expect(describeTop("Barcelona")).toBe("Barcelona (city, Spain)");
    expect(describeTop("Zhuhai")).toBe("Zhuhai (city, China)");
  });

  it("treats Hong Kong as a territory of China, not a sovereign state", () => {
    const hk = top("Hong Kong");
    expect(hk.id).toBe("iso:HK");
    expect(hk.kind).toBe("territory");
    expect(hk.sovereignIso).toBe("CN");
    expect(hk.designation).toBe("Special Administrative Region of China");
    // Searching "China" should not surface Hong Kong as China.
    expect(top("China").id).toBe("iso:CN");
  });

  it("matches partial, case-insensitive and accent-insensitive queries", () => {
    expect(top("barc").name).toBe("Barcelona");
    expect(top("BUSAN").name).toBe("Busan");
    expect(top("sao paulo").name).toBe("São Paulo");
    expect(top("zurich").name).toBe("Zürich");
  });

  it("matches alternate spellings and small typos", () => {
    expect(top("Pusan").name).toBe("Busan");
    expect(top("Bombay").name).toBe("Mumbai");
    expect(top("Saigon").name).toBe("Ho Chi Minh City");
    expect(top("Pariss").name).toBe("Paris");
  });

  it("understands 'city country' queries", () => {
    expect(describeTop("paris texas")).toBe("Paris (city, United States)");
    expect(describeTop("busan korea")).toBe("Busan (city, South Korea)");
  });

  it("returns nothing for empty queries", () => {
    expect(searchPlaces(catalog, "   ")).toEqual([]);
  });

  it("is fast enough to run on every keystroke", () => {
    const start = performance.now();
    for (const q of ["s", "se", "seo", "seou", "seoul"]) searchPlaces(catalog, q);
    expect((performance.now() - start) / 5).toBeLessThan(50);
  });
});

describe("catalog data", () => {
  it("contains every legacy Phase 1 place with matching name and country", () => {
    for (const { placeId, place } of Object.values(LEGACY_PLACES)) {
      const found = catalog.byId.get(placeId);
      expect(found, placeId).toBeDefined();
      expect(found!.name).toBe(place.name);
      expect(found!.isoCode).toBe(place.isoCode);
      expect(snapshotOf(found!).countryName).toBe(place.countryName);
    }
  });

  it("uses stable ids", () => {
    expect(catalog.byId.get("iso:KR")?.name).toBe("South Korea");
    expect(catalog.byId.get("gn:1838524")?.name).toBe("Busan");
  });
});
