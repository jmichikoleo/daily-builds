import type { CSSProperties } from "react";
import { Stamp } from "@/components/stamps/Stamp";
import { LEGACY_PLACES } from "@/lib/catalog/legacy";
import { composeStamp } from "@/lib/collage/compose";
import type { CollectionEntry } from "@/lib/passport/types";
import type { StampStyle } from "@/lib/stamps/types";

const SAMPLE_YEAR = 2026;

interface HeroStamp {
  /** A Phase 1 place id; its snapshot comes from the legacy table, so no catalog is loaded here. */
  legacyId: string;
  visit?: string;
  style: StampStyle;
  ink: string;
  /** Position on the page, as CSS percentages. */
  position: CSSProperties;
  rotate: number;
}

/** One stamp of each style, laid out by hand. */
const HERO_STAMPS: readonly HeroStamp[] = [
  { legacyId: "city:kr-seoul", visit: "2026-01", style: "immigration", ink: "#793F57", rotate: -7, position: { left: "4%", top: "9%", width: "38%" } },
  { legacyId: "city:jp-tokyo", visit: "2026-04-12", style: "border", ink: "#2F4A6D", rotate: 5, position: { right: "3%", top: "7%", width: "50%" } },
  { legacyId: "city:fr-paris", visit: "2026-06", style: "entry", ink: "#A23B3B", rotate: -3, position: { left: "6%", top: "41%", width: "48%" } },
  { legacyId: "region:HK", visit: "2026-08-03", style: "doubleRing", ink: "#3F6B4E", rotate: 9, position: { right: "3%", top: "38%", width: "35%" } },
  { legacyId: "city:es-barcelona", visit: "2026-09", style: "postage", ink: "#C8879E", rotate: 4, position: { left: "9%", bottom: "4%", width: "28%" } },
  { legacyId: "city:id-jakarta", visit: "2026-12", style: "editorial", ink: "#302B2E", rotate: -5, position: { right: "4%", bottom: "8%", width: "50%" } },
];

function heroEntry(s: HeroStamp): CollectionEntry | null {
  const legacy = LEGACY_PLACES[s.legacyId];
  if (!legacy) return null;
  return {
    id: `hero-${s.legacyId}`,
    placeId: legacy.placeId,
    place: legacy.place,
    visit: s.visit ? { precision: s.visit.length === 7 ? "month" : "day", date: s.visit } : { precision: "unknown" },
    design: { variant: 0, style: s.style, ink: s.ink, showDate: true },
  };
}

/** The landing-page collage, built from the same stamp components the studio uses. */
export function HeroCollage() {
  return (
    <figure className="relative mx-auto w-full max-w-[520px]">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[3px] border border-line bg-paper shadow-[0_30px_60px_-30px_rgba(121,63,87,0.45),0_2px_0_rgba(48,43,46,0.04)]">
        {/* Page furniture */}
        <div className="absolute inset-3 border border-burgundy/15" aria-hidden="true" />
        <div className="absolute left-5 right-5 top-5 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-muted sm:text-[11px]" aria-hidden="true">
          <span>PASSPORT · {SAMPLE_YEAR}</span>
          <span>PAGE 07</span>
        </div>
        <div className="absolute -right-6 top-[30%] h-7 w-28 rotate-[38deg] bg-blush/80" aria-hidden="true" />

        {HERO_STAMPS.map((s, i) => {
          const entry = heroEntry(s);
          if (!entry) return null;
          const { model, design } = composeStamp(entry, SAMPLE_YEAR, [s.ink]);
          return (
            <div
              key={s.legacyId}
              className="lift absolute"
              style={{ ...s.position, transform: `rotate(${s.rotate}deg)`, "--lift-rotate": `${s.rotate}deg`, zIndex: i } as CSSProperties}
            >
              <Stamp model={model} design={design} className="h-auto w-full" />
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 text-center font-mono text-[11px] tracking-[0.18em] text-muted">
        SAMPLE PASSPORT PAGE
      </figcaption>
    </figure>
  );
}
