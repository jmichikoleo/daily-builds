// src/components/Studio.tsx
// the song page, recorder, melody editor and transport, instrument shelf,
// and tabs for arrangement, an extra hummed layer and lyrics. Also save + export.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Download, FileAudio, FileMusic, Loader2, Minus, Mic2, Play, Plus, Redo2, Repeat, RotateCcw, Square, Trash2, Undo2,
  Wand2, ZoomIn, ZoomOut, Heart, ChevronDown, Palette, Archive,
} from "lucide-react";
import { useSong } from "../state/useSong";
import { player, previewNote, renderSong } from "../audio/player";
import { decodeArrayBuffer, getInstrument } from "../audio/instruments";
import { extensionFor, toMono } from "../audio/recorder";
import { quantize, transcribe } from "../audio/transcribe";
import { cleanupBlobs, getBlob, getSongBlobs, newRecordingKey, putBlob, withCover } from "../lib/db";
import { buildBackup, readBackup } from "../lib/backup";
import CoverEditor, { CoverThumb } from "./CoverEditor";
import { regridNotes } from "../lib/tempo";
import { deleteVersion, duplicateVersion, renameVersion, saveAsNewVersion, switchVersion } from "../lib/versions";
import { SECTION_TYPES, addMarker, deleteMarker, moveMarker, pruneLyricLinks, updateMarker } from "../lib/markers";
import { audioBufferToWav, download, safeName, songToMidi } from "../lib/exporters";
import { PROGRESSIONS, detectKey, keyName, scoreProgression } from "../lib/theory";
import type { Arrangement, Note, SectionType, Song } from "../lib/types";
import TempoControl from "./TempoControl";
import VersionBar from "./VersionBar";
import MarkerEditor from "./MarkerEditor";
import RecorderDeck from "./RecorderDeck";
import PianoRoll from "./PianoRoll";
import InstrumentPicker from "./InstrumentPicker";
import ArrangePanel from "./ArrangePanel";
import LayerPanel from "./LayerPanel";
import LyricsPanel from "./LyricsPanel";
import EffectsPanel from "./EffectsPanel";
import DrumSequencer from "./DrumSequencer";
import { SectionTitle, Toaster, computePeaks, toast } from "./ui";

type Tab = "arrange" | "drums" | "effects" | "layer" | "lyrics";

/** After a new transcription: detect the key and pre-pick the chord progression that fits best. */
function withBestChords(a: Arrangement, notes: Note[]): Arrangement {
  const key = detectKey(notes);
  const best = [...PROGRESSIONS].sort((x, y) => scoreProgression(y, key, notes) - scoreProgression(x, key, notes))[0];
  return { ...a, key, progressionId: best.id };
}

const useNarrow = () => {
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
};

export default function Studio({ songId }: { songId: string }) {
  const { song, update, undo, redo, resetHistory, saveState, saveNow, canUndo, canRedo, get } = useSong(songId);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [highlightLyric, setHighlightLyric] = useState<string | null>(null);
  const [leadBlob, setLeadBlob] = useState<Blob | null>(null);
  const [layerBlob, setLayerBlob] = useState<Blob | null>(null);
  const [voiceBuffer, setVoiceBuffer] = useState<AudioBuffer | null>(null);
  const [layerInfo, setLayerInfo] = useState<{ peaks: number[]; duration: number; warning: string | null }>({ peaks: [], duration: 0, warning: null });
  const [busy, setBusy] = useState<"lead" | "layer" | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const [withVoice, setWithVoice] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(56);
  const [snap, setSnap] = useState(0.25);
  const [tab, setTab] = useState<Tab>("arrange");
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const narrow = useNarrow();

  // load the recordings this version points to (versions can point to different ones)
  const leadKey = song ? song.leadRecordingKey : undefined;
  const layerKey = song ? song.layer?.recordingKey ?? null : undefined;
  useEffect(() => {
    if (leadKey === undefined) return;
    let alive = true;
    setLeadBlob(null);
    setVoiceBuffer(null);
    getBlob(leadKey).then(async (blob) => {
      if (!alive || !blob) return;
      setLeadBlob(blob);
      decodeArrayBuffer(await blob.arrayBuffer()).then((b) => alive && setVoiceBuffer(b)).catch(() => {});
    });
    return () => { alive = false; };
  }, [leadKey]);
  useEffect(() => {
    if (layerKey === undefined) return;
    let alive = true;
    setLayerBlob(null);
    getBlob(layerKey).then(async (blob) => {
      if (!alive) return;
      setLayerBlob(blob);
      if (!blob) { setLayerInfo({ peaks: [], duration: 0, warning: null }); return; }
      decodeArrayBuffer(await blob.arrayBuffer())
        .then((b) => alive && setLayerInfo((x) => ({ peaks: computePeaks(toMono(b)), duration: b.duration, warning: x.warning })))
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [layerKey]);
  useEffect(() => () => player.stop(), [songId]);

  /** Save now, then delete blobs nothing points to any more. Never runs before the save lands. */
  const saveAndTidy = useCallback(async () => {
    await saveNow();
    const s = get();
    if (s) await cleanupBlobs(s).catch(() => {});
  }, [saveNow, get]);

  // playback state + playhead
  useEffect(() => player.subscribe(() => setPlaying(player.playing)), []);
  useEffect(() => {
    if (!playing) { setPlayhead(null); return; }
    let raf = 0;
    const tick = () => { setPlayhead(player.position()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const voiceInSync = !!song && song.bpm === song.transcribedBpm;
  const playOpts = useRef({ loop, withVoice, voiceBuffer, voiceInSync });
  playOpts.current = { loop, withVoice, voiceBuffer, voiceInSync };

  const startPlayback = useCallback((from = 0) => {
    const s = get();
    if (!s) return;
    const o = playOpts.current;
    player.play(s, { from, loop: o.loop, voice: o.withVoice && o.voiceInSync ? o.voiceBuffer : null, onEnd: () => setPlayhead(null) });
  }, [get]);

  // edits while playing restart playback from the current spot, so you hear changes immediately
  const restartTimer = useRef<number | undefined>(undefined);
  const refreshPlayback = useCallback(() => {
    if (!player.playing) return;
    window.clearTimeout(restartTimer.current);
    restartTimer.current = window.setTimeout(() => { if (player.playing) startPlayback(player.position()); }, 120);
  }, [startPlayback]);

  const edit = useCallback((fn: (s: Song) => Song, undoable = true) => { update(fn, { undoable }); refreshPlayback(); }, [update, refreshPlayback]);
  const setNotes = useCallback((notes: Note[]) => edit((s) => ({ ...s, notes })), [edit]);

  // recording → notes
  const processCapture = useCallback(async (blob: Blob, part: "lead" | "layer") => {
    player.stop();
    setBusy(part);
    try {
      const buf = await decodeArrayBuffer(await blob.arrayBuffer());
      const mono = toMono(buf);
      const s = get()!;
      const r = transcribe(mono, buf.sampleRate, s.bpm);
      const key = newRecordingKey(s.id, "rec");
      await putBlob(key, blob); // a new key every time, so other versions keep their own recording
      if (part === "lead") {
        setLeadBlob(blob);
        setVoiceBuffer(buf);
        edit((x) => ({
          ...x, notes: r.notes, originalNotes: r.notes, durationSec: r.durationSec, peaks: computePeaks(mono), hasRecording: true, leadRecordingKey: key,
          recordingMime: blob.type || null, transcriptionWarning: r.quality.warning, transcribedBpm: x.bpm,
          arrangement: r.notes.length ? withBestChords(x.arrangement, r.notes) : x.arrangement,
        }));
        toast(r.notes.length ? `found ${r.notes.length} notes ♪` : "no clear notes found");
      } else {
        setLayerBlob(blob);
        setLayerInfo({ peaks: computePeaks(mono), duration: r.durationSec, warning: r.quality.warning });
        edit((x) => ({ ...x, layer: { notes: r.notes, originalNotes: r.notes, instrument: x.layer?.instrument ?? "bells", offset: 0, hasRecording: true, recordingKey: key } }));
        if (r.notes.length) toast(`added a layer with ${r.notes.length} notes`);
      }
      await saveAndTidy();
    } catch (e) {
      console.error(e);
      toast("couldn't read that audio, try another recording");
    } finally {
      setBusy(null);
    }
  }, [edit, get, saveAndTidy]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const s = get();
      if (!s) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); refreshPlayback(); return; }
      if (e.code === "Space" && !t.closest("button")) { e.preventDefault(); if (player.playing) player.stop(); else startPlayback(); return; }
      if (!selected) return;
      const n = s.notes.find((x) => x.id === selected);
      if (!n) return;
      const step = snap || 0.25;
      const move = (p: Partial<Note>) => { e.preventDefault(); setNotes(s.notes.map((x) => (x.id === n.id ? { ...x, ...p } : x))); };
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); setNotes(s.notes.filter((x) => x.id !== n.id)); setSelected(null); }
      else if (e.key === "ArrowUp") { move({ midi: n.midi + 1 }); previewNote(s.leadInstrument, n.midi + 1, 0.3); }
      else if (e.key === "ArrowDown") { move({ midi: n.midi - 1 }); previewNote(s.leadInstrument, n.midi - 1, 0.3); }
      else if (e.key === "ArrowLeft") move({ start: Math.max(0, n.start - step) });
      else if (e.key === "ArrowRight") move({ start: n.start + step });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [get, undo, redo, selected, snap, setNotes, startPlayback, refreshPlayback]);

  if (song === undefined) return <p className="p-10 text-center font-hand text-2xl">rewinding the tape...</p>;
  if (song === null) {
    return (
      <div className="p-10 text-center">
        <p className="font-display text-2xl">this song isn't here anymore.</p>
        <a href="#/" className="chip mt-4">back to my songs</a>
      </div>
    );
  }

  const hasNotes = song.notes.length > 0;
  const name = safeName(song.title);

  const doExport = async (kind: "original" | "midi" | "wav" | "backup") => {
    setExportOpen(false);
    try {
      if (kind === "original" && leadBlob) {
        download(leadBlob, `${name}-original-hum.${extensionFor(leadBlob.type || song.recordingMime || "")}`);
      } else if (kind === "midi") {
        download(new Blob([songToMidi(song) as BlobPart], { type: "audio/midi" }), `${name}.mid`);
      } else if (kind === "backup") {
        setExporting("backup");
        await saveNow();
        const s = get()!;
        const zip = await buildBackup(s, await getSongBlobs(s.id));
        // read it straight back so we only hand over a backup that actually restores
        const check = await readBackup(zip);
        if (check.song.notes.length !== s.notes.length || check.files.length === 0 && s.hasRecording) throw new Error("backup check failed");
        download(zip, `${name}.hum`);
        toast(`backup checked and saved, ${check.files.length} files inside ♡`);
        return;
      } else if (kind === "wav") {
        player.stop();
        setExporting("wav");
        const buf = await renderSong(song);
        download(audioBufferToWav(buf), `${name}.wav`);
      }
      toast("downloaded ♡");
    } catch (e) {
      console.error(e);
      toast("export didn't work, try again");
    } finally {
      setExporting(null);
    }
  };

  const changeArrangement = (a: Arrangement, opts: { live?: boolean } = {}) => {
    update((s) => ({ ...s, arrangement: a }));
    if (!opts.live) refreshPlayback();
  };

  // --- versions ---
  const versionAction = async (fn: (s: Song) => Song, opts: { fresh?: boolean; tidy?: boolean } = {}) => {
    if (opts.fresh) { player.stop(); setSelected(null); setSelectedMarker(null); }
    update(fn);
    if (opts.fresh) resetHistory();
    if (opts.tidy) await saveAndTidy();
  };

  // --- tempo ---
  /** Keep the hum at its real speed and move the beat grid (and drums) to `bpm`. */
  const regrid = (bpm: number) => edit((s) => {
    const k = bpm / s.transcribedBpm;
    const scale = (ns: Note[]) => regridNotes(ns, s.transcribedBpm, bpm);
    return {
      ...s, bpm, transcribedBpm: bpm, notes: scale(s.notes), originalNotes: scale(s.originalNotes),
      layer: s.layer ? { ...s.layer, notes: scale(s.layer.notes), originalNotes: scale(s.layer.originalNotes), offset: Math.round(s.layer.offset * k * 4) / 4 } : null,
      markers: s.markers.map((m) => ({ ...m, beat: Math.round(m.beat * k * 4) / 4 })),
    };
  });

  // --- section markers ---
  const lyricIds = new Set(song.lyrics.map((l) => l.id));
  const markersShown = song.markers.map((m) => (m.lyricId && !lyricIds.has(m.lyricId) ? { ...m, lyricId: null } : m));
  const activeMarker = markersShown.find((m) => m.id === selectedMarker) ?? null;
  const addPart = (type: SectionType) => {
    const sel = song.notes.find((n) => n.id === selected);
    const lastMarker = song.markers.at(-1);
    const beat = playhead ?? sel?.start ?? (lastMarker ? lastMarker.beat + 8 : 0);
    const snapped = snap ? Math.round(beat) : Math.round(beat * 100) / 100;
    const r = addMarker(song.markers, song.lyrics, type, snapped);
    edit((s) => ({ ...s, markers: r.markers, lyrics: r.lyrics }));
    setSelectedMarker(r.marker.id);
    setHighlightLyric(r.marker.lyricId);
  };
  const partNames: Record<string, string> = {};
  markersShown.forEach((m) => { if (m.lyricId) partNames[m.lyricId] = m.label; });

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6">
      {/* top bar */}
      <header className="flex flex-wrap items-center gap-3">
        <a href="#/" className="chip"><ArrowLeft size={14} /> my songs</a>
        <a href="#/" className="font-display text-2xl font-semibold italic">hum<span className="text-rose-deep">.</span></a>
        <button onClick={() => setCoverOpen(true)} className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-line bg-blush" title="edit cover" aria-label="edit cover">
          {song.cover ? <CoverThumb cover={song.cover} title={song.title} className="h-full w-full" /> : <Palette size={16} className="m-auto text-rose-deep" />}
        </button>
        <input
          value={song.title}
          onChange={(e) => update((s) => ({ ...s, title: e.target.value }))}
          onBlur={() => { if (!song.title.trim()) update((s) => ({ ...s, title: "untitled hum" })); }}
          className="order-last min-w-0 flex-1 basis-full rounded-xl bg-transparent px-2 py-1 font-display text-2xl font-semibold tracking-tight hover:bg-white/70 focus:bg-white sm:order-none sm:basis-auto"
          aria-label="song title"
          maxLength={60}
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-ink-soft sm:inline">{saveState === "saving" ? "saving..." : saveState === "error" ? "save failed" : "saved on this device"}</span>
          <button className="key px-3 py-2 text-sm" onClick={async () => { await saveNow(); toast("kept safe ♡"); }} title="keep this little masterpiece">
            <Heart size={14} className="text-rose-deep" fill="#DFA8C8" /> <span className="hidden sm:inline">keep this little masterpiece</span><span className="sm:hidden">save</span>
          </button>
          <div className="relative">
            <button className="key px-3 py-2 text-sm" onClick={() => setExportOpen((o) => !o)} aria-expanded={exportOpen} disabled={!!exporting}>
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} export <ChevronDown size={12} />
            </button>
            {exportOpen && (
              <div className="panel absolute right-0 z-40 mt-2 w-64 p-2 animate-pop">
                <ExportItem icon={<Mic2 size={16} />} title="original recording" sub={leadBlob ? `your untouched hum (.${extensionFor(leadBlob.type || "")})` : "record something first"} disabled={!leadBlob} onClick={() => doExport("original")} />
                <ExportItem icon={<FileMusic size={16} />} title="MIDI" sub="all the tracks, opens in garageband or any DAW" disabled={!hasNotes} onClick={() => doExport("midi")} />
                <ExportItem icon={<FileAudio size={16} />} title="WAV" sub="the whole instrumental as one audio file" disabled={!hasNotes} onClick={() => doExport("wav")} />
                <ExportItem icon={<Archive size={16} />} title="project backup" sub="everything incl. recordings, to move it or keep it safe (.hum)" onClick={() => doExport("backup")} />
              </div>
            )}
          </div>
        </div>
      </header>
      {exporting === "wav" && <p className="mt-2 text-right text-xs text-ink-soft">making your wav... the sampled instruments might take a sec</p>}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-8">
          <RecorderDeck side="A" label={song.title || "untitled hum"} recording={leadBlob} peaks={song.peaks} durationSec={song.durationSec}
            busy={busy === "lead"} onCaptured={(b) => processCapture(b, "lead")} />

          {/* melody editor */}
          <div className="panel p-4 sm:p-5">
            <SectionTitle kicker={hasNotes ? "you made that!" : "the melody"} title={hasNotes ? "your melody as notes" : "your notes will show up here"}>
              {hasNotes && <span className="text-xs text-ink-soft">{song.notes.length} notes, sounds like {keyName(detectKey(song.notes))}</span>}
            </SectionTitle>

            <VersionBar song={song}
              onSwitch={(id) => { versionAction((s) => switchVersion(s, id), { fresh: true }); toast("switched version"); }}
              onSaveNew={(name) => { versionAction((s) => saveAsNewVersion(s, name)); toast("saved a new version ♡"); }}
              onDuplicate={(id) => { versionAction((s) => duplicateVersion(s, id)); toast("copied"); }}
              onRename={(id, name) => versionAction((s) => renameVersion(s, id, name))}
              onDelete={(id) => { versionAction((s) => deleteVersion(s, id), { fresh: true, tidy: true }); toast("version deleted"); }}
            />

            {song.transcriptionWarning && (
              <p className="mb-3 rounded-xl bg-butter px-3 py-2 text-sm" role="status">{song.transcriptionWarning}</p>
            )}

            {/* transport */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {playing ? (
                <button className="key h-11 px-4" onClick={() => player.stop()} aria-label="stop"><Square size={15} fill="currentColor" /> stop</button>
              ) : (
                <button className="key h-11 px-4" onClick={() => startPlayback()} disabled={!hasNotes} aria-label="play" style={{ background: "#39343B", color: "#fff" }}>
                  <Play size={15} fill="currentColor" /> play
                </button>
              )}
              <button className="chip" aria-pressed={loop} onClick={() => { setLoop(!loop); playOpts.current.loop = !loop; refreshPlayback(); }} title="loop"><Repeat size={13} /> loop</button>
              <button className="chip" aria-pressed={withVoice && voiceInSync} disabled={!voiceBuffer || !voiceInSync}
                onClick={() => { setWithVoice(!withVoice); playOpts.current.withVoice = !withVoice; refreshPlayback(); }}
                title={voiceInSync ? "play your original hum along with the instruments" : `your voice only lines up at the original tempo (${song.transcribedBpm} bpm)`}>
                <Mic2 size={13} /> + my voice
              </button>
              <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
              <TempoControl bpm={song.bpm} transcribedBpm={song.transcribedBpm} hasNotes={hasNotes}
                onSetBpm={(bpm) => edit((s) => ({ ...s, bpm }), false)} onRegrid={regrid} />
              <span className="flex items-center gap-1 text-sm font-bold">
                key
                <button className="chip !px-2" onClick={() => edit((s) => ({ ...s, notes: s.notes.map((n) => ({ ...n, midi: n.midi - 1 })) }))} disabled={!hasNotes} aria-label="transpose down"><Minus size={12} /></button>
                <button className="chip !px-2" onClick={() => edit((s) => ({ ...s, notes: s.notes.map((n) => ({ ...n, midi: n.midi + 1 })) }))} disabled={!hasNotes} aria-label="transpose up"><Plus size={12} /></button>
              </span>
            </div>

            {/* editing tools */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <button className="chip" onClick={() => { undo(); refreshPlayback(); }} disabled={!canUndo} aria-label="undo"><Undo2 size={13} /></button>
              <button className="chip" onClick={() => { redo(); refreshPlayback(); }} disabled={!canRedo} aria-label="redo"><Redo2 size={13} /></button>
              <button className="chip" onClick={() => {
                const last = song.notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
                const sel = song.notes.find((n) => n.id === selected);
                const n: Note = { id: crypto.randomUUID(), midi: sel?.midi ?? song.notes.at(-1)?.midi ?? 60, start: sel ? sel.start + sel.duration : last, duration: 1, velocity: 0.8 };
                setNotes([...song.notes, n].sort((a, b) => a.start - b.start)); setSelected(n.id); previewNote(song.leadInstrument, n.midi);
              }}><Plus size={13} /> note</button>
              <button className="chip" disabled={!selected} onClick={() => { setNotes(song.notes.filter((n) => n.id !== selected)); setSelected(null); }}><Trash2 size={13} /> delete</button>
              <button className="chip" disabled={!hasNotes} onClick={() => setNotes(quantize(song.notes, 0.25))} title="snap every note to the nearest 16th"><Wand2 size={13} /> tidy timing</button>
              <button className="chip" disabled={!song.originalNotes.length} onClick={() => setNotes(song.originalNotes)} title="go back to exactly what you hummed"><RotateCcw size={13} /> reset to original</button>
              <select value="" onChange={(e) => { if (e.target.value) addPart(e.target.value as SectionType); }}
                className="rounded-full border border-line bg-white px-2 py-1 text-xs font-bold" aria-label="add a song part">
                <option value="">+ part</option>
                {SECTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <span className="ml-auto flex items-center gap-1">
                <select value={snap} onChange={(e) => setSnap(+e.target.value)} className="rounded-full border border-line bg-white px-2 py-1 text-xs font-bold" aria-label="snap">
                  <option value={0}>snap off</option>
                  <option value={0.25}>snap 1/16</option>
                  <option value={0.5}>snap 1/8</option>
                  <option value={1}>snap to beat</option>
                </select>
                <button className="chip !px-2" onClick={() => setZoom((z) => Math.max(20, z - 12))} aria-label="zoom out"><ZoomOut size={13} /></button>
                <button className="chip !px-2" onClick={() => setZoom((z) => Math.min(140, z + 12))} aria-label="zoom in"><ZoomIn size={13} /></button>
              </span>
            </div>

            <PianoRoll
              notes={song.notes}
              ghostNotes={song.layer ? song.layer.notes.map((n) => ({ ...n, start: n.start + song.layer!.offset })) : []}
              onCommit={setNotes}
              onPreview={(m) => previewNote(song.leadInstrument, m, 0.4)}
              playhead={playhead}
              pxPerBeat={narrow ? Math.round(zoom * 0.7) : zoom}
              snap={snap}
              selectedId={selected}
              onSelect={setSelected}
              compact={narrow}
              markers={markersShown}
              selectedMarkerId={selectedMarker}
              onSelectMarker={(id) => { setSelectedMarker(id); if (id) setHighlightLyric(markersShown.find((m) => m.id === id)?.lyricId ?? null); }}
              onMoveMarker={(id, beat) => edit((s) => ({ ...s, markers: moveMarker(s.markers, id, beat) }))}
            />
            {activeMarker && (
              <MarkerEditor
                marker={activeMarker}
                lyrics={song.lyrics}
                onChange={(patch) => edit((s) => ({ ...s, markers: updateMarker(s.markers, activeMarker.id, patch) }), !("label" in patch))}
                onDelete={() => { edit((s) => ({ ...s, markers: deleteMarker(s.markers, activeMarker.id) })); setSelectedMarker(null); }}
                onJump={() => startPlayback(activeMarker.beat)}
                onOpenLyrics={() => { setTab("lyrics"); setHighlightLyric(activeMarker.lyricId); }}
                onClose={() => setSelectedMarker(null)}
              />
            )}
            <p className="mt-2 text-[11px] text-ink-soft">
              drag a note up or down to change the pitch, or sideways to move it. drag the right edge to make it longer. double-click an empty spot to add a note, or a note to delete it. arrow keys nudge it, space plays
            </p>
          </div>
        </div>

        <aside className="min-w-0 lg:col-span-4">
          <div className="lg:sticky lg:top-4">
            <InstrumentPicker
              selected={song.leadInstrument}
              onSelect={(id) => edit((s) => ({ ...s, leadInstrument: id }), false)}
              volume={song.arrangement.tracks.lead.volume}
              onVolume={(v) => { player.setTrackVolume("lead", v); update((s) => ({ ...s, arrangement: { ...s.arrangement, tracks: { ...s.arrangement.tracks, lead: { ...s.arrangement.tracks.lead, volume: v } } } })); }}
            />
            <p className="mt-2 px-2 text-xs text-ink-soft">playing on <b>{getInstrument(song.leadInstrument).name}</b>. switching instruments won't change your notes</p>
          </div>
        </aside>
      </div>

      {/* lower tabs */}
      <nav className="mt-8 flex gap-2 overflow-x-auto" role="tablist">
        {([["arrange", "arrange"], ["drums", "drums"], ["effects", "effects"], ["layer", "add another hum"], ["lyrics", "lyrics"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-extrabold transition ${tab === id ? "bg-ink text-white" : "bg-white/70 hover:bg-white"}`}>
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-3">
        {tab === "arrange" && <ArrangePanel song={song} onChange={changeArrangement} onOpenDrums={() => setTab("drums")} />}
        {tab === "drums" && (
          <DrumSequencer grid={song.arrangement.drums} bpm={song.bpm} volume={song.arrangement.tracks.drums.volume} effects={song.arrangement.effects}
            bandOn={song.arrangement.enabled} onChange={(drums) => changeArrangement({ ...song.arrangement, drums })} />
        )}
        {tab === "effects" && (
          <EffectsPanel effects={song.arrangement.effects}
            onChange={(effects) => { player.setEffects(effects); changeArrangement({ ...song.arrangement, effects }, { live: true }); }} />
        )}
        {tab === "layer" && (
          <LayerPanel
            song={song} recording={layerBlob} busy={busy === "layer"} warning={layerInfo.warning} peaks={layerInfo.peaks} durationSec={layerInfo.duration}
            onCaptured={(b) => processCapture(b, "layer")}
            onChange={(layer) => edit((s) => ({ ...s, layer }))}
            onRemove={async () => { edit((s) => ({ ...s, layer: null })); setLayerInfo({ peaks: [], duration: 0, warning: null }); await saveAndTidy(); }}
          />
        )}
        {tab === "lyrics" && <LyricsPanel sections={song.lyrics} highlightId={highlightLyric} partNames={partNames}
          onChange={(lyrics) => update((s) => ({ ...s, lyrics, markers: pruneLyricLinks(s.markers, lyrics) }))} saveState={saveState} />}
      </div>
      {coverOpen && (
        <CoverEditor title={song.title} cover={song.cover} onClose={() => setCoverOpen(false)}
          onSave={async (cover, img) => { const next = await withCover(get()!, cover, img); update(() => next); await saveAndTidy(); }}
          onRemove={async () => { update((s) => ({ ...s, cover: null })); await saveAndTidy(); }} />
      )}
      <Toaster />
    </div>
  );
}

function ExportItem({ icon, title, sub, disabled, onClick }: { icon: React.ReactNode; title: string; sub: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-blush disabled:opacity-40 disabled:hover:bg-transparent">
      <span className="mt-0.5">{icon}</span>
      <span><span className="block text-sm font-extrabold">{title}</span><span className="block text-xs text-ink-soft">{sub}</span></span>
    </button>
  );
}
