import { createSampleInbox } from '../data/emails';
import { defaultLore } from '../data/lore';
import type { AppState, Email, IntensityFilter, Lore, Settings, View } from '../types';

export const MAX_SIGNATURES = 120;

export function defaultSettings(): Settings {
  const prefersReduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { defaultIntensity: 'mild', sound: false, reduceMotion: prefersReduced };
}

export function createInitialState(now = Date.now()): AppState {
  return {
    version: 1,
    emails: createSampleInbox(now),
    lore: { ...defaultLore, facts: [...defaultLore.facts] },
    settings: defaultSettings(),
    recentSignatures: [],
  };
}

export type Action =
  | { type: 'markRead'; id: string; read: boolean }
  | { type: 'toggleStar'; id: string }
  | { type: 'archive'; id: string }
  | { type: 'trash'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'deleteForever'; id: string }
  | { type: 'emptyTrash' }
  | { type: 'addEmail'; email: Email; signature?: string }
  | { type: 'updateLore'; lore: Lore }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'reset'; now?: number };

function updateEmail(state: AppState, id: string, fn: (e: Email) => Email): AppState {
  return { ...state, emails: state.emails.map((e) => (e.id === id ? fn(e) : e)) };
}

export function mailboxReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'markRead':
      return updateEmail(state, action.id, (e) => ({ ...e, read: action.read }));
    case 'toggleStar':
      return updateEmail(state, action.id, (e) => ({ ...e, starred: !e.starred }));
    case 'archive':
      return updateEmail(state, action.id, (e) => ({ ...e, folder: 'archive', previousFolder: e.folder }));
    case 'trash':
      return updateEmail(state, action.id, (e) =>
        e.folder === 'trash' ? e : { ...e, folder: 'trash', previousFolder: e.folder },
      );
    case 'restore':
      return updateEmail(state, action.id, (e) => {
        // Trash goes back where it came from; archive (or anything else) goes to the inbox.
        const target = e.folder === 'trash' && e.previousFolder && e.previousFolder !== 'trash' ? e.previousFolder : 'inbox';
        return { ...e, folder: target, previousFolder: undefined };
      });
    case 'deleteForever':
      return { ...state, emails: state.emails.filter((e) => !(e.id === action.id && e.folder === 'trash')) };
    case 'emptyTrash':
      return { ...state, emails: state.emails.filter((e) => e.folder !== 'trash') };
    case 'addEmail': {
      const recentSignatures = action.signature
        ? [action.signature, ...state.recentSignatures].slice(0, MAX_SIGNATURES)
        : state.recentSignatures;
      return { ...state, emails: [action.email, ...state.emails], recentSignatures };
    }
    case 'updateLore':
      return { ...state, lore: action.lore };
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'reset': {
      const fresh = createInitialState(action.now);
      // Reset the inbox but keep the user's lore and settings.
      return { ...fresh, lore: state.lore, settings: state.settings };
    }
    default:
      return state;
  }
}

export function emailsForView(emails: Email[], view: View): Email[] {
  switch (view) {
    case 'inbox':
      return emails.filter((e) => e.folder === 'inbox');
    case 'unread':
      return emails.filter((e) => e.folder === 'inbox' && !e.read);
    case 'starred':
      return emails.filter((e) => e.starred && e.folder !== 'trash');
    case 'archive':
      return emails.filter((e) => e.folder === 'archive');
    case 'trash':
      return emails.filter((e) => e.folder === 'trash');
    default:
      return [];
  }
}

export function searchEmails(emails: Email[], query: string, intensity: IntensityFilter): Email[] {
  const q = query.trim().toLowerCase();
  return emails.filter((e) => {
    if (intensity !== 'all' && e.intensity !== intensity) return false;
    if (!q) return true;
    return [e.sender.name, e.sender.address, e.subject, e.body].some((f) => f.toLowerCase().includes(q));
  });
}

export function countsFor(emails: Email[]): Record<Exclude<View, 'settings'>, number> {
  return {
    inbox: emails.filter((e) => e.folder === 'inbox').length,
    unread: emails.filter((e) => e.folder === 'inbox' && !e.read).length,
    starred: emails.filter((e) => e.starred && e.folder !== 'trash').length,
    archive: emails.filter((e) => e.folder === 'archive').length,
    trash: emails.filter((e) => e.folder === 'trash').length,
  };
}
