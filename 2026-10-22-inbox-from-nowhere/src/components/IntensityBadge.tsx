import { intensityLabels } from '../data/lore';
import type { Intensity } from '../types';
import { IntensityPips } from './PixelDecor';

export const intensityLevel: Record<Intensity, 1 | 2 | 3> = { mild: 1, personal: 2, devastated: 3 };

export function IntensityBadge({ intensity }: { intensity: Intensity }) {
  const tone =
    intensity === 'devastated'
      ? 'border-rose/60 text-rose bg-rose/10'
      : intensity === 'personal'
        ? 'border-mauve text-blush bg-wine'
        : 'border-mauve text-haze bg-transparent';
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${tone}`}>
      <IntensityPips level={intensityLevel[intensity]} />
      {intensityLabels[intensity]}
    </span>
  );
}
