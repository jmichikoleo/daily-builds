// src/audio/player.ts
// one shared playback engine (prevents overlapping playback),
// instrument previews, and offline WAV rendering. Live and offline use the same graph code.
import * as Tone from "tone";
import { createVoice, loadSamples, getInstrument, type Voice } from "./instruments";
import { buildBassPart, buildChordPart, buildDrumPart, chordsFor, PROGRESSIONS } from "../lib/theory";
import type { Song, TrackMix } from "../lib/types";

type TrackName = "lead" | "layer" | "chords" | "bass" | "drums";
interface TrackEvent { time: number; midi: number; duration: number; velocity: number } // beats
export interface Track { name: TrackName; instrument: string; events: TrackEvent[]; mix: TrackMix }

export const songEndBeat = (song: Song) => {
  let end = 0;
  for (const n of song.notes) end = Math.max(end, n.start + n.duration);
  if (song.layer) for (const n of song.layer.notes) end = Math.max(end, n.start + n.duration + song.layer.offset);
  return end;
};
export const songBars = (song: Song) => Math.max(1, Math.ceil(songEndBeat(song) / 4));

/** Turn a song into concrete note events per track (beats). */
export function buildTracks(song: Song): Track[] {
  const a = song.arrangement;
  const tracks: Track[] = [{ name: "lead", instrument: song.leadInstrument, events: song.notes.map((n) => ({ time: n.start, midi: n.midi, duration: n.duration, velocity: n.velocity })), mix: a.tracks.lead }];
  if (song.layer && song.layer.notes.length) {
    const off = song.layer.offset;
    tracks.push({ name: "layer", instrument: song.layer.instrument, mix: a.tracks.layer,
      events: song.layer.notes.map((n) => ({ time: n.start + off, midi: n.midi, duration: n.duration, velocity: n.velocity })).filter((e) => e.time >= 0) });
  }
  if (a.enabled && song.notes.length) {
    const bars = songBars(song);
    const prog = PROGRESSIONS.find((p) => p.id === a.progressionId) ?? PROGRESSIONS[0];
    const chords = chordsFor(prog, a.key);
    tracks.push({ name: "chords", instrument: a.chordInstrument, events: buildChordPart(chords, a.chordStyle, bars), mix: a.tracks.chords });
    tracks.push({ name: "bass", instrument: a.bassInstrument, events: buildBassPart(chords, a.bassStyle, bars), mix: a.tracks.bass });
    tracks.push({ name: "drums", instrument: "drums", mix: a.tracks.drums,
      events: buildDrumPart(a.drumPattern, bars).map((h) => ({ time: h.time, midi: h.midi, duration: 0.1, velocity: h.velocity })) });
  }
  const anySolo = tracks.some((t) => t.mix.solo);
  return tracks.filter((t) => !t.mix.muted && (!anySolo || t.mix.solo));
}

export const playEndBeat = (song: Song) => (song.arrangement.enabled && song.notes.length ? songBars(song) * 4 : songEndBeat(song));

interface Session { voices: Voice[]; nodes: Tone.ToneAudioNode[]; trackGains: Map<TrackName, Tone.Gain> }

/** Build the audio graph in the current Tone context and schedule every event on `transport`. */
async function buildSession(song: Song, tracks: Track[], transport: ReturnType<typeof Tone.getTransport>, voiceBuffer: AudioBuffer | null): Promise<Session> {
  const limiter = new Tone.Limiter(-1).toDestination();
  const master = new Tone.Gain(0.85).connect(limiter);
  const reverb = new Tone.Freeverb({ roomSize: 0.86, dampening: 2800, wet: 1 }).connect(master);
  const send = new Tone.Gain(song.arrangement.reverb * 0.5).connect(reverb);
  const nodes: Tone.ToneAudioNode[] = [limiter, master, reverb, send];
  const voices: Voice[] = [];
  const trackGains = new Map<TrackName, Tone.Gain>();
  const secPerBeat = 60 / song.bpm;
  const ticks = (beats: number) => `${Math.max(0, Math.round(beats * transport.PPQ))}i`;

  transport.bpm.value = song.bpm;
  for (const t of tracks) {
    const voice = await createVoice(t.instrument);
    const gain = new Tone.Gain(t.mix.volume ** 1.5);
    voice.output.connect(gain);
    gain.connect(master);
    gain.connect(send);
    voices.push(voice);
    nodes.push(gain);
    trackGains.set(t.name, gain);
    for (const e of t.events) {
      transport.schedule((time) => voice.play(e.midi, Math.max(0.05, e.duration * secPerBeat), time, e.velocity), ticks(e.time));
    }
  }
  if (voiceBuffer) {
    const player = new Tone.Player(voiceBuffer);
    player.volume.value = -2;
    player.connect(master);
    player.sync().start(0);
    nodes.push(player);
  }
  return { voices, nodes, trackGains };
}

class Player {
  private session: Session | null = null;
  private token = 0;
  private endCb: (() => void) | null = null;
  playing = false;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((l) => l()); }

  /** Current playhead in beats. */
  position(): number {
    const tr = Tone.getTransport();
    return this.playing ? tr.ticks / tr.PPQ : 0;
  }

  async play(song: Song, opts: { from?: number; loop?: boolean; voice?: AudioBuffer | null; tracks?: TrackName[]; onEnd?: () => void } = {}) {
    const token = ++this.token;
    this.stop(false);
    await Tone.start();
    let tracks = buildTracks(song);
    if (opts.tracks) tracks = tracks.filter((t) => opts.tracks!.includes(t.name));
    const transport = Tone.getTransport();
    const end = playEndBeat(song);
    const session = await buildSession(song, tracks, transport, opts.voice ?? null);
    if (token !== this.token) { disposeSession(session); return; } // a newer play() won
    this.session = session;
    this.endCb = opts.onEnd ?? null;
    const endTicks = Math.round(end * transport.PPQ) + transport.PPQ / 2;
    if (opts.loop) {
      transport.loop = true;
      transport.loopStart = 0;
      transport.loopEnd = `${Math.round(Math.max(1, Math.ceil(end)) * transport.PPQ)}i`;
    } else {
      transport.loop = false;
      // (a plain timer, not Tone.Draw: Draw relies on animation frames, which background tabs throttle)
      transport.scheduleOnce((time) => {
        const ms = Math.max(0, (time - Tone.now()) * 1000);
        window.setTimeout(() => { if (token === this.token) this.stop(true); }, ms);
      }, `${endTicks + transport.PPQ}i`); // a beat of tail for releases
    }
    const from = Math.max(0, Math.min(opts.from ?? 0, end));
    transport.start("+0.08", `${Math.round(from * transport.PPQ)}i`);
    this.playing = true;
    this.emit();
  }

  /** Live mixer changes (volume) without restarting. */
  setTrackVolume(name: TrackName, volume: number) {
    this.session?.trackGains.get(name)?.gain.rampTo(volume ** 1.5, 0.05);
  }

  stop(fireEnd = false) {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    transport.loop = false;
    if (this.session) {
      const s = this.session;
      s.voices.forEach((v) => v.releaseAll());
      setTimeout(() => disposeSession(s), 300);
      this.session = null;
    }
    const wasPlaying = this.playing;
    this.playing = false;
    if (wasPlaying) this.emit();
    if (fireEnd && this.endCb) { const cb = this.endCb; this.endCb = null; cb(); }
  }
}

function disposeSession(s: Session) {
  s.voices.forEach((v) => { try { v.dispose(); } catch { /* already gone */ } });
  s.nodes.forEach((n) => { try { n.dispose(); } catch { /* already gone */ } });
}

export const player = new Player();

// ---------------------------------------------------------------------------
// Previews: one cached voice per instrument, straight to the speakers.

const previewVoices = new Map<string, Promise<Voice>>();
let lastPreview: Voice | null = null;
function previewVoice(id: string) {
  let v = previewVoices.get(id);
  if (!v) {
    v = createVoice(id).then((voice) => { voice.output.toDestination(); return voice; });
    previewVoices.set(id, v);
    // if samples failed we got a stand-in; forget it so a later preview retries
    v.then((voice) => { if ((voice as Voice & { standIn?: boolean }).standIn) previewVoices.delete(id); });
  }
  return v;
}

export async function previewNote(id: string, midi: number, seconds = 0.6) {
  await Tone.start();
  const v = await previewVoice(id);
  v.play(midi, seconds, Tone.now() + 0.02, 0.8);
}

const PHRASES: Record<string, number[]> = {
  melody: [60, 64, 67, 72, 67],
  bass: [36, 43, 48, 43],
};

/** Play a short phrase so people can hear the instrument's character. */
export async function previewInstrument(id: string) {
  await Tone.start();
  const def = getInstrument(id);
  const v = await previewVoice(id);
  lastPreview?.releaseAll();
  lastPreview = v;
  const t0 = Tone.now() + 0.05;
  if (def.drumsOnly) {
    buildDrumPart("softPop", 1).forEach((h) => v.play(h.midi, 0.1, t0 + h.time * 0.33, h.velocity));
    return;
  }
  const phrase = def.category === "bass" ? PHRASES.bass : PHRASES.melody;
  phrase.forEach((m, i) => v.play(m, i === phrase.length - 1 ? 1.2 : 0.3, t0 + i * 0.28, 0.75));
}

// ---------------------------------------------------------------------------
// Offline render → AudioBuffer (for WAV export).

export async function renderSong(song: Song): Promise<AudioBuffer> {
  const tracks = buildTracks(song);
  await Promise.all(tracks.map((t) => loadSamples(t.instrument)));
  const seconds = (playEndBeat(song) * 60) / song.bpm + 2.5;
  const buffer = await Tone.Offline(async (ctx) => {
    await buildSession(song, tracks, ctx.transport, null);
    ctx.transport.start(0);
  }, seconds, 2, 44100);
  return buffer.get() as AudioBuffer;
}

// dev-only handle for debugging in the browser console
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__hum = { player, Tone };
