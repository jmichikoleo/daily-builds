// src/lib/migrate.ts
// brings any stored song (v1 or v1.1) up to the current shape when it's read.
// nothing is rewritten in the database until the song is next saved, and recordings are never touched.
import type { Arrangement, CoverConfig, HumLayer, MelodyVersion, Note, SectionMarker, Song, VersionData } from "./types";
import { VERSION_FIELDS } from "./types";
import { defaultArrangement, defaultEffects } from "./moods";
import { cleanGrid, presetGrid } from "./theory";
import { SECTION_TYPES } from "./markers";
import { clampBpm, DEFAULT_BPM } from "./tempo";

export const SCHEMA_VERSION = 2;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function cleanNotes(v: unknown): Note[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((n) => n && typeof n === "object" && Number.isFinite(n.midi) && Number.isFinite(n.start) && Number.isFinite(n.duration))
    .map((n) => ({
      id: typeof n.id === "string" && n.id ? n.id : crypto.randomUUID(),
      midi: Math.max(0, Math.min(127, Math.round(n.midi))),
      start: Math.max(0, n.start),
      duration: Math.max(0.01, n.duration),
      velocity: Math.max(0, Math.min(1, num(n.velocity, 0.8))),
    }));
}

function cleanArrangement(raw: Raw | undefined): Arrangement {
  const d = defaultArrangement();
  const a: Raw = { ...d, ...(raw ?? {}) };
  // v1 stored a drum preset name and one reverb number
  let drums = raw?.drums ? cleanGrid(raw.drums) : null;
  if (!drums) {
    const legacy = typeof a.drumPattern === "string" ? a.drumPattern : "softPop";
    drums = legacy === "none" ? cleanGrid(null) : presetGrid(legacy);
  }
  const fx = raw?.effects ?? {};
  const effects = {
    ...defaultEffects(),
    reverb: num(fx.reverb, num(a.reverb, 0.25)),
    delay: num(fx.delay, 0),
    tone: Math.max(-1, Math.min(1, num(fx.tone, 0))),
    enabled: fx.enabled !== false,
  };
  const tracks = { ...d.tracks, ...(a.tracks ?? {}) };
  const { drumPattern: _dp, reverb: _rv, ...rest } = a;
  void _dp; void _rv;
  return { ...(rest as Arrangement), drums, effects, tracks };
}

function cleanLayer(raw: Raw | null | undefined, songId: string): HumLayer | null {
  if (!raw || typeof raw !== "object") return null;
  const hasRecording = !!raw.hasRecording;
  return {
    notes: cleanNotes(raw.notes),
    originalNotes: cleanNotes(raw.originalNotes),
    instrument: typeof raw.instrument === "string" ? raw.instrument : "bells",
    offset: num(raw.offset, 0),
    hasRecording,
    recordingKey: typeof raw.recordingKey === "string" ? raw.recordingKey : hasRecording ? `${songId}:layer` : null,
  };
}

function cleanMarkers(v: unknown): SectionMarker[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((m) => m && typeof m === "object" && Number.isFinite(m.beat))
    .map((m) => ({
      id: typeof m.id === "string" && m.id ? m.id : crypto.randomUUID(),
      type: SECTION_TYPES.some((t) => t.id === m.type) ? m.type : "custom",
      label: typeof m.label === "string" ? m.label.slice(0, 40) : "section",
      beat: Math.max(0, m.beat),
      lyricId: typeof m.lyricId === "string" ? m.lyricId : null,
    }))
    .sort((a, b) => a.beat - b.beat);
}

/** Normalize the musical part (what a version holds). */
export function cleanVersionData(raw: Raw, songId: string): VersionData {
  const hasRecording = !!raw.hasRecording;
  return {
    durationSec: num(raw.durationSec, 0),
    peaks: Array.isArray(raw.peaks) ? raw.peaks.filter((p: unknown) => typeof p === "number") : [],
    bpm: clampBpm(num(raw.bpm, DEFAULT_BPM)),
    transcribedBpm: clampBpm(num(raw.transcribedBpm, num(raw.bpm, DEFAULT_BPM))),
    notes: cleanNotes(raw.notes),
    originalNotes: cleanNotes(raw.originalNotes),
    leadInstrument: typeof raw.leadInstrument === "string" ? raw.leadInstrument : "piano",
    hasRecording,
    recordingMime: typeof raw.recordingMime === "string" ? raw.recordingMime : null,
    transcriptionWarning: typeof raw.transcriptionWarning === "string" ? raw.transcriptionWarning : null,
    arrangement: cleanArrangement(raw.arrangement),
    layer: cleanLayer(raw.layer, songId),
    leadRecordingKey: typeof raw.leadRecordingKey === "string" ? raw.leadRecordingKey : hasRecording ? `${songId}:lead` : null,
    markers: cleanMarkers(raw.markers),
  };
}

function cleanCover(raw: unknown): CoverConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Raw;
  const bg = ["solid", "gradient", "pattern", "image"].includes(c.background) ? c.background : "gradient";
  const pattern = ["dots", "stripes", "hearts", "notes", "checks"].includes(c.pattern) ? c.pattern : "dots";
  const color = (v: unknown, f: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : f);
  return {
    background: bg,
    color: color(c.color, "#F7DDE5"),
    color2: color(c.color2, "#DCD0F3"),
    pattern,
    subtitle: typeof c.subtitle === "string" ? c.subtitle.slice(0, 60) : "",
    textColor: color(c.textColor, "#39343B"),
    imageKey: typeof c.imageKey === "string" ? c.imageKey : null,
  };
}

/** Any stored song → current Song. Safe to call repeatedly. */
export function normalizeSong(raw: Raw): Song {
  const id = String(raw.id);
  const music = cleanVersionData(raw, id);
  const now = Date.now();
  let versions: MelodyVersion[] = Array.isArray(raw.versions)
    ? raw.versions
        .filter((v: Raw) => v && typeof v.id === "string")
        .map((v: Raw) => ({
          id: v.id,
          name: typeof v.name === "string" && v.name.trim() ? v.name.slice(0, 40) : "untitled version",
          createdAt: num(v.createdAt, now),
          updatedAt: num(v.updatedAt, now),
          data: v.data && typeof v.data === "object" ? cleanVersionData(v.data, id) : null,
        }))
    : [];
  if (!versions.length) versions = [{ id: `${id}:v1`, name: "original melody", createdAt: num(raw.createdAt, now), updatedAt: num(raw.updatedAt, now), data: null }];
  const activeVersionId = versions.some((v) => v.id === raw.activeVersionId) ? raw.activeVersionId : versions[0].id;
  // the active version's data lives on the song itself
  versions = versions.map((v) => (v.id === activeVersionId ? { ...v, data: null } : v.data ? v : { ...v, data: pickVersionData(music) }));
  return {
    id,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "untitled hum",
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
    ...music,
    lyrics: Array.isArray(raw.lyrics)
      ? raw.lyrics.filter((l: Raw) => l && typeof l.id === "string").map((l: Raw) => ({ id: l.id, title: String(l.title ?? "section").slice(0, 40), text: String(l.text ?? "") }))
      : [],
    schemaVersion: SCHEMA_VERSION,
    versions,
    activeVersionId,
    cover: cleanCover(raw.cover),
    takes: Array.isArray(raw.takes)
      ? raw.takes.filter((t: Raw) => t && typeof t.id === "string" && typeof t.recordingKey === "string")
          .map((t: Raw) => ({ id: t.id, recordingKey: t.recordingKey, start: num(t.start, 0), end: num(t.end, 0), createdAt: num(t.createdAt, now) }))
      : [],
  };
}

export function pickVersionData(s: VersionData): VersionData {
  const out = {} as Record<string, unknown>;
  for (const k of VERSION_FIELDS) out[k] = structuredClone(s[k]);
  return out as unknown as VersionData;
}
