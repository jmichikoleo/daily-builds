"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "./Wordmark";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/studio", label: "Studio" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="relative z-20 border-b border-line/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-muted transition-colors hover:text-burgundy">
              {link.label}
            </Link>
          ))}
          <Link
            href="/create"
            className="rounded-sm bg-burgundy px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-charcoal"
          >
            Create my passport
          </Link>
        </nav>

        <button
          ref={buttonRef}
          type="button"
          className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-sm text-charcoal md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Main"
          className="absolute inset-x-0 top-full border-b border-line bg-ivory px-4 pb-5 pt-2 shadow-[0_12px_24px_-16px_rgba(48,43,46,0.35)] md:hidden"
        >
          <ul className="flex flex-col">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block border-b border-line/70 py-3 font-serif text-lg"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/create"
            className="mt-4 block rounded-sm bg-burgundy px-4 py-3 text-center font-medium text-ivory"
            onClick={() => setOpen(false)}
          >
            Create my passport
          </Link>
        </nav>
      )}
    </header>
  );
}
