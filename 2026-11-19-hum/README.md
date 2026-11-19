# hum.

for the melodies stuck in your head.

a little songwriting studio in the browser. you hum a melody, it turns into notes, and then you can fix them, play them on 16 instruments, add chords, bass and drums, hum a second part, write lyrics and export it as MIDI or WAV. there's no account, no backend and no AI. everything stays in your browser.

v1.1 (the songwriting update) adds tap tempo, melody versions, song parts, an effects rack, a drum grid, covers, project backups and rerecording one part. see V1_1_PROGRESS.md for the details.

built in a day as one of my daily builds (2026-11-19) with vite, react, typescript, tailwind, tone.js, pitchy, dexie and @tonejs/midi.

## run it

```bash
npm install
npm run dev        # http://localhost:5190
npm test           # transcription and theory tests
npm run build      # typecheck and build into dist/
```

the mic only works on localhost or https.

## deploy to netlify

netlify.toml already has the build command and the dist folder, so you can either drag the dist folder onto netlify drop, connect the repo in netlify (set the base directory to `2026-11-19-hum`), or run `npx netlify deploy --prod --dir dist`. it only uses hash routes so you don't need any redirect rules.

## what it does

- **my songs** lets you make, open, rename, duplicate and delete songs. each card shows a little waveform, the date, the length and the instrument
- **recording** is a cassette deck with record, stop, a timer, a live waveform and the mic status. you can play back your original hum, record again, or upload a voice memo if you don't want to use the mic. it stops on its own after 90 seconds
- **hum to notes** uses pitchy to find the pitch every 11ms or so, ignores anything too quiet or unclear, smooths it out and splits it into notes. notes shorter than 80ms get dropped. if the audio is too quiet or noisy it tells you instead of making notes up
- **melody editor** is a simple piano roll. drag notes up or down to change the pitch, sideways to move them, drag the right edge to make them longer, and double-click to add or delete. there's undo and redo, snapping, zoom, transpose, tempo, a tidy timing button and a reset back to what you hummed
- **instruments** are grand piano, electric piano, music box, organ, acoustic guitar, electric guitar, violin, cello, harp and electric bass (real samples), plus synth lead, dreamy pad, pluck, ambient bells and synth bass (made with tone.js), and a drum kit for the drum track. samples load the first time you pick an instrument, and if they can't load you get a synth version that's labelled as one
- **arrange** adds chords, bass and drums under your melody. there are 5 moods (dreamy pop, acoustic, lo-fi, r&b and cinematic) that each change the instruments, how the chords and bass are played, the drums, the reverb and the volumes. it guesses the key of your melody and ranks 8 chord progressions by how well they fit. every track has mute, solo and volume. the moods never change your melody
- **add another hum** lets you record or upload a second part, pick its instrument, slide it into place and move it up or down an octave
- **+ my voice** plays your original hum together with the instruments, as long as you're still at the tempo it was converted at
- **lyrics** is a notebook with verse, pre-chorus, chorus, bridge and outro. you can add, rename, reorder and delete sections and it saves as you type
- **tempo** has a bpm box, plus and minus, tap tempo and a reset. "fit the beat to my hum" keeps your hum at its real speed and moves the bars and drums to the tempo you tapped
- **versions** let you save the song as it is and try something else. switch back any time, duplicate, rename or delete them. lyrics and the cover are shared
- **parts** (intro, verse, chorus and so on) sit in a lane above the notes. drag them, rename them, play from one, and they link to their lyrics
- **effects** reverb, delay and a tone knob on the whole song, with bypass and reset
- **drums** a 16-step grid with kick, snare, closed hat, open hat and an extra row. presets, swing, clear, and a loop button
- **covers** solid, gradient, pattern or your own picture, with the title and a little line under it. they show on your song cards and download as a 1080px png
- **rerecord a part** pick a part, hum just that bit again, hear it in place, then apply or cancel. notes outside the part stay put and you can undo it
- **saving** happens on its own about half a second after every change and when you leave the page. your recordings are kept exactly as you recorded them
- **export** gives you the original recording in its real format, a MIDI file with every track, a WAV of the whole arrangement, or a project backup
- **backups** are `.hum` files with the whole song and its recordings. restore one from my songs to move a song to another browser or bring it back after clearing your data

## how i tested it

- `npm test` runs 51 tests (the v1.1 ones are listed in V1_1_PROGRESS.md). the hum to notes part gets fake hums with harmonics, vibrato and noise, like separate notes, notes that slide into each other, low and high voices, and 44.1 and 48 khz audio. silence and plain noise have to come back with no notes and a warning. the theory tests check the key guessing, chord names, the fit scores, the backing parts and that every mood is actually different
- in the browser i uploaded a fake hum through the real upload button and got back exactly C4 E4 G4 E4 D4 C4 at the right times. i also checked playback starting and stopping, changing the mood while it's playing, editing notes and undo, switching instruments, the second hum, reloading the page, duplicating, the phone layout and the blocked mic message
- i rendered all 15 melody instruments and all 5 moods offline and they all made sound and came out different. the WAV file is valid and the MIDI opens back up with 5 tracks at the right tempo

### still needs checking by hand

1. recording with a real mic. press record, hum for a few seconds, stop, and the notes should show up
2. how close it gets with real humming. a steady "doo" in a quiet room works best, and sliding or breathy singing will need some fixing in the editor
3. safari and iphone, which record in a different format
4. listening to it. i balanced the volumes by measuring them, not by ear

## what it can't do yet

- it only hears one note at a time, so no chords and no pulling a voice out of a song
- if you sing the same note again with no gap ("da da da") it can turn into one long note
- it doesn't figure out your tempo on its own. your hum goes on a 90 bpm grid, and you can tap the real tempo and use "fit the beat to my hum"
- your voice isn't time stretched, so "+ my voice" only plays when the bpm matches the tempo your hum was turned into notes at
- the real instrument samples come from gleitz.github.io/midi-js-soundfonts (FluidR3 GM, CC-BY 3.0, credited in the app). without internet you get the synth versions
- one extra hum per song
- undo covers note edits, transpose, parts, rerecording and the second hum, but not the bpm box, titles, lyrics or the mixer
- the effects rack is one for the whole song, not one per track
- songs live in your browser, so clearing your site data deletes them. export anything you want to keep

## ideas for later

- figure out the tempo from your hum without tapping
- split repeated notes by listening for each new "da"
- keep the samples offline with a service worker
- a count-in before recording the second hum or a rerecorded part
- loudness and pitch bends from the original hum

## files

```
src/audio/transcribe.ts   hum to notes
src/audio/instruments.ts  the 16 instruments and the drum kit
src/audio/player.ts       playback, previews and the WAV render
src/audio/recorder.ts     the mic recording
src/lib/theory.ts         key, chords, bass and drums
src/lib/moods.ts          the 5 moods
src/lib/db.ts             saving to the browser
src/lib/exporters.ts      MIDI and WAV files
src/lib/migrate.ts        brings old songs up to date when they load
src/lib/tempo.ts          bpm limits, tap tempo, fit the beat
src/lib/versions.ts       melody versions and which recordings are still needed
src/lib/markers.ts        song parts and their lyrics links
src/lib/effects.ts        effect knobs to safe audio settings
src/lib/cover.ts          drawing covers and shrinking pictures
src/lib/backup.ts         .hum backups and the strict checks on restore
src/lib/rerecord.ts       how a rerecorded part replaces notes
src/state/useSong.ts      loading, autosave and undo
src/components/           all the screens and panels
tests/                    the tests
```
