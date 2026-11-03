# Your Year in Stamps

A digital travel passport collage generator. Pick a year, collect illustrated stamps for the places you went, and arrange them into a collage sized for Instagram Stories.

**Status:** MVP (Phase 4: export, sharing, launch readiness). No account, database, analytics or external APIs. Drafts live in the browser's localStorage, and images are made on the device.

## Run locally

```bash
npm install
npm run dev -- --port 3500
```

Open http://localhost:3500.

```bash
npm run lint       # ESLint
npx tsc --noEmit   # type check
npm test           # unit tests (Vitest)
npm run e2e        # browser tests (Playwright + your installed Google Chrome; builds, then serves out/ with Netlify's dev server on :3510)
npm run build      # production build
npm run catalog    # rebuild public/data/catalog.v1.json (see DATA_SOURCES.md)
node scripts/og-image.mjs   # after a build: regenerate src/app/opengraph-image.png from the landing hero
```

`npm run e2e` writes the PNGs it exports to `e2e-output/` (git-ignored) so they can be inspected.

## Routes

| Route     | What it does |
| --------- | ------------ |
| `/`       | Landing page; the hero collage shows all six stamp styles |
| `/create` | Year and nickname, destination search, collection with stats, stamp editor |
| `/studio` | Collage studio: themes, layout presets, shuffle, drag/resize/rotate stamps, text and paper controls, undo/redo, pages, PNG export and sharing |
| `/privacy` | How data is handled, credits, and "Clear My Data" |

## Code map

```
scripts/build-catalog.mjs  GeoNames + Natural Earth → public/data/catalog.v1.json
src/lib/catalog/        Place types, lazy loader, search index, snapshots, motifs, Phase 1 id map
src/lib/passport/       Draft model (entries, visits, design config), store, visit rules
src/lib/persistence/    Versioned localStorage (v3), v1/v2 migration, validation, backups
src/lib/stamps/         Six stamp styles, motifs, deterministic design, text fitting
src/lib/collage/        Formats, frame (header/footer/safe area), layout engine (4 presets, pages), compose, stats
src/lib/studio/         Studio design model (v4), studio actions + bounded undo/redo history
src/lib/themes/         Classic Passport / Pink Postcard / Editorial Atlas, font pairings
src/components/create/  PlaceSearch, CollectionPanel, StampEditor, DraftNotice
src/components/stamps/  StampGraphic (all six styles as SVG), Stamp, MotifIcon
src/components/collage/ CollageCanvas (one SVG per page, static or interactive), CollageBackground
src/components/studio/  Studio shell, CanvasEditor (pointer + keyboard editing), ExportDialog, sections, controls
src/lib/export/         SVG → PNG export (fonts embedded), share/download, ZIP writer, filenames
e2e/                    Playwright end-to-end tests
```

### Key decisions

- **Catalog:** 250 countries and territories plus about 31,600 cities from GeoNames, with Natural Earth deciding which ones are territories and of which state (Hong Kong → territory of China). See [DATA_SOURCES.md](DATA_SOURCES.md). The JSON is fetched lazily on `/create` only, then indexed in memory. Search is accent- and case-insensitive, matches word prefixes, alternate spellings, "city country" queries and one-letter typos, and runs off `useDeferredValue`.
- **Entries, not destinations:** each stamp is a `CollectionEntry` with its own id, a catalog `placeId`, a **snapshot** of the place (so the studio never needs the catalog), a visit record (`unknown` / `month` / `day`) and a design config (`variant`, optional `style`, `ink`, `showDate`).
- **Duplicates:** adding a collected place again is refused. "Another visit" is a separate, explicit action, and repeat visits get the next design variant. A double-click on "Add" can't turn into a second visit.
- **Year changes never delete anything:** dates outside the passport year are flagged with a fix-it banner. Until they're fixed, the collage prints the passport year for them.
- **Deterministic stamps:** style, border, ink, tilt and serial come from a hash of `placeId#variant`. "Regenerate details" bumps the variant; explicit style/ink choices win. Text is fitted without DOM measurement (one or two lines, then `textLength` compression), so long names never clip.
- **Persistence:** schema v4 (v3 drafts move `title`/`themeId`/`formatId` into `studio`). v1/v2 drafts migrate on load: Phase 1 demo ids map to catalog ids, and unknown ids are kept as *unresolved* entries the user can re-point with "Find a match". The original data is copied to a backup key before the first save. Nothing is written on load.
- **One renderer:** `composeCollage(draft)` is pure. It resolves theme defaults, computes the frame (title, footer and a stamp safe area), paginates, lays out each page and applies manual placements. `CollageCanvas` draws it as SVG in 1080-wide canvas units. The editor passes an `interaction` prop for handles and pointer events; without it, the same component is the static render a PNG export will rasterise.
- **Layout presets:** Scattered Memories, Passport Pages, Postcard Wall (2×2 "hero" stamps placed by occupancy grid) and Minimal Archive (grid with captions). Each is seeded. Shuffle bumps the seed. Every stamp's rotated box is clamped inside the safe area. Large collections use several pages (`PAGE_CAPACITY`) instead of shrinking stamps.
- **Manual placement:** stored per format as normalised `{x, y, w, rotation, z}` and clamped to the canvas. Drags update local state and commit once on release.
- **History:** whole `StudioDesign` snapshots, at most 60, in memory. Rapid edits sharing a key (typing, sliders, arrow-key nudges) merge into one entry.
- **Theme defaults:** text style, paper, texture, border and layout fields left `undefined` follow the theme, so switching theme restyles the collage while explicit choices (and each stamp's custom ink and style) survive.

## Export

`src/lib/export` turns the **same** `CollageCanvas` component the studio shows into a PNG, with no second renderer:

1. `renderToStaticMarkup(<CollageCanvas />)` renders the page as an SVG string, without the editing handles.
2. CSS variables (`var(--font-…)`) are resolved to real family names.
3. The fonts the page actually uses are read from the app's own `@font-face` rules. Only the families and unicode subsets present in the text are kept. Each woff2 file is fetched once and inlined as a data URL in a `<style>` inside the SVG.
4. The SVG (explicit 1080×1920 or 1080×1080) is drawn on a canvas of exactly that size and encoded with `toBlob("image/png")`. It holds only inline data, so the canvas is never tainted.

Failures raise an `ExportError` with a readable message: an empty passport, unsupported browser, fonts that can't be loaded (we stop rather than export with substitute lettering), an image that won't decode, or a canvas that is refused.

The export dialog generates the PNG as soon as it opens and shows **that file** as the preview, so the preview is the export. Because the file is ready in advance, "Share My Passport" opens the share sheet within the tap, as browsers require. Large collections export as one PNG per page, or all pages in one `.zip` written by a small built-in STORE-mode zip writer (no dependency).

**Sharing:** "Share My Passport" appears only when `navigator.canShare({ files })` is true, which is typically mobile Safari and Chrome on Android. A closed share sheet counts as a cancellation, not an error. Anything else shows an error and points to "Save My Passport". A website can't post to Instagram Stories directly; users pick Instagram in the share sheet if their phone offers it, or save the image and add it from their photos.

## Privacy

- No account, no server-side storage, no analytics, no location access, no third-party requests. Fonts are self-hosted by `next/font` and the destination catalog is a static file.
- The draft lives in `localStorage` under keys starting with `year-in-stamps:`. Clearing browser data, private windows or storage eviction can delete it; the app says so on `/create`, `/studio` and `/privacy`.
- "Clear My Data" (`/privacy`) removes only `year-in-stamps:*` keys, after a confirmation.
- Site metadata and the Open Graph image are static and brand-only; nothing about a user's travels is ever put in them.

## Deployment

The site is a **static export** (`output: "export"`): `npm run build` writes plain files to `out/`, with no server needed. Security headers and clean URLs (`/create`, `/studio`, `/privacy`) are in `public/_headers` and `public/_redirects`, which are copied into `out/`.

- **Netlify Drop:** build with the site's address, then drag the `out` folder onto https://app.netlify.com/drop.
  ```bash
  NEXT_PUBLIC_SITE_URL=https://your-site.netlify.app npm run build
  ```
- **Netlify CLI or Git:** `netlify.toml` sets `npm run build` → `out` on Node 22. On Netlify builds the site address is detected automatically.
- **Any static host:** serve `out/` and map `/create` → `create.html` (and the same for the other pages) the way `_redirects` does.

`NEXT_PUBLIC_SITE_URL` (see `.env.example`) makes Open Graph URLs absolute. No secrets are needed.

## Credits and licences

- Place data: [GeoNames](https://www.geonames.org/) (CC BY 4.0, attribution shown in the footer and on `/privacy`) and [Natural Earth](https://www.naturalearthdata.com/) (public domain). See [DATA_SOURCES.md](DATA_SOURCES.md).
- Typefaces (via `next/font`, self-hosted): Fraunces, Inter, Oswald, DM Mono, Cormorant Garamond and Space Grotesk, all under the SIL Open Font License 1.1.
- Icons: [Lucide](https://lucide.dev/) (ISC).

## Known limitations

- Drafts are per browser and per device; there is no sync or cloud backup.
- Destinations: places with fewer than 15,000 people aren't included, and search is Latin-script only.
- Export is tested in desktop Chrome (Playwright) and with mocked Web Share. Safari and Firefox rasterisation and real share sheets on iOS and Android still need manual device testing.
- Undo/redo history isn't kept across reloads.
- A local build without `NEXT_PUBLIC_SITE_URL` falls back to `http://localhost:3000` for Open Graph URLs, so set it when building for upload.
