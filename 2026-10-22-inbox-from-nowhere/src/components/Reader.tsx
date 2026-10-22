import { Archive, ArchiveRestore, ArrowLeft, Mail, MailOpen, Reply, Star, Trash2, X, type LucideIcon } from 'lucide-react';
import { categoryLabels } from '../data/lore';
import { formatFullTime } from '../lib/format';
import type { Email } from '../types';
import { EmptyState } from './EmptyState';
import { IntensityBadge } from './IntensityBadge';
import { PixelHeart } from './PixelDecor';

interface Props {
  email: Email | null;
  onBack: () => void;
  onToggleRead: (email: Email) => void;
  onToggleStar: (email: Email) => void;
  onArchive: (email: Email) => void;
  onTrash: (email: Email) => void;
  onRestore: (email: Email) => void;
  onDeleteForever: (email: Email) => void;
  onReply: (email: Email) => void;
  onUnsubscribe: () => void;
}

function ToolButton({ icon: Icon, label, onClick, active = false }: { icon: LucideIcon; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`focus-ring rounded-lg p-2 transition-colors hover:bg-wine ${active ? 'text-rose' : 'text-haze hover:text-ivory'}`}
    >
      <Icon size={17} className={active ? 'fill-rose' : ''} />
    </button>
  );
}

export function Reader({ email, ...a }: Props) {
  if (!email) {
    return (
      <section className="bg-pixel-grid hidden h-full flex-1 md:flex">
        <EmptyState message="Select a message. Or don't. They'll keep coming." hint="judgment is delivered whether you read it or not" />
      </section>
    );
  }

  const inTrash = email.folder === 'trash';
  const inArchive = email.folder === 'archive';
  const initial = email.sender.name.replace(/^(The|Your)\s+/i, '').charAt(0).toUpperCase();

  return (
    <section className="bg-pixel-grid fixed inset-0 z-30 flex flex-col bg-night md:static md:z-auto md:flex-1" aria-label="Message">
      <div className="flex items-center gap-1 border-b border-mauve/70 bg-night/90 px-2 py-1.5 backdrop-blur md:px-4">
        <button onClick={a.onBack} className="focus-ring rounded-lg p-2 text-haze hover:text-ivory md:hidden" aria-label="Back to list">
          <ArrowLeft size={18} />
        </button>
        <ToolButton icon={Reply} label="Reply" onClick={() => a.onReply(email)} />
        <ToolButton icon={Star} label={email.starred ? 'Unstar' : 'Star'} onClick={() => a.onToggleStar(email)} active={email.starred} />
        <ToolButton icon={email.read ? Mail : MailOpen} label={email.read ? 'Mark as unread' : 'Mark as read'} onClick={() => a.onToggleRead(email)} />
        <span className="mx-1 h-5 w-px bg-mauve/70" aria-hidden />
        {inTrash || inArchive ? (
          <ToolButton icon={ArchiveRestore} label={inTrash ? 'Restore from Trash' : 'Move back to Inbox'} onClick={() => a.onRestore(email)} />
        ) : (
          <ToolButton icon={Archive} label="Archive" onClick={() => a.onArchive(email)} />
        )}
        {inTrash ? (
          <ToolButton icon={X} label="Delete forever" onClick={() => a.onDeleteForever(email)} />
        ) : (
          <ToolButton icon={Trash2} label="Move to Trash" onClick={() => a.onTrash(email)} />
        )}
        <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-wider text-haze/70 sm:block">
          {email.folder} · id {email.id.slice(-6)}
        </span>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto">
        <article key={email.id} className="animate-fade-up mx-auto max-w-2xl px-5 pb-16 pt-6 md:px-10 md:pt-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-rose">{categoryLabels[email.category]}</span>
            <span className="text-mauve" aria-hidden>
              /
            </span>
            <IntensityBadge intensity={email.intensity} />
            {email.generated && <span className="font-mono text-[10px] uppercase tracking-wider text-haze">freshly summoned</span>}
          </div>

          <h2 className="mt-4 font-serif text-3xl font-semibold leading-tight text-ivory md:text-[40px]">{email.subject}</h2>

          <div className="mt-6 flex items-center gap-3 border-y border-mauve/50 py-4">
            <div className="pixel-frame flex h-10 w-10 shrink-0 items-center justify-center bg-wine font-serif text-xl text-rose">{initial}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ivory">{email.sender.name}</p>
              <p className="truncate font-mono text-[11px] text-haze">&lt;{email.sender.address}&gt; · to: you, unfortunately</p>
            </div>
            <time className="hidden shrink-0 text-right font-mono text-[11px] text-haze sm:block" dateTime={email.timestamp}>
              {formatFullTime(email.timestamp)}
            </time>
          </div>
          <time className="mt-2 block font-mono text-[11px] text-haze sm:hidden" dateTime={email.timestamp}>
            {formatFullTime(email.timestamp)}
          </time>

          <div className="mt-6 whitespace-pre-wrap break-words text-[15px] leading-7 text-ivory/90">{email.body}</div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <button
              onClick={() => a.onReply(email)}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-rose px-4 py-2 text-sm font-medium text-night transition-colors hover:bg-blush"
            >
              <Reply size={15} /> Reply with a defense
            </button>
            <button
              onClick={() => a.onToggleStar(email)}
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-mauve px-4 py-2 text-sm text-ivory transition-colors hover:border-rose/60"
            >
              <Star size={15} className={email.starred ? 'fill-rose text-rose' : ''} />
              {email.starred ? 'Collected' : 'Collect this damage'}
            </button>
          </div>

          <footer className="mt-12 border-t border-dashed border-mauve/60 pt-4 text-center font-mono text-[10px] leading-relaxed text-haze/80">
            <PixelHeart className="mx-auto mb-2 h-3 w-3 opacity-70" />
            You are receiving this because you exist and have a GitHub account.
            <br />
            Don't want these emails?{' '}
            <button onClick={a.onUnsubscribe} className="focus-ring text-rose underline decoration-dotted underline-offset-2 hover:text-blush">
              Unsubscribe
            </button>
          </footer>
        </article>
      </div>
    </section>
  );
}
