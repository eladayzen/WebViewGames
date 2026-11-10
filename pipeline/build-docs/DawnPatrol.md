# Dawn Patrol: Endless Point — Game Design & Build Doc
### (2D side-on endless surface-rider on one continuous breaking wave — GoBalance build, lateral-lean analog input, zero buttons)

Draft v1 — for implementation by Claude Code. Full spec, placeholder-art-first
where noted. Expanded from the **approved** macro brief at
`pipeline/macro-briefs/approved/dawn-patrol-endless-point/brief.md`, which is
downstream of the stage-1 report `pipeline/reports/WaveSurf.md`.

The brief stays the source of truth for *what the game is*; this document owns
*how it gets built*. Where this doc puts a number on something the brief left
qualitative, the number is the buildable version of the brief's intent — change
it by tuning, not by re-litigating the intent.

---

## 0. Read-first notes

Five things below are **binding inputs**, not options to re-open during build.
Four are direct instructions from Amit; one is the standing product constraint.

### 0.1 Fidelity to the reference is the point — this is a reskin, not a redesign

> *"Recognizably the same game as the reference — the 2D side-on endless surf
> runner on a single continuous breaking wave, player held at fixed screen x,
> height-on-the-wave-face as the one and only control axis, aerials off the lip
> as the scoring ceiling … Reskinning the surfer/setting for a non-TMNT identity
> is expected and fine — changing the game is not."*

Concretely, during build:

- **Do not change the camera.** Side-on 2D, fixed horizontal framing, player
  pinned at ~25% screen x. No chase camera, no rotation of the world, no
  pseudo-3D, no zoom-out "for readability."
- **Do not change the genre.** One continuous axis, no lanes, auto-scroll
  right-to-left, no horizontal player control, no buttons.
- **Do not add systems the brief doesn't have.** No dash, no shield, no combo
  button, no weapon, no boss, no enemy that must be attacked, no stamina bar.
  If something feels thin during build, the answer is *tune the existing
  systems*, not add a sixth one.
- Reskinning the surfer, the coast, the hazard bestiary and the palette into an
  original identity is **expected and already specified** (§1, §6, §9.6).

The one place the reference is deliberately departed from is its currency /
consumable economy, and that is a permanent product constraint, not a design
opinion (§0.5, §8.6).

### 0.2 The control axis is LATERAL lean only — non-negotiable

**Lean left = climb the face toward the lip. Lean right = drop toward the
trough.** Free, continuous, no lanes, no snapping, no discrete positions
anywhere.

The reference's one axis is screen-*vertical*. The naive mapping would put the
whole game on forward/back lean, which is GoBalance's expensive axis and is
disqualifying for an exertion product. The brief takes the report's **remap**
recommendation and explicitly **rejects** the alternative of rotating the world
(which would throw away the side-on framing §0.1 protects).

Two build-level consequences that must survive implementation:

- **The forward/back tilt component is never read, anywhere in the codebase.**
  Not for a nudge, not for a secondary action, not for a menu, not "just in
  case." The input module exposes exactly one scalar. This is enforced by there
  being no code path that touches the `y` component of the tilt vector (§4,
  §9.5).
- **Do not quantize the lateral axis into steps or lanes at any tier**, for any
  readability or "snappiness" reason. Continuous position *is* the mechanic.

The fiction is not a shrug at intuitiveness and should be honored in the art and
the animation: surfing is a weight-shift-across-the-board sport, climbing and
dropping a face is toe-side/heel-side pressure, and the lip sits up-and-to-the-
**left** on screen while the trough opens down-and-to-the-**right** — so "lean
left to go up the wave" points at the actual on-screen direction of the lip.
The surfer's carve animation must lean *into* that direction so the mapping is
self-teaching in the first few seconds (§6.1).

### 0.3 Board-neutral is a survivable mid-face trim line

The surfer **auto-trims**. With the board at neutral she holds a stable,
survivable mid-face line indefinitely. Lean is *deviation* from that line, and
releasing eases her back to it.

- Neutral is **never** "falling into the trough," and there is no gravity term
  the player is fighting. The exertion pattern this design exists to avoid is
  "hold a lean for twenty seconds straight."
- **There is deliberately no trough fail state.** The bottom of the face is safe
  — low-scoring and hazard-dense, but safe. A "don't sink" fail would
  reintroduce exactly the constant-lean pressure the trim line removes. Do not
  add one at any tier, including Post-MVP (§11).
- Riding the trim line survives and scores the floor. The player leans because
  they want the ceiling, not because the board will kill them if they stand
  still.

### 0.4 Zero extra inputs — the whole game is one continuous lateral lean

This is the single biggest reason the genre fits the board, and it does not get
spent:

- **Aerials fire automatically** off the lip, scaled by how hard you were
  climbing. The player does nothing in the air.
- **Landings are automatic and always clean.** No landing-timing input, no
  botched-landing fail state.
- **Orbs fill multiplier slots on pickup**; a full stack fires the barrel
  section **by itself**. The slots are status readouts, never buttons.
- **Coins are collected by contact**, not by an action.
- There is no second input anywhere, at any scope tier, including Post-MVP
  (§11). No tap-equivalent, no lean-hold gesture, no double-lean, no shake.

### 0.5 Standing product constraints

**No IAP, no paid currency, no cross-session meta-progression or unlock web of
any kind — permanent product constraint**, not a v1 cut (§8.6, §11). Deleted
outright from the reference: the `TAP TO ACTIVATE` pre-run screen, the
`COIN BOOST ×28` / `SCORE BOOST ×20` consumables, and the persistent coin wallet.
Coins stay, purely as an in-run score component. In-run growth (the multiplier
stack, the difficulty ramp) and in-game progression (the crew ladder) are
**required-good** and specified in §8.

**2D only.** No 3D scene, no perspective projection, no pseudo-3D wave (§9.1).

**Illustrated environment art, never procedural canvas patterns.** The wave is a
painting, not a shader — this is the project's standing rule for environment
surfaces and the reference is a textbook example of it done right (§9.1, §9.6).

---

## 1. Vision

One enormous breaking wave at dawn, seen side-on, filling the lower two-thirds
of a wide frame. A boat drops **Wren** — a chibi-proportioned kid surfer, big
head, small body, short dark hair, coral-orange top — onto the shoulder, and she
rides it for as long as she can. She is pinned at ~25% of the screen width and
the wave scrolls past her right-to-left at a constant rate. **Her height on the
wave face is the entire game**: one continuous axis, free movement, no lanes.
Climb toward the curling lip at upper-left and you launch off it into automatic
aerials that spin out big slab-numeral rotation payouts while you do nothing at
all; drop toward the trough and you're safe but low, among the rocks and the
jellyfish. Coin arcs and multiplier orbs sit at specific heights on the face, so
"where should I be" is a risk/reward question rather than a pure safety
question. Fill the multiplier stack and the wave closes over you into a quiet,
dim green-blue barrel — kelp, drifting bubbles, coins strung through it — then
spits you back out onto the face. One continuous track, no load breaks, the
coastline changing around you as you go.

Target feel: **calm-but-fast, and the best-scoring moments are the ones where
you stand still.** Survival is the floor, skill is the ceiling. Reaction windows
are ~1.6 s wide, hazards are large and individually trackable with multi-body-
width gaps, and movement is momentum-y — ~3 s to cross the full face — so every
decision is one committed lean, never a stutter of corrections. It should read
as a hand-painted storybook morning that happens to be a scoring machine.

**Art-direction anchor (stage 4 does not own art direction, only points at it):**

- **Approved concept frames:**
  `pipeline/macro-briefs/approved/dawn-patrol-endless-point/concepts/`
  (`nano-banana-pro`, 16:9, prompt in full at `concepts/prompt.txt`). All four
  are deliberately composed as the **actual play framing** rather than as hero
  posters — player at ~25% x, lip at the left, hazards and a coin arc at
  readable heights on the face — so they double as a layout check for §5.1.
  - **`concept-03.png` is the single strongest anchor.** It is the only frame
    that renders the multiplier orb as a proper in-world purple token (`×1`
    disc) the way the reference does, and its face geometry is the clearest
    read of the diagonal this game is built on: curling white lip wall at the
    far left, a broad brushed teal-to-slate face sweeping down and to the right,
    a near-black breaching rock with a white foam collar sitting *in* the face,
    a deep-violet jellyfish silhouette further right and lower, and a gold coin
    arc curving down between them. Treat its palette, its hazard values, its
    coin-arc shape and its player scale as the target.
  - **`concept-01.png`** is the best read of the **crest/sky band** — pale dawn
    sky, soft parallax clouds, grey-violet sea stacks on the horizon — and of
    the player silhouette high on the face throwing spray. Take its background
    layering.
  - **`concept-04.png`** is the best read of the **lip curl and the barrel
    mouth** — the wave visibly tubing over the surfer with the foam shoulder
    blown out to the left. Use it for the barrel-section entry art and the lip
    treatment.
  - **`concept-02.png`** has the weakest hazard readability of the four — its
    jellyfish sits low against a busy multi-tone face and the rock is small and
    half-buried. Use it for **water-surface brushwork and foam texture only**,
    not for hazard placement or hazard value.
  - **One correction across all four:** the concept frames draw the face with a
    fairly shallow slope. In play the usable face band must be **tall enough**
    for the h-axis to be expressive (§5.1's band budget). Take the *painting*
    from the concepts; take the *geometry* from §5.1.
- **Reference report:** `pipeline/reports/WaveSurf.md` — its "Visual style
  notes" section is the art direction, and it is where the palette discipline
  below comes from.
- **Palette discipline is the load-bearing readability rule, not a mood note.**
  The entire frame lives in a narrow cool band — slate blue sky, teal-to-navy
  water, grey-violet sea stacks, off-white foam. **The only warm colours
  anywhere on screen are the gold coins and Wren's coral-orange top**, so the
  player and the reward are always instantly findable. Enforce this in asset
  review and in code (§9.6).
- **Hazards get a dedicated value slot.** The report's specific criticism of the
  reference is that blue-and-yellow fish on teal water is the frame's weakest
  contrast pairing. Here every hazard is **near-black or deep violet with a
  white foam collar** — a value slot that does not neighbour the water hue and
  does not compete with the warm slot.
- **This is the general track, not TMNT.** No TMNT reference anywhere, including
  in asset prompts. There is no `/Users/eladayzen/Documents/tmnt/` dependency
  for this game.
- **Asset pipeline:** `KOLBO_ASSET_PIPELINE.md` is ground truth for how art
  actually gets generated. §9.6 has the rules specific to this game.

---

## 2. Scope tiers

### POC — prove the lean mapping and the trim line, and A/B the fail state

The POC exists to answer three questions. If the first two answer "no," nothing
downstream matters.

1. **Does lean-left-to-climb read as surfing** to someone standing on the board
   who has not been told the mapping?
2. **Is neutral-trim-plus-deviation actually comfortable** across a 2–3 minute
   standing session — i.e. does the auto-trim genuinely remove the sustained-hold
   exertion the report flagged?
3. **Three-wipeout leash vs. one-hit-ends-it** — an explicit A/B, because the
   fail state is this design's invention and there is no evidence from the
   reference either way (§0.1, §5.8, §10).

Scope:

- One endless wave, **placeholder art** (flat painted bands are fine; the face
  rail and the band budget must be real).
- Lateral lean drives `h` continuously; auto-trim neutral line; constant scroll
  speed at the measured baseline; no difficulty ramp.
- **One hazard type** (the drifting jellyfish) at authored heights.
- **Both fail models behind a live toggle**, identical content, switchable
  mid-session without a reload.
- A raw time-based score counter and nothing else.
- **No** tricks, no coins, no orbs, no multiplier stack, no barrel, no zones, no
  crew ladder, no score card beyond a bare number.
- The **instrumentation panel** (§10, POC-6) — this is a POC deliverable, not a
  debug nicety; it is how questions 1–3 get judged rather than vibed.

### MVP — the complete loop as observed, and the smallest version worth shipping

- The **face rail geometry** and band budget at full height (§5.1).
- **Flat per-second base score** (§8.1).
- **Coin arcs** strung along the face (§5.5).
- The **orb → multiplier-slot stack** (×2 → ×3 → ×6) with radial drain timers
  (§5.6).
- **Automatic aerials off the lip** with rotation payouts and automatic clean
  landings (§5.4).
- The **inside-the-wave barrel section** fired automatically at a full stack
  (§5.7).
- **Four hazard types** — drifting jellyfish, breaching rock, drift timber, and
  the big telegraphed urchin-puffer — plus the **seabird trick target** (§6.2).
- **Five set-dressing zones** cycling along the one continuous track with no
  load break: open sea with sea stacks → rock arch → driftwood pier → tide-pool
  islet → rock-overhang tunnel (§5.9).
- A **difficulty ramp** on scroll speed and hazard density over the run, inside
  hard floors on reaction time and gap width (§5.3, §5.10).
- The **three-wipeout leash** (or whatever POC-7 decided) and a **score card**
  (§5.8, §7.3).
- The **crew ladder** — five named local surfers whose marks you climb through
  inside the game, with the reference's live remaining-gap readout (§8.3).
- **One character** (Wren).
- **Full art pass** per §9.6, including real illustrated wave/face/foam art —
  not procedural canvas patterns.
- **Score-card overlay satisfying the SDK's DOM contract** (§7.4).

### Post-MVP (backlog — not committed work)

More of the same kind of thing, bigger. None of it is meta or monetisation, and
none of it adds an input.

- **More zones**, plus a **day → dusk → night lighting cycle** and a rain/storm
  pass (the reference has one).
- A longer **rideable headland / beach-break stretch** where the face is sand
  and rock instead of water — pure set dressing along the same one axis, which
  the reference does.
- A **wider hazard and pickup vocabulary**: a station-keeping crab on a pier
  with the reference's `!` alert bubble, a kelp curtain, a lightning/speed orb.
- **Harder late-run hazard patterns** as the in-run ceiling, strictly inside the
  same reaction-time and gap floors — those floors are not a difficulty lever.
- **More crew marks** beyond the five.
- **Two or three alternate surfers** with slightly different trim feel (a higher
  `H_TRIM` and slower response, say), unlocked by hitting in-game score marks
  within this game. A handling trade, not a stat ladder.
- Hazards inside the barrel section (MVP's barrel is deliberately threat-free).
- Explicitly **not** in Post-MVP, ever: any real-money purchase, any currency,
  any unlock web spanning sessions or games, any second input, any trough fail
  state (§11).

---

## 3. Core loop

Scoped to MVP; inline notes mark POC-only simplifications and Post-MVP
deferrals.

1. A boat drops Wren onto the shoulder of one continuous, procedurally extended
   breaking wave. **POC:** she simply starts on the face, no boat.
2. The wave scrolls **right-to-left at a constant rate** — `SCROLL_BASE =
   864 px/s` in design space, a full screen width in ~2.2 s, exactly the
   measured reference rate (§5.2). Wren is held at a **fixed screen x of 0.25**.
   The camera never chases her horizontally and she has **no horizontal
   control**.
3. **Lean left climbs the face; lean right drops toward the trough.** Board
   neutral holds her at the mid-face trim line indefinitely (§0.3, §4).
   Everything else — dodging, collecting, launching — is a consequence of that
   one decision.
4. Hazards and pickups enter at the right edge at authored heights on the face
   and reach her x in **~1.67 s** at base speed (§5.3). Hazards are large,
   high-contrast and individually trackable, with multi-body-width gaps.
5. Contact with a hazard is a **wipeout**: a tumble, the multiplier stack lost,
   ~2 s of scoring lost, then the wave re-forms under her at the trim line. The
   **third** wipeout ends the run (§5.8). **POC:** A/B against one-hit-ends-it.
6. **Coin arcs** strung down and across the face are collected on contact and
   pay score × the current multiplier (§5.5, §8.1). MVP+.
7. **Multiplier orbs** collected off the face fill the three slots at the left
   edge, stacking ×2 → ×3 → ×6. Slots drain over time; the stack is lost on a
   wipeout (§5.6). MVP+.
8. **Carry enough climb into the lip and she leaves the wave.** Airborne time
   converts automatically into rotation payouts — 360 / 720 / 1080 / 1440 …,
   drawn as big slab numerals in world space, paid at the current multiplier.
   **The player does nothing while airborne.** These are the highest-scoring
   moments *and* the rest beats (§5.4). MVP+.
9. **Landing is automatic and always clean** — she re-enters the face at the
   trim line with a short grace window (§5.4). MVP+.
10. Hitting the **seabird** while airborne is a bonus, not a hazard — the one
    "hazard silhouette that is actually a target" wrinkle the reference
    arguably shows (§6.2). MVP+.
11. **Topping the stack fires the barrel section by itself**: the wave closes
    over her into a dim green-blue interior of kelp and drifting bubbles with
    coins strung through it, at ×6 and with no hazards, then she pops back out
    onto the face and the stack resets (§5.7). MVP+.
12. The coastline changes around her continuously — five **set-dressing zones**
    cycling along one endless track with **no load break and no level
    transition** (§5.9). MVP+.
13. **Difficulty ramps** over the run: scroll speed and hazard density climb
    toward hard caps that never violate the reaction-time or gap floors
    (§5.10). MVP+.
14. Passing a **crew mark** swaps the `TOP RUN` portrait to the next rival and
    banners the pass. Five marks, all inside this game (§8.3). MVP+.
15. Third wipeout → tumble beat → **score card** (time ridden, coins, best
    trick, highest multiplier, crew marks passed, total) → restart. Nothing
    carries between runs except a display-only session best (§8.6).

POC runs steps 2–5 plus a raw score counter, forever.

---

## 4. Controls

**Mode: Analog.** The game reads the raw tilt vector itself rather than
receiving synthetic arrow-key presses. `GOBALANCE_SDK.md` is stage 4's ground
truth for wiring it; this section owns the design decision and the mapping.

**Why analog, not digital.** The core loop is a single continuous positioning
problem and nothing else. `h` — the surfer's height on the wave face — is a
free real number the player is expected to place *precisely*, between a coin arc
and a rock, a little above a jellyfish, hard at the lip for a launch or eased
back to trim. There are no lanes, no slots, no discrete steps, and no one-shot
actions anywhere in the design (§0.2, §0.4). Digital mode's on/off synthetic
keys would quantize exactly the signal this game is made of: "ease up two-thirds
of the face and hold" would become "ramp toward the lip until you let go," which
destroys both the trim line and the launch-power reading. It would also make the
brief's explicit *free continuous movement, no discrete lanes* unimplementable.
This is the same reason `Astro_Tunnel` uses analog mode.

**Exact mapping.**

| Input | Reads as | Behaviour |
|---|---|---|
| Lateral tilt (`x`) | Signed analog **lean**, `[-1, 1]` after a **0.10 deadzone**, then smoothstepped so small leans are gentle | Sets the *target* height on the face: `targetH = clamp(H_TRIM - lean * H_SPAN, 0, H_LAUNCH)`. Sign convention: **lean toward the player's left is negative `x` and must map to climbing.** Verify the sign on real hardware at POC-2 before anything else is tuned. |
| Forward/back tilt (`y`) | **Not read. At all.** | There is no code path in this game that touches the `y` component. Not a nudge, not a menu, not a debug shortcut (§0.2, §9.5). |

**The height model — a first-order lag toward a leaned target.** This is how
§0.3's trim line and the report's measured momentum both fall out of one
equation:

```
targetH = clamp(H_TRIM - lean * H_SPAN, 0, H_LAUNCH)
dh/dt   = clamp( (targetH - h) * H_RESPONSE,  -H_RATE_MAX, +H_RATE_MAX )
```

| Constant | Value | Rationale |
|---|---|---|
| `H_TRIM` | **0.45** | Board-neutral resting line, slightly below mid-face so climbing reads as the effortful direction and the trough is a short drop away. |
| `H_SPAN` | **0.55** | Full left lean targets the lip (`0.45 + 0.55 = 1.00`); full right lean targets below the trough and clamps at `0`. The asymmetry is intentional — the trough is easy to reach and the lip takes commitment. |
| `H_RATE_MAX` | **0.34 /s** | Full-face traverse in ~2.9 s — the report's **measured ~3 s**. |
| `H_RESPONSE` | **3.2 /s** | Gives the momentum-y, non-twitchy feel the report measured; effective full traverse lands ~3.1 s including the lag tail. |
| `H_LAUNCH` | **0.90** | The face clamp. You cannot sit at the lip — reaching it launches you (§5.4). |

- **Release behaves correctly for free.** `lean = 0` → `targetH = H_TRIM` → she
  eases back to the trim line over ~1.8 s from the lip. No separate "auto-trim"
  system, no gravity term, nothing for the player to fight (§0.3).
- **Do not add a velocity/inertia integrator on top of this.** The lag *is* the
  momentum. A second-order model would make the lip-launch power reading
  ambiguous and make the trim line overshoot.
- **Do not quantize `h`**, snap it to bands, or add a magnetic pull toward
  pickups. Continuous position is the mechanic (§0.2).
- **Airborne: input is ignored entirely.** `lean` is not read while airborne;
  the arc and the spin are fully scripted (§0.4, §5.4).
- **Desktop dev fallback:** keyboard left/right writes into the *same* internal
  `lean` scalar (ramping to ±1 over 0.25 s so it approximates a lean rather than
  a step). It is a dev convenience, not a second input path. Every tuning number
  in this document is a **starting** value to be re-validated on-device — a
  keyboard will systematically overstate how easy fine height control is.
- **Never also listen for the host's synthetic arrow keys** while reading the
  analog vector; double-applying the input makes the surfer over-steer. This
  game needs analog forwarding, not digital.
- **There is no pause input on the board.** Pause is a screen-chrome button only
  (§7.1).

---

## 5. World / mechanics

### 5.1 Frame layout and the face rail — the band budget

Everything is authored against a fixed design space of **1920 × 1080** (16:9),
scaled and letterboxed to the real viewport. All coordinates and speeds below
are in that space.

The wave is a **diagonal**, so the playfield is not an axis-aligned rectangle.
Model it as a **face rail**: two authored curves spanning the frame width, and a
normalized height parameter `h` between them.

```
faceY(x, h) = lerp( troughY(x), crestY(x), h )       // h = 0 trough, 1 crest/lip
```

| Curve | Left edge (`x=0`) | Player column (`x=0.25`) | Right edge (`x=1.0`) |
|---|---|---|---|
| `crestY(x)` — top of the usable face | `0.20` | `0.235` | `0.30` |
| `troughY(x)` — bottom of the usable face | `0.92` | `0.955` | `1.00` |

- Authored as two cubic curves (not straight lines) with a gentle downward sag
  toward the right, so the face reads as a real wave rather than a wedge.
  **`/data/faceRail.js` owns both curves and nothing else defines the geometry.**
- **Usable face height at the player column: `0.955 − 0.235 = 0.72` of frame
  height (778 px).** This is deliberately taller than the concept frames draw
  it (§1's correction) — the h-axis needs the room to be expressive.
- `h` is the **only** spatial state the player has. Every entity in the world is
  positioned as `(worldX, h)` and rendered through `faceY`, so nothing ever
  needs to know about screen y directly.

| Band | Extent | Rule |
|---|---|---|
| **Sky / crest band** | `y < crestY(x)` | Parallax clouds, sea stacks, the seabird, and the airborne player. No face hazards or pickups ever render here. |
| **The lip wall** | Left of `x = 0.12`, above `troughY` | Curling whitewater. Not a boundary and not a hazard — it is the launch ramp (§5.4). Nothing spawns in it. |
| **The face** | `h ∈ [0, 1]` between the rails | The entire usable playfield. |
| **Sub-trough** | `y > troughY(x)` | Deep water, foam wash, painted only. Nothing is placed here and the player cannot reach it. |

Horizontal budget:

- **Player column: fixed at `x = 0.25`.** Never changes, at any tier.
- **Spawn edge: `x = 1.06`** (just off-frame right), so entities fade in rather
  than pop.
- **Despawn: `x < −0.10`.**
- **HUD-exclusion rects, enforced in code (§9.5):** the top-left score plate
  (`x ∈ [0, 0.26]`, `y ∈ [0, 0.14]`), the top-right `TOP RUN` panel
  (`x ∈ [0.72, 1.0]`, `y ∈ [0, 0.20]`), and the left-edge multiplier slots
  (`x ∈ [0, 0.075]`, `y ∈ [0.38, 0.66]`). **No in-world object may pass behind
  these rects.** The report's one explicit HUD criticism of the reference is
  that its `TOP RUN` panel overlaps a bamboo pier and a pelican; we do not
  repeat it. Practical rules: background sea stacks and zone props are placed
  below/outside these rects; the seabird's flight path avoids the top-right
  rect; and because the **airborne player legitimately travels through the sky
  band**, the `TOP RUN` panel **fades to 25% opacity over 0.2 s whenever the
  airborne player's bounding box comes within 80 px of it**, restoring on
  landing. That fade is the one sanctioned exception.

### 5.2 Scroll, and the fixed player column

- `SCROLL_BASE = 864 px/s` — the report's **measured** 0.45 screen-widths/second
  (`0.45 × 1920`). A full screen width in 2.2 s.
- World x advances leftward at the current scroll speed; the face rail and the
  wave silhouette are **static in screen space**. What scrolls is the *texture*
  (UV offset on the painted face strips), the foam, the props, the background
  parallax layers and the entity world positions. The wave shape itself never
  moves — this is what makes the whole thing cheap and stable (§9.1).
- Parallax: sky `0.06×`, distant sea stacks `0.18×`, mid headland `0.42×`,
  face texture `1.0×`, near foam / spray `1.15×`.
- **Distance** = accumulated scrolled world pixels. It drives the zone cycle
  (§5.9) and the difficulty ramp (§5.10), and is displayed nowhere — the score
  is the readout (§8.1).

### 5.3 The pacing contract — reaction floor, gap floor, density caps

This is the numeric heart of the design and the thing most likely to be
accidentally violated during content authoring. **All of it is asserted in code
at boot over the authored data** (§9.5), not just documented.

**The reaction floor.** An entity spawning at `x = 1.06` reaches the player
column at `x = 0.25` after travelling `0.81` of the frame width:

```
reactionTime = 0.81 × 1920 / scrollSpeed
             = 1555 / 864  =  1.80 s  at base speed
             (the report's measured ~1.6–1.7 s from the true right edge; we
              spawn slightly off-frame, so the on-screen budget matches it)
```

**`REACTION_FLOOR = 1.15 s` is a hard floor.** It bounds the scroll ramp:

```
SCROLL_MAX = 1555 / 1.15  =  1352 px/s     // absolute ceiling, never exceeded
SCROLL_CAP = 1240 px/s                      // the tuned ramp ceiling (§5.10)
```

The difficulty ramp raises scroll speed **only** up to `SCROLL_CAP`. Nothing —
no zone, no late-run pattern, no Post-MVP content — may raise it past
`SCROLL_MAX`, and nothing may shorten reaction time by any other means (no
entity moves leftward faster than the scroll except the urchin-puffer's
telegraphed close, §6.2, which has its own longer budget).

**The gap floor — this game's equivalent of a bullet-hell aisle.** At every
moment, the set of hazards about to cross the player column must leave a
**continuously traversable clear band in `h` of at least**:

```
H_GAP_MIN = 0.22        // ≈ 171 px of face at the player column, ~6× the player's h-hitbox
```

- The gap must be **reachable**. At the moment a hazard group becomes visible,
  the nearest edge of its clear band must satisfy:
  `|nearestGapEdge − playerH| ≤ H_RATE_MAX × (reactionTime − 0.30 s)`.
  At base speed that is `0.34 × 1.50 = 0.51` of the face — so **no authored
  hazard group may ever require a move of more than 0.50 of the face height**.
  A group that guarantees a gap the player physically cannot reach is a
  violated gap.
- **Never split the face into two gaps neither of which is reachable.** A
  group may offer two gaps only if at least one is reachable per the rule above.
- Hazards that *move* their gap (the drifting jellyfish, the urchin-puffer's
  close) may move it no faster than **0.17 /s** — half the player's traverse
  rate — so following it is a committed lean, not a chase.
- The reference's densest sampled moment was **six obstacles at four distinct
  heights with multi-body-width gaps**. That is the authored ceiling, not a
  starting point.

**Density caps.**

| Cap | Value |
|---|---|
| Simultaneous hazards on screen | **6** |
| Distinct `h` bands occupied by hazards at once | **4** |
| Simultaneous urchin-puffers | **1** |
| Minimum world-x gap between consecutive hazard groups | **0.9 s of scroll** |
| Minimum face-height of any hazard's collision band | **0.06** (large, trackable — never a pinprick) |
| Simultaneous pickup strings (coin arc + orb counts as two) | **3** |

Trade hazard *count* for hazard *size*: dense-looking but individually
trackable. If a pattern needs more bodies to feel dangerous, it is the wrong
pattern.

**Telegraphs.** Any hazard that does anything other than ride the scroll
passively gets a telegraph: the urchin-puffer holds station at `x ≈ 0.92` with a
red `!` alert bubble for **1.5 s** before it closes (the reference's own crab
telegraph, reused). Nothing closes on the player without one.

**The stand-still rule, stated as a testable assertion.** For every authored
hazard group, at every difficulty step: *a player who holds `h = H_TRIM` and
never leans at all must survive at least 45 s of the base-difficulty spawn
stream without a wipeout.* The trim line is survivable by design (§0.3); this is
how that stops being a slogan. Checked statically where possible and explicitly
on §10's on-device pass where not.

### 5.4 Aerials — automatic, and the scoring ceiling

**Launch.** When the surfer's `h` reaches `H_LAUNCH = 0.90` while climbing, she
leaves the wave off the lip. No input, no timing window, no button.

**Launch power** is how hard she was climbing as she got there:

```
climbAvg = mean(dh/dt) over the preceding 0.40 s, clamped to [0, H_RATE_MAX]
power    = climbAvg / H_RATE_MAX                                   // [0, 1]
airtime  = lerp(AIR_MIN, AIR_MAX, power)
```

| Constant | Value |
|---|---|
| `AIR_MIN` | **1.10 s** — a lazy drift over the lip |
| `AIR_MAX` | **3.40 s** — a full-commitment vertical climb into the lip |
| `SPIN_RATE` | **660 °/s** |
| Launch cooldown | **0.6 s** after landing before a new launch can trigger |

**Rotation and payout.** She spins at a constant rate for the whole arc, and the
payout is the completed rotation, exactly as the reference's numerals read:

```
degrees = floor( airtime × SPIN_RATE / 360 ) × 360        // 360, 720, 1080, 1440, 1800, 2160
payout  = degrees × currentMultiplier                     // ×1 / ×2 / ×3 / ×6
```

This is the reference's own arithmetic recovered from the observed payouts: a
720 at ×6 is 4,320, and a 4,320-class trick at ×6 again is 25,920 — both numbers
the report measured off-screen. An airtime below one full rotation pays nothing
and shows nothing; `AIR_MIN` is set so that never happens from a genuine launch.

- The payout is drawn as **big chunky white slab numerals with a soft glow,
  floating in world space** under the surfer, as the reference does.
- The airborne player is wrapped in a **large translucent bubble/lens with a
  soft rim** that dims the background — the reference's very clean way of saying
  "something special is happening" without a full-screen flash (§7.2).

**The arc.** A scripted parabola in the sky band: she leaves the lip at
`x = 0.25` moving up and slightly left, peaks at `y ≈ 0.06 + 0.10 × (1 − power)`
(harder launches go higher), and comes back down to the face. Her screen x drifts
right during the arc by up to `0.10` and eases back to `0.25` on landing — the
camera does not move, she does. She never leaves the frame.

**Landing is automatic and always clean** (§0.4). She re-enters the face at
`h = H_TRIM` with:

- **0.8 s of hazard immunity** with a visible spray-burst and a brief shimmer,
  so a hazard that happened to arrive at the landing instant is never a
  gotcha-wipeout for a reward the player just earned.
- Board input resumes immediately on landing — `targetH` snaps to whatever the
  current lean says, and the lag carries her there.
- **No landing-timing input, no botched landing, no failed trick.** This is a
  design commitment, not an observation (§0.4).

**Ergonomic note for tuning:** airborne stretches are **rest beats** — the board
is at neutral, nothing is asked of the player, and these are the highest-paying
moments in the game. That pacing is the point for an exertion product. When
tuning hazard density, *do not* compensate for the relief by making the face
harder around launches; the relief is the feature.

### 5.5 Coins

- Strung in **arcs and lines of 5–9** along the face, the Sonic-style curving
  trail the report saw in the reference's frame 2.
- Authored as a start `h`, an end `h`, a curve shape (arc-up, arc-down, straight
  diagonal, shallow S) and a world-x span. The whole string sits inside a
  single traversable sweep — **an arc may never span more than `0.45` of the
  face height**, so collecting it is a lean, never a sprint.
- **Collected on contact**, no input (§0.4). Generous collection radius:
  `0.045` in `h` and 34 px in x, so a near-miss is a hit.
- **Gold — one of only two warm colours on screen** (§1). They are the primary
  visual lure and the reason to leave the trim line.
- Value: **250 each × current multiplier** (§8.1).
- **Placement is the risk/reward design.** Arcs are deliberately routed *past*
  hazards — over a rock, under a drift timber, alongside a jellyfish — so
  "where should I be" is a risk question. But an arc's route must always leave
  `H_GAP_MIN` clearance from every hazard it passes (§5.3): the player should be
  able to take the whole arc cleanly with good control, not be forced to choose
  between a coin and a wipeout.
- **A coin is not currency.** There is no wallet, nothing persists, nothing is
  spent (§8.6).

### 5.6 Multiplier orbs and the slot stack

Small circular purple in-world tokens, per `concept-03.png`'s `×1` disc
treatment — the closest of the four concepts to the reference's orbs.

- **Three slots** at the left edge, mid-height, drawn as circular rings with
  radial sweep timers, exactly as the reference's HUD does.
- Each orb collected fills **the next empty slot**, immediately on pickup, with
  no input (§0.4).

| Slots filled | Multiplier | Notes |
|---|---|---|
| 0 | **×1** | Base |
| 1 | **×2** | |
| 2 | **×3** | |
| 3 | **×6** | Fires the barrel section **by itself** (§5.7) |

- **Drain.** The stack holds for `SLOT_HOLD = 14 s` from the last orb collected,
  shown as the radial sweep on the highest filled slot. When the sweep empties,
  **one** slot drops (not the whole stack) and the timer restarts. So the
  pressure is "keep feeding it," not "one miss and it's gone."
- **The stack is lost entirely on a wipeout** (§5.8) and reset to 0 on exiting
  the barrel (§5.7).
- Orb spawn rate: **one per ~11 s** at base difficulty, scaling to one per ~8 s
  late. Orbs are placed at deliberately awkward heights — near the lip or deep
  in the trough — more often than coins are, since they are the ceiling's key.
- **The slots are status readouts, never buttons.** Nothing about them is
  pressable, targetable or selectable, and no input in this game can affect
  them. This matches what the report actually observed and it is a hard rule
  (§0.4).
- The multiplier applies to **base score rate, coins, and trick payouts** — all
  three (§8.1).

### 5.7 The barrel section

Filling the third slot immediately begins the barrel. It is the reference's
inside-the-wave bonus, and it is also this game's second rest beat.

- **Entry (1.2 s):** the lip closes over the player, the face art cross-fades to
  the interior, the outside audio ducks. Non-interruptible; the player keeps
  control of `h` throughout.
- **Interior:** a dim green-blue chamber of kelp fronds and drifting bubbles,
  with a sandy floor and a rocky ceiling — the same `h` axis, now bounded by the
  tube's inner wall instead of the face rail. `faceY` is swapped for a second
  authored rail pair (`/data/barrelRail.js`); nothing else in the movement model
  changes.
- **Duration: 9 s.**
- **Multiplier is locked at ×6** for the whole section and the base score rate
  applies.
- **Coins strung through it** in long serpentine runs across the full interior
  height — the section's reward is routing, and there is a lot of it.
- **No hazards at MVP.** This is deliberate: it is the quiet, high-value beat,
  and for an exertion product a repeated no-threat stretch that still rewards
  control is exactly right. (Post-MVP may add gentle kelp curtains — §2.)
- **Exit (1.0 s):** the wave opens, she pops back out onto the face at
  `h = H_TRIM` with the standard 0.8 s immunity. **The stack resets to 0** and
  the multiplier drops to ×1.
- **Barrel cooldown: 20 s.** A fourth orb collected during cooldown still fills
  slots normally; the barrel just won't re-fire until the cooldown clears.
- **No input triggers, enters, extends or exits the barrel** (§0.4).

### 5.8 The fail state — **this is the designer's invention, not the reference**

> **Flagged, and kept flagged.** The report is blunt that this is its biggest
> hole: **no crash, no wipeout, no game-over, no results screen and no menu
> appears anywhere in the 108 s of footage.** The score is monotonic throughout
> and the recorded player simply never died. Collision rules are equally
> unknown. Everything in this section is invented to fill that hole. Treat it as
> the most tunable part of the design, and treat POC-7 as a real experiment
> rather than a formality.

**One fail source only: contact with a hazard.** Rocks, drift timber,
jellyfish, the urchin-puffer. Nothing else can end a run.

- **The lip is a launch ramp, not a boundary.** You cannot fail off the top.
- **There is no fail at the bottom of the face** (§0.3, §11). The trough is safe
  — low-scoring and hazard-dense, but safe.
- **The seabird is a trick target, not a hazard** (§6.2).

**The three-wipeout leash (MVP default).**

| On a wipeout | |
|---|---|
| Tumble animation | **1.6 s**, board input ignored, the wave visibly re-forming |
| Base score | **Suspended for the tumble** — ~2 s of scoring lost |
| Multiplier stack | **Lost entirely**, all slots cleared |
| Recovery | She resumes at `h = H_TRIM` with **1.5 s of hazard immunity** |
| Difficulty ramp | **Unchanged** — a wipeout does not rewind the run's progression |
| Leash | **Third wipeout ends the run** → score card (§7.3) |

Rationale is the walk-up-turn product reality — a first-timer standing on a
physical board should not have their single turn end at 15 seconds — **not** a
lives economy. There are **no revives, no continues, no currency, nothing
purchasable, ever** (§8.6).

**POC-7 A/B: three-wipeout leash vs. one-hit-ends-it.** One-hit is the more
traditional endless-runner answer and might simply feel better on the board.
Both are built behind one config value (`FAIL_MODEL ∈ {'leash3','onehit'}`),
switchable mid-session without a reload. The decision is made on real hardware
against §10's acceptance criteria and **written down before MVP work starts**.
Keep the losing path; it is one flag.

### 5.9 Zones — set dressing along one endless track

Five zones cycle in order along the single continuous track, forever. **No load
break, no level transition, no loading screen, no pause in the scroll** — this
is how a single endless track stays interesting and it is cheap.

| # | Zone | What changes |
|---|---|---|
| 1 | **Open sea** | Distant grey-violet sea stacks, empty horizon, high sky. The default and the POC's only look. |
| 2 | **Rock arch** | A large arch silhouette passes through the mid parallax layer; sea stacks crowd closer. |
| 3 | **Driftwood pier** | A rickety lashed-timber pier extends into frame from above right, coins strung along its underside. |
| 4 | **Tide-pool islet** | A low grass-topped rock islet with a palm in the mid layer; scattered tide-pool glints. |
| 5 | **Rock-overhang tunnel** | A dark rock ceiling fills the top of the frame; the sky band narrows and the light goes cool. The one zone that visibly changes the sky band. |

- **Zone length: 22 s of scroll each** (measured in distance, not time, so it is
  ramp-invariant: `ZONE_LENGTH = 22 × SCROLL_BASE = 19,008 world px`).
- **Cross-fade over 3 s** between zones on the background and prop layers.
- **Zones change the background, prop and lighting layers only.** They never
  change the face rail, the hazard rules, the gap floor, the scroll speed or the
  spawn tables. Difficulty is authored entirely independently of set dressing
  (§5.10) — this separation is what makes Post-MVP zones pure content.
- A low-opacity zone-name caption fades in bottom-left for 1.5 s on entry.
  Cheap, and it makes the variety legible.
- **Zone 5's overhang must not intrude into the airborne arc's peak** (`y = 0.06`)
  — the ceiling silhouette bottoms out at `y = 0.04` and is scenery, never
  collidable. Nothing in this game collides except face hazards.

### 5.10 The difficulty ramp

The report explicitly could not resolve the shape of the reference's ramp
(*"anything about the shape of a run over time — difficulty ramp, speed
increase, enemy density curve — is not resolvable from this"*). This ramp is
therefore ours, built to be safe by construction against §5.3's floors.

Driven by **elapsed ride time** `t` (excluding tumbles and the barrel), ramping
over `RAMP_DURATION = 150 s` and then holding flat forever:

| Knob | `t = 0` | `t = 150 s+` | Floor it must respect |
|---|---|---|---|
| Scroll speed | `864 px/s` | `SCROLL_CAP = 1240 px/s` | Reaction time never below `REACTION_FLOOR = 1.15 s`; `SCROLL_MAX = 1352` is never reached |
| Hazard group interval | `2.8 s` | `1.35 s` | Never below the `0.9 s` minimum group gap (§5.3) |
| Max hazards per group | `2` | `4` | Never above the 6-on-screen / 4-band caps |
| Urchin-puffer frequency | never before `t = 25 s` | one per ~30 s | Never more than 1 at a time |
| Orb interval | `11 s` | `8 s` | — |
| Coin arc interval | `6 s` | `4.5 s` | — |

- **Ramp on speed and density only.** The ramp never narrows `H_GAP_MIN`, never
  shortens a telegraph, never shrinks a hazard, never adds a required move
  larger than `0.50` of the face, and never touches the reaction floor. **Those
  four are floors, not levers**, at every tier including Post-MVP.
- **First 20 seconds are a deliberate on-ramp:** jellyfish only, one at a time,
  at heights near the trim line, so a walk-up player learns the lean mapping
  before being asked anything. This is the closest thing the game has to a
  tutorial and it must not be tuned away.
- **No dynamic difficulty adjustment at MVP.** The ramp is deterministic in `t`.
  (A quiet easing after repeated short runs is a reasonable Post-MVP idea but is
  not committed.)

---

## 6. Entities

Every world entity is `(worldX, h, ...)` and renders through `faceY` (§5.1).
Nothing carries a screen y of its own.

### 6.1 Player — Wren

- Chibi-proportioned kid surfer: big head, small body, large expressive eyes,
  short dark hair, **coral-orange top** (one of the frame's only two warm
  colours, §1). Board under her, spray plume behind her.
- **Fixed at screen `x = 0.25`.** No horizontal control, ever (§0.1).
- State is one scalar `h` plus a small state enum:
  `riding | airborne | tumbling | barrelEntry | barrel | barrelExit`.
- **Collision hitbox is small and generous:** `±0.035` in `h` (a band of `0.07`,
  ~54 px at the player column) and `±26 px` in x — far smaller than the drawn
  sprite. This is the standard fairness affordance and it matters more than
  usual here, because fine height control on a board is expensive. **Do not
  scale the hitbox to the art.**
- **Carve animation is the mapping's tutorial** (§0.2). Three sprite states plus
  neutral:
  - **Trim** (neutral lean) — upright, relaxed, board flat.
  - **Climb** (lean left) — weight shifted, board angled *up the face*, spray
    thrown downslope. Must read as "going up-left."
  - **Drop** (lean right) — crouched, board angled down the face.
  - Blend/lerp between them by lean magnitude with a small hysteresis so the
    sprite doesn't strobe at the deadzone edge.
- **Airborne** — separate sprite set, rotated at runtime by the spin (§5.4), no
  hand-authored spin frames. Wrapped in the translucent lens (§7.2).
- **Tumbling** — a single wipeout sprite tumbled by runtime rotation plus a
  foam/spray burst. 1.6 s (§5.8).
- **Barrel** — reuses the riding set with an interior light tint.
- One character at MVP. Alternate surfers are Post-MVP and are a **trim-feel
  trade** (`H_TRIM` / `H_RESPONSE`), not a stat ladder (§2).

### 6.2 Hazards (4 types at MVP) and the one trick target

All hazards share the **dedicated value slot: near-black or deep violet, with a
white foam collar where they meet the water** — a value band that does not
neighbour the water hue and does not compete with the warm slot (§1).

| Type | Occupied `h` band | Motion | Role |
|---|---|---|---|
| **Drifting jellyfish** | `0.08` tall, small silhouette | Rides the scroll; drifts slowly in `h` at ≤ `0.06 /s` | The common filler. One clean lean to clear. The POC's only hazard. |
| **Breaching rock** | **`0.20` tall**, narrow in x | Static in world space, rides the scroll only | Tall and narrow — go clearly over or clearly under, decide early. Near-black wedge with a white foam collar, per `concept-03.png`. |
| **Drift timber** | **`0.07` tall**, **wide in x** (≈ 0.9 s of scroll) | Static in world space | The complement of the rock: a thin band you must be clearly above or below *for a sustained stretch*. Teaches holding a line rather than dodging. |
| **Urchin-puffer** | **`0.26` tall**, large body | **Holds station at `x ≈ 0.92` for 1.5 s with a red `!` alert bubble**, then closes toward the player column at `1.35 ×` the scroll speed while drifting in `h` at ≤ `0.17 /s` | The telegraphed set-piece. Its total budget from first appearance to contact is **≥ 2.6 s** — longer than the base reaction floor, because it moves. Max one at a time. Deep violet with white spines. |

- All four are **lethal on contact** — one contact model, no damage tiers, no
  slowing hazards. The report could not tell which the reference used; a single
  uniform rule is the legible choice and it keeps the fail state readable
  (§5.8).
- **Every hazard is large, high-contrast and individually trackable.** The
  minimum collision band is `0.06` of the face (§5.3). No hazard is ever smaller
  than the player's sprite.
- Hazards are placed by **group templates** in `/data/hazardGroups.js`, each
  declaring its occupied bands so the validator can check the gap floor
  statically (§9.5). Groups, not individual spawns, are the authoring unit.

**The seabird — a trick target, not a hazard.**

- A large white seabird crosses the **sky band** on a shallow arc, well above
  `crestY`. On the face it is **never collidable** and never a threat — it is
  scenery.
- If the **airborne** player's bounding box intersects it, it tumbles out of
  frame and pays a **+2,500 × multiplier bonus plus 360° of bonus rotation**
  added to that trick's payout.
- This is the reference's own reading — the report's frame 13 shows a pelican
  tumbling out of frame while a 25,920 payout flashes, i.e. it was hit *as a
  target*, not avoided — and it is the only collision the footage arguably does
  show. It is the one wrinkle that rewards reading the sky during a launch.
- Spawn: one per ~40 s, and **only** at heights the airborne arc can actually
  reach.

### 6.3 Pickups

| Type | Effect | Placement |
|---|---|---|
| **Coin** | +250 × multiplier | In arcs/lines of 5–9 (§5.5) |
| **Multiplier orb** | Fills the next slot (§5.6) | Singly, ~1 per 11 s, at deliberately awkward heights |

Both are collected by contact with no input. Both spin/pulse at runtime from a
single static sprite each — no authored animation frames (§9.6).

### 6.4 Non-combat entities

- **Zone props** — sea stacks, the rock arch, the pier, the islet, the tunnel
  overhang. Parallax scenery, **never collidable**, never in a HUD-exclusion
  rect (§5.1, §5.9).
- **Ambient** — spray particles off the board, foam wash along the trough,
  drifting bubbles in the barrel, a drifting lens-flare disc across the face
  (the reference does this; it is cheap and adds depth), hand-drawn sunlight
  streaks refracting through the lip.

---

## 7. UI / HUD

DOM/CSS overlay on top of the game canvas — not drawn into the render layer.
Keeps text crisp and updates cheap. Visual idiom taken directly from the
reference: **dark translucent slate plates with soft rounded corners and cream
slab-serif numerals.**

### 7.1 In-run HUD

- **Top-left, two stacked slate plates:**
  - Row 1: **score**, cream slab numerals, counting continuously.
  - Row 2: **coin count** for this run, with a small gold coin glyph.
    **Explicitly labelled in code and comments as a run statistic, not a
    wallet** — it does not persist, cannot be spent, and has no balance
    semantics (§8.6). The reference's hexagonal currency tokens are **not**
    reproduced; they read as a wallet and this is not one.
  - Row 3 (small): **three wipeout pips** — small board silhouettes, unfilled as
    they are spent. Absent entirely when `FAIL_MODEL = 'onehit'`.
- **Top-right: the `TOP RUN` panel.** Label, a framed portrait of the current
  crew rival, and **the remaining gap to their mark, ticking down live as you
  earn** (§8.3). This is the report's single best measured finding about the
  reference and it is the reason the panel survives the currency cull.
  Beside it: **Pause** and **Back** controls per the repo's HUD chrome
  convention (Back is a plain `&times;` at `id="gb-back"`, Pause to its left).
  The panel obeys §5.1's exclusion rect and its airborne-fade exception.
- **Left edge, mid-height: the three multiplier slots.** Circular rings with
  radial sweep drain timers; filled slots show `×2` / `×3` / `×6` in the same
  slab numerals. Status readouts only (§5.6).
- **World-space payouts:** trick rotations as **big chunky white slab numerals
  with a soft glow**, floating under the surfer and drifting up as they fade.
  Coin pickups get small `+250` pops, capped at 8 concurrent so they never
  become a second visual layer.
- **Banners:** a single centred slate band in the sky band at `y ≈ 0.14` —
  crew-mark passes, barrel entry, zone names (bottom-left caption instead for
  zone names). **Single-slot queue**, one at a time, minimum 0.9 s each, queue
  depth 3, oldest non-critical dropped on overflow. Two banners can never
  collide; this is a code invariant, not a timing coincidence.
- **The HUD never enters the face.** Everything above lives in the exclusion
  rects at the corners and the left margin (§5.1). The centre of the frame —
  where the player is reading hazards — stays clear.

### 7.2 In-world presentation cues

Threat and reward legibility is carried by the **playfield**, not the bar:

- The **translucent bubble/lens** with a soft rim around the airborne player,
  dimming the background — the reference's clean "something special is
  happening" device, and much better than a full-screen flash.
- The **red `!` alert bubble** over the urchin-puffer during its station-keeping
  telegraph (§5.3, §6.2).
- **Warm-colour discipline** doing the work: gold coins and Wren's coral top are
  the only warm things on screen, so the player and the reward are always found
  instantly (§1).
- The barrel's **light change and audio duck** as the wave closes over.

A player watching the middle of the screen should never need to check a corner
readout to know what is about to happen.

### 7.3 Screens

- **Title** — key art, one start affordance. Must reach a playable or countdown
  state on load **without requiring a key press** (there is no board button).
- **Drop-in beat** — the boat drops Wren onto the shoulder, ~2 s, non-blocking,
  auto-advancing on its own timer. **POC:** skipped; she just starts riding.
  There is emphatically **no pre-run consumable/boost screen** — that is the
  reference's `TAP TO ACTIVATE` currency prompt and it is deleted (§0.5).
- **Score card** — time ridden, coins collected, **best trick** (the largest
  single rotation payout), **highest multiplier reached**, **crew marks
  passed**, and the total. Restart control. A **12 s auto-timeout back to
  title** so a walk-up queue doesn't stall on an abandoned card.

### 7.4 Score-card overlay contract

Must satisfy the SDK's overlay DOM contract — **`GOBALANCE_SDK.md` is ground
truth** for the exact ids and behaviour (the Unity host synthetically clicks the
restart control while the overlay is visible). Do not invent a different
structure for it.

---

## 8. Scoring / progression

### 8.1 Score

**Base score is time, not skill — survival is the floor, skill is the ceiling.**
That structure is lifted directly from the reference and is the honest shape for
this genre.

| Source | Value |
|---|---|
| **Base rate** | **1,000 points/second** while riding, × current multiplier |
| **Coin** | **250** × multiplier |
| **Trick** | **rotation degrees** × multiplier (360 / 720 / 1080 / 1440 / 1800 / 2160) |
| **Seabird (airborne hit)** | **2,500** × multiplier, plus 360° added to that trick's rotation |
| **Barrel** | No bonus of its own — its value is the locked ×6 on base rate and its dense coin routing (§5.7) |

- Base score **does not accrue** during the 1.6 s tumble (§5.8). It **does**
  accrue while airborne and in the barrel.
- **On the base rate:** the report *measured* the reference at exactly
  1,950 pts/s, but that figure is `65 × 30`, where the `×30` is an unexplained
  persistent global multiplier the report could never account for and which
  smells like the kind of account-level meta value this product does not have.
  We take the *shape* (a flat per-second rate) and drop the unexplained factor,
  rounding to a clean **1,000/s**. A 120 s run with reasonable multiplier uptime
  lands around 200k–400k, which is the right order of magnitude for the crew
  marks below and for the big-numbers texture the genre wants.
- Score is **monotonic within a run** — it never decreases. A wipeout costs
  *future* score (the stack, the suspended seconds), never banked score.

### 8.2 In-run growth (required, and the encouraged kind)

The multiplier stack (§5.6) is this game's entire in-run power curve: orbs →
slots → ×2 / ×3 / ×6 → the barrel. It resets on a wipeout and at the end of a
run. Growth lives inside the run, which is exactly where this product wants it.

The difficulty ramp (§5.10) is the second in-run progression axis — the run
visibly gets faster and denser as you survive, which is the reason to keep
riding.

### 8.3 In-game progression — the crew ladder (required, and encouraged)

The reference's `TOP RUN` panel stays, because the report's best measured
finding is that **the number under the rival's portrait is not the rival's
score — it is the live remaining gap to it, ticking down in real time as you
earn.** That is a genuinely good readout and it is in-game progression, not
meta.

Here it becomes a **crew ladder**: a small fixed set of named local surfers
whose marks you climb through **inside this game, inside a run**.

| # | Crew member | Mark |
|---|---|---|
| 1 | **Birdie** | 25,000 |
| 2 | **Otto** | 60,000 |
| 3 | **Marisol** | 120,000 |
| 4 | **Ghost** | 240,000 |
| 5 | **Old Sal** | 450,000 |

- The panel shows the **current** rival's portrait and the remaining gap,
  counting down as you score.
- Passing a mark: a short banner (`PASSED BIRDIE`), the portrait swaps to the
  next rival, the gap readout re-targets. Passing all five: the panel reads
  `TOP OF THE PEAK` and holds.
- **The marks are fixed authored constants.** They are not derived from the
  player's history, they do not adapt, they do not accumulate, and they are the
  same every run and every session.
- **No online service, no leaderboard, no account, no cross-game anything.** The
  portraits are five authored illustrations shipped with the game.
- Passing marks unlocks **nothing** at MVP. (Post-MVP's alternate surfers are
  gated on in-game score marks reached *within this game* — still no currency,
  still no cross-session accumulation.)

### 8.4 Difficulty selection

None. There is one authored ramp and it is the same for everyone (§5.10). A
walk-up product with a 2–4 minute turn does not want a difficulty menu, and the
first-20-seconds on-ramp plus the wipeout leash is how a first-timer is
accommodated instead.

### 8.5 What persists

- **A display-only session best score**, shown on the title and score card.
  Nothing else.
- It gates nothing, buys nothing, accumulates into nothing, and references no
  other game.

### 8.6 Explicitly confirmed — no purchases, no currency, no cross-session meta-unlock web, anywhere, even implicitly

- **There is no currency of any kind in this game.** Coins are a score
  component: collected, multiplied, added to score, displayed as a run
  statistic, and discarded at the end of the run. There is **no code path, UI
  element, save field or data structure anywhere that represents a spendable
  balance.** The in-run coin counter must not be written to storage.
- **The reference's economy is deleted outright, permanently, not as a scope
  cut** (§0.5): no `TAP TO ACTIVATE` screen, no `COIN BOOST`, no `SCORE BOOST`,
  no consumable tokens, no pre-run loadout, no persistent coin wallet.
- **No shop, no upgrade tree, no gacha, no battle pass, no VIP, no energy, no
  daily/weekly tasks, no login calendar, no spin wheel, no watch-ad button, no
  ad-revive, no paid continue, no revive of any kind.**
- **No real-money transaction of any kind**, permanently (§0.5, §11).
- **The multiplier stack, the coin count, the difficulty ramp, the wipeout leash
  and the crew ladder all reset at the start of every run.** Growth lives inside
  the run.
- **The crew ladder is in-game progression inside one run of one game** (§8.3) —
  fixed authored marks, no accumulation, no cross-session state, no cross-game
  anything, no unlock web. It is exactly the "next level/stage within THIS game"
  shape the product wants.
- The only thing that may persist to disk is a **display-only session best
  score**. It gates nothing and totals nothing.
- Post-MVP's alternate surfers are unlocked by **hitting a score mark within a
  run of this game**, are a handling trade rather than a strictly better
  character, and are never purchasable or accumulable.

---

## 9. Technical architecture

### 9.1 Rendering approach

**2D, WebGL-accelerated, no 3D scene anywhere.** The side-on framing (§0.1) is
not a camera setting — it is a consequence of the game genuinely being 2D. There
is no perspective projection, no camera object, no pseudo-3D wave surface, and
none may be added.

**Recommendation: PixiJS**, consistent with this repo's other 2D build docs, with
the same isolation rule. The load here is much lighter than a shmup's — peak
on-screen is roughly 6 hazards + ~25 coins/orbs + the player + ~5 parallax
layers + a few hundred spray/foam particles — so **raw Canvas 2D is a genuinely
viable fallback for this game**, more so than for `NovaVanguard`. What PixiJS
buys is cheap layer compositing, the tinting used for the day-lighting and
barrel passes, and the additive spray/glow.

**The stack choice is still the CTO's outstanding 2D-default call, and the code
must not depend on getting a particular answer.** To keep the swap cheap, **all
draw calls live under `/render` and nothing outside it touches renderer APIs** —
game state is plain data, systems mutate plain data, the render layer reads it.
That is good structure regardless. Flag it before POC-1; don't block on it (§12).

**Other rendering rules:**

- **Design space 1920 × 1080**, one scaled root container, letterboxed. Every
  number in this document is in that space.
- **The wave is a painting, not a shader, and not a procedural canvas pattern.**
  This is the project's standing rule for environment surfaces (the
  `Astro_Tunnel` / `TmntSewerSlide` anti-pattern), and here it is also the whole
  art direction (§1). The face is built from **real illustrated art**: a
  horizontally-tiling painted face texture (brushed teal-to-navy gradients,
  hand-drawn sunlight streaks), a separate painted foam/lip layer, a painted
  trough-wash layer, and hand-drawn crest highlights. Scroll them by **UV
  offset**, not by redrawing. Placeholder flat bands are fine at POC; the MVP
  art pass must replace them with generated illustrated textures, never
  code-generated gradients or patterns.
- **The wave silhouette is static in screen space.** Only textures, foam, props,
  parallax layers and entity world positions move (§5.2). Do not animate the
  face rail.
- **Layer order, bottom to top:** sky → clouds → distant sea stacks → mid
  headland/zone props → wave face texture → face detail streaks → trough wash →
  hazards → pickups → player (or barrel interior, which replaces face layers
  wholesale) → foam/lip wall → spray/particles → world-space payout numerals →
  the airborne lens. HUD is DOM, above all of it.
- **Fixed-timestep simulation at 60 Hz** with an accumulator. The reaction-floor
  and gap guarantees in §5.3 are expressed in seconds and must not drift with
  frame rate; a variable-dt integration would make the pacing contract
  untestable.
- **Pool everything that spawns:** hazards, coins, orbs, particles, payout
  popups. Never allocate per-spawn in the loop.
- **Particles** via a lightweight custom emitter over additive sprites with a
  hard global cap (start at 300) and oldest-first eviction. Spray, foam burst,
  bubbles and the tumble splash are particle systems, not authored sheets.
- **Collision is effectively 1D and should be written that way.** Entities carry
  `(worldX, hMin, hMax, xHalfWidth)`. A hit is:
  `|worldX − playerWorldX| < xHalfWidth + 26` **and**
  `h ∈ [hMin − 0.035, hMax + 0.035]`.
  No spatial partitioning, no physics engine, no AABB library. Coins/orbs use
  the same test with the generous radii from §5.5.
- **No custom shaders required.** The day-lighting and barrel passes are tint
  multipliers on layer containers, not post-process passes.

### 9.2 State management shape

A small explicit state machine, no framework state manager at this scope:

```
boot → title → dropIn → riding ⇄ airborne ⇄ tumbling
                          ↕
                    barrelEntry → barrel → barrelExit → riding
                          ↓
                      runOver → scoreCard → title
```

- `riding` is the hub; every other in-run state returns to it.
- **`h`, `lean` and the height model run identically in `riding` and `barrel`** —
  only the rail pair swaps (§5.7). `airborne` and `tumbling` ignore input
  entirely (§4).
- **Pause** freezes the whole simulation without changing the state machine's
  current value.
- The first playable state must be reachable on load **without a key press**;
  the drop-in beat auto-advances on a timer for exactly this reason (§7.3).
- Game state is plain data: `h`, `lean`, player state, hazard array, pickup
  array, scroll offset, elapsed ride time, slot stack + drain timer, wipeouts
  remaining, score, coin count, crew index, zone index. Systems tick over it
  once per frame in a fixed order.

### 9.3 Suggested code structure

```
/src
  /core        - bootstrap, fixed-timestep loop, state machine, config accessor
  /input       - reads the analog tilt vector, applies the deadzone and
                 smoothstep, produces ONE scalar `lean`. Never touches the y
                 component. Desktop keyboard fallback writes into the same
                 scalar. Never reads the host's synthetic arrow keys.
  /player      - the height model (targetH → lag → h), carve state, launch
                 detection + launch power, the airborne arc + spin, landing,
                 tumble, hitbox
  /wave        - face rail evaluation (faceY), barrel rail, scroll bookkeeping,
                 world↔screen conversion. THE ONLY PLACE THAT KNOWS GEOMETRY.
  /hazards     - the four hazard types, group spawning from templates, the
                 urchin-puffer telegraph + close, the seabird
  /pickups     - coin arcs, orbs, contact collection
  /systems     - spawn director, difficulty ramp, multiplier slots + drain,
                 barrel controller, scoring, crew ladder, zone cycle,
                 constraints validator
  /render      - ALL renderer API calls live here and nowhere else (§9.1):
                 layer setup, the painted wave layers + UV scroll, parallax,
                 sprite pools, the particle emitter, the airborne lens,
                 world-space payout numerals
  /ui          - DOM overlay: score plate, coin row, wipeout pips, TOP RUN panel
                 (+ its airborne fade), multiplier slots, banner queue, zone
                 caption, back/pause, title, drop-in, score card
  /audio       - WebAudio: decode once per clip, fresh source node per trigger,
                 one-time gesture unlock. Not <audio> elements.
  /debug       - the POC instrumentation panel + the FAIL_MODEL toggle (§10)
  /data        - tuning.js, faceRail.js, barrelRail.js, hazardGroups.js,
                 coinArcs.js, zones.js, crew.js
  /assets      - placeholder art now, real art at MVP
```

**`/data/tuning.js` holds every gameplay constant in this document in one file** —
`H_TRIM`, `H_SPAN`, `H_RATE_MAX`, `H_RESPONSE`, `H_LAUNCH`, `AIR_MIN`,
`AIR_MAX`, `SPIN_RATE`, `SCROLL_BASE`, `SCROLL_CAP`, `SCROLL_MAX`,
`REACTION_FLOOR`, `H_GAP_MIN`, the density caps, the ramp table, `SLOT_HOLD`,
the barrel duration and cooldown, the score values, `FAIL_MODEL`, the deadzone.
**Nothing anywhere else hardcodes a gameplay number.** This is the
"all spawn/difficulty knobs in one findable place" lesson already paid for in
this repo, and it is what makes §10's on-device tuning pass a config session
rather than a code hunt.

Keep `/core`, `/systems`, `/player` and `/wave` theme-agnostic; zones, hazard
art, crew portraits and lighting passes are data + assets, so Post-MVP content
is additions, not code changes.

**Shipping/bundling is deliberately not specified in this document** — module
format, serving, the overlay DOM contract, the Back button and the error bridge
are owned by **`GOBALANCE_SDK.md`, which is ground truth**. Do not build around
`file://` or single-file assumptions, and do not take bundling guidance from
`brief-for-webgames.md` or from patterns copied out of older GDDs; some of that
predates and conflicts with the real contract.

### 9.4 The face rail is the one abstraction to get right first

Everything else in this game is easy. The one structural decision that will be
expensive to change later is that **all positions are `(worldX, h)` and screen
space is derived**. Build `/wave` first (POC-1), make `faceY` the only geometry
function in the codebase, and never let a hazard, pickup, particle or UI element
compute its own y from the wave shape. This is what makes the barrel a rail
swap rather than a second game, and what makes Post-MVP zones free.

### 9.5 The constraints validator — build it early, it pays for itself

A module in `/systems/constraints.js` that runs at boot in dev mode over all
authored data in `/data`, and **fails loudly** on any violation:

1. **Reaction floor** — at every step of the ramp table, `1555 / scrollSpeed ≥
   REACTION_FLOOR`, and `scrollSpeed ≤ SCROLL_MAX`.
2. **Gap floor** — every hazard group leaves a continuous clear `h` band ≥
   `H_GAP_MIN`, and that band's nearest edge is within
   `H_RATE_MAX × (reactionTime − 0.30)` of `H_TRIM` and of the band the previous
   group left the player in. No required move exceeds `0.50` of the face.
3. **Density caps** — no ramp step's group composition can exceed the 6-hazard /
   4-band / 1-puffer caps, or the 0.9 s minimum group gap.
4. **Band discipline** — no hazard, pickup or prop is authored outside
   `h ∈ [0, 1]`; no coin arc spans more than `0.45` of the face; no entity's
   authored screen path enters a HUD-exclusion rect (§5.1).
5. **The one-axis rule, asserted as code** — a static check (lint rule or a
   simple source scan in the dev build) that **no module outside `/input` reads
   a tilt vector at all, and that `/input` never references the `y`/forward-back
   component.** §0.2 is the most important constraint in this document and it is
   exactly the kind of thing that gets quietly violated by a well-meaning "small
   nudge" six weeks in.
6. **The zero-input rule** — no `keydown`, pointer, touch or gesture handler
   anywhere affects game state during `riding`, `airborne`, `barrel` or
   `tumbling`. Screen chrome (pause, back, restart) only (§0.4).

Runtime assertions on the same invariants (hazards on screen, banner queue
depth, `h` bounds) are cheap and should also be on in dev builds.

### 9.6 Art pipeline

`KOLBO_ASSET_PIPELINE.md` is ground truth for tool/model choice. This game's
specific rules:

**The style clause — paste verbatim into every asset prompt**, so the whole set
stays in one idiom:

> Hand-painted illustrated storybook style with visible brush texture and
> confident varying line weight — not vector-flat, not 3D-rendered, no
> photorealism. Strict palette discipline: a narrow cool band of slate blue,
> teal, grey-violet and off-white. The ONLY warm colours permitted anywhere are
> gold coins and the surfer's coral-orange top. Side-on 2D game art, no
> perspective depth, no text, no UI, no logo, no watermark.

Plus, for hazards only: *"near-black or deep-violet silhouette with a chunky
opaque white foam collar where it meets the water — a dedicated dark value that
does not neighbour the teal water hue."*

**Rules:**

1. **Batch the character set in one call.** Wren's trim / climb / drop / airborne
   / tumble states are generated **together as one multi-panel grid**, from one
   lineage. Frames generated one at a time drift off-model — a lesson already
   paid for in this repo.
2. **Fixed shared canvas per set, no per-frame alpha-bbox crop.** Slice all
   states of a set at the same cell rectangle, or the sprite's centre visibly
   shifts between carve states while she is supposed to be holding a line.
3. **Runtime transforms are the animation system.** The airborne spin is
   rotation of one sprite. The tumble is rotation plus particles. Coin spin,
   orb pulse, foam, spray and bubbles are code over static textures. **Nothing
   in this game requires a hand-drawn animation sequence.**
4. **The wave face texture must tile seamlessly *horizontally*** for the scroll,
   at ~4096 × 1024 or wider. Generate large, make the seam safe deliberately
   (overlap band or mirrored edge), and **verify by actually scrolling it before
   shipping** — a prior build discarded a texture for a visible phase-mismatch
   seam that looked fine as a still. Verify at POC-3 on the one face texture
   before five zones are commissioned.
5. **Foam, lip curl and sunlight streaks are separate layers**, not baked into
   the face texture. They scroll at different rates and are tinted per zone and
   (Post-MVP) per time of day.
6. **The hazard set is generated as one batch** so all four share a value slot
   and a foam-collar treatment.
7. **The five crew portraits are generated as one batch** — five distinct chibi
   silhouettes in the same frame treatment, matching Wren's idiom but
   chromatically *not* using the coral warm slot (it is reserved for the player).
8. **Bring anything that comes back too hot into the readability band with a
   tint multiplier in code, not with a regeneration.** Generated water art will
   come back more saturated than the palette rule wants; that is expected and
   cheap to fix at the layer container.
9. **Background removal is local**, not via the asset service's removebg
   operation, which is known broken. Flatten transparent PNGs onto real white
   RGB before re-uploading one as an edit source.
10. **Audio:** generate each SFX as its own call. Batching multiple distinct SFX
    into one generation has been tested and does not produce separable sounds.

**Asset load is small and concentrated in the wave and the zones.** Rough MVP
inventory: ~8 player sprites, 4 hazards + 1 seabird, 2 pickups, 5 crew
portraits, 1 face texture + 3 face overlay layers + 1 barrel interior set, 5
zones × ~4 parallax/prop pieces, ~6 particle textures, HUD plates and screens.
**POC needs roughly 8 of these** — three carve states, one jellyfish, one flat
face band, one foam band — all placeholder.

---

## 10. Build milestones

### POC — prove the mapping, the trim line, and pick the fail model

1. **Bootstrap and the face rail.** Render layer up, design-space scaling and
   letterboxing, `/wave` with `crestY` / `troughY` / `faceY` and a dev overlay
   that draws the rails and an `h` ruler. Placeholder flat painted bands.
   **Build this before anything moves** — §9.4.
2. **Player + analog input** (§4). The height model, the trim line, the carve
   sprite states, the fixed `x = 0.25` column. **Verify the sign convention on
   real hardware before tuning anything else** — leaning toward the player's
   left must climb. Verify neutral reliably holds the trim line without drift.
3. **Scroll + one hazard type** (jellyfish) at the measured base speed, with the
   1.80 s reaction budget, spawning from authored group templates. Contact =
   fail. Raw time-based score counter, nothing else.
4. **The launch stub** — not full aerials, but the `h ≥ H_LAUNCH` detection and
   a placeholder "you left the wave for N seconds, here's your `h` back at trim"
   beat, so the POC can feel whether the lip actually reads as a ramp and
   whether the rest-beat rhythm lands. No payouts, no lens, no spin art.
5. **Both fail models behind the live toggle** (§5.8): `leash3` and `onehit`,
   switchable mid-session (debug key `F`) and by query param, without a reload.
6. **The instrumentation panel** (§2). On-screen and console, every sample
   tagged with the active fail model:
   - **Time spent leaning** vs. time at neutral, as a percentage — the direct
     measure of whether the trim line removed the sustained-hold exertion.
   - **Lean reversals per second** — is the player making committed leans or
     stuttering?
   - **Time-to-first-wipeout for a naive walk-up player** who has not been told
     the mapping.
   - **Time-to-first-deliberate-climb** — how long before a first-timer figures
     out that lean-left goes up. This is the direct answer to question 1.
   - **Mean run length** under each fail model.
   - **Peak `h` histogram** — does the player actually use the full face, or do
     they hug trim?
7. **THE TWO DECISIONS — an explicit milestone, not a vague "then we choose."**

**Milestone POC-7 in full.** Run on real hardware, standing, with at least one
person who has not seen the game.

Acceptance criteria for the **lean mapping** (§0.2):

- A naive walk-up player performs a **deliberate climb toward the lip within
  20 s** without being told the mapping.
- After 2–3 minutes of standing play, the player reports the input as
  *comfortable*, and **time-at-neutral is ≥ 45%** of ride time. If neutral is
  being used far less than that, the trim line is not doing its job and
  `H_TRIM` / `H_SPAN` / the deadzone need re-tuning **before** any MVP work.
- **No forward/back lean is observed at all.** If players instinctively lean
  forward to climb, the carve animation and the lip's on-screen position are not
  selling the mapping — fix the *presentation*, not the mapping (§0.2 is not
  revisitable).
- Lean reversals per second stay low — this should feel like committed leans,
  not micro-corrections. If it doesn't, `H_RESPONSE` is too high.

Acceptance criteria for the **fail model** (§5.8):

- Mean run length for a first-timer under the chosen model is **≥ 60 s**. A
  walk-up player must not lose their single turn in fifteen seconds.
- The chosen model does not make skilled players feel the run is unloseable.
- Judgement call on feel between the two is explicitly allowed here — there is
  no reference evidence either way and this is what the A/B exists for.

**Both outcomes are written down before any MVP work starts** — record the
chosen `FAIL_MODEL`, the mapping metrics, and any tuning changes implied, in a
short decision note next to this document. **Do not delete the losing fail
model's code path**; it is one config flag.

### MVP — turn the POC into the shippable game

Ordered. Everything below is built on the POC's face rail and height model.

8. **The full hazard bestiary** (§6.2): rock, drift timber, urchin-puffer with
   its station-keeping `!` telegraph and close, plus the seabird as a sky-band
   scenery/trick-target entity. All authored as **group templates**.
9. **The constraints validator** (§9.5), at least rules 1, 2, 4 and 5. Wire it
   **before** authoring a second page of hazard groups, not after.
10. **Coins and coin arcs** (§5.5) with the arc-span cap and the routing-past-
    hazards placement rules.
11. **Multiplier orbs + the three-slot stack** (§5.6) with radial drain timers
    and the HUD slots.
12. **Full aerials** (§5.4): launch power from the pre-launch climb average, the
    scripted arc, constant-rate spin, rotation payouts as world-space slab
    numerals, the translucent lens, automatic clean landing with the 0.8 s
    grace, and the seabird airborne bonus.
13. **The barrel section** (§5.7): the second rail pair, entry/exit transitions,
    the locked ×6, the coin routing, the cooldown.
14. **The zone cycle** (§5.9): five zones on a distance schedule with 3 s
    cross-fades, the zone caption, and the strict separation from difficulty.
15. **The difficulty ramp** (§5.10) as a data table, validated against the
    floors.
16. **The crew ladder** (§8.3): five marks, the `TOP RUN` panel with the live
    remaining-gap countdown, the pass banner, the portrait swap, and the
    airborne fade rule (§5.1).
17. **Scoring, the score card, and the SDK overlay contract** (§8.1, §7.3,
    §7.4), plus the display-only session best.
18. **Full art pass** (§9.6): Wren's sprite set, the four hazards + seabird,
    coins and orbs, the illustrated wave face + foam + lip + streak layers, the
    barrel interior, five zones' parallax and props, five crew portraits,
    particle textures, HUD plates, title and score card. **Replace every
    placeholder**; verify the face texture's horizontal seam by scrolling it.
19. **VFX + audio pass**: spray off the board, foam bursts, the tumble splash,
    the barrel's light change and audio duck, the lens-flare drift, the
    sunlight streaks; layered audio for carve / coin / orb / slot-fill / launch
    / payout / barrel / wipeout / crew-mark pass.
20. **On-device tuning pass.** Re-tune the deadzone, `H_TRIM`, `H_SPAN`,
    `H_RESPONSE`, `H_RATE_MAX`, `AIR_MIN`/`AIR_MAX`, the ramp table and every
    group template against real board feel. Desktop keyboard feel will
    systematically overstate how easy fine height control is. **Explicitly
    re-verify on hardware:** (a) the stand-still rule — holding `h = H_TRIM` and
    never leaning survives ≥ 45 s of the base stream (§5.3); (b) no authored
    group requires a move larger than `0.50` of the face; (c) the urchin-puffer's
    total budget is ≥ 2.6 s in practice, not just on paper; (d) time-at-neutral
    across a full 3-minute run is still ≥ 45%; (e) no coin arc forces a choice
    between a coin and a wipeout.

### Post-MVP (backlog, unordered)

More zones; the day → dusk → night lighting cycle and the rain/storm pass; the
rideable headland/beach-break stretch; a wider hazard and pickup vocabulary
(station-keeping crab with the `!` bubble, kelp curtain, lightning/speed orb);
harder late-run hazard patterns inside the same floors; more crew marks; two or
three alternate surfers as a trim-feel trade unlocked by in-game score marks;
optional gentle hazards inside the barrel.

---

## 11. Explicitly out of scope

Permanent lines, not tier boundaries.

- **Any real-money IAP, paid currency, ads-for-currency, paid continue/revive,
  or purchase path — permanently, not just for these tiers** (§0.5, §8.6).
  Specifically including the reference's `TAP TO ACTIVATE` screen, its
  `COIN BOOST` / `SCORE BOOST` consumables, and its persistent coin wallet.
- **Any cross-session or cross-game meta-progression, unlock web, upgrade tree,
  or currency sink** — including at Post-MVP. No wallet, no character shop, no
  board upgrades, no daily tasks, no login calendar, no battle pass, no energy.
  The crew ladder is fixed in-game marks inside a single run (§8.3).
- **Any second input, at any tier** (§0.4). No trick button, no jump, no dash,
  no landing-timing input, no orb-activation input, no lean-hold gesture, no
  double-lean, no shake, no tap. The entire game is one continuous lateral lean.
- **Any use of the forward/back axis, at any tier** (§0.2). Not for a nudge, not
  for a menu, not for a bonus, not for a debug shortcut. The `y` tilt component
  is never read by any code in this game.
- **Discrete lanes or quantized height.** Position on the face is continuous.
  Do not snap it into slots "for readability" at any tier (§0.2, §4).
- **A trough fail state**, or any second fail axis at the bottom of the face
  (§0.3, §5.8). Hazard contact is the only way to end a run.
- **A botched-landing fail, a failed trick, or any airborne failure** (§5.4).
- **Changing the camera, the framing or the genre** (§0.1). No chase camera, no
  rotating the wave to run left-to-right, no zoom-out, no 3D, no pseudo-3D, no
  behind-the-back view, no top-down view.
- **Adding systems the brief does not have** (§0.1). No weapon, no enemy that
  must be attacked, no boss, no shield, no stamina, no combo meter, no health
  bar, no vehicle.
- **Procedurally-drawn canvas patterns or gradients for the wave, water, foam or
  environment surfaces** (§9.1, §9.6). Illustrated generated art only.
- **Hand-authored animation sheets** for the surfer's spin, the tumble, coins,
  orbs or foam — runtime transforms and particles instead (§9.6).
- **A physics engine.** The collision model is a 1D band overlap (§9.1).
- **Online leaderboards, accounts, multiplayer, or any network dependency.** The
  crew ladder is five authored constants and five shipped portraits (§8.3).
- **A difficulty select menu** (§8.4).
- **Scoring that can decrease.** Score is monotonic within a run (§8.1).

---

## 12. Open questions / risks

- **The fail state is entirely invented and the reference gives no evidence.**
  This is the biggest genuine unknown in the design, which is why POC-7 is an
  explicit A/B rather than a note (§5.8, §10). The risk to manage is not picking
  wrong — it is picking casually, from one short play, without the run-length
  numbers. Collect them.
- **The auto-trick resolution is a design commitment, not an observation.** The
  report infers automatic airborne tricks but flags that the external
  description of the reference's orb system ("collect four of the same sequence
  orb → perform a special move") *might* be player-triggered. If it is, that is a
  second input. **This brief and this doc resolve it hard toward zero buttons,
  and that resolution is not revisitable during build** (§0.4) — the zero-input
  quality is the single biggest reason this genre fits the board. Flagged here
  so nobody later mistakes it for something the footage established.
- **Does lean-left-to-climb actually read?** The whole design rests on it
  (§0.2). It is defensible physically and spatially, but it is still a remap and
  POC-7 is the only real test. Note the escape hatch is *presentation* — carve
  animation, the lip's on-screen position, the spray direction — not remapping
  to forward/back, which is disqualifying.
- **Is the trim line comfortable enough, and is 45% time-at-neutral the right
  bar?** The 45% figure is a reasoned guess at "the player is resting a
  meaningful fraction of the time," not a measured threshold. If real sessions
  come in at 35% but players report comfort, the number is wrong, not the
  design. Re-derive it from the first real standing sessions.
- **The base score rate diverges from the measured 1,950/s** (§8.1), because
  that number embeds an unexplained persistent `×30` the report could not
  account for. If the resulting numbers feel small next to the crew marks, scale
  both together in `/data/tuning.js` — they are one relationship, not two.
- **Whether the ×6 stack actually triggers the reference's barrel** is a sample
  of one frame in the report. We have committed to it as causal (§5.7) because
  it is the cleanest zero-input trigger available, but it is an inference.
- **Horizontal seamless tiling of the face texture** (§9.6) is a real generation
  risk — a repeating seam is very visible when the whole lower frame is that
  texture scrolling at 864 px/s and rising. Verify by scrolling, early, at
  POC-3, on the one texture, before five zones are commissioned.
- **The `TOP RUN` panel vs. the airborne player.** The fade rule (§5.1) is a
  pragmatic answer to a real conflict — the panel must not overlap in-world
  objects (the report's explicit criticism of the reference), but the airborne
  player legitimately flies through that corner. If the fade reads as a glitch
  on hardware, the alternative is moving the panel down-right below the arc's
  reachable band, not removing the exclusion rule.
- **Run length for a walk-up product is unknown.** The report had no data — the
  recorded run was still going at 108 s. If MVP runs routinely exceed 4 minutes,
  the ramp's `RAMP_DURATION` and `SCROLL_CAP` are the levers (§5.10), not the
  wipeout leash.
- **PixiJS vs. raw Canvas needs the CTO's outstanding 2D-default call** (§9.1).
  Unlike a bullet-hell, this game genuinely could ship on either. The `/render`
  isolation rule means POC-1 can start before the answer arrives. Ask early;
  don't block.
- **Barrel section length and frequency are unvalidated.** 9 s every ~20 s of
  eligibility could end up either a highlight or a drag. It is a rest beat in a
  game that already has rest beats (the aerials); if the combined relief makes
  the run feel slack, shorten the barrel rather than adding threats to it.
