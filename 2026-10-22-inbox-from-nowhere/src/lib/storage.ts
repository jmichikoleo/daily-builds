import type { AppState, Email } from '../types';
import { createInitialState, defaultSettings, MAX_SIGNATURES } from './mailbox';

export const STORAGE_KEY = 'inbox-from-nowhere:v1';

function isEmail(x: unknown): x is Email {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.subject === 'string' &&
    typeof e.body === 'string' &&
    typeof e.timestamp === 'string' &&
    !!e.sender &&
    typeof (e.sender as Record<string, unknown>).name === 'string' &&
    (e.folder === 'inbox' || e.folder === 'archive' || e.folder === 'trash')
  );
}

/** Parse and validate stored state. Falls back to a fresh inbox on anything odd. */
export function parseState(raw: string | null): AppState {
  const fresh = createInitialState();
  if (!raw) return fresh;
  try {
    const data = JSON.parse(raw) as Partial<AppState>;
    if (data.version !== 1 || !Array.isArray(data.emails)) return fresh;
    const lore = data.lore && typeof data.lore === 'object' ? { ...fresh.lore, ...data.lore } : fresh.lore;
    if (!Array.isArray(lore.facts)) lore.facts = fresh.lore.facts;
    return {
      version: 1,
      emails: data.emails.filter(isEmail),
      lore,
      settings: { ...defaultSettings(), ...(data.settings ?? {}) },
      recentSignatures: Array.isArray(data.recentSignatures)
        ? data.recentSignatures.filter((s): s is string => typeof s === 'string').slice(0, MAX_SIGNATURES)
        : [],
    };
  } catch {
    return fresh;
  }
}

export function loadState(): AppState {
  try {
    return parseState(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createInitialState();
  }
}

export function saveState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be full or blocked (private mode). The app still works in memory.
  }
}
