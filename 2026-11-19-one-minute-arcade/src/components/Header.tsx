// src/components/Header.tsx
// the logo and the four little nav links.

import type { MouseEvent } from "react";
import { navigate } from "../app/router";
import { Token } from "./ui";

function Link({ to, current, children }: { to: string; current: boolean; children: string }) {
  return (
    <a
      href={to}
      className="nav-link"
      aria-current={current ? "page" : undefined}
      onClick={(e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function Header({ route, onSurprise }: { route: string; onSurprise(): void }) {
  return (
    <header className="pt-6">
      <nav aria-label="main" className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
        <Link to="/" current={route === "home"}>
          all games
        </Link>
        <button type="button" className="nav-link" onClick={onSurprise}>
          random game
        </button>
        <Link to="/records" current={route === "records"}>
          my records
        </Link>
        <Link to="/settings" current={route === "settings"}>
          settings
        </Link>
      </nav>
      <a
        href="/"
        className="mx-auto mt-6 flex w-fit flex-col items-center gap-2 sm:flex-row sm:gap-4"
        onClick={(e) => {
          e.preventDefault();
          navigate("/");
        }}
      >
        <Token className="bounce h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
        <span className="text-center">
          <span className="display block text-[2.1rem] text-ink sm:text-6xl" style={{ textShadow: "0 4px 0 #ffc23c" }}>
            ONE MINUTE ARCADE
          </span>
        </span>
        <Token className="bounce hidden h-14 w-14 shrink-0 sm:block [animation-delay:-0.8s]" />
      </a>
      <p className="pixel mt-3 text-center text-lg sm:text-xl">Little games. Big nonsense.</p>
    </header>
  );
}
