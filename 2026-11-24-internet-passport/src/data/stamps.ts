// src/data/stamps.ts
// the full stamp catalog, built from every other piece of curated content.
// one stamp per destination, achievement, territory completion and expedition,
// plus the welcome stamp from the department.

import type { Stamp, StampDesign, TerritoryId } from "../types";
import { DESTINATIONS } from "./destinations";
import { ACHIEVEMENTS } from "./achievements";
import { EXPEDITIONS } from "./expeditions";
import { REGULAR_TERRITORIES } from "./territories";

export const WELCOME_STAMP_ID = "welcome";

const TERRITORY_STAMPS: Record<Exclude<TerritoryId, "hidden">, Pick<StampDesign, "shape" | "glyph">> = {
  creative: { shape: "star", glyph: "palette" },
  science: { shape: "octagon", glyph: "telescope" },
  sound: { shape: "oval", glyph: "note" },
  frontier: { shape: "hexagon", glyph: "gear" },
  oddlands: { shape: "cloud", glyph: "spiral" },
  archive: { shape: "shield", glyph: "scroll" },
  playground: { shape: "postage", glyph: "dice" },
  quiet: { shape: "arch", glyph: "wave" },
};

export const destinationStampId = (id: string) => `dest:${id}`;
export const achievementStampId = (id: string) => `ach:${id}`;
export const territoryStampId = (id: string) => `terr:${id}`;
export const expeditionStampId = (id: string) => `exp:${id}`;

export const STAMPS: Stamp[] = [
  {
    id: WELCOME_STAMP_ID,
    kind: "welcome",
    name: "Passport Issued",
    rarity: "common",
    sourceId: "welcome",
    design: { shape: "circle", glyph: "seal", border: "double", ink: "#783B49", tilt: -8, label: "dept. of internet exploration" },
  },
  ...DESTINATIONS.map<Stamp>((d) => ({
    id: destinationStampId(d.id),
    kind: "destination",
    name: d.name,
    rarity: d.rarity,
    sourceId: d.id,
    design: d.stamp,
  })),
  ...REGULAR_TERRITORIES.map<Stamp>((t, i) => ({
    id: territoryStampId(t.id),
    kind: "territory",
    name: `${t.name} Explored`,
    rarity: "legendary",
    sourceId: t.id,
    design: {
      ...TERRITORY_STAMPS[t.id as Exclude<TerritoryId, "hidden">],
      border: "rays",
      ink: t.ink,
      tilt: (i % 2 ? 1 : -1) * (3 + i),
      label: `${t.short} complete`,
    },
  })),
  ...EXPEDITIONS.map<Stamp>((e) => ({
    id: expeditionStampId(e.id),
    kind: "expedition",
    name: `Expedition ${String(e.number).padStart(3, "0")} Complete`,
    rarity: e.rarity,
    sourceId: e.id,
    design: e.stamp,
  })),
  ...ACHIEVEMENTS.map<Stamp>((a) => ({
    id: achievementStampId(a.id),
    kind: "achievement",
    name: a.name,
    rarity: a.rarity,
    sourceId: a.id,
    design: a.stamp,
  })),
];

const byId = new Map(STAMPS.map((s) => [s.id, s]));

export function stampById(id: string): Stamp | undefined {
  return byId.get(id);
}
