import { motion } from 'framer-motion'
import type { PublicPlayer } from '../../shared/protocol.ts'
import { PixelAvatar } from './PixelAvatar.tsx'

export function Mugshot({ player, size = 56, className = '' }: { player: Pick<PublicPlayer, 'avatar' | 'color' | 'name'>; size?: number; className?: string }) {
  return (
    <span className={`mugshot ${className}`} style={{ '--c': player.color } as React.CSSProperties}>
      <PixelAvatar avatar={player.avatar} color={player.color} size={size} />
    </span>
  )
}

export function SuspectCard({
  player,
  index,
  you,
  children,
}: {
  player: PublicPlayer
  index: number
  you?: boolean
  children?: React.ReactNode
}) {
  const tilt = [-3, 2, -1.5, 3, -2.5, 1.5][index % 6]
  return (
    <motion.li
      layout
      initial={{ y: 30, opacity: 0, rotate: tilt * 2 }}
      animate={{ y: 0, opacity: 1, rotate: tilt }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`suspect ${player.connected ? '' : 'suspect--away'} ${you ? 'suspect--you' : ''}`}
      style={{ '--c': player.color } as React.CSSProperties}
    >
      <span className="suspect__tape" aria-hidden="true" />
      <span className="suspect__photo">
        <span className="suspect__height" aria-hidden="true" />
        <PixelAvatar avatar={player.avatar} color={player.color} size={64} />
      </span>
      <span className="suspect__name">{player.name}</span>
      <span className="suspect__meta mono">
        {player.isHost && <b className="chip chip--host">HOST</b>}
        {player.role === 'spectator' && <b className="chip">WITNESS</b>}
        {player.role === 'player' && <b className={`chip ${player.ready ? 'chip--ready' : ''}`}>{player.ready ? 'READY' : 'NOT READY'}</b>}
        {!player.connected && <b className="chip chip--away">OFFLINE</b>}
        {you && <b className="chip chip--you">YOU</b>}
      </span>
      {children}
    </motion.li>
  )
}
