import Link from "next/link";
import { Wordmark } from "./Wordmark";

const STEPS = [
  { id: "create", label: "Passport", href: "/create" },
  { id: "studio", label: "Studio", href: "/studio" },
] as const;

/** Compact header for the creation flow, with a two-step indicator. */
export function AppHeader({ current }: { current: (typeof STEPS)[number]["id"] }) {
  return (
    <header className="border-b border-line/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark className="[&>span]:hidden sm:[&>span]:inline" />
        <nav aria-label="Passport steps">
          <ol className="flex items-center gap-1 font-stamp text-[11px] uppercase tracking-[0.2em] sm:gap-2 sm:text-xs">
            {STEPS.map((step, i) => {
              const active = step.id === current;
              return (
                <li key={step.id} className="flex items-center gap-1 sm:gap-2">
                  {i > 0 && <span className="text-line" aria-hidden="true">——</span>}
                  <Link
                    href={step.href}
                    aria-current={active ? "step" : undefined}
                    className={`rounded-sm px-2 py-1.5 transition-colors ${active ? "bg-blush text-burgundy" : "text-muted hover:text-burgundy"}`}
                  >
                    <span className="font-mono">{String(i + 1).padStart(2, "0")}</span> {step.label}
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </header>
  );
}
