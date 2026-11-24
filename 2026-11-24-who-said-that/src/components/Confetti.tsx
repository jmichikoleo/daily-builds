import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

const COLORS = ['#FFD1D3', '#FFE9AE', '#DCCDF8', '#DCEBFC', '#DDEBCF', '#E85D75', '#FFC94D', '#7FB8F5']

export function Confetti({ count = 40 }: { count?: number }) {
  const reduce = useReducedMotion()
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random() * 100,
        drift: (Math.random() - 0.5) * 30,
        delay: Math.random() * 0.4,
        dur: 1.6 + Math.random() * 1.4,
        rot: Math.random() * 720 - 360,
        size: 6 + Math.round(Math.random() * 3) * 3,
        color: COLORS[i % COLORS.length],
        shape: i % 3,
      })),
    [count],
  )
  if (reduce) return null
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className={`confetti__bit confetti__bit--${b.shape}`}
          style={{ left: `${b.x}%`, width: b.size, height: b.shape === 1 ? b.size * 2 : b.size, background: b.color }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', x: `${b.drift}vw`, rotate: b.rot, opacity: [1, 1, 0] }}
          transition={{ duration: b.dur, delay: b.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}
