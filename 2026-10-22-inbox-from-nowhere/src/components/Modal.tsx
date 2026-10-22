import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

export function Modal({ title, eyebrow, onClose, children, actions }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/75 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-fade-up w-full max-w-md rounded-xl border border-mauve bg-wine shadow-glow outline-none"
      >
        <div className="flex items-center justify-between border-b border-mauve/70 px-4 py-2">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="h-2 w-2 bg-rose" />
            <span className="h-2 w-2 bg-mauve" />
            <span className="h-2 w-2 bg-mauve" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-haze">{eyebrow ?? 'system message'}</span>
          <button onClick={onClose} className="focus-ring rounded p-1 text-haze hover:text-ivory" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-5 pt-4">
          <h2 className="font-serif text-2xl font-semibold text-blush">{title}</h2>
          <div className="mt-3 text-sm leading-relaxed text-ivory/90">{children}</div>
          {actions && <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: 'bg-rose text-night hover:bg-blush font-medium',
    ghost: 'border border-mauve text-ivory hover:border-rose/70 hover:bg-night/40',
    danger: 'border border-rose/60 text-rose hover:bg-rose/10',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`focus-ring inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
