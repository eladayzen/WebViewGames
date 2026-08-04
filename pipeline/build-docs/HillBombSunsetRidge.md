# Hill Bomb: Sunset Ridge — Game Design & Build Doc
### (Third-person downhill skate descent — GoBalance build, true-3D road / flat-2D-sprite exception, analog input)

Draft v1 — for implementation by Claude Code. Full spec, placeholder-art-first
where noted. Expanded from the macro brief at
`pipeline/macro-briefs/proposed/hillbomb-sunset-ridge/brief.md`.

> **Process note:** that brief is still in `macro-briefs/proposed/`, not
> `approved/`. This build doc was written on Amit's direct instruction to
> proceed ("lets write the document in build-docs") rather than after the
> usual `/approve-brief` gate. If the brief is later revised before
> approval, this document is downstream of it and must be revised to match —
> the brief stays the source of truth for *what the game is*, this doc only
> owns *how it gets built*.

---

## 0. Read-first notes

**No IAP, no paid currency, no cross-session meta-progression or unlock web
of any kind — permanent product constraint**, not a v1 cut (see §8 and §11).
This game runs on the GoBalance balance-board product, used during physical
activity; the entire economy specified here is in-run score and in-run
section progression only.

**Controller-ergonomics constraint — the single most load-bearing rule in
this document.** Per Amit's direct note (quoted in full in the brief):
side-to-side lean on the board is the comfortable, sustainable axis;
**forward/back lean is genuinely hard** — a more committed, more tiring
motion with worse fine control. Consequences, which must survive
implementation and tuning:

- **Forward lean is not used at all**, anywhere, at any tier. There is no
  tuck input, no crouch input, no charge input, no brake input.
- **Back lean is used for exactly one thing** (the optional trick pop, §5.5)
  and **nothing in the game can be lost by never using it** — not survival,
  not progression, not reaching any section, not clearing any hazard.
- **The core loop runs entirely on the left/right axis.** If during
  implementation something feels like it wants a vertical input to work, the
  answer is to redesign it onto the lateral axis or onto neutral posture, not
  to add the input. This is not a scope compromise to relax later.

**Rendering exception (deliberate, not a mistake to "fix"):** this is a
**true 3D-perspective Three.js scene** — a real modeled descending road with
roadside geometry, camera riding it — not a flat Canvas-2D or CSS-parallax
approximation. Explicit, per Amit's direction for this concept, same status
as `Astro_Tunnel`/`CarRacer`/`TmntSewerSlide`/`HalfShellHustle`. Every
environment surface should be flat, unshaded-3D-looking, illustrated 2D art;
the rider is a flat sprite billboard. Do not walk this back or re-interpret
it as "should really be 2D" during build. Note also that the still-pending
CTO decision on a 2D rendering default (PixiJS vs. raw Canvas vs. Phaser,
per `WEB_MINIGAME_TECH_RETROSPECTIVE.md`) **does not apply here** — this is a
mandated 3D carve-out, not a 2D game waiting on that call.

**Environment-art correction, must be honored** (per
`WEB_MINIGAME_TECH_RETROSPECTIVE.md`'s 2026-07-26 note): the road, curb,
guardrail, roadside and horizon surfaces this camera travels past need real,
Kolbo-generated illustrated 2D art matching the concept style/palette —
**never** a procedurally-drawn `<canvas>` grid/tile pattern (the
`Astro_Tunnel`/`TmntSewerSlide` anti-pattern that note corrects). Placeholder
flat colors are fine for POC; the MVP art pass must replace them with real
illustrated textures, not code-generated ones.

**Presentation bar.** Amit's second direct note: this should read as *"much
more action, like a triple-A skateboard game, than what we did in Half-Shell
Hustle."* `HalfShellHustle`'s camera is a fixed follow rig that eases
sideways and does little else; that is explicitly the bar this game is meant
to clear, not match. §5.2 and §9.1 spec the camera accordingly, and the
trick-swing camera is a **POC-tier** item (§2, §10), not final polish.

---

## 1. Vision

Rae bombs a long coastal ridge road at golden hour. The road plunges away
toward a glittering ocean and a sunlit downtown far below; palms, telephone
poles and guardrails strobe past as speed climbs. The player carves freely
across the full width of the tarmac — no lanes — and that one input is both
the steering and the brake, because a hard turn across the fall line is what
physically bleeds speed. Let the board sit neutral and Rae holds a straight
line, drops into a tuck automatically, and accelerates; a SPEED WOBBLE meter
starts climbing, the camera pulls back and widens, the board starts visibly
shimmying — and the player has to decide how long they dare hold it before
sitting up and carving the speed back off.

Kickers, rails and ledges sit invitingly off the racing line. Steering onto
one is enough: Rae launches, the camera **breaks off their back** and swings
low and wide around the flip, motion arcs spiralling, and settles back
behind them on the landing. A player who wants more can add an optional
back-lean pop at the lip for a bigger air and a bigger multiplier — but
never has to.

Target feel: **speed is the score, and speed is also the thing that kills
you**, expressed entirely through the one axis a balance board is genuinely
good at.

**Art direction anchor (stage 4 does not own art direction, only points at
it):**
- Concept art: `pipeline/macro-briefs/proposed/hillbomb-sunset-ridge/concepts/`.
  - `concept-01.png` through `concept-04.png` (`nano-banana-pro`, prompt in
    `concepts/prompt.txt`) establish the **default riding camera** and are
    the primary palette/linework/HUD anchor: bold clean black outlines, flat
    cel-shaded color blocks, warm saturated golden hour, camera behind and
    slightly above riding low near the deck, road converging to a
    golden-hour vanishing point over ocean and distant downtown, lateral
    hazards (cone, pothole) to one side and opt-in trick props (wooden
    kicker, low metal rail) off the line to the other, `SPEED WOBBLE` meter
    top-left, speed + score top-right. **`concept-01.png` is the single
    strongest anchor** — treat its palette, HUD layout and camera height as
    the target.
  - `concept-05-trick-camera.png` / `concept-06-trick-camera.png`
    (`gpt-image/1.5-image-to-image`, seeded from `concept-01`) are the
    **trick camera** reference: rider inverted through a backflip grab high
    over the road, camera swung low and wide to a three-quarter angle
    looking up, spiral motion-blur arcs tracing the rotation, dust off the
    kicker lip in frame, descent and ocean horizon sweeping behind.
    `concept-05` is the frame the in-game trick camera should be trying to
    reproduce in motion.
- Technique reference: `WEB_MINIGAME_TECH_RETROSPECTIVE.md`'s "2D sprites
  inside a real 3D scene" note; `HalfShellHustle/src/street/street.js` and
  `src/data/envArt.js` for the unlit-textured-geometry method; `CarRacer/`
  and `Astro_Tunnel/` for road/spline precedent. See §9.
- Asset pipeline: `KOLBO_ASSET_PIPELINE.md` is the ground truth for how art
  actually gets generated — model choice, one-lineage chaining, and the
  local white-key cutout (Kolbo's `removebg` is broken). See §9.4.

---

## 2. Scope tiers

### POC
Prove the core feel before building anything on top of it. **The question
this tier answers is: does carving to control speed on a balance board feel
good, using only the side-to-side axis?**
- One descending road segment at a fixed grade, Three.js, built on the
  centerline-spline + lateral-offset model (§9.1) even at this tier — it is
  what makes free lateral positioning and later curves cheap, and retrofitting
  it is expensive.
- **Free continuous analog lateral positioning** across the full road width,
  driven by `window.__gbSensor.x` (§4). No lanes, ever, at any tier.
- The speed model (§5.1): grade-driven acceleration, carve-driven speed
  scrub, drag. A raw numeric speed readout is enough HUD.
- One placeholder rider billboard (single static image, no frames).
- One lateral hazard type (cone) costing a speed scrub on contact.
- Simple follow camera **plus a bare prototype of the trick-swing camera**
  (§5.2) — even triggered by a debug key rather than a real launch. This is
  in POC deliberately: it is the concept's biggest presentation claim and
  the one thing most likely to reveal a problem with the flat-sprite rider
  (§12), so it must not wait for the art pass.
- No wobble meter, no tricks, no rails or kickers, no sections, no scoring
  UI, no real art.

### MVP
The smallest version worth shipping as a real GoBalance game.
- Everything in POC, plus:
- **Full SPEED WOBBLE meter** (§5.3): speed-driven passive fill above a
  threshold, hit spikes, carve drain, clean-landing drain, slow self-drain
  below threshold, full = wipeout, with the pre-wipeout warning ramp (camera
  shake + visible board shimmy) so the fail state is felt coming.
- **Trick system** (§5.5): auto-triggered launches off kickers, auto-entered
  grinds on rails/ledges, rotating multi-sequence air animations, and the
  **optional** back-lean pop upgrading a launch into a bigger air and higher
  multiplier.
- **3–4 lateral hazard types** and **3 trick-prop types** (kicker, rail,
  ledge).
- **Score** as distance × speed tier + trick points × chain multiplier (§8);
  speed + score HUD top-right.
- **Three in-run sections** down one continuous descent — Ridge Top → The
  Switchbacks → Downtown Straight (§5.6) — with real steepening grade,
  narrowing ridable width, rising prop density, and a section-name banner.
- **Full action-camera pass** (§5.2): speed-linked FOV and pullback, carve
  roll and trailing lag, the trick swing, landing compression, wobble shake.
- **VFX/audio pass** (§7.4): speed lines, wheel dust, tarmac scuff, grind
  sparks, impact and material audio, wipeout tumble.
- **Full real-art pass** per §9.4: one-lineage rider sprite set, illustrated
  road/curb/guardrail/roadside/horizon textures, tiled ramp/rail/ledge
  textures.
- **Game-over score screen** satisfying the SDK's exact DOM contract (§7.3).
- One rider look, one board, no character select.

### Post-MVP (backlog — not committed work)
More content and depth within a single run/session. None of it is
cross-session meta-progression.
- **Harbor Boardwalk** as a fourth, fastest finale section, plus a proper
  "you made it to the bottom" run-complete state as an alternative ending to
  wiping out.
- Cosmetic decks and rider outfits, picked at session start or unlocked at
  an in-run milestone — never with currency (§8).
- More trick props: a hydrant, a stair set with handrail, a banked driveway.
- An **optional** manual grind-balance layer (gentle carve input to hold a
  rail longer for escalating points) — optional, never required.
- A rival skater bombing the hill alongside as a pacing/tension cue, not a
  collidable entity.
- A ghost line of your own best run this session.
- An **optional** deep forward-lean tuck for extra speed — deferred to here
  specifically *because* forward lean is the hard axis (§0), and nothing may
  ever depend on it.
- Explicitly **not** in Post-MVP, ever: real-money purchase, currency,
  gacha, or any unlock web spanning sessions or games (§11).

---

## 3. Core loop

Scoped to MVP; inline notes mark POC-only simplifications and Post-MVP
deferrals.

1. Rae rolls forward down a continuously descending road. **Forward speed is
   simulated, not scripted** — there is no auto-scroll constant. Road grade
   accelerates; drag and carving decelerate (§5.1).
2. Analog left/right lean moves Rae **continuously across the full ridable
   width** of the road. No lanes, no slots, no snapping (§4, §5.1).
3. That same input is the brake: carve amount scrubs speed proportionally, so
   steering hard and slowing down are the same physical act (§5.1).
4. Holding the board neutral means Rae holds a straight line, **automatically
   drops into a tuck pose**, and accelerates. There is no tuck input (§0).
5. The SPEED WOBBLE meter fills whenever speed is above the section's settled
   threshold, at a rate scaling with the overshoot; it spikes on any clip or
   rough landing; it drains while carving and on clean trick landings; it
   slowly self-drains below the threshold (§5.3). Not present in POC.
6. Lateral hazards (cone, pothole, sandwich board, parked car) are avoided by
   carving around them. Clipping one costs a wobble spike and a speed scrub —
   **never the run** (§5.4).
7. Trick props (kicker, rail, ledge) sit off the racing line. Steering onto
   one auto-launches Rae into an air-trick sequence or auto-enters a grind;
   a clean landing pays trick points and drains wobble. An **optional**
   back-lean pop near a kicker's lip upgrades the launch (§5.5). MVP+.
8. On a launch, the camera breaks off Rae's back and swings low and wide
   around the trick, settling back behind them on landing (§5.2). Prototyped
   at POC, finished at MVP.
9. Difficulty escalates across three in-run sections of the same continuous
   descent, each steepening the grade, narrowing the ridable width, and
   thickening prop density (§5.6). POC has one constant section.
10. The run ends when the wobble meter fills — a scripted wipeout beat, then
    a game-over score screen (§7.3). POC can simply end on first contact or
    not end at all.
11. Player retries; sections, score and wobble always restart from the top —
    nothing persists between runs beyond an optional session best-score
    display (§8).

---

## 4. Controls

**Mode: Analog** (`forwardSteeringKeys = false` on the GoBalance
`WebGameController`; the game reads `window.__gbSensor = {x, y}` itself, per
`GOBALANCE_SDK.md`).

**Why analog, not digital:** lateral position is genuinely continuous — Rae
can be anywhere across the road, and *how hard* the player is carving is a
real analog quantity that directly drives both the speed scrub and the wobble
drain. Digital mode's synthetic key events would quantize exactly the signal
this game's core mechanic is made of. This is the same reason
`Astro_Tunnel`/`TmntSewerSlide` use analog mode.

**Exact mapping:**
- **`__gbSensor.x` → carve.** Read every frame as a signed analog value.
  Apply a small deadzone near neutral (start ~0.08) so "board sitting level"
  reliably reads as a straight line — the straight-line state is what
  produces the tuck and the speed, so it must be comfortably reachable, not
  a knife edge. Beyond the deadzone, map to a signed `carve` in `[-1, 1]`;
  `|carve|` drives the speed scrub and the wobble drain, the sign drives
  lateral direction (§5.1).
- **`__gbSensor.y` → the optional pop, edge-detected only.** Read solely to
  detect a **back**-lean crossing a press threshold, as a one-shot edge.
  Never used as a sustained posture, never read for forward lean.
  - Because analog mode ships no hysteresis of its own, implement press/
    release thresholds in-game. Model them on digital mode's numbers (press
    0.35, release 0.20) but **start more forgiving than that** — per §0, this
    is the hard axis, and a threshold tuned on a desktop keyboard will be
    wrong on a board.
  - The pop's effect window around a kicker lip should be generous (start
    with roughly ±0.35 s around the lip crossing, tune on-device), not a
    frame-accurate check.
  - A pop outside any valid window is harmless — it plays a small ollie hop
    and costs nothing.
- **Forward lean is never wired to anything, at any tier** (§0, §11).
- **Never also listen for the host's synthetic arrow keys.** Reading
  `__gbSensor` while `forwardSteeringKeys` is on double-applies the input and
  the game over-steers — the SDK's documented double-input gotcha. Tell the
  project owner this game needs `forwardSteeringKeys = false` in Phase 2.
- **Desktop dev fallback:** keyboard/pointer input writes into the *same
  internal input vector* the sensor read feeds, additively, exactly as
  `GOBALANCE_SDK.md`'s analog snippet shows. It is a dev convenience, not a
  second input path, and all tuning decisions must be validated on-device —
  keyboard feel will systematically overstate how easy the pop is.

---

## 5. World / mechanics

### 5.1 Road, lateral positioning, and the speed model

**Road representation — centerline spline + lateral offset.** Track the
rider as a pair: `s` (distance travelled down the road) and `u` (signed
lateral offset from the centerline, in world units). World position is
`spline(s) + right(s) * u`. This is the `Astro_Tunnel`/`TmntSewerSlide`
centerline technique with a flat ribbon instead of a tube, and it buys three
things at once: genuinely free lateral positioning, curved sections (The
Switchbacks, §5.6) for free, and cheap collision (compare `(s, u)` pairs, no
physics engine). Adopt it at POC — retrofitting it later is expensive.

- **Ridable width** is a per-section value clamping `|u|`; hitting the clamp
  is a scrape along the guardrail (small wobble spike + speed scrub), not a
  wall stop and not a death.
- **Road surface mesh:** a ribbon generated along the spline, UV-mapped so
  the road texture tiles along `s`. Curb, guardrail and roadside strips are
  parallel ribbons/boxes generated from the same spline. Generate ahead of
  the camera and recycle behind it — do not build the whole descent up front.

**Speed model.** One scalar `speed`, integrated per frame:

```
accel  =  GRADE_ACCEL[section]                     // gravity down the grade
        - DRAG * speed * speed                     // aero, caps top speed
        - CARVE_SCRUB * |carve| * speed            // turning across the fall line
speed  =  max(0, speed + accel * dt)
```

- **`GRADE_ACCEL` rises per section** (§5.6) — that is the *only* difficulty
  lever on speed. Never step the speed value directly.
- **`CARVE_SCRUB` is the brake.** Tune so a full-lock carve visibly and
  quickly bleeds speed (the player must feel that turning is what saves
  them), while a gentle drift costs almost nothing.
- **Tuck is emergent, not an input.** When `|carve|` stays below a small
  threshold for a short dwell (start ~0.35 s), the rider blends into the tuck
  pose and an optional small `TUCK_BONUS` is added to accel. The bonus is
  cosmetic-adjacent — the main reward for going straight is simply *not
  scrubbing*.

**Lateral motion.**

```
uVel = carve * LATERAL_SPEED * (1 - TURN_LOSS * clamp01(speed / SPEED_REF))
u    = clamp(u + uVel * dt, -width[section]/2, +width[section]/2)
```

`TURN_LOSS` means turn authority drops as speed rises — real, and it tightens
the tension curve: the faster you go, the less able you are to dodge, which
is why you eventually have to sit up and carve. Tune it so high speed feels
committing but never unrecoverable.

### 5.2 Camera — the presentation centerpiece

Four behaviors, all on one rig. Build them in this order.

1. **Follow (POC).** Fixed offset behind and above the rider, riding low and
   close to the deck per `concept-01.png`. Position lerps toward the rider's
   `(s, u)`-derived world position rather than snapping. Two deliberate
   departures from `HalfShellHustle/src/street/camera-rig.js`'s plain lerp:
   - **Roll into the carve** — camera `z`-roll proportional to `carve`.
   - **Lag on a hard carve** — the lateral lerp factor eases *slower* the
     harder the carve, so the rider visibly leads the frame through a turn
     instead of staying pinned to center. This single detail does most of the
     work of making a turn feel like a turn.
2. **Speed response (MVP).** FOV and follow distance both lerp with speed —
   wider and further back as speed climbs. Pair with the speed-line VFX
   (§7.4). The descent must physically feel faster the more dangerous it gets.
3. **Trick swing (POC prototype, MVP finish).** On a launch, the camera
   leaves its rig: over the air duration it orbits toward a low, wide
   three-quarter angle (below and to the side), looking up at the rider, then
   returns behind them on landing. Drive it with a single normalized
   `airCamT` easing the orbit yaw, height and distance offsets, so the whole
   behavior is three curves and can be tuned or amplitude-limited in one
   place — which matters, because §12's flat-sprite question may force a
   limit on how far the swing can go. `concept-05-trick-camera.png` is the
   target frame.
4. **Impact response (MVP).** Landing compression dip; wobble shake whose
   amplitude scales with meter fill above ~60% (§5.3), so the camera itself
   is part of the fail-state warning.

### 5.3 SPEED WOBBLE meter (MVP)

A single 0–100 value; HUD bar top-left per concept art (§7.1).

- **Passive fill above threshold:** while `speed > WOBBLE_THRESHOLD[section]`,
  fill at a rate scaling with the overshoot (start linear in
  `speed - threshold`). This is the game's clock, and it is entirely
  player-controlled — going fast starts it, slowing down stops it.
- **Self-drain below threshold:** slow. A cautious rider can survive
  indefinitely and score very little. This is intentional and must not be
  "fixed" by adding a forced timer — the design's safety valve for a tired
  player lives here.
- **Carve drain:** drains proportional to `|carve|`. Physically right (a turn
  settles a wobbling board) and mechanically right (the safe act and the slow
  act are the same act).
- **Hit spike:** a fixed increment on any lateral-hazard clip, guardrail
  scrape, or rough landing, on top of everything above.
- **Clean-landing drain:** a solid chunk off on every clean trick landing —
  this is what makes tricks worth the risk beyond points, and gives a skilled
  player a way to stay fast longer.
- **Warning ramp:** above ~60% fill, start the visible board/rider shimmy and
  the camera shake, both scaling with fill. Above ~85%, add an audio cue. The
  wipeout must be felt coming for a couple of seconds — never sprung.
- **Full (100) = wipeout:** scripted tumble beat (§6), run ends, score screen.
- Not present in POC (§2).

### 5.4 Lateral hazards

- Types: **traffic cone** (POC+), **pothole**, **sandwich board**, **parked
  car** (MVP+). All flat billboard sprites; the parked car is the widest and
  the main "commit to a side early" prompt.
- Each occupies a `(s, u, halfWidth)` triple. Collision is an overlap check
  on `u` once `s` crosses the strike window — no physics engine.
- **Contact is never fatal**: wobble spike + speed scrub + a brief rider
  stumble frame + camera kick. Score chain resets (§8).
- **No hazard may ever require a pop, a jump, or any vertical input to
  survive** (§0, §11). Every hazard is avoidable laterally. Curbs and cracks
  that a pop would smooth over are also fully survivable by rolling straight
  through for a small spike.
- Drive all types through one shared "roadside hazard" behavior (spawn at
  `(s,u)`, scroll, overlap-check, recycle) with only sprite/width/spike-size
  differing, so Post-MVP variety is a data addition, not new logic.

### 5.5 Trick props and the optional pop (MVP)

**Placement rule, non-negotiable:** trick props are always placed *off* a
clean line down the road, never across it. A player who ignores every trick
prop in the game must be able to complete a full run. This is what keeps the
game's only time-sensitive input optional (§0).

- **Kicker ramp** — real geometry (a wedge, §9.1). Steering onto it
  auto-launches Rae: an air-trick sequence plays, the camera swings (§5.2),
  and a clean landing pays trick points + drains wobble.
- **Grind rail / ledge** — real geometry (a cylinder / a box). Steering onto
  one auto-enters a grind: Rae is held to the prop's line, sparks and a
  rising metallic scrape play, points accrue per metre ground, and the prop's
  end auto-pops Rae off into a landing.
- **The optional pop** (`__gbSensor.y` back-lean edge, §4): if it lands
  inside the generous window around a kicker's lip, the launch is upgraded —
  higher air, a longer/bigger trick sequence from the rotation set, and a
  higher point value with a multiplier bump. Outside a window it is a
  harmless small ollie hop.
- **Landings are not a skill check.** If Rae launched from a valid prop and
  isn't overlapping a hazard on the way down, the landing is clean. The skill
  expressed is *where and when to steer*, not a timed button press on
  landing. Do not add a landing-timing minigame at any tier (§11).
- **Air-trick sequences rotate**, they do not always play the same one —
  reuse `HalfShellHustle`'s attack-sequence rotation pattern
  (`ATTACK_SEQUENCES` + a rotation index in `core/main.js`), with 2–3
  sequences at MVP.

### 5.6 Sections & difficulty ramp (MVP)

Three sections of one continuous descent, advanced by distance travelled:

1. **Ridge Top** — shallowest `GRADE_ACCEL`, widest ridable width, lowest
   prop density, highest `WOBBLE_THRESHOLD`. The onboarding stretch; a player
   should be able to hold a straight line here for a while without the meter
   becoming threatening.
2. **The Switchbacks** — steeper, narrower, denser. **This is the section
   whose spline actually curves** — the centerline model (§5.1) is what makes
   that free. Curves interact with carving in exactly the right way: holding a
   straight line through a bend pushes you toward the guardrail, so the road
   itself starts asking for input.
3. **Downtown Straight** — steepest, fastest, densest, lowest wobble
   threshold. MVP's ceiling.

Each transition gets a brief non-blocking name-card banner (§7.2) and a
re-themed art pass (§9.4). Difficulty scales **only** through grade, width,
prop density and wobble threshold — never by making the pop required, more
frequent, or more tightly timed (§11).

---

## 6. Entities

- **Rae (player)** — a flat sprite billboard driven by a frame set (§9.4),
  not a cutout rig. `HalfShellHustle`'s own history is the argument: its
  whole-body one-lineage frame approach is what finally worked, after
  per-frame-cropped and multi-batch attempts kept drifting. Frames needed:
  neutral roll, two carve depths per side, straight-line tuck, pop/launch,
  2–3 four-frame air-trick sequences, grind pose, land, stumble, wipeout.
  **POC:** one static placeholder billboard is enough.
- **Traffic cone / pothole / sandwich board / parked car** (lateral hazards)
  — static billboards, one shared behavior (§5.4). Cone at POC, rest at MVP.
- **Kicker ramp / grind rail / ledge** (trick props) — **real primitive
  geometry** (wedge / cylinder / box) wearing tiled Kolbo textures, because
  the rider physically launches off and grinds along them and a billboard
  cannot be ridden (§9.1). MVP.
- **Guardrail / telephone poles / palms / roadside houses** — roadside
  dressing. Guardrail is a ribbon along the spline (and the lateral clamp's
  visual); poles/palms/houses are billboards placed by index along `s`, using
  `HalfShellHustle/src/data/envArt.js`'s per-theme profile pattern (a cycling
  width/spacing/height profile) rather than hand-placed props.
- **Distant horizon** — ocean + downtown matte painting, `material.fog =
  false` so it stays visible at distance the way a skybox is exempted from
  fog (exactly `HalfShellHustle`'s skyline treatment).
- **Post-MVP only:** rival skater (non-collidable pacing cue), ghost line,
  additional trick props, cosmetic deck/outfit variants.

---

## 7. UI/HUD

DOM/CSS overlay on top of the WebGL canvas — not drawn into the 3D scene.
Keeps text crisp and updates cheap.

### 7.1 In-run HUD
- **SPEED WOBBLE bar** — top-left, per concept art. Fills/drains in real
  time; add a color ramp and a pulse above the ~60% warning threshold (§5.3).
  Not in POC (a raw speed number stands in).
- **Speed + score** — top-right, per concept art. Speed is worth showing as a
  real number: it is the score driver *and* the risk driver, so making it
  legible is mechanically load-bearing, not decoration.
- **Trick chain multiplier** — appears near the score only while a chain is
  live, with the countdown to its expiry visible (§8).
- **Score popups** — on trick landings and grind exits, at the rider.
- **Section banner** — brief non-blocking name-card on section change ("THE
  SWITCHBACKS"). MVP.
- **Back + Pause buttons** — top-right icon pair per `BUILD_NOTES.md`'s HUD
  chrome convention: Back is a plain `&times;` at `id="gb-back"` calling
  `window.Unity.call('nav:back')`, Pause just to its left. Note that
  convention puts score top-*left*; this game follows the **concept art's**
  layout instead (wobble left, score right) — flag it, don't silently
  diverge.

### 7.2 Feedback the HUD does *not* own
The wobble warning is deliberately expressed in the **world** (board shimmy,
camera shake, audio) as well as the bar, so a player watching the road still
feels it coming. Do not let the bar be the only signal.

### 7.3 Game-over overlay
Final score, best-score-this-session, restart. Must satisfy the SDK's exact
DOM contract: `#gameover-overlay` toggling a `hidden` class, `#restart-button`
inside it doing the restart (`GOBALANCE_SDK.md` is the ground truth — Unity
synthetically clicks that exact id while the overlay is visible).

### 7.4 VFX / audio pass (MVP)
Disproportionate share of the "triple-A" read for the effort, per §0:
- **Speed:** speed lines, edge motion streaking, both scaling with speed.
- **Ground:** wheel dust, tarmac scuff intensifying with `|carve|`.
- **Grind:** sparks + rising metallic scrape.
- **Kicker:** hollow wooden knock on launch, dust off the lip.
- **Landing:** compression dip (§5.2), dust puff, score popup.
- **Wobble:** low-frequency rumble creeping in above the warning threshold.
- **Wipeout:** tumble, board clatter.
- Keep any postprocessing (bloom on the golden-hour horizon) behind an
  on/off toggle — unverified GPU cost on real WebView hardware until tested
  on-device, consistent with this repo's other Three.js carve-outs.

---

## 8. Scoring / progression

- **Score** = continuous distance accrual weighted by current speed
  (`score += speed * dt * SCORE_RATE`) **+** trick points × chain multiplier.
  Going fast is worth more per metre *and* covers metres faster, so speed
  compounds into score twice — which is exactly why the wobble meter has to
  be the counterweight.
- **Trick chain:** each clean trick landing or grind exit increments a
  multiplier; it expires after a few seconds without a trick, and resets to
  1× on any hazard clip, guardrail scrape, or wipeout.
- **No lives** — the wobble meter is the entire fail-condition device. Do not
  add a lives system on top of it.
- **No collectibles, no power-ups at MVP** (§11). Coins or a temporary
  invulnerability would flatten the speed/safety tension that is the whole
  design. Deliberate exclusion, not an oversight.
- **In-run section progression (required, and exactly the encouraged kind of
  progression for this product):** 3 sections per run at MVP, reached purely
  by in-run distance, always restarting from section 1 on a new run.
- **Explicitly confirmed — no purchases, no currency, no cross-session
  meta-unlock web, anywhere, even implicitly:**
  - Score, chain and wobble all reset to zero every run.
  - No shop, no content gated behind accumulated past runs.
  - No IAP, no ads-for-currency, no paid continue/revive.
  - Post-MVP cosmetics are picked at session start or hit an in-run
    milestone — never bought with anything earned in a prior run.
  - The only thing that may persist is a best-score-this-session display. An
    in-memory session variable is sufficient; a `localStorage` best score is
    acceptable but display-only and gates nothing.

---

## 9. Technical architecture

### 9.1 Rendering approach
**Three.js**, per §0's rendering exception.

- **Road/roadside geometry:** ribbon meshes generated along the centerline
  spline (§5.1), generated ahead and recycled behind. Materials are
  **unlit `MeshBasicMaterial`** carrying real illustrated textures, so the
  painted-in shading reads as drawn rather than being re-shaded by scene
  lights — exactly `HalfShellHustle/src/street/street.js`. **Never a
  procedurally-drawn canvas pattern** (§0).
- **Rider, hazards, roadside dressing:** `THREE.Sprite` / billboard planes
  with real 2D art. Pooled and recycled, never created/disposed per spawn —
  this repo's established practice for scrolling fields (see
  `CarRacer/src/traffic.js`).
- **Trick props are real geometry, and this is the one place real 3D is
  warranted** (per the brief's §6): a kicker is a wedge, a rail a cylinder, a
  ledge a box — primitives wearing **tiled** Kolbo textures, exactly as
  `HalfShellHustle` does with `PLATFORM_BOX_TEXTURE` / `PLATFORM_RAMP_TEXTURE`
  on real meshes. A billboard cannot be stood on, launched off, or ground
  along. **Verify a tiling texture actually tiles seamlessly along its own
  axis before shipping** — that game discarded a diagonal-stripe ramp texture
  for a visible phase-mismatch seam.
- **Kolbo's `generate_3d` is an escape hatch, not a plan.** Nothing in MVP
  scope is expected to need an imported model. Reaching for it is a
  deliberate, flagged decision, not a default.
- **Collision:** `(s, u)` overlap checks (§5.1). No physics engine.
- **Fog + horizon:** distance fog tuned to the golden-hour palette, with the
  horizon matte exempted (`material.fog = false`). Per `HalfShellHustle`'s
  hard-won note, bias far-spawning props **warm/dark/saturated** enough to
  read against sky and fog instead of popping in late.
- No custom shaders needed; standard `WebGLRenderer`. Postprocessing behind a
  toggle (§7.4).

### 9.2 State management shape
Small explicit state machine: `countdown`/`playable` → `running` →
`gameover` → back to `running` on restart. No menu state — the SDK contract
requires reaching a playable/countdown state on load with no key press.
Pause freezes the whole simulation without touching `current`, per
`BUILD_NOTES.md` / `TmntSkateSlice/src/core/gameState.js`. Speed, wobble,
score, chain, section and spawning are plain state updated by systems ticking
once per frame — no framework state manager at this scope.

### 9.3 Suggested code structure
```
/src
  /core        - renderer/scene/camera bootstrap, game loop, state machine
  /road        - centerline spline, ribbon mesh generation + recycling,
                 lateral-width clamp per section, section theme swap
  /camera      - the follow rig and its four behaviors (§5.2): follow+roll+
                 lag, speed FOV/pullback, trick swing (one airCamT curve set),
                 impact shake/compression. Kept its own module because this
                 game's camera is a feature, not a helper.
  /entities    - rider (carve easing, speed integration, tuck dwell, frame
                 state machine), shared "roadside hazard" behavior, trick
                 props (kicker/rail/ledge geometry + ride-on logic), roadside
                 dressing placement
  /systems     - speed model, wobble meter, trick/grind resolution + sequence
                 rotation, score + chain tracker, section progression, spawner
  /input       - single module: reads window.__gbSensor, applies deadzone,
                 produces {carve, popEdge}; desktop keyboard fallback writes
                 into the same vector. Never reads arrow keys from the host.
  /ui          - DOM overlay: wobble bar, speed/score, chain, popups, section
                 banner, back/pause, #gameover-overlay / #restart-button
  /vfx         - speed lines, dust, scuff, sparks, wipeout
  /audio       - WebAudio: decode once per clip, fresh BufferSourceNode per
                 trigger, one-time gesture unlock (see the kolbo-mcp-basics
                 audio notes — do not use <audio> elements for rapid repeats)
  /data        - section definitions (grade, width, density, wobble
                 threshold, theme), hazard/prop type definitions, rider frame
                 manifest, per-theme env art (envArt.js pattern, §9.4)
  /assets      - placeholder art now, real Kolbo art at MVP
```
Keep reskinnable content in `/data` + `/assets` and `/core`/`/entities`/
`/systems` theme-agnostic, so Post-MVP sections and cosmetics stay data
additions.

**Shipping/bundling is deliberately not specified here** — module format,
serving, the rAF shim, the `#gameover-overlay` contract, the Back button and
the error bridge are all owned by `GOBALANCE_SDK.md`, which is ground truth.
Do not build around `file://` or single-file bundling.

### 9.4 Art pipeline — the production method, restated as build steps

`KOLBO_ASSET_PIPELINE.md` is ground truth for tool/model choice. The rules
below are the ones `HalfShellHustle` paid for and must not be re-learned:

1. **One-lineage character frames.** Every frame of a set traces to **one**
   seed image. Generate a set **together as one multi-panel grid in a single
   call** (the batch-prompt-character-sprite-sets rule) — frames generated in
   separate batches never agree on scale, canvas or style.
2. **Fixed shared canvas, no per-frame alpha-bbox crop.** Slice all frames of
   a set at the same cell rectangle. Per-frame cropping makes the billboard's
   center anchor drift sideways between poses — a real, previously-shipped
   bug, not a theoretical one.
3. **Anchor on a stable landmark, not the body bbox**, where poses
   legitimately differ in height (crouch vs. extended launch vs. inverted
   air). `HalfShellHustle` used headband width for scale, headband-center for
   x, a shared ground line for y. **Here the helmet is the equivalent
   landmark** — constant-sized, easy to isolate by color, present in every
   pose including inverted ones.
4. **Model choice:** anchor with `generate_image` (`gpt-image-2` when a clean
   cutout matters — it actually respects "no baked shadow"); subsequent
   sprites with `generate_image_edit` seeded off that anchor
   (`nano-banana-pro/edit` for restyles and small deltas,
   `gpt-image/1.5-image-to-image` for genuine pose changes — the air-trick
   frames are firmly in the latter category).
5. **Background removal is local**, via `tools/kolbo-assets/remove_white_bg.py`
   — Kolbo's `edit_image(operation:"removebg")` is broken. Flatten transparent
   PNGs onto real white RGB before re-uploading one as an edit source.
6. **Environment art in a per-theme data module**, following
   `HalfShellHustle/src/data/envArt.js`: themes keyed by name so a second can
   be built without disturbing a locked first, and **every texture entry
   carries its real pixel dimensions** so geometry is sized to the art's own
   aspect ratio instead of stretching a portrait crop across a wide face.
7. **Palette:** warm, saturated, alive golden hour — explicitly *not* moody
   blue twilight. `HalfShellHustle`'s first dusk pass was rejected in
   playtest for reading grim; do not rediscover that.

**Asset manifest (MVP target):**
- *Rider:* neutral roll; carve-left ×2 depths; carve-right ×2 (mirror);
  straight-line tuck; pop/launch; air-trick sequences ×2–3 (4 frames each);
  grind pose; land; stumble; wipeout.
- *Environment (per section theme):* road surface (tiling along `s`), curb/
  shoulder, guardrail, roadside dressing set (poles, palms, houses), horizon
  matte (ocean + downtown).
- *Trick props (shared across themes):* kicker deck texture (tiling), rail
  metal (tiling), ledge concrete (tiling).
- *Hazards (shared):* cone, pothole, sandwich board, parked car ×1–2.

---

## 10. Build milestones

### POC — prove the core feel
1. Three.js bootstrap: centerline-spline road ribbon at a fixed grade with
   placeholder flat materials, follow camera, one placeholder rider billboard.
   Confirm the "3D road + flat 2D sprite" look and the descent read correctly.
2. Analog input (§4): `__gbSensor.x` → deadzoned signed `carve` → free
   continuous lateral positioning with the width clamp. Verify free movement
   feels smooth and that neutral reliably reads as straight.
3. The speed model (§5.1): grade acceleration, drag, carve scrub, turn-authority
   loss at speed. Raw speed readout. **This is the milestone that decides the
   game** — verify that carving to control speed is genuinely satisfying on a
   board before building anything else.
4. One cone hazard type with `(s,u)` overlap detection costing a speed scrub.
5. Bare trick-swing camera prototype (debug-key triggered is fine) — confirm
   early whether a flat billboard rider survives the swing (§12).

### MVP — turn the POC into the shippable game
6. SPEED WOBBLE meter (§5.3) with fill/drain/spike/self-drain and the HUD bar;
   replaces "nothing happens on contact" with a real fail condition.
7. Wobble warning ramp: board shimmy, camera shake, audio rumble (§5.3, §7.4).
8. Trick props as real geometry (§9.1): kicker auto-launch, rail/ledge
   auto-grind, clean-landing resolution, rotating air sequences.
9. The optional back-lean pop (§4, §5.5) with forgiving thresholds and a
   generous lip window — plus an explicit test that a full run is completable
   without ever using it.
10. Remaining hazard types via the shared behavior; score, chain multiplier,
    popups, speed/score HUD.
11. Three sections (§5.6) as data-defined stages — grade, width, density,
    wobble threshold, banner — with The Switchbacks actually curving.
12. Full action-camera pass (§5.2): speed FOV/pullback, carve roll + lag,
    finished trick swing, landing compression.
13. VFX + audio pass (§7.4).
14. Real art pass (§9.4): one-lineage rider set, per-section environment
    textures, tiled prop textures. Replace every placeholder.
15. Game-over overlay on the SDK DOM contract + best-score-this-session.
16. **On-device tuning pass.** Re-tune the deadzone, pop thresholds, carve
    scrub, wobble rates and section grades against actual board feel. Desktop
    keyboard feel will systematically overstate how easy the pop and the fine
    carve are (§0, §4). Explicitly re-verify: nothing requires forward lean,
    nothing requires the pop, and no hazard is unavoidable laterally.

### Post-MVP (backlog, unordered)
Harbor Boardwalk finale + run-complete state; cosmetic decks/outfits; more
trick props; optional grind-balance layer; rival skater pacing cue; session
ghost line; optional deep forward-lean tuck bonus.

---

## 11. Explicitly out of scope

- **Any forward-lean requirement, at any tier.** No tuck input, crouch,
  charge, or brake bound to forward lean. The Post-MVP optional deep-tuck
  bonus may never become load-bearing (§0).
- **Any required use of the back-lean pop.** No hazard, section, or score
  floor may depend on it. It upgrades outcomes; it never gates them.
- **Lanes, of any kind.** Lateral position is continuous. Do not quantize it
  into slots "for readability" at any tier (§4, §5.1).
- **A landing-timing minigame** or any timed button press on landing (§5.5).
- **Collectibles and power-ups at MVP** — no coins, no temporary
  invulnerability. They flatten the speed/safety tension the design is built
  on (§8).
- **A lives system** — the wobble meter is the sole fail device (§8).
- **Any real-money IAP, paid currency, ads-for-currency, or purchase path —
  permanently, not just for these tiers** (§0, §8).
- **Any cross-session/cross-game meta-progression, unlock web, or
  currency sink** — including at Post-MVP.
- **Procedurally-drawn canvas textures for environment surfaces** (§0, §9.1).
- **Imported 3D models** for the rider, hazards or roadside dressing — those
  stay flat sprites. Real geometry is limited to surfaces the rider physically
  rides on, built from primitives (§9.1).
- **Physics engine / ragdoll** — `(s,u)` overlap checks are sufficient.
- Networked leaderboards / multiplayer.

---

## 12. Open questions / risks

- **The flat-sprite rider vs. the swinging camera — the concept's one real
  technical tension.** A `THREE.Sprite` always faces the camera, so as the
  trick camera orbits, the rider keeps presenting the same painted view while
  the world rotates around them. This may read fine (the rider is inverted and
  largely silhouette mid-flip, and the background does the storytelling — see
  `concept-05-trick-camera.png`), or it may read as a card spinning in place.
  **Prototype it at POC (milestone 5), not at art-pass time.** Three fallbacks
  in increasing cost: (a) cap the swing's orbit amplitude so the cheat never
  becomes visible; (b) generate the air-trick frames as a small *rotational*
  set (rider seen from 2–3 angles through the flip) swapped as the camera
  orbits; (c) use a non-billboarded textured plane that tumbles with the
  trick's own rotation. Pick after seeing (a) on-device.
- **Deadzone and pop thresholds are on-device decisions.** Both are named
  with starting values above, and both are exactly the kind of number a
  desktop keyboard will mislead you on. The deadzone in particular is
  mechanically load-bearing here in a way it usually isn't — "board sitting
  level" is the *fast, high-scoring, high-risk* state, so it has to be
  comfortably holdable, not a knife edge.
- **Wobble tuning vs. the safety valve.** The self-drain below threshold is
  what lets a tired player survive indefinitely at low score. Tuning must not
  quietly erase it (e.g. by setting the threshold so low that any playable
  speed fills the meter) — that would turn a voluntary difficulty curve into
  a forced one, which is the whole thing this design is avoiding.
- **Turn-authority loss at speed (`TURN_LOSS`)** is a good tension lever and a
  good way to make the game feel unfair if overtuned. Land it so high speed
  feels committing but recoverable.
- **Section curvature and free lateral movement** interact in a way worth
  playtesting specifically: a curve plus a width clamp can accidentally force
  a lateral input at a moment the player has no time for. Verify The
  Switchbacks never creates an unavoidable guardrail scrape.
- **HUD chrome divergence:** `BUILD_NOTES.md`'s convention puts score
  top-left; the concept art puts wobble top-left and score top-right, and this
  doc follows the art (§7.1). Worth a deliberate call rather than silent
  divergence, since that convention is meant to become SDK-wide.
- **Trick prop geometry vs. the "reads as 2D" goal** — real wedges/cylinders
  are the one genuinely dimensional thing on screen. If they read as
  out-of-place solid 3D against flat surroundings, the fix is texture/shading
  treatment (flat unlit, bold outline-ish art), not switching them to
  billboards, which would break the ride-on mechanic.
- **Audio asset generation** — per the Kolbo audio notes, generate each SFX as
  its own `generate_sound` call (`sound-effects-v1`, ≥0.5 s, ≤450-char
  prompt; `stable-audio-3-small-sfx` for longer/detailed ones). Do **not**
  try to batch multiple distinct SFX into one generation — tested and it does
  not produce separable sounds.
