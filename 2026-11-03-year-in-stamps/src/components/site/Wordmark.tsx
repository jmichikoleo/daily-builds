import Link from "next/link";

/** Product wordmark: a tiny postmark ring + serif name. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 text-charcoal ${className}`} aria-label="Your Year in Stamps, home">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0 text-burgundy" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="0 3.6" strokeLinecap="round" />
        <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.5 18.5 L21 13.5 Q22.6 12.9 22.3 14.2 L12 19.4 Z M15.5 16 L13.4 11.6 L14.8 11.5 L18.3 14.6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
      <span className="font-serif text-[1.15rem] leading-none tracking-tight">
        Your Year <span className="italic text-burgundy">in Stamps</span>
      </span>
    </Link>
  );
}
