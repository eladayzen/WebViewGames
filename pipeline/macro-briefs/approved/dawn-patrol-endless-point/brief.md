---
status: approved
track: general
source_reports: [WaveSurf.md]
---

# Dawn Patrol: Endless Point

**One-sentence hook:** A chibi kid surfer gets dropped onto one enormous
breaking wave at dawn and rides it for as long as she can — side-on, held at
a fixed screen x, with her height on the wave face as the single, continuous,
only thing the player controls — climbing toward the lip to launch into
automatic aerials that are the whole scoring ceiling.

**Genre:** One-axis 2D endless surface-rider with a trick-scoring layer —
the Tiny Wings / Ski Safari / Alto's branch, not the lane-runner branch.
Continuous position, no lanes, no buttons, auto-scrolling right-to-left.

> **This brief is deliberately a faithful build of the reference, not a
> reinterpretation of it.** Per Amit's instruction for this run, the camera,
> the genre, the structure, the pacing and the scoring shape of the game in
> `WaveSurf.md` are all preserved as observed. The surfer, the coast and the
> hazard bestiary are reskinned off the licensed-looking original into an
> original identity; the *game* is not changed. Every place below where this
> brief departs from the reference is because the reference footage did not
> show the answer, or because a platform constraint forces it — and each of
> those is flagged explicitly rather than quietly absorbed.

## Core loop

- A boat drops you onto the shoulder of one continuous, procedurally
  extended breaking wave. The wave scrolls right-to-left at a constant rate
  (~2.2 s to cross a screen width, as measured in the report); you are held
  at a fixed screen x around 25% from the left. The camera never chases you
  horizontally.
- **Your height on the wave face is the entire game.** One continuous axis,
  free movement, no lanes, no snapping. Climb toward the curling lip at
  upper-left, or drop toward the trough at the bottom. Everything else —
  dodging, collecting, launching — is a consequence of that one decision.
- Hazards (rocks breaching the face, drifting jellyfish, a big telegraphed
  urchin-puffer that holds station at the screen edge before closing) and
  pickups (gold coin arcs, multiplier orbs) are placed at specific heights
  on the face, which makes "where should I be" a risk/reward question rather
  than a pure safety question. Reaction budget is ~1.6–1.7 s from a thing
  appearing at the right edge, exactly as measured in the reference.
- Carry enough climb into the lip and you **leave the wave**. Airborne time
  converts automatically into rotation payouts (360 / 720 / 1080 …, drawn as
  big slab numerals in world space). You do nothing while airborne — these
  are the highest-scoring moments *and* the rest beats.
- Orbs collected off the face fill slots at the screen edge that stack into
  escalating multipliers (2x → 3x → 6x); topping the stack drops you into
  the quiet, high-value **inside-the-wave barrel section** — a dim green-blue
  interior of kelp and drifting bubbles, coins strung through it, then you
  pop back out onto the face. Base score is a flat rate per second of
  survival; tricks and multipliers are the skill ceiling on top.

## Why it fits GoBalance

On raw input demand this is the best-fitting reference the pipeline has
reviewed, and the report says so in those words: **one axis, no buttons, no
jump, no trick button, no panic button, ~1.6 s reaction windows, generous
gaps between large individually-trackable obstacles, momentum-based movement
that takes ~3 s to cross the full face.** There is nothing to trim. But there
is one real problem, and this brief's central design decision is the answer
to it.

### Central design decision: the wave face is driven by LATERAL lean

The reference's one axis is screen-*vertical* and it is a *sustained hold* —
gravity constantly pulls you down the face, so you spend most of the run
holding "up." The naive mapping puts that entire continuous hold on
forward/back lean, which is the platform's expensive axis. That is the
worst-case exertion pattern on this hardware, and it is disqualifying.

The report offers two escapes — remap the axis, or rotate the wave so the
face runs left-to-right on screen. **This brief takes the remap and rejects
the rotation.** Rotating the world would throw away the landscape side-on
framing that this entire genre depends on, and the instruction for this run
is to keep the camera and the framing the reference had. So:

- **Lean left = climb the face toward the lip. Lean right = drop toward the
  trough/shoulder.** Free and continuous — lean harder to climb harder, ease
  off to ease off. No discrete positions anywhere.
- This is more defensible than a shrug at intuitiveness. First, **surfing is
  literally a weight-shift-across-the-board sport** — climbing and dropping
  on a face is toe-side/heel-side pressure, not leaning forward and back
  (forward/back on a surfboard is trim and stall, which is not the verb this
  game uses). A lateral lean reading as "carve up the face / drop down the
  face" is the *physically correct* gesture, not a compromise. Second, it is
  spatially coherent on screen: the wave face is a **diagonal**, the lip and
  crest sit up-and-to-the-**left**, and the trough opens down-and-to-the-
  **right**. "Lean left to go up the wave" points at the actual on-screen
  direction of the lip. Players read it in one run.

### Second decision: board-neutral is a survivable mid-face trim line

Honoring the report's explicit recommendation. Even on the comfortable axis,
"hold a lean for twenty seconds straight" is tiring, and the reference's
gravity-pull model demands exactly that. So the surfer **auto-trims**: with
the board at neutral she holds a stable, survivable mid-face line
indefinitely. Lean is *deviation* from that line — climb to reach the lip
and the high-value pickups, drop to duck under something or reach a low coin
arc — and releasing eases her back to trim.

This costs the design nothing, because the moment-to-moment decision is
identical ("what height do I want to be at when that thing arrives"); it only
removes the exertion tax of a permanently-held input. Neutral is never
"falling into the trough." Riding the trim line survives; riding the trim
line also scores the floor and nothing more, so the player leans because they
want the ceiling, not because the board will kill them if they stand still.

### Third: the aerials are free rest, and they are the best-scoring moments

The report calls this out as a gift and it is. Several seconds of airborne
time with the board at neutral and nothing to do, repeatedly, mid-run — and
those are the highest payouts in the game. For an exertion product, a loop
that pays you most while you stand still is close to ideal pacing.

## The two things the footage did not answer

Both of these are flagged as **this brief's inventions / assumptions**, not
as observations of the reference, and both are the first things to sanity-
check at POC.

### (a) The fail state is undocumented — so this is my design, not theirs

The report is blunt that this is its biggest hole: **no crash, no wipeout, no
game-over, no results screen and no menu appears anywhere in the 108 s of
footage.** The score is monotonic throughout; the recorded player simply
never died. Collision rules are equally unknown — whether fish are lethal,
damaging or merely slowing, and whether the pelican is a hazard or a trick
target (frame 13 suggests target). Everything in this section is invented to
fill that hole:

- **One fail source only: contact with a hazard.** Rocks, jellyfish, the
  urchin-puffer. Nothing else kills you. The lip is a launch ramp, not a
  boundary; the trough is safe but low-scoring and hazard-dense. Deliberately
  **no second fail axis at the bottom of the face**, because a "don't sink
  into the trough" fail would reintroduce exactly the constant-lean pressure
  the trim-line decision just removed.
- **A three-wipeout leash per run.** A hit is a tumble: you lose the
  multiplier stack, lose ~2 s of scoring, and the wave re-forms under you at
  the trim line. The third hit ends the run and shows a score card. Rationale
  is the walk-up-turn product reality — a first-timer standing on a physical
  board should not have a 15-second run — not a lives economy. No revives, no
  continues, no currency, nothing purchasable, ever.
- **POC should A/B this against one-hit-ends-it**, which is the more
  traditional endless-runner answer and might simply feel better. I have no
  evidence from the reference either way.
- The pelican-as-trick-target reading is worth keeping: at least one "hazard"
  silhouette that is actually a bonus if you hit it airborne is a nice
  wrinkle, and it is the only collision the footage arguably *does* show.

### (b) Trick triggering — resolved to zero extra inputs, as an assumption

The report infers tricks fire **automatically while airborne** (no visible
button, no touch affordance, payouts appear unprompted) but flags that the
external description of the orb system — "collect four of the same sequence
orb → perform a special move" — *might* be player-triggered, and that if it
is, there is a second input and the whole GoBalance read needs revisiting.

**This brief resolves it hard toward zero buttons, and that is a design
commitment, not a reading of the footage.** The zero-input quality is the
single biggest reason this genre fits the board at all, so we do not spend it:

- Airborne tricks fire and score **automatically**, scaled by airtime and
  rotation. The player does nothing in the air.
- Landings are **automatic and always clean**. No landing-timing input, no
  botched-landing fail.
- Orbs fill the multiplier slots **on pickup**; a full stack fires the barrel
  section **on its own**. The slots are status readouts, never buttons — which
  matches what the report actually observed.
- Net: the entire game is one continuous lateral lean. There is no second
  input anywhere, at any scope tier, including Post-MVP.

## What is deliberately dropped from the reference

Not a reinterpretation — a platform constraint. The reference opens with a
**"TAP TO ACTIVATE" screen offering COIN BOOST ×28 and SCORE BOOST ×20**
consumables and carries a persistent coin wallet across runs. That is a
free-to-play currency/consumable economy and it is out permanently, not as a
scope cut. Coins stay, but purely as an in-run score component — they are
points strung along the face, not a wallet.

The **`TOP RUN`** panel does stay, because it is genuinely good and it is
in-game progression rather than meta: the report's best measured finding is
that the number under the rival's portrait is **not the rival's score, it is
the live remaining gap to it, ticking down as you earn**. Here that becomes an
in-game crew ladder — a small fixed set of named local surfers whose marks
you climb through inside the game itself. No online service, no cross-game
leaderboard, no account. (And per the report's own note, the panel must not
overlap in-world objects the way the reference's does.)

## Scope tiers

**POC** — One endless wave, placeholder art. Lateral lean drives height on
the face continuously; auto-trim neutral line; constant scroll speed; one
hazard type; hazard contact ends the run; a raw time-based score counter and
nothing else. No tricks, no coins, no orbs, no barrel, no difficulty ramp.
The two questions it exists to answer: does **lean-left-to-climb** read as
surfing to someone standing on the board without being told, and is a
**neutral trim line plus deviation** actually comfortable across a 2–3 minute
standing session. If either answer is no, nothing downstream matters.

**MVP** — The complete loop as observed. Flat per-second base score, coin
arcs, the orb → multiplier-slot stack (2x / 3x / 6x), automatic aerials off
the lip with rotation payouts and auto-landing, the inside-the-wave barrel
bonus at a full stack, three hazard types plus breaching rocks, four or five
set-dressing zones cycling along the one continuous track (open sea with sea
stacks → rock arch → driftwood pier → tide-pool islet → rock-overhang
tunnel) with no load break, a difficulty ramp on scroll speed and hazard
density over the run, the three-wipeout leash and a score card, and the crew
ladder with about five marks to beat. One character.

**Post-MVP** — More of the same kind of thing, bigger. More zones and a
day→dusk→night lighting cycle plus a rain/storm pass (the reference has one);
a longer rideable headland/beach-break stretch where you ride sand and rock
instead of water, which the reference does and which is pure set dressing
along the same one axis; a wider hazard and pickup vocabulary; harder
late-run hazard patterns as the in-run ceiling; more crew marks; and two or
three alternate surfers with slightly different trim feel, unlocked by
hitting in-game score marks. No currency, no purchases, no cross-game
unlocks, and still no second input.

## Inspired by

- **WaveSurf.md** — this is a direct, faithful build of that reference, and
  almost every structural element above is lifted from it rather than
  invented: the side-on single continuous breaking wave scrolling
  right-to-left; the surfer pinned at a fixed screen x ~25% from the left;
  **"The player's position on that face is the whole game"**; the hazard and
  pickup bestiary on the face; the aerials off the lip with rotation-degree
  payouts (720 / 4320 / 25920); the orb → left-edge multiplier-slot stack and
  the underwater barrel section at 6x; the flat time-based base score with
  skill layered on top (**"survival is the floor, skill is the ceiling"**);
  and the continuous environmental variety along one endless track with no
  level transition.
- **The report's measured numbers set the pacing targets directly** —
  ~0.45 screen-widths/second of scroll, ~1.6–1.7 s from spawn to the player's
  x, ~3 s to traverse the full height of the face, six obstacles at four
  heights at the densest sampled moment with multi-body-width gaps. These are
  the MVP's tuning starting points, not re-derived guesses.
- **The report's input section is the reason this brief exists at all**, and
  its one open question is this brief's central decision: *"The core axis is
  screen-vertical … the obvious naive mapping would put the entire game on
  the expensive axis, and this game asks the player to sit on that input
  continuously."* The lateral remap and the trim-line neutral are the
  report's own two recommendations, taken up rather than worked around.
- **Its visual-style section is the art direction.** The palette discipline
  is the thing worth stealing wholesale: a narrow cool band of slate, teal
  and off-white, with **gold coins and the player's warm top as the only warm
  colours on screen**, so the player is always instantly findable. Also taken
  up: the report's criticism that blue-and-yellow fish on teal water is the
  frame's weakest contrast pairing — so hazards here get a dedicated value
  slot (near-black and deep violet with white foam collars) that does not
  neighbour the water hue. And the wave is a painting, not a shader: brushed
  teal-to-navy gradients, hand-drawn sunlight streaks through the lip, chunky
  opaque foam — which is also the project's standing rule about illustrated
  environment surfaces rather than procedural canvas patterns.
- **`notes.txt`: none existed.** The report states plainly that the
  `WaveSurf` folder contained no notes file of any kind, so there is no
  verbatim line of Amit's from stage 1 to quote here. What stands in its place
  is his direct instruction for this run, which governed every choice above:
  keep it *"recognizably the same game as the reference — the 2D side-on
  endless surf runner on a single continuous breaking wave, player held at
  fixed screen x, height-on-the-wave-face as the one and only control axis,
  aerials off the lip as the scoring ceiling … Reskinning the surfer/setting
  for a non-TMNT identity is expected and fine — changing the game is not."*

## Concept frame

Prompt used (also saved to `concepts/prompt.txt`):

> 2D side-scrolling video game key art, hand-painted illustrated storybook
> style with visible brush texture and confident varying line weight -- not
> vector-flat, not 3D-rendered, no photorealism. Side-on view of one enormous
> continuous breaking ocean wave at dawn, filling the lower two-thirds of a
> wide frame. The wave's curling lip and a chunky white foam wall occupy the
> left edge; the broad sloped wave face sweeps down and to the right toward
> the trough at the bottom edge. A chibi-proportioned kid surfer -- big head,
> small body, large expressive eyes, short dark hair, wearing a bright
> coral-orange wetsuit top -- is carving high on the wave face about a quarter
> of the way in from the left edge, throwing a plume of spray, board tilted
> into the climb. Above the crest: pale dawn sky with soft parallax clouds and
> distant grey-violet sea stacks. On the wave face ahead of her: a strung arc
> of glowing gold coins curving down the face, a small floating multiplier
> orb, a dark near-black rock breaching the water with a white foam collar,
> and a deep-violet jellyfish silhouette. Strict palette discipline: the
> entire frame lives in a narrow cool band of slate blue, teal, grey-violet
> and off-white, and the ONLY warm colours anywhere are the gold coins and the
> surfer's coral top, so she is instantly findable against the water. Broad
> brushed teal-to-navy gradients on the wave face with hand-drawn white
> sunlight streak marks refracting through the lip. Warm, charming,
> calm-but-fast mood. Wide 16:9 game key art framing. No text, no UI, no logo,
> no watermark.

Generated with `nano-banana-pro`, 16:9, no reference images (the reference
game's look is described in the report's "Visual style notes" and was written
straight into the prompt). Four variations are in `concepts/concept-01.png`
through `concepts/concept-04.png`. All four are deliberately composed as the
actual play framing rather than as a hero poster — fixed player x at ~25%,
lip at the left, hazards and a coin arc placed at readable heights on the
face — so the frame doubles as a layout check. `concept-03.png` came back with
a small purple multiplier disc rendered as an in-world token, which is closer
to the reference's orb treatment than the others and is the best single
starting point.
