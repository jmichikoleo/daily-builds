import { Menu, Search, Sparkles, Star, Trash2, X } from 'lucide-react';
import { intensityShort } from '../data/lore';
import { formatListTime } from '../lib/format';
import type { Email, IntensityFilter, View } from '../types';
import { EmptyState } from './EmptyState';
import { intensityLevel } from './IntensityBadge';
import { IntensityPips } from './PixelDecor';

export const viewMeta: Record<Exclude<View, 'settings'>, { title: string; tagline: string; empty: string }> = {
  inbox: {
    title: 'Inbox',
    tagline: 'Your daily dose of unsolicited criticism.',
    empty: 'Even the universe has run out of things to say. Temporarily.',
  },
  unread: {
    title: 'Unread',
    tagline: 'Fresh judgment, still warm.',
    empty: 'You have read every word. Bold. Brave. Slightly concerning.',
  },
  starred: {
    title: 'Starred',
    tagline: 'Apparently, emotional damage is collectible.',
    empty: 'Your collection of emotional damage is empty. Star a roast to start one.',
  },
  archive: {
    title: 'Archive of Shame',
    tagline: 'Filed away. Not forgotten.',
    empty: 'Nothing archived. You face criticism head on. Allegedly.',
  },
  trash: {
    title: 'Trash',
    tagline: 'Where constructive criticism goes to die.',
    empty: 'Trash is empty. All criticism has been composted into character.',
  },
};

const filters: IntensityFilter[] = ['all', 'mild', 'personal', 'devastated'];

interface Props {
  view: Exclude<View, 'settings'>;
  emails: Email[];
  totalInView: number;
  selectedId: string | null;
  arrivedId: string | null;
  query: string;
  onQuery: (q: string) => void;
  intensityFilter: IntensityFilter;
  onIntensityFilter: (f: IntensityFilter) => void;
  onSelect: (id: string) => void;
  onEmptyTrash: () => void;
  onOpenMenu: () => void;
  onSummon: () => void;
  summoning: boolean;
}

export function EmailList(props: Props) {
  const { view, emails, totalInView, selectedId, arrivedId, query, onQuery, intensityFilter, onIntensityFilter } = props;
  const meta = viewMeta[view];
  const filtering = query.trim() !== '' || intensityFilter !== 'all';

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col border-r border-mauve/70 bg-panel md:w-[380px] md:flex-none lg:w-[420px]">
      <header className="border-b border-mauve/70 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <button onClick={props.onOpenMenu} className="focus-ring -ml-1 rounded p-1.5 text-haze hover:text-ivory md:hidden" aria-label="Open folders">
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-serif text-[28px] font-semibold leading-tight text-ivory">{meta.title}</h2>
          </div>
          {view === 'trash' && totalInView > 0 && (
            <button
              onClick={props.onEmptyTrash}
              className="focus-ring flex items-center gap-1.5 rounded-md border border-mauve px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-haze hover:border-rose/60 hover:text-rose"
            >
              <Trash2 size={12} /> Empty
            </button>
          )}
          <button
            onClick={props.onSummon}
            disabled={props.summoning}
            className="focus-ring flex items-center gap-1.5 rounded-lg bg-rose px-2.5 py-1.5 text-xs font-medium text-night disabled:opacity-70 md:hidden"
            aria-label="Summon new hate mail"
          >
            <Sparkles size={14} /> Summon
          </button>
        </div>
        <p className="mt-0.5 text-sm italic text-haze">{meta.tagline}</p>

        <label className="mt-3 flex items-center gap-2 rounded-lg border border-mauve/80 bg-night/60 px-3 py-2 focus-within:border-rose/60">
          <Search size={15} className="shrink-0 text-haze" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search senders, subjects, insults..."
            className="min-w-0 flex-1 bg-transparent text-sm text-ivory placeholder:text-haze/70 focus:outline-none"
            aria-label="Search mail"
          />
          {query && (
            <button onClick={() => onQuery('')} className="text-haze hover:text-ivory" aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </label>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Filter by intensity">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => onIntensityFilter(f)}
              aria-pressed={intensityFilter === f}
              className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                intensityFilter === f ? 'border-rose/70 bg-rose/10 text-blush' : 'border-mauve text-haze hover:text-ivory'
              }`}
            >
              {f === 'all' ? 'All' : (
                <>
                  <IntensityPips level={intensityLevel[f]} />
                  {intensityShort[f]}
                </>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto">
        {emails.length === 0 ? (
          <EmptyState
            message={filtering && totalInView > 0 ? 'No matches. Even the haters could not find that.' : meta.empty}
            hint={filtering && totalInView > 0 ? 'Try fewer words, or fewer feelings.' : view === 'inbox' ? 'Press "Summon New Hate Mail" to fix that.' : undefined}
          />
        ) : (
          <ul>
            {emails.map((email) => (
              <MailRow
                key={email.id}
                email={email}
                selected={email.id === selectedId}
                arrived={email.id === arrivedId}
                onSelect={() => props.onSelect(email.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-mauve/70 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-haze/80">
        {emails.length} of {totalInView} {totalInView === 1 ? 'message' : 'messages'}
        {filtering && ' · filtered'}
      </footer>
    </section>
  );
}

function MailRow({ email, selected, arrived, onSelect }: { email: Email; selected: boolean; arrived: boolean; onSelect: () => void }) {
  return (
    <li className={arrived ? 'animate-arrive' : ''}>
      <button
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={`focus-ring group relative block w-full border-b border-mauve/40 px-4 py-3 text-left transition-colors ${
          selected ? 'bg-wine' : 'hover:bg-wine/50'
        }`}
      >
        {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-rose" aria-hidden />}
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 ${email.read ? 'bg-transparent' : 'bg-rose'}`} aria-label={email.read ? undefined : 'Unread'} />
          <span className={`min-w-0 flex-1 truncate text-sm ${email.read ? 'text-haze' : 'font-semibold text-ivory'}`}>{email.sender.name}</span>
          {email.starred && <Star size={12} className="shrink-0 fill-rose text-rose" aria-label="Starred" />}
          <time className="shrink-0 font-mono text-[10px] text-haze" dateTime={email.timestamp}>
            {formatListTime(email.timestamp)}
          </time>
        </div>
        <div className="mt-1 flex items-center gap-2 pl-3.5">
          <p className={`min-w-0 flex-1 truncate text-[13px] ${email.read ? 'text-ivory/75' : 'text-blush'}`}>{email.subject}</p>
          <IntensityPips level={intensityLevel[email.intensity]} className="shrink-0" />
        </div>
        <p className="mt-0.5 line-clamp-2 pl-3.5 text-xs leading-relaxed text-haze/80">{email.preview}</p>
      </button>
    </li>
  );
}
