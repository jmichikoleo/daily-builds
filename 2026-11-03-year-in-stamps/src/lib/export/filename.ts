import type { CollageFormatId } from "../collage/formats";

/** ASCII, lowercase, hyphenated, safe on every filesystem. */
export function slugify(value: string, max = 32): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** "my-2026-passport-story.png", "mochi-2026-passport-square-page-2.png". */
export function exportFilename(opts: { nickname: string; year: number; format: CollageFormatId; page?: number; pages?: number; ext?: "png" | "zip" }): string {
  const who = slugify(opts.nickname) || "my";
  const page = opts.pages && opts.pages > 1 && opts.page ? `-page-${opts.page}` : "";
  const all = opts.ext === "zip" ? "-all-pages" : "";
  return `${who}-${opts.year}-passport-${opts.format}${page}${all}.${opts.ext ?? "png"}`;
}
