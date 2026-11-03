"use client";

import { Frame, Image as ImageIcon, LayoutGrid, Palette, Stamp as StampIcon, Type, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { LoadingPassport } from "@/components/site/LoadingPassport";
import { composeCollage } from "@/lib/collage/compose";
import { usePassport } from "@/lib/passport/store";
import { studioActions } from "@/lib/studio/store";
import { CanvasEditor } from "./CanvasEditor";
import { ExportDialog } from "./ExportDialog";
import { BackgroundSection, FormatSection, LayoutSection, StampSection, TextSection, ThemeSection, type SectionProps } from "./sections";

type PanelId = "text" | "theme" | "layout" | "paper" | "stamp" | "format";

const PANELS: { id: PanelId; label: string; icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }> }[] = [
  { id: "text", label: "Words", icon: Type },
  { id: "theme", label: "Theme", icon: Palette },
  { id: "layout", label: "Layout", icon: LayoutGrid },
  { id: "paper", label: "Paper", icon: ImageIcon },
  { id: "stamp", label: "Stamp", icon: StampIcon },
  { id: "format", label: "Format", icon: Frame },
];

/** True when typing in a field, where Ctrl/⌘ Z should stay the field's own undo. */
function isEditingText(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export function Studio() {
  const snapshot = usePassport();
  const draft = snapshot.status === "ready" ? snapshot.draft : null;
  const collage = useMemo(() => (draft ? composeCollage(draft) : null), [draft]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [exporting, setExporting] = useState(false);

  // Undo / redo shortcuts, and Escape to close the mobile panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && panel) {
        setPanel(null);
        return;
      }
      if (!(e.metaKey || e.ctrlKey) || isEditingText(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        studioActions.undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        studioActions.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);

  if (!draft || !collage) return <LoadingPassport label="Setting up the studio…" />;

  const page = collage.pages[Math.min(pageIndex, collage.pages.length - 1)];
  const openExport = () => {
    setPanel(null);
    setSelectedId(null);
    setExporting(true);
  };
  const selected = selectedId ? (page.layout.placements.find((p) => p.id === selectedId) ?? null) : null;
  const props: SectionProps = { draft, collage };

  const renderPanel = (id: PanelId) => {
    switch (id) {
      case "text":
        return <TextSection {...props} />;
      case "theme":
        return <ThemeSection {...props} />;
      case "layout":
        return <LayoutSection {...props} />;
      case "paper":
        return <BackgroundSection {...props} />;
      case "stamp":
        return <StampSection {...props} selected={selected} pagePlacements={page.layout.placements} onDeselect={() => setSelectedId(null)} />;
      case "format":
        return <FormatSection {...props} onExport={openExport} />;
    }
  };

  const emptyNotice = collage.stamps.size === 0 && (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-dashed border-rose/60 bg-blush/20 px-3 py-2 text-sm">
      <span>Your passport is still empty.</span>
      <Link href="/create" className="rounded-sm bg-burgundy px-3 py-1.5 text-xs font-medium text-ivory hover:bg-charcoal">
        Add destinations
      </Link>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] flex-1 px-4 [--canvas-height:calc(100svh-15rem)] sm:px-6 lg:grid lg:grid-cols-[23rem_minmax(0,1fr)] lg:gap-10 lg:[--canvas-height:calc(100svh-11rem)]">
      {/* Desktop editing panel */}
      <aside aria-label="Collage settings" className="hidden lg:block lg:sticky lg:top-0 lg:h-[calc(100svh-4rem)] lg:overflow-y-auto lg:py-6 lg:pr-2">
        <h1 className="font-serif text-3xl tracking-tight">
          The <span className="italic text-burgundy">studio.</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          {collage.stats.stamps} stamps ·{" "}
          <Link href="/create" className="text-burgundy underline-offset-4 hover:underline">
            edit collection
          </Link>
        </p>
        <div className="mt-6 space-y-8 divide-y divide-line [&>*:not(:first-child)]:pt-8">
          {selected && renderPanel("stamp")}
          {renderPanel("text")}
          {renderPanel("theme")}
          {renderPanel("layout")}
          {renderPanel("paper")}
          {!selected && renderPanel("stamp")}
          {renderPanel("format")}
        </div>
        <p className="mt-8 border-t border-line pt-4 text-xs text-muted">
          Your design is saved in this browser only.{" "}
          <Link href="/privacy" className="text-burgundy underline underline-offset-2">
            Privacy &amp; your data
          </Link>
        </p>
      </aside>

      {/* Canvas */}
      <section aria-label="Collage canvas" className="flex flex-col pb-20 pt-3 lg:pb-6 lg:pt-6">
        <h1 className="sr-only lg:hidden">Collage studio</h1>
        {emptyNotice}
        <CanvasEditor
          collage={collage}
          pageIndex={page.index}
          onPageChange={(i) => {
            setPageIndex(i);
            setSelectedId(null);
          }}
          selectedId={selectedId}
          onSelect={onSelect}
          onExport={openExport}
          compact
        />
      </section>

      {exporting && <ExportDialog collage={collage} nickname={draft.nickname} initialPage={page.index} onClose={() => setExporting(false)} />}

      {/* Mobile: expandable panel + bottom toolbar */}
      {panel && (
        <div
          role="dialog"
          aria-label={PANELS.find((p) => p.id === panel)?.label}
          className="fixed inset-x-0 bottom-[3.75rem] z-40 max-h-[52svh] overflow-y-auto overscroll-contain rounded-t-md border-t border-line bg-ivory px-4 pb-6 pt-3 shadow-[0_-16px_32px_-20px_rgba(48,43,46,0.45)] lg:hidden"
        >
          <div className="sticky top-0 -mx-4 mb-2 flex justify-end bg-ivory px-2">
            <button type="button" onClick={() => setPanel(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted hover:text-burgundy" aria-label="Close panel">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {renderPanel(panel)}
        </div>
      )}
      <nav aria-label="Editing tools" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ivory/95 backdrop-blur-sm lg:hidden">
        <ul className="mx-auto grid h-[3.75rem] max-w-lg grid-cols-6">
          {PANELS.map(({ id, label, icon: Icon }) => {
            const active = panel === id;
            const flag = id === "stamp" && !!selected;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-expanded={active}
                  onClick={() => setPanel(active ? null : id)}
                  className={`relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${active ? "text-burgundy" : "text-muted"}`}
                >
                  <Icon size={18} aria-hidden={true} />
                  {label}
                  {flag && <span className="absolute right-[30%] top-2 h-1.5 w-1.5 rounded-full bg-burgundy" aria-hidden="true" />}
                  {active && <span className="absolute inset-x-3 top-0 h-0.5 bg-burgundy" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
