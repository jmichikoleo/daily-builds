# mochi's recipe book

a small cookbook i made for myself. strawberry pink, butter yellow, little line drawings.

## what it does

- shelf. recipes grouped by category, filtered by collections like bakes or things to try, searched by name or ingredient
- recipe pages. ingredients, steps, servings, notes and a link back to the original recipe
- my versions. copy a recipe, change the amounts, write down how it turned out. versions sit under the original
- cook mode. tick off ingredients, then one step at a time with big text and big buttons. the screen stays on and it remembers where you were
- favorites saved on your phone
- add it to your home screen and it opens like an app, even with bad wifi

## run it

```bash
npm install
npm run dev
```

then open http://localhost:5280

```bash
npm run check
```

runs the tests and makes the production build in `dist/`. the build is plain static files, so `dist/` can go on any static host as is.

## the studio

the studio is where i add, edit and delete recipes. it runs on my mac mini all the time and only opens on devices signed in to my tailscale, so nobody else can get in.

open the mac mini's tailscale address on port 8490.

- add. tap + new recipe, fill it in, tap add recipe
- quick save. tap quick save a link or an idea on the home page. it goes into things to try as a draft
- make a version. open a recipe and tap make a version
- edit. open a recipe and tap edit
- delete. open a recipe and tap delete, it asks first
- picture. pick a drawing, or add a photo from your phone. photos get shrunk before they upload
- publish. tap publish, then publish now. it builds the site, puts it on github pages at jmichikoleo.github.io/mochis-recipe-book and saves the recipes and photos to github. a dot next to publish means there are changes that aren't live yet. the live site updates about a minute after it says done

the built site lives in its own repo, jmichikoleo/mochis-recipe-book, and publish expects a clone of it at ~/Developer/mochis-recipe-book-site

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
- `subtitle`, `note`, `photo`, `art`, `servings`, `source`, `collections`, `basedOn`, `outcome`, `featured` and `draft` are optional
- `collections` is a list, like `["Bakes", "Things to Try"]`
- `basedOn` is the link name of the recipe this one is a version of
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
- `src/cook.js` cook mode
- `public/sw.js` and `public/manifest.webmanifest` home screen and offline
- `tests/` tests

favorites are saved in the browser, so they stay on the device you saved them on.
