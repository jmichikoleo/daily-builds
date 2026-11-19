// src/components/ArrangePanel.tsx
// four-track mini arrangement, moods, key, chord progressions,
// chord/bass/drum choices and a small mixer (mute / solo / volume).
import { useMemo } from "react";
import { Headphones, VolumeX, Wand2 } from "lucide-react";
import { MELODIC, getInstrument } from "../audio/instruments";
import { player } from "../audio/player";
import { MOODS, applyMood } from "../lib/moods";
import { DRUM_PRESETS, NOTE_NAMES, PROGRESSIONS, chordsFor, detectKey, keyName, presetGrid, scoreProgression } from "../lib/theory";
import type { Arrangement, BassStyle, ChordStyle, Song, TrackMix } from "../lib/types";
import { SectionTitle } from "./ui";

interface Props { song: Song; onChange: (a: Arrangement, opts?: { live?: boolean }) => void; onOpenDrums?: () => void }

const CHORD_STYLES: { id: ChordStyle; label: string }[] = [
  { id: "block", label: "simple" }, { id: "pad", label: "sustained" }, { id: "strum", label: "strummed" }, { id: "arp", label: "arpeggio" }, { id: "stabs", label: "stabs" },
];
const BASS_STYLES: { id: BassStyle; label: string }[] = [
  { id: "roots", label: "long roots" }, { id: "rootFifth", label: "root and fifth" }, { id: "octaves", label: "octaves" }, { id: "syncopated", label: "bouncy" }, { id: "walking", label: "walking" },
];

export default function ArrangePanel({ song, onChange, onOpenDrums }: Props) {
  const a = song.arrangement;
  const detected = useMemo(() => detectKey(song.notes), [song.notes]);
  const ranked = useMemo(
    () => PROGRESSIONS.map((p) => ({ p, score: scoreProgression(p, a.key, song.notes) })).sort((x, y) => y.score - x.score),
    [a.key, song.notes],
  );
  const set = (patch: Partial<Arrangement>) => onChange({ ...a, ...patch, enabled: true });
  const hasNotes = song.notes.length > 0;

  if (!hasNotes) {
    return (
      <div className="panel p-5">
        <SectionTitle kicker="the band" title="give your melody a little company." />
        <p className="text-sm text-ink-soft">hum something first, then chords, bass and drums can join in here</p>
      </div>
    );
  }

  return (
    <div className="panel p-4 sm:p-5">
      <SectionTitle kicker="the band" title="give your melody a little company.">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={a.enabled} onChange={(e) => onChange({ ...a, enabled: e.target.checked })} className="h-4 w-4 accent-[#B9729B]" />
          band {a.enabled ? "on" : "off"}
        </label>
      </SectionTitle>

      <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-ink-soft">mood</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {MOODS.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange(applyMood(a, m.id))}
            aria-pressed={a.mood === m.id && a.enabled}
            className={`rounded-2xl border p-3 text-left transition ${a.mood === m.id && a.enabled ? "border-ink shadow-[0_0_0_2px_#39343B]" : "border-line hover:-translate-y-0.5"}`}
            style={{ background: m.color }}
          >
            <span className="block text-sm font-extrabold">{m.name}</span>
            <span className="block text-[11px] leading-snug text-ink/70">{m.blurb}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-ink-soft">
            key
            <button className="chip !py-0.5 normal-case tracking-normal" onClick={() => set({ key: detected })} title="use the key your melody is in">
              <Wand2 size={12} /> sounds like {keyName(detected)}
            </button>
          </p>
          <div className="flex gap-2">
            <select className="flex-1 rounded-xl border border-line bg-white px-2 py-2 text-sm" value={a.key.tonic} onChange={(e) => set({ key: { ...a.key, tonic: +e.target.value } })} aria-label="key root">
              {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
            </select>
            <select className="flex-1 rounded-xl border border-line bg-white px-2 py-2 text-sm" value={a.key.mode} onChange={(e) => set({ key: { ...a.key, mode: e.target.value as "major" | "minor" } })} aria-label="key mode">
              <option value="major">major (bright)</option>
              <option value="minor">minor (moody)</option>
            </select>
          </div>

          <p className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wider text-ink-soft">chords that fit best</p>
          <ul className="space-y-1.5">
            {ranked.slice(0, 5).map(({ p, score }, i) => {
              const chords = chordsFor(p, a.key);
              const sel = a.progressionId === p.id;
              return (
                <li key={p.id}>
                  <button onClick={() => set({ progressionId: p.id })} aria-pressed={sel}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm ${sel ? "border-ink bg-white shadow-[0_0_0_1px_#39343B]" : "border-line bg-white/70 hover:border-rose"}`}>
                    <span>
                      <span className="font-bold">{chords.map((c) => c.name).join(" → ")}</span>
                      <span className="ml-2 text-xs text-ink-soft">{p.name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-rose-deep">{i === 0 ? "★ " : ""}{Math.round(score * 100)}% fit</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-3">
          <Row label="chord instrument">
            <InstSelect value={a.chordInstrument} onChange={(v) => set({ chordInstrument: v })} />
            <select className="rounded-xl border border-line bg-white px-2 py-2 text-sm" value={a.chordStyle} onChange={(e) => set({ chordStyle: e.target.value as ChordStyle })} aria-label="chord style">
              {CHORD_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Row>
          <Row label="bass">
            <InstSelect value={a.bassInstrument} onChange={(v) => set({ bassInstrument: v })} />
            <select className="rounded-xl border border-line bg-white px-2 py-2 text-sm" value={a.bassStyle} onChange={(e) => set({ bassStyle: e.target.value as BassStyle })} aria-label="bass style">
              {BASS_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Row>
          <Row label="drums">
            <select className="flex-1 rounded-xl border border-line bg-white px-2 py-2 text-sm" value={a.drums.preset ?? ""} onChange={(e) => { if (e.target.value) set({ drums: presetGrid(e.target.value) }); }} aria-label="drum pattern">
              {!a.drums.preset && <option value="">your own beat</option>}
              {DRUM_PRESETS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {onOpenDrums && <button className="chip shrink-0" onClick={onOpenDrums}>edit</button>}
          </Row>
          <label className="flex items-center gap-3 text-sm font-bold">
            reverb
            <input type="range" min={0} max={1} step={0.01} value={a.effects.reverb} onChange={(e) => set({ effects: { ...a.effects, reverb: +e.target.value } })} className="flex-1" />
          </label>
        </div>
      </div>

      <p className="mb-2 mt-6 text-xs font-extrabold uppercase tracking-wider text-ink-soft">mixer</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <MixRow name="lead melody" sub={getInstrument(song.leadInstrument).name} mix={a.tracks.lead} onChange={(m, live) => onChange({ ...a, tracks: { ...a.tracks, lead: m } }, { live })} track="lead" />
        {song.layer && <MixRow name="hum layer" sub={getInstrument(song.layer.instrument).name} mix={a.tracks.layer} onChange={(m, live) => onChange({ ...a, tracks: { ...a.tracks, layer: m } }, { live })} track="layer" />}
        <MixRow name="chords" sub={getInstrument(a.chordInstrument).name} mix={a.tracks.chords} disabled={!a.enabled} onChange={(m, live) => onChange({ ...a, tracks: { ...a.tracks, chords: m } }, { live })} track="chords" />
        <MixRow name="bass" sub={getInstrument(a.bassInstrument).name} mix={a.tracks.bass} disabled={!a.enabled} onChange={(m, live) => onChange({ ...a, tracks: { ...a.tracks, bass: m } }, { live })} track="bass" />
        <MixRow name="drums" sub={DRUM_PRESETS.find((d) => d.id === a.drums.preset)?.name ?? "your own beat"} mix={a.tracks.drums} disabled={!a.enabled} onChange={(m, live) => onChange({ ...a, tracks: { ...a.tracks, drums: m } }, { live })} track="drums" />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-ink-soft">{label}</p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function InstSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className="min-w-0 flex-1 rounded-xl border border-line bg-white px-2 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)} aria-label="instrument">
      {MELODIC.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
    </select>
  );
}

function MixRow({ name, sub, mix, onChange, disabled, track }: {
  name: string; sub: string; mix: TrackMix; disabled?: boolean; track: "lead" | "layer" | "chords" | "bass" | "drums";
  onChange: (m: TrackMix, live: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border border-line bg-white/80 px-3 py-2 ${disabled ? "opacity-50" : ""}`}>
      <div className="w-24 shrink-0 leading-tight">
        <p className="text-sm font-extrabold">{name}</p>
        <p className="truncate text-[11px] text-ink-soft">{sub}</p>
      </div>
      <button className="chip !px-2" aria-pressed={mix.muted} onClick={() => onChange({ ...mix, muted: !mix.muted }, false)} title="mute" aria-label={`mute ${name}`} disabled={disabled}>
        <VolumeX size={12} />
      </button>
      <button className="chip !px-2" aria-pressed={mix.solo} onClick={() => onChange({ ...mix, solo: !mix.solo }, false)} title="solo" aria-label={`solo ${name}`} disabled={disabled}>
        <Headphones size={12} />
      </button>
      <input type="range" min={0} max={1} step={0.01} value={mix.volume} disabled={disabled} aria-label={`${name} volume`}
        onChange={(e) => { player.setTrackVolume(track, +e.target.value); onChange({ ...mix, volume: +e.target.value }, true); }} className="min-w-0 flex-1" />
    </div>
  );
}
