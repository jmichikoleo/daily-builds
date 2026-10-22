import { loreLines, senderTemplates, type SenderTemplate } from '../data/templates';
import { makePreview } from '../data/emails';
import type { Email, Intensity, Lore } from '../types';
import { createRng, makeId, pickIndex, type Rng } from './random';

export interface GenerateOptions {
  lore: Lore;
  intensity: Intensity;
  /** Signatures already used recently. Generation avoids these. */
  recentSignatures?: string[];
  rng?: Rng;
  now?: number;
}

export interface GeneratedRoast {
  email: Email;
  signature: string;
}

const MAX_ATTEMPTS = 60;

/** Replace {name}, {pet}, {machine} and {fact} placeholders. */
export function fillPlaceholders(text: string, lore: Lore, fact = ''): string {
  const name = lore.displayName.trim() || 'you';
  const pet = lore.petProjectName.trim() || 'Mochi';
  const machine = lore.machine.trim() || 'Mac mini';
  return text
    .replace(/\{name\}/g, name)
    .replace(/\{pet\}/g, pet)
    .replace(/\{machine\}/g, machine)
    .replace(/\{fact\}/g, fact);
}

function cleanFact(fact: string): string {
  // Facts complete "You ...". Accept "You ..." too, and drop trailing periods.
  return fact.trim().replace(/^you\s+/i, '').replace(/[.!\s]+$/, '');
}

interface Choice {
  template: SenderTemplate;
  greeting: number;
  subject: number;
  body: number;
  punchline: number;
  signoff: number;
  loreLine: number;
  fact: number;
}

function choose(rng: Rng, intensity: Intensity, factCount: number): Choice {
  const template = senderTemplates[pickIndex(rng, senderTemplates.length)];
  return {
    template,
    greeting: pickIndex(rng, template.greetings.length),
    subject: pickIndex(rng, template.subjects[intensity].length),
    body: pickIndex(rng, template.bodies[intensity].length),
    punchline: pickIndex(rng, template.punchlines[intensity].length),
    signoff: pickIndex(rng, template.signoffs.length),
    loreLine: pickIndex(rng, loreLines[intensity].length),
    // -1 means no lore line this time, which keeps the format varied.
    fact: factCount > 0 && rng() < 0.85 ? pickIndex(rng, factCount) : -1,
  };
}

/**
 * The signature identifies the comedic content (sender + subject + body + punchline).
 * Greeting, signoff and lore line vary freely and don't count as "new".
 */
function signatureOf(c: Choice, intensity: Intensity): string {
  return [c.template.id, intensity, c.subject, c.body, c.punchline].join(':');
}

/** Total distinct signatures available for an intensity. */
export function signatureSpace(intensity: Intensity): number {
  return senderTemplates.reduce(
    (sum, t) => sum + t.subjects[intensity].length * t.bodies[intensity].length * t.punchlines[intensity].length,
    0,
  );
}

export function generateRoast({
  lore,
  intensity,
  recentSignatures = [],
  rng = Math.random,
  now = Date.now(),
}: GenerateOptions): GeneratedRoast {
  const used = new Set(recentSignatures);
  const facts = lore.facts.map(cleanFact).filter(Boolean);

  let choice = choose(rng, intensity, facts.length);
  for (let attempt = 0; attempt < MAX_ATTEMPTS && used.has(signatureOf(choice, intensity)); attempt++) {
    choice = choose(rng, intensity, facts.length);
  }

  const t = choice.template;
  const fact = choice.fact >= 0 ? facts[choice.fact] : '';
  const fill = (s: string) => fillPlaceholders(s, lore, fact);

  const paragraphs = [
    fill(t.greetings[choice.greeting]),
    fill(t.bodies[intensity][choice.body]),
    fact ? fill(loreLines[intensity][choice.loreLine]) : '',
    fill(t.punchlines[intensity][choice.punchline]),
    fill(t.signoffs[choice.signoff]),
  ].filter(Boolean);

  const body = paragraphs.join('\n\n');
  const signature = signatureOf(choice, intensity);

  const email: Email = {
    id: makeId('roast', rng),
    sender: { name: fill(t.name), address: t.address },
    subject: fill(t.subjects[intensity][choice.subject]),
    preview: makePreview(paragraphs.slice(1).join(' ')),
    body,
    timestamp: new Date(now).toISOString(),
    intensity,
    category: t.category,
    read: false,
    starred: false,
    folder: 'inbox',
    generated: true,
  };

  return { email, signature };
}

/** Convenience for tests and seeded demos. */
export function generateSeeded(seed: number, options: Omit<GenerateOptions, 'rng'>): GeneratedRoast {
  return generateRoast({ ...options, rng: createRng(seed) });
}
