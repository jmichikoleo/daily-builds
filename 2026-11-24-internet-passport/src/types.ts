// src/types.ts
// every shape the app uses. curated content (territories, destinations,
// expeditions, achievements) is static and lives in src/data.
// mutable explorer data lives in PassportState and is saved to localStorage.

export type TerritoryId =
  | "creative"
  | "science"
  | "sound"
  | "frontier"
  | "oddlands"
  | "archive"
  | "playground"
  | "quiet"
  | "hidden";

export type Rarity = "common" | "rare" | "legendary" | "secret";

export type StampShape =
  | "circle"
  | "rect"
  | "oval"
  | "triangle"
  | "hexagon"
  | "octagon"
  | "postage"
  | "shield"
  | "ticket"
  | "star"
  | "diamond"
  | "cloud"
  | "arch"
  | "blob";

export type StampBorder = "double" | "dashed" | "dotted" | "solid" | "rays" | "thick";

/** the look of one stamp. every stamp in the game has its own combination */
export interface StampDesign {
  shape: StampShape;
  glyph: string; // key into the glyph library in components/glyphs.tsx
  border: StampBorder;
  ink: string; // hex
  tilt: number; // degrees
  label: string; // short text that curves or sits on the stamp
}

export interface Territory {
  id: TerritoryId;
  name: string;
  short: string; // short label for board and chips
  code: string; // three letter flight prefix
  theme: string;
  blurb: string;
  color: string; // accent
  ink: string; // darker ink for stamps
  emblem: string; // glyph key
  hidden?: boolean;
}

export interface AccessNote {
  kind: "free" | "account-optional" | "account-required" | "partly-paid" | "ads";
  text: string;
}

export type ContentWarning = "flashing" | "sudden-audio" | "audio" | "motion" | "random-links" | "uploads" | "long-session";

export interface Destination {
  id: string; // stable, never renamed
  name: string;
  url: string;
  description: string;
  territory: TerritoryId;
  tags: string[];
  minutes: number; // estimated exploration time
  rarity: Rarity;
  stamp: StampDesign;
  question: string; // optional reflection prompt after the visit
  access?: AccessNote;
  warnings?: ContentWarning[];
  /** only for hidden destinations */
  secret?: { hint: string; unlock: UnlockCondition };
}

export type UnlockCondition =
  | { type: "territoryVisits"; territory: TerritoryId; count: number }
  | { type: "territoriesExplored"; count: number }
  | { type: "expeditionComplete"; expeditionId: string }
  | { type: "discovery"; key: DiscoveryKey }
  | { type: "stampCombo"; destinationIds: string[] }
  | { type: "totalVisits"; count: number }
  | { type: "journalEntries"; count: number }
  | { type: "secretsVisited"; count: number }
  | { type: "expeditionsCompleted"; count: number }
  | { type: "nightVisit" };

/** concealed interactive elements around the app */
export type DiscoveryKey = "bottle" | "clock" | "emblem";

export interface Expedition {
  id: string;
  number: number;
  title: string;
  intro: string;
  destinationIds: string[];
  objectives: string[];
  prompts: string[];
  poster: { sky: string; ground: string; motif: string };
  stamp: StampDesign;
  rarity: Rarity;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  hint: string; // shown while locked
  rarity: Rarity;
  condition: UnlockCondition;
  stamp: StampDesign;
}

/** one collectible stamp in the catalog, whatever earned it */
export interface Stamp {
  id: string; // "dest:radio-garden", "ach:first-departure", "terr:sound", "exp:weird", "welcome"
  kind: "destination" | "achievement" | "territory" | "expedition" | "welcome";
  name: string;
  rarity: Rarity;
  design: StampDesign;
  sourceId: string; // destination, achievement, territory or expedition id
}

export interface ExplorerProfile {
  name: string;
  alias: string;
  photo: string | null; // small jpeg data url, never leaves the browser
  homeCountry: string;
  favoriteTerritories: TerritoryId[];
  motto: string;
  coverColor: string;
  passportNumber: string;
  issuedAt: string; // iso
  classification: string;
}

export interface Visit {
  id: string;
  destinationId: string;
  visitedAt: string; // iso
  reflection: string;
}

export interface CollectedStamp {
  stampId: string;
  earnedAt: string;
}

export interface ExpeditionProgress {
  expeditionId: string;
  startedAt: string;
  completedAt: string | null;
}

export interface JournalEntry {
  id: string;
  destinationId: string | null;
  date: string; // yyyy-mm-dd
  rating: number; // 0-5
  favorite: string;
  reflection: string;
  tags: string[];
  revisit: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  motion: "system" | "reduced" | "full";
  sound: boolean;
  atlasView: "map" | "list";
}

export interface PassportState {
  schemaVersion: number;
  profile: ExplorerProfile | null;
  visits: Visit[];
  stamps: Record<string, CollectedStamp>;
  unlockedSecrets: Record<string, string>; // destination id -> iso
  discoveries: Record<string, string>; // discovery key -> iso
  expeditions: Record<string, ExpeditionProgress>;
  journal: JournalEntry[];
  favorites: string[];
  preferences: UserPreferences;
  /** set when the explorer leaves for a destination, cleared on confirm */
  departure: { destinationId: string; at: string } | null;
}

/** something that happened because of an action, shown as a little ceremony */
export type Award =
  | { type: "stamp"; stampId: string }
  | { type: "secret"; destinationId: string };
