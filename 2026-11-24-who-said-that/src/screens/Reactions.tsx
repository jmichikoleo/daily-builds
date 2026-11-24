// Live emoji reactions, synced through the server.
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { REACTIONS } from '../../shared/protocol.ts'
import { PixelAvatar } from '../components/PixelAvatar.tsx'
import { send, useStore } from '../lib/store.ts'
import { useRoom } from './RoomScreen.tsx'

export function ReactionLayer() {
  const { reactions } = useStore()
  const { byId } = useRoom()
  const [note, setNote] = useState<string | null>(null)
  return (
    <>
      <div className="react-float" aria-hidden="true">
        <AnimatePresence>
          {reactions.map((r) => {
            const p = byId.get(r.playerId)
            const x = (r.key * 37) % 80
            return (
              <motion.span
                key={r.key}
                className="react-bubble"
                style={{ left: `${10 + x}%` }}
                initial={{ y: 0, opacity: 0, scale: 0.4 }}
                animate={{ y: -260, opacity: [0, 1, 1, 0], scale: 1.1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.8, ease: 'easeOut' }}
              >
                {r.emoji}
                {p && <PixelAvatar avatar={p.avatar} color={p.color} size={16} />}
              </motion.span>
            )
          })}
        </AnimatePresence>
      </div>
      <div className="react-bar" role="toolbar" aria-label="Send a reaction">
        {REACTIONS.map((e) => (
          <button
            key={e}
            onClick={async () => {
              const res = await send('reaction:send', { emoji: e })
              setNote(res.ok ? null : res.error)
              if (!res.ok) setTimeout(() => setNote(null), 1500)
            }}
            aria-label={`react ${e}`}
          >
            {e}
          </button>
        ))}
        {note && <span className="react-note mono">{note}</span>}
      </div>
    </>
  )
}
