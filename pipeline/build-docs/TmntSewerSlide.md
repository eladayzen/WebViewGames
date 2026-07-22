# TMNT: Sewer Slide — Raph's Pipe Run — Game Design & Build Doc
### (Raphael skate-tunnel dodger — GoBalance build, true-3D corridor / flat-2D-sprite exception)

Draft v1 — for implementation by Claude Code. Full spec, placeholder-art-first
where noted. Expanded from the approved macro brief at
`pipeline/macro-briefs/approved/tmnt-sewer-slide-dodger/brief.md`.

---

## 0. IP note & rendering-exception note (read first)

**IP:** this is a **TMNT-themed product** using Raphael, his red mask/wraps,
and the general *Mutant Mayhem*-era visual language — treat character
likeness/name/design fidelity as subject to whatever licensor approval
process applies to final art, same as any other TMNT-branded asset in this
pipeline; that process is outside this doc's scope.

**No IAP, no paid currency, no cross-session meta-progression or unlock web
of any kind — permanent product constraint**, not a v1 cut (see §8 and
§11). This game runs on the GoBalance balance-board product, used during
physical activity; the entire economy this doc specifies is in-run score
and in-game (within-this-game) pipe-section unlocks only.

**Rendering exception (deliberate, not a mistake to "fix"):** this game is
a **true 3D-perspective Three.js corridor** — a real modeled/curved tube
with a camera that rides down it — not a flat Canvas-2D or CSS-parallax
approximation. This is an explicit, one-off exception to this pipeline's
usual "2D only" default, made by Amit specifically for this concept (see
the brief's "Why it fits GoBalance" and "Inspired by" sections). Do not
walk it back or re-interpret it as "should really be 2D" during build.
What stays true to the pipeline's normal 2D-art workflow: **every
interactive element — Raphael, every obstacle, every pickup — is flat 2D
sprite/billboard art placed inside that 3D space, never modeled 3D
geometry.** See §1 and §9.1.

---

## 1. Vision

Raphael skates down a curving, glowing-green sewer pipe on a real
3D-perspective camera path, continuously leaning left or right to steer
his position around the pipe's circular inner wall — not snapping between
lanes, but sliding smoothly to any angle on demand, exactly the way the
lean genuinely works on GoBalance's own hardware. Wooden crates, a
spinning studded drum, and a crossed pipe girder scroll toward the camera
at fixed points around the pipe's currently-reachable arc; pizza slices
drift into open gaps and build a decaying score multiplier. The pipe
itself gets more dangerous not by demanding faster or more varied input,
but by opening up *how much of its circumference* Raphael can reach —
from a tight silted-over lower arc, to a broken half-pipe, to (Post-MVP) a
full 360° loop ridden upside-down along the top. Target feel: a real sense
of depth and speed from genuine 3D perspective, contrasted against
graphic, flat, trading-card-style cutout art for every character/obstacle/
pickup — moody teal-green tunnel light, wet stone and rivets, splashes at
Raphael's feet, always legible at a glance despite the corridor depth.

**Art direction anchor (stage 4 does not own art direction, only points at
it):**
- Concept art: `pipeline/macro-briefs/approved/tmnt-sewer-slide-dodger/concepts/`
  holds five frames — `concept-01.png` through `concept-04.png` (four
  `nano-banana-pro` generations from the brief's prompt, saved alongside
  it in `concepts/prompt.txt`) plus `concept-05.png`, a direct reference
  image supplied by Amit ("Sewer Shredders: Mutant Mayhem" logo treatment
  included in-frame — the logo/title text itself is not part of the art
  spec, just the pose/composition/lighting reference it arrived attached
  to). All five converge on the same target: Raphael mid-lean on a
  skateboard, third-person from just behind/above, in a wet stone-and-
  rivet tunnel with teal-green ambient light, graffiti tags, water
  splashes, a wooden crate and a studded metal drum as obstacles, and a
  sparkling pizza slice pickup — flat, painterly, cel-shaded cutout-style
  character/prop art contrasted against a genuinely deep, converging-wall
  3D corridor. Use all five as a set for palette, mood, and the specific
  "flat sprite inside real 3D depth" look, not a single hero frame.
- Style reference stills: `/Users/eladayzen/Documents/tmnt/`
  (`Leonardo_Mutant_Mayhem.webp`, `Michelangelo2023.webp`) — the *Mutant
  Mayhem*-era reference stills the concept art was generated against, for
  character rendering/linework/shading texture.
- Composition/technique reference: `pipeline/reports/tunnelRef.png` — the
  specific "3D-perspective corridor with flat 2D sprites placed inside it"
  look these concepts target, also the direct technical reference for
  §9.1's rendering approach.
- **Known gap, carried from the brief, not stage 4's to resolve alone:**
  all five concept frames still show the brief's original single-
  safe-lane composition (a glowing lane down the pipe's center) from
  before the design was revised to continuous angular steering with
  varying pipe cross-sections. The frames' *art* (character design,
  tunnel material, lighting, obstacle/pickup look) is unaffected by that
  revision and should be treated as locked reference; the *lane graphic
  itself* should not be built literally as shown — see §5.4 for how
  "reachable arc" should actually read on-screen instead of a single
  painted safe lane.

---

## 2. Scope tiers

### POC
Prove the "3D corridor + 2D sprite + continuous angular steering" render
pipeline and feel are both technically sound and fun, before anything else
is built.
- A single straight tunnel segment (no camera banking/curve yet), Three.js,
  **partial-arc (~70%) cross-section only** — no half-pipe, no full pipe.
- Continuous hold-to-steer angular movement (§4) driving Raphael's `theta`
  around that arc — **no lane snapping, no discrete positions**, even in
  the POC. This is the one mechanic the whole concept lives or dies on;
  simplifying it away would invalidate the POC's own purpose.
- One placeholder Raphael sprite (billboard), fixed forward camera speed
  (no ramp).
- One obstacle type (wooden crate) as a flat billboard sprite, spawning at
  a fixed angle and scrolling toward the camera.
- Basic overlap/collision detection (theta-tolerance-window compare, §5.5).
  A hit ends the run immediately — no lives system yet.
- No scoring UI, no pizza pickup, no multiplier, no difficulty ramp, no
  pipe sections, no half-pipe/full-pipe.

### MVP
The smallest version worth actually shipping as a real GoBalance game.
- Everything in POC, plus:
- **Full scoring** with the pizza-multiplier system (§8), pickups spawning
  at open angular positions.
- A **3-life system with a brief post-hit invulnerability window**
  (precedent: this repo's `Astro_Tunnel`, which already runs this exact
  hit-handling model against a comparable continuous-angular-position
  mechanic — reused here as an established, working pattern, not
  reinvented) — third hit ends the run. Replaces POC's instant-fail.
- **All three obstacle types**: crate, spinning drum, pipe girder (§6).
- **Three in-run pipe sections** — storm drain → main line → treatment
  chamber (§5.4) — each raising obstacle density/speed, with **the
  half-pipe (180°) cross-section introduced** for the section(s) that call
  for it. Two of the brief's three cross-sections are in play at MVP
  (partial-arc default + half-pipe); full pipe is Post-MVP only.
- **Cosmetic camera banking/curve** on the tunnel (replacing POC's
  straight segment) via the same centerline-spline technique already
  proven in this repo's other Three.js tunnel game (§9.1).
- A **game-over score screen** (final score, restart), satisfying the
  GoBalance SDK's exact DOM contract (§7).
- Real 2D sprite art per stage 4's asset pipeline, matching §1.
- Raphael only, skateboard only — **no turtle-select**.

### Post-MVP (backlog — not committed work)
More in-game content and depth within a single run/session. None of this
is meta-progression across sessions/games — it's all deeper content
*within this one game*.
- The **full 360° full-pipe cross-section**, including riding upside-down
  along the top, as a late-run "thrill"/finale stretch (§5.4).
- **"Choose your turtle"** — Leonardo (katana-balance trick cosmetic),
  Michelangelo, Donatello — each a small cosmetic skate-stance/animation
  difference, available from session start (never gated behind anything
  earned in a prior run — see §8).
- More tunnel-section themes as later-run milestones: flooded chamber,
  overgrown storm drain, TCRI-adjacent glowing waste zone.
- More obstacle/pickup variety: rolling barrels, a brief glide/boost
  pickup (echoing the source footage's ambiguous wings-out pose).
- Denser late-run obstacle patterns as an in-run difficulty ceiling.
- Explicitly **not** in Post-MVP, ever: any real-money purchase, any
  currency/gacha/unlock-web system spanning sessions or games (§11).

---

## 3. Core loop

Scoped to MVP; inline notes mark what's POC-only (simplified) or
Post-MVP-only (deferred).

1. The camera rides forward on rails down a curving, glowing sewer-pipe
   corridor (POC: straight, no curve) at a speed the player never
   controls — only Raphael's angular position around the pipe's
   circumference is player-controlled.
2. Leaning right on the board steadily rotates Raphael clockwise around
   the pipe wall for as long as the lean is held; leaning left rotates him
   counter-clockwise; releasing lets his angular velocity settle back to
   zero (§4). This is continuous, not a step — small leans produce small
   corrections, sustained leans produce continued travel around the pipe.
3. Each pipe section defines a **reachable arc** (§5.4) — the range of
   `theta` Raphael can physically occupy. Obstacles (crates, spinning
   drums, pipe girders — MVP; crate only in POC) sit at specific angles
   within that reachable arc and scroll toward the camera; the player
   must steer to an open angle before an obstacle reaches strike distance
   or takes a hit.
4. Pizza-slice pickups (MVP+; not in POC) drift into open angular gaps.
   Collecting one steps a score multiplier up (capped at x3); going too
   long without a pickup steps the multiplier back down (§8).
5. A hit costs one life and triggers a brief invulnerability
   window/flicker (MVP; POC ends the run immediately on any hit — §5.5,
   §8).
6. Difficulty escalates across the run's three pipe sections (storm drain
   → main line → treatment chamber — MVP only; POC has one constant
   section/pace): each section step raises obstacle density and/or
   forward speed, and the treatment chamber introduces the half-pipe
   (180°) cross-section as a wider, more disorienting reachable arc than
   the partial-arc default (§5.4).
7. Run ends when the third life is lost (MVP) / on first hit (POC). A
   game-over screen shows the final score (MVP; POC can show a bare
   restart with no score display).
8. Player retries; the pipe-section/difficulty ramp always restarts from
   section 1 — no persistent meta-progression carries between runs (§8).

---

## 4. Controls

**Mode: Analog** (`forwardSteeringKeys = false` on the GoBalance
`WebGameController`, raw tilt read via `window.__gbSensor`).

**Why analog, not digital:** the entire concept is built around
*continuous* angular steering — the brief is explicit that this is not a
simplification down to discrete lane choices, because the continuous
hold-to-steer tilt scheme is already validated working on real GoBalance
hardware (see the brief's "Why it fits GoBalance"). Digital mode's
synthetic-keypress model (discrete on/off with hysteresis) is the right
choice for lane-switch/jump/dodge-style games, but it cannot express "the
longer I hold this lean, the further around the pipe I travel" — the exact
mechanic the pipe cross-section system depends on (§5.4) for its
upside-down full-pipe payoff. This repo already has a directly comparable
mechanic shipped in `Astro_Tunnel` (a ship's fixed-radius `angle` around a
tunnel's circumference, driven by the same analog `__gbSensor` read) —
reused here as a proven pattern for the input layer specifically, not as a
copy of that game's design.

**Exact mapping:**
- `window.__gbSensor.x` (range roughly -1..1) drives a **target angular
  velocity** (`targetAngularVel = sensor.x * MAX_ANGULAR_SPEED`), which
  `theta`'s actual angular velocity eases toward each frame (an
  exponential-follow smoothing term, not an instant snap — see
  `Astro_Tunnel/src/main.js`'s `ANGULAR_RESPONSE` for the exact technique
  to reuse). `theta` itself integrates that angular velocity over time.
  Releasing the lean eases angular velocity back to zero, not to a fixed
  "home" angle — Raphael keeps whatever position he's drifted to,
  matching the brief's "releasing lets him settle" language.
- `theta`'s valid range is clamped per the active pipe section's cross-
  section type (§5.4) — this is where "reachable arc" is enforced, not in
  the input layer itself.
- `y` component of `__gbSensor` is **unused**. This is a strict left/right
  lean-only game — never wire `ArrowUp`/`ArrowDown` or any `y`-derived
  behavior to gameplay, including for the full-pipe (360°) section: going
  further around the loop, even upside-down, is purely a function of how
  long a left/right lean is held (integrating `theta` further), never a
  different or steeper tilt axis. This is the brief's central point and
  must not erode during implementation.
- Keyboard fallback for desktop dev/testing: `ArrowLeft`/`ArrowRight` held
  (real `keydown`/`keyup` on `e.code`) map to the same target-angular-
  velocity input as a full-magnitude analog tilt in that direction, purely
  for testing convenience. `__gbSensor` is the authority when present;
  don't double-apply both at once.

---

## 5. World / mechanics

### 5.1 Tunnel geometry & camera
- Built from a `THREE.TubeGeometry` (or extruded cylinder) along a
  centerline spline — the same technique already proven in this repo's
  `Astro_Tunnel` (`tunnelCenterAt(z)` producing a gentle sine-based bend)
  and referenced directly in `WEB_MINIGAME_TECH_RETROSPECTIVE.md`'s
  "2D sprites inside a real 3D scene" note. The camera rides this same
  spline forward, which is what gives banking/curving "for free" once
  MVP adds it.
- **POC**: straight centerline, no bend, fixed forward camera speed.
- **MVP**: the spline gets gentle, cosmetic left/right and (later section)
  more dramatic bends, and forward speed ramps up modestly per pipe
  section (§5.4) rather than staying fixed — cap the ramp so late-run
  speed never demands faster reaction than a lean board can give (same
  "no fast alternating corrections, ever" discipline used elsewhere in
  this pipeline's GoBalance docs).
- The tunnel wall itself never blocks the player physically at a fixed
  radius — Raphael always rides at a **fixed distance from the tunnel's
  central axis** (a constant "ring radius," same technique as
  `Astro_Tunnel`'s `RING_RADIUS`), only his `theta` around that ring
  changes. There is no free 2D position and no radial (in/out) movement,
  ever.

### 5.2 Player angular position (`theta`)
- A single continuous value, `theta`, tracks Raphael's position around
  the tunnel's circular cross-section at a fixed ring radius. Each frame:
  `(x, y) = (cos(theta) * ringRadius, sin(theta) * ringRadius)`, offset by
  the centerline's position at Raphael's fixed z, then the billboard
  sprite is placed there and always faces the camera.
- Angular velocity eases toward the input-driven target (§4) rather than
  snapping, so steering reads as a smooth lean-in/lean-out, not a twitchy
  step.
- Raphael's sprite should visually "bank" (rotate in-plane) to lean into
  the direction of travel around the wall — cosmetic only, doesn't affect
  collision.

### 5.3 Pipe cross-sections (structural difficulty ramp)
The pipe's traversable arc — the valid range of `theta` — changes by
section. This is the concept's core "add difficulty without adding a new
input" mechanism (brief's own framing) and should be implemented as a
simple min/max clamp (or no clamp) on `theta`, exactly as
`WEB_MINIGAME_TECH_RETROSPECTIVE.md`'s technique note describes:

- **Partial arc (~70%)** — `theta` clamped to the pipe's lower ~70% (the
  upper ~30% reads as silted/collapsed/grated in the tunnel art). The
  default, lowest-disorientation section type; used for POC and MVP's
  earlier section(s).
- **Half-pipe (180°, open top)** — `theta` clamped to a 180° range (the
  top half of the tube reads as open/broken in the tunnel art). MVP's
  mid/late-run section type, introduced in the treatment chamber (§5.4).
- **Full pipe (360°, no clamp) — Post-MVP.** No clamp on `theta` at all;
  Raphael can ride all the way around, including upside-down along the
  top. Reserved for a single late-run/finale stretch, not general use
  (§2, §11) — the brief calls this "the most dramatic and disorienting
  option" on purpose.
- **Obstacles are never placed outside the currently-valid `theta` range**
  — the silted/collapsed portion of a partial-arc or half-pipe section is
  simply not part of the level, not an extra hazard zone. Difficulty
  comes from *less room to dodge within*, not from more things to dodge.
- **Section-boundary transition:** when a section change narrows the
  valid range (e.g. half-pipe → partial-arc, if a future section order
  ever does that) and Raphael's current `theta` falls outside the new
  range, ease him smoothly back inside the new bounds over a short window
  rather than snapping/teleporting or treating it as a hit — this is a
  genuine edge case worth handling deliberately (see §12).

### 5.4 Pipe sections & difficulty ramp (MVP)
Three in-run sections for MVP, matching the brief's naming:

1. **Storm drain** — partial-arc cross-section, lowest obstacle density,
   base forward speed. The run's opening/onboarding section.
2. **Main line** — partial-arc cross-section still, increased obstacle
   density and a modest forward-speed step-up.
3. **Treatment chamber** — **half-pipe (180°) cross-section introduced
   here**, MVP's highest density/speed. The wider reachable arc plus
   higher pace is what makes this the run's peak MVP tension, per the
   brief's own description of the half-pipe as the "mid-run tension"
   cross-section.

Each section transition should get a brief, non-blocking visual/text cue
(§7) plus a re-themed tunnel material pass (POC/MVP: recolor/retexture
only, no new geometry needed — same "instant texture-theme swap on one
continuous mesh" technique `Astro_Tunnel`'s `advanceTunnelTheme` already
uses). Exact section-length/threshold tuning (distance or time-based) is
left to stage 4 (§12).

**Post-MVP** extends this to more sections (flooded chamber, overgrown
storm drain, TCRI-adjacent glowing waste zone) and the full-pipe (360°)
section as a late-run finale (§2, §5.3).

### 5.5 Obstacles: placement, scroll, collision
- Each obstacle is a flat billboard sprite keyed by a `(theta,
  distanceDownTunnel)` pair — placed once at spawn, then only
  `distanceDownTunnel` changes as it scrolls toward the camera each
  frame (decreasing to zero, then despawns/recycles).
- **Collision** is a direct comparison: when an obstacle's distance
  crosses into "strike range" of Raphael's fixed z, compare Raphael's
  current `theta` against the obstacle's `theta` with a tolerance window
  (accounting for both sprite widths) — a hit if within tolerance, a
  clean pass otherwise. This is the same technique
  `WEB_MINIGAME_TECH_RETROSPECTIVE.md` calls out and the same *shape* of
  check `Astro_Tunnel`'s ring-gap system already uses (angle-normalized
  compare against a valid/invalid range), reused here as a proven
  collision technique, not copied game logic.
- Obstacle spawning should be pooled/recycled (create once, reposition on
  recycle), not create/dispose per obstacle — matches this repo's
  established practice for scrolling-tunnel obstacle fields.
- **POC**: single obstacle type (crate), one per "wave," fixed spacing,
  fixed density.
- **MVP**: all three obstacle types (§6) mixed per section's density
  tuning (§5.4); a wave/cluster can include one or more obstacles at
  different valid angles within the same reachable arc, always leaving at
  least one legitimately reachable gap — never a wave that spans the
  entire valid `theta` range with no dodge available.

### 5.6 Pickups: pizza & multiplier decay (MVP+)
- Pizza-slice pickups spawn at open angular positions (never overlapping
  an active obstacle's tolerance window) within the section's reachable
  arc, drifting toward the camera the same way obstacles do.
- Collecting one (same theta-tolerance-window check as obstacles, smaller
  tolerance is fine) steps the score multiplier up one stage, capped at
  **x3** (matching the brief's cited x3→x2→x1 decay behavior from the
  source footage).
- If no pickup is collected for a tunable window (~6–8s, tune against
  actual on-device pacing), the multiplier steps back down one stage
  (never below x1) — a soft secondary objective that doesn't add a new
  input, exactly as the brief specifies.
- Not present in POC.

---

## 6. Entities

- **Raphael (player)** — rides at a fixed ring radius, position driven by
  `theta` (§5.2). States needed: idle/ride loop, lean-left/lean-right
  bank pose (can be a simple in-plane sprite rotation rather than a full
  separate frame), hit-reaction + invulnerability flicker (MVP), game-over
  pose. Placeholder-first for POC (a single static billboard is enough to
  validate the render pipeline and steering feel); MVP needs real
  per-state 2D art matching §1.
- **Crate (obstacle, POC+)** — static wooden crate billboard, no
  animation needed beyond scroll-toward-camera.
- **Spinning drum (obstacle, MVP+)** — studded metal drum billboard with a
  simple continuous spin (either a rotating sprite or a short spin
  flipbook loop) to read as an active hazard, not a static prop.
- **Pipe girder (obstacle, MVP+)** — crossed-pipe girder billboard,
  static, likely wider/taller than the other two obstacle types (reads as
  a bigger, more deliberate dodge).
- **Pizza slice (pickup, MVP+)** — floating billboard with a small
  sparkle/bob idle animation, destroyed with a hit-flash/particle burst +
  small score popup on collection; simply exits off-screen if missed (no
  penalty beyond the multiplier's own decay — §5.6).
- Keep all obstacle types driven by one shared "scrolling obstacle"
  behavior (spawn at `(theta, distance)`, scroll, tolerance-window
  collision check, recycle) with only sprite/size/animation differing —
  this keeps Post-MVP's rolling barrels and other variety (§2) a data
  addition, not new placement/collision logic. Same principle for
  pickups (pizza now; Post-MVP's glide/boost pickup later).

**Post-MVP only:** Leonardo (katana-balance trick cosmetic), Michelangelo,
Donatello — each a cosmetic skate-stance/animation variant of the same
player entity, not a new entity type with different mechanics.

---

## 7. UI/HUD

- **Score** (top corner): running total, updates on pickup/distance
  accrual. Not present in POC.
- **Multiplier indicator**: small `x1`/`x2`/`x3` readout near the score,
  with a visible decay cue (e.g. a depleting sliver/timer) so the
  no-pickup countdown is legible, not a surprise step-down. MVP+ only.
- **Lives indicator**: 3 icons (e.g. small turtle-shell icons), losing one
  per hit, with a brief flash on loss. MVP only; POC has no lives display
  since any hit ends the run.
- **Pipe-section banner**: brief, non-blocking name-card on section
  transition (e.g. "MAIN LINE", "TREATMENT CHAMBER"), matching the
  section names in §5.4. MVP only.
- **Game-over overlay**: final score, restart button. Must satisfy the
  GoBalance SDK's exact DOM contract — `#gameover-overlay` toggling a
  `hidden` class, `#restart-button` inside it doing the actual restart
  (see `GOBALANCE_SDK.md`, the builder's ground truth for this, not
  repeated in full here).
- UI is a DOM/CSS overlay on top of the WebGL canvas, not drawn into the
  3D scene itself (no Three.js sprite/text-based HUD) — keeps HUD
  text crisp and simple to update without touching render logic.

---

## 8. Scoring / progression

- **Score** = a continuous distance/time-based base accrual (Raphael
  survives forward at the current section's speed) **+** pizza-pickup
  value **×** the current multiplier (§5.6) for each pickup collected.
  Base accrual is unmultiplied — the multiplier rewards pickup chains
  specifically, matching the brief's "soft secondary objective."
- **Lives**: 3 per run (MVP), each hit costs one, a brief invulnerability
  window follows every hit (no double-hit off the same obstacle or the
  next one before the player can react — same rationale as
  `Astro_Tunnel`'s equivalent window). 0 remaining ends the run. POC: no
  lives, first hit ends the run.
- **In-game pipe-section progression (required, and exactly the
  encouraged kind of progression for this product)**: 3 sections per run
  at MVP (storm drain → main line → treatment chamber, §5.4), reached
  purely by in-run distance/time thresholds, always restarting from
  section 1 on a new run. This is progression *within a single run*, not
  something that persists or is "unlocked" across sessions. Post-MVP's
  additional sections and the full-pipe finale (§2) extend this same
  in-run structure, they don't change its shape.
- **Explicitly confirmed — no purchases, no currency, no cross-session
  meta-unlock web, anywhere in this system, even implicitly:**
  - No coins/gems/soft-currency of any kind.
  - No shop screen, no unlockable content gated behind score/currency
    accumulated across multiple past runs.
  - No IAP, no ads-for-currency, no paid continue/revive.
  - Post-MVP's "choose your turtle" (§2) is additional playable content
    available from the start of a session, not something unlocked by
    spending anything earned in a prior run.
  - The only thing that persists between runs, if anything, is a
    high-score display for bragging-rights purposes (optional; a simple
    `localStorage` best-score is fine if implemented, but it is display
    only and gates nothing).

---

## 9. Technical architecture

### 9.1 Rendering approach
**Three.js**, per Amit's explicit direction for this concept — a real
3D-perspective scene, not a flat Canvas-2D approximation (§0). Build
around the technique already captured in
`WEB_MINIGAME_TECH_RETROSPECTIVE.md`'s "2D sprites inside a real 3D
scene" note, which is written for exactly this game:

- **Tunnel geometry**: `THREE.TubeGeometry` (or an extruded cylinder)
  along a centerline spline gives the pipe walls/perspective and,
  free later, the camera-follows-spline banking/curve MVP adds (§5.1).
  Reuse the spline-centerline technique already proven in this repo's
  `Astro_Tunnel/src/tunnel.js` (`tunnelCenterAt(z)`), not as a copy of
  that file, but as the established working pattern for this exact
  building block.
- **Player angular position**: a single `theta` value around the tube's
  circular cross-section, incremented/decremented continuously by
  tilt-driven angular velocity (§4, §5.2) — never a discrete lane index.
- **Obstacles/pickups**: `THREE.Sprite` (or a plane with
  `SpriteMaterial`) billboards, each parented to a `(theta,
  distanceDownTunnel)` pair, moving toward the camera as distance
  decreases (§5.5, §5.6).
- **Cross-section arcs**: a min/max clamp (or no clamp) on `theta`'s
  valid range per pipe section (§5.3) — cheap, and the concept's
  entire structural-difficulty mechanism.
- No custom shaders or exotic tooling needed — this is the same trick
  classic sprite-based 3D games used, running on Three.js's standard
  `WebGLRenderer`. Keep any postprocessing (bloom on the tunnel's neon/
  glow accents, matching the concept art's teal-green glow) behind an
  easy on/off toggle, consistent with this repo's existing Three.js
  carve-outs — unverified GPU cost on real WebView hardware until tested
  on-device.
- All character/obstacle/pickup art is flat 2D sprite art (§0) — do not
  model any of these as real 3D geometry, even for the spinning drum's
  rotation (a rotating billboard/flipbook, not a modeled cylinder).

### 9.2 State management shape
A small explicit state machine: `countdown`/`playable` → `running` →
`gameover` → back to `running` on restart (no menu state needed — the
GoBalance SDK contract requires reaching a playable/countdown state on
load with no key needed, see `GOBALANCE_SDK.md`). Section/difficulty
tracking, obstacle/pickup spawning, score/multiplier, and lives all live
as plain state read/updated by systems ticking once per frame from the
game loop — no framework-level state manager needed at this scope.

### 9.3 Suggested code structure
```
/src
  /core        - renderer/scene/camera bootstrap, game loop, top-level
                 state machine (countdown/running/gameover)
  /tunnel      - centerline spline + TubeGeometry construction, camera-
                 follow-spline, section theme (texture/material) swap,
                 cross-section theta-clamp definitions and transitions
  /entities    - player (theta, angular velocity, banking rotation),
                 shared "scrolling obstacle" behavior (spawn/scroll/
                 tolerance-window collision/recycle), shared pickup
                 behavior (spawn/scroll/collect/recycle)
  /systems     - pipe-section/difficulty progression tracker, score +
                 multiplier-decay tracker, lives/hit tracker
  /input       - single input-reading module: reads window.__gbSensor
                 when present, falls back to ArrowLeft/ArrowRight
                 keydown/keyup otherwise, exposes one continuous target-
                 angular-velocity value — never let raw input handling
                 leak into gameplay code directly
  /ui          - DOM overlay: score/multiplier/lives HUD, section
                 banner, game-over overlay (#gameover-overlay /
                 #restart-button per SDK contract) - plain JS/DOM, no
                 framework
  /data        - pipe-section definitions (theme, cross-section type,
                 density/speed tuning, distance/time threshold to
                 advance), obstacle/pickup type definitions (sprite,
                 size, on-collect/on-hit effect) - keep section and
                 character-roster content here so Post-MVP's turtle-
                 select (§2) and additional sections stay data
                 additions, not core-logic rewrites
  /assets      - placeholder billboard sprites now (POC), real per-state/
                 per-type 2D art later (MVP), per §1
```
This mirrors the theme/logic separation principle used elsewhere in this
pipeline (keep reskinnable content in `/data` and `/assets`, keep
`/core`/`/entities`/`/systems` theme-agnostic), scaled to what this
game's true-3D-but-2D-sprite hybrid actually needs.

**Shipping/bundling is intentionally not specified in this document** —
module format, dev-vs-production serving, and any GoBalance-SDK-specific
boilerplate (rAF shim, `#gameover-overlay` contract, Back button, error
bridge) are the builder's responsibility via `GOBALANCE_SDK.md`, which is
the ground-truth contract for how this game loads in production. Do not
build around `file://` assumptions or single-file bundling.

---

## 10. Build milestones

### POC (prove the core mechanic)
1. Three.js scene bootstrap: straight `TubeGeometry` tunnel segment
   (partial-arc cross-section reference only, no visual clamp needed yet
   since there are no obstacles outside it), camera riding the centerline
   forward at a fixed speed, one placeholder Raphael billboard fixed at
   `theta = 0` — confirm the "3D corridor + flat 2D sprite" look and
   camera-on-rails feel read correctly before adding any input.
2. Wire continuous hold-to-steer input (§4): `window.__gbSensor` + arrow-
   key fallback → target angular velocity → smoothed `theta` integration,
   clamped to the partial-arc valid range (§5.3). Verify the steering
   itself reads as continuous (small lean = small correction, sustained
   lean = continued travel), not stepped or laney, before adding
   obstacles.
3. One obstacle type (crate) spawning at `(theta, distance)`, scrolling
   toward the camera, theta-tolerance-window collision check (§5.5); a
   hit ends the run immediately (no lives yet). Verify the core dodge
   loop is genuinely fun on this mechanic before building anything else.

### MVP (turn the POC into the shippable game)
4. Lives/hit-buffer system: 3 lives + brief invulnerability flicker
   window (§8), replacing POC's instant-fail; proper game-over overlay
   (`#gameover-overlay`/`#restart-button` contract, §7) with final score.
5. Pizza pickup + multiplier system (§5.6, §8): spawn at open angular
   positions, collect via tolerance-window check, x1→x3 step-up, decay-
   down after a no-pickup timeout; score + multiplier HUD.
6. Remaining obstacle types — spinning drum (with spin animation), pipe
   girder — added via the shared "scrolling obstacle" behavior module
   (§9.3) so adding types is a data change, not new logic.
7. Three in-run pipe sections (storm drain → main line → treatment
   chamber, §5.4) as data-defined stages: density/speed step-up +
   section-transition banner (§7); half-pipe (180°) cross-section
   introduced for the treatment chamber, including the section-boundary
   `theta`-clamp transition handling from §5.3.
8. Cosmetic camera banking/curve on the tunnel spline (§5.1), replacing
   POC's straight segment — reuse the centerline-bend technique already
   proven in this repo (§9.1).
9. Real 2D sprite art pass matching the approved concept direction (§1):
   Raphael's states, crate/drum/girder, pizza pickup, and each section's
   re-themed tunnel material.
10. Pacing pass across all three sections — verify no section ever
    demands fast alternating left-right corrections; tune angular speed/
    response, obstacle density, and forward-speed ramp against actual
    on-device board feel (§12).

### Post-MVP (backlog, unordered)
- Full 360° full-pipe cross-section (no `theta` clamp) as a late-run/
  finale thrill stretch, including upside-down riding along the top.
- "Choose your turtle" — Leonardo/Michelangelo/Donatello as additional
  playable characters with cosmetic skate-stance/animation differences.
- Additional tunnel-section themes: flooded chamber, overgrown storm
  drain, TCRI-adjacent glowing waste zone.
- Additional obstacle/pickup variety: rolling barrels, a glide/boost
  pickup.
- Denser late-run obstacle patterns as a difficulty ceiling for high-
  skill single runs.

---

## 11. Explicitly out of scope

- **Any real-money IAP, paid currency, ads-for-currency, or purchase path
  of any kind — permanently out of scope for this product, not just this
  doc's tiers** (see §0, §8).
- **Any cross-session/cross-game meta-progression, unlock web, or
  currency-sink system** — including at Post-MVP. "Choose your turtle"
  and additional sections are available-from-session-start content
  additions, never gated behind cross-run accumulation.
- **Lane snapping / discrete positional movement** — `theta` is always
  continuous; this was an explicit correction made during brief revision
  (the source report's original recommendation) and must not be
  reintroduced at any tier, including as a "simplification" for easier
  implementation.
- Any input beyond left/right lean — no up/down, ever, including for the
  Post-MVP full-pipe/upside-down section (§4). Going further around the
  loop is a function of hold duration only, never a different tilt axis.
- Free-roam radial (in/out) player movement — Raphael always rides at a
  fixed ring radius; only `theta` changes.
- Real 3D-modeled geometry for Raphael, obstacles, or pickups — these
  stay flat 2D sprite/billboard art inside the 3D corridor at every tier,
  per Amit's explicit direction (§0, §1).
- Networked leaderboards/multiplayer.
- Physics-based collision/ragdoll — fixed-radius circular motion +
  theta-tolerance-window overlap checks are sufficient (§5.5); no physics
  engine needed.

---

## 12. Open questions / risks

- **Exact angular speed/response, obstacle density, and forward-speed-
  ramp numbers** are left to stage 4 to tune within this doc's directional
  guidance (§5.1, §5.4, §10's pacing-pass milestone) — no single correct
  number is specified on purpose; tune against actual on-device board
  feel, not desktop-keyboard feel alone.
- **Section-boundary `theta`-clamp transition behavior** (§5.3) — the
  "ease back inside the new range" approach is specified directionally,
  but the exact easing curve/duration, and whether it should ever be
  visually dressed up (a brief camera nudge, a wall "closing in" cue)
  rather than an invisible correction, is left as an implementation call.
- **Full-pipe (360°/upside-down) readability and disorientation risk** —
  the brief itself calls this "the most dramatic and disorienting option"
  and explicitly reserves it for a single late-run/thrill stretch, not
  general use. This needs real playtesting once built before any
  Post-MVP decision to expand its use beyond one finale section.
- **Camera banking vs. steering readability** — MVP introduces cosmetic
  tunnel curve/banking (§5.1) on top of continuous angular steering;
  worth explicitly verifying during build that a curving camera path
  doesn't fight the player's mental model of "lean right = rotate
  clockwise around a circle," especially through a bend.
- **Concept art's single-safe-lane composition** (§1) doesn't reflect the
  final reachable-arc/cross-section visual language — stage 4 will need
  to originate the actual on-screen "which part of the pipe is open vs.
  silted/collapsed/broken" visual treatment itself, using the concept
  frames for material/character/lighting reference only, not composition.
- **Licensor approval checkpoint** — as with any TMNT-branded asset in
  this pipeline, confirm what needs sign-off (Raphael likeness fidelity,
  obstacle/prop design, tunnel art) before treating final art as locked;
  not resolved by this doc.
