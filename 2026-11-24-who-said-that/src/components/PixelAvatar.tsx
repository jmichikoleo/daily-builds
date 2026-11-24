import { memo } from 'react'
import { AVATARS } from '../../shared/avatars.ts'

export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)))
  const r = c((n >> 16) & 255)
  const g = c((n >> 8) & 255)
  const b = c(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function spriteColors(color: string): Record<string, string> {
  return { '#': color, d: shade(color, -0.18), k: '#29252E', w: '#FFFFFF', p: '#FF8FA3', y: '#FFD86B' }
}

interface Props {
  avatar: number
  color: string
  size?: number
  title?: string
  className?: string
}

export const PixelAvatar = memo(function PixelAvatar({ avatar, color, size = 48, title, className }: Props) {
  const sprite = AVATARS[avatar] ?? AVATARS[0]
  const colors = spriteColors(color)
  const rects: React.ReactElement[] = []
  sprite.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={colors[ch] ?? color} />)
    }),
  )
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  )
})
