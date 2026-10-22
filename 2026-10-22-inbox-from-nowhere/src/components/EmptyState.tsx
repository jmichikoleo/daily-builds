import { PixelEnvelope, PixelSparkle } from './PixelDecor';

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="animate-fade-up flex h-full min-h-[260px] flex-col items-center justify-center px-8 py-12 text-center">
      <div className="relative">
        <div className="pixel-frame bg-night p-3">
          <PixelEnvelope className="h-9 w-12 opacity-80" />
        </div>
        <PixelSparkle className="absolute -right-3 -top-3 h-3 w-3 text-rose" />
        <PixelSparkle className="absolute -bottom-2 -left-4 h-2 w-2 text-blush/60" />
      </div>
      <p className="mt-6 max-w-xs font-serif text-xl italic leading-snug text-blush">{message}</p>
      {hint && <p className="mt-2 font-mono text-[11px] text-haze">{hint}</p>}
    </div>
  );
}
