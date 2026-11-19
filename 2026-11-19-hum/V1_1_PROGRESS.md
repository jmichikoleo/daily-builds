# hum. v1.1 progress

the songwriting update. built on branch `hum-v1.1`, started from `de45ea5` (the live v1.0). nothing is pushed, merged or deployed yet.

## baseline

before touching anything, typecheck was clean, 12 of 12 tests passed and the build worked. there's no linter set up in this project, so nothing to run there. no failures to start with.

## what's done

| feature | status | commit |
|---|---|---|
| tap tempo and bpm box | done | bd4d756 |
| melody versions | done | bd4d756 |
| song section markers | done | bd4d756 |
| effects rack | done | 1589549 |
| 16-step drum sequencer | done | 1589549 |
| song cover creator | done | bb8cd6b |
| project backup and restore | done | 282047a |
| rerecord a part | done | 2423113 |

## the rules i picked

- **timing** notes are stored in beats. the bpm box changes playback speed, and notes, chords, bass, drums, MIDI and WAV all follow it. "fit the beat to my hum" is the other option. it keeps your hum at its real speed and moves the bars and drums to the tapped tempo instead. the original recording is never stretched, so "+ my voice" only works when the bpm matches the tempo the hum was turned into notes at. the reset button goes back to that tempo
- **versions** hold everything musical. that's notes, tempo, instruments, chords, bass, drums, mood, volumes, effects, markers and the second hum. lyrics and the cover are shared by every version. switching saves what you were doing into the version you're leaving, so nothing gets thrown away. undo history resets when you switch
- **recordings** every new recording gets its own key. versions point to recordings and never copy them. a recording is only deleted once no version, take or cover uses it, and only after the song has been saved
- **markers** belong to a version and link to a lyrics section by its id. deleting a marker never deletes lyrics. deleting lyrics just unlinks the marker
- **effects** one rack for the whole song (not per track), and the effects panel says so. the WAV export goes through the same code so it sounds the same
- **drums** five rows of 16 on/off steps (kick, snare, closed hat, open hat and an extra shaker, rim or tom row so the acoustic and cinematic moods keep their sound). old v1 drum presets turn into the matching grid
- **backup** a `.hum` file is a zip with `manifest.json` and `files/N.ext`. reading one checks the size, file count and unpacked size before unpacking anything, only allows those two kinds of paths, checks the schema version and makes sure every recording the song needs is there. it never overwrites. if the song is already here it comes in as a copy with new ids
- **rerecord** the new take is turned into notes at the current bpm. old notes that start inside the part are removed, ones ringing into it get cut to stop at the start, and anything at or after the end is left alone. new notes past the end are dropped or cut. you can line up your first note with the start or keep your pause. nothing is saved until you press apply, it can be undone, and every take is kept with the song

## database

the Dexie schema didn't change (still version 1, same two tables). new fields are added when a song is read (`src/lib/migrate.ts`, `schemaVersion` 2) and only written back the next time that song is saved. v1 recordings keep their old keys (`<id>:lead`, `<id>:layer`). i tested this with a real v1 song saved in the browser before the upgrade. it opened with its notes, recording, second hum, lyrics, drums (cinematic) and reverb intact.

## tests

51 automated tests (`npm test`), all passing.

- tempo. tap math, sloppy taps, pauses, bad values, regrid
- migration. the real v1 song fixture, junk data, running it twice gives the same result
- versions. save, switch, duplicate, rename, delete, shared lyrics, recordings staying referenced
- markers. add, lyrics linking, move, delete, ranges, unlinking
- drums. presets, toggling, GM notes, swing, moods are all different
- effects. bypass, clamping, feedback limit
- covers. file checks, every background and pattern draws, cleanup of bad values
- backup. full round trip, copy with new ids, random bytes, empty, foreign zips, unsafe paths, broken and newer manifests, missing recordings, wrong file types, keys from other songs, a zip bomb
- rerecord. placement, both alignment options, boundaries, outside notes untouched, cancel, takes and versions
- the original 12 transcription and theory tests

checked by hand in the browser.

- the v1 song opening after the upgrade, nothing lost
- bpm typing and clamping, tap tempo (100 bpm with one sloppy tap), fit the beat, reload keeps it
- saving, switching, duplicating and deleting versions, reload keeps them, no recordings lost
- adding parts, the lyrics link and highlight, dragging with snap, undo
- effects measured on renders. each one changes the sound, bypass is identical to dry, peak stays at 0.2 with everything maxed
- drum grid toggling and presets, the loop's step highlight in time, stop cleaning up, the pattern in MIDI (channel 10) and in the WAV
- cover upload (a 4.7 MB picture stored as 9 KB), bad and broken files, the card thumbnail, a 1080 × 1080 PNG
- backup, check, delete the song, restore. song and recordings came back identical and it plays. importing again was refused, a copy got new ids, a junk file changed nothing
- rerecord apply, undo, redo, cancel, a narrow range keeping outside notes, the original recording untouched
- sample fallback when the sample server is unreachable, and loading for real once it's back
- phone width (375px) on every tab, no sideways scrolling
- the production build served locally, with no backend and no console errors

## not tested

- **a real microphone.** the browser i test in blocks the mic, so every recording test used uploaded audio. recording with a mic, including in the rerecord panel, still needs checking by hand
- safari and iphone
- listening by ear. levels and effects were checked by measuring
- the cover PNG and backup download buttons themselves. i tested the same functions they call, but didn't trigger a real download

## limits

- markers are per version, so a new version starts with a copy of the current markers but they don't sync after that
- takes are kept forever, there's no button to delete one yet
- tempo changes (the bpm box) aren't undoable, "fit the beat" is
- one shared effects rack, not per track

## still to do

- try the mic on the deployed site
- push the branch, merge into main and deploy, once you say so

## deploy

not deployed. netlify settings haven't changed (`npm run build`, publish `dist`). the netlify site link lives in `~/Desktop/mochis-project/2026-11-19-hum/.netlify`, which isn't in git.
