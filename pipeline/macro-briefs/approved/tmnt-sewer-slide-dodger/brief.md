---
status: approved
track: tmnt
source_reports: [tunnel.md]
---

# Sewer Slide: Raph's Pipe Run

**One-sentence hook:** Raphael skates down a curving sewer-pipe tunnel —
rendered as a real 3D-perspective corridor with flat, painterly 2D sprite
art for the turtle and every obstacle/pickup — continuously steering around
the pipe's inner wall by holding a left/right lean to dodge crates and
drums and scoop up pizza, with the traversable arc of the pipe itself
(partial arc, half-pipe, or full loop) varying section to section.

**Genre:** On-rails tunnel dodger (2.5D corridor-runner) — forward-auto
movement, lateral-only player input, **continuous angular steering around
the pipe's circumference** (no lane snapping, no discrete positions).

## Core loop

- The tunnel scrolls the camera continuously forward on rails down a
  stone-and-rivet sewer pipe; the player never controls speed, only
  Raphael's position around the pipe's circular cross-section.
- That position is a continuous angle, not a lane: holding a right lean
  steers him steadily clockwise around the pipe wall for as long as the
  lean is held, holding a left lean steers him steadily counter-clockwise,
  and releasing lets him settle. This is the same continuous hold-to-steer
  tilt behavior already proven on GoBalance's own hardware — the source
  recording for this concept is a real, working capture from GoBalance's
  own in-development build, not third-party reference footage, so this
  brief designs directly around continuous steering rather than
  simplifying it away.
- Obstacles (wooden crates, a spinning studded drum, a crossed-pipe girder)
  sit at specific angular positions around the pipe's currently-reachable
  arc and scroll toward the camera; the player must steer to an open angle
  before they arrive or takes a hit.
- Pizza-slice pickups appear at open angular positions and build a score
  multiplier; the multiplier decays gradually if no pickup is collected for
  a stretch, giving a soft secondary objective without adding a new input.
- Difficulty escalates across a small number of in-run "pipe sections"
  (storm drain → main line → treatment chamber), each raising obstacle
  density/speed and progressing through the three pipe cross-sections
  below as a structural difficulty ramp, until a fail-on-hit condition ends
  the run and shows a score.

## Pipe cross-sections

The pipe's traversable arc changes by section, giving one continuous
steering input real environmental variety without adding a new control:

- **Partial arc (~70%)** — the pipe's upper ~30% is silted, collapsed, or
  grated off; Raphael is confined to the lower arc. The most legible,
  lowest-disorientation section type — the default for early/POC sections.
- **Half-pipe (180°, open top)** — a broken or open stretch of pipe where
  the top half is missing; twice the reachable range of the partial arc,
  used for mid-run tension.
- **Full pipe (360°, full loop)** — an intact, fully enclosed pipe Raphael
  can ride all the way around, including upside-down along the top. The
  most dramatic and disorienting option, reserved for a late-run/thrill
  stretch rather than constant use.

Importantly, going further around the pipe (including upside-down on a
full-loop section) is purely a function of **how long** a lean is held,
not a deeper or different tilt angle — the physical input stays a simple
left/right lean throughout, so a full loop never asks for more than the
two directions this genre already uses, just sustained holding.

## Why it fits GoBalance

The source report speculated this footage might be third-party ride/arcade
capture and, on that assumption, cautioned that continuous curve-following
could be too demanding for a lean board, recommending simplification down
to discrete lane choices. That assumption doesn't hold: this is GoBalance's
own in-development build (the dev-only touches visible in the footage —
a "Reloading Domain" loading string, a "Show Playtest" debug button — are
leftover internal tooling, not evidence of third-party origin), and its
continuous hold-to-steer tilt scheme is already working on real hardware.
So instead of downgrading to lanes, this brief designs directly around the
validated continuous mechanic: holding a lean steers Raphael continuously
around the pipe's circumference. The physical-exertion constraint is still
fully respected, because direction *count* — not continuity of motion — is
what that constraint is about: this remains strictly a two-direction
(left/right lean) input, never asks for up/down, and the cross-section
system above adds difficulty through reachable range rather than through
faster or more varied input.

**On the 3D/2D question specifically:** this concept is built as a true
3D-perspective scene (Three.js camera moving down a modeled corridor) per
Amit's explicit direction for this run, not a flat Canvas-2D approach — but
every interactive element (the turtle, crates, drum, pizza) is flat 2D
sprite/billboard art within that 3D space, not modeled 3D geometry. This
keeps the art pipeline and asset production squarely within this
pipeline's usual 2D-sprite workflow while getting the corridor depth and
motion-read the genre needs; see `pipeline/reports/tunnelRef.png` for the
exact "flat sprites inside a real 3D corridor" look this targets.

## Scope tiers

**POC** — A single straight tunnel segment (no camera banking yet) built
in Three.js, using the partial-arc (~70%) cross-section only, continuous
hold-to-steer angular movement (no lane snapping) driving Raphael's
position around that arc, one placeholder turtle sprite, one obstacle type
(crate) as a flat billboard sprite scrolling toward the camera at a fixed
angle, basic overlap/collision detection, no scoring UI, no difficulty
ramp, no pizza pickup, no half-pipe/full-pipe sections yet. Proves the "3D
corridor + 2D sprite + continuous angular steering" render pipeline and
feel are both technically sound and fun before anything else is built.

**MVP** — Full scoring with the pizza-multiplier system, a lives/fail
condition (hit an obstacle → run ends, or a small hit buffer), a difficulty
ramp across 3 in-run pipe-section stages with cosmetic camera
banking/curve on the tunnel, all three obstacle types (crate, spinning
drum, pipe girder) plus the pizza pickup, a game-over score screen, and the
half-pipe (180°) cross-section introduced as the mid-run section type
alongside the partial-arc default — two of the three cross-sections in
play. Raphael only, skateboard only, no turtle-select.

**Post-MVP** — The full 360° full-pipe cross-section as a late-run
"thrill" stretch or finale section (including upside-down riding along the
top of the pipe); "choose your turtle" (Leonardo/katana-balance trick,
Michelangelo, Donatello), each with a small cosmetic difference in
skate-stance animation; more tunnel-section themes (flooded chamber,
overgrown storm drain, TCRI-adjacent glowing waste zone) as later-run
milestones; more obstacle/pickup variety (rolling barrels, a brief
glide/boost pickup echoing the source footage's ambiguous wings-out pose);
denser late-run obstacle patterns as an in-run difficulty ceiling. All of
this is more in-game content and depth within a single run/session — no
cross-game unlocks, no currency, no IAP.

## Inspired by

- **tunnel.md** — this is the direct source for the entire concept: the
  on-rails forward-auto-scroll structure, the left/right-only steering
  (quoting the report's own quote of the reference game's instructions:
  *"Tilt left or right to avoid the obstacles"*), the specific obstacle set
  (wooden crates, a spinning studded drum, a crossed-pipe girder), the
  pizza-slice pickup and multiplier-decay behavior (x3→x2→x1 observed in
  the sampled footage), and the stone-and-rivet tunnel visual language are
  all taken directly from the report's "What's happening," "Core
  mechanic(s)," and "Visual style notes" sections. The report's own
  provenance guess (that this might be third-party ride/arcade footage) and
  its resulting recommendation to simplify to discrete lanes were both
  superseded by Amit's direct correction during brief revision: this is
  GoBalance's own in-development build, and its continuous hold-to-steer
  tilt input is already working on real hardware — so this brief follows
  that confirmed behavior directly instead of the report's speculative
  lane-based fallback.
- **Amit's direct creative/technical direction for this run** (given at
  task time, not in a notes.txt — the tunnel.md topic folder had no notes
  file): keep this as a true 3D-perspective corridor (camera moving forward
  down a modeled tunnel) rather than translating it into a flat 2D
  equivalent, but build all character/obstacle/pickup art as flat 2D
  sprites/billboards within that 3D space, per the pseudo-3D "2D sprites in
  a 3D corridor" reference look at `pipeline/reports/tunnelRef.png`. This
  is a deliberate, explicit exception to this pipeline's default "2D only"
  posture for this concept, not a reinterpretation of the constraint
  generally. Amit's follow-up revision (this pass) additionally corrected
  the movement model from discrete lanes to continuous hold-to-steer
  angular movement, and introduced the partial-arc/half-pipe/full-pipe
  cross-section system as a way to vary difficulty and visual drama without
  changing the two-direction input.

## Concept frame

Prompt used (also saved to `concepts/prompt.txt`):

> Video game key art blending two art directions: the composition and
> rendering technique of a true 3D-perspective corridor (converging tunnel
> walls, deep receding vanishing point, tunnel curving into the distance)
> combined with the rough, painterly, hand-drawn-over-CG character and prop
> illustration style of the Mutant Mayhem-era TMNT movies. A teenage mutant
> ninja turtle wearing a red mask and red wrist wraps rides a skateboard
> down the center of a glowing green safe-path lane through a dark, wet,
> stone-and-rivet sewer tunnel that curves and recedes into the distance in
> genuine 3D perspective. The turtle and all obstacles/pickups (wooden
> crates, a spinning studded metal drum obstacle, a floating pizza slice
> pickup with a small sparkle) are rendered as flat, cel-shaded 2D
> sprite-style illustrations -- like paper cutouts or trading-card art,
> rough sketchy linework, textured painterly shading -- placed as flat
> billboards within the 3D tunnel space, NOT as fully modeled 3D geometry,
> deliberately contrasted against the volumetric, perspective-correct
> tunnel architecture around them. Moody teal-green ambient tunnel
> lighting, occasional graffiti tags on the wet stone walls, splashes of
> water at the turtle's feet. Wide 16:9 game key art framing, dynamic
> action pose, mid-dodge lean to one side, third-person view from just
> behind and above the turtle.

Generated with `nano-banana-pro`, using two *Mutant Mayhem*-era reference
stills from `/Users/eladayzen/Documents/tmnt/` (`Leonardo_Mutant_Mayhem.webp`,
`Michelangelo2023.webp`) plus `pipeline/reports/tunnelRef.png` as a
composition/technique reference for the 3D-corridor-with-flat-sprites look,
as style/mood guidance. Four variations are in `concepts/concept-01.png`
through `concepts/concept-04.png`. Note: these frames still show the
original single-safe-lane composition — the movement-model and
cross-section revision above is a text-only design update and wasn't
re-rendered into new concept art (the "3D corridor with flat sprites" look
they establish is unaffected by the lane→continuous-steering change).
