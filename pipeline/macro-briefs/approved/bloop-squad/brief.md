---
status: approved
track: general
source_reports: [viral-collapse-clip.md]
---

# Bloop Squad

*(name candidates: Bloop Squad · Monster Pop · Fuzz Patrol)*

**One-sentence hook:** You fly a little bubble-pod through a night full of big
soft monsters, blooping them into confetti and candy — they drift all around
you, past you and below you, and the only way out of trouble is to lean.

**Audience:** eight-year-olds. Everything below is downstream of that.

**Genre:** cute top-down field shooter. Auto-fire, free movement in an open
field, no fail-fast. Structurally the Viral Collapse family (see
`pipeline/reports/viral-collapse-clip.md`) — with its cross-run upgrade economy
removed and its threat model rebuilt for a balance board.

## Core loop

- A round **bubble-pod** with a small fuzzy pilot holds the lower middle of the
  frame and moves freely. It fires **on its own, always** — no fire button. The
  only verb is *where do I float*, and floating is a lean.
- **Monsters drift in from every edge** — big, round, slow, googly-eyed — and
  they pass beside and below the pod. The field is alive in every direction,
  which is the thing the reference does that our other games do not.
- Blooped monsters **pop into confetti and drop candy**. Nobody dies, nothing
  bleeds, nothing screams: a monster that runs out of hearts gets the giggles,
  puffs into shapes and floats off happily.
- Candy buys **upgrades between waves — three cute cards, pick one.** All of it
  is spent by the end of the run.

## The rule that governs everything

> **Every threat must be answerable by leaning sideways.** Vertical movement is
> for greed — reaching a candy, closing on a monster — and never for survival.
> Monsters that will pass the pod announce themselves early and drift slowly;
> nothing dives.

Forward/back lean on this hardware is the expensive, imprecise axis. A field
where things come from below is only playable if none of it *demands* the
expensive axis. This is the one line that cannot be traded away later.

## Art direction — LOCKED to concept-09

Amit, on the third batch: *"09 is a good look."* The frame in
`concepts/concept-09.png` is the art bible. What that commits us to:

- **Flat 2D sprites.** Bold dark outlines, two tones per colour, no gradients,
  no painterly rendering. Every monster is a shape that can be cut, tinted and
  animated by squash-and-stretch in code. This is the cheapest art in the
  pipeline and it was chosen for that as much as for the look.
- **Black space, sparse stars.** The field is nearly empty so twelve monsters
  can be on screen without the screen turning to soup. No painted background.
- **Saturated arcade palette** — lime, orange, teal, violet — against near-black.
- **Monsters, not sweeties.** Horns, little fangs, one or two big eyes. Cute the
  way an eight-year-old boy wants cute: goofy, never scary, never twee.
- **A saucer pod with a delighted pilot**, small relative to the monsters.
- **Coins and confetti on a pop**, which is the reference's reward beat.

Supporting frames: `concept-10` is the motion reference (the curving pellet
ribbon, the three size tiers, the coin burst), `concept-11` the healer tether,
`concept-12` the type roster.

## What makes it read as CUTE (for an eight-year-old)

Cute is motion and silhouette before it is subject:

- **Round everything.** No spikes, no teeth, no points. Silhouettes that read as
  one blob at arm's length while standing on a board.
- **Squash and stretch on every event** — a monster squishes when hit, the pod
  bounces when it turns, candy bobs.
- **Big eyes that look at you.** Monster pupils track the pod. It costs almost
  nothing and it is most of the charm.
- **A pop, not a death.** Confetti, a giggle, a puff.
- **Warm palette on a dark field** so the monsters glow like nightlights.
- Loud and cheerful failure: running out of hearts should be funny, not sad.

## Toys — the temporary weapons

**The tension every one of these plays against:** the pod fires *upward*, but
monsters are all around — beside you, below you, behind you. That gap is the
game's best source of presents, because each toy answers "what about the ones
that aren't in front of me?" in a different way.

### Four rules, and the first one is forced by the hardware

1. **No buttons, ever.** A toy activates the instant it is collected and runs on
   a timer. There is nothing to press, nothing to aim, nothing to save for
   later — which is right for a balance board and right for an eight-year-old.
2. **One at a time.** Picking up a new toy replaces the current one. There is no
   inventory, no stacking, no combination to reason about — and no way to end up
   with auto-aim *and* spiral at once, which would leave nothing to play.
3. **The plain gun never goes away.** A toy is always a bonus on top of what you
   already had. You can be having a worse round; you can never be worse off.
4. **Timer as a ring around the pod**, shrinking, not a bar in the corner. Eyes
   stay on the field, and a ring closing is legible at a glance from three
   metres while standing.

### The set

| Toy | What it does | The problem it answers |
|---|---|---|
| **Bubble Wand** | shots seek the nearest monster, in any direction | "there is one right beside me and I can only shoot up" — the purest fix, and the one to build first |
| **Twirl** | a spray that rotates a full turn about every 1.2 s | everything at once, if you hold still — spectacular, and it makes standing your ground a choice |
| **Buddy Bots** | two little monsters orbit the pod and pop what they touch | the ones that sneak up from below; also the cutest thing in the game, and it makes the pod look like it has friends |
| **Boomerang Bubble** | one fat slow bubble goes up, stops, returns through everything it missed | teaches "below matters" with no pressure attached |
| **Tickle Beam** | a beam to the nearest monster that jumps to two neighbours | crowds — and it chains along the Mama's healing tethers, which makes popping her feel clever |
| **Big Bloop** | instant, no timer: clears a radius in confetti | not a weapon, a present. The panic button that needs no button |

### Numbers to start from (all POC dials)

- **Duration 8–12 s.** Long enough to enjoy, short enough to want the next one.
- **Drops from medium and large monsters only.** Killing the big one is the
  reward; small ones give coins. A toy roughly every 20–30 s.
- **Toys fall slightly ABOVE the pod's comfortable band**, so drifting up to
  fetch one is greed rather than duty — the same rule as coins, and it keeps the
  expensive axis optional.

### Build order

**Bubble Wand, Twirl, Buddy Bots first.** They are three genuinely different
answers to the same problem, they are cheap, and three is enough to tell whether
the toys carry the fun or the monsters do. Boomerang, Tickle Beam and Big Bloop
follow only if the first three land.

## Monsters (first pass)

| Monster | Behaviour | Why it exists |
|---|---|---|
| **Blobbies** | drift slowly, no attack | the crowd; teaches that the field is safe to swim in |
| **Bouncers** | bounce off the edges on a fixed line | the first thing you must lean around |
| **Puffers** | inflate, then drift *downward past you* | the pass-the-player idea, at its gentlest |
| **Mama** | hugs nearby monsters and heals them, tethered by a soft glow | the fight's one decision: pop her first |
| **Big Softie** | wave-ending giant, many hearts, never fast | a boss an eight-year-old can beat |

## Open questions for the POC

### 1. The camera — two candidates (Amit narrowed it)

- **FIXED.** The world is exactly one screen. The pod moves inside it, monsters
  drift through it, nothing pans. Simplest to read and the frame never argues
  with the player.
- **LATERAL-ONLY FOLLOW.** The world is wider than the screen and the camera
  pans horizontally with the pod. A bigger playground; costs parallax art and
  off-screen bookkeeping.

**There is an argument against lateral follow that only became clear once the
list came down to two.** Lateral is the axis this player uses *constantly*, and
it is the axis every dodge is made on. A camera that pans while they lean means
the frame moves during the exact moment they are judging a gap — the background
slides one way, the monster slides the other, and the read gets harder precisely
when it matters. Vertical follow was rejected for fighting the hard axis; this
would fight the *busy* one.

That points at FIXED, and it is worth being honest that the original ask was
"not fixed camera". Two ways to have both, which the POC should try:

- **A world that scrolls without following.** The field drifts steadily
  downward-past the pod — the sense of travelling through somewhere, with the
  frame still nailed down. The player never drags the camera; the world moves on
  its own.
- **A camera that breathes.** Fixed, but with a few percent of soft lag toward
  where the pod is heading. Reads as alive, never as panning.

Build order in the POC: FIXED first (it is the fallback that certainly works),
then the drifting world on a toggle, then lateral follow. Judge standing up.

### 2. How close may a monster pass? — settle it with a dial, not a guess

Nobody can answer this at a desk, and it does not need answering in advance: the
POC ships with it on a live knob and the run reports back.

- **The knob:** monster drift speed, and how near the pod's column a passing
  monster may come.
- **The measurable:** *time from first visible to reaching the pod's row.* Nova
  Vanguard's floor for anything arriving where the player is is **1.2 s**, so
  that is the starting baseline and the POC starts deliberately gentle — slower
  and wider than feels right — because it is easier to judge "too easy" than to
  recover from a first impression of "unfair".
- **The readout:** the POC counts near-misses and contacts per minute and prints
  them, so a session ends with a number to keep rather than a memory.

Both are hardware questions, so the POC ships to the app early and is judged
standing on a board.

## Deliberately not in this game

No IAP, no currency that survives the run, no unlock ladder, no meta upgrades —
product constraint, and the reference's millions-scale HP economy is exactly
what we are not copying.
