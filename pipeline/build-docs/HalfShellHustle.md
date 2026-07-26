# Half-Shell Hustle: Chase Through Chinatown — Game Design & Build Doc
### (Leonardo 3-lane skate-chase runner — GoBalance build, true-3D street / flat-2D-sprite exception)

Draft v1 — for implementation by Claude Code. Full spec, placeholder-art-first
where noted. Expanded from the approved macro brief at
`pipeline/macro-briefs/approved/half-shell-hustle/brief.md`.

---

## 0. IP note & rendering-exception note (read first)

**IP:** this is a **TMNT-themed product** using Leonardo, his blue mask/
elbow-and-knee wraps, twin katana, and the general *Mutant Mayhem*-era
visual language, plus a Foot Clan robot enforcer antagonist — treat
character likeness/name/design fidelity as subject to whatever licensor
approval process applies to final art, same as any other TMNT-branded
asset in this pipeline; that process is outside this doc's scope.

**No IAP, no paid currency, no cross-session meta-progression or unlock web
of any kind — permanent product constraint**, not a v1 cut (see §8 and
§11). This game runs on the GoBalance balance-board product, used during
physical activity; the entire economy this doc specifies is in-run score
and in-game (within-this-game) block progression only.

**Rendering exception (deliberate, not a mistake to "fix"):** this game is
a **true 3D-perspective Three.js street scene** — a real modeled 3-lane
street with buildings/sidewalk geometry, camera riding forward on rails —
not a flat Canvas-2D or CSS-parallax approximation. This is an explicit,
one-off exception to this pipeline's usual "2D only" default, made by
Amit specifically for this concept, pushed *further* toward "reads as 2D"
than the `TmntSewerSlide` precedent: every environment surface should be
flat, unshaded-3D-looking, illustrated 2D art, and the player character is
a **layered cutout-rig** (separate flat sprite parts, not a single flat
billboard) — see §1 and §9.1. Do not walk this back or re-interpret it as
"should really be 2D" during build.

**Environment-art correction, must be honored (per
`WEB_MINIGAME_TECH_RETROSPECTIVE.md`'s 2026-07-26 note):** the street,
sidewalk, and building-facade surfaces this camera travels past need real,
Kolbo-generated illustrated 2D art matching the concept style/palette —
**never** a procedurally-drawn `<canvas>` grid/tile pattern (the
`Astro_Tunnel`/`TmntSewerSlide` anti-pattern that note specifically flags
and corrects). Placeholder flat colors are fine for POC; the MVP art pass
must replace them with real illustrated textures, not code-generated ones.

---

## 1. Vision

Leonardo skates flat-out down a neon-lit Chinatown street, snapping
between three lanes and vaulting the occasional low construction barrier,
while a hulking Foot-bot enforcer — staged as a strong, instantly readable
silhouette over his shoulder — closes in behind. A glowing "CHASE" meter,
top-left, is the run's entire tension mechanic: obstacles fill it, pizza
and coins drain it, and it filling completely (not a single mistimed hit)
is what ends the run. Target feel: the classic 3-lane runner's snappy,
readable dodge-and-collect rhythm, but paced noticeably slower and more
forgiving than its native phone-swipe tempo — every lane-change and jump
should feel like a clean, deliberate lean, never a reflex-speed reaction —
with a warm sunset-to-neon city backdrop, spray-paint tags, steam vents,
and string lights giving it visual density despite the calmer pace.
Leonardo himself reads as a layered paper-doll cutout (separate
torso/shell, legs, arms/sword-arms, head pieces, each simply rotated for
his run/lane-lean/jump cycle) placed inside a genuinely deep,
perspective-correct 3D street — obstacles and pickups stay simple flat
billboards, no rig needed for props.

**Art direction anchor (stage 4 does not own art direction, only points at
it):**
- Concept art: `pipeline/macro-briefs/approved/half-shell-hustle/concepts/`
  holds four `nano-banana-pro` generations (`concept-01.png` through
  `concept-04.png`, prompt saved alongside in `concepts/prompt.txt`). All
  four converge on the same target composition: a 3-lane city street
  converging toward a neon dusk vanishing point, Leonardo mid-lane-change
  lean on a skateboard in the center lane kicking up speed lines, a
  striped barricade fully blocking one lane and stacked delivery carts
  fully blocking another, a pizza slice and spinning coin hovering in the
  open lane, and the Foot-bot enforcer staged as a strong silhouette far
  behind against the glowing skyline — with a "CHASE" meter bar top-left
  and score/coins readout top-right. Every character/obstacle/pickup is
  flat, cel-shaded 2D cutout-style illustration placed inside the
  volumetric 3D street, deliberately contrasted against the real depth of
  the buildings and road. Use all four as a set for palette, mood,
  character design, and the specific "flat sprite inside real 3D depth"
  look — note that concept-01/02 in particular already bake in a plausible
  HUD layout (CHASE bar top-left, score/coins top-right) worth using as a
  direct HUD-placement reference, not just mood (§7).
- Composition/HUD pitch anchor: `pipeline/reports/laneRunnerRef.png` — the
  originally-pitched TMNT lane-runner image this brief is a direct,
  deliberate build-out of (turtle skateboarding down a city street, chased
  by a robot, dodging barriers, collecting pizza/coins, "CHASE" meter
  HUD). The CHASE meter here is the actual fail-condition mechanic, not a
  cosmetic HUD element as it may read in that pitch image alone.
- Style reference stills: `/Users/eladayzen/Documents/tmnt/`
  (`Leonardo_Mutant_Mayhem.webp`, `tmnt-mutant-mayhem-character-posters_3ef5.jpg`)
  — the *Mutant Mayhem*-era reference stills the concept art was generated
  against, for character rendering/linework/shading texture, and directly
  relevant to the cutout-rig's per-part illustration style.
- Technique reference: `WEB_MINIGAME_TECH_RETROSPECTIVE.md`'s "2D sprites
  inside a real 3D scene" note, and this repo's existing flat-3D-street
  precedent in `CarRacer/src/road.js` / `CarRacer/src/camera-rig.js` — see
  §9.1 for how these apply here specifically.

---

## 2. Scope tiers

### POC
Prove the "3D street + flat 2D sprite + 3-lane dodge + occasional
telegraphed jump" feel is fun and physically comfortable, before investing
in the cutout rig or the CHASE meter.
- A single straight street segment (no camera banking/curve, no block
  transitions yet), Three.js, 3 fixed lanes.
- One placeholder single-image Leonardo sprite (no cutout rig yet)
  snapping between lanes on left/right lean; jump as a simple hop arc on
  up-lean.
- One lane-blocking obstacle type (barricade) and the one jump-obstacle
  type (low pipe/construction barrier), both flat billboard sprites.
- Basic lane-index + z-distance overlap/collision detection. **No CHASE
  meter yet** — a hit ends the run immediately (simplest possible fail
  state, matching this pipeline's sibling POCs), or a bare static distance
  counter can stand in if a HUD number is wanted for testing; no scoring
  UI is required either way.
- No pizza/coins, no smoke-bomb pickup, no difficulty ramp, no Foot-bot
  entity in view yet (or a simple static background silhouette placeholder
  is fine, not required to react to anything).
- Jump-obstacle telegraph cue (glow/sound a beat ahead) **should** still
  be present even at this scale — it's the one mechanic the whole jump
  design depends on reading clearly, and is cheap to prototype (§7).

### MVP
The smallest version worth actually shipping as a real GoBalance game.
- Everything in POC, plus:
- **Full CHASE meter system** (§5.5): a passive base fill-rate that ticks
  up over time, a larger hit-spike on any obstacle clip, fast drain on
  pizza, slow drain on coin (both auto-collected on lane overlap, no
  separate input), meter-full = Foot-bot catches Leonardo, run over.
- **Coin and pizza scoring** (§8) alongside their CHASE-meter role.
- The **cutout-rig Leonardo** with a real run/lane-shift-lean/jump
  animation (per-part rotation, §9.1), replacing POC's placeholder.
- **All obstacle types**: 2–3 lane-blockers (barricade, parked delivery
  cart, Foot-bot wreckage chunk) plus the one telegraphed jump-obstacle.
- The **smoke-bomb dash pickup** (§5.6) — the run's only power-up.
- A **difficulty ramp across 3 in-run blocks** (back-alley → market street
  → rooftop-bridge overpass, §5.4) that raises obstacle density and the
  CHASE meter's base fill-rate, while keeping jump-obstacle rarity and
  telegraph timing fixed at every block.
- A **Foot-bot pursuer entity**, staged as a strong background silhouette
  whose visual proximity tracks the CHASE meter's value (§6).
- A **game-over score screen** (final score, best-score-this-session,
  restart) satisfying the GoBalance SDK's exact DOM contract (§7).
- Real 2D sprite art per stage 4's asset pipeline, matching §1, including
  real illustrated street/building textures (§0's environment-art
  correction).
- Leonardo only, no turtle-select.

### Post-MVP (backlog — not committed work)
More in-game content and depth within a single run/session. None of this
is meta-progression across sessions/games — it's all deeper content
*within this one game*.
- **Turtle-select**: Raphael, Michelangelo, Donatello as additional
  cosmetic player variants, unlocked in-run via a milestone or a simple
  session-start menu choice — never gated behind currency or cross-run
  accumulation (§8).
- More block/district themes: subway platform, harbor docks, rooftop-
  chase finale.
- More obstacle/hazard variety: a two-lane-wide Foot-bot debris hazard
  forcing a specific single remaining lane, a rolling barrel.
- A **bigger/faster Foot-bot pursuit form** appearing at deep-run
  milestones, as a visual tension cue.
- Denser late-run lane-dodge patterns as the in-run difficulty ceiling.
  **Jump-obstacle frequency and telegraph timing never scale up, even
  here** — this dimension of difficulty is permanently fixed (§11).
- Explicitly **not** in Post-MVP, ever: any real-money purchase, any
  currency/gacha/unlock-web system spanning sessions or games (§11).

---

## 3. Core loop

Scoped to MVP; inline notes mark what's POC-only (simplified) or
Post-MVP-only (deferred).

1. The camera auto-scrolls forward down a straight, 3-lane city street at
   a speed the player never controls — only Leonardo's lane and jump
   timing are player-controlled.
2. A left lean shifts Leonardo one lane left; a right lean shifts one lane
   right (clamped at the outer lanes); a distinct up-lean triggers a jump.
   There is no down input anywhere in this design — no slide, no duck, no
   crouch-under obstacle type exists at all, at any tier (§4, §11).
3. Lane-blocking obstacles (barricade, parked delivery cart, Foot-bot
   wreckage chunk — 1 type in POC, 2–3 in MVP) occupy a single lane and
   are dodged purely by lane-switching.
4. The one jump-obstacle (a low road-construction barrier/pipe, always
   the same silhouette/color) spans all 3 lanes and must be jumped; it is
   always telegraphed a full beat ahead via a distinct warning glow/sound
   cue, and is never spawned in the same wave as a lane-blocker requiring
   a lane decision — the player is never asked "which lane" and "jump or
   not" in the same instant, at any block (§5.3).
5. The CHASE meter (top-left HUD; not present in POC, §2) ticks up
   passively over time, spikes further on any obstacle hit, and drains
   fast on a pizza pickup or slowly on a coin pickup — both auto-collected
   on lane overlap, no separate input (§5.5).
6. A rare smoke-bomb pickup (MVP+; not in POC) grants a few seconds of
   automatic invulnerable dash-through, collected passively like
   pizza/coins, pausing the meter's passive fill and suppressing hit
   spikes for its duration (§5.6).
7. Difficulty escalates across 3 in-run blocks — back-alley → market
   street → rooftop-bridge overpass (MVP; POC has one constant
   block/pace) — each raising lane-blocker density and the CHASE meter's
   base fill-rate, while jump-obstacle rarity and telegraph timing stay
   fixed at every block (§5.4).
8. The run ends when the CHASE meter reaches full — a brief scripted
   catch beat, then a game-over score screen (final score,
   best-score-this-session, restart). POC ends instead on the first
   obstacle hit, no score screen required.
9. Player retries; the block/difficulty ramp and CHASE meter always
   restart from block 1 / zero — no persistent progression carries
   between runs beyond an optional session high-score display (§8).

---

## 4. Controls

**Mode: Digital** (`forwardSteeringKeys = true` on the GoBalance
`WebGameController`, synthetic `ArrowLeft`/`ArrowRight`/`ArrowUp`
`keydown`/`keyup` events with hysteresis).

**Why digital, not analog:** the entire mechanic is discrete — Leonardo
only ever occupies exactly one of 3 fixed lane slots, and jump is a single
one-shot action, never a continuously-variable position. This is precisely
the archetype digital mode exists for (per `GOBALANCE_SDK.md`: "right for
lane-switch/jump/dodge-style games"), unlike this repo's continuous-
steering carve-outs (`Astro_Tunnel`, `TmntSewerSlide`) which need analog's
raw tilt vector for genuinely proportional positioning. Here, exposing a
raw continuous tilt value via analog mode would just require the game to
quantize it into lane steps itself — work the SDK's digital mode already
does for free via its press/release hysteresis (0.35 tilt to press, 0.20
to release), so there's no reason to bypass it.

**Exact mapping:**
- `ArrowLeft` press (edge-detected — a fresh `keydown`, not a hold) → shift
  Leonardo one lane left, clamped at the leftmost lane. Holding the key
  does not repeat the step; a new lane-shift requires the lean to release
  and re-cross the press threshold, matching the SDK's own hysteresis
  behavior and the genre's snap-between-lanes feel.
- `ArrowRight` press (edge-detected) → shift one lane right, clamped at
  the rightmost lane.
- `ArrowUp` press (edge-detected) → trigger the jump arc, only if not
  already airborne (a press while mid-jump is ignored — no double-jump).
- `ArrowDown` is never wired to anything, ever, at any tier — no slide,
  duck, or crouch-under mechanic exists in this design (§3, §11).
- Reuse this repo's existing `pollLaneStep()`-style edge-detected
  one-shot-step input primitive (`CarRacer/src/input.js`) as the proven
  pattern for exactly this "one press = one discrete step" behavior,
  extended to also handle the jump action the same way (an edge-detected
  boolean rather than a stepped integer).
- Keyboard fallback for desktop dev/testing is not a separate code path
  here — digital mode's synthetic key events are real `ArrowLeft`/
  `ArrowRight`/`ArrowUp` `keydown`/`keyup` `KeyboardEvent`s keyed on
  `e.code`. A game built against real arrow-key listeners needs zero
  additional code to also work on real GoBalance hardware, per
  `GOBALANCE_SDK.md`.

---

## 5. World / mechanics

### 5.1 Street structure & camera
- A flat, straight 3-lane city street: street/sidewalk plane geometry with
  buildings as flat-textured facade geometry receding on both sides toward
  a neon dusk vanishing point, matching the concept art's converging
  perspective. This is the "TubeGeometry/path-following corridor
  technique adapted to a flat street path rather than a tube" the brief
  calls for — in practice, closer to this repo's existing flat-3D-street
  precedent, `CarRacer/src/road.js` (a flat road segment with fixed lane
  positions) and `CarRacer/src/camera-rig.js` (a fixed-offset follow
  camera with lerp/lean), than to `Astro_Tunnel`/`TmntSewerSlide`'s
  tube-based approach — reused here as the proven flat-street building
  block, not copied game logic.
- 3 fixed lane x-positions (reuse a `LANE_WIDTH`-style constant, per
  `CarRacer/src/constants.js`'s pattern).
- Camera: fixed third-person offset behind/above Leonardo, easing
  (lerping) toward his current lane's x-position on every lane-shift
  rather than snapping instantly — this is what sells the "lean between
  lanes" cinematically and matches the concept art's "just behind and
  above" framing.
- Forward speed is never player-controlled, at any tier — auto-scroll,
  stepping up modestly per block (§5.4), capped so no block ever demands
  faster reaction than a lean board can comfortably give.
- **No camera banking/curve is needed for this game** — the street stays a
  straight path at every tier; block transitions are a re-themed texture/
  prop pass on the same straight geometry, not new track shape (unlike
  this repo's tunnel-based carve-outs, which curve for their own reasons).
- Environment surfaces must use real illustrated 2D art per §0's
  correction, not procedurally-drawn canvas patterns.

### 5.2 Player lane position & jump arc
- Leonardo's lane is a discrete index (0/1/2, left/center/right); his
  on-screen x-position eases (lerps, not snaps) toward the target lane's x
  each frame, so a lane-shift reads as a quick lean-cross rather than a
  teleport — matching the concept art's "caught mid-lane-change lean"
  pose.
- Jump is a simple parametric hop arc (a short easing curve on y over a
  fixed duration) triggered by the up-lean edge, purely vertical. Lane
  input and jump input are independent — a lane-shift can happen mid-jump
  with no special-case restriction — but see §5.3 for why the two are
  never asked for in the same instant by *obstacle design*, not input
  restriction.

### 5.3 Obstacles: lane-blockers vs. the one jump-obstacle
- **Lane-blockers** (barricade — POC+; parked delivery cart, Foot-bot
  wreckage chunk — MVP+): each occupies exactly one full lane width, one
  lane, dodged purely by lane-switching. No jump interaction — these
  cannot be jumped over, only lane-changed around. Spawn ahead at a fixed
  z, scroll toward the camera, lane-index + z-distance overlap check for
  collision (matching this pipeline's established lane-runner collision
  technique — no physics engine needed).
- **The one jump-obstacle** (low road-construction barrier/pipe): always
  the same silhouette and color so it reads instantly as "the jump one"
  without requiring the player to parse it in the moment. It spans **all
  3 lanes** — unavoidable by lane-switching alone, must be jumped — and is
  always telegraphed a full beat ahead of reachability via a distinct
  warning glow/sound cue. **It is never spawned in the same wave/window as
  a lane-blocker that requires a lane decision** — the player is never
  asked "which lane" and "jump or not" in the same instant, at any block.
  This is the single most load-bearing rule in this design's GoBalance fit
  and must not erode during implementation or tuning, at any tier (§11).
- Jump-obstacles are deliberately rare — tune spawn frequency as a
  once-in-a-while event, never a repeating pattern, and this rarity and
  telegraph-window length **do not increase with block difficulty**
  (§5.4) — only lane-blocker density/pace do.

### 5.4 In-run blocks & difficulty ramp (MVP)
Three in-run blocks for MVP, matching the brief's naming:
1. **Back-alley** — lowest obstacle density, base CHASE meter passive
   fill-rate and base forward speed. The run's opening/onboarding block.
2. **Market street** — increased lane-blocker density, a modest step-up
   to the CHASE meter's passive fill-rate and forward speed.
3. **Rooftop-bridge overpass** — MVP's highest lane-blocker density and
   CHASE fill-rate/speed.

Fixed at every block, never scaled up: jump-obstacle frequency, telegraph-
window length, and the never-stacked-with-a-lane-decision rule (§5.3) —
only lane-dodge density and pace increase block to block. Each block
transition gets a brief, non-blocking name-card banner (§7) plus a
re-themed street/building texture pass (recolor/retexture only, no new
geometry needed). POC has one constant block/pace throughout, no
transitions. Post-MVP extends this to more block themes (§2).

### 5.5 CHASE meter (MVP)
- A single 0–100 value, HUD bar top-left, per concept art placement.
- **Passive base fill-rate**: ticks up continuously over time at a rate
  set per the current block (§5.4) — this represents the Foot-bot's
  ambient pursuit pressure; the meter is not purely hit-driven, so even a
  player who never gets clipped still needs pickups to manage it.
- **Hit spike**: getting clipped by any obstacle (a lane-blocker or the
  jump-obstacle) adds a larger, immediate fill increment on top of the
  passive rate. This is the brief's central hit-buffering behavior — a
  single clip doesn't end the run, it only pushes the meter, so neither
  lane-changes nor the occasional jump ever need to land in a
  split-second reflex window to avoid instant failure.
- **Drain**: a pizza pickup is a large/fast decrement; a coin pickup is a
  small/slow decrement. Both are auto-collected purely by lane overlap, no
  separate input (§3, §6).
- **Smoke-bomb window** (§5.6): passive fill is paused and hit-spikes are
  fully suppressed for the window's duration.
- **Meter reaching 100** = the Foot-bot catches Leonardo — a brief
  scripted grab/catch animation beat, then the run ends and the
  game-over score screen appears (§7, §8).
- Not present in POC (§2) — either no meter at all (hit = instant fail),
  or a bare static distance counter with no fill/drain behavior.

### 5.6 Smoke-bomb pickup (MVP)
- Rare, passively collected exactly like pizza/coins (lane-overlap, no
  separate input) — the run's only power-up.
- Grants a few seconds (tune ~3–5s) of automatic invulnerability:
  obstacles pass through Leonardo with no hit-spike, and the CHASE meter's
  passive fill is paused for the duration (§5.5).
- A clear visual cue (smoke trail/glow) signals the window is active, and
  a brief fade/cue signals it ending (§7).
- No stacking with itself or any other power-up type at MVP — this is the
  run's single power-up, matching the brief's scope exactly.

---

## 6. Entities

- **Leonardo (player)** — a layered cutout-rig: separate flat sprite
  parts for torso/shell, legs, arms/sword-arms, and head, each driven by
  simple per-part rotation (not whole-body PNG swaps) for: run-loop cycle,
  lane-shift lean (banking into the direction of travel), jump
  (rise/apex/fall arc pose), hit-reaction (a brief flinch/flash on a
  CHASE-meter hit spike — not a death state), smoke-dash invulnerable
  glow variant, and a caught/game-over pose. **POC**: a single static
  placeholder billboard sprite is enough to validate lane-switching and
  jump feel; the cutout rig is an MVP requirement (§2, §9.1).
- **Barricade** (lane-blocker obstacle, POC+) — static striped barricade
  billboard, full one-lane width, no animation needed.
- **Parked delivery cart** (lane-blocker obstacle, MVP+) — static stacked-
  cart billboard, one lane.
- **Foot-bot wreckage chunk** (lane-blocker obstacle, MVP+) — static
  debris billboard, one lane; reinforces the Foot-bot's presence in the
  world without being the pursuer entity itself.
- **Low pipe/construction barrier** (the one jump-obstacle, POC+) —
  always the same silhouette/color, spans all 3 lanes, carries the
  telegraph glow/sound cue (§5.3, §7).
- **Pizza slice** (pickup, MVP+) — floating billboard with a small
  bob/sparkle idle animation; fast CHASE-meter drain plus a score
  contribution on collect (§5.5, §8); destroyed with a small hit-flash/
  particle burst + score popup; simply exits off-screen if missed, no
  penalty.
- **Coin** (pickup, MVP+) — spinning billboard; slow CHASE-meter drain
  plus a smaller score contribution on collect; same popup/exit behavior
  as pizza.
- **Smoke bomb** (pickup, MVP+) — a visually distinct smoke-cloud billboard,
  triggers the invulnerability window on collect (§5.6).
- **Foot-bot pursuer** — staged as a strong, instantly readable silhouette
  in the background/mid-ground over Leonardo's shoulder, per the brief's
  cited source-report staging note ("chase characters... staged with
  strong, readable silhouettes even viewed from behind at a distance").
  Not a lane-occupying, collidable entity — its screen-space size/
  proximity should visually track the CHASE meter's current value
  (looming closer/larger as the meter fills, receding as it drains) so the
  meter reads as "how close is it" rather than an abstract bar, and it
  performs a scripted catch/grab animation beat when the meter maxes out.
- **Post-MVP only:** turtle-select roster (Raphael, Michelangelo,
  Donatello — cosmetic variants of the same player entity, not new
  mechanics); a bigger/faster Foot-bot pursuit form as a deep-run visual
  tension cue; a two-lane-wide Foot-bot debris hazard (forces the one
  remaining lane); a rolling barrel hazard.
- Keep all lane-blocker types driven by one shared "lane obstacle"
  behavior (spawn at lane + z, scroll, lane-index + z-distance collision,
  recycle) with only sprite/size differing, and all pickups driven by one
  shared "pickup" behavior (spawn, scroll, lane-overlap collect, on-
  collect effect) — this keeps Post-MVP's added hazard/pickup variety a
  data addition, not new placement/collision logic.

---

## 7. UI/HUD

- **CHASE meter bar** — top-left, per concept art placement, filling and
  draining visibly in real time (§5.5). Not present in POC (or a bare
  placeholder static counter, §2).
- **Score + coin count** — top-right, per concept art placement. MVP+.
- **Jump-obstacle telegraph cue** — a distinct glow/sound a full beat
  before the low-pipe barrier is reachable (§5.3). This is a core-
  mechanic-legibility element, not decorative polish — present from POC
  in at least a simple form, since it's the one thing the entire
  "occasional jump" design depends on reading clearly even at the
  smallest scale.
- **Block-transition banner** — brief, non-blocking name-card on block
  change (e.g. "MARKET STREET", "ROOFTOP-BRIDGE OVERPASS"), matching
  §5.4's naming. MVP only.
- **Smoke-bomb active indicator** — small icon/glow cue while the
  invulnerability window is active, plus a brief fade cue as it ends
  (§5.6). MVP+.
- **Game-over overlay** — final score, best-score-this-session, restart
  button. Must satisfy the GoBalance SDK's exact DOM contract —
  `#gameover-overlay` toggling a `hidden` class, `#restart-button` inside
  it doing the actual restart (see `GOBALANCE_SDK.md`, the builder's
  ground truth for this, not repeated in full here).
- UI is a DOM/CSS overlay on top of the WebGL canvas, not drawn into the
  3D scene itself (no Three.js sprite/text-based HUD) — keeps HUD text
  crisp and simple to update without touching render logic.

---

## 8. Scoring / progression

- **Score** = a continuous distance/time-based base accrual (Leonardo
  survives forward at the current block's speed) **+** a small value per
  coin collected **+** a larger value per pizza collected. Both pickups do
  double duty — a CHASE-meter drain effect (§5.5) and a score
  contribution — since there's no separate persistent currency for them
  to represent in this design (see explicit confirmation below).
- **No lives system** — the CHASE meter (§5.5) is the run's entire
  fail-condition device; its hit-buffering already softens the physical
  ask (a clip costs meter progress, not the run), so a separate lives
  system would be redundant here, unlike this pipeline's other TMNT
  sibling games.
- **In-game block progression (required, and exactly the encouraged kind
  of progression for this product)**: 3 blocks per run at MVP (back-alley
  → market street → rooftop-bridge overpass, §5.4), reached purely by
  in-run distance/time thresholds, always restarting from block 1 on a
  new run. This is progression *within a single run*, not something that
  persists or is "unlocked" across sessions. Post-MVP's additional block
  themes (§2) extend this same in-run structure, they don't change its
  shape.
- **Explicitly confirmed — no purchases, no currency, no cross-session
  meta-unlock web, anywhere in this system, even implicitly:**
  - Coins, pizza, and the CHASE meter all reset to zero at the start of
    every run — there is no persistent coin bank, no cross-run mission
    list, no carried-over score multiplier (deliberately dropped, per the
    brief's own explicit contrast with the source game's persistent
    10,144-coin/x2-multiplier economy).
  - No shop screen, no unlockable content gated behind score/currency
    accumulated across multiple past runs.
  - No IAP, no ads-for-currency, no paid continue/revive.
  - Post-MVP's "choose your turtle" (§2) is unlocked in-run via a
    milestone or a simple session-start menu choice, never gated behind
    spending anything earned in a prior run.
  - The only thing that persists between runs, if anything, is a
    best-score-this-session display for bragging-rights purposes — an
    ordinary arcade high-score stat, not a system. A simple in-memory
    session variable is sufficient; an optional `localStorage` best-score
    is also fine if implemented, but it is display-only and gates
    nothing.

---

## 9. Technical architecture

### 9.1 Rendering approach
**Three.js**, per Amit's explicit direction for this concept — a real
3D-perspective street scene, not a flat Canvas-2D approximation (§0).
Build around this repo's existing flat-3D-street precedent rather than its
tube-based one:

- **Street geometry**: flat street/sidewalk plane + flat-textured
  building-facade geometry receding toward a vanishing point, matching
  `CarRacer/src/road.js`'s approach (a flat road segment with fixed lane
  positions) rather than `Astro_Tunnel`/`TmntSewerSlide`'s
  `TubeGeometry`/centerline-spline corridor — this game is a street, not a
  tube.
- **Camera**: a fixed third-person follow rig behind/above Leonardo,
  lerping toward his current lane x on lane-shift and adding a subtle
  lean/sway, reusing the technique already proven in
  `CarRacer/src/camera-rig.js` (`FOLLOW_LERP`-style easing, `lookAt` reset
  + roll-after pattern) as the established working pattern for this exact
  building block, not a copy of that file's exact car-racing tuning.
- **Player**: `THREE.Sprite`/billboard planes for each cutout-rig part
  (torso/shell, legs, arms/sword-arms, head), grouped under one
  `THREE.Group` per Leonardo instance with each part offset from the
  group's origin and individually rotated per frame for the run cycle and
  lane-lean bank — per `WEB_MINIGAME_TECH_RETROSPECTIVE.md`'s "2D sprites
  inside a real 3D scene" technique note.
- **Obstacles/pickups**: `THREE.Sprite`/billboard planes, each keyed by a
  `(lane, distanceDownStreet)` pair, moving toward the camera as distance
  decreases (§5.3, §5.5, §6). Pooled/recycled, not created/disposed per
  spawn — matches this repo's established practice for scrolling-obstacle
  fields (e.g. `CarRacer/src/traffic.js`'s pattern).
- **Collision**: lane-index + z-distance overlap check (comparing
  Leonardo's current lane against an obstacle's/pickup's lane once its
  distance crosses a strike/collect threshold) — the same *shape* of
  check this pipeline's other lane/angle-based games already use, no
  physics engine needed.
- **Environment surfaces** must be real, Kolbo-generated illustrated 2D
  art (§0's correction) — never a procedurally-drawn canvas texture.
- No custom shaders or exotic tooling needed — standard
  `WebGLRenderer`. Keep any postprocessing (bloom on neon signage/string
  lights, matching the concept art's glow) behind an easy on/off toggle,
  consistent with this repo's existing Three.js carve-outs — unverified
  GPU cost on real WebView hardware until tested on-device.

### 9.2 State management shape
A small explicit state machine: `countdown`/`playable` → `running` →
`gameover` → back to `running` on restart (no menu state needed — the
GoBalance SDK contract requires reaching a playable/countdown state on
load with no key needed, see `GOBALANCE_SDK.md`). Block/difficulty
tracking, obstacle/pickup spawning, and CHASE-meter fill/drain all live as
plain state read/updated by systems ticking once per frame from the game
loop — no framework-level state manager needed at this scope.

### 9.3 Suggested code structure
```
/src
  /core        - renderer/scene/camera bootstrap, game loop, top-level
                 state machine (countdown/running/gameover)
  /street      - flat street/building geometry construction, lane
                 x-position constants, block theme (texture/material)
                 swap, camera follow-rig (lerp toward player's lane x,
                 fixed offset + lean — reusing CarRacer/src/camera-rig.js's
                 lerp-follow pattern)
  /entities    - player (lane index, easing toward target lane x, jump
                 arc, cutout-rig per-part rotation), shared "lane
                 obstacle" behavior (spawn/scroll/lane-index+z-distance
                 collision/recycle), shared "pickup" behavior (spawn/
                 scroll/lane-overlap collect/recycle), Foot-bot pursuer
                 (background-staged, visually tracks CHASE-meter value,
                 no collision of its own)
  /systems     - block/difficulty progression tracker, CHASE-meter
                 tracker (passive fill-rate + hit-spike + pickup-drain +
                 smoke-bomb pause), score tracker
  /input       - single input-reading module: real ArrowLeft/ArrowRight/
                 ArrowUp keydown/keyup listeners (edge-detected one-shot
                 steps for both lane-change and jump, reusing
                 CarRacer/src/input.js's pollLaneStep()-style edge-
                 detection pattern) — digital mode only, never reads
                 window.__gbSensor (§4)
  /ui          - DOM overlay: CHASE meter, score/coins, jump-telegraph
                 cue, block banner, smoke-bomb indicator, game-over
                 overlay (#gameover-overlay / #restart-button per SDK
                 contract) - plain JS/DOM, no framework
  /data        - block definitions (theme, obstacle density, CHASE
                 base-fill-rate, distance/time threshold to advance),
                 obstacle/pickup type definitions (sprite, size, on-
                 collect/on-hit effect) - keep block and turtle-roster
                 content here so Post-MVP's turtle-select (§2) and
                 additional blocks stay data additions, not core-logic
                 rewrites
  /assets      - placeholder billboard sprites now (POC), real per-part/
                 per-type 2D art later (MVP), real illustrated
                 street/building textures per §0
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
1. Three.js scene bootstrap: straight flat 3-lane street segment (simple
   flat-colored or placeholder-textured lanes/buildings is fine),
   fixed-offset camera-follow rig, one placeholder Leonardo billboard
   fixed in the center lane — confirm the "3D street + flat 2D sprite"
   look and forward auto-scroll feel read correctly before adding input.
2. Wire discrete digital input (§4): `ArrowLeft`/`ArrowRight` edge-
   detected lane-step (reusing the `pollLaneStep()`-style pattern), lane
   index easing toward the target x; `ArrowUp` edge-detected simple hop
   arc jump. Verify lane-switching reads as a clean discrete step (not
   laggy or laney) and the jump arc feels good before adding any
   obstacles.
3. One lane-blocking obstacle type (barricade) plus the one jump-obstacle
   type (low pipe barrier, with its telegraph glow/sound cue), both
   spawning/scrolling with lane-index + z-distance collision. A hit ends
   the run immediately (no CHASE meter yet, §2). Verify the core "3-lane
   dodge + rare telegraphed jump" loop is genuinely fun and physically
   comfortable at a well-below-native-tempo pace before building anything
   else.

### MVP (turn the POC into the shippable game)
4. Full CHASE meter system (§5.5): passive base fill-rate, hit-spike, HUD
   bar top-left — replacing POC's instant-fail-on-hit.
5. Pizza + coin pickups: lane-overlap auto-collect, fast/slow CHASE
   drain, score contribution (§5.5, §8); score + coin HUD top-right.
6. Remaining lane-blocker types (parked delivery cart, Foot-bot wreckage
   chunk) added via the shared "lane obstacle" behavior (§9.3) so adding
   types is a data change, not new logic.
7. Smoke-bomb pickup + invulnerability window (pauses passive fill,
   suppresses hit-spikes) + active-window HUD indicator (§5.6, §7).
8. Foot-bot pursuer entity staged over Leonardo's shoulder, visual
   proximity tracking the CHASE meter's value, scripted catch animation
   at meter-full + proper game-over overlay (`#gameover-overlay`/
   `#restart-button` contract) with final score + best-score-this-session.
9. Three in-run blocks (back-alley → market street → rooftop-bridge
   overpass, §5.4) as data-defined stages: density + CHASE-base-fill-rate
   step-up + block-transition banner — jump-obstacle rarity/telegraph
   rules held fixed across all three.
10. Cutout-rig Leonardo: real per-part 2D art (torso/shell, legs,
    arms/sword-arms, head) replacing POC's placeholder billboard, driven
    by per-part rotation for run/lane-lean/jump/hit/caught states (§1,
    §9.1).
11. Real 2D art pass for all obstacle/pickup types and each block's
    re-themed street/building textures — real Kolbo-illustrated art per
    §0's environment-art correction, not procedural canvas patterns.
12. Pacing pass across all three blocks — verify the jump-obstacle is
    never stacked with a lane decision at any block, jump frequency stays
    rare everywhere, and overall pace stays well below native
    Subway-Surfers tempo; tune against actual on-device board feel, not
    desktop-keyboard feel alone.

### Post-MVP (backlog, unordered)
- Turtle-select — Raphael/Michelangelo/Donatello as additional cosmetic
  player variants, unlocked in-run via a milestone or a simple
  session-start menu choice.
- Additional block themes: subway platform, harbor docks, rooftop-chase
  finale.
- Additional obstacle/hazard variety: a two-lane-wide Foot-bot debris
  hazard forcing the one remaining lane, a rolling barrel.
- A bigger/faster Foot-bot pursuit form as a visual tension cue at
  deep-run milestones.
- Denser late-run lane-dodge patterns as an in-run difficulty ceiling for
  high-skill single runs — jump-obstacle frequency/telegraph rules stay
  fixed even here.

---

## 11. Explicitly out of scope

- **Any real-money IAP, paid currency, ads-for-currency, or purchase path
  of any kind — permanently out of scope for this product, not just this
  doc's tiers** (see §0, §8).
- **Any cross-session/cross-game meta-progression, unlock web, or
  currency-sink system** — including at Post-MVP. Turtle-select and
  additional blocks are in-run/session-start content additions, never
  gated behind cross-run accumulation.
- **Slide/duck/crouch mechanic or any down-input** — never, at any tier,
  including Post-MVP's added hazard variety (the two-lane-wide debris
  hazard forces a specific remaining lane, not a duck-under). This was an
  explicit, deliberate resolution in the approved brief and must not be
  reintroduced as a "simplification" or "added depth" at any stage.
- **Jump-obstacle frequency/telegraph-window erosion** — this dimension
  never gets harder, faster, or stacked with a lane decision, even at
  Post-MVP's densest lane-dodge patterns. Only lane-dodge density/pace
  scale with difficulty.
- **Fast alternating left-right-jump reflex sequences** — overall pace
  stays deliberately slower than the native genre's phone-swipe tempo at
  every tier; this is the brief's central resolution to the "requires all
  4 directions fast" GoBalance-fit problem and must be preserved during
  tuning, not treated as a placeholder pace to speed up later.
- **Free camera or free player positioning** — Leonardo always occupies
  exactly one of 3 discrete lanes; the cosmetic lane-shift ease is not
  free x-axis movement.
- **Real 3D-modeled geometry for Leonardo, obstacles, or pickups** — these
  stay flat 2D sprite/billboard art inside the 3D street at every tier,
  per Amit's explicit direction (§0, §1).
- **Procedurally-drawn canvas textures for environment surfaces** — street/
  building/sidewalk textures must be real illustrated 2D art, per
  `WEB_MINIGAME_TECH_RETROSPECTIVE.md`'s correction (§0, §9.1).
- Networked leaderboards/multiplayer.
- A separate lives system — the CHASE meter is the run's sole
  fail-condition device (§8); do not add lives on top of it.
- Physics-based collision/ragdoll — lane-index + z-distance overlap
  checks are sufficient (§5.3); no physics engine needed.

---

## 12. Open questions / risks

- **Exact CHASE meter numbers** (passive fill-rate per block, hit-spike
  size, pizza/coin drain amounts, smoke-bomb duration) are left to stage 4
  to tune within this doc's directional guidance (§5.5, §10's pacing-pass
  milestone) — no single correct number is specified on purpose; tune
  against actual on-device board feel.
- **Exact jump-obstacle spawn frequency and telegraph-window timing** —
  "rare" and "a full beat ahead" are directional; stage 4 should land on
  concrete numbers and playtest specifically for legibility (does the
  warning genuinely give enough time to react on a lean board, not just a
  keyboard).
- **Foot-bot visual-proximity-tracks-meter staging** — directionally
  specified (looms closer/larger as the meter fills) but the exact
  staging detail (does it ever move into clearer foreground focus at high
  fill, or stay a background silhouette always) is left as an
  implementation call; per the brief's cited source-report staging note,
  the "strong, readable silhouette even from behind at a distance" framing
  should not be abandoned for a closer/more detailed model even at high
  meter fill, unless playtesting shows the tension read needs it.
- **Coin/pizza score-value tuning vs. their CHASE-drain role** — whether
  coins and pizza should weight more toward score or more toward their
  meter-management utility is left as a tuning call (§8); avoid making
  either pickup feel like a "trap" (draining the meter so effectively that
  ignoring obstacles entirely becomes optimal play).
- **Rendering-stack decision (per project memory) does not apply here** —
  this game is a mandated Three.js 3D carve-out per Amit's explicit
  direction (§0), the same status as `Astro_Tunnel`/`CarRacer`/
  `TmntSewerSlide`, not a game affected by the CTO's still-pending 2D
  engine-default decision.
- **Environment art sourcing** — must be real Kolbo-illustrated street/
  building textures per §0/§9.1's correction; the concrete asset list and
  exact palette/style breakdown is stage 4's to originate from the
  concept frames and the *Mutant Mayhem* reference stills, not resolved
  further here.
- **Licensor approval checkpoint** — as with any TMNT-branded asset in
  this pipeline, confirm what needs sign-off (Leonardo likeness fidelity,
  Foot-bot design, obstacle/prop design) before treating final art as
  locked; not resolved by this doc.
