// src/components/Library.tsx
// "My Songs", create, open, rename, duplicate, delete.
import { useEffect, useState } from "react";
import { Copy, Pencil, Plus, Trash2, Check, X, Music2, Palette } from "lucide-react";
import { cleanupBlobs, deleteSong, duplicateSong, listSongs, newSong, saveSong, withCover } from "../lib/db";
import CoverEditor, { CoverThumb } from "./CoverEditor";
import { RestoreButton } from "./RestoreDialog";
import { getInstrument } from "../audio/instruments";
import type { Song } from "../lib/types";
import { INSTRUMENT_ICON, PeaksWave, Reel, Toaster, fmtTime, toast } from "./ui";
import { go } from "../App";

const CARD_TINTS = ["#F7DDE5", "#DCD0F3", "#D4EDE4", "#FFF0BE"];

export default function Library() {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const refresh = () => listSongs().then(setSongs).catch(() => setSongs([]));
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    const s = newSong();
    await saveSong(s);
    go(`/song/${s.id}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      <header className="flex items-center justify-between">
        <a href="#/" className="font-display text-3xl font-semibold italic tracking-tight">hum<span className="text-rose-deep">.</span></a>
        <span className="hidden font-hand text-xl text-ink-soft sm:block">your little songwriting studio</span>
      </header>

      <section className="panel relative mt-8 overflow-hidden px-6 py-10 sm:px-12 sm:py-14">
        <div className="pointer-events-none absolute right-8 top-8 hidden gap-3 opacity-90 md:flex" aria-hidden>
          <div className="animate-float"><Reel spin size={110} /></div>
          <div className="animate-float [animation-delay:.6s]"><Reel spin size={110} /></div>
        </div>
        <p className="font-hand text-2xl text-rose-deep">every song starts somewhere.</p>
        <h1 className="mt-1 max-w-xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          for the melodies <em className="font-normal text-rose-deep">stuck</em> in your head.
        </h1>
        <p className="mt-4 max-w-md text-ink-soft">
          just hum it and it turns into notes. then you can play it on piano, harp, synths, whatever you want. you don't need an instrument or an account, and everything stays on your device
        </p>
        <button onClick={create} className="key mt-7 bg-ink px-7 py-4 text-lg text-white hover:!bg-ink/90" style={{ background: "#39343B", color: "#fff" }}>
          start humming ♡
        </button>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="font-hand text-xl leading-none text-rose-deep">everything you've hummed</p>
            <h2 className="font-display text-2xl font-semibold">my songs</h2>
          </div>
          <span className="flex flex-wrap justify-end gap-1.5">
            <RestoreButton onRestored={(id) => go(`/song/${id}`)} />
            {!!songs?.length && <button onClick={create} className="chip"><Plus size={14} /> new song</button>}
          </span>
        </div>

        {songs === null ? (
          <p className="text-ink-soft">loading your songs...</p>
        ) : songs.length === 0 ? (
          <div className="panel flex flex-col items-center px-6 py-14 text-center">
            <Music2 className="text-rose" size={36} />
            <p className="mt-3 font-display text-xl">no songs yet</p>
            <p className="mt-1 max-w-sm text-sm text-ink-soft">once you hum something it'll show up here with its notes, instruments and lyrics. just press <b>start humming</b> whenever a tune gets stuck in your head</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {songs.map((s, i) => (
              <SongCard key={s.id} song={s} tint={CARD_TINTS[i % CARD_TINTS.length]} onChanged={refresh} />
            ))}
          </ul>
        )}
      </section>
      <footer className="mt-16 text-center text-xs text-ink-soft">
        instrument samples are FluidR3 GM from midi-js-soundfonts (CC-BY 3.0)
      </footer>
      <Toaster />
    </div>
  );
}

function SongCard({ song, tint, onChanged }: { song: Song; tint: string; onChanged: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(song.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const inst = getInstrument(song.leadInstrument);
  const Icon = INSTRUMENT_ICON[inst.id];

  const rename = async () => {
    const t = title.trim() || "untitled hum";
    await saveSong({ ...song, title: t });
    setRenaming(false);
    onChanged();
  };

  return (
    <li className="panel group relative overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
      <button className="block w-full text-left" onClick={() => go(`/song/${song.id}`)} aria-label={`open ${song.title}`} disabled={renaming}>
        <div className="flex h-20 items-center gap-3 rounded-2xl px-3" style={{ background: tint }}>
          {song.cover && <CoverThumb cover={song.cover} title={song.title} className="h-16 w-16 shrink-0 rounded-xl shadow-sm" />}
          <PeaksWave peaks={song.peaks} className="h-12 min-w-0 flex-1" color="#B9729B" />
        </div>
      </button>
      <div className="mt-3 flex items-start justify-between gap-2">
        {renaming ? (
          <form className="flex flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); rename(); }}>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1 font-display" maxLength={60} aria-label="song title" />
            <button className="rounded-lg p-1.5 hover:bg-mint" aria-label="save title"><Check size={16} /></button>
            <button type="button" className="rounded-lg p-1.5 hover:bg-blush" onClick={() => { setTitle(song.title); setRenaming(false); }} aria-label="cancel"><X size={16} /></button>
          </form>
        ) : (
          <button className="min-w-0 text-left" onClick={() => go(`/song/${song.id}`)}>
            <h3 className="truncate font-display text-lg font-semibold">{song.title}</h3>
          </button>
        )}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        <span>{new Date(song.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        <span>{song.hasRecording ? fmtTime(song.durationSec) : "no hum yet"}</span>
        <span className="inline-flex items-center gap-1"><Icon size={12} /> {inst.name}</span>
      </p>
      <div className="mt-3 flex gap-1 border-t border-line pt-3">
        {confirmDelete ? (
          <div className="flex w-full items-center justify-between text-sm">
            <span>delete this for good?</span>
            <span className="flex gap-1">
              <button className="chip !bg-rose-deep !text-white" onClick={async () => { await deleteSong(song.id); toast("song deleted"); onChanged(); }}>delete</button>
              <button className="chip" onClick={() => setConfirmDelete(false)}>keep</button>
            </span>
          </div>
        ) : (
          <>
            <button className="chip" onClick={() => setRenaming(true)}><Pencil size={13} /> rename</button>
            <button className="chip" onClick={async () => { await duplicateSong(song.id); toast("duplicated ♡"); onChanged(); }}><Copy size={13} /> duplicate</button>
            <button className="chip" onClick={() => setCoverOpen(true)}><Palette size={13} /> cover</button>
            <button className="chip ml-auto" onClick={() => setConfirmDelete(true)} aria-label="delete song"><Trash2 size={13} /></button>
          </>
        )}
      </div>
      {coverOpen && (
        <CoverEditor title={song.title} cover={song.cover} onClose={() => setCoverOpen(false)}
          onSave={async (cover, img) => { const s = await withCover(song, cover, img); await saveSong(s); await cleanupBlobs(s); onChanged(); }}
          onRemove={async () => { const s = { ...song, cover: null }; await saveSong(s); await cleanupBlobs(s); onChanged(); }} />
      )}
    </li>
  );
}
