// src/state/useSong.ts
// loads a song, autosaves it, and keeps undo/redo history for note edits.
import { useCallback, useEffect, useRef, useState } from "react";
import { getSong, saveSong } from "../lib/db";
import type { Song } from "../lib/types";

type SaveState = "saved" | "saving" | "error";
const HISTORY_LIMIT = 100;

export function useSong(id: string) {
  const [song, setSong] = useState<Song | null | undefined>(undefined); // undefined = loading, null = missing
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const past = useRef<Song[]>([]);
  const future = useRef<Song[]>([]);
  const [, bump] = useState(0);
  const latest = useRef<Song | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    getSong(id).then((s) => {
      if (!s) return setSong(null);
      latest.current = s; // getSong already migrated it to the current shape
      setSong(s);
    });
  }, [id]);

  const persist = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!latest.current) return;
    setSaveState("saving");
    try {
      await saveSong(latest.current);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  // flush pending saves when leaving the page
  useEffect(() => {
    const flush = () => { if (latest.current) saveSong(latest.current); };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); window.clearTimeout(timer.current); flush(); };
  }, []);

  /** Apply a change. `undoable` edits (notes, transpose, etc.) go on the undo stack. */
  const update = useCallback((fn: (s: Song) => Song, opts: { undoable?: boolean } = {}) => {
    const prev = latest.current;
    if (!prev) return;
    const next = fn(prev);
    if (next === prev) return;
    if (opts.undoable) {
      past.current = [...past.current.slice(-HISTORY_LIMIT + 1), prev];
      future.current = [];
    }
    latest.current = next;
    setSong(next);
    setSaveState("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(persist, 600);
    bump((x) => x + 1);
  }, [persist]);

  // Undo restores note-level edits (melody, layer notes, tempo grid, section markers), not titles, lyrics or recordings.
  const restore = (from: Song, to: Song): Song => ({
    ...to, notes: from.notes, originalNotes: from.originalNotes, bpm: from.bpm, transcribedBpm: from.transcribedBpm, markers: from.markers,
    layer: from.layer && to.layer ? { ...to.layer, notes: from.layer.notes, offset: from.layer.offset } : to.layer,
  });

  /** Forget undo history (after switching versions, so undo can't pull in another version's notes). */
  const resetHistory = useCallback(() => { past.current = []; future.current = []; bump((x) => x + 1); }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev || !latest.current) return;
    future.current.push(latest.current);
    update((s) => restore(prev, s));
  }, [update]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next || !latest.current) return;
    past.current.push(latest.current);
    update((s) => restore(next, s));
  }, [update]);

  return {
    song, update, undo, redo, resetHistory, saveState, saveNow: persist, get: () => latest.current,
    canUndo: past.current.length > 0, canRedo: future.current.length > 0,
  };
}
