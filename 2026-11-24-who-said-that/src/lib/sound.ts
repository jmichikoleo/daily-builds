// Original sound effects synthesised with WebAudio. No files, no autoplay before a user gesture.
import { getPrefs } from './prefs.ts'

let ctx: AudioContext | null = null
let unlocked = false

export function unlockAudio() {
  if (unlocked) return
  try {
    ctx = ctx ?? new AudioContext()
    void ctx.resume()
    unlocked = true
  } catch {
    /* no audio */
  }
}
if (typeof window !== 'undefined') {
  const once = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', once)
    window.removeEventListener('keydown', once)
  }
  window.addEventListener('pointerdown', once)
  window.addEventListener('keydown', once)
}

type Wave = OscillatorType

function tone(freq: number, start: number, dur: number, type: Wave = 'square', vol = 0.18, slideTo?: number) {
  if (!ctx) return
  const p = getPrefs()
  const master = p.muted ? 0 : p.volume
  if (master <= 0) return
  const t = ctx.currentTime + start
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol * master, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(ctx.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(start: number, dur: number, vol = 0.12, from = 800, to = 3000) {
  if (!ctx) return
  const p = getPrefs()
  const master = p.muted ? 0 : p.volume
  if (master <= 0) return
  const t = ctx.currentTime + start
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol * master, t)
  src.connect(f).connect(g).connect(ctx.destination)
  src.start(t)
}

export type Sfx = 'join' | 'card' | 'submit' | 'tick' | 'lock' | 'suspense' | 'correct' | 'wrong' | 'fanfare' | 'stamp' | 'paper' | 'pop'

export function sfx(name: Sfx) {
  if (!ctx || !unlocked) return
  switch (name) {
    case 'join':
      tone(660, 0, 0.09)
      tone(990, 0.08, 0.14)
      break
    case 'card':
      noise(0, 0.22, 0.1, 600, 4000)
      tone(520, 0.05, 0.12, 'triangle', 0.12, 780)
      break
    case 'submit':
      tone(440, 0, 0.07, 'square', 0.14)
      tone(880, 0.06, 0.16, 'triangle', 0.16)
      noise(0.04, 0.12, 0.08, 2000, 6000)
      break
    case 'tick':
      tone(1500, 0, 0.03, 'square', 0.06)
      break
    case 'lock':
      tone(180, 0, 0.12, 'square', 0.2, 90)
      noise(0, 0.08, 0.1, 300, 900)
      break
    case 'suspense':
      tone(110, 0, 1.6, 'sawtooth', 0.07, 220)
      tone(116, 0, 1.6, 'sawtooth', 0.05, 233)
      break
    case 'stamp':
      noise(0, 0.18, 0.25, 200, 120)
      tone(90, 0, 0.18, 'square', 0.22, 50)
      break
    case 'correct':
      ;[523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.18, 'square', 0.13))
      break
    case 'wrong':
      tone(392, 0, 0.18, 'sawtooth', 0.12, 330)
      tone(330, 0.16, 0.32, 'sawtooth', 0.12, 220)
      break
    case 'fanfare':
      ;[392, 523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.22, 'square', 0.12))
      noise(0.75, 0.4, 0.08, 3000, 8000)
      break
    case 'paper':
      noise(0, 0.25, 0.09, 1500, 5000)
      break
    case 'pop':
      tone(700, 0, 0.06, 'triangle', 0.14, 1200)
      break
  }
}
