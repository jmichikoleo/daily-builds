import { renderToStaticMarkup } from "react-dom/server";
import { CollageCanvas } from "@/components/collage/CollageCanvas";
import type { ComposedCollage } from "../collage/compose";

/**
 * The exact SVG the studio shows for a page, without editing handles.
 * Same component, same data: the export is the preview.
 */
export function renderPageMarkup(collage: ComposedCollage, pageIndex: number): string {
  return renderToStaticMarkup(<CollageCanvas data={collage} pageIndex={pageIndex} />);
}
