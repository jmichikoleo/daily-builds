// src/audio/recorder.ts
// microphone recording (MediaRecorder) with a live analyser for the waveform.

export type MicError = "denied" | "no-device" | "insecure" | "unsupported" | "busy" | "unknown";

export const micErrorMessage: Record<MicError, string> = {
  denied: "your browser blocked the mic. allow it in the site settings and try again",
  "no-device": "couldn't find a mic. plug one in or just upload a voice memo instead",
  insecure: "the mic only works on https or localhost",
  unsupported: "this browser can't record audio. try a recent chrome, firefox or safari, or just upload a voice memo",
  busy: "another app is using the mic right now",
  unknown: "something went wrong with the mic, try again",
};

export async function micPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

function pickMime(): string | undefined {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
}

export class HumRecorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;

  async start(): Promise<void> {
    if (!window.isSecureContext) throw "insecure" satisfies MicError;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw "unsupported" satisfies MicError;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") throw "denied" satisfies MicError;
      if (name === "NotFoundError" || name === "OverconstrainedError") throw "no-device" satisfies MicError;
      if (name === "NotReadableError") throw "busy" satisfies MicError;
      throw "unknown" satisfies MicError;
    }
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    src.connect(this.analyser);
    this.chunks = [];
    const mimeType = pickMime();
    this.rec = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start(250);
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const rec = this.rec;
      if (!rec) return reject(new Error("not recording"));
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
        this.cleanup();
        resolve(blob);
      };
      rec.stop();
    });
  }

  cancel() {
    try { this.rec?.stop(); } catch { /* ignore */ }
    this.cleanup();
  }

  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null;
    this.rec = null;
    this.ctx = null;
    this.analyser = null;
  }
}

/** Mix an AudioBuffer down to mono for analysis. */
export function toMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}

export const extensionFor = (mime: string) =>
  mime.includes("webm") ? "webm" : mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("mpeg") ? "mp3" : "audio";
