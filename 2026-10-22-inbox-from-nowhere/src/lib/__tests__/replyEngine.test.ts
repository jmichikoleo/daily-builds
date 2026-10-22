import { describe, expect, it } from 'vitest';
import { comebackRules } from '../../data/comebacks';
import { buildComebackEmail, getComeback } from '../replyEngine';
import { createSampleInbox } from '../../data/emails';

describe('comeback engine', () => {
  it('answers the classic defense with the classic comeback', () => {
    expect(getComeback('At least I finish my projects.').text).toBe(
      'Congratulations. The committee has located one completed repository. A national holiday has been proposed.',
    );
  });

  it('responds to "finish" claims with the finished rule', () => {
    const c = getComeback('I finished the app yesterday!');
    expect(c.ruleId).toBe('finished');
    expect(comebackRules.find((r) => r.id === 'finished')!.responses).toContain(c.text);
  });

  it('is deterministic', () => {
    expect(getComeback('my UI is beautiful').text).toBe(getComeback('my UI is beautiful').text);
  });

  it('matches whole words, not fragments', () => {
    // "build" contains "ui" but should not trigger the pretty-UI rule.
    expect(getComeback('I build things').ruleId).not.toBe('pretty');
  });

  it('falls back when nothing matches, and handles empty replies', () => {
    expect(getComeback('xyzzy plugh').ruleId).toBe('fallback');
    expect(getComeback('   ').ruleId).toBe('empty');
    expect(typeof getComeback('constructor').text).toBe('string');
  });

  it('wraps the comeback in an unread reply email', () => {
    const original = createSampleInbox()[0];
    const reply = buildComebackEmail(original, 'Mochi is perfect');
    expect(reply.subject).toBe(`Re: ${original.subject}`);
    expect(reply.read).toBe(false);
    expect(reply.body).toContain('> Mochi is perfect');
  });
});
