---
status: proposed
track: general
source_reports: [SideBySideCatcher.md]
---

# Raccoon Rumble: Midnight Heist

**One-sentence hook:** A backyard-bandit raccoon scampers left/right along a
moonlit fence top, snatching falling snacks and shiny loot while dodging a
grumpy skunk's stink cloud, in a bright, comic take on the classic catcher
genre.

**Genre:** Catcher (horizontal-only positioning + catch-vs-avoid
discrimination).

## Core loop

- A raccoon shuffles left/right along a fence-top ground line to position
  itself under falling items.
- Good items (half-eaten food scraps, shiny coins/loot) fall from the top;
  the raccoon does a quick paw-grab/lunge animation to snatch them for
  points, with a small streak bonus for consecutive catches.
- A bad item (a skunk, visually distinct — grey/white stripes, raised tail,
  a small stink-cloud warning icon beside it) falls periodically and must
  be dodged rather than caught; contact costs a life or ends the run.
- Difficulty escalates over the run in discrete steps (faster falls, denser
  item mix, more frequent skunks), similar in shape to the source report's
  observed level-up banner, until the fail condition is reached and a final
  score is shown.
- A small set of backyard-themed stages (fence line → alley dumpsters →
  rooftop garden) provide visual variety and act as the escalation's visible
  milestones within a single run.

## Why it fits GoBalance

Same reasoning as the source report's core finding: this is a
**2-direction (left/right) mechanic** — the raccoon never needs to move
vertically, only reposition along a fixed line, which maps directly onto
GoBalance's left/right lean input with no need to invent up/down controls.
The catch animation (paw-grab) triggers automatically on overlap rather
than requiring a separate input, so the physical ask never exceeds "lean
toward the next good item, lean away from the skunk." Per the report's
explicit pacing warning (multiple items often on-screen at once even in
its low-quality sample footage), fall speed and spawn density here should
be tuned conservatively — generously slow and spaced out relative to
typical mobile-catcher tempo — since this genre's fun comes from tempo
control and visual polish, not from demanding fast alternating
corrections, which is exactly what a lean board can't comfortably do.

## Scope tiers

**POC** — One static backyard-fence background, raccoon with a placeholder
grab animation, one good item type and the skunk hazard falling, basic
overlap detection, no scoring UI, no difficulty ramp. Proves the catch/dodge
feel works before investing further.

**MVP** — Full scoring with combo streaks, a lives/fail condition, 2-3 good
item types (food + loot, visually distinct from each other for variety),
the skunk hazard with a clear warning read, a difficulty ramp across a
small set of in-game stages (fence → alley → rooftop, 3-5 stages) triggered
by score/time thresholds, and a game-over score screen.

**Post-MVP** — More backyard/urban stage themes (park, construction site,
harbor dock), more item variety (rare "jackpot" loot, seasonal/holiday
food items), a second minor hazard type (e.g. a barking dog that
temporarily narrows the safe catch zone) for pattern variety, and deeper
in-run difficulty curves (faster late-game waves, mixed hazard patterns).
All within-session content and depth — no cross-game unlocks, no currency,
no IAP.

## Inspired by

- **SideBySideCatcher.md** — this brief is a direct synthesis of the
  report's full analysis: the horizontal-only catcher mechanic, the
  catch-vs-avoid discrimination pattern, the escalating level structure
  ("LEVEL 2" banner), and — most directly — the report's External Research
  section, which explicitly notes that comparable genre entries like
  "CorgiChomp" (move an animal left/right to catch falling items) follow
  the identical shape and that "the genre's fun tends to come from tempo
  escalation and item-variety/juice rather than mechanical complexity."
  This brief leans into that finding directly: a distinct, likeable animal
  character (raccoon instead of dino or corgi) with strong visual
  catch-vs-hazard contrast (bright loot/food vs. a clearly-marked skunk
  hazard, echoing the report's note on the drab gray hazard weight vs.
  bright candy items in the source video) rather than any added mechanical
  depth.

## Concept frame

Prompt used (also saved to `concepts/prompt.txt`):

> 2D side-scrolling video game key art, flat cutout-style illustration with
> bright saturated colors and a whimsical, cartoon-comic mood. A
> mischievous raccoon wearing a tiny bandit mask stands on a fence-top
> ground strip in a moonlit backyard alley, mid-lunge with paws outstretched
> to catch a falling apple core and a shiny gold coin, both trailing small
> sparkle motion lines. On the other side of the screen, a cartoon skunk
> with a raised striped tail is falling with a small green stink-cloud
> warning icon beside it, reading as a hazard to dodge. Background is a
> simple flat suburban night scene: a wooden fence line, a few trash cans,
> soft moonlight, string lights, minimal parallax. Character in lower third
> of frame, falling items in upper two-thirds, clean bold outlines,
> friendly polished mobile-game art style, wide game-key-art framing.

Generated with `nano-banana-pro`, no reference images (general track, no
style anchor required). Four variations are in `concepts/concept-01.png`
through `concept-04.png`.
