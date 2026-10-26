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

What is **still carve** and has not been themed yet: the mountain, the snow, the
sunrise, the rider, the soundtrack. The Dimension X look, the hoverboards, the
turtles and the projectile combat are all ahead. The one piece of theming
already done is the asset namespace — `/audio/carve/*` became `/audio/*` and
`tracks/carve.json` became `tracks/drift.json`, so the old game's name is not
baked into this one's shipped paths.

## Running it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm test           # 11 unit tests, no browser needed
node bootqa.mjs    # builds nothing; serves dist/ and proves the game RUNS
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

The suite names its files one by one rather than globbing. `node --test` pointed
at a directory, or at a glob matching nothing, runs zero tests and exits 0 —
green, and worse than having no suite at all, because you will trust it.
