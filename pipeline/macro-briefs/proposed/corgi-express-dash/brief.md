---
status: proposed
track: general
source_reports: [laneRunner.md]
---

# Corgi Express: Downtown Dash

**One-sentence hook:** A stubby-legged corgi courier bolts down a busy
downtown street, weaving between three lanes and hopping the occasional
low obstacle while a grumpy mail-sorting robot chases behind, gulping down
bones and mail-stamp coins to keep its PURSUIT meter from maxing out and
catching him.

**Genre:** 3-lane endless runner — discrete left/center/right lane
switching plus a sparingly-used jump, with a pursuit-meter tension
mechanic standing in for the genre's usual instant-death-on-hit.

## Core loop

- Continuous forward auto-run down a scrolling downtown street (a real
  3D-perspective Three.js scene, not a flat Canvas); the player never
  controls speed or forward motion, only the corgi's lane and jump timing.
- The corgi occupies one of 3 street lanes at a time. A left lean shifts
  him one lane left, a right lean shifts one lane right. A distinct
  up-lean triggers a jump. **There is no down input anywhere in this
  design** — no slide, no duck, no crouch-under obstacle type exists at
  all.
- Most obstacles (traffic cones, food carts, parked delivery scooters) are
  ordinary lane-blockers dodged purely by lane switching. **Exactly one
  obstacle type — a low sprinkler-hose barrier stretched across the road,
  always the same silhouette and color — requires a jump**, and it is
  always telegraphed well ahead of the player (a distinct warning glint/
  sound cue a full beat before it's reachable) and never spawned alongside
  a lane-choice moment, so the player is never asked to decide "which
  lane" and "jump or not" in the same instant. Jump obstacles are
  deliberately rare — a once-in-a-while event, not a recurring pattern.
- A mail-sorting robot chases behind (staged as a strong, readable
  silhouette over the corgi's shoulder) driving a PURSUIT meter top-left of
  the HUD: getting clipped by an obstacle fills the meter; passing through
  a lane with a bone (fast drain) or mail-stamp coin (slow drain) — both
  auto-collected on overlap, no separate input — empties it. Meter reaching
  full = the robot scoops up the corgi, run over.
- A rare squeaky-toy pickup triggers a few seconds of automatic
  invulnerable "zoomies" dash-through, collected passively like bones/coins
  with no added input — the run's only power-up.
- Difficulty escalates across a handful of in-run street segments (market
  block → busy crosswalk → construction detour), each raising obstacle
  density and the robot's base fill-rate — but the jump obstacle's rarity
  and telegraph window stay intact even at the hardest segment; only
  lane-dodge density and pace increase, never jump frequency or
  jump-plus-lane-change stacking — until the PURSUIT meter maxes out and
  the run ends on a score screen.

## Why it fits GoBalance

**On the genre-fit problem specifically (per Amit's resolved direction for
this run):** this keeps the classic 3-lane structure rather than
collapsing to a single-lane dodge, and keeps both left/right lane-switching
and jump — but drops slide/duck entirely, so no down-input or crouch-under
mechanic exists anywhere in this design. That's 3 of GoBalance's 4
directions, never all four, and never up/down interleaved with left/right
at speed. Even so, a 3-direction combo is treated here as *physically
harder* than the genre's native phone-swipe tempo, not just "technically
compliant" — so overall pace is tuned noticeably slower than native Subway
Surfers tempo (the report's own footage shows obstacles clustering roughly
once a second or faster at speed; this design keeps meaningful decision
gaps well above that). Jump specifically — the physically hardest of the
three inputs on a lean board — is used sparingly and deliberately: one
clearly-telegraphed obstacle type, always signaled a full beat ahead, never
clustered, and never asked for in the same moment as a lane-change
decision. The PURSUIT meter's hit-buffering (a single clip doesn't end the
run, it just fills a meter) further softens the physical ask — a missed
dodge costs meter progress, not the run, so neither lane changes nor the
occasional jump ever need to land in a split-second reflex window to avoid
instant failure.

**On meta-progression specifically:** the source game's persistent coin
bank, cross-run missions, and carried-over score multiplier (10,144 coins
and a x2 multiplier visible in the report's captured session) are
deliberately not carried into this design. Bones, coins, and the PURSUIT
meter all reset to zero at the start of every run; there is no persistent
currency, no cross-run mission list, no unlock web. The only thing that
persists between runs is a simple best-score-this-session display (an
ordinary arcade high-score stat, not a system) — everything else lives and
dies inside a single run, per this pipeline's permanent no-IAP/no-deep-meta
constraint.

**On the 3D/2D art direction specifically:** the street environment is a
real 3D-rendered Three.js scene (buildings, road, sidewalk geometry with
flat 2D textures on every surface — the retrospective's TubeGeometry/
path-following corridor technique adapted to a flat street path rather than
a tube), pushed further toward "reads as 2D" than the TMNT sewer-tunnel
precedent by keeping every surface texture flat and unshaded-3D-looking.
The corgi himself is built as a layered cutout-rig — separate flat sprite
parts for torso, legs (four, for a proper trotting/galloping gait), ears,
and tail — driven by simple per-part rotation for the run cycle and
lane-shift lean, rather than whole-body PNG swaps, echoing how well
TmntSkateSlice's sprite-based character art landed and opening a smoother
animation path (bouncy ears, a wagging tail) than a single flat billboard
would. Obstacles and pickups stay simple flat billboard sprites — no rig
needed for objects that don't need a run cycle.

## Scope tiers

**POC** — A single straight street segment (no camera banking/curve yet),
3 fixed lanes, one placeholder single-image corgi sprite (no cutout rig
yet) snapping between lanes on left/right lean, jump as a simple hop arc on
up-lean, one lane-blocking obstacle type (traffic cone) and the one
jump-obstacle type (sprinkler-hose barrier) as flat billboard sprites,
basic overlap/collision detection, no PURSUIT meter yet (or a simple
static distance counter), no bones/coins, no scoring UI, no difficulty
ramp. Proves the "3D street + 2D sprite + 3-lane dodge + occasional jump"
feel is fun and physically comfortable before investing in the rig or
meter.

**MVP** — Full PURSUIT meter system (fill on hit, drain on pickup,
meter-full = caught/game over), bone and coin scoring, the cutout-rig
corgi with a real run/lane-shift/jump animation, all obstacle types (2-3
lane-blockers plus the one telegraphed jump-obstacle), the squeaky-toy
zoomies pickup, a difficulty ramp across 3 in-run street segments (market
block → busy crosswalk → construction detour) that visibly brings the
robot closer as tension rises while keeping jump rare and
always-telegraphed at every difficulty tier, and a game-over score screen.
One corgi look only, no character-select.

**Post-MVP** — A small set of cosmetic courier outfits/breeds (unlocked
in-run via a milestone or simple menu choice, no currency involved), more
street-district themes (harbor docks, park path, subway entrance
approach), more obstacle/hazard variety (a two-lane-wide delivery-truck
hazard forcing a specific remaining lane, a rolling shopping cart), a
bigger/faster or multi-robot pursuit escalation appearing at deep-run
milestones as a visual tension cue, and denser late-run lane-dodge patterns
as the in-run difficulty ceiling — jump frequency/telegraph rules stay
fixed even here, this dimension never gets harder. All of this is more
in-game content and depth within a single run/session — no cross-game
unlocks, no currency, no IAP.

## Inspired by

- **laneRunner.md** — the genre and full mechanic vocabulary are pulled
  directly from the report: the confirmed Subway Surfers identification
  ("the footage confirms this directly... this is genuinely the
  genre-defining title itself"), the lane-switch/jump/slide/coin/power-up
  core mechanic list, and — most load-bearing — the report's own "Input
  demand" section, which explicitly flags that "the *combination* of fast
  left/right lane corrections with equally fast up/down jump-or-slide
  reactions is exactly the 'requiring all four directions in a fast
  action/timing mechanic' case," and recommends to "either drop to
  left/right-only lane switching (auto-resolving or removing jump/slide),
  or slow the pacing substantially." This brief, per Amit's specific
  follow-up resolution for this run, takes a third path between those two:
  keep the 3-lane structure and jump, drop slide/duck entirely, and treat
  jump as a rare, telegraphed, never-stacked event while slowing overall
  pace well below native tempo — satisfying both the direction-count
  constraint and the "even 3 directions is more effortful on a board than a
  phone" spirit behind the report's caution. The report's hoverboard/
  jetpack power-ups are reframed into the single squeaky-toy zoomies
  pickup; the persistent coin bank/mission/multiplier system observed in
  the report ("Mission Set 1... x2 multiplier... 10,144 coins") is
  explicitly redesigned as in-run-only. The report's staging note — "Chase
  characters (guard, dog) are staged with strong, readable silhouettes
  even viewed from behind at a distance — useful reference for 'visible
  threat over the shoulder' staging if a chase mechanic is ever wanted" —
  is taken up directly for the mail-sorting robot's staging.
- This is the general-track counterpart to the TMNT-track
  `half-shell-hustle` brief above, following this pipeline's default of
  proposing one brief per track per run — same source report and resolved
  mechanic, a distinct non-licensed theme (a courier corgi vs. a
  mail-sorting robot) rather than a forced reskin, in the same spirit as
  the existing `comet-chute-dodger` / `tmnt-sewer-slide-dodger` pairing
  from `tunnel.md`.
- No `notes.txt` was available for this report's topic folder ("No notes
  file was present in this folder" per the report itself), so there is no
  Amit-written note to quote here beyond his direct task-time direction
  below.
- **Amit's direct task-time direction for this run:** the concrete
  genre-fit resolution quoted and implemented above (keep 3-lane structure
  and jump, drop slide/duck, treat jump as rare/telegraphed/never-stacked,
  pace slower than native tempo even though 3 directions is technically
  compliant); and the art/technical push to make this look further "2D"
  than the tmnt-sewer-slide-dodger precedent — real 3D environment, 2D
  textures throughout, and a cutout-rig-style layered sprite character
  rather than a single flat billboard, echoing TmntSkateSlice's landed
  sprite art — both implemented directly above.

## Concept frame

Prompt used (also saved to `concepts/prompt.txt`):

> Video game key art blending two techniques: a real 3D-perspective
> downtown city street environment (converging road lines, storefronts and
> streetlamps receding into a bright afternoon vanishing point, three
> visible traffic lanes running straight toward the camera) rendered with
> flat 2D textures on every surface, combined with flat, cel-shaded 2D
> cutout-style character and prop illustration -- like layered paper-doll
> parts, bold clean outlines, bright saturated colors -- placed within that
> 3D space rather than modeled as solid 3D geometry. A stubby-legged corgi
> wearing a tiny courier vest and a mail satchel sprints down the center
> lane of the street, ears flapping, caught mid-lane-change lean toward the
> camera, kicking up cartoon speed-line dust clouds behind his paws. To the
> left, a bright orange traffic cone fully blocks that lane; to the right,
> a colorful food cart fully blocks that lane; directly ahead in the open
> center lane, a floating dog bone and a spinning gold mail-stamp coin
> hover invitingly. In the far distance behind the corgi, a boxy, irritable
> mail-sorting robot on wheels chases in pursuit with arms outstretched,
> staged as a strong, instantly readable silhouette against the sunny
> skyline. In the top-left corner of the frame, a stylized glowing
> "PURSUIT" meter HUD bar sits partially filled; top-right shows a small
> score-and-coin HUD readout. Bright, cheerful, saturated color palette,
> striped shop awnings, string lights, potted plants, a light comic mood.
> Wide 16:9 game key art framing, dynamic action pose, third-person view
> from just behind and above the corgi.

Generated with `nano-banana-pro`, no reference images (general track, no
style anchor required — the technique was described directly in the
prompt). Four variations are in `concepts/concept-01.png` through
`concepts/concept-04.png`.
