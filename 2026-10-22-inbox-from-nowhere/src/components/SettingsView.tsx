import { Check, Menu, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { defaultLore, intensityLabels } from '../data/lore';
import type { Intensity, Lore, Settings } from '../types';
import { IntensityPicker } from './IntensityPicker';
import { Button } from './Modal';

interface Props {
  lore: Lore;
  settings: Settings;
  onSaveLore: (lore: Lore) => void;
  onUpdateSettings: (s: Partial<Settings>) => void;
  onRequestReset: () => void;
  onOpenMenu: () => void;
}

const MAX_FACTS = 20;
const MAX_FACT_LEN = 140;

export function SettingsView({ lore, settings, onSaveLore, onUpdateSettings, onRequestReset, onOpenMenu }: Props) {
  const [draft, setDraft] = useState<Lore>(lore);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(lore), [lore]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(lore);

  const save = () => {
    const cleaned: Lore = {
      displayName: draft.displayName.trim().slice(0, 40),
      petProjectName: draft.petProjectName.trim().slice(0, 30),
      machine: draft.machine.trim().slice(0, 30),
      facts: draft.facts.map((f) => f.trim().slice(0, MAX_FACT_LEN)).filter(Boolean),
    };
    onSaveLore(cleaned);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const setFact = (i: number, value: string) => setDraft((d) => ({ ...d, facts: d.facts.map((f, j) => (j === i ? value : f)) }));

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-panel">
      <header className="border-b border-mauve/70 px-4 pb-3 pt-4 md:px-8">
        <div className="flex items-center gap-2">
          <button onClick={onOpenMenu} className="focus-ring -ml-1 rounded p-1.5 text-haze hover:text-ivory md:hidden" aria-label="Open folders">
            <Menu size={20} />
          </button>
          <h2 className="font-serif text-[28px] font-semibold leading-tight text-ivory">Settings</h2>
        </div>
        <p className="mt-0.5 text-sm italic text-haze">Customize exactly how you would like to be judged.</p>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 md:px-8">
          <Group title="Roast material" note="Everything here stays in this browser. Keep it to harmless habits and hobbies.">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Display name">
                <input className={inputCls} value={draft.displayName} maxLength={40} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
              </Field>
              <Field label="Every project is named">
                <input className={inputCls} value={draft.petProjectName} maxLength={30} onChange={(e) => setDraft({ ...draft, petProjectName: e.target.value })} />
              </Field>
              <Field label="Overworked server">
                <input className={inputCls} value={draft.machine} maxLength={30} onChange={(e) => setDraft({ ...draft, machine: e.target.value })} />
              </Field>
            </div>

            <div className="mt-5">
              <p className="text-sm text-ivory">Lore facts</p>
              <p className="mt-0.5 font-mono text-[11px] text-haze">Each one completes the sentence "You ..."</p>
              <ul className="mt-3 space-y-2">
                {draft.facts.map((fact, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-9 shrink-0 font-mono text-[11px] text-haze">You</span>
                    <input
                      className={inputCls}
                      value={fact}
                      maxLength={MAX_FACT_LEN}
                      onChange={(e) => setFact(i, e.target.value)}
                      aria-label={`Lore fact ${i + 1}`}
                    />
                    <button
                      onClick={() => setDraft((d) => ({ ...d, facts: d.facts.filter((_, j) => j !== i) }))}
                      className="focus-ring shrink-0 rounded p-2 text-haze hover:text-rose"
                      aria-label={`Remove fact ${i + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button onClick={() => setDraft((d) => ({ ...d, facts: [...d.facts, ''] }))} disabled={draft.facts.length >= MAX_FACTS}>
                  <Plus size={14} /> Add fact
                </Button>
                <Button onClick={() => setDraft({ ...defaultLore, facts: [...defaultLore.facts] })}>
                  <RotateCcw size={14} /> Restore default lore
                </Button>
                <span className="flex-1" />
                <Button variant="primary" onClick={save} disabled={!dirty && !saved}>
                  {saved ? <Check size={14} /> : null}
                  {saved ? 'Saved. Ammunition loaded.' : 'Save lore'}
                </Button>
              </div>
            </div>
          </Group>

          <Group title="Delivery preferences">
            <div>
              <span className="mb-1.5 block font-mono text-[11px] text-haze">
                Default roast intensity: {intensityLabels[settings.defaultIntensity]}
              </span>
              <IntensityPicker value={settings.defaultIntensity} onChange={(v: Intensity) => onUpdateSettings({ defaultIntensity: v })} label="Default roast intensity" />
            </div>
            <div className="mt-4 divide-y divide-mauve/50 rounded-lg border border-mauve/70">
              <Toggle
                label="Notification sound"
                description="A tiny retro chime when hate mail arrives."
                checked={settings.sound}
                onChange={(v) => onUpdateSettings({ sound: v })}
              />
              <Toggle
                label="Reduce motion"
                description="Turns off animations. The judgment remains."
                checked={settings.reduceMotion}
                onChange={(v) => onUpdateSettings({ reduceMotion: v })}
              />
            </div>
          </Group>

          <Group title="Danger zone">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose/40 p-4">
              <div>
                <p className="text-sm text-ivory">Reset sample inbox</p>
                <p className="mt-0.5 text-xs text-haze">Restores the original emails and removes summoned ones. Lore and settings stay.</p>
              </div>
              <Button variant="danger" onClick={onRequestReset}>
                <RotateCcw size={14} /> Reset inbox
              </Button>
            </div>
          </Group>

          <p className="pb-6 text-center font-mono text-[10px] uppercase tracking-wider text-haze/70">
            no backend · no api keys · no real email is read or sent
          </p>
        </div>
      </div>
    </section>
  );
}

const inputCls =
  'w-full min-w-0 rounded-lg border border-mauve/80 bg-night/60 px-3 py-2 text-sm text-ivory placeholder:text-haze/60 focus:border-rose/60 focus:outline-none';

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-serif text-xl font-semibold text-blush">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-haze">{note}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] text-haze">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-sm text-ivory">{label}</p>
        <p className="text-xs text-haze">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`focus-ring relative h-6 w-11 shrink-0 rounded-full border transition-colors ${checked ? 'border-rose bg-rose/30' : 'border-mauve bg-night'}`}
      >
        <span className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 transition-all ${checked ? 'left-[22px] bg-rose' : 'left-[3px] bg-haze'}`} />
      </button>
    </div>
  );
}
