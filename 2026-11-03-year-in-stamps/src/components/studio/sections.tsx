"use client";

import { ArrowDownToLine, ArrowUpToLine, Download, LocateFixed, RotateCcw, Shuffle } from "lucide-react";
import { useId } from "react";
import { countSummary, overrideFromPlacement, type ComposedCollage } from "@/lib/collage/compose";
import { FORMAT_LIST, type CollageFormatId } from "@/lib/collage/formats";
import type { Placement } from "@/lib/collage/layout";
import { MAX_TITLE_LENGTH, automaticTitle, type PassportDraft } from "@/lib/passport/types";
import { studioActions } from "@/lib/studio/store";
import {
  LAYOUT_PRESETS,
  MAX_FOOTER_LENGTH,
  MAX_SUBTITLE_LENGTH,
  TITLE_SUGGESTIONS,
  type BackgroundBorder,
  type BackgroundTexture,
  type LayoutPreset,
  type TitleAlign,
} from "@/lib/studio/types";
import { FONT_PRESET_LIST } from "@/lib/themes/fonts";
import { THEME_LIST, type ThemeId } from "@/lib/themes";
import { OptionGroup } from "./OptionGroup";
import { Section, Segmented, SwatchRow, TextButton, Toggle, labelClass } from "./controls";

const inputClass = "mt-1.5 w-full rounded-sm border border-line bg-ivory px-3 py-2 text-charcoal placeholder:text-muted/70 focus:border-burgundy";

export interface SectionProps {
  draft: PassportDraft;
  collage: ComposedCollage;
}

// ── Text ────────────────────────────────────────────────────────────────

export function TextSection({ draft, collage }: SectionProps) {
  const ids = { title: useId(), subtitle: useId(), footer: useId() };
  const { text } = draft.studio;
  const { resolved } = collage;
  return (
    <Section title="Words" action={<TextButton onClick={studioActions.resetTextStyle}>Reset style</TextButton>}>
      <div>
        <label htmlFor={ids.title} className={labelClass}>
          Title
        </label>
        <input
          id={ids.title}
          value={text.title}
          maxLength={MAX_TITLE_LENGTH}
          onChange={(e) => studioActions.setText({ title: e.target.value }, "title")}
          placeholder={automaticTitle(draft)}
          className={`${inputClass} font-serif text-lg`}
        />
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Title ideas">
          {TITLE_SUGGESTIONS(draft.year).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => studioActions.setText({ title: t })}
              className={`rounded-sm border px-2 py-1 text-xs ${text.title === t ? "border-burgundy bg-blush/50 text-burgundy" : "border-line bg-ivory hover:border-rose"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor={ids.subtitle} className={labelClass}>
          Subtitle <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id={ids.subtitle}
          value={text.subtitle}
          maxLength={MAX_SUBTITLE_LENGTH}
          onChange={(e) => studioActions.setText({ subtitle: e.target.value }, "subtitle")}
          placeholder="e.g. Seoul, sea air and too many trains"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={ids.footer} className={labelClass}>
          Footer <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id={ids.footer}
          value={text.footer}
          maxLength={MAX_FOOTER_LENGTH}
          onChange={(e) => studioActions.setText({ footer: e.target.value }, "footer")}
          placeholder={text.showCount ? countSummary(collage.stats) || "Your own words" : "Your own words"}
          className={inputClass}
        />
        <div className="mt-2">
          <Toggle label="Show stamp count when the footer is empty" checked={text.showCount} onChange={(v) => studioActions.setText({ showCount: v })} />
          <Toggle label="Show “Made with Your Year in Stamps”" checked={text.showAttribution} onChange={(v) => studioActions.setText({ showAttribution: v })} />
        </div>
      </div>

      <Segmented<TitleAlign>
        legend="Alignment"
        value={resolved.align}
        options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Centre" },
        ]}
        onChange={(align) => studioActions.setText({ align })}
      />

      <OptionGroup
        name="font"
        legend="Lettering"
        columns={2}
        value={resolved.fonts.id}
        onChange={(font) => studioActions.setText({ font })}
        options={FONT_PRESET_LIST.map((f) => ({
          value: f.id,
          label: f.name,
          visual: (
            <span
              className="block truncate text-2xl leading-tight text-charcoal"
              style={{ fontFamily: f.title.family, fontWeight: f.title.weight, fontStyle: f.title.italic ? "italic" : "normal" }}
              aria-hidden="true"
            >
              {draft.year}, Aa
            </span>
          ),
        }))}
      />

      <SwatchRow
        legend="Text colour"
        value={text.color}
        swatches={collage.theme.textSwatches}
        themeColor={collage.theme.accent}
        onChange={(color) => studioActions.setText({ color })}
      />
    </Section>
  );
}

// ── Theme ───────────────────────────────────────────────────────────────

export function ThemeSection({ draft }: SectionProps) {
  return (
    <Section title="Theme">
      <div className="grid gap-2" role="radiogroup" aria-label="Theme">
        {THEME_LIST.map((t) => {
          const checked = draft.studio.themeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => studioActions.setTheme(t.id as ThemeId)}
              className={`flex items-center gap-3 rounded-sm border p-2 text-left transition-colors ${checked ? "border-burgundy bg-blush/40" : "border-line bg-ivory hover:border-rose"}`}
            >
              <span className="relative flex h-14 w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-[2px] border border-charcoal/10" style={{ background: t.paper }} aria-hidden="true">
                <span className="text-sm leading-none" style={{ color: t.text, fontFamily: t.id === "pink" ? "var(--font-cormorant)" : t.id === "editorial" ? "var(--font-grotesk)" : "var(--font-fraunces)", fontStyle: t.id === "pink" ? "italic" : "normal", fontWeight: 600 }}>
                  Aa
                </span>
                <span className="flex gap-0.5">
                  {[...new Set(t.inks)].slice(0, 3).map((ink) => (
                    <span key={ink} className="h-2.5 w-2.5 rounded-full border" style={{ borderColor: ink }} />
                  ))}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="block text-xs text-muted">{t.mood}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">Themes restyle the page. Your places, dates and custom stamp inks stay as they are.</p>
    </Section>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────

/** Tiny schematic of each preset. */
function PresetDiagram({ id }: { id: LayoutPreset }) {
  const boxes: Record<LayoutPreset, [number, number, number, number, number][]> = {
    scattered: [[6, 8, 14, 11, -8], [26, 6, 13, 13, 6], [12, 24, 15, 11, 4], [30, 25, 12, 12, -6]],
    passport: [[6, 6, 13, 10, 0], [25, 6, 13, 10, 0], [6, 26, 13, 10, 0], [25, 26, 13, 10, 0]],
    postcard: [[5, 5, 22, 20, -2], [30, 6, 11, 9, 4], [30, 19, 11, 9, -3], [7, 29, 12, 9, 3]],
    archive: [[8, 6, 10, 8, 0], [26, 6, 10, 8, 0], [8, 24, 10, 8, 0], [26, 24, 10, 8, 0]],
  };
  return (
    <svg viewBox="0 0 46 42" className="h-10 w-full text-burgundy" aria-hidden="true">
      {id === "passport" && <line x1="4" y1="21" x2="42" y2="21" stroke="currentColor" strokeDasharray="1 2" strokeWidth="0.6" />}
      {boxes[id].map(([x, y, w, h, r], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" transform={`rotate(${r} ${x + w / 2} ${y + h / 2})`} />
      ))}
      {id === "archive" &&
        [[13, 17], [31, 17], [13, 35], [31, 35]].map(([x, y]) => <line key={`${x}${y}`} x1={x - 4} y1={y} x2={x + 4} y2={y} stroke="currentColor" strokeWidth="0.8" />)}
    </svg>
  );
}

export function LayoutSection({ draft, collage }: SectionProps) {
  const manual = Object.keys(draft.studio.overrides[draft.studio.formatId]).length;
  return (
    <Section title="Layout">
      <OptionGroup
        name="layout"
        legend="Arrangement"
        columns={2}
        value={collage.resolved.preset}
        onChange={(preset) => studioActions.setPreset(preset)}
        options={LAYOUT_PRESETS.map((p) => ({ value: p.id, label: p.name, hint: p.description, visual: <PresetDiagram id={p.id} /> }))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={studioActions.shuffle}
          className="inline-flex items-center gap-2 rounded-sm border border-burgundy px-3 py-2 text-sm font-medium text-burgundy hover:bg-blush/40"
        >
          <Shuffle size={15} aria-hidden="true" /> Shuffle
        </button>
        <TextButton onClick={studioActions.resetLayout} disabled={manual === 0}>
          <RotateCcw size={13} aria-hidden="true" /> Reset {manual ? `${manual} moved ${manual === 1 ? "stamp" : "stamps"}` : "positions"}
        </TextButton>
      </div>
      {collage.pages.length > 1 && (
        <p className="text-xs text-muted">
          {collage.stats.stamps} stamps fill {collage.pages.length} pages, so every stamp stays readable.
        </p>
      )}
    </Section>
  );
}

// ── Background ──────────────────────────────────────────────────────────

export function BackgroundSection({ draft, collage }: SectionProps) {
  const { background } = draft.studio;
  const { resolved, theme } = collage;
  return (
    <Section title="Paper" action={<TextButton onClick={studioActions.resetBackground}>Reset to theme default</TextButton>}>
      <SwatchRow legend="Paper colour" value={background.paper} swatches={theme.paperSwatches} themeColor={theme.paper} onChange={(paper) => studioActions.setBackground({ paper })} />
      <Segmented<BackgroundTexture>
        legend="Texture"
        value={resolved.texture}
        options={[
          { value: "none", label: "Plain" },
          { value: "grain", label: "Grain" },
          { value: "aged", label: "Aged" },
          { value: "linen", label: "Linen" },
          { value: "dots", label: "Dots" },
          { value: "grid", label: "Grid" },
        ]}
        onChange={(texture) => studioActions.setBackground({ texture })}
      />
      <Segmented<BackgroundBorder>
        legend="Border"
        value={resolved.border}
        options={[
          { value: "none", label: "None" },
          { value: "hairline", label: "Hairline" },
          { value: "double", label: "Double" },
          { value: "airmail", label: "Airmail" },
          { value: "registration", label: "Crop marks" },
        ]}
        onChange={(border) => studioActions.setBackground({ border })}
      />
      <Toggle label={`Theme accent (${theme.accents === "postmark" ? "postmark" : theme.accents === "airmail" ? "air-mail label" : "colour bar"})`} checked={background.showAccents} onChange={(v) => studioActions.setBackground({ showAccents: v })} />
    </Section>
  );
}

// ── Selected stamp ──────────────────────────────────────────────────────

export function StampSection({
  draft,
  collage,
  selected,
  pagePlacements,
  onDeselect,
}: SectionProps & { selected: Placement | null; pagePlacements: readonly Placement[]; onDeselect: () => void }) {
  const sizeId = useId();
  const rotateId = useId();
  const { format } = collage;
  if (!selected) {
    const manual = Object.keys(draft.studio.overrides[draft.studio.formatId]).length;
    return (
      <Section title="Stamp">
        <p className="text-sm text-muted">Tap or click a stamp on the page to move, resize or rotate it. Keyboard: Tab to a stamp, then use the arrow keys.</p>
        <TextButton onClick={studioActions.resetLayout} disabled={manual === 0}>
          <RotateCcw size={13} aria-hidden="true" /> Reset all positions
        </TextButton>
      </Section>
    );
  }
  const stamp = collage.stamps.get(selected.id);
  const isManual = selected.id in draft.studio.overrides[draft.studio.formatId];
  const commit = (p: Placement, coalesce?: string) => studioActions.setOverride(p.id, overrideFromPlacement(p, format), coalesce);
  const zs = pagePlacements.map((p) => p.z);
  const widthPct = Math.round((selected.w / format.width) * 100);
  const aspect = selected.w / selected.h;

  return (
    <Section title={stamp?.model.name ?? "Stamp"} action={<TextButton onClick={onDeselect}>Done</TextButton>}>
      <div>
        <label htmlFor={sizeId} className={`${labelClass} flex justify-between`}>
          <span>Size</span>
          <span className="font-mono normal-case tracking-normal">{widthPct}% wide</span>
        </label>
        <input
          id={sizeId}
          type="range"
          min={6}
          max={85}
          step={1}
          value={widthPct}
          onChange={(e) => {
            const w = (Number(e.target.value) / 100) * format.width;
            commit({ ...selected, w, h: w / aspect }, `size:${selected.id}`);
          }}
          className="mt-2 w-full accent-[#793F57]"
        />
      </div>
      <div>
        <label htmlFor={rotateId} className={`${labelClass} flex justify-between`}>
          <span>Rotation</span>
          <span className="font-mono normal-case tracking-normal">{Math.round(selected.rotation)}°</span>
        </label>
        <input
          id={rotateId}
          type="range"
          min={-45}
          max={45}
          step={1}
          value={Math.max(-45, Math.min(45, Math.round(selected.rotation)))}
          onChange={(e) => commit({ ...selected, rotation: Number(e.target.value) }, `rotate:${selected.id}`)}
          className="mt-2 w-full accent-[#793F57]"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => commit({ ...selected, z: Math.max(...zs) + 1 })} className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 text-sm hover:border-burgundy">
          <ArrowUpToLine size={14} aria-hidden="true" /> Bring forward
        </button>
        <button type="button" onClick={() => commit({ ...selected, z: Math.min(...zs) - 1 })} className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 text-sm hover:border-burgundy">
          <ArrowDownToLine size={14} aria-hidden="true" /> Send backward
        </button>
        <button
          type="button"
          onClick={() => studioActions.clearOverride(selected.id)}
          disabled={!isManual}
          className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 text-sm hover:border-burgundy disabled:opacity-40"
        >
          <LocateFixed size={14} aria-hidden="true" /> Reset position
        </button>
      </div>
    </Section>
  );
}

// ── Format ──────────────────────────────────────────────────────────────

export function FormatSection({ draft, collage, onExport }: SectionProps & { onExport: () => void }) {
  const empty = collage.stamps.size === 0;
  return (
    <Section title="Format & export">
      <OptionGroup<CollageFormatId>
        name="format"
        legend="Size"
        columns={2}
        value={draft.studio.formatId}
        onChange={studioActions.setFormat}
        options={FORMAT_LIST.map((f) => ({
          value: f.id,
          label: f.name,
          hint: `${f.ratioLabel} · ${f.width}×${f.height}`,
          visual: (
            <span className="flex h-10 items-center" aria-hidden="true">
              <span className={`block border-2 border-burgundy ${f.id === "story" ? "h-9 w-5" : "h-7 w-7"}`} />
            </span>
          ),
        }))}
      />
      <p className="text-xs text-muted">Story and Square remember their own hand-placed stamps.</p>
      <button
        type="button"
        onClick={onExport}
        disabled={empty}
        className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-burgundy px-4 py-3 text-sm font-medium text-ivory hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download size={16} aria-hidden="true" /> Save or share as PNG
      </button>
      {empty && <p className="text-xs text-muted">Add at least one stamp to save your passport.</p>}
    </Section>
  );
}
