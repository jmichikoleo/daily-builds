// src/components/SettingsPage.tsx
// sound and motion. that is all the settings an arcade needs.

import { useStore } from "../app/store";
import { playSfx, unlockAudio } from "../audio/sfx";
import { Panel } from "./ui";

function Toggle({ label, hint, checked, onChange, testId }: { label: string; hint: string; checked: boolean; onChange(v: boolean): void; testId: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border-2 border-ink bg-white p-4">
      <span>
        <span className="block text-lg font-black">{label}</span>
        <span className="block text-sm opacity-75">{hint}</span>
      </span>
      <input type="checkbox" role="switch" className="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
    </label>
  );
}

export function SettingsPage() {
  const { settings, updateSettings, reducedMotion } = useStore();
  return (
    <section className="mx-auto mt-8 max-w-xl">
      <h1 className="display text-center text-3xl">settings</h1>
      <Panel className="mt-6 grid gap-3 p-4 sm:p-6">
        <Toggle
          label="sound"
          hint="little bleeps and bloops. never loud."
          checked={settings.sound}
          testId="sound-toggle"
          onChange={(on) => {
            updateSettings({ sound: on });
            if (on) {
              unlockAudio();
              window.setTimeout(() => playSfx("point"), 30);
            }
          }}
        />
        <fieldset className="rounded-xl border-2 border-ink bg-white p-4">
          <legend className="px-1 text-lg font-black">motion</legend>
          <p className="text-sm opacity-75">calmer menus, no confetti, no screen shake. right now motion is {reducedMotion ? "reduced" : "full"}.</p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup">
            {(["system", "on", "off"] as const).map((v) => (
              <label key={v} className={`btn btn-sm ${settings.reducedMotion === v ? "btn-ink" : "btn-paper"}`}>
                <input
                  type="radio"
                  name="motion"
                  value={v}
                  className="sr-only"
                  checked={settings.reducedMotion === v}
                  onChange={() => updateSettings({ reducedMotion: v })}
                />
                {v === "system" ? "follow my device" : v === "on" ? "reduce motion" : "full motion"}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-center text-sm opacity-75">everything is saved in this browser only. no accounts, no servers.</p>
      </Panel>
    </section>
  );
}
