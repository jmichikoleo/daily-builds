/** Shown on the server and during hydration, before the saved draft is read. */
export function LoadingPassport({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24" role="status">
      <div className="flex flex-col items-center gap-4 text-muted">
        <svg viewBox="0 0 64 64" className="h-14 w-14 text-rose" aria-hidden="true">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="0 6" strokeLinecap="round" />
          <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <p className="font-serif italic">{label}</p>
      </div>
    </div>
  );
}
