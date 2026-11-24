// src/components/bits.tsx
// small shared pieces: territory emblem, rarity tag, modal, progress bar,
// warning badges, the passport mini booklet and a stamp for a catalog id.

import { useEffect, useId, useRef, type ReactNode } from "react";
import type { ContentWarning, Rarity, Territory } from "../types";
import { Glyph } from "./glyphs";
import { StampArt } from "./Stamp";
import { stampById } from "../data/stamps";
import { stampDate, WARNING_LABEL } from "../lib/format";

export function Emblem({ t, size = 64, locked }: { t: Territory; size?: number; locked?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="emblem">
      <defs>
        <path id={`em-${id}`} d="M16 50 A34 34 0 0 1 84 50" />
      </defs>
      <circle cx="50" cy="50" r="47" fill={locked ? "#d9cfc4" : t.color} stroke={t.ink} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={t.ink} strokeWidth="1" strokeDasharray="2 3" />
      <g transform="translate(50 56) scale(0.42) translate(-50 -50)" fill="none" stroke={t.ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <Glyph name={locked ? "question" : t.emblem} />
      </g>
      <text fontSize="7.6" fill={t.ink} fontFamily="Courier Prime, monospace" fontWeight="700" letterSpacing="1.2">
        <textPath href={`#em-${id}`} startOffset="50%" textAnchor="middle">
          {t.code === "???" ? "TERRA INCOGNITA" : t.short.toUpperCase()}
        </textPath>
      </text>
    </svg>
  );
}

export function RarityTag({ rarity }: { rarity: Rarity }) {
  return <span className={`rarity rarity-${rarity}`}>{rarity}</span>;
}

export function Warnings({ list }: { list?: ContentWarning[] }) {
  if (!list?.length) return null;
  return (
    <ul className="warnings" aria-label="heads up">
      {list.map((w) => (
        <li key={w} className={`warn warn-${w}`}>
          {WARNING_LABEL[w]}
        </li>
      ))}
    </ul>
  );
}

export function Progress({ value, total, label, color }: { value: number; total: number; label: string; color?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const items = ref.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, textarea, select, [tabindex='0']");
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal paper ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1} ref={ref}>
        <button className="modal-close" onClick={onClose} aria-label="close">
          ×
        </button>
        <h2 id={headingId} className="modal-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function CatalogStamp({ stampId, earnedAt, size = 96, faded, mystery, title }: { stampId: string; earnedAt?: string; size?: number | string; faded?: boolean; mystery?: boolean; title?: string }) {
  const s = stampById(stampId);
  if (!s) return null;
  return (
    <StampArt
      id={stampId}
      design={s.design}
      rarity={s.rarity}
      date={earnedAt ? stampDate(earnedAt) : undefined}
      size={size}
      faded={faded}
      mystery={mystery}
      title={title ?? s.name}
    />
  );
}

/** the closed passport booklet, used on the departure hall and in onboarding */
export function ClosedPassport({ color, name, number, stamps, onEmblem }: { color: string; name: string; number: string; stamps?: number; onEmblem?: () => void }) {
  return (
    <div className="booklet-closed" style={{ ["--cover" as string]: color }}>
      <div className="booklet-guilloche" aria-hidden="true" />
      <p className="cover-kicker">the department of internet exploration</p>
      <CoverEmblem onClick={onEmblem} />
      <p className="cover-title">internet passport</p>
      <div className="cover-meta">
        <span className="cover-name">{name}</span>
        <span className="cover-number">{number}</span>
        {stamps !== undefined && <span className="cover-count">{stamps === 1 ? "1 stamp" : `${stamps} stamps`} inside</span>}
      </div>
    </div>
  );
}

/** the original exploration emblem: a globe with a cursor orbiting it, inside a compass ring */
export function CoverEmblem({ onClick }: { onClick?: () => void }) {
  const art = (
    <svg viewBox="0 0 100 100" width="96" height="96" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="50" cy="50" r="44" strokeDasharray="1 4" />
        <circle cx="50" cy="50" r="38" />
        <circle cx="50" cy="50" r="22" />
        <ellipse cx="50" cy="50" rx="9" ry="22" />
        <path d="M28 50h44M31 39h38M31 61h38" />
        <path d="M50 6v8M50 86v8M6 50h8M86 50h8" />
        <ellipse cx="50" cy="50" rx="34" ry="12" transform="rotate(-24 50 50)" />
        <path d="M78 33l6 9-4 1 3 5-2 1-3-5-3 3z" fill="currentColor" />
      </g>
    </svg>
  );
  if (!onClick) return <div className="cover-emblem">{art}</div>;
  return (
    <button
      type="button"
      className="cover-emblem cover-emblem-btn"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label="passport emblem"
    >
      {art}
    </button>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden="true" className={i <= value ? "star on" : "star"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 100 100" width="72" height="72" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <Glyph name="compass" />
        </g>
      </svg>
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}
