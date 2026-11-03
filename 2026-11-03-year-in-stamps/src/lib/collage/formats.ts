export type CollageFormatId = "story" | "square";

export interface CollageFormat {
  id: CollageFormatId;
  name: string;
  ratioLabel: string;
  /** Canvas size in collage units (equal to export pixels later). */
  width: number;
  height: number;
}

export const COLLAGE_FORMATS: Record<CollageFormatId, CollageFormat> = {
  story: { id: "story", name: "Story", ratioLabel: "9:16", width: 1080, height: 1920 },
  square: { id: "square", name: "Square", ratioLabel: "1:1", width: 1080, height: 1080 },
};

export const FORMAT_LIST: readonly CollageFormat[] = [COLLAGE_FORMATS.story, COLLAGE_FORMATS.square];

export function isFormatId(value: unknown): value is CollageFormatId {
  return typeof value === "string" && value in COLLAGE_FORMATS;
}
