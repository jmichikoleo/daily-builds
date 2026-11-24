import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { PublicPlayer, RoomView } from '../../shared/protocol.ts'
import { Btn, Stamp } from '../components/bits.tsx'
import { navigate } from '../lib/router.ts'
import { clearKicked, resume, savedSession, setRoomCode, useStore } from '../lib/store.ts'
import { JoinForm } from './Identity.tsx'
import { Lobby } from './Lobby.tsx'
import { Answering, Guessing, NextRound, Paused, QuestionCard, Reveal, RoundResults } from './Play.tsx'
import { Final } from './Final.tsx'
import { ReactionLayer } from './Reactions.tsx'

export interface RoomCtx {
  view: RoomView
  me: PublicPlayer
  byId: Map<string, PublicPlayer>
  name: (id: string) => string
  isHost: boolean
}

const Ctx = createContext<RoomCtx | null>(null)
export function useRoom(): RoomCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useRoom outside a room')
  return c
}

const phaseKey = (v: RoomView) => (v.phase === 'GUESSING' || v.phase === 'REVEAL' ? `${v.phase}-${v.game?.current?.id}` : v.phase)

/** Keeps a screen's data frozen while it animates out, so it never renders the next phase's state. */
function Hold({ k, children }: { k: string; children: React.ReactNode }) {
  const ctx = useContext(Ctx)!
  const ref = useRef(ctx)
  if (phaseKey(ctx.view) === k) ref.current = ctx
  return <Ctx.Provider value={ref.current}>{children}</Ctx.Provider>
}

export function RoomScreen({ code }: { code: string }) {
  const { view, joinError, kicked, status } = useStore()
  const [resuming, setResuming] = useState(() => !!savedSession(code))

  useEffect(() => {
    setRoomCode(code)
    if (savedSession(code) && view?.code !== code) {
      setResuming(true)
      void resume(code).finally(() => setResuming(false))
    } else setResuming(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const ctx = useMemo<RoomCtx | null>(() => {
    if (!view || view.code !== code) return null
    const byId = new Map(view.players.map((p) => [p.id, p]))
    const me = byId.get(view.you.id)
    if (!me) return null
    return { view, me, byId, name: (id) => byId.get(id)?.name ?? 'a mystery suspect', isHost: view.you.isHost }
  }, [view, code])

  if (kicked)
    return (
      <div className="screen center-card">
        <div className="notice">
          <Stamp tone="cherry">Removed</Stamp>
          <p>{kicked}</p>
          <Btn
            tone="yellow"
            onClick={() => {
              clearKicked()
              navigate('/')
            }}
          >
            back to the front desk
          </Btn>
        </div>
      </div>
    )

  if (!ctx) {
    if (resuming || (status !== 'online' && savedSession(code)))
      return (
        <div className="screen center-card">
          <div className="notice">
            <div className="loader" aria-hidden="true" />
            <p className="mono">retrieving case file {code}…</p>
          </div>
        </div>
      )
    return (
      <>
        {joinError && joinError !== 'no session' && (
          <p className="error error--banner" role="alert">
            {joinError}
          </p>
        )}
        <JoinForm code={code} />
      </>
    )
  }

  const phase = view!.phase
  return (
    <Ctx.Provider value={ctx}>
      <div className={`room phase-${phase.toLowerCase()}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={phaseKey(view!)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="room__stage"
          >
            <Hold k={phaseKey(view!)}>
            {phase === 'LOBBY' && <Lobby />}
            {phase === 'QUESTION' && <QuestionCard />}
            {phase === 'ANSWERING' && <Answering />}
            {phase === 'GUESSING' && <Guessing />}
            {phase === 'REVEAL' && <Reveal />}
            {phase === 'ROUND_RESULTS' && <RoundResults />}
            {phase === 'NEXT_ROUND' && <NextRound />}
            {phase === 'FINAL_RESULTS' && <Final />}
            {phase === 'PAUSED' && <Paused />}
            </Hold>
          </motion.div>
        </AnimatePresence>
        {view!.settings.allowReactions && phase !== 'LOBBY' && <ReactionLayer />}
      </div>
    </Ctx.Provider>
  )
}
