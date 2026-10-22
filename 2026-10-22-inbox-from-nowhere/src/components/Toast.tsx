import { X } from 'lucide-react';
import { PixelEnvelope, PixelSparkle } from './PixelDecor';

export interface ToastData {
  id: number;
  kind: 'mail' | 'info' | 'loading';
  title: string;
  detail?: string;
  emailId?: string;
}

interface Props {
  toast: ToastData;
  onOpen?: (emailId: string) => void;
  onDismiss: () => void;
  summonMs?: number;
}

export function Toast({ toast, onOpen, onDismiss, summonMs }: Props) {
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className="animate-toast fixed left-1/2 top-3 z-[60] w-[min(92vw,380px)] -translate-x-1/2 overflow-hidden rounded-xl border border-mauve bg-wine/95 shadow-glow backdrop-blur"
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div className={`mt-0.5 shrink-0 ${toast.kind === 'loading' ? 'animate-envelope' : ''}`}>
          {toast.kind === 'info' ? <PixelSparkle className="mt-1 h-3 w-3 text-rose" /> : <PixelEnvelope className="h-5 w-7" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${toast.kind === 'loading' ? 'font-mono text-xs text-blush' : 'font-medium text-ivory'}`}>
            {toast.title}
            {toast.kind === 'loading' && <span className="animate-blink">_</span>}
          </p>
          {toast.detail && <p className="mt-0.5 truncate text-xs text-haze">{toast.detail}</p>}
        </div>
        {toast.kind === 'mail' && toast.emailId && onOpen && (
          <button
            onClick={() => onOpen(toast.emailId!)}
            className="focus-ring shrink-0 rounded-md border border-rose/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-rose hover:bg-rose/10"
          >
            Open
          </button>
        )}
        {toast.kind !== 'loading' && (
          <button onClick={onDismiss} className="focus-ring shrink-0 rounded p-0.5 text-haze hover:text-ivory" aria-label="Dismiss">
            <X size={14} />
          </button>
        )}
      </div>
      {toast.kind === 'loading' && (
        <div className="h-[3px] bg-night">
          <div className="animate-progress h-full bg-rose" style={{ ['--summon-ms' as string]: `${summonMs ?? 1400}ms` }} />
        </div>
      )}
    </div>
  );
}
