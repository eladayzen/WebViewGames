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
place of carve's five alpine hours), **the ground** (rock, not snow — see
below), the forest (crystal spires, not conifers), the far range (a `shatter`
profile of broken plates, not rolling massifs), the four places and their
names, and the asset namespace — `/audio/carve/*` became `/audio/*` and
`tracks/carve.json` became `tracks/drift.json`, so the old game's name is not
baked into this one's shipped paths.

**New, and not in carve at all:** the drones and the gun (`src/combat.js`),
the floating islands (`src/islands.js`), and **skirmish** — a third mode where
the hill shoots back (`src/modes/skirmish.js`).

### Skirmish

Chill vibe is a clock, race is a line, **skirmish is a fight**. No clock; health
in its place, in the same spot on screen, so a player arriving from chill vibe
already knows where to look for the thing running out. Dead is dead — no lives,
no respawn, no regeneration.

**You outrange them.** A ninja star reaches 86 m and a drone's bolt reaches 58.
That 28 m band is the mode: a drone killed while you close through it never
fires, one still alive when you enter its reach starts shooting. So the skill
is the one this game already asks for — acquire early and *hold the heading*.

A drone takes three stars; a cyan **power gate** (one in five) gives you a
weapon that kills in one, or more rarely one that throws three at a time and
boosts your speed. The step from 1 to 3 damage is a change of kind, not degree.

**The gates say what they give you.** Each one hangs a legend in its own gap: a
picture of the reward, not a label for it — one star for the keen throw, three
stars and a chevron for the storm, chevrons for a boost, a dial and a plus for
time. Text was costed and dropped on arithmetic (a 2.6 m panel at sixty metres
is 32 px tall and no word survives that); a count of stars is legible at a dozen
pixels because it is a count and not a shape. The payload is decided in the
**plan**, not on contact — a reward that does not exist until you touch it
cannot be drawn on something you are reading from sixty metres away.

**Medkits** are the only way health comes back. Without them the length of a run
is fixed before it starts: 100 health against 6-point bolts is sixteen hits
whatever the player does, so good play buys delay and never recovery. One every
~300 m, in the reward band where no tree can stand. **A kit ridden through at
full health is not consumed** — the alternative makes the correct play "avoid
the medkit", and a pickup you are supposed to dodge is a design that went
wrong.

A wipeout still costs speed and ground and **not** health. Terrain punishes your
line, drones punish your fight — and the forest was tuned against a clock this
mode does not have, so charging health for a crash would be a difficulty change
smuggled in under a feature.

### Written for the fight that is coming

`src/fighters.js` exists before it is needed. Combat never sees a `Rider` — it
sees a **Fighter**, an adapter over anything with a position and a heading, and
asks a **Roster** one question: `foesOf(team)`. Nothing in the targeting code
ever asks whether something is a player.

That is the seam for the two things on the list. **AI competitors** join as
entries in the roster. **PVP** is one line — player two registered on `PVP_B`
instead of `CREW` — after which the drones shoot at both, both shoot at the
drones, and the two riders shoot at each other. A design where combat reaches
for `game.rider` has to be unpicked for either, and unpicking it later means
doing it inside a turret, a guidance loop and a hit test at once.

`src/weapons.js` is the other half: every projectile is the same simulation with
a different row. A power gate swaps a row, not a code path.

**Still carve, still ahead:** the rider, the board (it is still a snowboard),
the turtles, the soundtrack.

### The ground stopped being snow

The largest surface in every frame was a groomed piste, and that was the thing
all the recolouring had been losing to: a comb of groomer passes says *ski
slope* louder than any amount of violet says anything else. Two changes, and
the second is the one that was missed twice.

**Texture.** `SNOW_FRAG` in `src/mountain.js` is now a rock surface. Corduroy
and sastrugi are gone; **strata** (bedding planes, a function of world y alone,
so bands run level around a spur and resume at the same height across a gully —
the one cue no tangent-plane texture can fake) and **jointing** (the same noise
fetch as the sastrugi, creased so the normal breaks instead of rolling) replace
them. The ice sparkle became a sparse mica glint on broken ground only. The
wrapped diffuse went from 0.35 to 0.12 and the shadow floor from 0.26 to 0.15,
because rock does not scatter light through itself — that pair is what makes
the strata and the joints visible at all.

**Value.** The first pass took the albedo to 0.40–0.55 linear and it still read
as snow — not by hue, not by texture, but because a large, bright,
low-saturation expanse under a coloured sky *is* snow to the eye before it is
anything else. It is down another full stop, to 0.20–0.28.

The corduroy was doing a job — drawing the ridable corridor — and three
non-periodic channels took it over: the facets smooth on the track, the
jointing and scree damp there, and the albedo lifts. The track is now the
*smooth* thing in a broken frame rather than the striped thing in a plain one,
which is a larger contrast than the comb and does not stop resolving at
distance.

`src/trail.js` carries a CPU copy of this light model, by design, and the two
diverged when the ground changed. They are back in sync; if the wrap or the
shadow floor moves in `mountain.js`, it moves there too.

### Floating islands

`src/islands.js`. Two instanced pools — slabs (44–165 m, out to 820 m either
side, up to 290 m over the fall line) and chunks (3–11 m, closer and lower) —
recycled in bands as a pure function of (band index, seed), two draw calls, no
per-frame work beyond a band check. Two size classes rather than one, because a
single class gives the eye no depth cue and reads as a backdrop plate however
well it is drawn.

They are the one element in frame that no mountain can explain. Nothing here
has a collider and the nearest slab is 260 m off the centre line, so the file
can be deleted and the game plays identically.

### The one rule the re-theme has kept throughout

Difficulty has not moved. `TREE_R`, the tree density, the clumping, the reach,
the inside-piste and margin counts, the obstacle lane and the race's blockers
are all exactly the numbers carve was tuned on. The crystal spires replaced the
conifers at the same collision radius; the drones hover above a standing rider's
head and have no collider at all; the floating islands are scenery with no
collider and never come within 260 m of the centre line. The ground's rewrite
is a shader and a palette — `relief()`, `crossSection()` and the fall profile,
which are the three functions that decide what the mountain actually does to a
rider, are untouched. Every change so far is a change to what the
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
node skirmishqa.mjs # does the hill shoot back, and can it be beaten?
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
