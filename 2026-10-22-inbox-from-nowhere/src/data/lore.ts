import type { Lore } from '../types';

/**
 * Editable roast material. Everything here is fictionalized and harmless:
 * habits, hobbies and questionable engineering decisions only.
 *
 * Each fact should complete the sentence "You ...".
 * All of this can also be edited in the app under Settings.
 */
export const defaultLore: Lore = {
  displayName: 'Michiko',
  petProjectName: 'Mochi',
  machine: 'Mac mini',
  facts: [
    'are a graduate researcher who optimizes everything except your own schedule',
    'have an unreasonable number of software side projects',
    'own a Mac mini that keeps acquiring new server responsibilities',
    'name almost every project Mochi',
    'build elaborate systems for simple problems',
    'start new GitHub repositories with alarming frequency',
    'have strong opinions about pretty UI',
    'can turn a simple CLI tool into an entire product ecosystem',
    'love productivity tools and also love procrastinating',
    'turn casual ideas into major engineering projects',
  ],
};

export const intensityLabels = {
  mild: 'Mildly Disrespectful',
  personal: 'Personally Attacked',
  devastated: 'Absolutely Devastated',
} as const;

export const intensityShort = {
  mild: 'Mild',
  personal: 'Personal',
  devastated: 'Devastated',
} as const;

export const categoryLabels = {
  'performance-review': 'Performance Review',
  'legal-notice': 'Legal Notice',
  'customer-complaint': 'Customer Complaint',
  'resignation-letter': 'Resignation Letter',
  'meeting-minutes': 'Meeting Minutes',
  'system-alert': 'System Alert',
  'personal-letter': 'Personal Letter',
  'financial-statement': 'Financial Statement',
  'peer-review': 'Peer Review',
} as const;
