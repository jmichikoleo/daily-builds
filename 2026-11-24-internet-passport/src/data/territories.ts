// src/data/territories.ts
// the nine corners of the internet. eight regular territories plus the hidden one.

import type { Territory, TerritoryId } from "../types";

export const TERRITORIES: Territory[] = [
  {
    id: "creative",
    name: "The Creative Republic",
    short: "creative republic",
    code: "ART",
    theme: "art, illustration, photography, design",
    blurb: "a republic of painters, colour nerds and museum night shifts. bring comfortable shoes.",
    color: "#E9A6AE",
    ink: "#A2465A",
    emblem: "palette",
  },
  {
    id: "science",
    name: "The Science Federation",
    short: "science federation",
    code: "SCI",
    theme: "science, space, mathematics, nature",
    blurb: "observatories on every hill and a tide pool on every corner. curiosity is the official language.",
    color: "#A8B5A0",
    ink: "#4F6B4A",
    emblem: "telescope",
  },
  {
    id: "sound",
    name: "The Sound Islands",
    short: "sound islands",
    code: "MUS",
    theme: "music, sound, experimental audio",
    blurb: "an archipelago you hear before you see. every island hums in a different key.",
    color: "#7E9BB8",
    ink: "#2F4F6E",
    emblem: "note",
  },
  {
    id: "frontier",
    name: "The Digital Frontier",
    short: "digital frontier",
    code: "DGF",
    theme: "technology, coding, interactive explanations",
    blurb: "wide open plains of explorable essays, tiny machines and people who explain things beautifully.",
    color: "#86B0AA",
    ink: "#2C5C5C",
    emblem: "gear",
  },
  {
    id: "oddlands",
    name: "The Oddlands",
    short: "oddlands",
    code: "ODD",
    theme: "weird, funny, absurd websites",
    blurb: "nobody knows who built the oddlands or why. the locals are friendly. some of them are eels.",
    color: "#EBC15A",
    ink: "#93630F",
    emblem: "spiral",
  },
  {
    id: "archive",
    name: "The Archive Kingdom",
    short: "archive kingdom",
    code: "ARC",
    theme: "history, literature, digital archives",
    blurb: "a kingdom of reading rooms, old maps and websites that refused to disappear.",
    color: "#C29D7A",
    ink: "#6B4527",
    emblem: "scroll",
  },
  {
    id: "playground",
    name: "The Playground",
    short: "playground",
    code: "PLY",
    theme: "games and interactive experiences",
    blurb: "a fairground that never closes. everything here is meant to be poked.",
    color: "#E58E73",
    ink: "#A2412A",
    emblem: "dice",
  },
  {
    id: "quiet",
    name: "The Quiet Coast",
    short: "quiet coast",
    code: "QCT",
    theme: "relaxing, atmospheric, mindful websites",
    blurb: "a slow coastline of rain, cafes and open windows. stay as long as you like.",
    color: "#A7AECB",
    ink: "#4B5277",
    emblem: "wave",
  },
  {
    id: "hidden",
    name: "The Hidden Territories",
    short: "hidden territories",
    code: "???",
    theme: "secret unlockable destinations",
    blurb: "places that do not appear on any official map. they find you when you are ready.",
    color: "#8C6A8F",
    ink: "#4A2A4F",
    emblem: "keyhole",
    hidden: true,
  },
];

export const REGULAR_TERRITORIES = TERRITORIES.filter((t) => !t.hidden);

const byId = new Map(TERRITORIES.map((t) => [t.id, t]));

export function territory(id: TerritoryId): Territory {
  const t = byId.get(id);
  if (!t) throw new Error(`unknown territory ${id}`);
  return t;
}
