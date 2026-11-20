// Records the mic as raw PCM and hands back a 16 kHz mono WAV.
// Doing the encoding here means Chrome, Edge, Safari and Firefox all send the
// same format, so the bridge never needs ffmpeg or MediaRecorder codecs.

export class RecorderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface Recording {
  wav: Blob;
  durationSec: number;
  peak: number;
}

const TARGET_RATE = 16000;
const MAX_SECONDS = 120;

export function micErrorMessage(err: unknown): RecorderError {
  if (err instanceof RecorderError) return err;
  const name = (err as DOMException)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new RecorderError('mic_denied', 'mic access is blocked. allow the microphone for this site in your browser settings and try again');
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new RecorderError('mic_missing', 'no microphone found on this computer');
    case 'NotReadableError':
    case 'AbortError':
      return new RecorderError('mic_busy', 'the mic is busy. close other apps using it and try again');
    default:
      return new RecorderError('mic_failed', `could not start recording (${(err as Error)?.message ?? name ?? 'unknown error'})`);
  }
}

export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Box-filter downsample; good enough for speech going into Whisper. */
export function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export class Recorder {
  private stream?: MediaStream;
  private ctx?: AudioContext;
  private node?: AudioWorkletNode | ScriptProcessorNode;
  private analyser?: AnalyserNode;
  private chunks: Float32Array[] = [];
  private raf = 0;
  private limitTimer = 0;
  private peak = 0;
  onLevel: (level: number) => void = () => {};
  onLimit: () => void = () => {};

  static supported(): string | null {
    if (!window.isSecureContext) return 'the mic needs https. open jarvis through its tailscale https address';
    if (!navigator.mediaDevices?.getUserMedia) return "this browser can't use the mic here. type your prompt instead";
    if (!window.AudioContext && !(window as any).webkitAudioContext) return "this browser can't record audio. type your prompt instead";
    return null;
  }

  get recording() {
    return !!this.stream;
  }

  async start(): Promise<void> {
    const unsupported = Recorder.supported();
    if (unsupported) throw new RecorderError('unsupported', unsupported);
    this.chunks = [];
    this.peak = 0;
    try {
      // The mic is only requested here, after the user clicks the ring.
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      throw micErrorMessage(err);
    }
    try {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      this.ctx = new Ctx();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);

      const push = (data: Float32Array) => {
        this.chunks.push(data);
        for (let i = 0; i < data.length; i += 8) this.peak = Math.max(this.peak, Math.abs(data[i]));
      };
      if (this.ctx.audioWorklet) {
        await this.ctx.audioWorklet.addModule('/rec-worklet.js');
        const node = new AudioWorkletNode(this.ctx, 'jarvis-recorder');
        node.port.onmessage = (e) => push(e.data as Float32Array);
        src.connect(node);
        this.node = node;
      } else {
        const node = this.ctx.createScriptProcessor(4096, 1, 1);
        node.onaudioprocess = (e) => push(new Float32Array(e.inputBuffer.getChannelData(0)));
        src.connect(node);
        node.connect(this.ctx.destination);
        this.node = node;
      }
    } catch (err) {
      this.release();
      throw new RecorderError('unsupported', `recording isn't supported in this browser (${(err as Error).message})`);
    }

    const buf = new Float32Array(this.analyser.fftSize);
    let smooth = 0;
    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const level = Math.min(1, Math.pow(rms * 5, 0.8));
      smooth = level > smooth ? level : smooth * 0.85 + level * 0.15;
      this.onLevel(smooth);
      this.raf = requestAnimationFrame(tick);
    };
    tick();
    this.limitTimer = window.setTimeout(() => this.onLimit(), MAX_SECONDS * 1000);
  }

  async stop(): Promise<Recording> {
    const rate = this.ctx?.sampleRate ?? 48000;
    // Give the worklet one more batch.
    await new Promise((r) => setTimeout(r, 120));
    const chunks = this.chunks;
    const peak = this.peak;
    this.release();
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const all = new Float32Array(total);
    let off = 0;
    for (const c of chunks) {
      all.set(c, off);
      off += c.length;
    }
    const pcm = downsample(all, rate, TARGET_RATE);
    const durationSec = pcm.length / TARGET_RATE;
    if (durationSec < 0.35) throw new RecorderError('empty_recording', 'that was too short. click the ring, speak, then click again');
    if (peak < 0.008) throw new RecorderError('empty_recording', "i didn't hear anything. check the mic level and try again");
    return { wav: encodeWav(pcm, TARGET_RATE), durationSec, peak };
  }

  cancel() {
    this.release();
  }

  private release() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.limitTimer);
    this.onLevel(0);
    try {
      this.node?.disconnect();
    } catch {}
    this.stream?.getTracks().forEach((t) => t.stop()); // mic light goes off here
    this.ctx?.close().catch(() => {});
    this.stream = undefined;
    this.ctx = undefined;
    this.node = undefined;
    this.analyser = undefined;
    this.chunks = [];
  }
}
