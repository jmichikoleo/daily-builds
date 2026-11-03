"use client";

import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";

export const labelClass = "block font-stamp text-xs uppercase tracking-[0.2em] text-muted";
const focusRing = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-burgundy";

/** Horizontal set of native radio buttons styled as segments. */
export function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={`cursor-pointer rounded-sm border px-3 py-1.5 text-sm transition-colors ${focusRing} ${
              value === o.value ? "border-burgundy bg-blush/50 text-burgundy" : "border-line bg-ivory text-charcoal hover:border-rose"
            }`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Colour choices as round swatches, with an optional "theme default" first. */
export function SwatchRow({
  legend,
  value,
  swatches,
  onChange,
  themeLabel = "Theme",
  themeColor,
}: {
  legend: string;
  /** undefined = theme default */
  value: string | undefined;
  swatches: readonly string[];
  onChange: (value: string | undefined) => void;
  themeLabel?: string;
  themeColor: string;
}) {
  const name = useId();
  const item = (key: string, checked: boolean, color: string, label: string, onSelect: () => void, wide = false) => (
    <label
      key={key}
      title={label}
      className={`relative inline-flex cursor-pointer items-center gap-1.5 rounded-sm border p-1 ${wide ? "pr-2" : ""} ${focusRing} ${
        checked ? "border-burgundy bg-blush/40" : "border-line hover:border-rose"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" aria-label={label} />
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-charcoal/15" style={{ background: color }} aria-hidden="true">
        {checked && <Check size={13} className="text-ivory mix-blend-difference" />}
      </span>
      {wide && <span className="text-xs">{label}</span>}
    </label>
  );
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {item("theme", value === undefined, themeColor, themeLabel, () => onChange(undefined), true)}
        {[...new Set(swatches)].map((c) => item(c, value === c, c, c, () => onChange(c)))}
      </div>
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-burgundy peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-burgundy after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-ivory after:transition-transform peer-checked:after:translate-x-4 motion-reduce:after:transition-none"
      />
    </label>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TextButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-xs text-burgundy underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline"
    >
      {children}
    </button>
  );
}
