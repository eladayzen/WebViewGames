---
status: proposed
track: general
source_reports: []
origin: direct-request
---

# Hill Bomb: Sunset Ridge

**One-sentence hook:** Rae bombs a long coastal ridge road at golden hour,
carving freely across the full width of the tarmac — holding a straight
line to build terrifying speed and score, carving hard to scrub it back off
before a SPEED WOBBLE meter tears the board out from under them — with
tricks off kickers and rails that fire off cinematically on their own and
only *reward* extra input, never demand it.

**Genre:** Third-person downhill skate descent. Free continuous
side-to-side movement (explicitly **not** lanes), gravity-driven speed the
player shapes purely by how much they carve, and an opt-in trick layer.
The whole game is one tension curve: **speed is the score, and speed is
also the thing that kills you.**

> **Note on `source_reports`:** this brief has no upstream video-analyst
> report — it came from Amit's direct request for a third-person
> skateboarding game built in the `HalfShellHustle` production method. It
> is deliberately recorded as `source_reports: []` rather than borrowing an
> unrelated report's id, so stage 2's idempotency check (which reads
> `source_reports` to decide what's already covered) isn't misled into
> thinking `laneRunner.md` has a second general-track proposal.

## The controller reality this design is built around

Amit's direct, load-bearing note for this concept, which shaped every
mechanic below and must not be softened downstream:

> *"It's not as easy to control as regular, you know, like mobile or WASD
> on keyboard controller or gamepad. It's a bit harder. So when we plan for
> a game like this, it's not like super easy to lean forward and lean
> backwards."*

Two consequences, treated as hard design constraints rather than
preferences:

1. **Side-to-side lean is the comfortable axis. Forward/back lean is
   not.** A rider standing on a balance board can hold and modulate a
   left/right lean all day — it's the natural axis of the equipment. Tipping
   forward or backward is a genuinely harder, more committed, more tiring
   motion with worse fine control.
2. Therefore: **this game's entire core loop runs on the left/right axis
   alone.** Forward lean is not used at all. Back lean is used for exactly
   one thing, it is optional everywhere it appears, and nothing in the game
   can be lost by never using it.

The design below is what falls out of taking that seriously — and it turned
out *better*, not more limited, because it forced the speed system onto the
one axis the hardware is actually good at.

## Core loop

- Continuous forward roll down a long descending ridge road. **There is no
  auto-scroll and no fixed speed** — speed is genuinely simulated: the road
  grade accelerates Rae, and the player shapes that speed entirely through
  how much they carve. This is the biggest structural break from this
  pipeline's existing runners, where forward speed is a constant the player
  never touches.

- **Carving (analog left/right lean) is the whole game.** It moves Rae
  continuously across the full width of the road — no lanes, no discrete
  slots, no snapping, free positioning anywhere on the tarmac. And because
  a turn across the fall line is what physically bleeds speed, the *same
  input* is also the brake: a gentle lean is a lazy drift that costs almost
  nothing, a hard committed carve visibly scrubs speed.

- **Speed comes from doing nothing.** Holding the board neutral and level —
  the restful posture, the one that costs the player no effort at all —
  means Rae holds a straight line down the fall line, automatically drops
  into a tuck, and accelerates. **There is no forward lean, no tuck button,
  no charge input.** The physical ergonomics and the risk curve point the
  same direction: relaxing is fast and dangerous, working is slow and safe.
  That inversion is the design's central idea, and it exists specifically
  because forward lean was ruled out.

- **The SPEED WOBBLE meter** (top-left HUD) is the run's entire fail
  condition, replacing instant-death-on-hit:
  - it **fills continuously whenever Rae is above a "settled" speed
    threshold**, at a rate scaling with how far over that threshold they
    are;
  - it **spikes** on any clip (cone, pothole, parked car, curb caught
    wrong) and on a rough landing;
  - it **drains while carving** — a committed turn is what physically
    settles a wobbling board — and takes a chunk of drain on every clean
    trick landing;
  - below the settled threshold it slowly self-drains, so a cautious rider
    can always survive indefinitely; they just score very little;
  - **full = Rae loses the board and eats pavement**, run over, score
    screen.

  Net effect: the player is constantly, gently negotiating one continuous
  question — *how long dare I hold this line before I sit up and carve it
  off* — using only the axis the board is comfortable with.

- **Tricks fire on their own; the optional input only upgrades them.**
  Steering onto a kicker ramp, rail, or ledge is enough — Rae launches,
  a trick sequence auto-plays, and a clean landing pays out. On top of
  that, an optional **back-lean pop**, timed near the lip, upgrades the
  launch into a bigger air and a higher-value trick with a score
  multiplier. Popping is never required to survive, to progress, to clear
  anything, or to reach any section. A player who never leans back once
  can play the entire game, land every trick prop they steer onto, and
  finish a full run — they simply score less than someone who works for it.
  **This is where the hardest physical input in the game lives, and it is
  deliberately parked on a pure bonus.**

- **Obstacles never kill.** Cones, potholes, sandwich boards, parked cars,
  fallen branches are avoided by carving around them; clipping one costs a
  wobble spike and a speed scrub, never the run. **No obstacle requires a
  pop, a jump, or any vertical input to survive** — every hazard is
  avoidable purely laterally, and the few curbs and cracks that a pop would
  smooth over are also perfectly survivable by rolling straight through
  them for a small wobble spike.

- **Trick props are pure opt-in reward.** Kickers, rails, ledges, driveway
  banks are always placed to one side of a clean line, never across it.
  Ignoring every trick prop in the game is a valid, survivable, low-scoring
  way to play.

- **No collectibles and no power-ups at MVP** — deliberately. Score is
  distance × speed tier + trick points × chain. Coins or a
  temporary-invulnerability pickup would flatten exactly the risk/reward
  curve that makes this design work, so both are explicitly excluded rather
  than forgotten.

- Difficulty escalates across in-run **sections of the same continuous
  descent** — Ridge Top → The Switchbacks → Downtown Straight — each
  steepening the grade (so top speed rises and the wobble threshold gets
  easier to blow past), narrowing the ridable width, and thickening prop
  density. There is no artificial speed step-up: the road gets steeper and
  everything else follows from that.

## Why it fits GoBalance

**On input demand.** Counting axes: **one is used continuously (left/right),
one is used optionally and never under duress (back lean), and forward lean
is not used at all.** That is a lighter physical ask than every other brief
in this pipeline, including `half-shell-hustle`'s three-direction
resolution — and it's lighter *specifically* on the axis Amit flagged as
hard. There is no moment anywhere in this design where the player must
produce a fast forward/back motion to avoid a bad outcome.

**On reaction speed.** There are no discrete "which lane, now" decisions,
because there are no lanes. Steering is a posture held over seconds, not a
sequence of snap inputs. The one time-sensitive input in the game (the pop
near a kicker's lip) is optional, is approached over a long, visible
run-up the player chose to steer toward, and costs only points if missed —
never the run, never progress.

**On effort mapping.** The neutral, restful board posture produces the
fast, high-scoring, high-risk state, and active physical work (carving)
produces the safe, slow, low-scoring state. A tiring player naturally
drifts toward *more* speed and *more* score, not less — the failure mode of
fatigue is an exciting death, not a boring stall. For a product used during
physical activity, that curve is the right way round.

**On the physical product specifically:** this is the first concept in this
pipeline where the controller and the fiction are literally the same
object. The player stands on a board and leans to make a character on a
board lean. Carving to scrub speed and settling a wobble by turning are
real skateboarding technique mapping one-to-one onto real balance-board
posture. That alignment is the strongest single argument for this concept.

**On input mode:** **analog** — `forwardSteeringKeys = false`, the game
reads `window.__gbSensor = {x, y}` itself. The x component drives the carve
continuously; the y component is read *only* to edge-detect the optional
pop, and never for a sustained posture. The game must never also listen for
the host's synthetic arrow keys (the SDK's double-input gotcha). Because
analog mode ships no hysteresis of its own, the pop's edge detection needs
the game's own press/release thresholds — and given Amit's note that back
lean is physically harder, those thresholds should be **more forgiving than
the SDK's digital-mode defaults** (which press at 0.35 / release at 0.20),
with a generous timing window around a kicker's lip rather than a tight
frame-accurate one. A desktop keyboard fallback for dev writes into the
same internal input vector; it is not a second input path.

**On meta-progression:** nothing persists between runs except a
best-score-this-session display. No currency, no coin bank, no unlock web,
no IAP — permanent product constraint, not a v1 cut. The Post-MVP board/
outfit variants below are cosmetic and unlocked in-run or picked at session
start, never bought with anything earned in a prior run.

## Feel and presentation target

Amit's second load-bearing note: this should read as **"much more action,
like a triple-A skateboard game, than what we did in Half-Shell Hustle."**
`HalfShellHustle`'s camera is a fixed follow rig that eases sideways and
does very little else. That is not the target here. Concretely:

- **Camera is attached behind the rider, but alive.** Behind and slightly
  above, riding low and close to the deck. It rolls into the carve, trails
  with a little lag on a hard turn so the rider leads the frame, and pulls
  back and widens FOV as speed climbs so the descent physically *feels*
  faster the more dangerous it gets.
- **The camera breaks its rig for tricks.** On a launch it swings — orbiting
  toward a lower, wider, more cinematic angle through the air, following a
  backflip or spin around rather than staring at the rider's back, then
  settling back behind them on landing. This is the single most
  "triple-A skate game" element in the whole design and should be
  prototyped early, not treated as final polish.
- **Speed is sold with screen effects, not just numbers:** speed lines,
  motion streaking at the frame edges, wheel dust and tarmac scuff, camera
  shake that starts creeping in as the wobble meter approaches full, and a
  visible physical wobble in the board and rider's stance well before the
  wipeout — the fail state should be *felt* coming for a couple of seconds,
  not sprung.
- **Impact and material feedback:** sparks and a rising metallic scrape on
  a grind, a hollow wooden knock off a kicker, a heavy scuff on a hard
  carve, a thud-and-tumble on a wipeout. Audio carries a disproportionate
  share of "AAA feel" for the effort it costs.
- **Landings are dramatic, not fiddly.** A clean landing gets a compression
  dip in the camera, a dust puff, and a score popup — the *presentation* of
  a skill moment without a skill-check input behind it.

## Production method — what "high production value" means concretely here

Amit's ask was explicitly for this game to be built in the method
`HalfShellHustle` arrived at. That method is documented in that game's own
source, and it is not just "use Kolbo for art" — it's a set of specific,
hard-won rules. Restating them so stage 3/4 inherit them rather than
rediscovering them:

**1. Real 3D scene, every surface a real illustrated 2D texture.** Three.js,
unlit `MeshBasicMaterial` on environment geometry so painted-in shading
reads as drawn instead of being re-shaded by scene lights — exactly
`HalfShellHustle/src/street/street.js`'s approach. **Never** a
procedurally-drawn `<canvas>` grid/tile pattern: that's the
`Astro_Tunnel`/`TmntSewerSlide` anti-pattern
`WEB_MINIGAME_TECH_RETROSPECTIVE.md` corrects on 2026-07-26, and it's the
difference between "3D game with a 2D feel" and "generic proceduralized 3D".

**2. Environment art lives in a per-theme data module.** Follow
`HalfShellHustle/src/data/envArt.js`: themes keyed by name so a second can
be built without disturbing a locked first, and **every texture entry
carries its real pixel dimensions** so geometry is sized to the art's own
aspect ratio instead of stretching a portrait crop across a wide face —
that mismatch caused that game's smeared first pass.

**3. Character art is one-lineage, batched, on a fixed shared canvas.** The
most expensive lesson in `HalfShellHustle/src/data/playerSprite.js`: frames
generated in separate unrelated batches never agree on scale, canvas, or
style. Every frame of a set must trace to one seed image, generated
together as one multi-panel grid in a single call (per the
batch-prompt-character-sprite-sets rule), sliced at a *shared fixed cell
rectangle* with **no per-frame alpha-bbox crop** — per-frame cropping makes
the billboard's center anchor drift sideways between poses. Where poses
legitimately differ in height, anchor on a physically stable landmark (that
game used headband width for scale, headband-center for x, a shared ground
line for y) rather than the full-body bounding box. Here the helmet is the
natural equivalent landmark.

**4. Kolbo tool discipline.** Anchor via `generate_image` (`gpt-image-2`
when a clean cutout matters — it actually respects "no baked shadow"); every
subsequent sprite via `generate_image_edit` seeded off that anchor
(`nano-banana-pro/edit` for restyles and small deltas,
`gpt-image/1.5-image-to-image` for genuine pose changes). Background removal
is done **locally** — `tools/kolbo-assets/remove_white_bg.py` — because
Kolbo's `edit_image(operation:"removebg")` is broken. Flatten transparent
PNGs onto real white before re-uploading as an edit source.

**5. Palette lesson, inherited.** `HalfShellHustle`'s first dusk-toned art
pass was rejected in playtest as reading grim/twilight rather than alive,
and re-locked to bright daylight. This game's golden hour must read **warm,
saturated, alive** — late-afternoon sun, long warm shadows, glowing ocean
haze — explicitly *not* moody blue twilight. Props spawning far out must be
warm/dark/saturated enough to read against sky and distance fog instead of
popping in late (the same reason that game's platform art was biased warm
and dark).

**6. On 3D assets — where they're genuinely warranted.** The default stays
flat billboard sprites for anything the camera merely passes: props,
hazards, roadside dressing, the rider. But this game has a category the
lane runners didn't: **geometry the skater physically rides *on*.** Kicker
ramps, grind rails, ledges, curbs, and the road surface itself need real 3D
geometry, because a billboard can't be stood on, launched off, or ground
along. That's not a new dependency — it's exactly what `HalfShellHustle`
already does with its platform box/ramp (`PLATFORM_BOX_TEXTURE` /
`PLATFORM_RAMP_TEXTURE` tiled onto real meshes): **primitive geometry
(boxes, wedges, cylinders) wearing tiled Kolbo textures**, not imported
models. Verify a tiling texture actually tiles seamlessly along its own axis
before shipping — that game discarded a diagonal-stripe ramp texture for a
visible phase-mismatch seam.

Kolbo's `generate_3d` is therefore an **escape hatch, not a plan**:
justified only if some silhouette genuinely can't be built from primitives
*and* can't be a billboard. Nothing in the MVP scope is expected to need
it; reaching for it should be a deliberate, flagged decision.

**7. The rider sprite has to cover a wider pose range than Leo did**, because
the camera moves around it during tricks (see Feel and presentation). A
pure always-faces-camera billboard will break the moment the camera swings
through an air. Two viable answers for stage 3 to pick between: generate the
air-trick frames as a short *rotational* set (the rider seen from a couple
of angles through the flip, swapped as the camera orbits), or keep the
camera's trick swing constrained enough that a single billboard set still
reads. Flagged here rather than resolved — it's the one place this concept's
camera ambition and its 2D-sprite method genuinely pull against each other,
and it should be prototyped at POC, not discovered at art-pass time.

## Scope tiers

**POC** — One straight descending road segment at a fixed grade, full-width
free continuous analog carving (no lanes), a single placeholder rider
billboard, the gravity + carve-scrub speed model with a raw speed readout,
and one lateral hazard type (cone) costing a speed scrub on contact. No
wobble meter, no tricks, no rails or kickers, no sections, no real art. The
camera can stay a simple follow rig here, but the **trick-swing camera
should get a bare prototype** alongside it (§7's open question). **The
question this tier answers is: does carving to control speed on a balance
board feel good, using only the side-to-side axis?** Everything else is
downstream of that one feel — nothing else gets built until it's confirmed.

**MVP** — Everything in POC, plus: the full SPEED WOBBLE meter (speed-driven
fill, hit spikes, carve drain, clean-landing drain, self-drain below
threshold, full = wipeout, with the pre-wipeout shake/board-wobble warning);
auto-triggered tricks on kickers/rails/ledges with the **optional** back-lean
pop upgrading them; 3–4 lateral hazard types and 3 trick-prop types; score as
distance × speed tier + trick points × chain multiplier; three in-run
sections down one continuous descent (Ridge Top → The Switchbacks →
Downtown Straight) with real steepening grade, narrowing width, rising prop
density; the full action-camera pass (speed-linked FOV/pullback, carve roll
and lag, the trick swing, landing compression, wobble shake); the speed and
impact VFX/audio pass; a full real-art pass per the production method —
one-lineage rider sprite set (neutral roll, two carve depths per side,
straight-line tuck, pop/launch, 2–3 rotating four-frame air-trick sequences,
grind pose, land, stumble, wipeout), illustrated road/curb/guardrail/
roadside/ocean-horizon textures, tiled ramp/rail/ledge textures; a game-over
score screen on the SDK's exact DOM contract. One rider look, one board, no
character select.

**Post-MVP** — Harbor Boardwalk as a fourth, fastest finale section, plus a
proper "you made it to the bottom" run-complete state as an alternative
ending to wiping out; cosmetic decks and rider outfits picked at session
start or unlocked at an in-run milestone, never with currency; more trick
props (a hydrant, a stair set with a handrail, a banked driveway); an
optional manual grind-balance layer (gentle carve input to hold a rail
longer for escalating points) — optional, never required; a rival skater
bombing the hill alongside as a pacing/tension cue rather than a collidable
entity; a ghost line of your own best run this session; an *optional* deep
forward-lean tuck for extra speed, explicitly deferred to here rather than
MVP precisely because forward lean is the hard axis and nothing should
depend on it. All in-run/in-session content — no cross-game unlocks, no
currency, no IAP, ever.

## Inspired by

- **Amit's direct task-time direction for this run** (this brief's actual
  origin, in place of a video-analyst report), in three parts, all
  implemented above:
  1. A skateboarding game, third-person with the camera behind the skater,
     built in the high-production-value method arrived at on
     `HalfShellHustle` — a real 3D web scene integrating Kolbo-generated 2D
     assets and textures, with real 3D assets permitted *"if really
     needed"* → Production Method §1–§6, with the narrow, honest
     justification for real geometry (things you ride *on*) and
     `generate_3d` flagged as an escape hatch rather than a plan.
  2. *"It's not as easy to control as regular... mobile or WASD on keyboard
     controller or gamepad... it's not like super easy to lean forward and
     lean backwards"* → the entire input model was rebuilt around this: the
     forward-lean tuck an earlier draft of this brief relied on was
     **removed outright** and replaced by "hold a straight line and you
     tuck automatically", and the back-lean pop was demoted from a required
     jump input to an optional score bonus with deliberately forgiving
     thresholds. See "The controller reality this design is built around".
  3. *"We're not doing three lanes, we're doing free continuous movement
     from side to side... the camera should be relatively attached or
     pointing behind the player, maybe a little bit changing when he does
     the backflip... much more action, like a triple-A skateboard game than
     what we did in Half-Shell Hustle"* → free full-width analog positioning
     with no lane structure anywhere in the design, and the "Feel and
     presentation target" section, whose trick-swing camera is called out
     as a POC-tier prototype rather than late polish.
- **`HalfShellHustle` itself** — not as a template to reskin (this repo's
  standing no-cross-game-templating rule holds, and this design shares none
  of its lane structure, chase antagonist, pickups, or fail condition), but
  as the source of the *production* lessons quoted concretely above: the
  per-theme `envArt.js` structure with real pixel dimensions, the
  one-lineage/fixed-canvas/no-per-frame-crop sprite rule, the warm-palette
  playtest correction, the rotating multi-sequence animation pattern reused
  here for air tricks, and tiled-texture-on-primitive-geometry reused here
  for ramps and rails. Its camera is explicitly the thing this game is
  meant to *exceed*, per Amit's note.
- **`WEB_MINIGAME_TECH_RETROSPECTIVE.md`'s 2026-07-26 correction** — that
  environment surfaces need real Kolbo-illustrated art rather than
  procedurally-drawn canvas patterns. A hard requirement here, not a
  preference.
- **`Astro_Tunnel` / `TmntSewerSlide`'s analog-mode precedent** — the
  established reason a game reads `window.__gbSensor` directly instead of
  taking synthetic arrow keys: genuinely proportional positioning that would
  otherwise have to be re-derived by quantizing. This game needs that same
  continuous positioning on x, and reads y only for the optional pop edge.
- **The real sport** — the loop is built from actual downhill-skate
  technique rather than invented arcade verbs: bombing a hill, tucking for
  speed, carving across the fall line to check it, and speed wobbles as the
  genuine failure mode of going faster than you can hold. "Speed is the
  score and speed is what kills you" isn't a designed abstraction, it's
  just what the sport is.

## Concept frame

Prompt used (also saved to `concepts/prompt.txt`):

> Video game key art blending two techniques: a real 3D-perspective
> downhill road environment -- a wide two-lane coastal ridge road plunging
> steeply away from the camera, guardrails and telephone poles converging
> toward a golden-hour vanishing point, a glittering ocean and a small
> sunlit downtown visible far below at the bottom of the hill -- rendered
> with flat, illustrated 2D textures on every surface, combined with flat
> cel-shaded 2D cutout-style character and prop illustration with bold
> clean black outlines and bright saturated color blocks, placed within
> that 3D space rather than modeled as solid 3D geometry. In the center of
> frame, seen from directly behind and slightly above, a teenage skater in
> an oversized hoodie, helmet and knee pads bombs the hill on a longboard,
> caught mid-carve leaning hard into a turn across the road with one arm
> swept out for balance, the board tilted up on its edge, cartoon
> speed-lines and a small dust scuff trailing behind the wheels. To one
> side of the road ahead, a bright orange traffic cone and a cracked
> pothole; to the other side, a wooden kicker ramp and a low metal grind
> rail sitting invitingly off the main line. In the top-left corner of the
> frame, a stylized glowing "SPEED WOBBLE" meter HUD bar sits partially
> filled; top-right shows a small speed-and-score HUD readout. Warm,
> saturated late-afternoon golden-hour palette -- long warm shadows across
> the tarmac, glowing amber haze over the ocean, palm trees and hillside
> houses along the roadside -- bright and alive, absolutely not dark or
> moody twilight. Wide 16:9 game key art framing, dynamic action pose,
> third-person view from just behind and above the skater.

Generated with `nano-banana-pro`, no reference images (general track, no
licensed style anchor required — the technique is described directly in the
prompt, matching how `corgi-express-dash`'s concepts were produced). Four
variations are in `concepts/concept-01.png` through `concepts/concept-04.png`.
These four establish the **default riding camera**: behind and slightly
above, low and close to the deck, road plunging to a golden-hour vanishing
point, lateral hazards (cone, pothole) on one side and opt-in trick props
(kicker, rail) off the main line on the other, SPEED WOBBLE meter top-left
and speed/score readout top-right. `concept-01.png` is the strongest single
anchor for palette, linework, camera height and HUD layout.

### Second pass — the trick camera (`concept-05` / `concept-06`)

The four frames above were generated before the triple-A-camera direction
landed, and none of them showed the one thing that most distinguishes this
game from `HalfShellHustle`. A follow-up pass covers it: **the camera
breaking off the rider's back mid-air.** Generated with
`gpt-image/1.5-image-to-image` using `concept-01`'s Kolbo URL as the single
`source_images` entry (per `KOLBO_ASSET_PIPELINE.md`'s guidance that
genuine pose/camera changes belong on that model rather than
`nano-banana-pro/edit`), so character design, linework, palette, world and
HUD all carry over on-model rather than being reinvented. Prompt saved
alongside in `concepts/prompt.txt`.

`concept-05-trick-camera.png` is the reference frame for this: the rider
inverted through a backflip grab high over the road, camera swung low and
wide to a three-quarter angle looking up at them, spiral motion-blur arcs
tracing the rotation, dust off the kicker lip in the foreground, the
descent and ocean horizon sweeping through behind. **This is the shot the
in-game trick camera should be trying to reproduce in motion**, and the
reason §7's "the rider sprite has to cover a wider pose range than Leo did"
open question exists — a single always-faces-camera billboard cannot
produce this frame.
