import { Archive, Inbox, Loader2, Mail, Settings, Star, Trash2, X, type LucideIcon } from 'lucide-react';
import type { Intensity, View } from '../types';
import { IntensityPicker } from './IntensityPicker';
import { PixelHeart, PixelSparkle } from './PixelDecor';

interface Props {
  view: View;
  counts: Record<Exclude<View, 'settings'>, number>;
  onNavigate: (view: View) => void;
  onSummon: () => void;
  summoning: boolean;
  summonIntensity: Intensity;
  onSummonIntensity: (i: Intensity) => void;
  onClose?: () => void;
}

const nav: { view: View; label: string; icon: LucideIcon; count?: keyof Props['counts'] }[] = [
  { view: 'inbox', label: 'Inbox', icon: Inbox, count: 'unread' },
  { view: 'unread', label: 'Unread', icon: Mail, count: 'unread' },
  { view: 'starred', label: 'Starred', icon: Star, count: 'starred' },
  { view: 'archive', label: 'Archive', icon: Archive, count: 'archive' },
  { view: 'trash', label: 'Trash', icon: Trash2, count: 'trash' },
  { view: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ view, counts, onNavigate, onSummon, summoning, summonIntensity, onSummonIntensity, onClose }: Props) {
  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-mauve/70 bg-wine">
      <div className="flex items-start justify-between px-5 pb-4 pt-5">
        <div>
          <div className="flex items-center gap-2">
            <PixelHeart className="h-5 w-5" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-haze">mail.nowhere</span>
          </div>
          <h1 className="mt-2 font-serif text-[26px] font-semibold leading-none text-ivory">
            Inbox <span className="italic text-rose">From</span> Nowhere
          </h1>
          <p className="mt-2 text-xs leading-snug text-haze">Nobody asked. Everybody has something to say.</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="focus-ring -mr-1 rounded p-1 text-haze hover:text-ivory md:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="px-4">
        <button
          onClick={onSummon}
          disabled={summoning}
          className="focus-ring group relative w-full overflow-hidden rounded-xl bg-rose px-4 py-3 text-left text-night shadow-glow transition-transform hover:-translate-y-0.5 hover:bg-blush active:translate-y-0 disabled:cursor-wait disabled:opacity-80"
        >
          <span className="flex items-center gap-2 whitespace-nowrap text-[15px] font-medium">
            {summoning ? <Loader2 size={16} className="animate-spin" /> : <PixelSparkle className="h-3 w-3 transition-transform group-hover:rotate-45" />}
            {summoning ? 'Summoning...' : 'Summon New Hate Mail'}
          </span>
          <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-night/60">offline · no api · no mercy</span>
        </button>
        <div className="mt-2">
          <IntensityPicker value={summonIntensity} onChange={onSummonIntensity} label="Intensity for new hate mail" />
        </div>
      </div>

      <nav className="scroll-thin mt-5 flex-1 overflow-y-auto px-2" aria-label="Folders">
        <ul className="space-y-0.5">
          {nav.map(({ view: v, label, icon: Icon, count }) => {
            const active = v === view;
            const n = count ? counts[count] : 0;
            return (
              <li key={v}>
                <button
                  onClick={() => onNavigate(v)}
                  aria-current={active ? 'page' : undefined}
                  className={`focus-ring group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? 'bg-night/70 text-ivory' : 'text-haze hover:bg-night/40 hover:text-ivory'
                  }`}
                >
                  {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 bg-rose" aria-hidden />}
                  <Icon size={16} className={active ? 'text-rose' : 'text-haze group-hover:text-blush'} />
                  <span className="flex-1 text-left">{label}</span>
                  {count && n > 0 && (
                    <span
                      className={`min-w-[22px] rounded px-1.5 py-0.5 text-center font-mono text-[10px] ${
                        (v === 'inbox' || v === 'unread') && n > 0 ? 'bg-rose/20 text-rose' : 'text-haze'
                      }`}
                    >
                      {n}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-mauve/70 px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-haze">
        <div className="animate-flicker flex items-center gap-2">
          <span className="animate-pulse-dot h-1.5 w-1.5 bg-rose" aria-hidden />
          <span>Universe online · Judgment active</span>
        </div>
        <p className="mt-1 normal-case tracking-normal text-haze/70">Stored only in this browser. No real email, ever.</p>
      </div>
    </aside>
  );
}
