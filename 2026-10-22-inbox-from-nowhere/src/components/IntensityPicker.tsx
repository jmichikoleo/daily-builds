import { intensityLabels, intensityShort } from '../data/lore';
import type { Intensity } from '../types';
import { IntensityPips } from './PixelDecor';
import { intensityLevel } from './IntensityBadge';

const options: Intensity[] = ['mild', 'personal', 'devastated'];

interface Props {
  value: Intensity;
  onChange: (value: Intensity) => void;
  label?: string;
  compact?: boolean;
}

export function IntensityPicker({ value, onChange, label = 'Roast intensity', compact = false }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1 rounded-lg border border-mauve/70 bg-night/60 p-1">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            title={intensityLabels[opt]}
            onClick={() => onChange(opt)}
            className={`focus-ring flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[11px] transition-colors ${
              active ? 'bg-rose/15 text-blush shadow-[inset_0_0_0_1px_rgba(231,164,196,0.45)]' : 'text-haze hover:bg-wine hover:text-ivory'
            }`}
          >
            <IntensityPips level={intensityLevel[opt]} />
            <span className={compact ? 'sr-only' : ''}>{intensityShort[opt]}</span>
          </button>
        );
      })}
    </div>
  );
}
