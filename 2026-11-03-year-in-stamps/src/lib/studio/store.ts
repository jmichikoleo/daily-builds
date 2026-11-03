"use client";

import { useSyncExternalStore } from "react";
import type { CollageFormatId } from "../collage/formats";
import { currentDraft, onDraftReload, updateDraft } from "../passport/store";
import { MAX_TITLE_LENGTH } from "../passport/types";
import type { ThemeId } from "../themes";
import {
  MAX_FOOTER_LENGTH,
  MAX_SUBTITLE_LENGTH,
  type LayoutPreset,
  type StampOverride,
  type StudioDesign,
} from "./types";

/**
 * Studio edits with a bounded undo/redo history.
 *
 * History holds whole `StudioDesign` snapshots (theme, format, layout, text,
 * background and manual placements), so undo restores positions together
 * with the settings that produced them. Rapid edits that share a `coalesce`
 * key (typing a title, dragging a slider) become one history entry. Drags
 * commit once, on release. History lives in memory only.
 */
const HISTORY_LIMIT = 60;
const COALESCE_MS = 1200;

let past: StudioDesign[] = [];
let future: StudioDesign[] = [];
let lastEdit: { key: string; at: number } | null = null;

type HistoryState = { canUndo: boolean; canRedo: boolean };
let historyState: HistoryState = { canUndo: false, canRedo: false };
const historyListeners = new Set<() => void>();

function publishHistory() {
  const next = { canUndo: past.length > 0, canRedo: future.length > 0 };
  if (next.canUndo !== historyState.canUndo || next.canRedo !== historyState.canRedo) {
    historyState = next;
    for (const l of historyListeners) l();
  }
}

onDraftReload(() => {
  past = [];
  future = [];
  lastEdit = null;
  publishHistory();
});

export function useStudioHistory(): HistoryState {
  return useSyncExternalStore(
    (l) => {
      historyListeners.add(l);
      return () => historyListeners.delete(l);
    },
    () => historyState,
    () => historyState,
  );
}

function edit(change: (studio: StudioDesign) => StudioDesign, coalesce?: string) {
  const draft = currentDraft();
  if (!draft) return;
  const before = draft.studio;
  const after = change(before);
  if (after === before) return;
  const now = Date.now();
  const merge = coalesce !== undefined && lastEdit?.key === coalesce && now - lastEdit.at < COALESCE_MS;
  if (!merge) {
    past.push(before);
    if (past.length > HISTORY_LIMIT) past.shift();
  }
  future = [];
  lastEdit = coalesce ? { key: coalesce, at: now } : null;
  updateDraft((d) => ({ ...d, studio: after }));
  publishHistory();
}

const withOverrides = (s: StudioDesign, formatId: CollageFormatId, next: Record<string, StampOverride>): StudioDesign => ({
  ...s,
  overrides: { ...s.overrides, [formatId]: next },
});

export const studioActions = {
  undo() {
    const draft = currentDraft();
    const previous = past.pop();
    if (!draft || !previous) return;
    future.push(draft.studio);
    lastEdit = null;
    updateDraft((d) => ({ ...d, studio: previous }));
    publishHistory();
  },
  redo() {
    const draft = currentDraft();
    const next = future.pop();
    if (!draft || !next) return;
    past.push(draft.studio);
    lastEdit = null;
    updateDraft((d) => ({ ...d, studio: next }));
    publishHistory();
  },

  /** Restyles everything; destinations, dates, custom inks and styles are untouched. */
  setTheme(themeId: ThemeId) {
    edit((s) => (s.themeId === themeId ? s : { ...s, themeId }));
  },
  setFormat(formatId: CollageFormatId) {
    edit((s) => (s.formatId === formatId ? s : { ...s, formatId }));
  },
  /** A new preset starts from its own arrangement, so manual placements for this format are cleared. */
  setPreset(preset: LayoutPreset) {
    edit((s) => (s.layout.preset === preset ? s : withOverrides({ ...s, layout: { ...s.layout, preset } }, s.formatId, {})));
  },
  /** New seed → new arrangement of the same stamps. */
  shuffle() {
    edit((s) => withOverrides({ ...s, layout: { ...s.layout, seed: s.layout.seed + 1 } }, s.formatId, {}));
  },
  /** Drop manual placements for the current format. */
  resetLayout() {
    edit((s) => (Object.keys(s.overrides[s.formatId]).length ? withOverrides(s, s.formatId, {}) : s));
  },

  setText(patch: Partial<StudioDesign["text"]>, coalesce?: string) {
    const clean = { ...patch };
    if (clean.title !== undefined) clean.title = clean.title.slice(0, MAX_TITLE_LENGTH);
    if (clean.subtitle !== undefined) clean.subtitle = clean.subtitle.slice(0, MAX_SUBTITLE_LENGTH);
    if (clean.footer !== undefined) clean.footer = clean.footer.slice(0, MAX_FOOTER_LENGTH);
    edit((s) => ({ ...s, text: { ...s.text, ...clean } }), coalesce);
  },
  setBackground(patch: Partial<StudioDesign["background"]>) {
    edit((s) => ({ ...s, background: { ...s.background, ...patch } }));
  },
  /** Background back to the theme's own paper, texture, border and accents. */
  resetBackground() {
    edit((s) => ({ ...s, background: { showAccents: true } }));
  },
  /** Text style (font, alignment, colour) back to the theme's defaults; words are kept. */
  resetTextStyle() {
    edit((s) => {
      const { align: _a, font: _f, color: _c, ...rest } = s.text;
      void _a;
      void _f;
      void _c;
      return { ...s, text: rest };
    });
  },

  /** Place one stamp by hand (normalised coordinates). */
  setOverride(entryId: string, override: StampOverride, coalesce?: string) {
    edit((s) => withOverrides(s, s.formatId, { ...s.overrides[s.formatId], [entryId]: override }), coalesce);
  },
  /** Put one stamp back where the layout wants it. */
  clearOverride(entryId: string) {
    edit((s) => {
      if (!(entryId in s.overrides[s.formatId])) return s;
      const next = { ...s.overrides[s.formatId] };
      delete next[entryId];
      return withOverrides(s, s.formatId, next);
    });
  },
};
