// Draws shareable PNG result cards on a canvas. No answers are included.
import { AVATARS } from '../../shared/avatars.ts'
import type { Award, FinalResults, PublicPlayer } from '../../shared/protocol.ts'
import { spriteColors } from '../components/PixelAvatar.tsx'

const INK = '#29252E'
const CREAM = '#FFF9F0'
const PINK = '#FFD1D3'
const YELLOW = '#FFE9AE'
const LAV = '#DCCDF8'
const BLUE = '#DCEBFC'
const CHERRY = '#E85D75'

function avatar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, avatarIdx: number, color: string) {
  const sprite = AVATARS[avatarIdx] ?? AVATARS[0]
  const colors = spriteColors(color)
  const px = size / 12
  sprite.rows.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      if (ch === '.') return
      ctx.fillStyle = colors[ch] ?? color
      ctx.fillRect(Math.round(x + rx * px), Math.round(y + ry * px), Math.ceil(px), Math.ceil(px))
    }),
  )
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, shadow = 10) {
  ctx.fillStyle = INK
  ctx.fillRect(x + shadow, y + shadow, w, h)
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
  ctx.lineWidth = 5
  ctx.strokeStyle = INK
  ctx.strokeRect(x, y, w, h)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines = 4) {
  const words = text.split(' ')
  let line = ''
  let lines = 0
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH)
      lines++
      line = w
      if (lines >= maxLines - 1) break
    } else line = test
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineH)
  return lines + 1
}

function stamp(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, rot: number, color = CHERRY) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.font = '900 34px "Bagel Fat One", system-ui'
  const w = ctx.measureText(text).width + 36
  ctx.strokeStyle = color
  ctx.lineWidth = 5
  ctx.strokeRect(-w / 2, -30, w, 56)
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(text, 0, 10)
  ctx.restore()
}

function background(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(41,37,46,0.08)'
  for (let x = 12; x < w; x += 28) for (let y = 12; y < h; y += 28) ctx.fillRect(x, y, 4, 4)
  // window bar
  ctx.fillStyle = LAV
  ctx.fillRect(0, 0, w, 64)
  ctx.fillStyle = INK
  ctx.fillRect(0, 64, w, 5)
  ctx.font = '28px "VT323", monospace'
  ctx.fillText('WHO_SAID_THAT.EXE · CASE REPORT', 28, 42)
  ctx.textAlign = 'right'
  ctx.fillText('_ □ ×', w - 28, 42)
  ctx.textAlign = 'left'
}

function footer(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = INK
  ctx.fillRect(0, h - 70, w, 70)
  ctx.fillStyle = YELLOW
  ctx.font = '30px "Bagel Fat One", system-ui'
  ctx.fillText('Who Said That?', 28, h - 24)
  ctx.font = '24px "VT323", monospace'
  ctx.textAlign = 'right'
  ctx.fillStyle = CREAM
  ctx.fillText('your friends. your secrets. your questionable guesses.', w - 28, h - 26)
  ctx.textAlign = 'left'
}

async function ready() {
  try {
    await document.fonts.ready
    await Promise.all([document.fonts.load('40px "Bagel Fat One"'), document.fonts.load('24px "VT323"'), document.fonts.load('600 24px "DM Sans Variable"')])
  } catch {
    /* fonts optional */
  }
}

export async function playerCard(opts: {
  player: PublicPlayer
  rank: number
  total: number
  score: number
  award: Award | null
  accuracy: { correct: number; total: number }
  summary: string
}): Promise<Blob> {
  await ready()
  const W = 1200
  const H = 675
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  background(ctx, W, H)
  const { player } = opts
  // mugshot
  box(ctx, 60, 110, 300, 360, player.color)
  ctx.fillStyle = 'rgba(41,37,46,0.18)'
  for (let y = 130; y < 450; y += 40) ctx.fillRect(60, y, 300, 3)
  avatar(ctx, 90, 160, 240, player.avatar, player.color)
  ctx.fillStyle = INK
  ctx.fillRect(60, 470, 300, 70)
  ctx.fillStyle = CREAM
  ctx.font = '600 36px "DM Sans Variable", system-ui'
  ctx.textAlign = 'center'
  ctx.fillText(player.name.slice(0, 16), 210, 517)
  ctx.textAlign = 'left'
  // rank + score
  ctx.fillStyle = INK
  ctx.font = '28px "VT323", monospace'
  ctx.fillText(`FINAL RANK ${opts.rank} OF ${opts.total}`, 420, 140)
  ctx.font = '120px "Bagel Fat One", system-ui'
  ctx.fillStyle = CHERRY
  ctx.fillText(`${opts.score}`, 416, 250)
  ctx.font = '30px "VT323", monospace'
  ctx.fillStyle = INK
  ctx.fillText('POINTS', 420, 285)
  // award
  box(ctx, 420, 320, 700, 140, opts.award ? PINK : BLUE, 8)
  ctx.fillStyle = INK
  ctx.font = '24px "VT323", monospace'
  ctx.fillText('OFFICIAL AWARD', 444, 356)
  ctx.font = '44px "Bagel Fat One", system-ui'
  ctx.fillText(opts.award?.title ?? 'Person of Interest', 444, 408)
  ctx.font = '500 22px "DM Sans Variable", system-ui'
  wrap(ctx, opts.award?.stat ?? 'remains at large', 444, 440, 650, 26, 1)
  // accuracy + summary
  ctx.font = '28px "VT323", monospace'
  const acc = opts.accuracy.total ? Math.round((opts.accuracy.correct / opts.accuracy.total) * 100) : 0
  ctx.fillText(`GUESSING ACCURACY ${acc}% (${opts.accuracy.correct}/${opts.accuracy.total})`, 420, 510)
  ctx.font = 'italic 500 26px "DM Sans Variable", system-ui'
  wrap(ctx, `“${opts.summary}”`, 420, 550, 720, 32, 2)
  if (opts.rank === 1) stamp(ctx, 'LEAD DETECTIVE', 1000, 180, 0.18)
  else stamp(ctx, 'CASE CLOSED', 1010, 180, 0.16, INK)
  footer(ctx, W, H)
  return new Promise((r) => c.toBlob((b) => r(b!), 'image/png'))
}

export async function groupCard(opts: { players: PublicPlayer[]; final: FinalResults; code: string }): Promise<Blob> {
  await ready()
  const W = 1200
  const H = 675
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  background(ctx, W, H)
  const byId = new Map(opts.players.map((p) => [p.id, p]))
  ctx.fillStyle = INK
  ctx.font = '56px "Bagel Fat One", system-ui'
  ctx.fillText('Friendship Intelligence Report', 50, 140)
  ctx.font = '26px "VT323", monospace'
  const g = opts.final.group
  const acc = g.accuracy.total ? Math.round((g.accuracy.correct / g.accuracy.total) * 100) : 0
  ctx.fillText(`ROOM ${opts.code} · ${g.rounds} ROUNDS · ${g.answers} ANSWERS · GROUP ACCURACY ${acc}% (${g.accuracy.correct}/${g.accuracy.total})`, 52, 180)
  // leaderboard
  const rows = opts.final.leaderboard.slice(0, 8)
  rows.forEach((l, i) => {
    const p = byId.get(l.playerId)
    const y = 210 + i * 46
    ctx.fillStyle = i === 0 ? YELLOW : i % 2 ? BLUE : PINK
    ctx.fillRect(50, y, 560, 40)
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    ctx.strokeRect(50, y, 560, 40)
    ctx.fillStyle = INK
    ctx.font = '30px "VT323", monospace'
    ctx.fillText(`#${l.rank}`, 62, y + 29)
    if (p) avatar(ctx, 116, y + 4, 32, p.avatar, p.color)
    ctx.font = '600 24px "DM Sans Variable", system-ui'
    ctx.fillText((p?.name ?? '?').slice(0, 16), 160, y + 29)
    ctx.textAlign = 'right'
    ctx.font = '30px "VT323", monospace'
    ctx.fillText(`${l.score}`, 596, y + 29)
    ctx.textAlign = 'left'
  })
  // awards
  box(ctx, 650, 210, 500, 370, LAV, 8)
  ctx.fillStyle = INK
  ctx.font = '26px "VT323", monospace'
  ctx.fillText('AWARDS', 674, 246)
  opts.final.awards.slice(0, 7).forEach((a, i) => {
    const y = 290 + i * 42
    ctx.font = '600 22px "DM Sans Variable", system-ui'
    ctx.fillText(a.title, 674, y)
    ctx.font = '22px "VT323", monospace'
    ctx.textAlign = 'right'
    ctx.fillText(a.winners.map((w) => byId.get(w)?.name ?? '?').join(' & ').slice(0, 22), 1130, y)
    ctx.textAlign = 'left'
  })
  ctx.font = 'italic 500 24px "DM Sans Variable", system-ui'
  ctx.fillStyle = INK
  wrap(ctx, `verdict · ${g.verdict}`, 52, 590, 1100, 28, 1)
  stamp(ctx, 'CLASSIFIED', 1030, 120, 0.15)
  footer(ctx, W, H)
  return new Promise((r) => c.toBlob((b) => r(b!), 'image/png'))
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
