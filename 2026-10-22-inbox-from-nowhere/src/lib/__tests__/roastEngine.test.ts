import { describe, expect, it } from 'vitest';
import { defaultLore } from '../../data/lore';
import { senderTemplates } from '../../data/templates';
import { fillPlaceholders, generateRoast, signatureSpace } from '../roastEngine';
import { createRng } from '../random';
import type { Intensity } from '../../types';

const intensities: Intensity[] = ['mild', 'personal', 'devastated'];

describe('roast engine', () => {
  it('creates a complete unread inbox email', () => {
    const { email, signature } = generateRoast({ lore: defaultLore, intensity: 'personal', rng: createRng(1) });
    expect(email.folder).toBe('inbox');
    expect(email.read).toBe(false);
    expect(email.starred).toBe(false);
    expect(email.intensity).toBe('personal');
    expect(email.generated).toBe(true);
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.body.length).toBeGreaterThan(80);
    expect(email.sender.address).toMatch(/\.example$/);
    expect(signature).toContain(':personal:');
  });

  it('never leaves unfilled placeholders', () => {
    for (const intensity of intensities) {
      const rng = createRng(42);
      for (let i = 0; i < 50; i++) {
        const { email } = generateRoast({ lore: defaultLore, intensity, rng });
        expect(email.body).not.toMatch(/\{(name|pet|machine|fact)\}/);
        expect(email.subject).not.toMatch(/\{(name|pet|machine|fact)\}/);
        expect(email.sender.name).not.toMatch(/\{/);
      }
    }
  });

  it('uses lore for personalization', () => {
    const lore = { displayName: 'Testy', petProjectName: 'Dumpling', machine: 'toaster', facts: ['collect keyboards'] };
    expect(fillPlaceholders('{name} runs {pet} on a {machine}', lore)).toBe('Testy runs Dumpling on a toaster');
    const rng = createRng(7);
    const bodies = Array.from({ length: 30 }, () => generateRoast({ lore, intensity: 'mild', rng }).email.body);
    expect(bodies.some((b) => b.includes('collect keyboards'))).toBe(true);
    expect(bodies.join(' ')).not.toContain('Mochi');
  });

  it('avoids repeating recent roasts', () => {
    for (const intensity of intensities) {
      const rng = createRng(99);
      const recent: string[] = [];
      const space = signatureSpace(intensity);
      const runs = Math.min(40, space);
      for (let i = 0; i < runs; i++) {
        const { signature } = generateRoast({ lore: defaultLore, intensity, rng, recentSignatures: recent });
        expect(recent).not.toContain(signature);
        recent.unshift(signature);
      }
    }
  });

  it('has a template for every intensity on every sender', () => {
    for (const t of senderTemplates) {
      for (const intensity of intensities) {
        expect(t.subjects[intensity].length).toBeGreaterThan(0);
        expect(t.bodies[intensity].length).toBeGreaterThan(0);
        expect(t.punchlines[intensity].length).toBeGreaterThan(0);
      }
    }
  });
});
