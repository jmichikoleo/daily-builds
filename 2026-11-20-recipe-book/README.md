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

## add, edit or delete a recipe

the easy way is the editor. it only shows up while `npm run dev` is running, because saving writes into `src/recipes.js` on your computer. the live site stays read only.

- add. tap + new recipe in the header, fill it in, tap add recipe
- edit. open a recipe and tap edit, change what you want, tap save changes
- delete. open a recipe and tap delete, it asks first

when you're happy, commit and push like normal so the live site gets the new recipes.

you can also edit `src/recipes.js` by hand. the comment at the top of that file shows every field.

- `slug` is the link name, like `#/recipe/mochi-brownies`
- `category` can be anything. sweet and savory always show first, new ones get their own section
- `subtitle`, `note`, `photo`, `featured` and `draft` are optional
- leave an ingredient amount empty and it shows as amount tbd
- photos go in `public/photos/` and are written like `photo: "photos/brownies.jpg"`

saving from the editor rewrites the whole file, so comments you add inside a recipe won't stay.

## what's where

- `src/recipes.js` the recipes
- `src/lib.js` search, grouping and favorites
- `src/editor.js` the add and edit screens
- `src/serialize.js` writes the recipes back into the file
- `vite.config.js` the little save endpoint the editor talks to
- `src/main.js` the pages and the little router
- `src/style.css` colors and layout
- `src/chocolate.js` the line drawing
- `tests/lib.test.js` tests

favorites are saved in the browser, so they stay on the device you saved them on.
