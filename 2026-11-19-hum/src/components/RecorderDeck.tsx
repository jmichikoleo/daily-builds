// src/components/RecorderDeck.tsx
// the cassette recorder. record, stop, timer, live waveform, mic status,
// playing back the original, record again and uploading a voice memo.
import { useEffect, useRef, useState } from "react";
import { Circle, Mic, MicOff, Pause, Play, RotateCcw, Square, Upload } from "lucide-react";
import { HumRecorder, micErrorMessage, micPermission, type MicError } from "../audio/recorder";
import { player } from "../audio/player";
import { PeaksWave, Reel, fmtTime } from "./ui";

const MAX_SECONDS = 90;

interface Props {
  side: "A" | "B";
  label: string;
  recording: Blob | null;
  peaks: number[];
  durationSec: number;
  busy: boolean; // parent is transcribing
  onCaptured: (blob: Blob) => void;
  compact?: boolean;
}

export default function RecorderDeck({ side, label, recording, peaks, durationSec, busy, onCaptured, compact }: Props) {
  const [state, setState] = useState<"idle" | "recording">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<MicError | null>(null);
  const [perm, setPerm] = useState<string>("unknown");
  const [playing, setPlaying] = useState(false);
  const recRef = useRef<HumRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { micPermission().then(setPerm); }, [state]);

  // object URL for the stored original recording
  useEffect(() => {
    const old = audioRef.current;
    if (old) { old.onpause = null; old.onended = null; old.pause(); old.removeAttribute("src"); old.load(); }
    setPlaying(false);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = recording ? URL.createObjectURL(recording) : null;
    if (urlRef.current) {
      const a = new Audio();
      a.preload = "none";
      a.src = urlRef.current;
      a.onended = () => setPlaying(false);
      a.onpause = () => setPlaying(false);
      audioRef.current = a;
    } else audioRef.current = null;
    return () => { audioRef.current?.pause(); };
  }, [recording]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); recRef.current?.cancel(); }, []);

  // instrument playback and voice playback never overlap
  useEffect(() => player.subscribe(() => { if (player.playing) audioRef.current?.pause(); }), []);

  // live waveform + timer while recording
  useEffect(() => {
    if (state !== "recording") return;
    const started = performance.now();
    let raf = 0;
    const data = new Uint8Array(2048);
    const draw = () => {
      const secs = (performance.now() - started) / 1000;
      setElapsed(secs);
      if (secs >= MAX_SECONDS) { stop(); return; }
      const c = canvasRef.current;
      const an = recRef.current?.analyser;
      if (c && an) {
        const g = c.getContext("2d")!;
        const w = (c.width = c.clientWidth * devicePixelRatio);
        const h = (c.height = c.clientHeight * devicePixelRatio);
        an.getByteTimeDomainData(data);
        g.clearRect(0, 0, w, h);
        g.lineWidth = 3 * devicePixelRatio;
        g.strokeStyle = "#B9729B";
        g.lineJoin = "round";
        g.beginPath();
        for (let i = 0; i < data.length; i += 8) {
          const x = (i / data.length) * w;
          const y = h / 2 + ((data[i] - 128) / 128) * h * 0.9;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const start = async () => {
    setError(null);
    player.stop();
    audioRef.current?.pause();
    const r = new HumRecorder();
    try {
      await r.start();
      recRef.current = r;
      setElapsed(0);
      setState("recording");
    } catch (e) {
      setError(typeof e === "string" ? (e as MicError) : "unknown");
    }
  };

  async function stop() {
    const r = recRef.current;
    recRef.current = null;
    setState("idle");
    if (!r) return;
    const blob = await r.stop();
    if (blob.size < 500) { setError("unknown"); return; }
    onCaptured(blob);
  }

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); return; }
    player.stop();
    a.currentTime = 0;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const recordingNow = state === "recording";
  const status = recordingNow ? "catching your little melody..." : busy ? "finding the notes..." : recording ? "you made that!" : "every song starts somewhere.";

  return (
    <div className={`panel relative overflow-hidden ${compact ? "p-4" : "p-5 sm:p-6"}`} style={{ background: "linear-gradient(160deg,#fff 0%,#fdf1f5 100%)" }}>
      {/* cassette body */}
      <div className="rounded-[1.4rem] border border-line bg-blush/70 p-3 sm:p-4">
        <div className="flex items-center justify-between rounded-xl bg-pearl px-3 py-1.5">
          <span className="truncate font-hand text-xl leading-none sm:text-2xl">{label}</span>
          <span className="ml-2 shrink-0 rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-extrabold tracking-widest text-white">SIDE {side}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Reel spin={recordingNow || playing || busy} size={compact ? 44 : 64} />
          <div className="relative h-14 flex-1 overflow-hidden rounded-xl border border-line bg-white sm:h-16">
            {recordingNow ? (
              <canvas ref={canvasRef} className="h-full w-full" aria-label="live microphone waveform" />
            ) : (
              <PeaksWave peaks={peaks} className="h-full w-full px-2" color={recording ? "#DFA8C8" : "#EBD6E0"} />
            )}
          </div>
          <Reel spin={recordingNow || playing || busy} size={compact ? 44 : 64} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {recordingNow ? (
          <button className="key h-14 px-5 text-base" onClick={stop} data-down="true" aria-label="stop recording">
            <Square size={18} fill="currentColor" /> stop
          </button>
        ) : (
          <button className="key h-14 px-5 text-base disabled:opacity-50" onClick={start} disabled={busy} aria-label={recording ? "record again" : "record"}>
            {recording ? <RotateCcw size={18} /> : <Circle size={18} fill="#e0628f" color="#e0628f" />}
            {recording ? "record again" : "record"}
          </button>
        )}
        <button className="key h-14 w-14" onClick={togglePlay} disabled={!recording || recordingNow} aria-label={playing ? "pause my voice" : "play my voice"} title="play the original recording">
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="font-mono text-2xl tabular-nums" aria-live="off">
          {recordingNow ? (
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#e0628f]" />{fmtTime(elapsed)}</span>
          ) : (
            <span className="text-ink-soft">{fmtTime(durationSec)}</span>
          )}
        </div>
        <button className="chip ml-auto" onClick={() => fileRef.current?.click()} disabled={recordingNow || busy} title="use a voice memo instead of the mic">
          <Upload size={13} /> upload
        </button>
        <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onCaptured(f); e.target.value = ""; }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-hand text-xl text-rose-deep" aria-live="polite">{status}</p>
        <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
          {perm === "denied" ? <MicOff size={12} /> : <Mic size={12} />}
          {perm === "granted" ? "mic ready" : perm === "denied" ? "mic blocked" : perm === "prompt" ? "mic will ask first" : "mic"}
        </span>
      </div>
      {error && <p className="mt-2 rounded-xl bg-butter px-3 py-2 text-sm" role="alert">{micErrorMessage[error]}</p>}
      {recordingNow && <p className="mt-1 text-xs text-ink-soft">a steady "doo" or "mmm" works best. it stops on its own after {MAX_SECONDS}s</p>}
    </div>
  );
}
