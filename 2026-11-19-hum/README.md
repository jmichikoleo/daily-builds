# hum.

*for the melodies stuck in your head.*

A little songwriting studio in the browser. Hum a melody, watch it turn into notes, fix them in a piano roll, hear them on 16 instruments, add chords, bass and drums, hum a second part, write lyrics, and export a MIDI or WAV. No account, no backend, no AI. Everything stays in your browser (IndexedDB).

Daily build · 2026-11-19 · Vite + React + TypeScript + Tailwind v4 + Tone.js + pitchy + Dexie + @tonejs/midi

## Run it

```bash
npm install
npm run dev        # http://localhost:5190
npm test           # transcription + theory tests (synthetic melodies)
npm run build      # typecheck + production build into dist/
```

The microphone needs a secure context: `localhost` or `https`.

## Deploy to Netlify

`netlify.toml` already sets `npm run build` and the `dist` folder. Either:

- drag the `dist/` folder onto app.netlify.com/drop, or
- connect the repo in Netlify (base directory `2026-11-19-hum` if it lives in a monorepo), or
- `npx netlify deploy --prod --dir dist`

The app has no routes beyond `#/` hashes, so no redirect rules are needed.

## What's in it

| Area | What works |
|---|---|
| **My Songs** | create, open, rename, duplicate (including recordings), delete with confirm; cards show a waveform, date, length and lead instrument |
| **Recording** | cassette deck with record/stop, timer, live waveform, mic permission status, playback of the original, record again, **upload a voice memo** instead of using the mic. Friendly messages for blocked/missing/busy mics. Stops on its own after 90 s |
| **Transcription** | pitchy (McLeod pitch method) on ~11 ms frames → loudness gate + clarity gate → median smoothing → note segmentation (gaps, sustained pitch changes) → notes shorter than 80 ms dropped. Shows a warning instead of inventing notes when the audio is quiet or noisy |
| **Melody editor** | piano roll: drag for pitch/time, drag the right edge to resize, double-click to add or delete, arrow keys to nudge, undo/redo (⌘Z / ⇧⌘Z), snap (free, 1/16, 1/8, beat), zoom, playhead, transpose, tempo, "tidy timing" (quantize), reset to original |
| **Instruments** | 16: Grand Piano, Electric Piano, Music Box, Organ, Acoustic Guitar, Electric Guitar, Violin, Cello, Harp, Electric Bass (sampled); Synth Lead, Dreamy Pad, Pluck, Ambient Bells, Synth Bass (Tone.js synths); Drum Kit (synthesized, drum track only). Samples load the first time you pick an instrument. If they can't load (offline), a synth stand-in plays and the card says so |
| **Arrange** | lead, chords, bass and drums (plus the hum layer). 5 moods (Dreamy Pop, Acoustic, Lo-fi, R&B, Cinematic) each change instruments, chord style, bass style, drums, reverb and levels. Key detection (Krumhansl–Kessler), 8 progressions ranked by how well they fit your notes, mute/solo/volume per track. Moods never touch the melody |
| **Add another hum** | record or upload a second melody, pick its instrument, slide it ±8 beats, shift octaves. It plays alongside the lead and shows as dashed notes in the editor |
| **+ my voice** | play your original hum together with the instruments (only at the tempo it was transcribed at, so it stays in sync) |
| **Lyrics** | notebook with Verse / Pre-Chorus / Chorus / Bridge / Outro, add/rename/reorder/delete, autosaved |
| **Save** | autosaves to IndexedDB about half a second after each change, and when you leave the page. Recordings are stored as the original blobs, unchanged |
| **Export** | original recording (its real format: webm/m4a/ogg/wav), multi-track MIDI (GM programs, drums on channel 10), WAV of the full arrangement rendered offline with `Tone.Offline` |

## How it was tested

- `npm test`: 12 tests. The transcriber is checked against synthetic hum-like signals with harmonics, vibrato and noise: detached and legato melodies, low and high voices, 44.1 and 48 kHz audio. Silence and pure noise must produce no notes and a warning. The theory tests cover key detection, chord spelling, fit scoring, accompaniment builders, and a check that every mood is different.
- In the browser, a synthetic WAV went through the real upload path and came back as exactly C4 E4 G4 E4 D4 C4 at the right beats. Also checked: playback starts and stops, changing the mood while playing doesn't cause overlapping playback, drag/resize/add/delete/undo in the piano roll, instrument switching, the hum layer, reload persistence (notes, layer, instrument, lyrics), duplicate, mobile layout at 375 px, and the blocked-mic message.
- Offline renders of all 15 melodic instruments all produced audio with distinct timbre statistics, and so did all 5 moods. The WAV header is valid. The MIDI file parses back into 5 tracks at the right tempo.

### Still needs a manual check (needs real hardware)

1. **Live mic recording**: open on `localhost`, press record, hum about 5 s, stop. Expect a live waveform while recording, then notes in the roll.
2. **Real humming accuracy**: a steady "doo" in a quiet room should come out close to what you sang. Breathy or slidey singing will have errors you can fix in the editor.
3. **Safari/iOS**: recording uses `audio/mp4` there. Check that upload and playback work.
4. **Listening**: the levels and moods were balanced by numbers, not by ear.

## Known limitations

- Monophonic only: one voice, one note at a time. No chords, no separating a voice from music.
- Note boundaries come from pitch changes and silence. Repeating the *same* note with no gap between them ("da-da-da") can merge into one long note.
- Tempo isn't detected. The hum is mapped onto a 90 bpm grid, so playback at 90 bpm matches your timing. Use "tidy timing" if you want to quantize.
- Sampled instruments stream from `gleitz.github.io/midi-js-soundfonts` (FluidR3 GM, **CC-BY 3.0**, credited in the app footer). With no network, synth stand-ins play.
- One extra hummed layer per song.
- Undo covers note edits, transpose and layer edits. It does not cover tempo, titles, lyrics or mixer moves.
- Storage is per-browser. Clearing site data deletes your songs, so export what you want to keep.

## Ideas for later

- Tempo/beat detection from note onsets, so the grid follows the hummer
- Onset detection from energy so repeated same-pitch notes split
- Bundle a small sample set (or cache it with a service worker) for full offline use
- A "sing-along" metronome count-in for recording the layer
- Per-section song structure (verse/chorus loops) that ties lyrics to bars
- Velocity from loudness, pitch bends from the original hum

## Files

```
src/audio/transcribe.ts   hum → notes (pure, tested)
src/audio/instruments.ts  16 instruments, on-demand sample loading, drum kit
src/audio/player.ts       single playback engine, previews, offline render
src/audio/recorder.ts     MediaRecorder + analyser, error mapping
src/lib/theory.ts         key detection, progressions, chord/bass/drum parts
src/lib/moods.ts          5 arrangement moods
src/lib/db.ts             Dexie (songs + recordings)
src/lib/exporters.ts      MIDI, WAV, downloads
src/state/useSong.ts      load, autosave, undo/redo
src/components/*          Library, Studio, RecorderDeck, PianoRoll, InstrumentPicker, ArrangePanel, LayerPanel, LyricsPanel
tests/*                   vitest
```
