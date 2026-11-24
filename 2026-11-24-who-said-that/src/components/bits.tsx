// Small reusable graphic pieces: stamps, stickers, window chrome, timers.
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { serverNow } from '../lib/store.ts'
import { sfx } from '../lib/sound.ts'

export function Stamp({ children, tone = 'cherry', rotate = -8, className = '', animate = false }: { children: ReactNode; tone?: 'cherry' | 'ink' | 'blue' | 'green'; rotate?: number; className?: string; animate?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      className={`stamp stamp--${tone} ${className}`}
      style={{ rotate }}
      initial={animate && !reduce ? { scale: 2.6, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 18 }}
    >
      {children}
    </motion.span>
  )
}

export function Tag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`evidence-tag ${className}`}>{children}</span>
}

export function Window({ title, children, className = '', tone = 'lavender', actions }: { title: string; children: ReactNode; className?: string; tone?: string; actions?: ReactNode }) {
  return (
    <section className={`win win--${tone} ${className}`}>
      <header className="win__bar">
        <span className="win__title">{title}</span>
        <span className="win__ctrls" aria-hidden="true">
          {actions}
          <i>_</i>
          <i>□</i>
          <i>×</i>
        </span>
      </header>
      <div className="win__body">{children}</div>
    </section>
  )
}

export function Star({ className = '', color = '#FFC94D' }: { className?: string; color?: string }) {
  return (
    <svg className={`sticker-svg ${className}`} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#29252E" d="M3 0h1v1h1v1h2v1h-1v1h-1v2h-1v-1h-1v1h-1v-2h-1v-1h-1v-1h2v-1h1z" />
      <path fill={color} d="M3 1h1v2h2v1h-1v1h-1v-1h-1v1h-1v-1h-1v-1h2z" />
    </svg>
  )
}

export function Heart({ className = '', color = '#E85D75' }: { className?: string; color?: string }) {
  return (
    <svg className={`sticker-svg ${className}`} viewBox="0 0 7 6" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#29252E" d="M1 0h2v1h1v-1h2v1h1v2h-1v1h-1v1h-1v1h-1v-1h-1v-1h-1v-1h-1v-2h1z" />
      <path fill={color} d="M1 1h2v1h1v-1h2v2h-1v1h-1v1h-1v-1h-1v-1h-1z" />
      <rect x="1" y="1" width="1" height="1" fill="#fff" />
    </svg>
  )
}

export function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg className={`doodle-arrow ${className}`} viewBox="0 0 120 60" aria-hidden="true">
      <path d="M4 48 C 30 6, 70 4, 108 26" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M96 14 L 110 27 L 92 34" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Envelope({ className = '', sealed = false }: { className?: string; sealed?: boolean }) {
  return (
    <svg className={`envelope ${className}`} viewBox="0 0 64 44" aria-hidden="true">
      <rect x="2" y="2" width="60" height="40" rx="3" fill="#FFF9F0" stroke="#29252E" strokeWidth="3" />
      <path d="M3 4 L32 26 L61 4" fill="none" stroke="#29252E" strokeWidth="3" strokeLinejoin="round" />
      {sealed && <circle cx="32" cy="26" r="7" fill="#E85D75" stroke="#29252E" strokeWidth="2.5" />}
      {sealed && <path d="M29 26 l2 2 l4 -4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  )
}

export function Fingerprint({ className = '' }: { className?: string }) {
  return (
    <svg className={`fingerprint ${className}`} viewBox="0 0 40 48" aria-hidden="true">
      {[18, 14, 10, 6].map((r, i) => (
        <ellipse key={r} cx="20" cy="24" rx={r} ry={r * 1.18} fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray={i % 2 ? '9 4' : '14 3'} />
      ))}
    </svg>
  )
}

/** Countdown derived from the server deadline (never from a local timer of its own). */
export function useRemaining(deadline: number | null) {
  const [now, setNow] = useState(serverNow())
  useEffect(() => {
    if (!deadline) return
    const id = setInterval(() => setNow(serverNow()), 200)
    return () => clearInterval(id)
  }, [deadline])
  return deadline ? Math.max(0, deadline - now) : 0
}

export function Timer({ deadline, total, label = 'time left', tick = false }: { deadline: number | null; total: number; label?: string; tick?: boolean }) {
  const ms = useRemaining(deadline)
  const secs = Math.ceil(ms / 1000)
  const frac = total > 0 ? Math.min(1, ms / total) : 0
  const last = useRef(secs)
  useEffect(() => {
    if (tick && secs !== last.current && secs <= 5 && secs > 0) sfx('tick')
    last.current = secs
  }, [secs, tick])
  if (!deadline) return null
  return (
    <div className={`timer ${secs <= 5 ? 'timer--urgent' : ''}`} role="timer" aria-label={`${label}: ${secs} seconds`}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="16" className="timer__track" />
        <circle cx="20" cy="20" r="16" className="timer__fill" strokeDasharray={`${frac * 100.5} 200`} />
      </svg>
      <span className="timer__num">{secs}</span>
    </div>
  )
}

export function Btn({ children, tone = 'pink', className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'pink' | 'yellow' | 'blue' | 'mint' | 'lavender' | 'cherry' | 'ink' | 'cream' }) {
  return (
    <button className={`btn btn--${tone} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Marquee({ items }: { items: string[] }) {
  const line = items.join('   ✦   ')
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        <span>{line}   ✦   </span>
        <span>{line}   ✦   </span>
      </div>
    </div>
  )
}

export function CaseNo({ seed }: { seed: string }) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return <span className="mono case-no">CASE #{String(h % 100000).padStart(5, '0')}</span>
}
