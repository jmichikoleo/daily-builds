import { Loader2, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Email } from '../types';

interface Props {
  email: Email;
  sending: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
}

const prompts = ['At least I finish my projects.', 'My UI is beautiful, actually.', 'The Mac mini loves its job.', 'I am very busy with research.'];

export function Composer({ email, sending, onSend, onClose }: Props) {
  const [text, setText] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const subject = email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`;

  useEffect(() => {
    area.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !sending && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  const submit = () => {
    if (!sending) onSend(text);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-night/60 md:inset-auto md:bottom-4 md:right-4 md:bg-transparent" onMouseDown={onClose}>
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="animate-sheet flex w-full flex-col rounded-t-2xl border border-mauve bg-wine shadow-glow md:w-[440px] md:rounded-xl"
        aria-label="Reply composer"
      >
        <div className="flex items-center justify-between border-b border-mauve/70 px-4 py-2.5">
          <span className="font-serif text-lg font-semibold text-blush">Mount a defense</span>
          <button type="button" onClick={onClose} disabled={sending} className="focus-ring rounded p-1 text-haze hover:text-ivory" aria-label="Discard reply">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-1.5 border-b border-mauve/50 px-4 py-2 font-mono text-[11px] text-haze">
          <p className="truncate">
            <span className="text-haze/70">to:</span> <span className="text-ivory/90">{email.sender.address}</span>
          </p>
          <p className="truncate">
            <span className="text-haze/70">subject:</span> <span className="text-ivory/90">{subject}</span>
          </p>
        </div>
        <textarea
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
          maxLength={600}
          rows={5}
          placeholder="Type your defense. It will not help."
          className="resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-ivory placeholder:text-haze/60 focus:outline-none"
        />
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setText(p)}
              className="focus-ring rounded-full border border-mauve px-2 py-0.5 text-[11px] text-haze hover:border-rose/60 hover:text-ivory"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-mauve/70 px-4 py-3">
          <span className="font-mono text-[10px] leading-tight text-haze/80">
            comeback engine: matches keywords.
            <br />
            does not read minds.
          </span>
          <button
            type="submit"
            disabled={sending}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-rose px-4 py-2 text-sm font-medium text-night hover:bg-blush disabled:opacity-70"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Sending...' : 'Send defense'}
          </button>
        </div>
      </form>
    </div>
  );
}
