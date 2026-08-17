---
status: approved
track: general
source_reports: [airPlanes.md]
---

# Nova Vanguard

**One-sentence hook:** A neon top-down shoot-'em-up flown *low over a
surface* rather than through empty space — your interceptor holds the bottom
of a wide 16:9 frame with its guns already firing, sliding left and right
over cracked alien crust, megastructure plating and shipyard decks, while
squadrons loop in from the wings and lock into shallow formations overhead
and gun emplacements slide past below you.

**Genre:** 2D top-down shoot-'em-up in the Galaxian/Galaga formation
tradition by way of Space Shooter and Sky Force, auto-fire, free continuous
lateral positioning, strict overhead camera.

## Core loop

- The interceptor holds the bottom ~30 % of the frame and slides freely
  across its full width. Guns fire continuously — **no fire button, no bomb
  button**. The only verb is *where do I stand*, and standing is a lean.
- A dark alien surface fills the frame beneath the action — crust, hull
  plating, ice, hive matter — carrying scatter props, wrecks and **ground
  emplacements you can shoot**. (Whether that surface scrolls or holds
  station is the open question below, and the POC builds both.)
- Squadrons enter from the **left and right edges** along long looping
  paths, cross the width in full view, and **lock into a wide shallow
  formation** in the top ~30 %: a 12-14 × 2 grid, a ring flattened into a
  wide lens, a shallow chevron arc. Killing them mid-entry before they
  settle is the skill play and the score play both.
- Locked craft peel off in **horizontal swoops** — arcing across the width
  and dipping toward the player band before curving back up. They never
  plunge straight down through it. Their fire is sparse, fat, slow, and
  sweeps sideways with a guaranteed aisle.
- Chevron pickups climb your weapon rank **1 → 10** across a sector (single
  bolt → twin → 3-wide spread → arc burst), and score pips sit off-line on
  purpose, pulling you a little way out of the safe lane. Both reset when
  the next sector starts.
- Each sector runs ~90-140 s across 4 waves and ends on a **wide boss** — a
  dreadnought lying lengthwise with destructible pods along its hull, a
  carrier disgorging drones from bays across the width, a segmented
  hive-serpent strung horizontally — with a full-width HP bar along the top.
  Three free star objectives per sector; clearing a sector unlocks the next.

## Framing decision: two candidate modes, decided on the board

**This is deliberately unresolved on paper.** Amit's direction:

> *"I think that the scroll is important. Scroll feeling. I'm not sure, so
> we can, I don't know, make two modes and decide."*

So the POC builds **both modes behind a toggle**, same content in each, and
the choice gets made by feel on real hardware rather than argued here. Both
modes share the strict overhead camera, the lateral-only reflex load, the
surface beneath, and every asset — **the mode choice does not fork the art
budget**, which is what makes running the experiment cheap.

### Mode S — scrolling wide arena (the report's Option B)

The surface scrolls continuously toward the player; enemies still enter from
the side edges and lock/swoop as above. This is the report's recommended
landscape framing.

**The case for it.** Scroll is what sells *flight* and *progress* — the
sector-progress meter reads as distance covered rather than as an abstract
counter. It's also the only mode in which ground targets genuinely work:
emplacements that **arrive, get shot, and pass** are a real second layer of
targeting, and they re-import the thing the report liked about 1945 Air
Force (*"take SS's structure and AF's bestiary"*, including its sea and
ground targets) without importing its pixel-art cost. And it's what the
primary art reference actually is: Sky Force's whole identity is terrain
moving underneath.

**The pacing constraint this mode carries and the fixed one doesn't.**
Scroll adds closing velocity to *everything* descending: effective approach
speed = pattern speed **+** scroll speed. So the report's reaction floor has
to be computed against the **sum**, not the pattern alone —

- scroll capped at **~45-50 % of reference speed** (the report's own figure
  for compensating in time rather than distance), and
- pattern speeds reduced further so that **enemy-band → player-band travel
  stays ≥ 1.2 s with scroll included**, and
- a **1 s entry band** telegraphing anything arriving from the top edge, and
- ground pickups/targets must never require a fast vertical dash to reach:
  lures are placed **laterally**, and anything that scrolls past is either
  optional or re-offered later.

### Mode A — fixed arena, no scroll (the Galaga case)

The surface holds station — the sector is one place you're hovering over,
an installation or a hive plate — and reading time comes from the fly-in.

**The case for it, which stands as good analysis regardless of which wins.**
The report frames the landscape problem as A (rotate to a Gradius horizontal
scroller: best readability, dodge on the expensive up/down lean) versus B
(keep the vertical scroll as a wide arena: comfortable lateral dodge, pay
for lost depth in slowed pacing). Both pay for the ~75 % reaction-budget
loss out of the *travel* budget, because both assume the field is moving.
**Galaxian and Galaga were single-screen games**, and their reading time
comes from the *hold*: enemies fly in, settle into a legible grid, and sit
there while you decide. That source of reading time barely cares about
aspect ratio, which makes it the cheapest available answer to a shallow
frame — no depth to compress, and no scroll velocity added to incoming
threats. It also gives the eyes a stable scene to rest on while the body is
leaning, which is a genuine physical-comfort argument on a board.

### What each mode has to demonstrate to win

Judged on the board, same content, same session:

- **Mode S must show that the scroll adds more than it costs** — that it
  reads as flight and progress rather than as pressure; that at the capped
  speed a first-timer can still clear wave 3 without a hit; that it does not
  induce *vertical drift-chasing* (players leaning forward/back to chase
  ground pickups before they pass, which is the failure we most want to
  avoid); and that leaning while the ground moves causes no visual-flow
  discomfort.
- **Mode A must show that it doesn't go dead** — that a fixed scene still
  feels like flying after 60 s, that fly-in-and-hold reads as clearly in
  practice as it does on paper, and that the progress meter alone can carry
  the sense of getting somewhere.
- **Both are measured the same way:** lateral corrections per second under
  the hardest wave, survival rate through the narrowest authored aisle, and
  time-to-first-hit for a naive walk-up player.

**Option A (rotate to a horizontal Gradius scroller) stays rejected in both
modes**, per the standing lean-axis finding: it puts the reflexive dodge on
the forward/back lean, which is a physical-exertion problem rather than a
controls one.

## Art direction — hard constraints

**These are non-negotiable and are written here so stages 3 and 4 inherit
them.** Amit, on every concept frame produced before this revision:

> *"you always put the airplane in like... in a weird angle, it needs to be
> completely top down and my spaceship is always looking north, like up.
> It's a classic top down game, there's no room for another perspective."*

1. **Strict orthographic overhead camera.** No horizon line, no sky, no
   vanishing point, no three-quarter view, no dramatic low angle, no
   perspective tilt. The camera looks straight down.
2. **You always see the top surface of every object** — wing tops, hull
   spine, engine nacelles from above. Never the side or front of a fuselage.
3. **The player craft's nose points straight up (north), always.** Banking is
   conveyed by **roll only**; the silhouette stays vertically aligned. There
   is no yaw, no turn-into-the-lean, no rotating the ship to face travel.
4. **Enemy craft are likewise flat top-down**, nose along their travel
   direction.
5. This applies to concept art, marketing frames, and in-game assets alike —
   a concept frame that breaks it is wrong even if it's pretty.

### Idiom: rendered 3D-look, not pixel art

Pixel art is out on production cost (see the two inventories: ~674 authored
images for the pixel-art `broadside-coral-line` against ~198 here). The
target is the modern rendered/3D-look sci-fi idiom: glossy hard-surface
hulls, crisp bevels, metallic highlights, neon energy bullets, bloom, and
particle-driven explosions.

### The fix for "generic": fly low over a surface, not over empty space

Amit's binding critique of the first Nova Vanguard frames was **"I don't
care for generic."** The diagnosis is concrete rather than a vibe: those
frames were *ships against an empty starfield*, which is precisely the look
the report itself dismissed — *"the art itself is generic 2015-era mobile
arcade and isn't worth imitating; the contrast discipline is."* An empty
star field gives the eye nothing to identify the game by.

**Sky Force gets its identity from the ground beneath it.** So: keep the
spaceships, and fly them low over a **scrolling surface** —

- cracked planetary crust with glowing magma fissures, cargo containers,
  crashed hulls;
- the armour plating of a colossal megastructure — trenches, coolant seams,
  docking clamps, turret pods;
- a shipyard deck with cradles and half-built hulls;
- an ice field over a buried facility;
- a hive surface, organic and pulsing.

That single change does four jobs at once: it buys the **scroll feeling**
Amit wants; it gives the game an **identity** an empty starfield can't; it
gives the strict overhead camera something to be legible *against* (a
top-down view of nothing reads as flat); and it partially re-imports
**Broadside's best quality — a sense of place — into the cheap idiom**,
which was the reason Broadside was tempting in the first place.

Two readability rules come with it, straight from the report:

- The surface is **desaturated and low-contrast beneath the action layer**.
  The report is explicit that 1945 Air Force's busy island art and drifting
  cloud scrim *"measurably hurt readability"*; the surface must never fight
  bullets or pickups for attention.
- **Colour-coded bullet ownership carried over verbatim** — player fire
  cyan-white, enemy fire orange/magenta — over a dark ground, which is the
  contrast discipline the report says is the one thing worth taking from
  Space Shooter's visuals.

### Reference set

Supplied by Amit and read directly before this revision; all three were
attached as `reference_images` on the concept-frame generation:

- **`sky-force-reloaded-for-pc.jpg` — the primary target.** Rendered craft
  (explicitly not pixel art), strict overhead camera, nose-up player, neon
  tracers, and dark scrolling terrain — cracked earth, crates, ground
  installations — beneath everything.
- **`unnamed.webp` (1941 Air Attack)** — and it is **already 16:9
  landscape**, which makes it the closest direct layout precedent we have:
  top-down nose-up aircraft over scrolling ocean and islands, with a wide
  capital ship spanning the frame.
- **`Batsugan1.jpg` (Batsugun)** — the arcade ancestor: top-down craft over
  scrolling water with dense but readable bullet patterns.

## The bomb, re-homed: automatic — the Overload Vent

There is no thumb on a board, so the screen-clear can't be a button. Judged
on this concept's merits I take the report's **option 1, automatic**: the
ship's core charges as you play, and when the incoming-threat score crosses
a threshold — bullet count spiking, aisle collapsing, ship pinned near an
edge — it **vents by itself**, clearing bullets and damaging everything on
screen, then rebuilds on a visible ring in the left margin.

- **The failure mode here is being pinned**, and a pickup-triggered bomb
  fails exactly when it's needed: you can't fly across the frame to fetch a
  canister at the moment you can't move. Automatic fires precisely when
  movement has stopped being an answer. (This holds in both framing modes.)
- **Option 3, a lean gesture, is ruled out** for the report's own reason: a
  deliberate hold at a lean extreme risks the forward/back axis at the exact
  moment the player is under most pressure.
- **The report prefers 1945's cooldown dial to Space Shooter's purchasable
  counter**, and that's honoured — the vent is a recharging resource, never
  an inventory, never bought, never a shop hook.
- **The charge is partly earned**: kills and near-misses fill the core faster
  than time alone, so aggressive skilled play buys more mercy — a small
  piece of the "rank / chain / medal" scoring depth the report notes both
  references dropped, with no extra input.
- Note that in **Mode S** a pickup-triggered bomb *would* be available as an
  alternative (a canister could scroll in, the way `broadside-coral-line`
  proposes), so if Mode S wins, that variant is worth one comparison test —
  but automatic remains the default in both.

*Footnote on a report gap:* Space Shooter clip A at 1:43 shows an unexplained
white winged aura with a burst of dense fire, which the report flags as
unresolved. The Overload Vent is our own authored version of that beat rather
than a guess at theirs.

## Why it fits GoBalance

- **Auto-fire, so there is no action button in the core loop at all.** The
  entire input budget goes to movement — the report's single most
  GoBalance-relevant property of the genre.
- **Free continuous lateral movement, not discrete lanes** — matches the
  established GoBalance preference.
- **The reflexive load is essentially 100 % left/right.** Vertical movement
  exists only as a slow optional nudge — drifting up to catch a chevron,
  closing on a boss pod during its scripted vulnerable window — always on
  multi-second windows. **No sector may require a fast vertical move to
  survive**, and in Mode S that rule extends to ground pickups: nothing that
  scrolls past may demand a vertical dash.
- **A hit doesn't end the turn.** Attrition (a segmented shield/hull gauge,
  1945-style) rather than discrete lives, so a walk-up player doesn't lose
  their single go to one mistake.
- **The overhead camera is itself an ergonomic asset.** With no horizon and
  no perspective, the frame has no implied "forward" pulling the player to
  lean into it, and every threat's position is unambiguous — there's no
  depth cue to misjudge while your body is busy balancing.
- **HUD in the margins**: vertical shield gauge up the left edge with the
  vent-charge ring below it, vertical sector-progress percentage up the
  right edge, full-width boss bar along the top, single-slot banner queue so
  two banners can never collide (the report caught three text layers
  colliding in one reference frame). The centre-top stays clear.

## No IAP, no cross-session meta — and what replaces it

Deleted outright: coins, gems, the premium shop, the nine-slot pre-level
consumable grid, the spin wheel, the watch-ad button, the VIP badge, the
campaign task list and the "do you like this level?" prompt.

Growth lives **inside the run**: the chevron rank ladder 1 → 10, which is
Space Shooter's own free version of its power curve, resetting each sector.
Progression lives **inside the game**: a campaign of sectors where clearing
one unlocks the next, three free star objectives per sector as the skill
ladder, and explicit Normal/Elite difficulty selection plus quiet dynamic
easing after repeated deaths. Between sessions, only a local best-score
board persists.

The end-of-sector spin wheel becomes the report's "keep the beat, earn it":
a tally revealing multipliers one at a time from things the player actually
did — accuracy, no-hit streak, formations cleared whole, objectives met,
boss time — same escalating rhythm, nothing to buy.

## Scope tiers

**POC — this is the mode experiment, and that's its main job.** One surface
theme, one player craft (auto-fire, lateral slide, slow vertical allowed),
one enemy type entering from the side edges and locking into a 12 × 2
formation, one lateral sweep pattern with a guaranteed aisle, the swoop
dive, the shield attrition gauge, and **two selectable framing modes running
the identical content: Mode S (scrolling surface, capped speed) and Mode A
(fixed surface)**. No boss, no chevrons, no vent, no scoring UI. It answers
two questions: **does this loop feel good on a board at all**, and **does
the scroll earn its keep** against the acceptance criteria listed in the
framing section. Placeholder art is fine except for the surface, which needs
to be real enough to judge the scroll feeling.

**MVP** — A 5-sector campaign of ~90-140 s sectors, each with its own
surface (crust → shipyard deck → megastructure hull → ice field → hive
plate) in whichever mode won the POC. Chevron rank ladder 1 → 10, off-line
score pips as flight-path design, the automatic Overload Vent with earned
charge, 6 air enemy types plus 4 ground-emplacement target types, 4-5
formation shapes and 4-5 bullet patterns under the density/aisle caps, one
wide boss per sector with destructible pods, the entry-band telegraph, three
free star objectives per sector, sector-progress percentage meter,
escalating multiplier reveal, difficulty ramp plus Normal/Elite, and a full
art pass under the hard perspective rules including a diegetic loading
console.

**Post-MVP** — More sectors and surfaces (a red-giant refinery, a shattered
ringworld plate, a drowned reef facility), a larger bestiary including
stationary emplacements clamped to the top band, more multi-part boss
shapes, harder late-campaign choreography still inside the same
density/aisle/reaction-time caps, a second selectable hull unlocked by
clearing the campaign (handling vs. firepower, not a stat ladder), an
endless "swarm" mode built from the same wave library, and a local
high-score board. More of the same kind of thing, bigger — no currency, no
cross-game unlocks, no IAP.

## Asset inventory

Scoped to **MVP** (5 sectors, 6 air enemy types, 4 ground target types,
5 bosses), using the same categories and counting rule as
`broadside-coral-line`'s inventory so the two stay directly comparable.
Counts are production units — a distinct image that has to be authored —
split into **static sprites** (one image, animated at runtime by rotation,
scale, tint, additive blending or particles) versus **hand-authored
animation frames** (images that only exist to be played in sequence).

The idiom is the load-bearing difference: this rendered-look art **permits
runtime transforms**, so one ship image covers every state, and explosions
are particle systems rather than drawn sheets. Note also that the hard
top-down rule *reduces* the count — a nose-up craft that only ever rolls
needs no turn/yaw sprites at all.

| Category | Items | Static sprites | Authored frames |
|---|---|---|---|
| **Player ship** | 3 hull tiers (rank 1-3 / 4-7 / 8-10) × 3 roll states (level, roll-L, roll-R) = 9; engine plume 2 (cruise, thrust); shield bubble 1 | 12 | 0 |
| **Air enemies** | 6 types × 1 top-down body = 6; 6 damaged/scorched overlays; 1 shared glow-core overlay; 1 floating HP pip. Headings by runtime rotation | 14 | 0 |
| **Ground targets** | 4 emplacement types × (intact, damaged, destroyed) = 12; 2 shared scorch decals | 14 | 0 |
| **Bosses** | 5 × (1 hull + 4 destructible pods + 4 blown-pod variants + 1 scorch overlay) = 50 | 50 | 0 |
| **Projectiles** | Player 5 (single bolt, twin, 3-spread, beam segment, arc orb); enemy 5 (small orb, heavy plasma, fan bolt, spoke shard, telegraph line); 1 shared additive glow | 11 | 0 |
| **Pickups** | Chevron rank, shield, score pip, vent battery, fire-rate boost — spun/pulsed at runtime | 5 | 0 |
| **FX** | Particle textures: spark, ember, smoke puff, shockwave ring, bloom flash, plasma wisp, 3 debris chunks | 9 | 0 (optional 1 × 8-frame boss-death sheet) |
| **Surface / terrain** *(new — the "low over a surface" change)* | 5 sector surfaces × 1 large seamless painted base layer = 5; 5 × 8 scatter props (rocks, containers, pipes, clamps, wrecks, masts) = 40; 4 shared ground decals (cracks, scorch, oil, shadow blob); 3 ambient overlays (dust, heat haze, coolant glow) | 52 | 0 |
| **Far background** | 2 shared deep-space/void layers visible at surface edges and in transitions | 2 | 0 |
| **HUD / UI** | Shield gauge frame + fill, progress meter frame + fill, boss bar frame + fill, rank pip on/off, vent-charge ring, banner plate, warning band, 3 star-objective icons, 4 buttons, results panel, score/multiplier plate | ~22 | 0 |
| **Screens** | Title art, sector-select map + 5 node icons, results background, diegetic loading console | ~9 | 0 |
| **Type** | 1 display face + 1 numeric face | 2 | — |
| **Total** | | **≈ 202** | **0-8** |

Notes for comparison purposes:

- **The surface is genuinely new cost this concept did not previously
  carry**: +52 surface/terrain sprites and +14 ground targets, against −12
  for the nebula backdrops they replace — a **net ~+54**, taking the
  inventory from ≈ 148 to ≈ 202.
- Even so it stays **large painted layers plus scatter props, not a
  177-piece tileset**: in this idiom a surface is one seamless base image
  per sector scrolled or held in code, with props scattered on top, rather
  than a hand-authored autotile set with seam-correct transitions.
- **Nothing here requires a hand-drawn animation sequence.** Roll is a
  sprite swap; thruster flicker, pickup spin, pod destruction, boss sway,
  emplacement destruction and every explosion are code and particles over
  static textures.
- **The framing-mode choice costs nothing in art.** Mode S and Mode A use
  the identical surface assets — one scrolls them, one doesn't — which is
  why the POC can afford to build both.
- Load concentrates in **bosses (50)** and **surfaces (52)**.
- POC needs roughly **20 of these** (1 hull tier × 3 rolls, 1 enemy,
  2 projectiles, 1 surface base + 8 props, 2 HUD bars) plus placeholders.

## Inspired by

- **airPlanes.md** — the Space Shooter / Galaxy Attack half of the report's
  pair, taken straight:
  - The **Galaga lineage section** — *"waves fly in along a path before
    locking into formation, giving the player a window to kill them
    pre-formation"* — which is the core skill expression in both framing
    modes and the whole basis of the Mode A case.
  - The **observed formation vocabulary** (7+5+3 block, ~20-strong
    ring/diamond, 7 × 6 grid, circular swarm) re-cut to the report's
    landscape rule of wide-shallow 10-14 × 2-3 in the top 30 %, player band
    at the bottom 30 %, ≥ 25 % transit gutter.
  - The **10-pip chevron weapon meter**, identified by the report as the
    free in-run version of the power curve, used here as the whole
    progression device.
  - The **art-direction reading** — *"the art itself is generic 2015-era
    mobile arcade and isn't worth imitating; the contrast discipline is"* —
    which turned out to be the exact diagnosis of why the first concept
    frames read as generic, and is answered by the low-over-a-surface change.
  - **The 1945 bestiary note** — *"take SS's structure and AF's bestiary"*,
    including its sea/ground targets — which is what the ground emplacements
    are, and part of why Mode S is attractive.
  - The **readability warnings**: terrain and overlays must be desaturated
    beneath the action layer; colour-coded bullet ownership carried over
    verbatim; HUD-exclusion band enforced.
  - The **three required trims** (demote the vertical axis, slow the threat
    clock, re-home the bomb) and the full do-not-port list — including the
    diagonal staircase curtain, anything firing from below, and Galaga's
    straight-down plunge (replaced everywhere by the horizontal swoop).
  - The **F2P audit** line by line, and the **Sky Force Reloaded** proof
    point — which is now doing double duty as the art target as well as the
    progression proof.
- **Amit's `notes.txt` for the airPlanes folder**, quoted directly:
  - *"WE ARE 16:9. These reference games are portrait mobile games. Do NOT
    carry their portrait framing across..."* — answered by the wide arena,
    the side-entry formations, the margin HUD, and (pending the POC) the
    scroll-speed cap.
  - *"WE ARE NOT CLASSIC FREE-TO-PLAY... keep the good part (session shape,
    sense of growth, difficulty ramp) without the monetisation
    scaffolding."* — chevron ladder as growth, sector campaign as ramp,
    ~2-minute sector as session shape, no wallet.
  - *"Treat the two games as a pair: what do they share... and where do they
    differ?"* — this proposal is the Galaga side of that split; the 1942
    side (`broadside-coral-line`) is out of contention on production cost.
- **Amit's direct task-time direction across this run**, quoted verbatim and
  each implemented above:
  - *"forget about the TMNT theme for this kind of game. I want completely
    regular game."* — no TMNT angle anywhere in this concept.
  - *"I don't care for generic."* — answered by the low-over-a-surface change
    in the art-direction section, with the diagnosis stated rather than
    hand-waved.
  - *"you always put the airplane in like... in a weird angle, it needs to be
    completely top down and my spaceship is always looking north, like up.
    It's a classic top down game, there's no room for another perspective."*
    — written up as the five hard perspective constraints, and applied to
    the regenerated concept frames.
  - *"I think that the scroll is important. Scroll feeling. I'm not sure, so
    we can, I don't know, make two modes and decide."* — the POC now builds
    both modes with stated acceptance criteria instead of settling it on
    paper.
  - Pixel art rejected on production cost after reviewing the two asset
    inventories (~674 images vs ~198), which is why the rendered-look idiom
    is now fixed rather than optional.
- **The three supplied reference images** (`sky-force-reloaded-for-pc.jpg`,
  `unnamed.webp`, `Batsugan1.jpg`) — read directly, described in the art
  direction section, and attached to the concept-frame generation.
- **Existing GoBalance lean-axis finding** (left/right comfortable,
  forward/back hard) — the reason a Gradius horizontal framing is rejected
  in both modes, and the reason the vertical axis is capped to slow optional
  moves.

## Concept frame

Regenerated under the hard perspective rules, with all three of Amit's
reference images attached, as **playfield mocks rather than key art**. Both
prompts are saved in full to `concepts/prompt.txt`; the shared body is:

> In-game playfield screenshot mock for a 16:9 landscape top-down arcade
> shoot-em-up. STRICT ORTHOGRAPHIC OVERHEAD CAMERA looking straight down at
> the ground: no horizon line, no sky, no vanishing point, no three-quarter
> view, no perspective tilt. Every object is seen from directly above —
> wing top surfaces, hull spines and engine nacelles viewed from overhead.
> Art idiom: modern rendered 3D-look sci-fi, glossy hard-surface hulls with
> crisp bevels and metallic highlights, saturated neon energy glow, bloom,
> particle sparks. NOT pixel art. [...] In the bottom third, centred: one
> sleek blue-and-white player interceptor seen from directly overhead, its
> NOSE POINTING STRAIGHT UP toward the top of the frame, perfectly
> vertically aligned, banking conveyed only by a slight roll of the wings.
> [...] Across the top third: a wide shallow formation of twelve insectoid
> alien fighters in two neat rows spanning the full width, all seen from
> directly overhead with their noses pointing down toward the player. Their
> fire is large, slow, individually readable orange-magenta plasma orbs with
> glow halos, sparse, with one clear wide gap through the pattern. [...] HUD
> in the margins only: vertical segmented shield gauge up the far left edge,
> vertical mission-progress percentage meter up the far right edge, thin
> full-width boss health bar along the very top edge, small score readout
> top-left. Centre of the frame kept uncluttered.

The two prompts differ only in the surface beneath, so the frames double as
a **surface-theme A/B** as well as a camera test:

- `concepts/concept-01.png`, `concept-02.png` — **alien planetary crust**:
  cracked black rock with glowing magma fissures, cargo containers, hex
  emplacements, a half-buried crashed hull.
- `concepts/concept-03.png`, `concept-04.png` — **megastructure hull /
  shipyard deck**: riveted armour plating, service trenches, violet coolant
  seams, turret pods, a shipyard cradle.

Generated with `nano-banana-pro`, 16:9, reference images
`sky-force-reloaded-for-pc.jpg`, `unnamed.webp` and `Batsugan1.jpg`. All four
frames satisfy the hard rules: strict overhead, player nose north with roll
only, enemies flat top-down facing their travel direction, surface beneath,
HUD confined to the margins, centre of frame clear.
