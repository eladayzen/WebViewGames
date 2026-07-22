# Web Minigame Tech Retrospective (draft — for CTO review)

Companion to `brief-for-webgames.md` (the original tech brief), not a
replacement — that file stays as-is, this is what we've actually learned
building against it across four games so far. Written for two audiences:
future Claude instances picking up stage 4 of the pipeline, and the CTO,
since we're starting to accumulate real rendering dependencies in this SDK
and that's a decision worth a deliberate sign-off, not something that
should just accrete game-by-game.

## What the brief actually said

`brief-for-webgames.md`'s rendering-approach table, summarized:
- **Canvas 2D via a framework** (Phaser, or PixiJS if Phaser's overkill) —
  recommended for almost everything.
- **Raw Canvas, no framework** — only for something trivially simple (a
  single-mechanic tap-timing game). "Gets painful fast otherwise."
- **3D (Three.js/Babylon.js)** — only if the game genuinely needs 3D.

## What we've actually built

| Game | Tech | Matches the brief? |
|---|---|---|
| Astro_Tunnel | Three.js | 3D carve-out — the prototype the brief's own addendum is based on. |
| CarRacer | Three.js | 3D carve-out — plausible fit, it's a racer. |
| TmntRunner | Babylon.js | 3D, but per project notes this one was explicitly a "vibe-coding ceiling test" (Babylon vs. our Three.js track), not a game that was judged to need 3D on its own merits. |
| TmntSkateSlice | Raw Canvas 2D, zero dependencies | **No.** A 2D catcher with multiple item types, player states, a 3-stage difficulty ramp, and a DOM HUD — not "trivially simple" by the brief's own bar, built raw anyway. |

The pattern across all four: **Phaser and PixiJS — the brief's actual
top-tier recommendation for 2D — have never been used, not once.** Every
game has landed in one of the two carve-out categories (3D, or raw Canvas)
instead of the recommended default. That's not a criticism of any single
build decision in isolation — each was a reasonable in-the-moment call —
but four-for-four skipping the stated default is a pattern worth surfacing
rather than letting it keep happening silently.

## A concrete cost of that pattern, from today

While polishing TmntSkateSlice's player animation, we hit a real
consequence of the raw-Canvas choice: the game currently swaps whole-body
PNGs per state (idle/swing/hit) with no movement cycle, so the character
visibly "slides" rather than skates. The fix we're taking (a proper 3-4
frame flipbook skate cycle, hand-coded) is fine and proportionate for this
game. But investigating a nicer long-term answer — layered "cutout"
part-based animation (DragonBones, or BrashMonkey Spriter) — surfaced that
**every real JS runtime for that style of animation targets PixiJS**, not
raw Canvas. Had TmntSkateSlice been built on PixiJS per the original
brief, that richer animation path would already be open, at zero
migration cost. Because it's raw Canvas, taking it would mean rewriting
the render layer first — a decision we're explicitly not making for this
game (see below), but one that gets more expensive to defer the more games
we build raw.

## Technique note: 2D sprites inside a real 3D scene (2026-07-22)

Came up prepping a different game (a tunnel/corridor runner, stage-3
brief-writer context) -- captured here since it's directly relevant to the
3D-carve-out row of the table above, not a new dependency question like the
2D-default question below.

The "flat cutout gliding through a real 3D corridor" look some concept
frames call for is genuinely just Three.js sprites, not fake-3D CSS
trickery. A `THREE.Sprite` (or a plane with `THREE.SpriteMaterial`/a
billboard shader) always faces the camera and renders flat 2D art, while
sitting in a real perspective-projected 3D scene with real depth, lighting,
and a moving camera. Same trick classic sprite-based games (Doom, early
racers) used, just on a modern WebGL renderer -- no custom shaders or
exotic tooling needed, and it's a natural fit for the Three.js carve-out
this repo already reaches for (Astro_Tunnel, CarRacer, TmntRunner) per
`GOBALANCE_SDK.md`.

Concrete building blocks for a POC:
- **Tunnel geometry**: a `THREE.TubeGeometry` (or a simple extruded
  cylinder) along a path spline gives the pipe walls/perspective for free
  -- the camera rides the spline, which also gives banking/curves free
  later.
- **Player's angular position**: track a single `theta` (angle around the
  tube's circular cross-section). Tilt-left/right just increments/
  decrements it continuously; each frame, compute `(x, y, z)` from
  `theta` + radius and point the sprite there, always facing the camera.
- **Obstacles/pickups**: same pattern -- each one is a sprite parented to a
  `(theta, distanceDownTunnel)` pair, moving toward the camera as distance
  decreases. Collision is just comparing the player's `theta` (with a
  tolerance window) against each obstacle's `theta` when its distance
  crosses zero.
- **Cross-section arcs** (partial/half/full tube): a min/max clamp (or no
  clamp) on `theta`'s valid range per section -- cheap to implement, good
  POC-friendly difficulty/variety knob.

## Open question for the CTO — what should stage 4 actually default to?

Three real options, not a foregone conclusion:

1. **Keep the status quo** (raw Canvas for simple-looking 2D games,
   Three/Babylon when 3D is wanted). Lowest dependency count, proven to
   ship games fast. Cost: richer 2D animation (cutout rigs) stays
   unavailable without a one-time, per-game render-layer rewrite whenever
   we decide we want it.
2. **Move the 2D default to PixiJS** (the brief's own fallback tier, not a
   new addition to it). Smallest step from current practice — still
   hand-rolled game loop/logic, just swap `ctx.drawImage()` for Pixi
   sprites/containers — and it opens the DragonBones/Spriter cutout-rig
   ecosystem for every future 2D game without per-game migration.
3. **Actually adopt Phaser** as originally specified — full batteries
   (scenes, physics, input, audio) included. Probably more than any of
   our 2D games so far have needed; worth it only if future games start
   wanting built-in physics/scene management raw Canvas can't cheaply give
   us.

My read: **(2) is the pragmatic middle path** — closest to what we
actually do today, smallest new-dependency footprint, and it's the one
piece of infrastructure that directly unlocks the animation quality
question that keeps coming up. But this is exactly the kind of
"how many libraries are we bringing into the SDK" call that should get an
explicit yes/no rather than happening by default on the next game that
needs it — flagging for sign-off rather than deciding it here.

## Not changing right now

TmntSkateSlice stays raw Canvas 2D, sprite-flipbook animation only — no
renderer migration for this game. This document is forward-looking for
the *next* 2D game, once the above gets a decision.

See also: `BUILD_NOTES.md` (the cutout-animation library research that
prompted this), `brief-for-webgames.md` (original brief, unchanged), and
`PIPELINE.md` (where stage 4's defaults actually live once this is
settled).
