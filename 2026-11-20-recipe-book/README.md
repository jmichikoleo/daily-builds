# mochi's recipe book

a small cookbook i made for myself. strawberry pink, butter yellow, one chocolate drawing.

## run it

```bash
npm install
npm run dev
```

then open http://localhost:5280

```bash
npm run check
```

runs the tests and makes the production build in `dist/`. the build is plain static files, so `dist/` can go on netlify or any static host as is.

## add a recipe

everything lives in `src/recipes.js`. copy the brownie entry, change the fields, save. the comment at the top of that file shows every field.

- `slug` becomes the link, like `#/recipe/mochi-brownies`
- `category` can be anything. sweet and savory always show first, new ones get their own section
- `subtitle`, `note`, `photo`, `featured` and `draft` are optional
- leave an ingredient `amount` empty and it shows as amount tbd
- photos go in `public/photos/` and are referenced like `photo: "photos/brownies.jpg"`

## what's where

- `src/recipes.js` the recipes
- `src/lib.js` search, grouping and favorites
- `src/main.js` the pages and the little router
- `src/style.css` colors and layout
- `src/chocolate.js` the line drawing
- `tests/lib.test.js` tests

favorites are saved in the browser, so they stay on the device you saved them on.
