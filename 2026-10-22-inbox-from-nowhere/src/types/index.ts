export type Intensity = 'mild' | 'personal' | 'devastated';

export type Folder = 'inbox' | 'archive' | 'trash';

export type Category =
  | 'performance-review'
  | 'legal-notice'
  | 'customer-complaint'
  | 'resignation-letter'
  | 'meeting-minutes'
  | 'system-alert'
  | 'personal-letter'
  | 'financial-statement'
  | 'peer-review';

export interface Sender {
  name: string;
  address: string;
}

export interface Email {
  id: string;
  sender: Sender;
  subject: string;
  preview: string;
  body: string;
  /** ISO 8601 string */
  timestamp: string;
  intensity: Intensity;
  category: Category;
  read: boolean;
  starred: boolean;
  folder: Folder;
  /** Folder an email lived in before it was trashed, used by Restore. */
  previousFolder?: Folder;
  /** True for emails created by the roast or comeback engine. */
  generated?: boolean;
}

export interface Lore {
  displayName: string;
  /** The name every project ends up with. */
  petProjectName: string;
  /** The overworked home server. */
  machine: string;
  /** Each fact completes the sentence "You ..." */
  facts: string[];
}

export interface Settings {
  defaultIntensity: Intensity;
  sound: boolean;
  reduceMotion: boolean;
}

export interface AppState {
  version: 1;
  emails: Email[];
  lore: Lore;
  settings: Settings;
  /** Signatures of recently generated roasts, for deduplication. */
  recentSignatures: string[];
}

export type View = 'inbox' | 'unread' | 'starred' | 'archive' | 'trash' | 'settings';

export type IntensityFilter = Intensity | 'all';
