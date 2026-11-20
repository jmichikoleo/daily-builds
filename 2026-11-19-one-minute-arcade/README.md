# one minute arcade

Little games. Big nonsense.

six little games. sixty seconds each. absolutely no idea what happens next.
it all runs in the browser, saves to localStorage and needs no backend, no account and no api keys.

## the games

**star catcher** is a basket and a night sky. golden stars are +10, blue stars with a ring are +25, rainbow stars are +50 and the spiky red ones take 15 away. the sky gets busier at 15s, faster at 30s and starts swerving at 45s. arrow keys or a and d, the mouse, or drag with a finger.

**panic button** is a machine with heat, pressure and power gauges that all want to go wrong at once. hold cool (q), open and shut the valve (w) and tap reset (e) when the power gets buzzy. you get points every second all three stay green, a bonus for rescuing a gauge from the red and a streak bonus every five clean seconds. if something hits the top the machine goes ka-blooey, costs you 50 and reboots, but the game keeps going.

**frog traffic** is a frog and a pond full of drifting lily pads. landing on a new row is +5 and the far bank is +40, plus 10 more for every level. each crossing makes the pads faster and smaller, and from level 2 some of them bubble and sink for a moment. every level is generated so it can actually be crossed. arrow keys or wasd, or the big buttons under the pond.

**wrong delivery** is a toy factory conveyor belt. every parcel has a sticker with an apple, a ringed planet or a sparkle, and you send it to the food, space or magic door with 1, 2, 3 or a tap. right door is +10 times your combo, wrong door is -5, a parcel that falls off the end is -3. every five in a row bumps the combo, up to x4. the weird parcels have descriptions.

**garden emergency** is a garden with twelve plots. pick the watering can, glove or sunshine (1, 2, 3) and tap a plot. sun on a bud blooms it for +20, water saves a thirsty plant for +10, pulling a weed is +5. thirsty plants wilt if you wait too long and weeds spread. the garden never asks for more at once than you can handle, but that number goes up.

**ghost hunt** is a haunted bedroom. ghosts with faces peek out from behind the furniture, a crowned one is worth 30, and faceless laundry on hangers is a trap. wrong spots cost 5 and streaks add a bonus. later on ghosts get faster, hop between hiding spots and go see through. on a phone held upright the room turns tall.

## run it

```bash
npm install
```

```bash
npm run dev
```

then open http://localhost:5260

## checks

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

```bash
npm run e2e
```

the e2e tests build the app, serve it with vite preview and drive it in the locally installed google chrome. they use playwright's fake clock, so every game plays a full minute in a few seconds and always the same way.

## how it fits together

```
src/
  app/        the shell, a tiny router and the records and settings store
  engine/     the session engine. one clock, one animation loop, the overlays
  games/      one folder per game, each with a logic.ts and a component
  components/ home, records, settings and the shared buttons and panels
  hooks/      small helpers games share
  storage/    localStorage records and settings, validated on every read
  audio/      little web audio bleeps, no sound files
  styles/     the design system and the per game looks
tests/unit/   vitest tests for the clock, records and every game's rules
e2e/          playwright tests for the whole thing
```

the engine owns the lifecycle (ready, countdown, playing, paused, finished), the 60 second clock, pause and resume, scoring, results and personal bests. a game is a component that gets an `api` and uses it to subscribe to frames, add points, play sounds and add listeners that clean themselves up. adding a seventh game means writing its folder and adding one entry to `src/games/registry.ts`. nothing in the engine changes.

the clock counts real elapsed time, not frames. pausing freezes it, a hidden tab pauses the game and a long gap between frames only counts as a tiny step, so nobody loses their minute to a frozen laptop. physics steps are capped too, so nothing teleports after a resume.

## deploy

it is a static site. the build goes to `dist/` and `netlify.toml` plus `public/_redirects` send every path to `index.html`, so links like `/play/ghost-hunt` work when you open or refresh them.

```bash
npm run build
```

```bash
npx netlify-cli deploy --prod --dir dist
```

## things to know

- sound only starts after your first click or key press, because browsers ask for that
- the fonts come from google fonts. offline it falls back to system fonts and still works
- the garden and panic button rerender a few times a second instead of every frame. the canvas games never rerender while playing
- scores from different games are not comparable, so there is no overall ranking
