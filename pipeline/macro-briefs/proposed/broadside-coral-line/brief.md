---
status: proposed
track: general
source_reports: [airPlanes.md]
---

# Broadside: The Coral Line

**One-sentence hook:** A pixel-art Pacific-theatre shmup rebuilt from the
ground up for a widescreen screen and a balance board — you fly a single
prop fighter along the bottom of a very wide sky, dodging entirely
left-and-right through slow, fat, readable flak while wide-shallow squadrons
peel in from the side edges, and every boss is a capital ship lying
*lengthwise* across the frame with turrets to chew off one by one.

**Genre:** 2D vertically-scrolling shoot-'em-up (1942 / 1943 / Raiden
lineage), auto-fire, free continuous lateral positioning, staged as a **wide
arena** rather than a portrait corridor.

## Core loop

- The ocean scrolls slowly downward behind you and your guns fire
  continuously — **there is no fire button and no bomb button**. The only
  verb is *where do I stand*, and "standing" is a lean.
- You live in the bottom ~30 % of the frame and move freely across its full
  width. Squadrons enter along the **left and right edges** and arc across
  the width in long S-curves; formations lock up in the top ~30 % in wide,
  shallow blocks (10-14 across, 2-3 deep). Between the two bands sits a
  transit gutter nothing is allowed to camp in.
- Flak arrives as **few, large, slow, laterally-sweeping** patterns — fans,
  sine sweeps, rotating spokes — each with a guaranteed aisle. The correct
  answer to a pattern is *one committed lean and hold*, never a stutter of
  corrections.
- Chevron pickups raise your weapon rank 1 → 10 over the course of a
  mission, and score pips are strewn across the water as a **movement lure**
  that pulls you off the safe line into contested air. Both reset at the
  start of the next mission.
- Mid-mission you overfly **your own carrier**: the enemy stops, three
  upgrade pennants (armour / spread / speed) sit spaced across the deck, and
  you pick one by simply flying over it. A 6-second breather that is also a
  lateral decision.
- Each mission is ~100-150 s and ends on a **wide boss** — a battleship
  broadside, a carrier's flight deck, a bomber wing flying as one multi-part
  entity — with destructible turrets spread across the width and a
  full-width HP bar along the top. Then a results screen with three free
  star objectives and an escalating multiplier reveal.

## Framing decision: the wide arena (Option B), with one piece of Option A stolen

**I pick Option B — keep the vertical scroll, treat 16:9 as a wide arena —
and I pick it on ergonomics, exactly as the report recommends.** Option A
(rotate to a Gradius-style horizontal scroller) is genuinely the better
answer for readability and it is what the arcade tradition did with a
landscape tube, but it puts the dodge axis on up/down, which is GoBalance's
expensive lean. A whole game whose reflexive dodge is forward/back is a
physical-exertion problem, not a controls problem, and no amount of
readability buys that back.

**But Option A's actual trick is worth stealing, and this concept steals
it:** what A really buys is *travel along the long axis*. So enemies here
**enter from the left and right edges and cross the width**, not from the
top — their approach path is 1.78 screen-heights long instead of 0.56, which
restores most of the reading time the aspect change took away, while the
dodge they demand of me stays lateral. Only the scrolling *backdrop* and the
drifting flak move vertically. That hybrid is the design's whole thesis:
**Option A's reaction budget, Option B's dodge axis.**

**Paying the ~75 % reaction-budget loss concretely.** The report is right
that this cannot be hand-waved, so, in numbers to be tuned in stage 3:

- Terrain scroll and enemy descent run at **~45-50 % of reference speed** —
  a single atoll fills the frame for 6-8 s rather than flashing past.
- Enemy bullets are capped so the shortest travel from the enemy band to the
  player band is **≥ 1.2 s** (the report's floor is 0.8-1.0 s; a 16:9 frame
  and a board both argue for the top of that range).
- Bullets are drawn **~1.8× reference size** and hard-capped at roughly
  **20-24 on screen**; density is bought with size, not count.
- Every pattern guarantees an aisle **≥ 2.5× the player's hitbox width**,
  and **only one sweeping pattern is ever live at a time**.
- A **1-second entry band** along the top and side edges shows shadow
  silhouettes/warning chevrons before anything actually arrives — 1945 Air
  Force's cloud layers, formalised into a telegraph instead of a scrim.
- Decision cadence targets **one committed lean per ~1.5 s**, against the
  reference's several corrections per second.

**Explicitly not ported**, per the report's do-not-port list: diagonal
staircase bullet curtains; 1945 Air Force's bullets-rising-from-the-bottom
during bosses (no simultaneous top-and-bottom pressure — an emergency
forward-or-back lean is exactly the thing to design out); any pattern whose
aisle is narrower than realistic lean precision; and Galaga's plunge-through
dive, which is re-choreographed as a horizontal swoop that dips toward the
player band and arcs away rather than crossing it.

## The bomb, re-homed: pickup-triggered detonation

There is no thumb on a board, so the screen-clear cannot be a button. Of the
report's three options I commit to **option 2, pickup-triggered**: a bomb
canister drifts down on a cooldown-style cadence and **detonates the instant
you fly into it**, clearing bullets and damaging everything.

Why this one over the other two:

- Over **automatic (option 1)** — automatic keeps the beat but deletes the
  decision, and this game's entire verb is positioning. Pickup-triggered
  converts the button press into *the verb the player already has*, which is
  strictly better than removing it.
- Over **a lean gesture (option 3)** — a hold-at-extreme gesture is the only
  option that risks the forward/back axis under pressure, which is precisely
  when we don't want it. Ruled out.
- The report also notes 1945's cooldown dial is a better base than Space
  Shooter's purchasable counter. That's preserved in the *spawn cadence*:
  the canister reappears on a fixed timer, so a screen-clear is always
  eventually available and never depends on inventory or a shop.
- Bonus: because the canister is a physical object placed in space, the
  level designer decides *where* mercy lives — it can be dangled just
  outside the safe lane during a hard sweep, turning the panic button into a
  risk read.

## Why it fits GoBalance

- **Auto-fire means there is no action button anywhere in the core loop.**
  The whole input budget goes to movement. The report calls this the single
  most GoBalance-relevant thing mobile did to the genre, and it's why this
  is, per the report, the best-fitting reference genre the pipeline has
  reviewed so far.
- **Movement is free and continuous, not discrete lanes** — which matches
  the established GoBalance preference over lane-snapping.
- **All reflexive load is on left/right.** The design rule is a hard one:
  *every mission must be completable without a single fast vertical move.*
  Forward/back is used only for slow, optional, generously-timed
  repositioning — nudging up to catch a chevron, closing on a boss turret,
  crossing the carrier deck — and every one of those has a window measured
  in seconds, not frames. Nothing ever requires simultaneous fast lateral +
  vertical threading.
- **A hit doesn't end the turn.** 1945 Air Force's attrition fuel-can bar is
  taken over Space Shooter's discrete lives: a walk-up player on a board
  gets one go and shouldn't lose it to a single mistake. Damage degrades
  gracefully, so no dodge is ever a life-or-death reflex window.
- **HUD stays in the margins**, which is free real estate in landscape: a
  vertical jerrycan fuel gauge up the left edge, a vertical kill-percentage
  meter up the right edge, a full-width boss bar along the top, and a
  single-slot banner queue so two banners can never collide. The centre of
  the top edge stays clear for incoming enemies.

## No IAP, no cross-session meta — and what replaces it

Per the report's audit, almost everything valuable here is already free:
star objectives, wave pacing, the in-run chevron ramp, the boss cadence and
the end-of-run reveal all survive untouched. Deleted outright: coins, gems,
parts, dog tags, energy, the consumable shop, the spin wheel, the ad button,
VIP, battle pass, daily tiles, the aircraft power ladder, and the "do you
like this level?" prompt.

The one thing that needs redesigning rather than deleting is the between-run
power curve, and the fix is the report's: **move growth inside the run.**
The chevron ladder (rank 1 → 10 within a mission) and the mid-mission
carrier-deck pick both reset with the run. Nothing at all persists across
sessions except a local best score.

**The hangar loop, kept honestly.** The report makes the point that the
shop-between-levels loop is *Raptor / Tyrian* retro-PC heritage, not an F2P
invention, and that its design function is separable from its business
function. The carrier-deck beat is that function kept in non-monetised form:
a visible growth choice, a difficulty smoother, and a pacing breather — paid
for in flying, not in currency, and living inside a single run.
Progression across *missions* is the campaign itself: clearing a mission
unlocks the next one, and star objectives are the skill ladder on top. That
is in-game progression, which is wanted; it is not an unlock web.

## Scope tiers

**POC** — One wide arena, one atoll backdrop scrolling at the reduced speed,
one player plane with auto-fire, free lateral movement across the full width
with slow vertical movement allowed, two enemy types (a side-entering swoop
squadron and a formation block that locks in the top band), one lateral
sweep bullet pattern with a guaranteed aisle, the fuel-bar damage model, no
boss, no chevrons, no scoring UI. The single question it answers: **is
"lean-and-hold through a slow wide sweep" fun for 90 seconds, and does the
side-entry approach path actually restore enough reading time?** Placeholder
art throughout.

**MVP** — One 5-mission campaign of ~100-150 s missions. Chevron weapon
ladder 1 → 10, score-pip lures placed as flight-path design, the
pickup-triggered bomb canister on its cooldown cadence, the mid-mission
carrier-deck three-pennant pick, 5-6 enemy types, 4-5 bullet patterns under
the density/aisle caps, one wide boss per mission (broadside battleship,
carrier deck, bomber wing, gun-emplacement island, and a two-phase final
ship) with destructible turrets, the entry-band telegraph system, three free
star objectives per mission, the kill-percentage meter, an escalating
end-of-mission multiplier reveal (accuracy / no-hit streak / objectives /
boss time), a difficulty ramp across the campaign, plus explicit
Normal/Veteran selection and quiet dynamic easing after repeated deaths.
Full pixel-art pass including a diegetic radar-console loading screen.

**Post-MVP** — More mission theatres beyond the coral line (night storm over
a carrier group, a volcanic coast at dusk, a low-visibility fog run, an
industrial harbour raid), a larger bestiary including sea and ground
targets, more multi-part boss shapes, harder late-campaign patterns still
inside the same density/aisle/reaction-time caps, a second selectable
airframe unlocked by clearing the campaign (handling/firepower trade, not a
stat ladder), an endless "gauntlet" mode built from the same wave library,
and a local high-score board. More of the same kind of thing, bigger — no
currency, no cross-session unlock tree, no IAP.

## Asset inventory

Scoped to **MVP** (5 missions, 6 enemy types, 5 bosses), using the same
categories and the same counting rule as `nova-vanguard`'s inventory so the
two are directly comparable. Counts are production units — a distinct image
that has to be authored — split into **static sprites** (one image, placed
and animated at runtime by position/tint/state swap) versus **hand-authored
animation frames** (images that only exist to be played in sequence).

The idiom is the load-bearing difference: **pixel art cannot be rotated or
scaled at runtime** without destroying the pixel grid, so every heading, every
bank angle and every turret aim angle is a separately drawn sprite, and
explosions/water/smoke must be drawn frame by frame rather than thrown to a
particle system.

| Category | Items | Static sprites | Authored frames |
|---|---|---|---|
| **Player plane** | 2 hull tiers × 5 bank states (hard-L, L, level, R, hard-R) = 10; prop-blur second frame per sprite 10; wake/exhaust 4-frame loop; damage smoke 4-frame loop; death explosion 10-frame | 10 | 28 |
| **Enemies** | 6 types × 3 headings (level, bank-L, bank-R) = 18; 6 damaged variants; prop/rotor second frame per heading 18; shared small death explosion 8-frame; sea-target wake 4-frame | 24 | 30 |
| **Bosses** | 5 bosses × (8 hull part sprites = 40; 2 extra damage states per part = 80; 4 turrets × 3 aim-angle sprites = 60); per-boss burning/venting 2 × 4-frame loops = 40; per-boss breakup 6-frame = 30 | 180 | 70 |
| **Projectiles** | Player 5 types (2-frame shimmer each); enemy 5 flame-teardrop types (3-frame loop each); 2 muzzle flashes × 3-frame | 12 | 21 |
| **Pickups** | Chevron, fuel can, shield, score pip, bomb canister — 5 × 4-frame spin/pulse (no runtime rotation available) | 5 | 15 |
| **FX** | Air explosion 10-frame; water splash 8-frame; ship/ground explosion 12-frame; smoke plume 6-frame loop; tracer impact 4-frame; 3 debris sprites | 3 | 40 |
| **Backgrounds / terrain** | Ocean base tile + 4-frame shimmer (palette-swapped per theatre at runtime); island/atoll autotile set ≈ 70 tiles; theatre-specific props 5 × 15 = 75 (palms, huts, watchtowers, tanks, docks, runway, cranes, volcanic rock, storm dressing); shore-foam autotile 8 tiles × 3-frame loop; 8 submerged wrecks; carrier-deck set 12; cloud/weather overlays 3 | 177 | 20 |
| **HUD / UI** | Jerrycan gauge frame + segments, progress meter frame + fill, boss bar frame + fill, rank pips on/off, banner plate, warning band, 3 star-objective icons, 4 buttons, results panel, score/multiplier plate | ~19 | 0 |
| **Screens** | Title art, mission map + 5 node icons, results background, diegetic radar-console loading screen (1 large panel + 2 dial needles) with 4-frame radar sweep and 3-frame lamp blink | ~11 | 7 |
| **Type** | 1 pixel display face + 1 numeric face | 2 | — |
| **Total** | | **≈ 443** | **≈ 231** |

Notes for comparison purposes:

- **≈ 674 authored images in total, of which ~231 exist purely as animation
  frames.** There is no runtime-transform shortcut available in this idiom:
  banking, turret aim, prop blur, water motion, smoke and every explosion are
  drawn.
- **Assets are small and many** (mostly 16-128 px, tiles at 16 or 32 px),
  rather than large and few — individually fast to author, but the count is
  what it is.
- The load concentrates in **terrain (177 sprites/tiles)** and **bosses
  (180 sprites + 70 frames)** — i.e. in the two things that give this
  concept its identity (a scrolling sense of place, and capital ships
  dismantled section by section).
- **Available levers if the count needs cutting**, all of which cost
  something visible: share one master island tileset across all five
  theatres with palette swaps only (−50 to −60); drop to 3 bank states
  instead of 5 (−4 sprites, −4 frames, coarser feel); 2 turret aim angles
  instead of 3 (−20); 3 bosses instead of 5 (−100 or so).
- **Pixel art is the weaker fit for direct Kolbo generation.** Single hero
  frames generate well, but coherent multi-frame sequences and a tile set
  that seams correctly typically need a hand cleanup/consistency pass per
  frame, so the effective cost per asset is higher than the raw count
  suggests.
- POC needs roughly **35-40 of these** (1 hull tier × 3 banks with prop
  frames, 1 enemy type, 2 projectiles, ocean tile + shimmer, a minimal island
  set, 2 HUD bars) plus placeholders.

## Inspired by

- **airPlanes.md** — the whole substance of this brief. Specifically:
  - **The composite read**, taken verbatim as the design target: *"the ideal
    reference is Space Shooter's readability and formation grammar wearing
    1945 Air Force's damage model, progress meter, cooldown special and art
    direction."* That's exactly what this is — geometric legible formations,
    the fuel-can attrition bar, the kill-% meter, the cooldown-cadence
    screen-clear, and the pixel-art/diegetic-UI direction.
  - **The landscape analysis** — the three-band budget (player bottom 30 %,
    enemy top 30 %, ≥ 25 % transit gutter), wide-shallow 10-14 × 2-3
    formations, the dive re-choreographed as a horizontal swoop, wide bosses
    with turrets spread across the width, margin HUD, single-slot banner
    queue, and the observation that 1945's *"curved column flybys (entering
    from the side edge and arcing) already work this way and port almost
    unchanged"* — which is what the side-entry approach path is built on.
  - **The three required trims** — demote the vertical axis, slow the threat
    clock, re-home the bomb — all three answered concretely above rather
    than acknowledged.
  - **The F2P table**, applied line by line, including *"Keep the lure, drop
    the wallet"* for coins and *"Keep the beat, earn it"* for the spin
    wheel.
  - **The retro-PC lineage finding** — *"the shop-between-levels loop is
    retro-PC heritage, not an F2P invention... keeping the former while
    dropping the latter is historically legitimate, not a compromise"* —
    which is the direct justification for the carrier-deck beat existing at
    all.
  - **Sky Force Reloaded** as the named proof point that objectives-plus-
    growth works without energy, gacha or ad-gates.
- **Amit's `notes.txt` for the airPlanes folder**, quoted directly:
  - *"WE ARE 16:9. These reference games are portrait mobile games. Do NOT
    carry their portrait framing across. Everything about the layout,
    playfield shape, enemy formations, scroll direction, readable danger
    zone and UI placement has to be re-thought for a 16:9 landscape
    screen."* — the framing section above is the answer to this note, and
    it's the reason the enemy approach path was redesigned rather than
    rotated.
  - *"WE ARE NOT CLASSIC FREE-TO-PLAY... say what the loop was actually
    DOING for pacing/progression, so we can keep the good part (session
    shape, sense of growth, difficulty ramp) without the monetisation
    scaffolding."* — the chevron ladder and carrier deck are the "sense of
    growth" kept; the currencies and shop are gone.
  - *"Both take strong reference from retro PC games (classic vertical
    scrolling shoot-'em-ups / arcade shmups). That retro-PC lineage is the
    thing I want understood."* — hence a 1942/1943-descendant with a
    Raptor/Tyrian hangar beat, not a mobile-casual reskin.
  - *"Treat the two games as a pair: what do they share (the genre core
    worth taking), and where do they differ (the design choices that are
    optional/interchangeable)?"* — this brief takes the 1945 Air Force half
    of that pair (terrain, attrition, capital-ship bosses); the TMNT-track
    brief `shellshot-skyline` takes the Galaga/Space Shooter half (static
    formation arena, geometric grammar), so the two proposals cover the two
    ancestries rather than duplicating one.
- **Existing GoBalance lean-axis finding** (left/right comfortable,
  forward/back hard) — the reason Option A is rejected as a core framing
  despite being the better readability answer.

## Concept frame

Prompt used (also saved to `concepts/prompt.txt`):

> Wide 16:9 landscape video-game key art in richly detailed hand-crafted
> pixel art, in the tradition of 1943 and Strikers 1945 but deliberately
> rebuilt for a widescreen frame. Top-down aerial view of a bright tropical
> Pacific ocean at mid-morning: a long low coral atoll with white beaches, a
> wrecked freighter, and submerged ship silhouettes visible under
> desaturated blue-green water, the whole terrain layer painted low-contrast
> so the action above it reads clearly. In the bottom third of the frame, a
> single small yellow-nosed prop fighter with US roundels flies low and
> banks hard to the left, trailing thin exhaust; its own fire is a stream of
> bright cyan-white tracers going straight up. Stretched across the entire
> width of the middle of the frame, seen lengthwise broadside, an enormous
> grey battleship boss with multiple destructible gun turrets spread along
> its deck, one turret already blown open and burning, thick black smoke
> drifting sideways. Across the top of the frame, a wide shallow formation
> of twelve small enemy fighters locked in two neat rows. Enemy fire is
> large, slow, individually readable orange-red flame-teardrop bullets with
> magenta trails, sparse and sweeping laterally with one clear wide gap
> through them. A glowing chevron power-up icon drifts down toward the
> player plane. HUD lives in the margins only: a vertical segmented
> jerrycan-style fuel gauge up the far left edge, a vertical
> mission-progress percentage meter up the far right edge, a thin
> full-width red boss health bar pinned along the very top edge. Saturated
> but restrained palette, crisp readable sprites, the centre of the frame
> kept uncluttered. Retro arcade shoot-em-up key art.

Generated with `nano-banana-pro`, no reference images (the report's own
description of 1945 Air Force's pixel craft is the style anchor). Four
variations are in `concepts/concept-01.png` through `concepts/concept-04.png`
— note that they double as a layout test: the wide broadside boss, the
shallow top formation, the margin HUD and the low player band are all
visible in-frame, so it's worth judging them as a mock playfield, not only
as key art.
