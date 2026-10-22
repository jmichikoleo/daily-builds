import { describe, expect, it } from 'vitest';
import { SAMPLE_EMAIL_COUNT, createSampleInbox } from '../../data/emails';
import { countsFor, createInitialState, emailsForView, mailboxReducer, searchEmails } from '../mailbox';
import { parseState } from '../storage';
import type { Email } from '../../types';

const NOW = Date.UTC(2026, 9, 22, 9, 0);

function firstInbox(state = createInitialState(NOW)): Email {
  return state.emails.find((e) => e.folder === 'inbox')!;
}

describe('sample inbox', () => {
  it('ships at least 25 handcrafted emails with unique ids', () => {
    const emails = createSampleInbox(NOW);
    expect(SAMPLE_EMAIL_COUNT).toBeGreaterThanOrEqual(25);
    expect(new Set(emails.map((e) => e.id)).size).toBe(emails.length);
    for (const e of emails) expect(e.sender.address).toMatch(/@[a-z0-9.-]+\.example$/);
  });
});

describe('mailbox state transitions', () => {
  it('marks read and unread', () => {
    const s = createInitialState(NOW);
    const id = firstInbox(s).id;
    const read = mailboxReducer(s, { type: 'markRead', id, read: true });
    expect(read.emails.find((e) => e.id === id)!.read).toBe(true);
    const unread = mailboxReducer(read, { type: 'markRead', id, read: false });
    expect(unread.emails.find((e) => e.id === id)!.read).toBe(false);
  });

  it('stars and unstars', () => {
    const s = createInitialState(NOW);
    const id = firstInbox(s).id;
    const starred = mailboxReducer(s, { type: 'toggleStar', id });
    expect(emailsForView(starred.emails, 'starred').some((e) => e.id === id)).toBe(true);
    const unstarred = mailboxReducer(starred, { type: 'toggleStar', id });
    expect(unstarred.emails.find((e) => e.id === id)!.starred).toBe(s.emails.find((e) => e.id === id)!.starred);
  });

  it('archives and restores to the inbox', () => {
    const s = createInitialState(NOW);
    const id = firstInbox(s).id;
    const archived = mailboxReducer(s, { type: 'archive', id });
    expect(emailsForView(archived.emails, 'archive').map((e) => e.id)).toContain(id);
    expect(emailsForView(archived.emails, 'inbox').map((e) => e.id)).not.toContain(id);
    const restored = mailboxReducer(archived, { type: 'restore', id });
    expect(restored.emails.find((e) => e.id === id)!.folder).toBe('inbox');
  });

  it('trash restores to the folder it came from', () => {
    let s = createInitialState(NOW);
    const id = firstInbox(s).id;
    s = mailboxReducer(s, { type: 'archive', id });
    s = mailboxReducer(s, { type: 'trash', id });
    expect(s.emails.find((e) => e.id === id)!.folder).toBe('trash');
    s = mailboxReducer(s, { type: 'restore', id });
    expect(s.emails.find((e) => e.id === id)!.folder).toBe('archive');
  });

  it('starred view hides trashed mail', () => {
    let s = createInitialState(NOW);
    const id = firstInbox(s).id;
    s = mailboxReducer(s, { type: 'toggleStar', id });
    s = mailboxReducer(s, { type: 'trash', id });
    expect(emailsForView(s.emails, 'starred').map((e) => e.id)).not.toContain(id);
  });

  it('adds new mail to the top and updates the unread count', () => {
    const s = createInitialState(NOW);
    const before = countsFor(s.emails).unread;
    const email: Email = { ...firstInbox(s), id: 'new-1', read: false };
    const next = mailboxReducer(s, { type: 'addEmail', email, signature: 'sig-1' });
    expect(next.emails[0].id).toBe('new-1');
    expect(countsFor(next.emails).unread).toBe(before + 1);
    expect(next.recentSignatures[0]).toBe('sig-1');
  });

  it('reset keeps lore and settings', () => {
    let s = createInitialState(NOW);
    s = mailboxReducer(s, { type: 'updateLore', lore: { ...s.lore, displayName: 'Kept' } });
    s = mailboxReducer(s, { type: 'emptyTrash' });
    s = mailboxReducer(s, { type: 'reset', now: NOW });
    expect(s.lore.displayName).toBe('Kept');
    expect(s.emails.length).toBe(SAMPLE_EMAIL_COUNT);
  });

  it('searches sender, subject and content, and filters intensity', () => {
    const emails = createSampleInbox(NOW);
    expect(searchEmails(emails, 'rubber duck', 'all').length).toBeGreaterThan(0);
    expect(searchEmails(emails, 'INFEASIBLE', 'all').length).toBeGreaterThan(0);
    const devastated = searchEmails(emails, '', 'devastated');
    expect(devastated.every((e) => e.intensity === 'devastated')).toBe(true);
  });
});

describe('storage parsing', () => {
  it('round-trips state and survives garbage', () => {
    const s = createInitialState(NOW);
    const parsed = parseState(JSON.stringify(s));
    expect(parsed.emails.length).toBe(s.emails.length);
    expect(parseState('{not json').emails.length).toBe(SAMPLE_EMAIL_COUNT);
    expect(parseState(JSON.stringify({ version: 99 })).emails.length).toBe(SAMPLE_EMAIL_COUNT);
  });
});
