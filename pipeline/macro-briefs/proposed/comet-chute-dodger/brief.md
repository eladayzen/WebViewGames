---
status: proposed
track: general
source_reports: [tunnel.md]
---

# Stellar Courier: Comet Chute

**One-sentence hook:** A plucky space-courier kid hoverboards down a
sparkling wormhole tunnel — rendered as a real 3D-perspective corridor with
flat, cel-shaded 2D sprite art for the character and every obstacle/pickup —
leaning left/right between a small set of fixed lanes to dodge asteroid
debris and scoop up comet shards.

**Genre:** On-rails tunnel dodger (2.5D corridor-runner) — forward-auto
movement, lateral-only player input, discrete lane positioning rather than
continuous free-roam steering.

## Core loop

- The wormhole tunnel scrolls the camera continuously forward on rails;
  the player never controls speed, only lane position.
- A small, fixed number of lanes (3, occasionally narrowing to 2 at
  tension points) run down the tunnel; leaning left/right shifts the
  courier one lane at a time — a discrete choice, not a continuous curve
  to track.
- Obstacles (asteroid rubble, tumbling space-junk crates, a spinning
  ringed satellite-debris hazard) scroll toward the camera in specific
  lanes; the player must be in a clear lane when they arrive or the run
  ends/takes a hit.
- Comet-shard pickups appear in open lanes and build a score multiplier;
  the multiplier decays gradually if no pickup is collected for a stretch,
  giving a soft secondary objective without adding a new input.
- Difficulty escalates across a small number of in-run "sectors" (e.g.
  asteroid belt → nebula field → meteor storm), each raising obstacle
  density/speed and introducing a new obstacle silhouette, until a
  fail-on-hit condition ends the run and shows a score.

## Why it fits GoBalance

Same core reasoning as the source report's central finding: the reference
game's own in-game instructions read *"Tilt left or right to avoid the
obstacles"* with literal left/right arrow icons in the tutorial graphic —
this genre is natively a **2-direction (left/right) mechanic**, no up/down
input anywhere in the source material. The report's caution is about pace,
not direction count: the reference footage shows a continuously curving
tunnel plus multiple obstacles in view at once, closer to "constant
micro-steering" than a comfortable lean-board tempo. This brief designs
around that directly: the tunnel's *visual* curve/banking is camera-only, a
cosmetic effect on the 3D corridor render, while the *player's* actual task
is repositioning between a small number of fixed, discrete lanes — the
report's own recommended fix ("possibly simplified from 'continuous curve
to follow' down to 'discrete lane choices'"). That keeps the physical ask
at "single left/right lean, paced to obstacle spacing," never a fast
alternating correction, and all four directions are never required.

**On the 3D/2D question specifically:** this concept is built as a true
3D-perspective scene (Three.js camera moving down a modeled corridor) per
Amit's explicit direction for this run, not a flat Canvas-2D approach — but
every interactive element (the courier, asteroids, crates, debris,
pickups) is flat 2D sprite/billboard art within that 3D space, not
modeled 3D geometry. This keeps the art pipeline and asset production
squarely within this pipeline's usual 2D-sprite workflow while getting the
corridor depth and motion-read the genre needs; see
`pipeline/reports/tunnelRef.png` for the exact "flat sprites inside a real
3D corridor" look this targets.

## Scope tiers

**POC** — A single straight tunnel segment (no curve/banking yet) built in
Three.js, 3 fixed lanes, one placeholder courier sprite that snaps between
lanes on left/right lean, one obstacle type (asteroid chunk) as a flat
billboard sprite scrolling toward the camera, basic overlap/collision
detection, no scoring UI, no difficulty ramp, no comet-shard pickup yet.
Proves the "3D corridor + 2D sprite" render pipeline and the discrete-lane
dodge feel are both technically sound and fun before anything else is
built.

**MVP** — Full scoring with the comet-shard multiplier system, a
lives/fail condition (hit an obstacle → run ends, or a small hit buffer),
a difficulty ramp across 3 in-run sector stages with cosmetic camera
banking/curve on the tunnel, all three obstacle types (asteroid rubble,
space-junk crate, spinning satellite-debris hazard) plus the comet-shard
pickup, and a game-over score screen. Single courier character/hoverboard,
no character-select.

**Post-MVP** — More sector themes as later-run milestones (solar-flare
zone, derelict station passage, meteor-storm finale) with distinct tunnel
color palettes; more obstacle/pickup variety (rogue mining drones, a
brief warp-boost pickup); a small set of unlockable-within-a-run cosmetic
courier looks (helmet color, board trail color) tied to score/sector
milestones; denser late-run obstacle patterns as an in-run difficulty
ceiling. All of this is more in-game content and depth within a single
run/session — no cross-game unlocks, no currency, no IAP.

## Inspired by

- **tunnel.md** — this is the direct source for the entire concept
  structure: the on-rails forward-auto-scroll format, the left/right-only
  steering (quoting the report's own quote of the reference game's
  instructions: *"Tilt left or right to avoid the obstacles"*), the
  crate/spinning-obstacle/pickup obstacle vocabulary, and the
  multiplier-decay behavior (x3→x2→x1 observed in the sampled footage) are
  all taken from the report's "What's happening" and "Core mechanic(s)"
  sections. Most load-bearing is the report's own stage-2 recommendation,
  implemented here as the central design decision: *"this genre's native
  pacing ... would likely need to be slowed and spaced out substantially,
  and possibly simplified from 'continuous curve to follow' down to
  'discrete lane choices,' to be comfortable on a lean board."*
- **The report's flagged skin/instructions mismatch is this brief's
  specific theme source.** The report notes that the reference build's own
  in-game instructions text reads *"Stir your spaceship into safety. Tilt
  left or right to avoid the obstacles. Look for powerups to gain points
  faster! Good luck!"* — written for a spaceship, even though the actual
  playable character on screen was a TMNT-skinned turtle, which the report
  flags as evidence of an unfinished/template build with a skin dropped on
  top. Rather than treat that as a loose end, this general-track brief
  takes the mismatched "spaceship" framing at face value and gives it its
  own proper build: a space-courier tunnel dodger designed on its own
  terms, resolving the report's observed mismatch by letting the spaceship
  theme be what it was apparently meant to be, decoupled from the TMNT
  skin (which gets its own, separate brief — see
  `pipeline/macro-briefs/proposed/tmnt-sewer-slide-dodger/`).
- **Amit's direct creative/technical direction for this run** (given at
  task time, not in a notes.txt — the tunnel.md topic folder had no notes
  file): keep this as a true 3D-perspective corridor (camera moving forward
  down a modeled tunnel) rather than translating it into a flat 2D
  equivalent, but build all character/obstacle/pickup art as flat 2D
  sprites/billboards within that 3D space, per the pseudo-3D "2D sprites in
  a 3D corridor" reference look at `pipeline/reports/tunnelRef.png`. This
  is a deliberate, explicit exception to this pipeline's default "2D only"
  posture for this concept, not a reinterpretation of the constraint
  generally.

## Concept frame

Prompt used (also saved to `concepts/prompt.txt`):

> Video game key art blending two art directions: the composition and
> rendering technique of a true 3D-perspective corridor (converging tunnel
> walls, deep receding vanishing point, tunnel curving into the distance)
> combined with flat, cel-shaded 2D sprite-style character and prop
> illustration -- like paper cutouts or trading-card art with bold clean
> outlines -- placed as flat billboards within that 3D space rather than
> fully modeled 3D geometry. A small, plucky space-courier kid in a patched
> orange flight suit and a glowing little rocket-pack rides a hoverboard
> down the center of a sparkling starlit wormhole tunnel that curves and
> recedes into the distance in genuine 3D perspective, banking to one side
> mid-dodge. Flat 2D-style obstacles float in the tunnel ahead: chunky grey
> asteroid rubble, a tumbling piece of space-junk crate, a spinning ringed
> satellite-debris hazard; a bright glowing comet-shard pickup trailing
> sparkle particles sits to one side. Tunnel walls are deep-space indigo
> and violet with streaking starlight and soft nebula color washes, strong
> rim lighting on the character. Wide 16:9 game key art framing, dynamic
> action pose, bright and adventurous mood, third-person view from just
> behind and above the character.

Generated with `nano-banana-pro`, using `pipeline/reports/tunnelRef.png` as
a composition/technique reference for the 3D-corridor-with-flat-sprites
look (no thematic content match needed — the reference guided rendering
technique, not subject matter). Four variations are in
`concepts/concept-01.png` through `concepts/concept-04.png`. One variation
(`concept-01.png`) came back with a generated "STELLAR COURIER" logo
lockup unprompted — kept as-is since it happens to read well as a title
suggestion, not edited out.
