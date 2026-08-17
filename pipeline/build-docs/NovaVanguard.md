# Nova Vanguard — Game Design & Build Doc
### (2D top-down formation shoot-'em-up flown low over a surface — GoBalance build, strict orthographic overhead, analog input)

Draft v1 — for implementation by Claude Code. Full spec, placeholder-art-first
where noted. Expanded from the **approved** macro brief at
`pipeline/macro-briefs/approved/nova-vanguard/brief.md`, which is downstream of
the stage-1 report `pipeline/reports/airPlanes.md`.

The brief stays the source of truth for *what the game is*; this document owns
*how it gets built*. Where this doc puts a number on something the brief left
qualitative, the number is the buildable version of the brief's intent — change
it by tuning, not by re-litigating the intent.

---

## 0. Read-first notes

Four things in this document are **direct decisions by Amit taken during brief
review**. They are binding inputs, not options to re-open during build.

### 0.1 The POC's central job is a two-mode experiment

> *"I think that the scroll is important. Scroll feeling. I'm not sure, so we
> can, I don't know, make two modes and decide."*

The POC builds **both framing modes behind a live toggle**, running **identical
content**, and the choice gets made by feel on real hardware:

- **Mode S** — the surface scrolls continuously toward the player.
- **Mode A** — the surface holds station; the sector is one place you hover over.

Both share the camera, the input model, the reflex load, and **every art
asset** — the mode choice does not fork the art budget, which is the entire
reason running the experiment is cheap. §5.2 specifies both concretely; §5.3
specifies the pacing constraint Mode S carries and Mode A does not; §10's
**Milestone POC-8** is the decision point itself, with instrumentation and
acceptance criteria, and **no MVP work starts until it is recorded**.

### 0.2 Art-direction hard constraints — inherited law

Amit's most emphatic note in the whole review. Earlier concept frames violated
it and were rejected outright:

> *"you always put the airplane in like... in a weird angle, it needs to be
> completely top down and my spaceship is always looking north, like up. It's a
> classic top down game, there's no room for another perspective."*

1. **Strict orthographic overhead camera.** No horizon line, no sky, no
   vanishing point, no three-quarter view, no dramatic low angle, no
   perspective tilt. The camera looks straight down.
2. **You always see the top surface of every object** — wing tops, hull spines,
   engine nacelles from above. Never the side or front of a fuselage.
3. **The player craft's nose points straight up (north), always.** Banking is
   conveyed by **roll only**; the silhouette stays vertically aligned. No yaw,
   no turn-into-the-lean, no rotating the ship to face travel.
4. **Enemy craft are likewise flat top-down**, nose along their travel
   direction.
5. This applies to concept art, marketing frames, and in-game assets alike — **a
   frame that breaks it is wrong even if it's pretty.**

Two build-level consequences that must survive implementation:

- **The renderer is genuinely 2D and there is no camera object in this game.**
  Rule 1 is not something to be careful about in art review — it is enforced by
  there being no perspective projection anywhere in the codebase. Do not
  introduce a 3D scene, a pseudo-3D ground plane, a skewed quad, or a parallax
  "tilt" to make the surface feel dimensional (§9.1).
- **Every asset-generation prompt carries the perspective clause verbatim**
  (§9.5 supplies the exact text to paste). Do not paraphrase it per-asset.

### 0.3 Rendered/glossy idiom, not pixel art

Decided on production cost: the pixel-art alternative (`broadside-coral-line`)
inventoried at **~674 authored images** against this concept's **~202**. The
idiom is fixed, not optional: modern rendered 3D-look sci-fi — glossy
hard-surface hulls, crisp bevels, metallic highlights, neon energy bullets,
bloom, particle-driven explosions. The idiom is also what makes the inventory
small: it **permits runtime transforms**, so one ship image covers every
heading via rotation and every explosion is a particle system rather than a
drawn sheet (§9.5).

Reference set, all at `pipeline/videos-inbox/airPlanes/`:
- **`sky-force-reloaded-for-pc.jpg` — the primary target.**
- **`unnamed.webp` (1941 Air Attack)** — the 16:9 landscape layout precedent.
- **`Batsugan1.jpg` (Batsugun)** — the arcade ancestor.

### 0.4 Fly low over a surface, never over empty starfield

Amit's binding critique of the first frames was *"I don't care for generic,"*
and the diagnosis is concrete: those frames were ships against an empty
starfield, which is exactly what the report dismissed (*"the art itself is
generic 2015-era mobile arcade and isn't worth imitating; the contrast
discipline is"*). **A dark alien surface fills the frame beneath the action at
all times, in both modes.** There is no starfield-backdrop fallback, at any
tier, for any sector. The far-void layer exists only as a thin edge/transition
element (§5.4).

### 0.5 Standing product constraints

**No IAP, no paid currency, no cross-session meta-progression or unlock web of
any kind — permanent product constraint**, not a v1 cut (§8, §11). Deleted
outright from the references: coins, gems, the premium shop, the nine-slot
pre-level consumable grid, the spin wheel, the watch-ad button, the VIP badge,
the campaign task list, the "do you like this level?" prompt. In-run growth and
in-game campaign progression are **required-good** and specified in §8.

**Lean-axis ergonomics — the second most load-bearing rule here.** Left/right
lean on the board is the comfortable, sustainable axis; **forward/back lean is
genuinely hard** — a more committed, more tiring motion with worse fine
control. Consequences:

- **The reflexive load is ~100% lateral.** Every threat in the game is
  survivable by lateral movement alone.
- **The vertical axis is wired, but only for slow, optional, generously-timed
  moves** — drifting up for a chevron, closing on a boss pod during a scripted
  window. Multi-second windows only.
- **No wave, pattern, boss phase, pickup or objective may require a fast
  vertical move**, at any tier, at either difficulty. In Mode S this extends to
  ground pickups: nothing that scrolls past may demand a vertical dash (§5.3).
- If during tuning something feels like it wants a fast vertical input, the
  answer is to move it onto the lateral axis, not to add the input.

**2D only.** No 3D at this stage (§9.1).

---

## 1. Vision

A neon top-down shoot-'em-up flown **low over a surface** rather than through
empty space. Your interceptor holds the bottom third of a wide 16:9 frame with
its guns already firing, sliding freely left and right over cracked alien crust,
megastructure plating and shipyard decks. Squadrons loop in from the left and
right edges along long visible paths, cross the width in full view, and lock
into wide shallow formations overhead; killing them mid-entry, before they
settle, is both the skill play and the score play. Locked craft peel off in
horizontal swoops that arc across the width and dip toward you before curving
back up — they never plunge straight down through your band. Their fire is
sparse, fat, slow and sweeps sideways with a guaranteed aisle. Chevron pickups
climb your weapon rank 1 → 10 across a sector; score pips sit off-line on
purpose, pulling you a little way out of the safe lane. Each sector runs ~90–140
seconds across four waves and ends on a wide boss lying lengthwise across the
frame with destructible pods along its hull.

Target feel: **the only verb is *where do I stand*, and standing is a lean.**
There is no fire button and no bomb button; the entire input budget goes to
lateral position. It should read as calm, legible, escalating pressure — fat
readable orbs and wide sweeps you answer with one committed lean, not a stutter
of micro-corrections — over a dark surface that gives the whole thing a place to
be.

**Art-direction anchor (stage 4 does not own art direction, only points at it):**

- **Approved concept frames:**
  `pipeline/macro-briefs/approved/nova-vanguard/concepts/`
  (`nano-banana-pro`, 16:9, prompts in full at `concepts/prompt.txt`).
  - **`concept-01.png` is the single strongest anchor** — treat its palette,
    contrast discipline, HUD layout and idiom as the target. Near-black cracked
    crust with hot magma fissures, deeply desaturated under the action layer;
    blue-and-white player interceptor dead centre-bottom with a visible canopy,
    nose exactly north, twin cyan plumes; a narrow column of cyan-white bolts;
    a 12-craft purple insectoid formation in two rows across the top; enemy fire
    as large orange-ringed magenta plasma donuts with real gaps between them;
    gold score pips and a blue chevron pickup drifting; a cyan segmented shield
    gauge up the left margin with a shield glyph at its foot; an amber progress
    gauge with a `35%` readout up the right margin; a thin full-width bar along
    the very top; score top-left; centre of frame clear.
  - **`concept-03.png` is the anchor for the deck/megastructure surface
    treatment** — riveted armour plating, service trenches, violet coolant
    seams, hex turret pods, a shipyard cradle and a half-built hull, all read
    from directly above. Its rainbow-gradient left gauge is **off-palette** —
    take the surface, not that HUD element.
  - **`concept-02.png`** shows an alternate blue/red fighter design for the
    enemies. **Do not take it:** the enemies read too close to the player's own
    blue-and-white and the frame loses instant ownership at a glance. Enemy
    craft stay chromatically separated — purple / magenta / teal insectoid, per
    `concept-01` and `concept-04`.
  - **`concept-04.png`** drifts toward a flatter, bolder-lined illustrated look
    rather than the rendered/glossy idiom §0.3 fixes. Use it for **surface
    trench/pipe/plating detail reference only**, not for the idiom.
  - All four satisfy the hard perspective rules and are the composition the
    layout in §5.1 is derived from.
- **Reference stills:** `pipeline/videos-inbox/airPlanes/` (§0.3). Sky Force
  Reloaded is the primary idiom target; 1941 Air Attack is the 16:9 layout
  precedent; Batsugun is the ancestor.
- **This is the general track, not TMNT.** Per Amit: *"forget about the TMNT
  theme for this kind of game. I want completely regular game."* No TMNT
  reference anywhere, including in asset prompts.
- **Asset pipeline:** `KOLBO_ASSET_PIPELINE.md` is ground truth for how art
  actually gets generated. §9.5 has the rules specific to this game.

---

## 2. Scope tiers

### POC — the mode experiment, and that is its main job

It answers two questions: **does this loop feel good on a board at all**, and
**does the scroll earn its keep** against §10's acceptance criteria.

- One surface theme (Sector 1, Ashfall Crust), real enough to judge the scroll
  feeling. **The surface art is the one thing that may not be a placeholder at
  POC** — everything else can be rough.
- One player craft: auto-fire, free continuous lateral slide, slow optional
  vertical nudge, roll-only banking. One placeholder sprite plus its two roll
  states.
- One air enemy type entering from the side edges and locking into a **12 × 2**
  formation, with the pre-lock kill window.
- One lateral sweep bullet pattern with a guaranteed aisle, plus the horizontal
  swoop dive.
- The **shield attrition gauge** (6 segments) as the whole fail model.
- **Both framing modes behind a live toggle** (§5.2), identical content,
  switchable mid-session in under a second without a rebuild or a reload.
- The **instrumentation panel** (§10, POC-7) — lateral corrections/sec, vertical
  dwell and dash count, time-to-first-hit, aisle survival. This is a POC
  deliverable, not a debug nicety; it is how the experiment gets judged.
- **No** boss, chevrons, vent, ground targets, scoring UI, sector campaign,
  results screen, star objectives.

### MVP — the smallest version worth shipping as a real GoBalance game

Built **in whichever mode won the POC** (the losing mode's code path stays
behind the same one config flag — it costs nothing to keep and the flag is how
the winner is selected).

- A **5-sector campaign** of ~90–140 s sectors, each 4 waves + a boss, each with
  its own surface: crust → shipyard deck → megastructure hull → ice field →
  hive plate (§5.7).
- **Chevron rank ladder 1 → 10** with three hull tiers, resetting each sector
  (§8.1).
- **Off-line score pips** as flight-path design (§5.6).
- **The automatic Overload Vent** with earned charge (§5.8).
- **6 air enemy types** + **4 ground-emplacement target types** (§6).
- **4–5 formation shapes** and **5 bullet patterns**, all under the density,
  aisle and reaction-time caps (§5.3, §5.5).
- **One wide boss per sector** with destructible pods and a full-width HP bar
  (§6.4).
- **The 1 s entry-band telegraph** (§5.3).
- **Three free star objectives per sector** (§8.3).
- **Sector-progress percentage meter** (§7.1).
- **Escalating multiplier reveal** at end of sector (§8.4).
- **Difficulty ramp across the campaign + explicit Normal/Elite selection +
  quiet dynamic easing** after repeated failures (§5.9).
- **Full art pass** under §0.2's hard perspective rules, including a **diegetic
  loading console** (§9.5) — the report named 1945 Air Force's radar console the
  strongest single asset in either reference, and it is cheap.
- **Game-over / sector-results overlay** satisfying the SDK's DOM contract
  (§7.4).

### Post-MVP (backlog — not committed work)

More of the same kind of thing, bigger. None of it is meta or monetisation.

- More sectors and surfaces: a red-giant refinery, a shattered ringworld plate,
  a drowned reef facility.
- A larger bestiary, including **stationary emplacements clamped to the top
  band** (an air-band variant of the ground targets).
- More multi-part boss shapes; a two-phase boss that sheds its hull.
- Harder late-campaign choreography, still strictly inside the same
  density / aisle / reaction-time caps (§5.3, §5.5) — the caps are not a
  difficulty lever.
- A **second selectable hull** unlocked by clearing the campaign — handling vs.
  firepower, a genuine trade, **not** a stat ladder.
- An **endless "swarm" mode** built from the same wave library.
- A **local high-score board**, display-only.
- **If Mode S wins the POC:** one comparison test of a pickup-triggered vent
  canister as an alternative to the automatic vent (§5.8). Automatic remains
  the default regardless of the outcome.
- Explicitly **not** in Post-MVP, ever: real-money purchase, currency, gacha, or
  any unlock web spanning sessions or games (§11).

---

## 3. Core loop

Scoped to MVP; inline notes mark POC-only simplifications and Post-MVP
deferrals.

1. The interceptor holds the **player home band** — the bottom ~28% of the frame
   — and slides freely across the full playable width. **Guns fire continuously:
   there is no fire button and no bomb button** (§4).
2. A dark alien surface fills the frame beneath everything. In **Mode S** it
   scrolls continuously toward the player; in **Mode A** it holds station and
   ambient surface activity carries the motion (§5.2).
3. A squadron enters from the **left or right edge**, crosses the width along a
   long looping path in full view over 2.5–4 s, and **locks into a wide shallow
   formation** in the top ~28% (§5.5). **Killing craft mid-entry, before they
   settle, is worth double** — the skill play and the score play are the same
   act (§8.2).
4. Locked craft peel off in **horizontal swoops**: arcing across the width,
   dipping toward the player band, curving back up. They never plunge straight
   down through it (§5.5).
5. Enemy fire is sparse, fat, slow, and sweeps sideways, always with a
   guaranteed aisle at least `AISLE_MIN` wide (§5.3). The player answers it with
   one committed lean.
6. **Chevron pickups** climb the weapon rank **1 → 10** across the sector,
   visibly upgrading the hull through three tiers (§8.1). MVP+.
7. **Score pips** spawn deliberately off the player's current line, pulling them
   a little way out of the safe lane — never far enough, and never fast enough,
   to require a vertical dash (§5.6). MVP+.
8. In **Mode S**, ground emplacements arrive from the top edge, can be shot as a
   second targeting layer, and pass. In **Mode A**, they are placed statically
   across the plate and power up on a per-wave schedule (§5.2, §6.3). MVP+.
9. Taking a hit costs a **shield segment**, not the run — attrition, not lives
   (§5.10). A walk-up player does not lose their single turn to one mistake.
10. When the incoming-threat score crosses a threshold and the core is charged,
    the **Overload Vent fires by itself**, clearing bullets and damaging
    everything on screen (§5.8). MVP+.
11. Four waves in, a **wide boss** enters behind a full-width warning band and
    is fought down pod by pod, with an optional scripted vulnerable window that
    rewards a slow drift upward (§6.4). MVP+.
12. Clearing the sector runs the **escalating multiplier tally** — accuracy,
    no-hit streak, formations cleared whole, objectives met, boss time — then
    offers the next sector (§8.4). MVP+.
13. Rank, score chain and shield reset at the start of the next sector. Nothing
    carries between runs except a display-only best score (§8.5).

POC runs steps 1–5, 9 and a bare loop of step 3, in both modes, forever.

---

## 4. Controls

**Mode: Analog.** The game reads the raw tilt vector itself rather than
receiving synthetic arrow-key presses. `GOBALANCE_SDK.md` is stage 4's ground
truth for wiring it; this section owns the design decision and the mapping.

**Why analog, not digital.** The entire game is one continuous positioning
problem. *Where exactly* the craft sits across the width is the dodge and the
aim simultaneously, and the aisles the patterns guarantee are wide bands, not
slots — the player is meant to settle into a gap and hold it, which requires
proportional control over both the target position and the speed of getting
there. Digital mode's on/off synthetic keys would quantize exactly the signal
this game is made of, and would turn "ease into the aisle" into "ram toward the
edge until you let go." The brief's own framing — *free continuous lateral
positioning, not discrete lanes* — is a control-mode statement. This is the same
reason `Astro_Tunnel` uses analog mode.

**Exact mapping.**

| Input | Reads as | Behaviour |
|---|---|---|
| Lateral tilt (`x`) | Signed analog carve, `[-1, 1]` after a **0.08 deadzone** | Drives lateral velocity: `vx = carve * LATERAL_MAX` with `LATERAL_MAX = 840 px/s` in design space. Position clamped to `x ∈ [0.08, 0.92]` of width. |
| Forward/back tilt (`y`) | Signed analog nudge, `[-1, 1]` after a **0.28 deadzone** | Drives vertical velocity: `vy = nudge * VERTICAL_MAX` with `VERTICAL_MAX = 190 px/s`. Position clamped to the player band, `y ∈ [0.68, 0.96]` of height. |

- **The two axes are deliberately asymmetric.** Lateral is fast (full traverse
  ≈ 1.9 s), light-deadzoned and precise. Vertical is slow (full band traverse
  ≈ 1.6 s) and heavily deadzoned so a player who never intends to use it never
  drifts by accident while leaning hard sideways. This asymmetry is the
  lean-ergonomics finding expressed as two constants (§0.5) — do not "fix" the
  vertical axis by speeding it up or narrowing its deadzone.
- **Rolling is presentational only.** Roll state is derived from `carve`
  magnitude and sign — level / roll-L / roll-R — and changes the sprite, never
  the hitbox, the heading, or the gun direction. The nose stays north; the guns
  always fire straight up (§0.2).
- **Firing is automatic and unconditional.** It never stops, has no cooldown the
  player can affect, and there is no input that changes it. Rank changes what
  comes out (§8.1); nothing else does.
- **The vent has no input.** It fires itself (§5.8). A deliberate hold at a lean
  extreme was ruled out at brief stage precisely because it would risk the
  forward/back axis at the exact moment the player is under most pressure.
- **Desktop dev fallback:** keyboard/pointer input writes into the *same*
  internal input vector the sensor read feeds, additively. It is a dev
  convenience, not a second input path. Every tuning number in this document is
  a **starting** value to be re-validated on-device — a keyboard will
  systematically overstate how easy fine lateral correction and any vertical
  move are.
- **Never also listen for the host's synthetic arrow keys** while reading the
  analog vector; double-applying the input makes the craft over-steer. This
  game needs analog forwarding, not digital.

---

## 5. World / mechanics

### 5.1 Frame layout — the band budget

Everything in this game is authored against a fixed design space of
**1920 × 1080** (16:9), scaled and letterboxed to the real viewport. All
coordinates and speeds below are in that space. The report's landscape rule —
player band bottom 30%, enemy band top 30%, ≥25% transit gutter, HUD in the
margins — is realised as these bands:

| Band | Vertical extent (fraction / px) | Rule |
|---|---|---|
| **Top HUD strip** | `0.000 – 0.050` (0–54) | Boss HP bar only. No entity ever occupies it. |
| **Entry telegraph band** | `0.050 – 0.075` (54–81) | Warning markers for anything arriving from the top edge (§5.3). |
| **Enemy formation band** | `0.060 – 0.340` (65–367) | Where formations lock and hold. |
| **Transit gutter** | `0.340 – 0.680` (367–734) | **34% — comfortably over the ≥25% floor.** Enemies cross it; nothing camps in it. A hovering mini-boss or a stalled formation in the gutter instantly removes the player's read and is forbidden at every tier. |
| **Player home band** | `0.680 – 0.960` (734–1037) | Where the interceptor lives and where the game promises safety if the player reads correctly. |
| **Bottom strip** | `0.960 – 1.000` | Surface only. |

Horizontal budget:

- **Left / right HUD margins:** outer **6%** each (0–115 px, 1805–1920 px).
- **Playable width:** `x ∈ [0.06, 0.94]`. Player clamped tighter, to
  `[0.08, 0.92]`, so the craft is never visually under a gauge.
- **Formations are laid out inside `x ∈ [0.10, 0.90]`.**
- **HUD-exclusion rule, enforced in code:** no bullet, pickup, ground target,
  explosion or locked enemy may occupy the margins or the top HUD strip.
  Entering squadrons may *transit* a margin, for at most 0.6 s, and may not fire
  while inside one. The report caught a reference frame with a formation
  physically overlapping the score readout; in a shallow frame that is much
  worse, so this is an assertion, not a guideline (§9.4).
- **Centre-top stays clear.** No persistent readout, ever, above `y = 0.34` in
  the middle 60% of the width. Banners are the one exception and they live in
  the gutter (§7.1).

### 5.2 The two framing modes

**One config value, `FRAMING_MODE ∈ {'S','A'}`, selects everything below.** It
lives in `/data/tuning.js` and is read through a single accessor; no other part
of the codebase branches on it ad hoc.

Everything is **identical** in both modes except the rows in this table.
Critically, **every art asset is shared** — one mode scrolls the surface, the
other doesn't.

| System | **Mode S — scrolling wide arena** | **Mode A — fixed arena** |
|---|---|---|
| **Surface base** | Seamless painted base layer scrolls downward at `SCROLL_SPEED = 135 px/s`, tiled vertically. | Held static. Same image, same framing. |
| **Surface props / decals** | Ride the surface, spawn above the top edge, recycle below the bottom edge. Scatter is re-randomised each pass so the base tile's repeat never reads. | Placed once per sector at authored positions; do not move. |
| **Ambient overlays** | Dust / heat-haze / coolant-glow overlays drift at 0.6× and 1.4× `SCROLL_SPEED` for a cheap two-layer parallax. | Overlays still drift, slowly, in a slow lateral/rotational loop. **This is Mode A's anti-deadness budget and it is required, not decoration** (see below). |
| **Approach speed budget** | Pattern descent capped at **165 px/s** (§5.3). | Pattern descent capped at **300 px/s**; tuned default 240. |
| **Ground targets** | Scroll in from the top edge with a 1 s telegraph, are shootable as they pass, and exit off the bottom. Missed ones are gone. | Placed statically across the plate at authored positions; **power up on a per-wave schedule** (a dormant emplacement lights its core and begins firing when its wave starts) and stay until destroyed or the sector ends. |
| **Ground pickups** | Ride the surface. **Placed laterally**, never above the player band. Anything that scrolls past uncollected is either optional or **re-offered within 8 s** (§5.6). | Sit at fixed positions inside the player band, collectable at any time during their wave; despawn at wave end. |
| **Progress meter** | Reads as **distance covered** — scrolled pixels / sector length. | Reads as **authored completion** — waves cleared + boss HP, mapped to 0–100%. Same bar, same numbers, different source. |
| **Far-void layer** | Visible at surface transitions between sectors. | Not visible; the plate fills the frame for the whole sector. |

**Mode A's anti-deadness requirements** (its win criterion is *"it doesn't go
dead"*, so these are spec, not polish):
- Surface emissives **pulse** — magma fissures breathe, coolant seams flicker,
  hive matter throbs — on long, slow, out-of-phase cycles.
- **Ambient overlays never stop moving** (dust drift, heat shimmer).
- **Scheduled surface activity:** at least one authored surface event per wave —
  a docking clamp cycling, a vent blowing steam, a fissure flaring — placed off
  the player's line so it is scenery, not a threat.
- The **fly-in choreography carries the motion**: entry paths are longer and
  more visible in Mode A precisely because the world isn't supplying flow.

**The toggle itself (POC requirement).** The experiment is A/B by feel *within
one session*, so switching must be effectively instant:
- An on-screen two-state switch on the POC start overlay and a debug key
  (`M`) that swaps modes **mid-session, without a page reload**, restarting the
  current scenario in the other mode within 1 s and preserving nothing.
- Also settable by query param for scripted runs.
- Every instrumentation sample is tagged with the mode that produced it (§10).

### 5.3 The pacing contract — reaction floor, aisle floor, density caps

This is the numeric heart of the design and the thing most likely to be
accidentally violated during content authoring. **All four caps are asserted in
code at boot over the authored data** (§9.4), not just documented.

**The reaction floor.** The gap a descending threat must cross before it can
touch the player is `enemy band bottom → player band top` = `734 − 367` =
**367 px**. The floor is **≥ 1.2 s** across that gap. Therefore:

```
APPROACH_BUDGET = 367 px / 1.2 s  ≈  300 px/s
```

**No entity or projectile may have a downward velocity component exceeding the
per-mode share of that budget:**

| | Scroll contribution | Remaining pattern budget | Tuned default (Normal) | Hard cap (Elite) |
|---|---|---|---|---|
| **Mode A** | 0 | **300 px/s** | 240 px/s | 290 px/s |
| **Mode S** | **135 px/s** (45% of budget) | **165 px/s** | 130 px/s | 165 px/s |

- `SCROLL_SPEED = 135 px/s` sits at **45%** of the approach budget; **50%
  (150 px/s) is the absolute cap** and is the fastest the scroll may ever be
  tuned, at any tier, in any sector.
- **Why the scroll counts against the budget.** Treat `effectiveApproach =
  patternSpeed + scrollSpeed` as a **binding tuning rule, not a physics claim.**
  For anything anchored to the surface (ground targets, ground pickups, surface
  hazards) it is literally true. For an air bullet it is not literally true —
  the bullet is in the air frame — but the downward optical flow of the whole
  ground plane measurably shortens the read, and the POC is not the place to
  argue that. The rule applies uniformly to everything with a downward
  component. Do not "optimise" it away for air projectiles.
- The floor applies to **swoop descent** too: a swoop dips from `y ≈ 0.30` to
  `y ≈ 0.62` (346 px) and that descent obeys the same cap.

**The aisle floor.** Every authored bullet pattern must guarantee a continuously
traversable gap of at least:

```
AISLE_MIN = 0.09 × 1920 = 173 px      (≈ 12× the player's hitbox radius)
```

- The aisle must be **reachable**: at the moment a pattern commits, the nearest
  aisle edge must be within `LATERAL_MAX × (time to impact − 0.25 s)` of the
  player's current x. A pattern that guarantees a gap the player physically
  cannot get to is a violated aisle.
- Patterns that *move* their aisle (sweeps, spokes, sine curtains) must move it
  no faster than **420 px/s** — half the player's lateral top speed — so
  following it is a committed lean, not a chase.
- The references let patterns degenerate into "find the one pixel gap." That is
  not survivable on a balance board and is forbidden here.

**Density caps.**

| Cap | Normal | Elite |
|---|---|---|
| Simultaneous enemy bullets on screen | **22** | **30** |
| Simultaneous air enemies on screen | **20** | **26** |
| Minimum enemy bullet radius (design space) | **18 px** | 18 px |
| Simultaneous distinct bullet patterns firing | **2** | **3** |

Trade bullet count for bullet size, per the report: dense-looking but
individually trackable. If a pattern needs more bullets to feel dangerous, it is
the wrong pattern.

**The entry-band telegraph.** Anything arriving from the **top edge** — every
ground target in Mode S, every top-edge spawn anywhere — is preceded by a marker
in the entry telegraph band (`y 0.050–0.075`) at its x, **1.0 s before it
appears**, fading in over 0.2 s and pulsing. Required in both modes; in Mode S
it is what buys back the reading time the scroll consumes.

**The vertical-requirement rule, stated as a testable assertion.** For every
authored wave, at both difficulties, in both modes: *a player who holds
`y = 0.82` for the entire wave and moves only laterally must be able to clear it
without taking a hit.* This is a boot-time constraint over authored data where
it can be checked statically, and an explicit item on §10's on-device tuning
pass where it can't.

### 5.4 The surface

**A dark alien surface fills the frame beneath the action at all times, in both
modes** (§0.4). Five sector surfaces at MVP:

1. **Ashfall Crust** — cracked black rock, glowing magma fissures, cargo
   containers, half-buried crashed hulls, scattered rock. *(POC surface.)*
2. **Kesselring Yards** — a shipyard deck: cradles, half-built hulls, gantries,
   painted deck markings, service hatches.
3. **The Bulwark** — a colossal megastructure's armour plating: riveted panels,
   deep service trenches, violet coolant seams, docking clamps, antenna masts,
   turret pods.
4. **Glacis Shelf** — an ice field over a buried facility: fracture lines,
   sub-ice lights and silhouettes bleeding through, frozen wreckage.
5. **The Hive Plate** — organic hive matter: pulsing chitin, resin pools, egg
   clusters, tendril seams.

**Two readability rules, straight from the report, enforced in code:**

- **The surface is desaturated and low-contrast beneath the action layer.**
  Target band: **luminance ≤ 45%**, **saturation ≤ 35%** for everything in the
  surface and prop layers, except authored emissive accents (fissures, coolant
  seams, hive glow), which are allowed to be hot but must occupy **< 12% of the
  frame area**. The report is explicit that 1945 Air Force's busy island art and
  drifting cloud scrim *measurably hurt readability*. Implementation: a global
  tint/scrim multiplier over the surface container so generated art that comes
  back too hot can be brought into band **without regenerating it** — and a
  dev-mode toggle that flashes the surface layer black so bullets and pickups
  can be checked in isolation.
- **Colour-coded bullet ownership, carried over verbatim:** player fire is
  **cyan-white**, enemy fire is **orange / magenta**, over a dark ground. This
  is the one thing the report says is worth taking from Space Shooter's visuals
  and it costs nothing. No exceptions, including for bosses.

**Nothing drifts over the playfield.** 1945 Air Force's cloud scrim passes *over*
the action layer and hurts readability. Ambient overlays here render **under**
the action layer, never above it. The only things above the action layer are
particles the player caused.

**Altitude cue.** Every air entity — player, enemies, boss — casts a small soft
dark blob shadow onto the surface, offset a few pixels, scaled to its size.
This is what sells "flying low over" rather than "lying on." It is cheap
(one shared texture, tinted and scaled) and it is required at MVP in both modes.

### 5.5 Air enemies — entry, formation, swoop, fire

**Entry.** A squadron enters from the **left or right edge only** — never from
the top centre, never straight down.

- Craft enter in file, spaced 0.15–0.25 s apart, at `y ∈ [0.12, 0.45]`.
- The path is a long looping curve crossing **at least 60% of the frame width**
  in full view, taking **2.5–4.0 s** end to end. That transit *is* the
  pre-lock kill window and the whole basis of the Mode A case: reading time
  comes from the fly-in and the hold, not from travel distance.
- Each craft then peels to its formation slot and settles over ~0.5 s.
- Entering craft **do not fire** until locked. This keeps the kill window a
  clean risk-free offer and makes aggression unambiguously correct.

**Formations** — wide and shallow, in the top band, inside `x ∈ [0.10, 0.90]`.
Five shapes at MVP:

| # | Shape | Composition | Notes |
|---|---|---|---|
| F1 | **Wide grid** | 12 × 2 (up to 14 × 2 late campaign) | The Galaga signature, re-cut wide. POC's only formation. |
| F2 | **Flattened lens** | ~18 craft on a wide ellipse, 4.5:1 | The report's observed ring/diamond, squashed to fit a shallow band. |
| F3 | **Shallow chevron arc** | 11 craft in a very flat V | Its apex is the natural focus-fire target. |
| F4 | **Staggered picket** | 2 rows of 7, offset by half a slot | Reads as depth without using any. |
| F5 | **Split pods** | Two 6-craft blocks at the outer thirds, centre empty | Forces a lateral commitment: you cannot cover both. |

- Locked formations **hold station in screen space in both modes** — they do not
  scroll with the surface in Mode S. (This is what makes the art shared and the
  mode toggle cheap.)
- A locked formation may drift laterally as a whole, slowly (≤ 60 px/s) and
  within the layout bounds. It never drifts downward out of its band.
- **Formation-whole bonus:** clearing every craft in one formation with no
  survivor pays a bonus and a banner (§8.2).

**The swoop — the one dive shape this game has.**

- A locked craft peels out of its slot, arcs **across the width** in an S-curve,
  dips to a minimum of `y = 0.62` — **the top of the player band, never into
  it** — then curves back up and either rejoins a slot or exits off a side edge.
- Duration 2.2–3.5 s; horizontal travel ≥ 35% of the width.
- Descent component obeys §5.3's cap.
- **Contact damage exists** on the swoop, which is exactly what makes a player
  who is drifting upward for a chevron take a real risk — and exactly why the
  drift must never be required.
- **Galaga's straight-down plunge is not ported, at any tier.** Neither is the
  escalating "survivors stop returning to formation and dive continuously"
  behaviour — that is a portrait mechanic and it collapses in a shallow frame.

**Bullet patterns** — five at MVP, all lateral-biased, all with a guaranteed
aisle:

| # | Pattern | Behaviour | Aisle |
|---|---|---|---|
| B1 | **Sparse aimed lob** | 3–5 fat orbs from scattered craft, aimed at the player's x *at time of fire*, staggered 0.4 s apart | Move and it misses; the aisle is everywhere but where you were. POC's pattern. |
| B2 | **Lateral sweep fan** | A fan from one formation section sweeps sideways across the width at ≤ 420 px/s | One authored gap ≥ `AISLE_MIN` travels with the fan |
| B3 | **Rotating spoke** | A heavy craft emits 6 slow spokes, whole rig rotating at ≤ 25°/s | The gaps between spokes widen with distance; rotation is slow enough to walk out of |
| B4 | **Sine curtain** | A row of orbs descends with phase-offset lateral sine | Aisle travels laterally, predictably, at ≤ 420 px/s |
| B5 | **Twin-gap wall** *(Elite only)* | A wide slow row with exactly two authored gaps | Both gaps ≥ `AISLE_MIN`; player must pick one early |

**Explicitly do not port, at any tier** (the report's do-not-port list, made
binding here):
- The **diagonal staircase curtain**. In 16:9 it collapses into an instantaneous
  wall with no readable aisle.
- **Anything firing from below** the player band, or any simultaneous
  top-and-bottom pressure. That means an emergency forward or back lean, which
  is the worst thing this product can ask for.
- **Straight-down plunges** through the player band (replaced everywhere by the
  swoop).
- Any pattern whose safe aisle is narrower than `AISLE_MIN`.

### 5.6 Pickups and the flight-path design

Four pickup types, all spun/pulsed at runtime from a single static sprite each.

| Pickup | Effect | Placement rule |
|---|---|---|
| **Chevron** | +1 weapon rank, 1 → 10 | ~1 per 12–15 s, plus a guaranteed drop at each wave boundary. Spawns **off the player's current x** by 0.18–0.35 of the width. |
| **Shield cell** | +1 shield segment (to max) | Rare; guaranteed one at the start of wave 4 and one before the boss. |
| **Score pip** | +250, feeds the chain | The main lure. Spawns in short trails of 3–5, deliberately off-line. |
| **Vent battery** | +25% vent charge | Uncommon; a reward for clearing a formation whole. |

**The off-line rule, and its hard limit.** Score pips and chevrons exist to
*pull the player a little way out of the safe lane* — that displacement is the
level design. But:

- **A pickup's lateral offset from the player is capped at 0.35 of the width**,
  which is ~1.1 s of travel at `LATERAL_MAX`. Enough to be a decision, never a
  sprint.
- **No pickup ever sits above `y = 0.62`.** Reaching the highest one is a
  ~1.1 s slow drift, inside a window of at least 3 s.
- **In Mode S, ground pickups are placed laterally and re-offered.** A pip that
  scrolls past uncollected triggers a replacement within 8 s. Nothing that
  scrolls past may demand a vertical dash — **this is the single failure mode
  the mode experiment is most watching for** (§10). Detection of
  vertical-drift-chasing is an instrumented metric, not a vibe check.
- Pickups drift downward slowly (Mode A: 90 px/s; Mode S: they ride the surface)
  and are collected by a generous radius (72 px), so a near-miss is a hit.

### 5.7 Sectors, waves and the campaign

Five sectors at MVP, each **~90–140 s**, each **4 waves + a boss**, each with its
own surface (§5.4) and boss (§6.4).

| # | Sector | Surface | Boss |
|---|---|---|---|
| 1 | **Ashfall Crust** | Cracked crust, magma fissures | **Cinderjaw** — dreadnought lying lengthwise, 4 hull pods |
| 2 | **Kesselring Yards** | Shipyard deck, cradles, half-built hulls | **Brood Gantry** — carrier disgorging drones from bays across the width |
| 3 | **The Bulwark** | Megastructure armour, trenches, coolant seams | **Nadir Coil** — segmented hive-serpent strung horizontally |
| 4 | **Glacis Shelf** | Ice field over a buried facility | **Hoarfrost** — a wide rail-battery array with rotating spokes |
| 5 | **The Hive Plate** | Pulsing organic hive matter | **Vespidae** — broodmother, pods are egg sacs |

**Wave structure inside a sector** (durations are targets, not hard gates —
a wave ends when it is cleared or its timer expires and its survivors flee):

| Wave | ~Duration | Content |
|---|---|---|
| 1 | 18 s | One formation, one bullet pattern, low density. The read-it-and-breathe wave. |
| 2 | 22 s | Two formations with overlapping entries, two patterns. |
| 3 | 25 s | Heavier air presence **plus the ground layer** — Mode S: scrolling emplacements; Mode A: the plate's emplacements powering up. |
| 4 | 25 s | Densest air choreography of the sector, at that sector's caps. |
| Boss | 35–45 s | Warning band → boss entry → pod fight → destruction beat. |

Between waves: a single-slot banner (`WAVE 2 / 4`), 1.2 s, in the gutter (§7.1).

**Campaign ramp across sectors.** Difficulty scales **only** through: formation
size and shape complexity, number of simultaneous patterns (2 → 3 at Elite),
enemy HP, ground-target count, and swoop frequency. It **never** scales by
raising `SCROLL_SPEED` past its cap, exceeding `APPROACH_BUDGET`, narrowing
`AISLE_MIN`, or introducing any required vertical move. Those four are floors,
not levers (§5.3).

### 5.8 The Overload Vent (automatic)

There is no thumb on a board, so the screen-clear cannot be a button. It is
**automatic**: the core charges as you play, and when the incoming-threat score
crosses a threshold it **vents by itself**.

**Why automatic, decided at brief stage and binding:** the failure mode this
mercy system exists for is *being pinned*, and a pickup-triggered bomb fails
exactly when it is needed — you cannot fly across the frame to fetch a canister
at the moment you cannot move. Automatic fires precisely when movement has
stopped being an answer. A lean-gesture trigger was ruled out because it would
put a deliberate hold at a lean extreme at the moment of maximum pressure.

**Threat score,** evaluated every frame, all terms clamped to `[0, 1]`:

```
T =  0.35 * min(1, bulletsWithin(player, 320px) / 6)
   + 0.30 * max(0, 1 - nearestReachableAisleWidth / AISLE_MIN)
   + 0.15 * edgePinning          // how far past 0.80 of half-width the craft is
   + 0.20 * max(0, 1 - timeToNearestImpact / 1.0s)
```

**Firing conditions — all must hold:** `T > 0.62`, charge `≥ 100%`, and at least
**6 s** since the last vent.

**Effect:** every enemy bullet on screen dissolves into sparks (each worth a
small score trickle, so the vent is never a score penalty); every air enemy
takes damage equal to **40% of a standard fighter's HP**; the boss takes a flat
chunk; the player gets **1.0 s of invulnerability**; charge resets to 0.

**Charge — partly earned, which is the point:**
- Time alone fills it in **22 s**.
- **+1.2%** per air kill, **+2.5%** per near-miss (an enemy bullet passing within
  40 px of the hitbox without hitting).
- **+25%** from a vent battery pickup.
- Aggressive skilled play roughly halves the fill time: **skill buys mercy**,
  with no extra input. That is this design's small slice of the rank/chain/medal
  scoring depth the report notes both references dropped.

**Presentation:** a charge ring in the left margin below the shield gauge,
pulsing above 90%. On fire: a white shockwave ring expanding from the craft, a
brief screen flash, bullets dissolving outward. Loud, unmistakable, and clearly
*not* something the player did — it must read as the ship saving you, not as you
having fumbled a button.

**It is a recharging resource, never an inventory, never bought, never a shop
hook.** No counter, no stock, no pickup that banks one for later.

### 5.9 Difficulty

- **Normal / Elite** are explicitly selectable per sector on the sector-select
  screen. Elite raises density caps (§5.3), unlocks pattern B5, adds a third
  simultaneous pattern, and increases enemy HP by ~35%. It never touches the
  reaction floor, the aisle floor, or the vertical rule.
- **Quiet dynamic easing:** after **two consecutive failures on the same sector
  at the same difficulty**, silently reduce enemy bullet count by 20%, widen
  authored aisles by 15%, and start the player with +1 shield segment. Never
  announce it, never show a UI for it, never offer it as a choice. It resets on
  a clear. This is the release valve the references sold; here it is free and
  invisible.

### 5.10 Damage model

**Attrition, not lives.** A hit does not end the turn.

- **6 shield segments.** Enemy bullet = **1 segment**. Enemy craft collision =
  **2 segments**. Ground-target fire = 1 segment.
- **1.2 s of invulnerability** after any hit, with a visible flash and a
  distinct audio cue, so a bullet cluster can't strip three segments in a frame.
- Segments do not regenerate over time; a **shield cell** pickup restores one.
- **Zero segments = sector failed** → results screen → retry the same sector or
  return to select. There is no revive, no continue, no cost to retry.
- **A hit never costs weapon rank.** Rank loss on hit compounds failure and
  punishes the player exactly when they are already losing; it is deliberately
  not in this design. A hit costs a segment and the score chain, nothing else.
- **The player hitbox is a circle of radius 14 px** at the cockpit — far smaller
  than the ~120 px-wide sprite. This is the standard shmup fairness affordance
  and it matters more here than usual, because fine lateral correction on a
  board is expensive. Do not scale the hitbox to the art.

---

## 6. Entities

### 6.1 Player — the interceptor

- Auto-firing, nose-north, roll-only. Three visual hull tiers driven by rank
  (1–3 / 4–7 / 8–10), each with three roll states (level, roll-L, roll-R) — nine
  sprites total, plus two engine-plume states (cruise, thrust) and one shield
  bubble.
- Behaviour: lateral and vertical velocity from §4, clamped to the player band
  and playable width; roll state from carve sign/magnitude with a small
  hysteresis so it doesn't strobe at the deadzone edge.
- Fire output entirely determined by rank (§8.1).
- Casts a surface shadow (§5.4).
- **POC:** one hull tier, three roll states, no plume variants.

### 6.2 Air enemies (6 types at MVP)

All are flat top-down bodies rotated at runtime to face their travel direction.
One shared damaged/scorched overlay per type, one shared glow-core overlay, one
floating HP pip for damaged craft.

| Type | HP | Role |
|---|---|---|
| **Drone** | 1 | Formation filler. Fires B1 only. Fast entry. *(POC's enemy.)* |
| **Lancer** | 2 | The swooper. Peels more often than anything else. |
| **Emitter** | 3 | Sits in formation and runs B2 sweeps. Never swoops. |
| **Spoke** | 4 | Heavy; runs B3. Fat, slow, obvious, worth killing early. |
| **Warden** | 5 | Carries a shimmer shield that absorbs 3 hits before its body takes damage. Forces focus fire. |
| **Splitter** | 3 | On death, breaks into 2 drones that immediately fly a short exit arc — never a surprise dive. |

Behaviour is composed from three orthogonal pieces — **entry path**, **formation
slot behaviour**, **fire pattern** — so new types at Post-MVP are data, not code.

### 6.3 Ground targets (4 types at MVP)

Shootable, worth score, and the second targeting layer. Mode-dependent
placement per §5.2. Each has intact / damaged / destroyed art plus shared scorch
decals.

| Type | HP | Behaviour |
|---|---|---|
| **Hex turret** | 3 | Fires slow aimed orbs upward on a long cycle. The basic ground threat. |
| **Missile silo** | 4 | Telegraphs for 1.0 s (hatch opens, light pulses), then launches 2 slow orbs on fixed lateral-biased arcs. Never homing. |
| **Shield pylon** | 5 | Does not attack. Grants a shimmer shield to air enemies within a radius until destroyed — a priority-target puzzle with no extra input cost. |
| **Supply cache** | 2 | Non-hostile. Drops a chevron or shield cell when destroyed. The reason to bother with the ground layer even when it isn't shooting at you. |

Ground targets **never fire from below the player band** — they are always above
it or level with its top when they fire (§5.5's do-not-port list). In Mode S,
once a target has scrolled past `y = 0.66` it stops firing.

### 6.4 Bosses (5 at MVP)

One per sector, **wide, lying lengthwise across the frame**, occupying the enemy
band and the upper gutter. Each is one hull + **4 destructible pods** + 4
blown-pod variants + a scorch overlay.

Shared spec:
- **Never enters the player band.** Its lowest extent is `y = 0.58`.
- **Full-width HP bar along the very top edge**, plus small individual pod pips.
- Each pod owns **one attack pattern**; destroying it **removes that pattern**
  permanently and pays score. So the fight measurably calms as you win, which is
  the right shape for a board.
- Core HP only begins dropping once **all 4 pods are gone** — or during a
  vulnerable window (below).
- **The optional vulnerable window — the game's one designed use of the vertical
  axis.** Every ~12 s, the boss's core exposes for **3.5 s** at an announced x.
  Drifting up to `y ≈ 0.62` during the window **doubles** core damage. The
  window is long enough for a 1.1 s drift up, a beat of fire, and a 1.1 s drift
  back, with margin. It is **always optional** — the boss is fully killable
  without ever leaving `y = 0.82`, just slower. Verify this explicitly during
  the on-device pass.
- Entry: full-width red **WARNING** band 2.0 s before, through the single-slot
  banner queue so it can never collide with another banner (the report caught
  three text layers colliding in one reference frame).
- Death: staged pod detonations, then a hull break-up over ~2 s, particle-driven.

Per-boss flavour is in the pod layout and pattern assignment, not in new
systems:

| Boss | Distinctive |
|---|---|
| **Cinderjaw** | Pods are hull batteries; runs B1 + B2. The teaching boss. |
| **Brood Gantry** | Pods are launch bays that emit drones on a timer; killing a bay stops its stream. |
| **Nadir Coil** | Segmented: the pods are body segments and the serpent visibly shortens as they die. Runs B4. |
| **Hoarfrost** | Pods are rail emitters running B3 spokes; the whole array rotates slowly. |
| **Vespidae** | Pods are egg sacs; each spawns a splitter pair when destroyed — a deliberate cost to the obvious strategy. |

### 6.5 Non-combat entities

- **Surface props** — rocks, containers, pipes, clamps, wrecks, masts. Eight per
  sector surface. Scenery only; never collidable.
- **Ground decals** — cracks, scorch, oil, shadow blobs. Shared across sectors.
- **Ambient overlays** — dust, heat haze, coolant glow. Under the action layer,
  always (§5.4).

---

## 7. UI / HUD

DOM/CSS overlay on top of the game canvas — not drawn into the render layer.
Keeps text crisp and updates cheap. All of it lives in the margins; the centre
stays clear (§5.1).

### 7.1 In-run HUD

- **Left margin, top to bottom:** score readout → **vertical segmented shield
  gauge** (6 segments, cyan, shield glyph at its foot, per `concept-01.png`) →
  **weapon-rank ladder** (10 small chevron pips, on/off, immediately beside the
  shield gauge — both are "how strong am I" readouts and belong grouped) →
  **vent-charge ring** (fills clockwise, pulses above 90%).
- **Right margin:** **vertical sector-progress meter** with a numeric percentage
  at its foot. Per the report, prefer the percentage over a count-up timer — for
  a queue-based product, "how close am I to the end" is worth more than "how
  long have I been playing."
- **Top edge, full width:** boss HP bar. Only present during a boss.
- **Banners:** full-width horizontal band centred in the **gutter** at
  `y ≈ 0.42`, so it never sits over the formation or the player. **Single-slot
  queue**: one banner at a time, minimum 0.8 s each, queue depth 3, oldest
  non-critical dropped if the queue overflows. `WARNING / BOSS` always preempts.
  Two banners can never collide — this is a code invariant, not a timing
  coincidence.
- **Floating combat text:** score popups at kill sites, small and short-lived,
  capped at 8 concurrent so they never become a second bullet layer.
- **Back + Pause buttons** — top-right icon pair per the repo's HUD chrome
  convention (Back is a plain `&times;` at `id="gb-back"`, Pause just to its
  left). Note the convention puts score top-left, which this game also does —
  no divergence here.

### 7.2 Screens

- **Title** — key art, a single start affordance. Must reach a playable or
  countdown state on load without requiring a key press.
- **Sector select** — a map with 5 nodes, each showing its three star slots and
  a Normal/Elite toggle. Locked nodes are visibly locked with the unlock
  condition stated (§8.3).
- **Diegetic loading console** — a full-screen rendered sci-fi console (scanning
  sweep, status lamps, dials, the `NOVA VANGUARD` title stencilled in) standing
  in for a progress bar. The report named 1945 Air Force's radar console the
  strongest single asset in either reference; this is that idea, in this idiom,
  and it is cheap. MVP.
- **Sector briefing** — 3 s, non-blocking, auto-advancing: sector name, surface
  art strip, the three star objectives. Auto-advances on its own timer so it can
  never block the required no-key-press path to playable.
- **Results** — the escalating multiplier tally (§8.4), star slots filling,
  `NEXT SECTOR` / `RETRY` / `SECTOR SELECT`, with a **12 s auto-timeout back to
  title** so a walk-up queue doesn't stall on an abandoned results screen.

### 7.3 What the HUD does *not* own

Threat legibility is carried by the **playfield**, not the bar: fat bullets,
colour-coded ownership, the entry telegraph, the pre-boss warning band, the
vent's shockwave. A player watching the centre of the screen should never need
to check a gauge to know they are in trouble.

### 7.4 Game-over / results overlay contract

Must satisfy the SDK's overlay DOM contract — `GOBALANCE_SDK.md` is ground truth
for the exact ids and behaviour (the Unity host synthetically clicks the restart
control while the overlay is visible). Do not invent a different structure for
it.

---

## 8. Scoring / progression

### 8.1 In-run growth — the chevron rank ladder (required, and the encouraged kind)

Rank **1 → 10**, climbed by chevron pickups within a sector, **reset to 1 at the
start of every sector**. This is the free version of the references' power
curve, and it is the whole progression device inside a run.

| Rank | Fire | Hull tier |
|---|---|---|
| 1–2 | Single bolt | A |
| 3–4 | Twin bolts | A (tier A covers 1–3) |
| 5–6 | Twin + 2 shallow angled = 3-wide spread | B |
| 7–8 | Wider 3-spread, higher rate | B |
| 9–10 | Arc burst — 5-way front arc | C |

- **DPS roughly triples from rank 1 to rank 10, not tenfold.** Rank should feel
  like a real upgrade and change the shape of what you can cover, without making
  the last wave trivial or the first wave impossible.
- The hull visibly changes at each tier — the growth is *seen*, which is the job
  the references' power number was actually doing.
- Rank is never lost to damage (§5.10).

### 8.2 Score

- **Kill value** by type: drone 100, lancer 150, emitter 200, spoke 250,
  splitter 200 (+50 per fragment), warden 400. Ground targets 150–300. Boss pods
  1000 each, boss core 5000.
- **Pre-lock bonus: ×2** on any craft killed before it settles into formation.
  This is the skill play and the score play in one — it is the whole reason the
  fly-in exists (§3.3, §5.5).
- **Formation-whole bonus: +2000** and a banner for clearing a formation with no
  survivor.
- **Score pips: +250** each.
- **Chain multiplier:** consecutive kills without taking a hit. Steps at 10 / 25
  / 50 / 100 chain → ×1.25 / ×1.5 / ×2.0 / ×3.0. **Resets to ×1 on any shield
  hit**, not on a missed shot (auto-fire makes "missed shots" meaningless as a
  penalty).
- **Boss time bonus**, scaled to time under a par.

### 8.3 In-game progression — the sector campaign (required, and encouraged)

- **Clearing a sector unlocks the next.** Five sectors, in order, one authored
  ramp. This is the in-core-game progression the product explicitly wants.
- **Three free star objectives per sector**, revealed on the briefing screen and
  filled on the results screen:
  1. **Clear the sector.**
  2. **Clear it losing at most 2 shield segments.**
  3. A **sector-specific mastery objective** — e.g. destroy a full formation
     before it locks (S1), destroy every ground target in wave 3 (S2), beat the
     boss in under 40 s (S3), clear a wave with no vent fire (S4), finish at
     rank 10 (S5).
- **Stars gate exactly one thing:** collecting all three on a sector unlocks
  that sector's **Elite** variant. They unlock nothing else, buy nothing, and
  feed no total.
- **Session semantics, decided here because the product forces the question.**
  A full 5-sector campaign is ~10 minutes, which is longer than one walk-up
  turn. So: **campaign unlock state is per-session.** Every session starts at
  sector 1 with the same authored ramp, so no walk-up player inherits a stranger's
  progress or is locked out of content they didn't play. A session ends on
  return-to-title or on the results-screen timeout. Persisted across sessions:
  **a display-only local best score and the star flags**, which gate nothing
  except the Elite toggle described above. Flagged in §12 as the one place a
  product-shape call was made rather than inherited.

### 8.4 End-of-sector tally — "keep the beat, earn it"

The references' spin wheel is replaced by a tally that reveals multipliers
**one at a time**, ~0.6 s apart, from things the player actually did:

1. **Accuracy** — hits / shots fired. With auto-fire this is a *positioning*
   stat, which is exactly the right thing to grade.
2. **No-hit streak** — longest run without losing a segment.
3. **Formations cleared whole.**
4. **Objectives met.**
5. **Boss time.**

Then the total counts up. Same escalating-reveal rhythm as the wheel, nothing
random, nothing to buy, no ad.

### 8.5 Explicitly confirmed — no purchases, no currency, no cross-session meta-unlock web, anywhere, even implicitly

- There is **no currency of any kind** in this game — no coins, no gems, no
  parts, no energy, no dog tags. Score is a number, not a wallet. There is no
  code path, UI element or data field anywhere that represents a spendable
  balance.
- **No shop, no consumable grid, no pre-level loadout purchase, no upgrade
  tree, no aircraft tiers, no wingman/device slots, no battle pass, no VIP, no
  daily/weekly tasks, no login calendar, no spin wheel, no watch-ad button, no
  ad-revive, no paid continue.**
- **No real-money transaction of any kind**, permanently — not a v1 cut (§0.5,
  §11).
- **Weapon rank, score, chain, shield and vent charge all reset at sector
  start.** Growth lives inside the run.
- **Campaign unlock is in-game and per-session** (§8.3) — it is level-to-level
  progression inside this one game, not a cross-session unlock web and not
  cross-game anything.
- The only things that may persist to disk are a **display-only best score** and
  **star flags**. Neither gates content beyond the same game's own Elite toggle,
  neither accumulates into a spendable total, and neither references any other
  game.
- Post-MVP's second hull is unlocked by **clearing the campaign in a session**,
  not by accumulating anything across sessions, and it is a handling/firepower
  trade rather than a strictly better ship.

---

## 9. Technical architecture

### 9.1 Rendering approach

**2D, WebGL-accelerated, no 3D scene anywhere.** The strict overhead camera
(§0.2) is not a camera setting — it is a consequence of the game genuinely being
2D. There is no perspective projection, no camera object, no ground plane
transform, and none may be added.

**Recommendation: PixiJS.** This game is the concrete case
`WEB_MINIGAME_TECH_RETROSPECTIVE.md` was forward-flagging when it asked what
stage 4's 2D default should be, and it is a much stronger argument for a
batching WebGL 2D renderer than any 2D game this repo has built so far:

- Peak on-screen sprite count is high and additive-heavy: up to 30 enemy bullets
  + ~40 player bolts + 26 air enemies + a boss with 4 pods + ground targets +
  pickups + a scrolling surface with ~40 props and decals + several hundred
  additive particles. Raw Canvas 2D `drawImage` with
  `globalCompositeOperation = 'lighter'` for the neon/bloom look is exactly the
  workload that falls off a cliff in a mobile WebView.
- The idiom (§0.3) is *built* on additive blending, tinting and runtime
  rotation/scale — all effectively free in a batching WebGL renderer and all
  expensive in Canvas 2D.
- It costs one dependency and no change to how the game loop or logic is
  written.

**This needs the CTO's outstanding sign-off, and the code must not depend on
getting it.** If the answer is "no new dependency," the fallback is raw Canvas
2D with the bloom/additive pass reduced to pre-baked glow sprites and a hard
particle cap. To keep that swap cheap, **all draw calls live under `/render` and
nothing outside it touches renderer APIs** — game state is plain data, systems
mutate plain data, and the render layer reads it. That is good structure
regardless of which way the call goes. Flag it before starting POC-1; don't
block on it (§12).

**Other rendering rules:**
- **Design space 1920 × 1080**, one scaled root container, letterboxed. Every
  number in this document is in that space.
- **Layer order, bottom to top:** surface base → surface props → ground decals →
  ground targets → ground FX → air shadows → pickups → player → enemies →
  projectiles → particles/FX. HUD is DOM, above all of it. **Ambient overlays
  render under the action layer**, never above (§5.4).
- **Fixed-timestep simulation at 60 Hz** with an accumulator; render interpolated
  if needed. The reaction-floor guarantees in §5.3 are expressed in seconds and
  must not drift with frame rate — a variable-dt integration would make the
  pacing contract untestable.
- **Pool everything that spawns**: bullets, particles, enemies, pickups, props,
  score popups. Never allocate per-spawn in the loop.
- **Particles** via a lightweight custom emitter over additive sprites, with a
  hard global cap (start at 400) and oldest-first eviction. Explosions are
  particle systems, not authored sheets (§0.3).
- **Collision** is circle–circle over flat typed arrays with early rejects. At
  these counts (≤ 30 enemy bullets × 1 player, ≤ 40 player bolts × ≤ 26 enemies)
  no spatial partitioning is warranted; don't build one.
- **The surface** is one large seamless texture scrolled by UV offset (Mode S) or
  held (Mode A) — one draw call either way — with props as pooled sprites on top.
  Not a tileset.
- **No custom shaders required.** Bloom, if used, is a cheap additive-sprite
  fake rather than a post-process pass, and sits behind an on/off toggle —
  unverified GPU cost on real WebView hardware until tested on-device.

### 9.2 State management shape

A small explicit state machine, no framework state manager at this scope:

```
boot → title → sectorSelect → briefing → countdown → running → sectorClear | sectorFailed → results
                    ↑                                                                          |
                    └──────────────────────────────────────────────────────────────────────────┘
```

- `running` has sub-states `wave`, `waveBanner`, `bossWarning`, `boss`,
  `bossDeath` — all inside one update path, gated by a single enum, not by flags
  scattered through the loop.
- **Pause** freezes the whole simulation without touching the state machine's
  current value, so resuming drops back into exactly what was paused.
- The first playable/countdown state must be reachable on load **without a key
  press**; the briefing screen auto-advances on a timer for exactly this reason
  (§7.2).
- Game state is plain data: player, enemy array, bullet arrays, pickup array,
  surface scroll offset, wave index, rank, shield, chain, vent charge, score.
  Systems tick over it once per frame in a fixed order.

### 9.3 Suggested code structure

```
/src
  /core        - bootstrap, fixed-timestep loop, state machine, mode accessor
  /input       - reads the analog tilt vector, applies per-axis deadzones,
                 produces {carve, nudge}; desktop keyboard fallback writes into
                 the same vector. Never reads the host's synthetic arrow keys.
  /player      - craft controller (velocity, clamps, roll state), auto-fire
                 emitter driven by rank, hitbox, damage + i-frames
  /enemies     - entry-path runner, formation slot controller, swoop controller,
                 per-type composition; ground-target behaviours; boss controller
                 (pods, patterns, vulnerable window, death sequence)
  /patterns    - bullet-pattern emitters (B1-B5), each declaring its guaranteed
                 aisle so /systems/constraints.js can verify it
  /surface     - base layer scroll/hold, prop spawn+recycle, decals, ambient
                 overlays, per-sector theme swap, the desaturation scrim
  /systems     - wave/sector director, spawner, pickup placement + re-offer,
                 vent (threat score + charge), shield, score + chain, progress
                 meter, difficulty + dynamic easing, constraints validator
  /render      - ALL renderer API calls live here and nowhere else (§9.1):
                 layer setup, sprite pools, particle emitter, shadow blobs,
                 additive/bloom handling
  /ui          - DOM overlay: shield gauge, rank ladder, vent ring, progress
                 meter, boss bar, banner queue, popups, back/pause, briefing,
                 results tally, sector select, loading console
  /audio       - WebAudio: decode once per clip, fresh source node per trigger,
                 one-time gesture unlock. Not <audio> elements — they cannot
                 handle rapid repeats and this game is nothing but rapid repeats.
  /debug       - the POC instrumentation panel + the mode toggle (§10)
  /data        - sectors.js, formations.js, bulletPatterns.js, enemies.js,
                 bosses.js, pickups.js, surfaceThemes.js, tuning.js
  /assets      - placeholder art now, real art at MVP (surface art from POC)
```

**`/data/tuning.js` holds every cap and constant in this document in one file** —
`APPROACH_BUDGET`, `SCROLL_SPEED`, `AISLE_MIN`, the density caps, the deadzones,
`LATERAL_MAX`, `VERTICAL_MAX`, band boundaries, vent weights and thresholds.
Nothing anywhere else hardcodes a gameplay number. This is the
"all spawn/difficulty knobs in one findable place" lesson from prior builds, and
it is what makes the on-device tuning pass (§10) a config session rather than a
code hunt.

Keep `/core`, `/systems` and `/player` theme-agnostic; sectors, surfaces, enemy
art and boss layouts are data + assets, so Post-MVP content is additions, not
code changes.

**Shipping/bundling is deliberately not specified in this document** — module
format, serving, the overlay DOM contract, the Back button and the error bridge
are owned by `GOBALANCE_SDK.md`, which is ground truth. Do not build around
`file://` or single-file assumptions, and do not take bundling guidance from
older docs.

### 9.4 The constraints validator — build this early, it pays for itself

A module in `/systems/constraints.js` that runs at boot in dev mode over all
authored data in `/data`, and **fails loudly** on any violation:

1. **Reaction floor** — every pattern's and entity's maximum downward velocity
   component, plus the active mode's scroll speed, is ≤ `APPROACH_BUDGET`.
2. **Aisle floor** — every pattern declares a guaranteed aisle ≥ `AISLE_MIN`,
   and any aisle motion is ≤ 420 px/s.
3. **Density caps** — no wave's authored composition can exceed the simultaneous
   bullet/enemy/pattern caps for its difficulty.
4. **Band discipline** — no formation slot, pickup spawn, ground-target position
   or boss extent falls in the HUD margins, the top strip, or below `y = 0.58`
   for bosses; no locked entity sits in the gutter.
5. **The vertical rule** — no pickup above `y = 0.62`, no pickup offset beyond
   0.35 of the width, no authored element flagged as required that sits outside
   the `y = 0.82` lateral-only line.

Every one of these is a rule this document states in prose and that content
authoring will otherwise quietly violate around sector 4 at 11pm. Runtime
assertions on the same invariants (bullet count, banner queue depth) are cheap
and should also be on in dev builds.

### 9.5 Art pipeline

`KOLBO_ASSET_PIPELINE.md` is ground truth for tool/model choice. This game's
specific rules:

**The perspective clause — paste verbatim into every asset prompt.** Do not
paraphrase it per-asset; the failure mode §0.2 exists to prevent is exactly a
prompt that softened this into "top-down-ish."

> STRICT ORTHOGRAPHIC OVERHEAD CAMERA looking straight down: no horizon line, no
> sky, no vanishing point, no three-quarter view, no perspective tilt. Seen from
> directly above — wing top surfaces, hull spines and engine nacelles viewed from
> overhead. Art idiom: modern rendered 3D-look sci-fi, glossy hard-surface hulls
> with crisp bevels and metallic highlights, saturated neon energy glow, bloom,
> particle sparks. NOT pixel art.

Plus, for the player craft only: *"NOSE POINTING STRAIGHT UP toward the top of
the frame, perfectly vertically aligned, banking conveyed only by a slight roll
of the wings."*

**Rules:**

1. **Batch character/craft sets in one call.** The three roll states of a hull
   tier are generated **together as one multi-panel grid**, from one lineage.
   Frames generated one at a time drift off-model — a lesson already paid for in
   this repo.
2. **Fixed shared canvas per set, no per-frame alpha-bbox crop.** Slice all
   states of a set at the same cell rectangle, or the sprite's centre visibly
   shifts between roll states while the craft is supposed to be holding a line.
3. **Runtime transforms are the animation system.** One image per enemy body,
   rotated to heading. Roll is a sprite swap. Pickup spin, thruster flicker, pod
   destruction, boss sway and every explosion are code and particles over static
   textures. **Nothing in this game requires a hand-drawn animation sequence**
   (optional exception: one 8-frame boss-death sheet if particles alone don't
   sell it).
4. **The hard top-down rule *reduces* the asset count** — a nose-up craft that
   only rolls needs no turn or yaw sprites at all. Don't generate them.
5. **Surface base layers must tile seamlessly *vertically*** for Mode S's scroll,
   at ~2048 × 2048 or 1080 × 2160. Generate large, make the seam safe
   deliberately (overlap band or mirrored edge), and **verify by actually
   scrolling it before shipping** — a prior build discarded a texture for a
   visible phase-mismatch seam that looked fine as a still.
6. **Bring the surface into the readability band with the scrim, not with a
   regeneration** (§5.4). Generated surface art will come back too hot; that is
   expected and cheap to fix in code.
7. **Enemy craft stay chromatically separated from the player's blue-and-white**
   — purple / magenta / teal insectoid. `concept-02.png` is the counter-example
   (§1).
8. **Background removal is local**, not via the asset service's removebg
   operation, which is known broken. Flatten transparent PNGs onto real white
   RGB before re-uploading one as an edit source.
9. **Audio:** generate each SFX as its own call. Batching multiple distinct SFX
   into one generation has been tested and does not produce separable sounds.

**Asset load concentrates in bosses (~50 sprites) and surfaces (~52).** The MVP
inventory is ~202 static sprites and 0–8 authored frames; the full breakdown is
in the brief's asset-inventory table and should be treated as the production
plan. **POC needs roughly 20 of these** — one hull tier × 3 rolls, one enemy,
two projectiles, one surface base + 8 props, two HUD bars — plus placeholders
for the rest, with the surface being the one thing that must be real (§2).

---

## 10. Build milestones

### POC — prove the loop, then decide the mode

1. **Bootstrap and layout.** Render layer up, design-space scaling and
   letterboxing, the band overlay drawn as a dev guide (§5.1), placeholder flat
   surface. Confirm the 16:9 band budget looks right before anything moves.
2. **Player + analog input** (§4). Free continuous lateral positioning with the
   width clamp; slow heavily-deadzoned vertical with the band clamp; roll-state
   sprite swap; auto-fire straight up. **Verify neutral reliably reads as
   "holding a line" and that leaning hard sideways never causes accidental
   vertical drift** — that is what the asymmetric deadzones are for.
3. **The real surface, both modes, behind the live toggle** (§5.2). Sector 1's
   base layer as **real art** (not placeholder), scrolling at `SCROLL_SPEED` in
   Mode S, held with ambient drift in Mode A, props riding or placed. Mid-session
   toggle working in under a second. **This is the milestone that makes the
   experiment possible**, so it comes before enemies, not after.
4. **One enemy type, entry → lock → swoop** (§5.5). Side-edge entry along a
   visible looping path into a 12 × 2 formation; the pre-lock kill window;
   horizontal swoops that dip to `y = 0.62` and never below.
5. **One bullet pattern with a guaranteed aisle** (B1, then B2), plus the shield
   attrition gauge (§5.10) as the whole fail model — with a raw segment readout
   for HUD.
6. **The constraints validator** (§9.4), at least rules 1, 2 and 4. Wire it
   before authoring a second wave, not after.
7. **The instrumentation panel** (§2, §10 below). On-screen and console, every
   sample tagged with the active mode.
8. **THE MODE DECISION — an explicit milestone, not a vague "then we choose."**

**Milestone POC-8 in full.** Run both modes on real hardware, same content, same
session, alternating. Metrics collected automatically by POC-7:

- **Lateral corrections per second** under the hardest available wave (count of
  carve sign-changes exceeding a magnitude threshold, per second).
- **Survival rate through the narrowest authored aisle** across N attempts.
- **Time-to-first-hit for a naive walk-up player** (a player who has not seen
  the game).
- **Vertical-axis usage**: total time with `|nudge|` past the deadzone, and a
  count of "vertical dashes" (sustained near-max vertical input for > 0.4 s).
  **This is the drift-chasing detector and it is the metric Mode S most has to
  pass.**

Acceptance criteria, judged on the board:

- **Mode S must show that the scroll adds more than it costs** — that it reads
  as flight and progress rather than as pressure; that at the capped speed a
  first-timer can clear wave 3 without a hit; that it does **not** induce
  vertical drift-chasing (players leaning forward/back to chase ground pickups
  before they pass — the failure we most want to avoid); and that leaning while
  the ground moves causes no visual-flow discomfort.
- **Mode A must show that it doesn't go dead** — that a fixed scene still feels
  like flying after 60 s, that fly-in-and-hold reads as clearly in practice as
  it does on paper, and that the progress meter alone can carry the sense of
  getting somewhere.

**The outcome is written down before any MVP work starts** — record the chosen
mode, the metric values that decided it, and any tuning changes it implies, in a
short decision note next to this document, and set `FRAMING_MODE` accordingly.
**Do not delete the losing mode's code path**; it is one config flag and keeping
it costs nothing.

### MVP — turn the POC into the shippable game

Everything below is built in the winning mode. Ordered.

9. **Sector/wave director** (§5.7): 4 waves + boss slot, wave banners through the
   single-slot queue, the progress meter (mode-appropriate source), the
   entry-band telegraph.
10. **The full formation set** (F1–F5) and **the full pattern set** (B1–B5),
    every one declaring its aisle to the validator. Extend the validator to all
    five rules.
11. **The full air bestiary** (6 types, §6.2) composed from entry path /
    formation behaviour / fire pattern.
12. **Chevron rank ladder 1 → 10** with the three hull tiers and the fire
    progression (§8.1), plus the rank ladder HUD.
13. **Pickups and flight-path design** (§5.6): score pips in off-line trails,
    shield cells, vent batteries, the offset caps, and — if Mode S won — the
    re-offer rule.
14. **Ground targets** (4 types, §6.3) in the winning mode's placement model.
15. **The Overload Vent** (§5.8): threat score, earned charge, the ring, the
    shockwave. Tune the threshold against real pinned moments, not synthetic
    ones.
16. **Bosses** (§6.4): the shared pod/core/pattern-shedding framework, the
    warning band, the vulnerable window, the death sequence — then all five
    bosses as data over that framework.
17. **Scoring, chain, and the escalating results tally** (§8.2, §8.4).
18. **Star objectives + sector select + campaign unlock + session semantics**
    (§8.3, §7.2).
19. **Normal/Elite + the quiet dynamic easing** (§5.9).
20. **Full art pass** (§9.5): all five surfaces, all bestiary art, five bosses,
    projectiles, pickups, particle textures, HUD, screens, and the **diegetic
    loading console**. Replace every placeholder.
21. **VFX + audio pass**: additive bloom on bolts and plasma, impact sparks,
    debris chunks, pod detonations, the vent shockwave, the boss break-up;
    layered audio for fire / impact / kill / rank-up / vent / warning.
22. **Results overlay on the SDK's DOM contract** (§7.4) + best-score display.
23. **On-device tuning pass.** Re-tune both deadzones, `LATERAL_MAX`,
    `VERTICAL_MAX`, the vent threshold, and every sector's density against
    actual board feel. Desktop keyboard feel will systematically overstate how
    easy fine lateral correction is. **Explicitly re-verify on hardware:**
    (a) every wave at both difficulties is clearable holding `y = 0.82` and
    moving laterally only; (b) every boss is killable without ever using the
    vulnerable window; (c) no pattern's aisle is unreachable in time; (d) in
    Mode S, no ground pickup induces a vertical dash.

### Post-MVP (backlog, unordered)

More sectors and surfaces (red-giant refinery, shattered ringworld plate,
drowned reef facility); larger bestiary including top-band clamped emplacements;
more multi-part boss shapes and a two-phase boss; harder late-campaign
choreography inside the same caps; a second selectable hull unlocked by clearing
the campaign; an endless swarm mode from the same wave library; a local
high-score board; and — if Mode S won — one comparison test of a
pickup-triggered vent canister against the automatic default (§5.8).

---

## 11. Explicitly out of scope

- **Any real-money IAP, paid currency, ads-for-currency, paid continue/revive,
  or purchase path — permanently, not just for these tiers** (§0.5, §8.5).
- **Any cross-session or cross-game meta-progression, unlock web, upgrade tree,
  or currency sink** — including at Post-MVP. No hangar, no aircraft tiers, no
  wingman/device slots, no battle pass, no VIP, no energy, no daily tasks, no
  login calendar, no spin wheel.
- **Any required use of the forward/back axis, at any tier.** No wave, pattern,
  boss phase, pickup, objective or difficulty setting may depend on a vertical
  move, fast or slow (§0.5, §5.3). The boss vulnerable window and every pickup
  are opt-in upgrades to outcomes, never gates on them.
- **A fire button, a bomb button, or any action input.** The vent is automatic;
  a lean-gesture trigger for it is ruled out (§5.8).
- **Discrete lanes.** Lateral position is continuous. Do not quantize it into
  slots "for readability" at any tier (§4).
- **Discrete lives, spawn-shield respawns, and one-hit death.** Attrition only
  (§5.10).
- **Rank loss on damage** (§5.10).
- **Option A — rotating to a horizontal Gradius-style scroller.** Rejected in
  both framing modes: it puts the reflexive dodge on the forward/back lean,
  which is a physical-exertion problem, not a controls one. Not revisitable
  during build.
- **The do-not-port list** (§5.5): diagonal staircase bullet curtains, anything
  firing from below, simultaneous top-and-bottom pressure, Galaga's straight-down
  plunge, continuous non-returning dives, any aisle narrower than `AISLE_MIN`.
- **An empty starfield backdrop**, at any tier, for any sector (§0.4).
- **Any 3D scene, perspective projection, pseudo-3D ground plane, skewed quad,
  or camera tilt** (§0.2, §9.1).
- **A parallax cloud/scrim layer over the playfield.** Ambient overlays render
  under the action layer only (§5.4).
- **Hand-authored animation sheets** for ships, pickups, emplacements or
  explosions — runtime transforms and particles instead (§9.5).
- **A physics engine.** Circle–circle overlap checks are sufficient (§9.1).
- Networked leaderboards / multiplayer / PvP.
- The references' telemetry prompt ("do you like this level?") — it breaks the
  fiction and we can instrument silently.

---

## 12. Open questions / risks

- **The mode decision is the project's biggest open question, and it is
  deliberately unresolved on paper.** POC-8 (§10) is how it closes. The risk to
  manage is *not* picking wrong — it is the decision being made casually, from
  one short play, without the metrics. Collect the numbers; they exist precisely
  because "the scroll feels important" is a real intuition that a single session
  can mislead in either direction.
- **PixiJS vs. raw Canvas needs the CTO's sign-off** (§9.1). Recommendation is
  PixiJS, and this is the strongest case the repo has had for it, but the
  `/render` isolation rule means POC-1 can start before the answer arrives. Ask
  early; don't block.
- **Mode S's specific failure mode is vertical drift-chasing.** The lateral
  placement rule, the offset cap and the re-offer rule (§5.6) are all designed
  against it, but they are design mitigations for a *player-behaviour* risk. If
  the instrumentation shows dashes even with them in place, the answer is to
  remove ground pickups from Mode S entirely (keeping ground *targets*, which
  are shot rather than collected), not to relax the vertical rule.
- **Mode A's specific failure mode is going dead.** §5.2's anti-deadness
  requirements are a guess at how much motion a static scene needs. If 60 s in
  Mode A still reads as flat, the next lever is more aggressive scheduled
  surface activity and longer, more visible fly-in paths — **not** adding a slow
  scroll, which would just make it a worse Mode S.
- **The scroll-adds-to-approach rule is a tuning convention, not physics**
  (§5.3). It is binding here because it was decided at brief level and because
  it errs safe. If Mode S wins and the resulting pattern speeds feel sluggish
  to a *skilled* player, the correct response is more/denser patterns within the
  density caps, not a faster clock.
- **Boss pod readability at 16:9.** A boss lying lengthwise across 1920 px with
  four pods risks the player being unable to tell which pod they are damaging
  from the far side of the frame. Mitigation: strong per-pod hit flash, pod pips
  on the HP bar positioned to match the pods' actual x. Verify on the real
  screen size, not a desktop window.
- **Seamless vertical tiling of the surface art** (§9.5) is a genuine generation
  risk — a repeating seam is very visible when the whole frame is that texture
  scrolling at 135 px/s. Verify by scrolling, early, on sector 1's surface at
  POC-3, before four more are commissioned.
- **Particle budget on real WebView hardware is unverified.** The bloom/additive
  look is central to the idiom, and it is also the first thing to cost frames.
  Profile at POC-3 with the surface plus a synthetic worst-case particle load
  before the art pass locks the look.
- **Session semantics for the campaign** (§8.3) — per-session unlock with only a
  display-only persisted best score is a call made here on the walk-up-queue
  reality, not something the brief specified. Worth confirming with Amit, and
  worth revisiting once there is real installation data on how long people
  actually stay.
- **Accuracy as a results metric with auto-fire** (§8.4) grades positioning
  rather than trigger discipline, which is correct — but it may read oddly to a
  player who never chose to fire. If it confuses in playtest, relabel it
  ("ON TARGET") rather than dropping it; the underlying stat is the right one.
- **The vent threshold is the hardest number in the game to tune.** Too eager and
  it removes the tension it exists to relieve; too reluctant and it fails at
  exactly the pinned moment it was designed for. Tune it against recorded real
  pinned moments from the POC sessions, not against synthetic bullet dumps.
