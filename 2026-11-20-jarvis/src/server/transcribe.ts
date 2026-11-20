import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { JarvisConfig } from './config.ts';

export class TranscribeError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSec: number;
}

/** Parse just enough of a PCM WAV header to reject junk and empty recordings. */
export function inspectWav(buf: Buffer): WavInfo {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE')
    throw new TranscribeError(415, 'unsupported_audio', 'audio has to be a pcm wav recording');
  let off = 12;
  let fmt: { channels: number; sampleRate: number; bits: number; format: number } | undefined;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(off + 8), channels: buf.readUInt16LE(off + 10), sampleRate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') {
      dataLen = Math.min(size, buf.length - off - 8);
      break;
    }
    off += 8 + size + (size % 2);
  }
  if (!fmt || fmt.format !== 1) throw new TranscribeError(415, 'unsupported_audio', 'audio has to be 16-bit pcm wav');
  const bytesPerSec = fmt.sampleRate * fmt.channels * (fmt.bits / 8);
  const durationSec = bytesPerSec ? dataLen / bytesPerSec : 0;
  if (durationSec < 0.25) throw new TranscribeError(422, 'empty_recording', 'that recording was empty. talk a little longer before clicking again');
  // Whisper invents words ("you", "thank you") for silence, so refuse near-silent audio up front.
  if (fmt.bits === 16) {
    const start = off + 8;
    let peak = 0;
    for (let i = start; i + 1 < start + dataLen; i += 2) peak = Math.max(peak, Math.abs(buf.readInt16LE(i)));
    if (peak < 300) throw new TranscribeError(422, 'empty_recording', "that recording was silent. check the mic and try again");
  }
  return { sampleRate: fmt.sampleRate, channels: fmt.channels, bitsPerSample: fmt.bits, durationSec };
}

export interface Transcriber {
  available: boolean;
  describe: string;
  transcribe(wav: Buffer): Promise<string>;
}

function clean(text: string): string {
  return text
    .replace(/\[(BLANK_AUDIO|MUSIC|NOISE|SILENCE|inaudible)\]/gi, ' ')
    .replace(/\((?:silence|music|noise)\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createTranscriber(cfg: JarvisConfig['transcription']): Transcriber {
  if (cfg.backend === 'none')
    return {
      available: false,
      describe: 'not configured',
      async transcribe() {
        throw new TranscribeError(503, 'transcription_unavailable', 'voice is not set up on the bridge yet. type your prompt instead, the readme shows how to turn on whisper.cpp');
      },
    };

  if (cfg.backend === 'mock')
    return {
      available: true,
      describe: 'mock',
      async transcribe(wav) {
        const info = inspectWav(wav);
        await new Promise((r) => setTimeout(r, 400));
        return `Jarvis, fix the code. (mock transcript of ${info.durationSec.toFixed(1)}s of audio)`;
      },
    };

  const ready = fs.existsSync(cfg.command) && fs.existsSync(cfg.model);
  return {
    available: ready,
    describe: ready ? `whisper.cpp (${path.basename(cfg.model)})` : 'whisper.cpp missing',
    async transcribe(wav) {
      if (!fs.existsSync(cfg.command)) throw new TranscribeError(503, 'transcription_unavailable', `whisper.cpp was not found at ${cfg.command}. type your prompt or fix transcription.command`);
      if (!fs.existsSync(cfg.model)) throw new TranscribeError(503, 'transcription_unavailable', `the whisper model was not found at ${cfg.model}`);
      const info = inspectWav(wav);
      if (info.sampleRate !== 16000 || info.channels !== 1 || info.bitsPerSample !== 16)
        throw new TranscribeError(415, 'unsupported_audio', 'expected 16 khz mono 16-bit wav from the console');

      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-'));
      const file = path.join(dir, `${randomUUID()}.wav`);
      try {
        fs.writeFileSync(file, wav, { mode: 0o600 });
        const out = await new Promise<string>((resolve, reject) => {
          execFile(
            cfg.command,
            ['-m', cfg.model, '-f', file, '-l', cfg.language, '-t', String(cfg.threads), '-nt', '-np'],
            { timeout: cfg.timeoutMs, maxBuffer: 4 * 1024 * 1024 },
            (err, stdout, stderr) => {
              if (err) reject(new TranscribeError(502, 'transcription_failed', `whisper.cpp failed (${(stderr || err.message).trim().slice(-300)})`));
              else resolve(stdout);
            },
          );
        });
        const text = clean(out);
        if (!text) throw new TranscribeError(422, 'empty_recording', "i didn't catch any words. try again a little closer to the mic");
        return text;
      } finally {
        // Audio never outlives the request.
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
