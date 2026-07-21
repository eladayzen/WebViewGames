# TMNT: Skate & Slice — Game Design & Build Doc
### (Michelangelo rooftop catcher — GoBalance build)

Draft v1 — for implementation by Claude Code. Full spec, placeholder-art-first
where noted. Expanded from the approved macro brief at
`pipeline/macro-briefs/approved/tmnt-skate-strike-catcher/brief.md`.

---

## 0. IP note (read first)

This is a **TMNT-themed product** using Michelangelo, his nunchaku, and the
general *Mutant Mayhem*-era visual language — treat character
likeness/name/design fidelity as subject to whatever licensor approval
process applies to final art, same as any other TMNT-branded asset in this
pipeline; that process is outside this doc's scope.

**No IAP, no paid currency, no cross-session meta-progression or unlock web
of any kind — permanent product constraint**, not a v1 cut (see §8 and
§11). This game runs on the GoBalance balance-board product, used during
physical activity; the entire economy this doc specifies is in-run score
and in-game (within-this-game) stage unlocks only.

---

## 1. Vision

Michelangelo skates back and forth along a single rooftop ground line,
swinging his nunchaku in a swirling arc to smash falling pizza slices and
a glowing mutant-ooze power-up, while dodging falling bombs — a light,
funny, high-energy reskin of the classic catcher genre (`Kaboom!`-style:
horizontal-only positioning, catch-vs-avoid discrimination, escalating
pace), reframed as a turtle "attacking" incoming food and hazards rather
than passively catching them in his mouth. Target feel: goofy, warm,
rooftop-at-dusk city vibe; punchy juicy hit-feedback (impact stars, swing
whoosh, screen-shake on bomb hits) over anything mechanically deep — the
genre's fun comes from tempo and polish, not added input complexity, and
this build should lean hard into that rather than trying to make the loop
"deeper" than it needs to be.

**Art direction anchor (stage 4 does not own art direction, only points at
it):**
- Concept art: `pipeline/macro-briefs/approved/tmnt-skate-strike-catcher/concepts/concept-01.png`
  is the approved concept frame — hand-drawn-over-CG painterly *Mutant
  Mayhem* style, warm dusk city palette, Michelangelo in orange
  mask/wraps mid-swing on a skateboard, pizza/ooze/bomb falling around
  him, flat rooftop background with water towers and a glowing skyline.
  Use this as the single source of truth for character design, palette,
  and mood. The other three generated variations
  (`concept-02.png`–`concept-04.png`) and the prompt used
  (`concepts/prompt.txt`) are in the same folder for additional reference
  if useful, but `concept-01.png` is the selected one.
- Style reference stills: `/Users/eladayzen/Documents/tmnt/` — the
  *Mutant Mayhem*-era reference stills the concept art was generated
  against. Use these alongside `concept-01.png` for any additional
  texture/lighting/linework guidance the single concept frame doesn't
  fully cover.
- **Camera framing note (Amit's direct preference):** the in-game camera
  should be a bit wider / more pulled-out than `concept-01.png` shows —
  the concept frame's character is fairly large/close in the frame; the
  actual build should give more breathing room around the action (more
  visible sky/rooftop above and to both sides of Michelangelo, so falling
  items have more visible travel distance before reaching him and the
  scene doesn't feel cramped). Not critical/blocking, just a stated
  preference — see §5.5 for the concrete framing spec this implies.

---

## 2. Scope tiers

### POC
Prove the core "swing-as-catch" feel is fun and readable before building
anything else.
- One static rooftop background (flat art, no parallax needed).
- Michelangelo skating left/right with a placeholder swing animation
  (can be a simple sprite-swap or arc flash, doesn't need final art).
- Pizza slices and bombs fall (**no ooze power-up yet**).
- Simple hit/dodge detection: pizza struck disappears with a basic
  flash/particle; bomb hit ends the run immediately (no lives system
  yet — one bomb hit = game over, simplest possible fail state).
- No scoring UI, no combo system, no difficulty ramp, no stages — a
  single constant-pace falling-item loop that runs until a bomb is hit.
- Placeholder art throughout is fine; the only thing POC needs to prove
  is that "lean toward a falling pizza, get an automatic satisfying
  swing-hit; lean away from a bomb, dodge it" reads and feels good at a
  GoBalance-appropriate pace.

### MVP
The smallest version worth actually shipping as a real GoBalance game.
- Everything in POC, plus:
- Full scoring with **combo streaks** for consecutive pizza hits
  (§8).
- A **3-life system**: each bomb hit costs one life; third bomb hit ends
  the run (§5.4).
- The **mutant-ooze power-up** with one clear time-limited effect
  (widened swing/hit-tolerance arc — see §5.3).
- A **difficulty ramp across a small set of in-game stages** (3–5
  stages, e.g. rooftop → fire escape → alley), triggered by score/time
  thresholds, each stage a re-themed background plus a faster/denser
  falling-item mix (§5.2).
- A **game-over score screen** (final score, best combo, retry).
- Michelangelo only — no turtle-select.
- Real (non-placeholder) 2D art per stage 4's asset pipeline, matching
  the approved concept direction in §1.

### Post-MVP (backlog — not committed work)
More in-game content and depth within a single session/campaign. None of
this is meta-progression across sessions/games — it's all deeper content
*within this one game*.
- **"Choose your turtle"**: Leonardo (katana), Raphael (sai), Donatello
  (bo staff) as additional playable characters, each with a distinct
  weapon-swing animation and optionally a personality-flavored good-item
  variant (e.g. a Raphael-flavored treat).
- More rooftop/city stage themes beyond the MVP's 3–5 (e.g. subway
  platform, water tower cluster, billboard-top).
- More falling-item variety: additional good-item types (different
  foods), additional ooze power-up effects (speed boost, slow-fall
  radius — the two options not used for MVP's single effect, see
  §5.3), possibly a second hazard type distinct from bombs.
- Denser late-game hazard patterns as an in-run difficulty ceiling for
  players who get very good at a single run.
- Explicitly **not** in Post-MVP, ever: any real-money purchase, any
  currency/gacha/unlock-web system spanning sessions or games. See §11.

---

## 3. Core loop

Scoped to MVP; inline notes mark what's POC-only (simplified) or
Post-MVP-only (deferred).

1. Michelangelo stands on his skateboard on a single rooftop ground line,
   centered at run start.
2. Player leans left/right on the GoBalance board; Michelangelo skates
   continuously in that direction at a speed proportional to lean angle
   (see §4 for why this is continuous, not discrete-step).
3. Falling items (pizza slices, and — MVP+ — an occasional ooze canister)
   descend from the top of the screen at varying x-positions and a
   stage-dependent fall speed. When a good item reaches the "strike
   band" near Michelangelo's height and his position overlaps its
   x-range (including swing-arc tolerance), he **automatically** swings
   his nunchaku to strike it — no separate attack input, the swing is a
   triggered reaction to successful positioning, exactly as specified in
   the approved brief.
4. Bombs fall the same way; if Michelangelo's position overlaps a
   bomb's x-range at the strike band, he's hit (loses a life — MVP; ends
   the run instantly — POC). If he's positioned elsewhere, the bomb
   passes harmlessly.
5. Striking pizza in succession (no bomb hit, no missed pizza in
   between) builds a **combo streak** that multiplies score (MVP; not in
   POC).
6. Occasionally (MVP+) an ooze canister falls; striking it grants a
   short time-limited "wider swing arc" buff, making the next several
   seconds of pizza-catching easier and higher-scoring (§5.3).
7. Pace escalates in discrete steps as score/time thresholds are
   crossed: fall speed increases, item density/mix increases, and the
   background re-themes to the next stage with a brief "STAGE 2"-style
   banner (MVP; POC has one constant pace throughout, no stages).
8. Run ends when the third bomb hit is taken (MVP) / first bomb hit
   (POC). A game-over screen shows final score and best combo (MVP) or
   nothing beyond a simple restart (POC).
9. Player retries; MVP's stage/difficulty ramp always restarts from
   stage 1 — there is no persistent meta-progression carried between
   runs (see §8).

---

## 4. Controls

**Mode: Analog** (`forwardSteeringKeys = false` on the GoBalance
`WebGameController`, raw tilt read via `window.__gbSensor`).

**Why analog, not digital:** the core mechanic is continuous horizontal
positioning along a single ground line — Michelangelo needs to glide
smoothly and stop precisely under a narrow falling item, and small lean
corrections should produce small, gentle movements rather than a full-
speed step. Digital mode's synthetic-keypress model (discrete on/off
with hysteresis) fits lane-switch/snap-style games well, but here it
would either force full-speed movement on any lean past the threshold
(too coarse for lining up under a narrow pizza slice) or require an
awkward tap-tap rhythm to approximate fine positioning — the opposite of
this genre's actual skill, which is smooth precise centering. Analog
also directly serves the brief's own pacing concern: proportional speed
means a player who only needs a small correction only leans a little, so
the physical demand scales naturally with how far off-position they are,
rather than every correction being a full binary lean regardless of
distance.

**Exact mapping:**
- `window.__gbSensor.x` (range roughly -1..1) → Michelangelo's target
  skate velocity along the single horizontal ground line, scaled by a
  tunable max-speed constant and clamped so the character can't overrun
  either edge of the rooftop.
- `y` component of `__gbSensor` is **unused** — this is a single-axis
  (left/right only) game; there is no vertical player movement, jump, or
  duck. Do not wire `ArrowUp`/`ArrowDown` or any `y`-derived behavior to
  gameplay.
- No attack/swing button of any kind, ever — the swing is a fully
  automatic reaction to successful positional overlap (§3, §6). This is
  the load-bearing design choice that keeps the physical ask at "lean
  left or right," full stop, matching the source report's explicit
  finding that this genre is a 2-direction mechanic.
- Keyboard fallback for desktop dev/testing: `ArrowLeft`/`ArrowRight`
  held (real `keydown`/`keyup` on `e.code`) map to the same continuous
  velocity as a full-magnitude analog tilt in that direction, purely for
  testing convenience outside the board. This is additive dev
  convenience only — it must not be the game's primary input path, and
  must not conflict with reading `__gbSensor` (don't apply both at once
  if a real device happens to also send stray key events; `__gbSensor`
  is the authority when present).

---

## 5. World / mechanics

### 5.1 Rooftop track
- A single flat horizontal ground line near the bottom third of the
  screen, fixed width per stage background. Michelangelo's x-position is
  clamped to stay within this width (with a small margin so he never
  visually clips the screen edge).
- Falling items spawn at randomized x-positions along the same width,
  above the top of the screen, and fall straight down (no horizontal
  drift) at a stage-dependent speed.
- No vertical player movement, no jump, no background scrolling — the
  camera and background are static per stage (see §5.5); only falling
  items and Michelangelo's horizontal position move.

### 5.2 Stages & difficulty ramp (MVP)
- 3–5 in-game stages for MVP, e.g.: **Rooftop → Fire Escape → Alley**
  (exact count/theme order is stage 4's call within this range; 3 is an
  acceptable floor if time-constrained, 5 if there's room).
- Stage transition is triggered by a score and/or elapsed-time threshold
  (tune both; a hybrid — whichever comes first — is a reasonable
  default). On transition: brief non-blocking banner (e.g. "STAGE 2"),
  background swaps to the next stage's art, and fall speed + item
  density step up.
- Each stage step should increase **fall speed** and/or **item density**
  modestly — per the source report's explicit pacing warning, tune
  conservatively slower/more spaced-out than typical mobile catcher
  tempo at every stage, since GoBalance's lean input isn't suited to
  fast alternating corrections. There should be no point in the MVP's
  hardest stage that requires quick alternating left-right snaps; a
  single deliberate lean per approaching item/pair should always be
  enough.
- POC has **no stages** — one constant pace for the whole run.
- Post-MVP may deepen this with more stage themes and a higher late-game
  density ceiling (§2), but the "never require fast alternating
  corrections" rule holds at every tier, including Post-MVP.

### 5.3 Ooze power-up (MVP)
- Rare falling item (glowing green canister), visually and thematically
  distinct from pizza (per concept art) and legible at a glance.
- On successful strike: grants **"wider swing arc"** for a fixed
  duration (tune to ~6–10 seconds) — Michelangelo's effective hit-box
  x-tolerance around his position widens, making it noticeably easier to
  land pizza hits (and, incidentally, harder to avoid a bomb that
  wanders into that widened zone — this is an intentional risk/reward
  tension worth keeping, not a bug to "fix" by exempting bombs from it).
- This is the **one** clear effect for MVP, chosen from the brief's
  three listed options (wider swing arc / speed boost / slow-fall on
  nearby items) because it ties most directly into the nunchaku-swing
  reframe of the core mechanic. The other two effects are explicitly
  Post-MVP content (additional ooze variants — §2), not alternate MVP
  choices.
- Visual/audio cue on activation and a visible countdown/fade as it
  wears off (see §7).
- Not present in POC.

### 5.4 Bombs (hazard)
- Fall the same way as good items: randomized x, straight down,
  stage-paced speed.
- Visually distinct per the source report's reused visual language:
  deliberately stark/drab black-and-yellow danger marking (lit fuse,
  hazard stripes) against the warm pizza/ooze palette — legible as
  "avoid" at a glance, no reading required.
- On overlap with Michelangelo at the strike band: MVP costs one life
  (of 3, see §5.4/§8); POC ends the run immediately. Either way, give a
  clear hit-reaction (screen shake, brief invulnerability flash) so a
  hit is never ambiguous.
- No overlap = bomb simply continues past and off-screen; no
  interaction needed, no "successful dodge" bonus beyond the implicit
  one of not losing a life.

### 5.5 Camera & framing
- Static camera, no scrolling/parallax needed at MVP (a single flat
  background per stage is sufficient — see §5.2).
- **Per Amit's stated preference**, frame the play area noticeably wider
  / more pulled-back than `concept-01.png`'s framing (§1) — the concept
  frame's Michelangelo fills a large portion of the frame at fairly
  close range; the actual in-game camera should show meaningfully more
  sky and rooftop width around him. Concretely: Michelangelo's sprite
  should occupy a visibly smaller fraction of the screen height than in
  the concept art (aim for roughly the lower-third-to-half of the
  vertical frame being open sky above him, versus the concept frame's
  tighter crop), so falling items have a longer, more readable travel
  distance from spawn to strike band, and the rooftop ground line has
  visible room on both sides for full left/right travel. This is a
  polish/legibility preference stated as non-blocking — implement it,
  but don't treat exact pixel framing as something requiring sign-off.

---

## 6. Entities

- **Michelangelo (player)** — skates left/right along the ground line
  (§4). States needed: idle/skate-loop, swing (triggered on good-item
  hit, brief non-blocking animation that doesn't stop movement), bomb-hit
  reaction (brief flinch + invulnerability flash), ooze-buff visual
  variant (e.g. a glow/tint on the swing arc while wider-arc buff is
  active), game-over pose. Placeholder-first: a simple sprite/flipbook
  or even a static sprite with a swapped "swing" frame is enough for
  POC; MVP needs real per-state art matching the concept direction.
- **Pizza slice (good item)** — falls straight down, destroyed with a
  hit-flash/particle-burst + small score popup on successful strike;
  simply exits off-screen if missed (no penalty beyond combo break —
  see §8).
- **Mutant-ooze canister (power-up item, MVP+)** — falls rarer than
  pizza; on strike, triggers the wider-swing-arc buff (§5.3) and is
  removed; if missed, just exits off-screen, no penalty.
- **Bomb (hazard)** — falls straight down; on overlap, triggers a life
  loss + hit-reaction (§5.4); if missed, simply exits off-screen.
- Keep all three falling-item types driven by shared "falling item"
  behavior (spawn, fall, strike-band check, exit-off-screen cleanup)
  with only their type tag (good/power-up/hazard), sprite, and
  on-strike-effect differing — this keeps adding Post-MVP item variety
  (§2) a data addition, not new fall/collision logic.

---

## 7. UI/HUD

- **Top-center or top-right: running score** (updates on each successful
  pizza/ooze strike). Not present in POC.
- **Combo indicator**: small streak counter/multiplier, visible near the
  score, only appears once a streak of 2+ is active; resets/hides on
  miss or bomb hit. MVP only.
- **Lives indicator**: 3 icons (e.g. small turtle-shell or heart icons)
  that lose one per bomb hit. MVP only; POC has no lives display since
  one hit ends the run.
- **Ooze buff indicator**: small icon + countdown/depleting bar while
  the wider-swing-arc buff is active. MVP+ only.
- **Stage banner**: brief, non-blocking "STAGE 2"/"STAGE 3"-style
  banner on stage transition, per §5.2. MVP only.
- **Game-over overlay**: final score, best combo reached, retry button.
  Must satisfy the GoBalance SDK's exact DOM contract — `#gameover-
  overlay` toggling a `hidden` class, `#restart-button` inside it doing
  the actual restart (see `GOBALANCE_SDK.md`, which is the builder's
  ground truth for this, not repeated in full here).
- UI is a DOM/CSS overlay on top of the game canvas, not drawn into the
  canvas itself — keeps HUD text crisp and simple to update without
  touching render logic.

---

## 8. Scoring / progression

- **Score** = sum of points per successful strike (pizza worth a base
  value; ooze worth a smaller/no direct score value since its reward is
  the buff itself — tune whichever feels better, but don't double-dip
  both a large score value and a strong gameplay buff on the same item)
  × active combo multiplier.
- **Combo streak**: consecutive pizza strikes with no miss and no bomb
  hit in between increase a multiplier (e.g. every N consecutive hits
  bumps the multiplier up a step, capped at some max). A missed pizza or
  a bomb hit resets the streak to zero. This is the run's skill-
  expression layer — reward tight positioning and clean strike chains
  over the run's default pace.
- **Lives**: 3 per run (MVP); each bomb hit costs one; 0 remaining ends
  the run. POC: no lives, first bomb hit ends the run.
- **In-game stage progression (required, and this is exactly the
  encouraged kind of progression for this product)**: 3–5 stages per
  run (§5.2), unlocked purely by in-run score/time thresholds, always
  restarting from stage 1 on a new run. This is progression *within a
  single run*, not something that persists or is "unlocked" across
  sessions.
- **Explicitly confirmed — no purchases, no currency, no cross-session
  meta-unlock web, anywhere in this system, even implicitly:**
  - No coins/gems/soft-currency of any kind.
  - No shop screen, no unlockable content gated behind score/currency
    accumulated across multiple past runs.
  - No IAP, no ads-for-currency, no paid continue/revive.
  - Post-MVP's "choose your turtle" (§2) is additional *playable
    content available from the start of a session*, not something
    unlocked by spending anything earned in a prior run.
  - The only thing that persists between runs, if anything, is a
    high-score display for bragging-rights purposes (optional; a simple
    `localStorage` best-score is fine if implemented, but it is display
    only and gates nothing).

---

## 9. Technical architecture

### 9.1 Rendering approach
This is a flat 2D game with a static camera, simple sprite/shape
rendering, and no 3D transforms, lighting, or physics needed — a full
WebGL engine (Three.js/Babylon.js, as used by this repo's 3D-styled
projects) would be unjustified weight and complexity here. Recommended
approach: **plain HTML5 Canvas 2D** (`CanvasRenderingContext2D`), driven
by a hand-rolled fixed-step-friendly game loop (`requestAnimationFrame`,
queued per the GoBalance SDK's rAF-shim requirement — see
`GOBALANCE_SDK.md`, not repeated here). No rendering library dependency
is needed at all; sprites are drawn via `drawImage` (spritesheet frames
or simple per-state images), backgrounds via a single full-canvas
`drawImage` per stage, and simple juice (flashes, particle bursts,
screen shake) via basic canvas primitives/tinting rather than a
particle-system library. If a lightweight 2D library genuinely speeds
implementation (e.g. PixiJS) that's a reasonable substitution, but plain
Canvas 2D is fully sufficient for this game's actual rendering needs and
should be the default assumption unless a concrete reason emerges during
build.

### 9.2 State management shape
A small explicit state machine: `menu` (optional, can skip straight to
countdown) → `countdown`/`playable` → `running` → `gameover` → back to
`running` on restart. Falling-item spawning, difficulty-stage tracking,
combo/score, and lives all live as plain state read/updated by systems
that tick once per frame from the game loop — no need for a
framework-level state manager given the game's small surface area.

### 9.3 Suggested code structure
```
/src
  /core        - canvas/context setup, game loop, top-level state machine
                 (menu/countdown/running/gameover)
  /entities    - player (Michelangelo) controller, falling-item behavior
                 (shared spawn/fall/strike-band/cleanup logic; §6)
  /systems     - spawner (item type/rate per current stage), difficulty/
                 stage-ramp tracker, scoring + combo tracker, lives tracker,
                 ooze-buff timer
  /input       - single input-reading module: reads window.__gbSensor when
                 present, falls back to ArrowLeft/ArrowRight keydown/keyup
                 otherwise, exposes one continuous velocity value to
                 /entities — never let raw input handling leak into
                 gameplay code directly
  /ui          - DOM overlay: score/combo/lives/ooze-buff HUD, stage
                 banner, game-over overlay (#gameover-overlay /
                 #restart-button per SDK contract) - plain JS/DOM, no
                 framework
  /data        - stage definitions (background asset, fall-speed/density
                 tuning, score/time threshold to advance), falling-item
                 type definitions (good/power-up/hazard, sprite, on-strike
                 effect) - keep turtle-specific and stage-specific content
                 here so Post-MVP's turtle-select and additional stages
                 (§2) are data additions, not core-logic rewrites
  /assets      - placeholder art now (POC), real per-stage/per-state art
                 later (MVP)
```
This mirrors the theme/logic separation principle used elsewhere in this
pipeline (keep reskinnable content in `/data` and `/assets`, keep
`/core`/`/entities`/`/systems` theme-agnostic) scaled down to what this
much smaller game actually needs — there is no requirement here to build
out machinery this game has no use for (e.g. no chunk-pooling, no lane
system, no 3D animation groups).

**Shipping/bundling is intentionally not specified in this document** —
module format, dev-vs-production serving, and any GoBalance-SDK-specific
boilerplate (rAF shim, `#gameover-overlay` contract, Back button, error
bridge) are the builder's responsibility via `GOBALANCE_SDK.md`, which is
the ground-truth contract for how this game loads in production. Do not
build around `file://` assumptions or single-file bundling.

---

## 10. Build milestones

### POC (prove the core loop)
1. Canvas + game loop skeleton, static rooftop background, Michelangelo
   sprite with left/right movement wired to `__gbSensor`/arrow-key
   fallback (no falling items yet) — confirm movement feel (speed,
   clamping at edges) before adding anything else.
2. Pizza slices falling + strike-band overlap detection + placeholder
   swing animation/flash on hit; verify the "automatic swing on
   overlap" reads as intentional and satisfying, not accidental.
3. Bombs falling + overlap detection ending the run immediately;
   verify dodge-vs-catch discrimination is readable at a glance
   (distinct silhouette/color per §5.4) and that the pace feels
   right for a lean-board (no fast alternating corrections required —
   tune fall speed/spawn spacing here before moving to MVP).

### MVP (turn the POC into the shippable game)
4. Scoring + combo streak system + score/combo HUD.
5. 3-life system + lives HUD + proper game-over overlay
   (`#gameover-overlay`/`#restart-button` contract) with final score/best
   combo.
6. Ooze power-up: canister item, strike detection, wider-swing-arc buff
   with timer + HUD indicator + wear-off cue.
7. Stage system: 3–5 stage definitions (background swap, fall-speed/
   density step), score/time-threshold trigger, stage-transition banner.
8. Real 2D art pass matching the approved concept direction (§1) for
   Michelangelo's states, all three falling-item types, and each
   stage's background, including the wider camera framing spec in
   §5.5.
9. Pacing pass across all stages against the source report's explicit
   conservative-tempo guidance (§5.2) — verify on the actual mechanic
   (or as close a proxy as available) that no stage ever demands fast
   alternating left-right corrections.

### Post-MVP (backlog, unordered)
- "Choose your turtle" — Leonardo/Raphael/Donatello as additional
  playable characters with distinct weapon-swing animations.
- Additional stage themes beyond the MVP's 3–5.
- Additional good-item variety (more foods) and additional ooze-effect
  variants (speed boost, slow-fall radius — the two options not used
  for MVP's single effect).
- A second hazard type distinct from bombs.
- Denser late-run hazard patterns as a difficulty ceiling for
  high-skill single runs.

---

## 11. Explicitly out of scope

- **Any real-money IAP, paid currency, ads-for-currency, or purchase
  path of any kind — permanently out of scope for this product, not
  just this doc's tiers** (see §0, §8).
- **Any cross-session/cross-game meta-progression, unlock web, or
  currency-sink system** — including at Post-MVP. "Choose your turtle"
  and additional content are available-from-session-start content
  additions, never gated behind cross-run accumulation.
- Vertical player movement, jump, duck, or any input beyond left/right
  lean — this is a strict single-axis game by design (§4).
- A manual attack/swing button — the swing is always automatic on
  positional overlap, never a separate input.
- Networked leaderboards/multiplayer.
- Scrolling backgrounds/parallax — static per-stage background is
  sufficient for this genre and camera setup (§5.5).
- Physics-based collision/ragdoll — strike-band x-overlap checks are
  sufficient (§6), no physics engine needed.

---

## 12. Open questions / risks

- **Exact stage count and score/time thresholds** (3 vs 5 stages,
  precise thresholds) are left to stage 4 to tune within the ranges
  given in §5.2 — no single correct number is specified here on
  purpose; playtest-tune it.
- **Exact fall speed / spawn density numbers** are unspecified by
  design — the source report (`pipeline/reports/SideBySideCatcher.md`)
  could only loosely infer real-world tempo from a sparse 12-frame
  sample of a video Amit explicitly flagged as low production value;
  treat all pacing numbers in this doc as directional (skew
  conservative/slow) rather than measured, and tune against actual
  on-device board feel once playable.
- **Ooze score value vs. buff strength trade-off** (§8) — whether the
  canister should also carry a meaningful direct score value alongside
  its buff, or stay buff-only, is left as a tuning call.
- **Licensor approval checkpoint** — as with any TMNT-branded asset in
  this pipeline, confirm what needs sign-off (Michelangelo likeness
  fidelity, nunchaku design, city/rooftop art) before treating final art
  as locked; not resolved by this doc.
