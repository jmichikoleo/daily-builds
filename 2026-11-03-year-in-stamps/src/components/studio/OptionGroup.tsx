"use client";

import type { ReactNode } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
  visual?: ReactNode;
}

/**
 * A row of selectable cards backed by native radio inputs, so arrow keys,
 * Tab and screen readers behave as expected.
 */
export function OptionGroup<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  columns = 3,
}: {
  name: string;
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <fieldset>
      <legend className="font-stamp text-xs uppercase tracking-[0.2em] text-muted">{legend}</legend>
      <div className={`mt-2 grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={`relative flex cursor-pointer flex-col gap-2 rounded-sm border p-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-burgundy ${
                checked ? "border-burgundy bg-blush/40" : "border-line bg-ivory hover:border-rose"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.visual}
              <span className="text-sm font-medium leading-tight text-charcoal">{option.label}</span>
              {option.hint && <span className="text-[11px] leading-tight text-muted">{option.hint}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
