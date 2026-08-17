---
status: proposed
track: tmnt
source_reports: [airPlanes.md]
---

# Shellshot Skyline

**One-sentence hook:** Michelangelo hovers over one rooftop of New York on a
hoverboard Donnie welded out of a delivery scooter and a stolen Foot drone,
auto-flinging shuriken upward while Foot quadcopters fly in from the wings
and lock into wide, shallow formations across the skyline — a Galaga arena
in *Mutant Mayhem* clothes, where the only thing you ever do is slide left
and right.

**Genre:** 2D single-screen formation shoot-'em-up (Galaxian / Galaga
lineage), auto-fire, free continuous lateral positioning, **no scroll at
all**.

## Core loop

- Mikey hovers in the bottom ~30 % of a fixed, non-scrolling rooftop vista
  and slides freely across its full width. Shuriken throw upward
  automatically — **no fire button, no bomb button, no jump**. The only verb
  is *where do I stand*.
- Waves fly in from the **left and right edges** along long looping paths,
  cross the width, and **lock into a wide shallow formation** (10-14 across,
  2-3 deep) in the top ~30 %. Killing them mid-entry, before they settle, is
  the skill play — that's Galaga's actual design, and it rewards reading the
  entry arc rather than reacting to a plunge.
- Locked drones peel off in **horizontal swoops**: they arc across the width
  and dip toward you, then curve back up — they never plunge straight
  through your band. Their fire is sparse, fat, slow, and sweeps sideways
  with a guaranteed gap.
- Pizza slices drop and raise your throw rank 1 → 10 across a stage (single
  star → triple spread → spinning arc). Bonus pickups (Mikey's nunchuks, a
  sewer-lid shield, a manhole of loose change) are placed **off the safe
  line** on purpose, pulling you up into contested air.
- Each stage is ~90-140 s, ends on a **wide boss** — Wingnut with a wingspan
  filling the frame, a Baxter Stockman drone-carrier with turret pods spread
  along its hull, Superfly's swarm cloud as one multi-part entity — with a
  full-width HP bar along the top. Three free star objectives per stage, and
  clearing a stage unlocks the next rooftop.

## Framing decision: the arena, with the scroll removed entirely

**This is Option B (wide arena, dodge on left/right) taken to its logical
conclusion: don't scroll the playfield at all.**

The report frames the choice as A (rotate to a Gradius horizontal scroller,
great reading time, dodge on the expensive up/down lean) versus B (keep the
vertical scroll as a wide arena, dodge on the comfortable lateral lean, pay
for the lost depth in slowed pacing). Both options are trying to solve the
same thing — the ~75 % of reaction budget the aspect change eats — and both
pay for it out of the *travel* budget.

There's a third source of reading time the report's own research points at
without naming it as an option: **Galaxian and Galaga were single-screen
games.** Their reading time doesn't come from travel distance at all, it
comes from the *hold* — enemies fly in, settle, and sit there in a legible
grid while you decide. That structure is nearly aspect-ratio-independent,
which makes it the cheapest possible answer to a shallow frame. This concept
takes it: nothing scrolls, so nothing gets compressed.

**Why this concept and not the general-track one.** `broadside-coral-line`
is the 1945 Air Force half of the report's pair — terrain, attrition,
capital ships, a scrolling sense of a mission being flown. That game *needs*
its scroll. This one is the Space Shooter / Galaga half, where the report
says the value is *legibility* (*"a grid is instantly parseable"*), and
legibility is what a static arena maximises. Splitting the two ancestries
across the two proposals is deliberate: they're the same input shape, but
genuinely different games to play and to build.

**Option A is rejected here for the same reason as in the other brief**, and
one extra: a horizontal scroller would put Mikey's dodge on up/down, the
expensive lean, and there's nothing this concept gains in return — it has no
sense-of-travel to preserve, since it isn't travelling.

**Paying the reaction-budget bill concretely.** Not scrolling removes most
of the debt, but not all of it — a shallow frame still shortens every
descent. So:

- Swoop dives and drifting fire run at **~50 % of reference speed**; the
  shortest enemy-band-to-player-band bullet travel is **≥ 1.2 s**.
- Bullets are **~1.8× reference size**, hard-capped at roughly **20 on
  screen**; density is bought with size, not count.
- Every pattern guarantees an aisle **≥ 2.5× Mikey's hitbox width**, and
  only one sweeping pattern is live at a time.
- Formation entry paths are the telegraph: a wave takes **~2 s** to fly in
  and settle in full view before it can attack, and swooping drones flash a
  red targeting line **~1 s** before they commit.
- Decision cadence targets **one committed lean per ~1.5 s**.

**Explicitly not ported**, per the report's do-not-port list: diagonal
staircase bullet curtains; anything firing from below (no simultaneous
top-and-bottom pressure, ever — that's the pattern that forces an emergency
forward or back lean); any aisle narrower than realistic lean precision; and
Galaga's straight-down plunge, replaced throughout by the horizontal swoop.

## The bomb, re-homed: automatic — "Cowabunga Assist"

There is no thumb on a board. Of the report's three re-homing options this
concept commits to **option 1, automatic**, and gives it a fiction:
Leo, Raph and Donnie are on the next rooftop over as backup. When the
on-screen threat score crosses a threshold — too many bullets, aisle
collapsing, Mikey pinned against an edge — **a brother fires a screen-clear
from off-frame**: Donnie's EMP pulse, Raph's thrown sai barrage, Leo's slash
wave. It clears bullets, damages everything, and then goes on a visible
cooldown up the left margin.

Why automatic here, when the general-track brief picked pickup-triggered:

- It's a **deliberate contrast, so the two proposals test different
  answers** — Amit gets a real choice between "mercy as a positioning
  decision" and "mercy as an authored safety net", rather than the same call
  made twice.
- It suits *this* game specifically. A static arena has no drops falling
  from an approaching horizon to attach a pickup to, and the formation
  grammar means the dangerous moments are pin-against-the-edge moments —
  exactly when flying to fetch a canister would be impossible. Automatic
  fires precisely when the player can no longer solve the problem by
  moving.
- The report's warning about **option 3 (a lean gesture)** applies with full
  force: a hold-at-extreme under pressure risks the forward/back axis at the
  worst moment. Ruled out.
- The report also prefers 1945's cooldown dial to a purchasable count. Kept:
  the Assist is a cooldown, never an inventory, never bought.
- It's also the strongest walk-up-player affordance in either brief. A first
  timer on a board in a public space gets rescued without knowing a rescue
  system existed.

## Why it fits GoBalance

- **Auto-fire, so no action button exists in the loop at all** — the entire
  input budget is movement, which the report calls the single most
  GoBalance-relevant property of the genre.
- **Free continuous lateral movement, not lanes** — matches the established
  GoBalance preference.
- **The reflexive load is 100 % left/right, and here that's not just a
  target, it's near-total.** Because nothing scrolls, there is no reason to
  climb the frame to make progress. Vertical movement exists only as a slow
  optional nudge — drifting up a little to snatch a pizza before it falls
  past, or closing on Wingnut's wing-root during a scripted vulnerable
  window — always with multi-second windows. **No stage can require a fast
  vertical move to survive.** Of the two proposals this is the more
  conservative one on the input axis, deliberately.
- **A hit doesn't end the turn.** Mikey has a shell-integrity bar
  (1945-style attrition, not Space Shooter's discrete lives) that chips
  down, so no single missed dodge costs a walk-up player their whole go, and
  no dodge is ever a frame-perfect reflex window.
- **HUD lives in the margins**: vertical shell-integrity gauge up the left
  edge with the Assist cooldown beneath it, vertical stage-progress
  percentage up the right edge, full-width boss bar along the top, and a
  single-slot banner queue. The centre-top stays clear for incoming waves.
- **The static camera is a real physical-comfort bonus** on a board. There's
  no scrolling parallax field to track while leaning — the player's eyes
  stay on a stable scene, and the only moving things are the ones that
  matter.

## No IAP, no cross-session meta — and what replaces it

Everything monetisation-shaped from the references is gone: coins, gems,
parts, dog tags, energy, the consumable shop, the spin wheel, the ad button,
VIP, battle pass, daily tiles and the aircraft power ladder. Nothing in this
loop depends on any of it.

Growth lives **inside the run**: the pizza rank ladder 1 → 10 across a
stage, resetting at the next stage's start. Progression lives **inside the
game**: a campaign of rooftops where clearing one unlocks the next, with
three free star objectives per stage as the skill ladder on top (the
report's Sky Force proof point — objectives as the thing that gates the next
stage, no currency involved). The four turtles are a **cosmetic pick**
offered up front, not an unlock web — swapping to Raph or Donnie changes
the throw sprite and voice, not the numbers. Between sessions, only a local
best-score board persists.

Note this brief deliberately does **not** carry the Raptor/Tyrian
between-mission hangar beat — that's `broadside-coral-line`'s device, and
duplicating it would make the two proposals more similar than they should
be. Here the growth device is the pure Galaga-style in-stage rank ladder.

## Scope tiers

**POC** — One static rooftop backdrop, Mikey as a single placeholder sprite
sliding laterally with auto-fire, one drone type that flies in from the side
edges and locks into a 12 × 2 formation, one lateral sweep bullet pattern
with a guaranteed aisle, the swoop-dive behaviour, the shell-integrity bar,
no boss, no pizza ranks, no Assist, no scoring UI. The question it answers:
**does a non-scrolling formation arena still feel like a shmup on a
widescreen frame, and is "read the entry arc, hold a lateral line" fun for
90 seconds on a board?** Placeholder art.

**MVP** — A 5-rooftop campaign of ~90-140 s stages (fire escape alley →
Chinatown rooftops → a construction crane → the Brooklyn Bridge towers →
a TCRI lab roof). Pizza rank ladder 1 → 10, off-line bonus pickups as
flight-path lures, the Cowabunga Assist auto-clear on its cooldown, 5-6
enemy types (Foot quadcopters, mutant wasps, jetpack Foot soldiers, a
shielded heavy drone), 4-5 formation shapes and 4-5 bullet patterns under
the density/aisle caps, one wide boss per stage with destructible parts,
three free star objectives per stage, the stage-progress percentage meter,
an escalating end-of-stage multiplier reveal (accuracy / no-hit streak /
objectives / boss time), a difficulty ramp across the campaign, cosmetic
turtle pick, and a full *Mutant Mayhem*-style art pass with a diegetic
Donnie-workbench loading screen (the report's admiration for 1945's radar
console, translated to a taped-together turtle-tech panel).

**Post-MVP** — More rooftop vistas and times of day (rain, dawn, a Times
Square billboard blaze), a bigger bestiary and more *Mutant Mayhem*-roster
bosses (Superfly, Bebop and Rocksteady as a paired two-part boss, Ray
Fillet over the East River), per-turtle throw behaviours as a real
gameplay-flavour choice rather than cosmetic, harder late-campaign formation
choreography still inside the same density/aisle/reaction-time caps, a
survival "swarm" mode built from the same wave library, and a local
high-score board. More of the same kind of thing, bigger — no currency, no
cross-game unlocks, no IAP.

## Inspired by

- **airPlanes.md** — the mechanical spine, borrowed from the Space Shooter /
  Galaga half of the report's pair and theme-swapped to TMNT rather than
  reskinned wholesale:
  - The **Galaga lineage section**, which is what the static arena is built
    on: *"waves fly in along a path before locking into formation, giving
    the player a window to kill them pre-formation"* — that window is this
    game's core skill expression, and it's also where its reading time comes
    from.
  - The **landscape-conversion rules**: wide-shallow 10-14 × 2-3 formations
    in the top 30 %, player home band in the bottom 30 %, a ≥ 25 % transit
    gutter nothing camps in, the dive re-choreographed as a horizontal
    swoop, wide multi-part bosses, margin HUD, single-slot banner queue.
  - The **legibility verdict** — *"Space Shooter for legibility (a grid is
    instantly parseable)"* and its contrast discipline against a dark,
    uncluttered field — which is why the rooftop vista is painted
    desaturated and low-contrast under the action layer, heeding the
    report's warning that 1945's cloud scrim and busy island art
    *"measurably hurt readability"*.
  - The **three required trims** — demote the vertical axis, slow the threat
    clock, re-home the bomb — answered concretely above, plus the
    do-not-port list applied in full.
  - The **F2P audit**, especially *"Keep the lure, drop the wallet"* (bonus
    pickups as placement design, no wallet) and *"Keep the beat, earn it"*
    (the multiplier reveal replacing the spin wheel), and the Sky Force
    proof point for objectives-gate-the-next-stage progression.
  - The **colour discipline** the report says to *"carry over verbatim"* —
    player fire in bright cyan-white, enemy fire in orange-red, never
    confusable.
- **Amit's `notes.txt` for the airPlanes folder**, quoted directly:
  - *"WE ARE 16:9. These reference games are portrait mobile games. Do NOT
    carry their portrait framing across. Everything about the layout,
    playfield shape, enemy formations, scroll direction, readable danger
    zone and UI placement has to be re-thought for a 16:9 landscape
    screen."* — this concept's answer is the most aggressive one available:
    **remove the scroll direction entirely** rather than re-point it, which
    is only possible because the Galaga ancestor never had one.
  - *"WE ARE NOT CLASSIC FREE-TO-PLAY... keep the good part (session shape,
    sense of growth, difficulty ramp) without the monetisation
    scaffolding."* — the pizza rank ladder is the sense of growth, the
    rooftop campaign is the difficulty ramp, the ~2-minute stage is the
    session shape; the wallet is gone.
  - *"Treat the two games as a pair: what do they share (the genre core
    worth taking), and where do they differ (the design choices that are
    optional/interchangeable)?"* — the two proposals from this report are
    that split made concrete: `broadside-coral-line` takes the 1945 Air
    Force side, this one takes the Space Shooter / Galaga side, and they
    resolve the bomb question in two different ways on purpose.
- **`/Users/eladayzen/Documents/tmnt/`** — *Mutant Mayhem*-era stills as the
  art-direction pointer: rough painterly hand-drawn-over-CG linework,
  teenage-scrawl energy, grimy neon New York, turtles that look like
  hand-made kids rather than toyetic action figures. Donnie's hoverboard is
  written to match that world's junk-built-tech logic rather than reading as
  clean sci-fi.
- **Existing GoBalance lean-axis finding** (left/right comfortable,
  forward/back hard) — the reason a Gradius framing is rejected and the
  reason this concept is written to be winnable with essentially zero fast
  vertical input.

## Concept frame

Prompt used (also saved to `concepts/prompt.txt`):

> Wide 16:9 landscape video-game key art in the rough, painterly,
> hand-drawn-over-CG illustration style of the Mutant Mayhem-era Teenage
> Mutant Ninja Turtles movie: sketchy visible linework, smudged
> marker-and-pencil texture, teenage-doodle energy, grimy neon palette. High
> aerial view over a moonlit Manhattan rooftop skyline at night: water
> towers, tar-paper roofs, crooked satellite dishes, laundry lines and
> billboard haze, all painted in low-contrast desaturated blues and purples
> so the action layer reads clearly on top of it. In the bottom third of the
> frame, Michelangelo, orange mask tails streaming, rides a jury-rigged
> hoverboard hacked together from a delivery scooter and stolen drone tech,
> crouched and leaning hard to his left, flinging a fan of glowing throwing
> stars straight upward. Across the top of the frame, a wide shallow
> formation of twelve Foot Clan quadcopter drones locked in two neat rows,
> red sensor eyes glowing. Enemy fire is large, slow, individually readable
> orange-red energy bolts, sparse, with one clear wide gap through them.
> Looming across the upper right, the huge silhouette of Wingnut, a giant
> mutant bat, wings spanning most of the frame's width. A glowing
> pizza-slice power-up drifts down toward Mikey. HUD lives in the margins
> only: a vertical green shell-shaped health gauge up the far left edge, a
> vertical mission-progress percentage meter up the far right edge, a thin
> full-width health bar along the very top edge. The centre of the frame is
> kept uncluttered.

Generated with `nano-banana-pro`, using three *Mutant Mayhem*-era stills
from `/Users/eladayzen/Documents/tmnt/` (`Michelangelo2023.webp`,
`tmnt-mutant-mayhem-character-posters_3ef5.jpg`, `tmnt-mutant-mayhem.avif`)
as style/mood guidance. Four variations are in `concepts/concept-01.png`
through `concepts/concept-04.png` — they read as a three-quarter rooftop
vista rather than the flat top-down the playfield would actually use, which
is worth judging deliberately: the vista framing is more attractive as key
art, and it's an open question for stage 3 whether the playable camera
should follow it or flatten out for readability.
