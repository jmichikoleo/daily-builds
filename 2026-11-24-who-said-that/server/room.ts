// The server authoritative game. One Room per room code.
// Every transition goes through go(), which bumps `step`; stale actions and timers are ignored.
import { timingSafeEqual } from 'node:crypto'
import type { RoundType } from '../shared/questions.ts'
import {
  DEFAULT_SETTINGS,
  LIMITS,
  ROUND_RULES,
  type CustomDeck,
  type GameSettings,
  type GameView,
  type Phase,
  type Profile,
  type PublicPlayer,
  type Reaction,
  type ReactionEvent,
  type RevealInfo,
  type RoomView,
} from '../shared/protocol.ts'
import { revealCommentary } from './commentary.ts'
import { newId, shuffle, type Answer, type Clock, type Game, type Player, type Rng, type Round, type RoomState } from './model.ts'
import { assignImpersonations, countWords, eligibleQuestions, pickQuestions, planRounds } from './questions.ts'
import { perfectRoundBonus, scoreAnswer } from './scoring.ts'
import { finalResults, roundSummary, type AnswerRecord } from './stats.ts'

export class GameError extends Error {}

export interface RoomConfig {
  reconnectGraceMs: number
  hostGraceMs: number
  questionCardMs: number
  nextRoundMs: number
  autoResultsMs: number
  manualResultsMs: number
  submitGraceMs: number
  speedDemonSeconds: number
  /** A player who dropped less than this long ago still counts as "expected" (covers a page refresh). */
  refreshGraceMs: number
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  reconnectGraceMs: 90_000,
  hostGraceMs: 25_000,
  questionCardMs: 3_800,
  nextRoundMs: 2_600,
  autoResultsMs: 14_000,
  manualResultsMs: 300_000,
  submitGraceMs: 1_200,
  speedDemonSeconds: 10,
  refreshGraceMs: 15_000,
}

const GAME_PHASES: Phase[] = ['QUESTION', 'ANSWERING', 'GUESSING', 'REVEAL', 'ROUND_RESULTS', 'NEXT_ROUND']
const RECENT_MAX = 240

const sameToken = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// control characters, zero width characters and bidi overrides
const UNSAFE_CHARS = new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]', 'g')

export const sanitizeAnswer = (s: string) =>
  s
    .replace(UNSAFE_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export class Room {
  readonly s: RoomState
  private timer: unknown = null
  private hostTimer: unknown = null
  private destroyed = false
  private readonly clock: Clock
  private readonly rng: Rng
  private readonly cfg: RoomConfig
  private readonly onChange: (room: Room) => void

  constructor(code: string, opts: { clock: Clock; rng: Rng; config?: Partial<RoomConfig>; onChange?: (room: Room) => void }) {
    this.clock = opts.clock
    this.rng = opts.rng
    this.cfg = { ...DEFAULT_ROOM_CONFIG, ...opts.config }
    this.onChange = opts.onChange ?? (() => {})
    const now = this.clock.now()
    this.s = {
      code,
      createdAt: now,
      lastActivity: now,
      hostId: '',
      players: new Map(),
      order: [],
      settings: { ...DEFAULT_SETTINGS, decks: [...DEFAULT_SETTINGS.decks], specialTypes: [...DEFAULT_SETTINGS.specialTypes] },
      customDecks: [],
      phase: 'LOBBY',
      pausedFrom: null,
      pauseRemaining: 0,
      pauseReason: null,
      step: 0,
      deadline: null,
      game: null,
      recent: [],
      gamesPlayed: 0,
      kickedTokens: new Set(),
    }
  }

  // ---------- helpers ----------

  get code() {
    return this.s.code
  }
  get phase() {
    return this.s.phase
  }
  name = (id: string) => this.s.players.get(id)?.name ?? 'a mystery suspect'
  private player(id: string) {
    const p = this.s.players.get(id)
    if (!p) throw new GameError('You are not in this room.')
    return p
  }
  private requireHost(id: string) {
    if (this.s.hostId !== id) throw new GameError('Only the host can do that.')
  }
  private requireStep(step: number, ...phases: Phase[]) {
    if (!phases.includes(this.s.phase)) throw new GameError('That moment has passed.')
    if (step !== this.s.step) throw new GameError('That moment has passed.')
  }
  private touch() {
    this.s.lastActivity = this.clock.now()
  }
  private changed() {
    this.touch()
    if (!this.destroyed) this.onChange(this)
  }
  get round(): Round | null {
    const g = this.s.game
    return g ? (g.rounds[g.rounds.length - 1] ?? null) : null
  }
  /** Players (not spectators) still part of the game, connected or within their grace period. */
  activePlayers() {
    return [...this.s.players.values()].filter((p) => p.role === 'player' && !p.left)
  }
  connectedPlayers() {
    return this.activePlayers().filter((p) => p.connected)
  }
  isEmpty() {
    return ![...this.s.players.values()].some((p) => p.connected)
  }
  scores(): Map<string, number> {
    const m = new Map<string, number>()
    for (const e of this.s.game?.ledger.values() ?? []) m.set(e.playerId, (m.get(e.playerId) ?? 0) + e.amount)
    return m
  }

  private go(phase: Phase, ms: number | null) {
    this.s.step++
    this.s.phase = phase
    if (this.timer) this.clock.clearTimeout(this.timer)
    this.timer = null
    this.s.deadline = ms === null ? null : this.clock.now() + ms
    if (ms !== null) {
      const step = this.s.step
      const extra = phase === 'ANSWERING' || phase === 'GUESSING' ? this.cfg.submitGraceMs : 0
      this.timer = this.clock.setTimeout(() => this.onTimeout(step), ms + extra)
    }
  }

  private onTimeout(step: number) {
    if (this.destroyed || step !== this.s.step) return
    switch (this.s.phase) {
      case 'QUESTION':
        this.beginAnswering()
        break
      case 'ANSWERING':
        this.closeAnswering()
        break
      case 'GUESSING':
        this.openReveal()
        break
      case 'REVEAL':
        this.nextAnswerOrResults()
        break
      case 'ROUND_RESULTS':
        this.afterRoundResults()
        break
      case 'NEXT_ROUND':
        this.startRound()
        break
      default:
        return
    }
    this.changed()
  }

  /** Test helper and admin hook: run the pending timer right now. */
  fastForward() {
    this.onTimeout(this.s.step)
  }

  destroy() {
    this.destroyed = true
    if (this.timer) this.clock.clearTimeout(this.timer)
    if (this.hostTimer) this.clock.clearTimeout(this.hostTimer)
    for (const p of this.s.players.values()) if (p.graceTimer) this.clock.clearTimeout(p.graceTimer)
  }

  // ---------- membership ----------

  private uniqueName(name: string, exceptId?: string) {
    const taken = new Set(
      [...this.s.players.values()].filter((p) => p.id !== exceptId && !p.left).map((p) => p.name.toLowerCase()),
    )
    if (!taken.has(name.toLowerCase())) return name
    for (let i = 2; i < 100; i++) {
      const candidate = `${name.slice(0, LIMITS.nameMax - 3)} ${i}`
      if (!taken.has(candidate.toLowerCase())) return candidate
    }
    return `${name.slice(0, 8)} ${newId(2)}`
  }

  addPlayer(profile: Profile): Player {
    const present = [...this.s.players.values()].filter((p) => !p.left)
    const players = present.filter((p) => p.role === 'player').length
    const spectators = present.filter((p) => p.role === 'spectator').length
    const inGame = this.s.phase !== 'LOBBY'
    let role: Player['role'] = 'player'
    if (inGame || players >= LIMITS.maxPlayers) {
      if (!this.s.settings.allowSpectators)
        throw new GameError(inGame ? 'A game is in progress and this room does not allow spectators.' : 'This room is full.')
      if (spectators >= LIMITS.maxSpectators) throw new GameError('This room is full, even the spectator seats.')
      role = 'spectator'
    }
    const p: Player = {
      id: newId(8),
      token: newId(24),
      name: this.uniqueName(profile.name),
      avatar: profile.avatar,
      color: profile.color,
      role,
      ready: false,
      connected: true,
      left: false,
      disconnectedAt: null,
      joinedAt: this.clock.now(),
      sockets: new Set(),
      graceTimer: null,
    }
    this.s.players.set(p.id, p)
    this.s.order.push(p.id)
    if (!this.s.hostId) this.s.hostId = p.id
    this.changed()
    return p
  }

  findByToken(token: string): Player | null {
    if (this.s.kickedTokens.has(token)) return null
    for (const p of this.s.players.values()) if (sameToken(p.token, token)) return p
    return null
  }

  attach(playerId: string, socketId: string) {
    const p = this.player(playerId)
    p.sockets.add(socketId)
    if (!p.connected || p.left) {
      p.connected = true
      p.left = false
      p.disconnectedAt = null
    }
    if (p.graceTimer) this.clock.clearTimeout(p.graceTimer)
    p.graceTimer = null
    if (this.s.hostId === playerId && this.hostTimer) {
      this.clock.clearTimeout(this.hostTimer)
      this.hostTimer = null
    }
    if (!this.s.players.get(this.s.hostId)?.connected) this.pickNewHost()
    this.maybeResume()
    this.changed()
  }

  detach(playerId: string, socketId: string) {
    const p = this.s.players.get(playerId)
    if (!p) return
    p.sockets.delete(socketId)
    if (p.sockets.size > 0 || !p.connected) return
    p.connected = false
    p.disconnectedAt = this.clock.now()
    p.graceTimer = this.clock.setTimeout(() => this.expire(playerId), this.cfg.reconnectGraceMs)
    // Once the refresh window passes, stop waiting for them before advancing early.
    const step = this.s.step
    this.clock.setTimeout(() => {
      if (this.destroyed || this.s.step !== step || this.s.players.get(playerId)?.connected) return
      this.checkEarly()
      this.changed()
    }, this.cfg.refreshGraceMs + 50)
    if (this.s.hostId === playerId) {
      if (this.hostTimer) this.clock.clearTimeout(this.hostTimer)
      this.hostTimer = this.clock.setTimeout(() => {
        this.hostTimer = null
        if (!this.s.players.get(playerId)?.connected) {
          this.pickNewHost()
          this.changed()
        }
      }, this.cfg.hostGraceMs)
    }
    this.checkEarly()
    this.changed()
  }

  private expire(playerId: string) {
    const p = this.s.players.get(playerId)
    if (!p || p.connected) return
    p.graceTimer = null
    this.depart(p)
    this.changed()
  }

  private depart(p: Player) {
    p.connected = false
    if (p.graceTimer) this.clock.clearTimeout(p.graceTimer)
    p.graceTimer = null
    const inGame = GAME_PHASES.includes(this.s.phase) || this.s.phase === 'PAUSED' || this.s.phase === 'FINAL_RESULTS'
    const participated = !!this.s.game?.startedWith.includes(p.id)
    if (inGame && participated) p.left = true
    else {
      this.s.players.delete(p.id)
      this.s.order = this.s.order.filter((id) => id !== p.id)
    }
    if (this.s.hostId === p.id) this.pickNewHost()
    this.checkPause()
    this.checkEarly()
  }

  private pickNewHost() {
    const candidates = this.s.order
      .map((id) => this.s.players.get(id)!)
      .filter((p) => p && !p.left && p.connected && p.id !== this.s.hostId)
    const next = candidates.find((p) => p.role === 'player') ?? candidates[0]
    if (next) this.s.hostId = next.id
    else if (!this.s.players.get(this.s.hostId) || this.s.players.get(this.s.hostId)?.left) {
      const any = [...this.s.players.values()].find((p) => !p.left)
      this.s.hostId = any?.id ?? ''
    }
  }

  leave(playerId: string) {
    const p = this.player(playerId)
    p.sockets.clear()
    this.depart(p)
    this.changed()
  }

  kick(hostId: string, targetId: string): Player {
    this.requireHost(hostId)
    if (hostId === targetId) throw new GameError('You cannot kick yourself. Try leaving instead.')
    const p = this.player(targetId)
    this.s.kickedTokens.add(p.token)
    p.sockets.clear()
    this.depart(p)
    this.changed()
    return p
  }

  transferHost(hostId: string, targetId: string) {
    this.requireHost(hostId)
    const p = this.player(targetId)
    if (p.left || !p.connected) throw new GameError('That suspect is not here right now.')
    this.s.hostId = targetId
    this.changed()
  }

  updateProfile(playerId: string, profile: Profile) {
    const p = this.player(playerId)
    if (this.s.phase !== 'LOBBY' && this.s.phase !== 'FINAL_RESULTS') throw new GameError('Disguises are locked during a game.')
    p.name = this.uniqueName(profile.name, p.id)
    p.avatar = profile.avatar
    p.color = profile.color
    this.changed()
  }

  setReady(playerId: string, ready: boolean) {
    const p = this.player(playerId)
    if (this.s.phase !== 'LOBBY') throw new GameError('The game already started.')
    p.ready = ready
    this.changed()
  }

  updateSettings(playerId: string, partial: Partial<GameSettings>) {
    this.requireHost(playerId)
    if (this.s.phase !== 'LOBBY' && this.s.phase !== 'FINAL_RESULTS') throw new GameError('Settings are locked during a game.')
    const next = { ...this.s.settings, ...partial }
    next.decks = [...new Set(next.decks)]
    next.specialTypes = [...new Set(next.specialTypes.filter((t) => t !== 'classic'))] as RoundType[]
    this.s.settings = next
    this.changed()
  }

  setCustomDecks(playerId: string, decks: CustomDeck[]) {
    this.requireHost(playerId)
    if (this.s.phase !== 'LOBBY' && this.s.phase !== 'FINAL_RESULTS') throw new GameError('Decks are locked during a game.')
    this.s.customDecks = decks
    this.changed()
  }

  // ---------- game flow ----------

  start(playerId: string) {
    this.requireHost(playerId)
    if (this.s.phase !== 'LOBBY') throw new GameError('The game already started.')
    const players = this.connectedPlayers()
    if (players.length < LIMITS.minPlayers) throw new GameError(`You need at least ${LIMITS.minPlayers} connected players.`)
    const st = this.s.settings
    const hasCustom = st.customQuestions && this.s.customDecks.some((d) => d.questions.length > 0)
    if (st.decks.length === 0 && !hasCustom) throw new GameError('Pick at least one question deck.')
    if (eligibleQuestions(st, this.s.customDecks, 'classic').length === 0)
      throw new GameError('No questions match these decks and this chaos level.')
    // Anyone disconnected in the lobby is dropped so they cannot stall the first round.
    for (const p of [...this.s.players.values()]) if (!p.connected) this.depart(p)
    this.s.game = {
      plan: planRounds(st, this.rng),
      rounds: [],
      used: new Set(),
      ledger: new Map(),
      reactionsSent: new Map(),
      reactionsReceived: new Map(),
      emojiUse: new Map(),
      final: null,
      startedWith: players.map((p) => p.id),
    }
    this.startRound()
    this.changed()
  }

  private startRound() {
    const g = this.s.game!
    const index = g.rounds.length + 1
    const type = g.plan[index - 1] ?? 'classic'
    const participants = this.activePlayers().map((p) => p.id)
    const round: Round = {
      index,
      type,
      question: null as never,
      perPlayer: null,
      assignments: null,
      participants,
      submissions: new Map(),
      skipVotes: new Set(),
      skipUsed: false,
      answers: [],
      current: 0,
      multiplier: type === 'final-boss' ? 2 : 1,
      summary: null,
      bonusDone: false,
    }
    this.dealQuestions(round)
    if (type === 'identity-theft') round.assignments = assignImpersonations(participants, this.rng)
    g.rounds.push(round)
    this.go('QUESTION', this.cfg.questionCardMs)
  }

  private dealQuestions(round: Round) {
    const g = this.s.game!
    const count = round.type === 'plot-twist' ? round.participants.length : 1
    const qs = pickQuestions({
      settings: this.s.settings,
      customDecks: this.s.customDecks,
      type: round.type,
      used: g.used,
      recent: new Set(this.s.recent),
      count,
      rng: this.rng,
    })
    if (qs.length === 0) throw new GameError('Ran out of questions. Try more decks or a higher chaos level.')
    round.question = qs[0]
    if (round.type === 'plot-twist') {
      round.perPlayer = new Map(round.participants.map((id, i) => [id, qs[i % qs.length]]))
    }
    for (const q of qs) {
      g.used.add(q.id)
      this.s.recent = [...this.s.recent.filter((id) => id !== q.id), q.id].slice(-RECENT_MAX)
    }
  }

  private answerMs(round: Round) {
    const secs = round.type === 'speed-demon' ? this.cfg.speedDemonSeconds : this.s.settings.answerSeconds
    return secs * 1000
  }

  private beginAnswering() {
    this.go('ANSWERING', this.answerMs(this.round!))
  }

  /** Connected, or dropped very recently (probably refreshing). Anyone else cannot hold up an early advance. */
  private present(id: string) {
    const p = this.s.players.get(id)
    if (!p || p.left) return false
    if (p.connected) return true
    return p.disconnectedAt !== null && this.clock.now() - p.disconnectedAt < this.cfg.refreshGraceMs
  }

  private expectedSubmitters(round: Round) {
    return round.participants.filter((id) => this.present(id))
  }

  private checkEarly() {
    const r = this.round
    if (!r) return
    if (this.s.phase === 'ANSWERING') {
      const expected = this.expectedSubmitters(r)
      if (expected.length > 0 && expected.every((id) => r.submissions.has(id))) this.closeAnswering()
    } else if (this.s.phase === 'GUESSING') {
      const a = r.answers[r.current]
      const voters = a.eligible.filter((id) => this.present(id))
      if (voters.every((id) => a.votes.has(id))) this.openReveal()
    }
  }

  submitAnswer(playerId: string, step: number, raw: string) {
    this.requireStep(step, 'ANSWERING')
    const r = this.round!
    if (!r.participants.includes(playerId)) throw new GameError('You are spectating this round.')
    if (r.submissions.has(playerId)) throw new GameError('Already locked in. Unlock to edit.')
    const text = sanitizeAnswer(raw)
    if (!text) throw new GameError('Write something first. Or plead the fifth.')
    if (text.length > this.s.settings.answerLimit) throw new GameError(`Keep it under ${this.s.settings.answerLimit} characters.`)
    if (r.type === 'two-brain-cells' && countWords(text) > 3) throw new GameError('Two Brain Cells round. Three words, maximum.')
    r.submissions.set(playerId, { text, passed: false })
    this.checkEarly()
    this.changed()
  }

  unlockAnswer(playerId: string, step: number) {
    this.requireStep(step, 'ANSWERING')
    const r = this.round!
    if (!r.submissions.has(playerId)) throw new GameError('Nothing to unlock.')
    r.submissions.delete(playerId)
    this.changed()
  }

  passAnswer(playerId: string, step: number) {
    this.requireStep(step, 'ANSWERING')
    const r = this.round!
    if (!r.participants.includes(playerId)) throw new GameError('You are spectating this round.')
    if (r.submissions.get(playerId)?.passed) return
    r.submissions.set(playerId, { text: null, passed: true })
    this.checkEarly()
    this.changed()
  }

  skipNeeded() {
    const r = this.round
    const n = r ? this.expectedSubmitters(r).length : 0
    return Math.max(2, Math.ceil(n / 2))
  }

  requestSkip(playerId: string, step: number) {
    this.requireStep(step, 'ANSWERING')
    const r = this.round!
    if (!r.participants.includes(playerId)) throw new GameError('You are spectating this round.')
    if (r.skipUsed) throw new GameError('This round already skipped a question.')
    r.skipVotes.add(playerId)
    if (r.skipVotes.size >= this.skipNeeded()) {
      r.skipUsed = true
      r.skipVotes.clear()
      r.submissions.clear()
      this.dealQuestions(r)
      this.go('QUESTION', this.cfg.questionCardMs)
    }
    this.changed()
  }

  private closeAnswering() {
    const r = this.round!
    const answers: Answer[] = []
    for (const id of r.participants) {
      const sub = r.submissions.get(id)
      if (!sub || sub.passed || !sub.text) continue
      answers.push({
        id: newId(6),
        authorId: id,
        text: sub.text,
        question: r.perPlayer?.get(id) ?? r.question,
        impersonating: r.assignments?.get(id) ?? null,
        eligible: [],
        votes: new Map(),
        reveal: null,
        reactions: 0,
      })
    }
    r.answers = shuffle(answers, this.rng)
    r.current = 0
    if (r.answers.length === 0) this.finishRound()
    else this.startGuessing(0)
  }

  private startGuessing(i: number) {
    const r = this.round!
    r.current = i
    const a = r.answers[i]
    a.eligible = r.participants.filter((id) => id !== a.authorId && !this.s.players.get(id)?.left)
    this.go('GUESSING', this.s.settings.guessSeconds * 1000)
    const voters = a.eligible.filter((id) => this.s.players.get(id)?.connected)
    if (voters.length === 0) this.openReveal()
  }

  guess(playerId: string, step: number, suspectId: string) {
    this.requireStep(step, 'GUESSING')
    const r = this.round!
    const a = r.answers[r.current]
    if (playerId === a.authorId) throw new GameError('You cannot vote on your own answer.')
    if (!a.eligible.includes(playerId)) throw new GameError('You are not voting on this one.')
    if (a.votes.has(playerId)) throw new GameError('Vote already locked in.')
    if (suspectId === playerId) throw new GameError('You cannot accuse yourself. You know you did not write it.')
    if (!r.participants.includes(suspectId)) throw new GameError('That is not a suspect.')
    a.votes.set(playerId, suspectId)
    this.checkEarly()
    this.changed()
  }

  private openReveal() {
    const r = this.round!
    const a = r.answers[r.current]
    if (!a.reveal) a.reveal = this.score(r, a)
    this.go('REVEAL', this.s.settings.revealSeconds * 1000)
  }

  private addPoints(key: string, round: number, playerId: string, amount: number, reason: string) {
    const ledger = this.s.game!.ledger
    if (ledger.has(key) || amount === 0) return
    ledger.set(key, { key, round, playerId, amount, reason })
  }

  private score(r: Round, a: Answer): RevealInfo {
    const res = scoreAnswer({ authorId: a.authorId, eligible: a.eligible, votes: a.votes, multiplier: r.multiplier })
    for (const line of res.lines)
      this.addPoints(`${r.index}:${a.id}:${line.playerId}:${line.kind}`, r.index, line.playerId, line.amount, line.reason)
    const counts = new Map<string, number>()
    for (const [, s] of res.validVotes) counts.set(s, (counts.get(s) ?? 0) + 1)
    const distribution = [...counts.entries()].map(([suspectId, count]) => ({ suspectId, count })).sort((x, y) => y.count - x.count)
    const wrong = distribution.filter((d) => d.suspectId !== a.authorId)
    const commentary = revealCommentary({
      seed: a.id,
      author: this.name(a.authorId),
      votes: res.validVotes.length,
      correct: res.correctVoters.length,
      topWrong: wrong[0] ? { name: this.name(wrong[0].suspectId), count: wrong[0].count } : null,
      distinctSuspects: distribution.length,
      impersonating: a.impersonating ? this.name(a.impersonating) : null,
      impersonatedVotes: a.impersonating ? (counts.get(a.impersonating) ?? 0) : 0,
    })
    return {
      answerId: a.id,
      text: a.text,
      question: r.type === 'plot-twist' ? a.question.text : null,
      authorId: a.authorId,
      impersonating: a.impersonating,
      votes: res.validVotes.map(([voterId, suspectId]) => ({ voterId, suspectId })),
      distribution,
      correctVoters: res.correctVoters,
      points: res.lines.map(({ playerId, amount, reason }) => ({ playerId, amount, reason })),
      multiplier: r.multiplier,
      commentary,
      eligibleCount: a.eligible.length,
    }
  }

  private nextAnswerOrResults() {
    const r = this.round!
    if (r.current + 1 < r.answers.length) this.startGuessing(r.current + 1)
    else this.finishRound()
  }

  private records(rounds: Round[]): AnswerRecord[] {
    return rounds.flatMap((r) =>
      r.answers
        .filter((a) => a.reveal)
        .map((a) => ({
          id: a.id,
          round: r.index,
          roundType: r.type,
          authorId: a.authorId,
          text: a.text,
          question: a.question.text,
          impersonating: a.impersonating,
          eligible: a.eligible,
          votes: a.reveal!.votes.map((v) => [v.voterId, v.suspectId] as [string, string]),
          reactions: a.reactions,
        })),
    )
  }

  private finishRound() {
    const r = this.round!
    if (!r.bonusDone) {
      r.bonusDone = true
      const revealed = r.answers.filter((a) => a.reveal)
      for (const id of r.participants) {
        const bonus = perfectRoundBonus(revealed, id, r.multiplier)
        if (bonus) this.addPoints(`${r.index}:bonus:${id}`, r.index, id, bonus.amount, bonus.reason)
      }
    }
    const deltas = new Map<string, number>()
    for (const e of this.s.game!.ledger.values()) if (e.round === r.index) deltas.set(e.playerId, (deltas.get(e.playerId) ?? 0) + e.amount)
    r.summary = roundSummary({
      round: r.index,
      roundType: r.type,
      question: r.type === 'plot-twist' ? 'Everyone had a different question' : r.question.text,
      answers: this.records([r]),
      scores: this.scores(),
      deltas,
      playerIds: this.resultIds(),
      passedCount: [...r.submissions.values()].filter((s) => s.passed).length,
      names: this.name,
    })
    const ms = this.s.settings.progression === 'auto' ? this.cfg.autoResultsMs : this.cfg.manualResultsMs
    this.go('ROUND_RESULTS', ms)
  }

  private resultIds() {
    const g = this.s.game!
    const ids = new Set(g.startedWith)
    for (const r of g.rounds) for (const id of r.participants) ids.add(id)
    return [...ids].filter((id) => this.s.players.has(id))
  }

  advance(playerId: string, step: number) {
    this.requireHost(playerId)
    this.requireStep(step, 'ROUND_RESULTS', 'REVEAL', 'QUESTION', 'NEXT_ROUND')
    this.onTimeout(step)
  }

  private afterRoundResults() {
    const g = this.s.game!
    if (g.rounds.length >= g.plan.length) this.finishGame()
    else this.go('NEXT_ROUND', this.cfg.nextRoundMs)
  }

  private finishGame() {
    const g = this.s.game!
    const favorite = new Map<string, string | null>()
    for (const [id, m] of g.emojiUse) {
      const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0]
      favorite.set(id, top ? top[0] : null)
    }
    g.final = finalResults({
      records: this.records(g.rounds),
      playerIds: this.resultIds(),
      scores: this.scores(),
      reactionsSent: g.reactionsSent,
      reactionsReceived: g.reactionsReceived,
      favoriteEmoji: favorite,
      rounds: g.rounds.length,
      names: this.name,
    })
    this.s.pausedFrom = null
    this.s.pauseReason = null
    this.s.gamesPlayed++
    this.go('FINAL_RESULTS', null)
  }

  endGame(playerId: string) {
    this.requireHost(playerId)
    if (!this.s.game || this.s.phase === 'FINAL_RESULTS' || this.s.phase === 'LOBBY') throw new GameError('No game to end.')
    this.finishGame()
    this.changed()
  }

  rematch(playerId: string) {
    this.requireHost(playerId)
    if (this.s.phase !== 'FINAL_RESULTS') throw new GameError('Finish this game first.')
    for (const p of [...this.s.players.values()]) {
      if (p.left) {
        this.s.players.delete(p.id)
        this.s.order = this.s.order.filter((id) => id !== p.id)
      }
    }
    let seats = LIMITS.maxPlayers - this.activePlayers().length
    for (const id of this.s.order) {
      const p = this.s.players.get(id)!
      p.ready = false
      if (p.role === 'spectator' && seats > 0) {
        p.role = 'player'
        seats--
      }
    }
    this.s.game = null
    if (!this.s.players.get(this.s.hostId)) this.pickNewHost()
    this.go('LOBBY', null)
    this.changed()
  }

  // ---------- pause ----------

  private checkPause() {
    if (!GAME_PHASES.includes(this.s.phase)) return
    if (this.activePlayers().length >= LIMITS.minPlayers) return
    this.s.pausedFrom = this.s.phase
    this.s.pauseRemaining = Math.max(0, (this.s.deadline ?? this.clock.now()) - this.clock.now())
    this.s.pauseReason = `Not enough suspects. Waiting for at least ${LIMITS.minPlayers} players to return.`
    this.go('PAUSED', null)
  }

  private maybeResume() {
    if (this.s.phase !== 'PAUSED' || !this.s.pausedFrom) return
    if (this.activePlayers().length < LIMITS.minPlayers) return
    const from = this.s.pausedFrom
    this.s.pausedFrom = null
    this.s.pauseReason = null
    this.go(from, Math.max(this.s.pauseRemaining, 8_000))
  }

  // ---------- reactions ----------

  react(playerId: string, emoji: Reaction): ReactionEvent {
    const p = this.player(playerId)
    if (!this.s.settings.allowReactions) throw new GameError('Reactions are turned off in this room.')
    const g = this.s.game
    if (g) {
      g.reactionsSent.set(p.id, (g.reactionsSent.get(p.id) ?? 0) + 1)
      const m = g.emojiUse.get(p.id) ?? new Map()
      m.set(emoji, (m.get(emoji) ?? 0) + 1)
      g.emojiUse.set(p.id, m)
      const r = this.round
      if (this.s.phase === 'REVEAL' && r) {
        const a = r.answers[r.current]
        if (a && a.authorId !== p.id) {
          a.reactions++
          g.reactionsReceived.set(a.authorId, (g.reactionsReceived.get(a.authorId) ?? 0) + 1)
        }
      }
    }
    this.touch()
    return { playerId: p.id, emoji, at: this.clock.now() }
  }

  // ---------- projection ----------

  private publicPlayer(p: Player, scores: Map<string, number>): PublicPlayer {
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      isHost: this.s.hostId === p.id,
      ready: p.ready,
      connected: p.connected,
      role: p.role,
      score: scores.get(p.id) ?? 0,
      left: p.left,
    }
  }

  /** What one specific viewer is allowed to know. Authors stay secret until their reveal. */
  view(viewerId: string): RoomView {
    const me = this.player(viewerId)
    const scores = this.scores()
    return {
      code: this.s.code,
      you: { id: me.id, role: me.role, isHost: this.s.hostId === me.id },
      players: this.s.order.map((id) => this.publicPlayer(this.s.players.get(id)!, scores)),
      settings: this.s.settings,
      customDecks: this.s.customDecks.map((d) => ({ id: d.id, name: d.name, color: d.color, icon: d.icon, count: d.questions.length })),
      phase: this.s.phase,
      pausedFrom: this.s.pausedFrom,
      pauseReason: this.s.pauseReason,
      step: this.s.step,
      deadline: this.s.deadline,
      serverNow: this.clock.now(),
      game: this.gameView(me),
      gamesPlayed: this.s.gamesPlayed,
    }
  }

  private gameView(me: Player): GameView | null {
    const g: Game | null = this.s.game
    const r = this.round
    if (!g || !r) return null
    const phase = this.s.phase === 'PAUSED' ? this.s.pausedFrom! : this.s.phase
    const isParticipant = r.participants.includes(me.id)
    const ownQ = r.perPlayer ? (isParticipant ? r.perPlayer.get(me.id)! : null) : r.question
    const sub = r.submissions.get(me.id)
    let current: GameView['current'] = null
    if ((phase === 'GUESSING' || phase === 'REVEAL') && r.answers[r.current]) {
      const a = r.answers[r.current]
      const canVote = phase === 'GUESSING' && a.eligible.includes(me.id)
      current = {
        id: a.id,
        index: r.current,
        total: r.answers.length,
        text: a.text,
        question: r.type === 'plot-twist' ? a.question.text : null,
        impersonating: a.impersonating,
        youAreAuthor: a.authorId === me.id,
        suspects: canVote ? r.participants.filter((id) => id !== me.id) : [],
        guessedCount: a.votes.size,
        eligibleCount: a.eligible.length,
        myGuess: a.votes.get(me.id) ?? null,
      }
    }
    return {
      round: r.index,
      totalRounds: g.plan.length,
      roundType: r.type,
      rules: ROUND_RULES[r.type].rule,
      question: ownQ ? { id: ownQ.id, text: ownQ.text, deck: ownQ.deck, placeholder: ownQ.placeholder ?? null } : null,
      answerLimit: r.type === 'two-brain-cells' ? Math.min(40, this.s.settings.answerLimit) : this.s.settings.answerLimit,
      submittedCount: r.submissions.size,
      eligibleCount: r.participants.filter((id) => !this.s.players.get(id)?.left).length,
      mine: sub ? { text: sub.text, passed: sub.passed } : null,
      impersonate: r.assignments?.get(me.id) ?? null,
      skip: { votes: r.skipVotes.size, needed: this.skipNeeded(), mine: r.skipVotes.has(me.id), used: r.skipUsed },
      current,
      reveal: phase === 'REVEAL' ? (r.answers[r.current]?.reveal ?? null) : null,
      summary: phase === 'ROUND_RESULTS' || phase === 'NEXT_ROUND' ? r.summary : null,
      final: this.s.phase === 'FINAL_RESULTS' ? g.final : null,
      multiplier: r.multiplier,
    }
  }
}
