import { MOTIF_PATHS, type MotifId } from "@/lib/stamps/motifs";

/** A travel motif as a small line icon that inherits the text colour. */
export function MotifIcon({ id, className }: { id: MotifId; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {MOTIF_PATHS[id].map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
