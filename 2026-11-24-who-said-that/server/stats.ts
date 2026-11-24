// Round recaps, awards and the Friendship Intelligence Report.
// Everything is computed from recorded votes. Nothing is invented.
import type { RoundType } from '../shared/questions.ts'
import type { Award, FinalResults, Moment, PlayerReport, RoundSummary } from '../shared/protocol.ts'
import { fill, groupVerdict, pick } from './commentary.ts'

export interface AnswerRecord {
  id: string
  round: number
  roundType: RoundType
  authorId: string
  text: string
  question: string
  impersonating: string | null
  eligible: string[]
  votes: [string, string][]
  reactions: number
}

type Names = (id: string) => string
const pct = (c: number, t: number) => (t === 0 ? 0 : c / t)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

const correctOf = (a: AnswerRecord) => a.votes.filter(([, s]) => s === a.authorId).length
const wrongOf = (a: AnswerRecord) => a.votes.length - correctOf(a)

// ---------- round summary ----------

export function roundSummary(input: {
  round: number
  roundType: RoundType
  question: string
  answers: AnswerRecord[]
  scores: Map<string, number>
  deltas: Map<string, number>
  playerIds: string[]
  passedCount: number
  names: Names
}): RoundSummary {
  const { answers, names } = input
  const leaderboard = input.playerIds
    .map((id) => ({ playerId: id, score: input.scores.get(id) ?? 0, delta: input.deltas.get(id) ?? 0 }))
    .sort((a, b) => b.score - a.score || b.delta - a.delta)

  let biggestDeception: RoundSummary['biggestDeception'] = null
  let mostObvious: RoundSummary['mostObvious'] = null
  for (const a of answers) {
    const fooled = wrongOf(a)
    if (fooled > 0 && (!biggestDeception || fooled > biggestDeception.fooled))
      biggestDeception = { answerId: a.id, authorId: a.authorId, fooled }
    const c = correctOf(a)
    if (c >= 2 && (!mostObvious || pct(c, a.votes.length) > pct(mostObvious.correct, mostObvious.votes)))
      mostObvious = { answerId: a.id, authorId: a.authorId, correct: c, votes: a.votes.length }
  }
  const wrongAcc = new Map<string, number>()
  for (const a of answers)
    for (const [, s] of a.votes) if (s !== a.authorId) wrongAcc.set(s, (wrongAcc.get(s) ?? 0) + 1)
  let mostSuspected: RoundSummary['mostSuspected'] = null
  for (const [id, n] of wrongAcc)
    if (n >= 2 && (!mostSuspected || n > mostSuspected.wrongAccusations)) mostSuspected = { playerId: id, wrongAccusations: n }

  const recap: string[] = []
  const seed = `r${input.round}:${answers.map((a) => a.id).join()}`
  const totalVotes = answers.reduce((s, a) => s + a.votes.length, 0)
  const totalCorrect = answers.reduce((s, a) => s + correctOf(a), 0)
  if (answers.length === 0) recap.push('Everyone pleaded the fifth. The case file is empty. Suspicious in itself.')
  if (totalVotes > 0)
    recap.push(
      fill(
        pick(seed, [
          'Detectives cracked {c} of {t} accusations this round.',
          'Case closure rate is {c} out of {t}. The chief is {mood}.',
        ]),
        { c: totalCorrect, t: totalVotes, mood: pct(totalCorrect, totalVotes) >= 0.5 ? 'cautiously impressed' : 'filing a complaint' },
      ),
    )
  if (biggestDeception && biggestDeception.fooled >= 2)
    recap.push(`${names(biggestDeception.authorId)} fooled ${plural(biggestDeception.fooled, 'detective')} with one answer.`)
  if (mostSuspected)
    recap.push(`${names(mostSuspected.playerId)} was wrongly accused ${mostSuspected.wrongAccusations} times and is now lawyering up.`)
  if (mostObvious && mostObvious.correct === mostObvious.votes)
    recap.push(`${names(mostObvious.authorId)} was spotted instantly. Zero mystery. Total transparency.`)
  const top = leaderboard[0]
  if (top && top.delta > 0) recap.push(`${names(top.playerId)} leads the investigation with ${top.score} points.`)
  if (input.passedCount > 0) recap.push(`${plural(input.passedCount, 'suspect')} pleaded the fifth this round.`)

  return {
    round: input.round,
    roundType: input.roundType,
    question: input.question,
    leaderboard,
    answers: answers.map((a) => ({
      answerId: a.id,
      authorId: a.authorId,
      text: a.text,
      question: a.roundType === 'plot-twist' ? a.question : null,
      correct: correctOf(a),
      votes: a.votes.length,
    })),
    biggestDeception,
    mostObvious,
    mostSuspected,
    recap,
    passedCount: input.passedCount,
  }
}

// ---------- final results ----------

interface Tally {
  guesses: number
  correct: number
  votesOnMine: number
  correctOnMine: number
  fooled: number
  wrongAccused: number
}

function topWinners<T>(items: T[], value: (t: T) => number, min: number, maxWinners = 3): { winners: T[]; value: number } | null {
  let best = -Infinity
  for (const t of items) best = Math.max(best, value(t))
  if (!(best >= min)) return null
  const winners = items.filter((t) => value(t) === best)
  if (winners.length > maxWinners) return null
  return { winners, value: best }
}

export function finalResults(input: {
  records: AnswerRecord[]
  playerIds: string[]
  scores: Map<string, number>
  reactionsSent: Map<string, number>
  reactionsReceived: Map<string, number>
  favoriteEmoji: Map<string, string | null>
  rounds: number
  names: Names
}): FinalResults {
  const { records, playerIds, scores, names } = input
  const ids = [...playerIds]
  const idx = new Map(ids.map((id, i) => [id, i]))
  const tally = new Map<string, Tally>(ids.map((id) => [id, { guesses: 0, correct: 0, votesOnMine: 0, correctOnMine: 0, fooled: 0, wrongAccused: 0 }]))
  const t = (id: string) => tally.get(id)!
  // pair[a][b] = { opp, hit }: a voting on answers by b
  const pair = new Map<string, Map<string, { opp: number; hit: number }>>()
  const pairOf = (a: string, b: string) => {
    if (!pair.has(a)) pair.set(a, new Map())
    const m = pair.get(a)!
    if (!m.has(b)) m.set(b, { opp: 0, hit: 0 })
    return m.get(b)!
  }
  const accused = new Map<string, Map<string, { times: number; actual: number }>>()
  const cells = ids.map(() => ids.map(() => 0))
  const confusion = new Map<string, number>()

  for (const a of records) {
    if (!tally.has(a.authorId)) continue
    for (const [voter, suspect] of a.votes) {
      if (!tally.has(voter)) continue
      const hit = suspect === a.authorId
      t(voter).guesses++
      if (hit) t(voter).correct++
      t(a.authorId).votesOnMine++
      if (hit) t(a.authorId).correctOnMine++
      else {
        t(a.authorId).fooled++
        if (tally.has(suspect)) t(suspect).wrongAccused++
        const key = `${a.authorId}>${suspect}`
        confusion.set(key, (confusion.get(key) ?? 0) + 1)
      }
      const p = pairOf(voter, a.authorId)
      p.opp++
      if (hit) p.hit++
      if (!accused.has(voter)) accused.set(voter, new Map())
      const acc = accused.get(voter)!
      const entry = acc.get(suspect) ?? { times: 0, actual: 0 }
      entry.times++
      if (hit) entry.actual++
      acc.set(suspect, entry)
      const r = idx.get(a.authorId)
      const c = idx.get(suspect)
      if (r !== undefined && c !== undefined) cells[r][c]++
    }
  }

  const ranked = [...ids].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0))
  const leaderboard = ranked.map((id) => {
    const score = scores.get(id) ?? 0
    const rank = 1 + ranked.filter((o) => (scores.get(o) ?? 0) > score).length
    return { playerId: id, score, rank }
  })

  // ---------- awards ----------
  const awards: Award[] = []
  const add = (a: Omit<Award, 'winners'> & { winners: string[] } | null) => {
    if (a && a.winners.length) awards.push(a)
  }
  const maxGuesses = Math.max(0, ...ids.map((id) => t(id).guesses))
  const minGuesses = Math.min(3, maxGuesses)

  const fbi = topWinners(ids.filter((id) => t(id).guesses >= Math.max(1, minGuesses)), (id) => pct(t(id).correct, t(id).guesses), 0.01)
  if (fbi)
    add({
      id: 'fbi',
      title: 'Certified FBI Agent',
      description: 'Highest guessing accuracy. Has a corkboard with red string at home. Probably.',
      winners: fbi.winners,
      stat: fbi.winners.map((id) => `${t(id).correct}/${t(id).guesses} correct`).join(', '),
      badge: 'badge',
    })
  const dec = topWinners(ids, (id) => t(id).fooled, 1)
  if (dec)
    add({
      id: 'deception',
      title: 'Master of Deception',
      description: 'Fooled the most detectives. Do not lend this person money.',
      winners: dec.winners,
      stat: `fooled ${plural(dec.value, 'detective')}`,
      badge: 'mask',
    })
  const enemy = topWinners(ids, (id) => t(id).wrongAccused, 2)
  if (enemy)
    add({
      id: 'public-enemy',
      title: 'Public Enemy No. 1',
      description: 'Most wrongly accused. Innocent, allegedly. Looks guilty, definitely.',
      winners: enemy.winners,
      stat: `wrongly accused ${enemy.value} times`,
      badge: 'wanted',
    })
  const withVotes = ids.filter((id) => t(id).votesOnMine >= 3)
  const npc = topWinners(withVotes, (id) => pct(t(id).correctOnMine, t(id).votesOnMine), 0.5)
  if (npc)
    add({
      id: 'npc',
      title: 'NPC Behavior',
      description: 'Most predictable answers. Running on the default dialogue tree.',
      winners: npc.winners,
      stat: npc.winners.map((id) => `identified ${t(id).correctOnMine}/${t(id).votesOnMine}`).join(', '),
      badge: 'npc',
    })
  const unread = withVotes.length >= 2 ? topWinners(withVotes, (id) => 1 - pct(t(id).correctOnMine, t(id).votesOnMine), 0.66) : null
  if (unread)
    add({
      id: 'unreadable',
      title: 'Unreadable Manuscript',
      description: 'Hardest suspect to identify. A closed book. Possibly in another language.',
      winners: unread.winners,
      stat: unread.winners.map((id) => `identified only ${t(id).correctOnMine}/${t(id).votesOnMine}`).join(', '),
      badge: 'scroll',
    })
  let crisis: { truth: string; guess: string; n: number } | null = null
  for (const [k, n] of confusion) {
    const [truth, guess] = k.split('>')
    if (n >= 2 && (!crisis || n > crisis.n)) crisis = { truth, guess, n }
  }
  if (crisis)
    add({
      id: 'identity-crisis',
      title: 'Identity Crisis',
      description: `Kept getting mistaken for ${names(crisis.guess)}. Are you two the same person? Asking for the FBI.`,
      winners: [crisis.truth],
      stat: `mistaken for ${names(crisis.guess)} ${crisis.n} times`,
      badge: 'mirror',
    })
  const delusional = topWinners(ids, (id) => t(id).guesses - t(id).correct, 2)
  if (delusional)
    add({
      id: 'delusional',
      title: 'Delusional Detective',
      description: 'Most incorrect guesses. Confidence: 100. Accuracy: under review.',
      winners: delusional.winners,
      stat: `${delusional.value} wrong guesses`,
      badge: 'magnifier',
    })
  // pairs
  let brain: { a: string; b: string; score: number; samples: number } | null = null
  let feud: { a: string; b: string; score: number; samples: number } | null = null
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]
      const b = ids[j]
      const ab = pair.get(a)?.get(b)
      const ba = pair.get(b)?.get(a)
      if (!ab || !ba || ab.opp + ba.opp < 2) continue
      const hitRate = (ab.hit + ba.hit) / (ab.opp + ba.opp)
      if (ab.hit > 0 && ba.hit > 0 && hitRate >= 0.6 && (!brain || hitRate > brain.score)) brain = { a, b, score: hitRate, samples: ab.opp + ba.opp }
      const missRate = 1 - hitRate
      if (ab.hit < ab.opp && ba.hit < ba.opp && missRate >= 0.6 && (!feud || missRate > feud.score))
        feud = { a, b, score: missRate, samples: ab.opp + ba.opp }
    }
  if (brain)
    add({
      id: 'shared-brain-cell',
      title: 'Shared Brain Cell',
      description: 'Strongest mutual guessing accuracy. One brain cell, two hosts, zero privacy.',
      winners: [brain.a, brain.b],
      stat: `${Math.round(brain.score * 100)}% mutual accuracy over ${brain.samples} guesses`,
      badge: 'brain',
    })
  if (feud)
    add({
      id: 'under-investigation',
      title: 'Friendship Under Investigation',
      description: 'Strongest mutual misidentification. Have you two ever actually spoken?',
      winners: [feud.a, feud.b],
      stat: `missed each other ${Math.round(feud.score * 100)}% of the time over ${feud.samples} guesses`,
      badge: 'tape',
    })
  // plot twist: the reveal where the most votes converged on a wrong suspect
  let twist: { a: AnswerRecord; score: number } | null = null
  for (const a of records) {
    if (a.votes.length < 2) continue
    const counts = new Map<string, number>()
    for (const [, s] of a.votes) if (s !== a.authorId) counts.set(s, (counts.get(s) ?? 0) + 1)
    const topWrong = Math.max(0, ...counts.values())
    const score = topWrong + (correctOf(a) === 0 ? 1 : 0)
    if (topWrong >= 2 && (!twist || score > twist.score)) twist = { a, score }
  }
  if (twist)
    add({
      id: 'plot-twist',
      title: 'The Plot Twist',
      description: 'Wrote the most surprising reveal of the night. Gasps were recorded.',
      winners: [twist.a.authorId],
      stat: `${wrongOf(twist.a)}/${twist.a.votes.length} detectives fooled by one answer`,
      badge: 'twist',
    })
  const mc = topWinners(ids, (id) => input.reactionsReceived.get(id) ?? 0, 3)
  if (mc)
    add({
      id: 'main-character',
      title: 'Main Character',
      description: 'Most reactions received. The crowd has chosen its protagonist.',
      winners: mc.winners,
      stat: `${mc.value} reactions`,
      badge: 'crown',
    })

  // ---------- reports ----------
  const reports: Record<string, PlayerReport> = {}
  for (const id of ids) {
    const me = t(id)
    const friends = ids
      .filter((f) => f !== id)
      .map((f) => {
        const mine = pair.get(id)?.get(f) ?? { opp: 0, hit: 0 }
        const theirs = pair.get(f)?.get(id) ?? { opp: 0, hit: 0 }
        return {
          friendId: f,
          youGotThem: { correct: mine.hit, total: mine.opp },
          theyGotYou: { correct: theirs.hit, total: theirs.opp },
        }
      })
    let mostConfused: PlayerReport['mostConfused'] = null
    for (const a of records)
      for (const [voter, suspect] of a.votes)
        if (voter === id && suspect !== a.authorId) {
          const n = records.reduce(
            (s, r) => s + r.votes.filter(([v, sus]) => v === id && sus === suspect && r.authorId === a.authorId).length,
            0,
          )
          if (!mostConfused || n > mostConfused.count) mostConfused = { truthId: a.authorId, guessedId: suspect, count: n }
        }
    let bestDeception: PlayerReport['bestDeception'] = null
    for (const a of records)
      if (a.authorId === id) {
        const f = wrongOf(a)
        if (f > 0 && (!bestDeception || f > bestDeception.fooled)) bestDeception = { text: a.text, fooled: f, votes: a.votes.length }
      }
    let blindSpot: PlayerReport['blindSpot'] = null
    for (const fl of friends) {
      const { correct, total } = fl.youGotThem
      if (total >= 2 && (!blindSpot || pct(correct, total) < pct(blindSpot.correct, blindSpot.total)))
        blindSpot = { friendId: fl.friendId, correct, total }
    }
    if (blindSpot && pct(blindSpot.correct, blindSpot.total) >= 0.5) blindSpot = null
    let soulmate: PlayerReport['soulmate'] = null
    for (const fl of friends) {
      const samples = fl.youGotThem.total + fl.theyGotYou.total
      if (fl.youGotThem.total === 0 || fl.theyGotYou.total === 0) continue
      const rate = (fl.youGotThem.correct + fl.theyGotYou.correct) / samples
      if (rate > 0 && (!soulmate || rate > soulmate.rate || (rate === soulmate.rate && samples > soulmate.samples)))
        soulmate = { friendId: fl.friendId, rate, samples }
    }
    const reactions = {
      sent: input.reactionsSent.get(id) ?? 0,
      received: input.reactionsReceived.get(id) ?? 0,
      favorite: input.favoriteEmoji.get(id) ?? null,
    }
    const commentary: string[] = []
    const acc = pct(me.correct, me.guesses)
    const accusedMap = accused.get(id)
    if (accusedMap)
      for (const [sus, e] of accusedMap)
        if (e.times >= 2 && e.actual === 0) {
          commentary.push(`You confidently pinned ${e.times} answers on ${names(sus)}. ${names(sus)} wrote none of them.`)
          break
        }
    if (soulmate && soulmate.rate >= 0.66 && soulmate.samples >= 2)
      commentary.push(`You and ${names(soulmate.friendId)} appear to share one functioning brain cell.`)
    if (me.votesOnMine >= 3 && pct(me.correctOnMine, me.votesOnMine) >= 0.75)
      commentary.push('Your friends know your personality better than you would probably like.')
    if (me.votesOnMine >= 3 && pct(me.correctOnMine, me.votesOnMine) <= 0.25)
      commentary.push('Nobody can read you. Mysterious or just unhinged? The file is inconclusive.')
    if (me.guesses >= 3 && acc <= 0.3)
      commentary.push('The investigation has revealed several concerning gaps in your friendship knowledge.')
    if (me.guesses >= 3 && acc >= 0.75) commentary.push('Certified bestie surveillance. You know too much.')
    if (bestDeception && bestDeception.fooled >= 2)
      commentary.push(`One of your answers fooled ${bestDeception.fooled} people. Put it on your resume.`)
    if (blindSpot)
      commentary.push(`Biggest blind spot is ${names(blindSpot.friendId)}. You went ${blindSpot.correct}/${blindSpot.total} on their answers.`)
    if (reactions.received >= 3) commentary.push(`Your answers pulled ${reactions.received} reactions. The people are entertained.`)
    if (commentary.length === 0) commentary.push('Not enough evidence for a full profile. Suspiciously low key behavior.')

    const rank = leaderboard.find((l) => l.playerId === id)?.rank ?? ids.length
    const headline =
      rank === 1
        ? 'Lead detective. The case is yours.'
        : me.guesses >= 2 && acc >= 0.6
          ? 'Sharp eyes, questionable friends.'
          : me.fooled >= 3
            ? 'A professional liar with a heart of gold.'
            : me.guesses >= 2 && acc < 0.3
              ? 'Enthusiastic. Wrong. Enthusiastically wrong.'
              : 'Person of interest. Remains at large.'

    reports[id] = {
      playerId: id,
      accuracy: { correct: me.correct, total: me.guesses },
      predictability: { identified: me.correctOnMine, total: me.votesOnMine },
      friends,
      mostConfused: mostConfused && mostConfused.count >= 1 ? mostConfused : null,
      bestDeception,
      blindSpot,
      soulmate,
      reactions,
      commentary,
      headline,
    }
  }

  // ---------- moments ----------
  const moments: Moment[] = []
  const used = new Set<string>()
  const push = (a: AnswerRecord | undefined, why: string) => {
    if (!a || used.has(a.id)) return
    used.add(a.id)
    moments.push({ answerId: a.id, authorId: a.authorId, text: a.text, question: a.question, why })
  }
  if (twist) push(twist.a, `${wrongOf(twist.a)} of ${twist.a.votes.length} detectives got this one wrong`)
  const mostReacted = [...records].sort((a, b) => b.reactions - a.reactions)[0]
  if (mostReacted && mostReacted.reactions >= 2) push(mostReacted, `${mostReacted.reactions} live reactions`)
  const ghost = records.find((a) => a.votes.length >= 2 && correctOf(a) === 0)
  if (ghost) push(ghost, 'nobody suspected the real author')
  const obvious = records.find((a) => a.votes.length >= 2 && correctOf(a) === a.votes.length)
  if (obvious) push(obvious, 'everyone knew instantly')

  const groupTotal = ids.reduce((s, id) => s + t(id).guesses, 0)
  const groupCorrect = ids.reduce((s, id) => s + t(id).correct, 0)
  const reactionsTotal = [...input.reactionsSent.values()].reduce((s, n) => s + n, 0)

  return {
    leaderboard,
    awards,
    reports,
    matrix: { ids, cells },
    moments: moments.slice(0, 4),
    group: {
      accuracy: { correct: groupCorrect, total: groupTotal },
      answers: records.length,
      rounds: input.rounds,
      reactions: reactionsTotal,
      verdict: groupVerdict(pct(groupCorrect, groupTotal), groupTotal),
    },
  }
}
