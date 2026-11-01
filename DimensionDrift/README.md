# DimensionDrift

A hoverboard descent through Dimension X, with the Ninja Turtles. BAL-630.

It is **carve**, ported — the three.js snowboard descent from `bobo_play`,
single-player and two-player split-screen, moved into this repo as its own game
and re-pointed at the GoBalance SDK. carve itself stays in `bobo_play`,
untouched, and goes on shipping there; this is a sibling, not a fork that will
be merged back.

## State

Stage one, which is **web only**. No Unity drop, no StreamingAssets folder, no
`manifest.txt`, no `.meta` files, no lobby tile. The game builds and runs in a
browser and nothing more is claimed.

**Themed so far:** the light (five Dimension X mood stops in `src/mood.js`, in
place of carve's five alpine hours), the forest (crystal spires, not conifers),
the far range (a `shatter` profile of broken plates, not rolling massifs), the
four places and their names, and the asset namespace — `/audio/carve/*` became
`/audio/*` and `tracks/carve.json` became `tracks/drift.json`, so the old game's
name is not baked into this one's shipped paths.

**New, and not in carve at all:** the drones and the gun (`src/combat.js`).

**Still carve, still ahead:** the ground texture, the rider, the board (it is
still a snowboard), the turtles, the soundtrack.

### The one rule the re-theme has kept throughout

Difficulty has not moved. `TREE_R`, the tree density, the clumping, the reach,
the inside-piste and margin counts, the obstacle lane and the race's blockers
are all exactly the numbers carve was tuned on. The crystal spires replaced the
conifers at the same collision radius; the drones hover above a standing rider's
head and have no collider at all. Every change so far is a change to what the
mountain LOOKS like or to what you can earn on it, never to what can hurt you.
That is a decision and it should be spent deliberately, not leaked into a
feature pass.

## Running it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm test           # 11 unit tests, no browser needed
node bootqa.mjs    # builds nothing; serves dist/ and proves the game RUNS
node combatqa.mjs  # does the gun actually hit anything?
node lookqa.mjs --tag <name>   # the canonical look captures
node moodmetrics.mjs           # the palette, as six measured bands
```

`npm test` and `bootqa.mjs` are separate on purpose: the first needs no browser
and runs in milliseconds, the second needs `dist/` to exist and takes seconds.
Run `npm run build` before `bootqa.mjs`.

## The name is load-bearing

`DimensionDrift` is the source folder, and it has to stay the name of the
StreamingAssets folder when this eventually ships, because the per-profile save
key and the Firestore document id are **derived** from it:
`FirestoreStructureStrings.WebGameKey("DimensionDrift")` → `web_dimension_drift`.
Renaming after a build ships migrates nothing — it files progress under a new
document and every player's saved state reads as absent. Rebrand through the
display name and the tile art instead; Carve ships as "Peak Racers" and its
folder is still `Carve`.

`HalfShellHustle/` used to build into `StreamingAssets/RoboRun/`. Do not
recreate that: source folder name = shipped folder name.

## How the port is wired

| | |
|---|---|
| `src/` | carve's game, unchanged except for import paths |
| `src/shared/bobo-host/` | the input layer: tilt pipeline, dev keyboard, and the GoBalance adapter that reads the board |
| `src/shared/bobo-ui/` | screens, menu nav, the calibration wizard, the log ring |
| `public/` | everything served at the site root — audio, fonts, the rig, the tracks, both stylesheets |
| `index.html` | the game's markup plus the SDK boilerplate, verbatim from `GOBALANCE_SDK.md` |

**`public/` is why this port needed no asset-URL rewriting.** Vite serves it at
the site root, and the SDK's local HTTP server serves the game folder the same
way, so `/models/rider.glb` means the same thing in `npm run dev`, in
`vite preview` and on a device. carve's hand-written `build.mjs` existed largely
to guarantee that identity; here it is free, and `vite.config.js` is nine lines.

### Input mode: ANALOG, so `forwardSteeringKeys` must be FALSE

This game reads the board's analog tilt itself, through `bobo-host`, which polls
`window.__gbSensor` and `GoBalance.getPlayers()`. It does **not** listen for the
synthetic `ArrowLeft`/`ArrowRight` events.

Whoever wires the Unity scene must therefore set `forwardSteeringKeys = false`
on the `WebGameController`. Leaving it at its default `true` does not break
input — `__gbSensor` is published in both modes — it **doubles** it, because the
game would read the analog value *and* receive synthetic key presses for the
same lean. See `GOBALANCE_SDK.md`, "Double input".

### The roster trap, and why there is a test for it

The app injects its own `window.GoBalance` before any game script runs, and that
object is not the shim a game installs when the global is absent. In the real
SDK, `getPlayers()` is the function and `players` is an **array**; in the shim,
`players` is a function. Bloop Squad read `players()`, the check was false on
every device, and its multiplayer roster was silently never read — every seat
fell back to "PLAYER 1" from the day it was written.

`bobo-host` reads it correctly, because carve's two-player work was done against
the real SDK. `test/host-shape.test.mjs` pins that, and it is not a decorative
test: reintroducing the exact bug turns three of its cases red.

## Tests

- `test/host-shape.test.mjs` — the roster and sensor contract above, with a
  stub pipeline so the protocol is provable without the tilt filter.
- `test/assets-referenced.test.mjs` — `public/` and the code agree in both
  directions. Catches an orphaned asset (BAL-626: RoboRun still ships twelve
  unused Leonardo frames because Vite's directory copy does not care whether
  anything points at a file) and a path nothing shipped.
- `bootqa.mjs` — serves the real build over real HTTP and watches the page reach
  its title screen, with no 404s and no console errors. A green `vite build`
  proves the modules parsed and nothing else; this port changed every asset URL
  in the game, which is exactly what a green build cannot see.
- `combatqa.mjs` — rides a measured kilometre and reports shots, kills, sweeps,
  escapes and the hit rate, then re-tests the same live drones against a heading
  forty degrees off to prove the targeting corridor actually constrains. Combat
  has no visible state between events — a frame either has a bolt in it or it
  does not — so `lookqa.mjs` cannot see this feature at all and a gun that
  silently never fired would pass every other gate here.

The suite names its files one by one rather than globbing. `node --test` pointed
at a directory, or at a glob matching nothing, runs zero tests and exits 0 —
green, and worse than having no suite at all, because you will trust it.
