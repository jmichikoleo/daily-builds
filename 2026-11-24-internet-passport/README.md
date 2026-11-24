# internet passport

the internet is a world worth exploring.

what if exploring the internet felt like travelling around the world? you get a passport from the department of internet exploration (fictional), then collect stamps by visiting strange, lovely and useful corners of the web. there are expeditions, hidden places, a travel journal and a little ceremony every time a stamp lands.

live at **https://jmichikoleo.github.io/internet-passport/**

## what is inside

- **departure hall** with your closed passport, today's destination, a split flap departure board, a surprise me button that hands you a sealed mystery boarding pass, and this week's expedition
- **world atlas** drawn as eight made up continents plus a fog bank of secrets, with a list view for anyone who prefers words, and a destination directory with search and filters for territory, rarity, status and tags
- **my passport** as a booklet you open and flip through (buttons, arrow keys or swipe), an identity page with your photo and a decorative machine readable zone, stamp pages where stamps land a little crooked, an all stamps view, and png export of the identity card or the whole stamp sheet
- **expeditions** with 12 illustrated travel posters, one featured each week by calendar maths, all of them open forever
- **travel journal** of postcards you can write, edit and delete, plus a shelf called places i want to return to
- **explorer profile** with stats, titles, territory progress, achievements, exploration history and settings (motion, sound, backup, restore, start over)

### the travel flow

pick a destination, get a personalised boarding pass, depart (the site opens in a new tab), come back, confirm the visit, answer a small optional question, and watch the stamp land. it runs on the honour system. opening a link proves nothing and the app does not pretend otherwise. each place gives one stamp, ever.

### numbers

- 109 curated destinations (98 in eight territories, 11 hidden)
- 141 collectible stamps (109 destinations, 11 achievements, 12 expeditions, 8 territory completions, 1 welcome stamp)
- 4 rarities. common, rare, legendary and secret
- 12 expeditions
- every stamp has its own shape and glyph pair. 14 shapes, 6 border styles, 122 hand drawn glyphs. a test fails if two stamps ever share a design

### secrets

hidden destinations open when you do something. visit a few places in one territory, cross five borders, finish an expedition, write postcards, collect a certain trio of stamps, or poke at something on the page that looks like decoration. before that you only get a rumour. they live in the browser, so anyone could read the code to find them. it is more fun not to.

## privacy

no accounts, no backend, no analytics, no tracking. fonts are bundled. your passport, photo, stamps and journal live in this browser's localStorage. your photo is shrunk to a small jpeg in a canvas and never uploaded. backups are plain json files you download yourself.

## run it

```bash
npm install
npm run dev
```

opens on http://localhost:5330

```bash
npm run check
```

typecheck, lint, unit tests and a production build in one go.

```bash
npm run e2e
```

playwright tests against the production build, using the installed google chrome. they cover onboarding to the first stamp, no duplicate stamps, a full expedition, secret unlocks, the journal, favourites, backup and restore, damaged storage, every section, and a phone layout.

```bash
npm run links
```

opens every destination url and lists anything broken. a few sites sit behind bot checks and answer 403 to scripts, those are listed separately for a look in a real browser.

## how it is built

vite, react 19 and typescript. no router library, no state library.

```
src/
  types.ts              every data shape
  data/                 curated content, never changed at runtime
    territories.ts
    destinations.ts     the directory
    expeditions.ts
    achievements.ts
    stamps.ts           the stamp catalog, built from the files above
  lib/
    logic.ts            all game rules as plain functions (visits, unlocks, achievements, calendar)
    storage.ts          versioned localStorage, sanitising, backup and restore
    store.tsx           react context, saves on every change, queues award ceremonies
    router.ts           tiny hash router so it works on any static host
    image.ts            photo resizing
    exportImage.ts      png export, loaded only when used
  components/           stamp renderer, glyphs, boarding pass, cards, nav, ceremony
  pages/                one file per section
tests/                  vitest, rules and data and storage
e2e/                    playwright
```

curated content and your data are kept apart. saved data has a `schemaVersion`. anything loaded from storage or a backup file goes through `sanitize()`, which keeps what is valid and drops the rest. unreadable storage is set aside under a separate key instead of being overwritten.

## adding a destination

open `src/data/destinations.ts`, find the territory, copy an entry and change it.

```ts
{
  id: "my-new-place",              // stable forever, saved passports point at it
  name: "My New Place",
  url: "https://example.org",
  description: "your own words about why it is worth the trip.",
  tags: ["maps", "calm"],
  minutes: 10,
  rarity: "rare",                  // optional, defaults to common
  warnings: ["audio"],             // optional
  access: { kind: "account-optional", text: "browsing is open" }, // optional
  s: ["hexagon", "compass", "dashed", "my new place"], // shape, glyph, border, stamp label
  question: "what did you find there?",
},
```

the shape and glyph pair has to be unused. glyphs live in `src/components/glyphs.tsx`, add a new one there if nothing fits. run `npm test` and it will tell you about clashes, missing glyphs or bad ids. never rename an existing id.

for a hidden destination add it to the `hidden` list with a `secret` block, a hint and an unlock rule (see `UnlockCondition` in `src/types.ts`).

## adding an expedition

append to `src/data/expeditions.ts` with the next number and a new id. give it 3 to 5 destination ids, a poster (sky colour, ground colour, glyph) and its own stamp design. do not reorder the list, the weekly rotation walks through it in order.

## deploy

the app is static. it builds to `dist/` with relative paths, so it works from any folder.

```bash
npm run build
```

it is served from github pages by the public repo `jmichikoleo/internet-passport`, which holds only the built files. to update it, build here, copy `dist/` into a clone of that repo and push.

## known limitations

- visits are honour based. there is no way to know you really explored a site, and that is on purpose
- progress lives in one browser. use backup and restore to move it
- the curated links were checked on 24 nov 2026. websites change, `npm run links` helps spot the ones that broke
- a few destinations show ads or ask for optional accounts. those are labelled on their cards
