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

**Correction (2026-07-26) — environment surfaces need real 2D art, not
procedural textures.** The building blocks above (sprite billboards for
characters/obstacles/pickups riding inside real 3D geometry) are still
right and not what this correction is about. What's wrong is how
`TmntSewerSlide` (and originally `Astro_Tunnel`, which it copied the
technique from) textured the **tunnel wall geometry itself**: a
`<canvas>`-drawn repeating grid/tile pattern generated in code
(`createGridTexture`-style), applied as a `CanvasTexture` to the
`TubeGeometry`. On an actual playtest this reads as generic/proceduralized
3D, not the flat, painterly, illustrated "2D feel" the concept art for
these games actually promises -- the whole pitch of "3D game, 2D feel" is
that a real 3D/perspective scene gets *flat, hand-illustrated-looking*
surfaces, not code-generated patterns that happen to be unlit.

**What to do instead:** environment surfaces (tunnel walls, street/ground
planes, any large geometry a camera travels through) need real 2D
illustrated art -- Kolbo-generated, matching the game's own concept-art
style/palette -- mapped onto the 3D geometry as a texture, the same way
character/obstacle/pickup sprites already get real art in the stage-4 art
pass. Don't default to a procedurally-drawn canvas pattern for these
surfaces just because it's cheap and matches Astro_Tunnel precedent --
that precedent is the anti-pattern being corrected here, not a technique
to keep reusing. (The `TubeGeometry`/centerline-spline/`theta`-clamp
mechanics from Astro_Tunnel are still fine to reuse -- this correction is
scoped to *texture sourcing* for environment surfaces only.)

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

## Technique note: DOM/CSS onboarding tutorial overlay for GoBalance input (2026-08-04)

Built for `HalfShellHustle` (absolute-mode lane steering + lean-to-jump),
direct feedback: players need an actual moving diagram before their first
run, not a static screenshot with an arrow drawn on it — "showing the go
balance tilted left and showing the character on the left lane... center...
right." Any GoBalance game using `STEERING_ABSOLUTE` mode or a lean-to-jump
action has the same explaining-a-physical-gesture problem, so this is
written to be **copied and adapted**, not imported — per this repo's
no-cross-game-templating default, each game still owns its own copy, its
own art frames, and its own wording. What's reusable is the *pattern* below,
not a shared module.

**Where it lives in HalfShellHustle** (read these in this order to port it):
`src/core/gameState.js` (the `'intro'` state), `src/data/introTutorial.js`
(all the cycle-timing/angle knobs, one file, easy to retune), `src/ui/hud.js`
(`showIntroTutorial`/`setIntroStep`/`setIntroLaneState`/
`setIntroJumpCycleState`/`hideIntroTutorial`), `src/core/main.js`
(`beginIntro`/`advanceIntroStep`/`dismissIntro`, wired into `boot()`,
`restart()`, and `tick()`), `index.html` (`#intro-tutorial-overlay`'s
markup), `src/style.css` (everything prefixed `.intro-`/`#intro-`).

**The shape of it**: a DOM/CSS overlay (this repo's established HUD
pattern — build doc §7, "a DOM/CSS overlay on top of the WebGL canvas, not
drawn into the 3D scene itself"), gated behind its own game state
(`'intro'`) so it freezes the whole world for free the same way
`'levelcomplete'` does — no new guards scattered through the update loop,
just one more value `tick()`'s existing state checks already gate on. Two
steps, each a looping, auto-cycling diagram (board art + the character's
*own* run/jump sprite frames — reusing real gameplay art, not new
illustrations, is what makes it read as "this is what will happen," not a
generic icon), a caption, and a continue button. Shown at the START of
every run (`boot()` and `restart()` both call `beginIntro()`), not gated
behind a one-time "seen it" flag — direct feedback was explicit that this
repeats every run.

**GOBALANCE_SDK.md compliance, the part easy to get wrong**: the SDK
contract requires the game's first playable/countdown state to be reachable
on load "with no key required." A tutorial that hard-blocks on a click
would violate that on the real device, where the only forwarded input is
`Space`/`Enter` plus the synthetic steering keys (see
`GOBALANCE_SDK.md`'s WebGameController section) — there is no guaranteed
click. The fix: every step also auto-advances on its own after
`INTRO_STEP_AUTO_ADVANCE_SEC` of no interaction (`data/introTutorial.js`).
A click or `Space`/`Enter` is a speed-up over that fallback, never a
requirement — `core/gameState.js`'s own comment on the `'intro'` state
spells out why this satisfies the contract the same way a plain countdown
would.

**Four correctness lessons, all found by screenshot, none obvious from
reading the CSS**:
1. **A bare class rule loses to an ID rule of the same specificity fight it
   isn't even in.** `#some-el.some-state { transform: X }` beats a plain
   `.some-state { transform: X }` if `#some-el` *also* carries its own base
   `transform` — the class never wins, silently. Every toggled-state rule
   here uses compound `#id.class` selectors for exactly this reason (bit us
   once on the level-complete curtain feature, so it was caught early here).
2. **A perspective-rotated flat, wide, mostly-featureless shape reads as
   almost nothing at a "natural-looking" angle.** The GoBalance board icon
   is a wide oval — `rotateX`/`rotateY` at ~20° was nearly invisible on
   screen. It took ~55-60° + a *tight* `perspective()` (~380px, not the
   700px+ that feels more "correct") to actually look tilted. If porting
   this to a different board asset, re-verify by screenshot rather than
   trusting the numbers here — the legible angle depends on the art's own
   aspect ratio and flatness.
3. **Sync animation causality to the REAL input's trigger edge, not to
   what looks nice in isolation.** The jump-tutorial's first cut showed the
   crouch/launch pose arriving as the board eased back toward level, which
   read as "release triggers the jump" — backwards from the actual
   mechanic (`pollJumpPress` fires on the RISING edge, the instant a lean
   crosses the threshold outward). Cross-check any taught gesture against
   the actual input code's trigger condition, not just against what the
   animation loop looks like on its own.
4. **Fixed-`px` sizing anywhere inside a `vmin`-scaled overlay breaks at
   small viewports specifically** — invisible at a normal dev-server window
   size, and exactly what a shrunk browser / the SDK's mobile WebView hits.
   The continue button was copy-pasted from `#restart-button` (itself
   `px`-sized) and looked fine until tested at a small window: everything
   else scaled down together, the button didn't, and it ended up dominating
   the screen. `#restart-button` itself still has this latent bug as of
   this writing — worth a pass whenever a game with a GoBalance mobile
   deploy next touches that overlay.

**Verification approach**: none of the four issues above were caught by
code review — all four were only visible in a real render. Two techniques
that worked without needing live interactive access to a WebView: (a) an
isolated static HTML harness (copy the real compiled CSS rule + real
asset path, drive state with a tiny inline `setInterval`/`setTimeout`
script, screenshot with headless Chrome) to test a CSS mechanism in
complete isolation from the game's own timing/WebGL-warmup noise; (b) the
same technique against the actual `dist/` build output for full-context
checks. Both need an **isolated** `--user-data-dir` (never the shared
`~/.claude/chrome-profile` another session/tool may be holding a lock on)
and a hard timeout around the headless Chrome process — it can hang
indefinitely past `--virtual-time-budget` on this setup, and stray
processes accumulate fast if it isn't killed explicitly. Screenshots
should be re-checked, not assumed correct from the numbers that produced
them — several of the fixes above only became obvious once actually seen.

## Not changing right now

TmntSkateSlice stays raw Canvas 2D, sprite-flipbook animation only — no
renderer migration for this game. This document is forward-looking for
the *next* 2D game, once the above gets a decision.

See also: `BUILD_NOTES.md` (the cutout-animation library research that
prompted this), `brief-for-webgames.md` (original brief, unchanged), and
`PIPELINE.md` (where stage 4's defaults actually live once this is
settled).
