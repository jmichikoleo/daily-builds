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

## the studio

the studio is where i add, edit and delete recipes. it runs on my mac mini all the time and only opens on devices signed in to my tailscale, so nobody else can get in.

https://josephas-mac-mini.tailb457cb.ts.net:8490

- add. tap + new recipe, fill it in, tap add recipe
- edit. open a recipe and tap edit
- delete. open a recipe and tap delete, it asks first
- picture. pick a drawing, or add a photo from your phone. photos get shrunk before they upload
- publish. tap publish, then publish now. it builds the site, puts it on mochis-recipe-book.netlify.app and saves the recipes and photos to github. a dot next to publish means there are changes that aren't live yet

the live site never has any of these buttons.

the studio is a launchd service called com.mochi.recipe-studio. it writes its log to ~/Library/Logs/recipe-studio.log

```bash
launchctl kickstart -k gui/$(id -u)/com.mochi.recipe-studio
```

restarts it after code changes. `npm run studio` runs the same thing by hand, and `npm run dev` runs it on localhost:5280 for working on the code.

## editing the file by hand

everything lives in `src/recipes.js`. the comment at the top shows every field.

- `slug` is the link name, like `#/recipe/mochi-brownies`
- `category` can be anything. sweet and savory always show first, new ones get their own section
- `subtitle`, `note`, `photo`, `art`, `featured` and `draft` are optional
- `art` is the drawing. chocolate, whisk, pot, ricebowl, bread or plate. leave it out and sweet gets the whisk, savory gets the pot, anything else gets the plate
- leave an ingredient amount empty and it shows as amount tbd

saving from the studio rewrites the whole file, so comments you add inside a recipe won't stay.

## what's where

- `src/recipes.js` the recipes
- `src/lib.js` search, grouping and favorites
- `src/editor.js` the studio screens
- `src/serialize.js` writes the recipes back into the file
- `studio/plugin.js` the studio's save, photo and publish backend
- `src/main.js` the pages and the little router
- `src/style.css` colors and layout
- `src/art.js` the line drawings
- `tests/` tests

favorites are saved in the browser, so they stay on the device you saved them on.
