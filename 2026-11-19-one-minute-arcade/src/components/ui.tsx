// src/components/ui.tsx
// shared bits of the design system. chunky buttons, panels and little badges.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { playSfx, unlockAudio } from "../audio/sfx";
import type { Difficulty } from "../engine/types";

type Tone = "sun" | "tomato" | "mint" | "sky" | "grape" | "paper" | "ink";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Button({ tone = "sun", size = "md", className = "", onClick, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn-${tone} btn-${size} ${className}`}
      onClick={(e) => {
        unlockAudio();
        playSfx("click");
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function DifficultyPips({ level }: { level: Difficulty }) {
  const label = ["", "easy", "medium", "spicy"][level];
  return (
    <span className="pips" aria-label={`difficulty ${label}`} title={`difficulty ${label}`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`pip ${i <= level ? "pip-on" : ""}`} aria-hidden="true" />
      ))}
      <span className="pip-label">{label}</span>
    </span>
  );
}

export function Token({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17" fill="#ffc23c" stroke="#2b2340" strokeWidth="3" />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#2b2340" strokeWidth="2" strokeDasharray="3 3" />
      <path d="M20 12l2 5 5 .5-4 3.5 1.3 5L20 23.3 15.7 26l1.3-5-4-3.5 5-.5z" fill="#ff5a5f" stroke="#2b2340" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
