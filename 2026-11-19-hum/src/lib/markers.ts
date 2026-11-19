// src/lib/markers.ts
// song section markers and how they connect to the lyrics notebook.
import type { LyricSection, SectionMarker, SectionType } from "./types";

export const SECTION_TYPES: { id: SectionType; label: string; color: string; lyrics: string }[] = [
  { id: "intro", label: "intro", color: "#E8E2F7", lyrics: "Intro" },
  { id: "verse", label: "verse", color: "#D4EDE4", lyrics: "Verse" },
  { id: "preChorus", label: "pre-chorus", color: "#FFF0BE", lyrics: "Pre-Chorus" },
  { id: "chorus", label: "chorus", color: "#F7DDE5", lyrics: "Chorus" },
  { id: "postChorus", label: "post-chorus", color: "#FBE3EC", lyrics: "Post-Chorus" },
  { id: "bridge", label: "bridge", color: "#DCD0F3", lyrics: "Bridge" },
  { id: "instrumental", label: "instrumental", color: "#E3EEF8", lyrics: "Instrumental" },
  { id: "outro", label: "outro", color: "#EDE6DF", lyrics: "Outro" },
  { id: "custom", label: "custom", color: "#F1ECEF", lyrics: "Section" },
];
export const sectionInfo = (t: SectionType) => SECTION_TYPES.find((x) => x.id === t) ?? SECTION_TYPES[SECTION_TYPES.length - 1];

const sorted = (ms: SectionMarker[]) => [...ms].sort((a, b) => a.beat - b.beat);

/** "verse 2" style label: counts earlier markers of the same type. */
export function nextLabel(markers: SectionMarker[], type: SectionType): string {
  const base = sectionInfo(type).label;
  const n = markers.filter((m) => m.type === type).length;
  return n === 0 ? base : `${base} ${n + 1}`;
}

/**
 * Add a marker and connect it to a lyrics section. Reuses a lyrics section with the same name
 * that no other marker uses yet, otherwise creates one. Returns both updated lists.
 */
export function addMarker(markers: SectionMarker[], lyrics: LyricSection[], type: SectionType, beat: number):
  { markers: SectionMarker[]; lyrics: LyricSection[]; marker: SectionMarker } {
  const label = nextLabel(markers, type);
  const lyricTitle = sectionInfo(type).lyrics;
  const used = new Set(markers.map((m) => m.lyricId));
  let lyric = lyrics.find((l) => !used.has(l.id) && l.title.toLowerCase().replace(/\s+\d+$/, "") === lyricTitle.toLowerCase());
  let nextLyrics = lyrics;
  if (!lyric) {
    const count = lyrics.filter((l) => l.title.toLowerCase().startsWith(lyricTitle.toLowerCase())).length;
    lyric = { id: crypto.randomUUID(), title: count ? `${lyricTitle} ${count + 1}` : lyricTitle, text: "" };
    nextLyrics = [...lyrics, lyric];
  }
  const marker: SectionMarker = { id: crypto.randomUUID(), type, label, beat: Math.max(0, beat), lyricId: lyric.id };
  return { markers: sorted([...markers, marker]), lyrics: nextLyrics, marker };
}

export const moveMarker = (markers: SectionMarker[], id: string, beat: number) =>
  sorted(markers.map((m) => (m.id === id ? { ...m, beat: Math.max(0, beat) } : m)));

export const updateMarker = (markers: SectionMarker[], id: string, patch: Partial<Omit<SectionMarker, "id">>) =>
  sorted(markers.map((m) => (m.id === id ? { ...m, ...patch } : m)));

/** Deleting a marker never deletes lyrics. */
export const deleteMarker = (markers: SectionMarker[], id: string) => markers.filter((m) => m.id !== id);

/** The beat range a marker covers: from it to the next marker (or the end of the song). */
export function markerRange(markers: SectionMarker[], id: string, songEnd: number): { start: number; end: number } | null {
  const s = sorted(markers);
  const i = s.findIndex((m) => m.id === id);
  if (i < 0) return null;
  const end = s[i + 1]?.beat ?? Math.max(songEnd, s[i].beat + 4);
  return { start: s[i].beat, end };
}

/** A marker whose lyrics section was deleted just loses its link. */
export const pruneLyricLinks = (markers: SectionMarker[], lyrics: LyricSection[]) => {
  const ids = new Set(lyrics.map((l) => l.id));
  return markers.map((m) => (m.lyricId && !ids.has(m.lyricId) ? { ...m, lyricId: null } : m));
};
