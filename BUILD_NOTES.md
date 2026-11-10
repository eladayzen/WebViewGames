# Build Notes (draft)

Running list of small cross-game conventions and lessons we want to keep
applying, captured as they come up during a build. **Draft only** — once
TMNT: Skate & Slice ships, fold the settled ones into `GOBALANCE_SDK.md`
(HUD/chrome contract) and `PIPELINE.md` (process) properly, and delete this
file. Don't treat anything here as a finished spec.

## HUD chrome convention (started on TmntSkateSlice, 2026-07-21)

- **Back button and Pause button live top-right**, icon-only, as a pair of
  small circular buttons (~38px). Back is the outer one (closest to the
  corner), Pause sits just to its left.
- **Back is a plain X** (`&times;`), not the older "‹ Back" pill text.
  `id="gb-back"` and the `nav:back` Unity bridge call are unchanged — this
  is a restyle/reposition only, not a contract change.
- **Pause is a placeholder glyph icon** (`&#9208;` ⏸ / `&#9654;` ▶ when
  paused) — real icon art can replace it later without changing the DOM
  contract.
- **Score (and other top status: combo, lives, buffs) moves to top-left**,
  where Back used to sit.
- Pause freezes the whole simulation (countdown or running) without
  touching the state machine's `current` value, so resuming drops back into
  exactly what was paused — see `togglePause`/`gs.paused` in
  `TmntSkateSlice/src/core/gameState.js` for the reference implementation.

This should be the same across every game we build on the GoBalance SDK,
not just this one — once validated here, promote it into
`GOBALANCE_SDK.md`'s boilerplate section (which currently still documents
the old top-left "‹ Back" pill) so stage 4 builds it in from the start
instead of retrofitting it.

## Rendering tech / cutout-animation libraries (2026-07-21)

Looked into cutout-style (layered, no-skeleton) 2D animation libraries
while polishing TmntSkateSlice's player animation — see
`WEB_MINIGAME_TECH_RETROSPECTIVE.md` for the full writeup and the actual
open question for the CTO (what should stage 4's 2D rendering default be
going forward). Short version: every real option (DragonBones, Spriter)
targets PixiJS, not raw Canvas, which is what every 2D game we've built so
far actually uses despite the original brief recommending Phaser/PixiJS as
the default. TmntSkateSlice itself is staying raw-Canvas + sprite-flipbook
for now — this is a forward-looking question for the *next* 2D game.

## Tunnel/corridor games: 2D sprites in a 3D scene (2026-07-22)

Came up prepping a different game (a tunnel/corridor runner) -- see
`WEB_MINIGAME_TECH_RETROSPECTIVE.md` for the full technique writeup. Short
version: the "flat cutout in a real 3D corridor" look is just Three.js
sprite billboarding (`THREE.Sprite`/`SpriteMaterial`, always faces camera)
inside a real perspective 3D scene -- same trick classic sprite-based games
used, no custom shaders needed. `THREE.TubeGeometry` along a spline gives
the tunnel + camera path for free; player/obstacle position is a single
`theta` (angle around the tube's cross-section) + distance-down-tunnel,
which also makes collision and partial/half/full cross-section arcs cheap.
Fits the existing Three.js carve-out this repo already reaches for
(Astro_Tunnel, CarRacer, TmntRunner) -- no new dependency, unlike the
PixiJS question above.

## PixiJS: three things that cost a build (2026-09-14, Dawn Patrol)

Dawn Patrol is the second 2D game in this repo on PixiJS v8 (after Nova
Vanguard), and the first to hit these. All three present as "the game does
nothing" rather than as an error, which is what makes them worth writing down.

1. **`await Assets.init()` BEFORE any `Assets.load()`.** Firing a batch of
   concurrent `Assets.load()` calls at an uninitialised `Assets` deadlocks:
   the promises never settle, `boot()` never finishes, the title card sits
   there forever and **nothing is logged anywhere**. There is no error to
   search for. If a Pixi game hangs after `app.init()` resolves, this is the
   first thing to check.

2. **`Assets.setPreferences({ preferWorkers: false })` for a WebView target.**
   Pixi's worker texture-decode path is faster on a desktop browser and
   stalls outright in headless Chrome (and is a needless moving part inside a
   WKWebView). Same symptom as above: a load promise that never settles. Main-
   thread decode costs nothing measurable against a ~30-texture manifest.
   Worth pairing with a per-asset timeout so a wedged load degrades to a
   visible placeholder instead of a black screen on device.

3. **A mask must live in the same coordinate space as the thing it masks.**
   The letterbox pattern every game here uses -- one root container scaled and
   offset to fit the viewport -- means a `Graphics` mask added as a CHILD of
   that root already inherits the transform. Applying the scale/offset to the
   mask again as well (easy to do, because it *looks* like it needs its own
   placement) squares the scale and double-offsets it. It does not error; the
   masked layer just ends in a hard rectangle partway across the frame, which
   reads as an art bug rather than a transform bug.

Also, for any game whose background scrolls a generated texture: **asking the
image model for a seamless tile does not produce one.** What does work is an
offset-blend done locally on the generated art -- cross-fade the last N columns
over the first N, crop to `W-N` -- which makes the wrap a real continuation of
the brushwork. Measured on Dawn Patrol's wave face: the raw generation's
wrap-column delta was 26.2 against an interior delta of 4.5 (a very visible
seam at 864 px/s); after the blend, 4.4 against 4.2. `DawnPatrol/tools/
make-seamless.py` does it and prints both numbers, and fails if the seam
survives.
