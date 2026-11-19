// src/lib/exporters.ts — MIDI (multi-track) and WAV encoders, plus a download helper.
import { Midi } from "@tonejs/midi";
import { buildTracks } from "../audio/player";
import { getInstrument } from "../audio/instruments";
import type { Song } from "./types";

// General MIDI program numbers so the MIDI opens with sensible sounds in a DAW.
const GM_PROGRAM: Record<string, number> = {
  piano: 0, epiano: 4, musicbox: 10, organ: 16, aguitar: 24, eguitar: 27, violin: 40, cello: 42, harp: 46,
  synthlead: 81, pad: 89, pluck: 84, bells: 98, ebass: 33, synthbass: 38,
};

export function songToMidi(song: Song): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(song.bpm);
  midi.header.name = song.title;
  const spb = 60 / song.bpm;
  let channel = 0;
  for (const t of buildTracks(song)) {
    const track = midi.addTrack();
    track.name = `${t.name} - ${getInstrument(t.instrument).name}`; // MIDI text is latin-1: keep it ASCII
    if (t.name === "drums") track.channel = 9;
    else {
      track.channel = channel++; // one channel per melodic track so programs don't clash
      track.instrument.number = GM_PROGRAM[t.instrument] ?? 0;
    }
    for (const e of t.events) {
      track.addNote({ midi: e.midi, time: e.time * spb, duration: Math.max(0.05, e.duration * spb), velocity: e.velocity * t.mix.volume });
    }
  }
  return midi.toArray();
}

export function audioBufferToWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const len = buf.length * ch * 2;
  const view = new DataView(new ArrayBuffer(44 + len));
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); view.setUint32(4, 36 + len, true); str(8, "WAVE");
  str(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true);
  view.setUint32(24, buf.sampleRate, true); view.setUint32(28, buf.sampleRate * ch * 2, true);
  view.setUint16(32, ch * 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, len, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < buf.length; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const safeName = (title: string) => title.trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").toLowerCase() || "hum";
