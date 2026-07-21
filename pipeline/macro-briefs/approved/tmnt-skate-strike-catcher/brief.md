---
status: approved
track: tmnt
source_reports: [SideBySideCatcher.md]
---

# Skate & Slice: Michelangelo's Rooftop Rush

**One-sentence hook:** Michelangelo skates side-to-side across a rooftop,
swirling his nunchaku to smash falling pizza slices and mutant ooze while
dodging lit bombs, in a light, humorous *Mutant Mayhem*-style spin on the
classic catcher genre.

**Genre:** Catcher (horizontal-only positioning + catch-vs-avoid
discrimination), reskinned as an action-attack rather than a passive-catch.

## Core loop

- Michelangelo skates left/right along a single rooftop/alley ground line,
  positioning himself under falling items.
- Good items (pizza slices) fall from the top; when one lines up, he swings
  his nunchaku in a swirling arc to strike it for points — reads as an
  attack, not a mouth-catch.
- A rarer falling item — a glowing green mutant-ooze canister — grants a
  short time-limited ability when struck (e.g. wider swing arc, brief speed
  boost, or slow-fall on nearby items), then wears off.
- Bad items (bombs, fuse lit, black-and-yellow danger markings) fall
  alongside the good ones; the player skates away rather than swinging at
  them — same left/right input, opposite intent.
- Pace escalates over the run (faster falls, denser mix of pizza/ooze/bombs)
  in discrete steps, mirroring the report's observed "LEVEL 2" banner
  behavior, until a fail condition (bomb hits) ends the run and shows a
  score.

## Why it fits GoBalance

This is a direct carry-over of the source report's core finding: the
catcher genre is inherently a **2-direction (left/right) mechanic** with no
vertical player movement, which maps cleanly onto GoBalance's left/right
lean. The "attack" reframe (nunchaku swing instead of a mouth-catch) doesn't
add a new input — the swing is a triggered animation on successful overlap,
not a separate button/direction, so the physical ask on the board never
grows beyond "lean left or right to be under/away from the next item."
Per the report's explicit pacing warning, fall speed and item density
should be tuned conservatively (slower, more spaced-out than typical mobile
catcher tempo) since alternating fast left-right corrections are more
strenuous on a lean board than on a touchscreen — this concept has no
moment that requires quick alternating multi-directional input, only single
left/right corrections at a controllable cadence.

## Scope tiers

**POC** — One static rooftop background, Michelangelo skating with a
placeholder swing animation, pizza slices and bombs falling (no ooze
power-up yet), simple hit/dodge detection, no scoring UI, no difficulty
ramp. Proves the swing-as-catch feel is fun and readable before anything
else is built.

**MVP** — Full scoring with combo streaks for consecutive pizza hits, a
lives/fail condition (e.g. 3 bomb hits ends the run), the mutant-ooze
power-up with one clear time-limited effect, a difficulty ramp across a
small set of in-game stages (e.g. rooftop → fire escape → alley, 3-5
stages) triggered by score/time thresholds, and a game-over score screen.
Michelangelo only, no turtle-select.

**Post-MVP** — "Choose your turtle" (Leonardo/katana, Raphael/sai,
Donatello/bo staff), each with a distinct weapon-swing animation and maybe
a personality-flavored good item variant; more level/rooftop themes across
the city; more falling-item variety (different foods, different ooze
effects/power-ups); denser late-game hazard patterns as an in-run
difficulty ceiling. All of this is more in-game content and depth within a
single session/campaign — no cross-game unlocks, no currency, no IAP.

## Inspired by

- **SideBySideCatcher.md** — the core mechanic (horizontal-only
  positioning, catch-vs-avoid discrimination, level-based escalation) is
  taken directly from the report's analysis of `dino-sidebyside.mp4` and
  its GoBalance input-fit reasoning (2-direction good fit, pace is the real
  risk). The report's visual-language note — keep the hazard item
  "deliberately drab/desaturated against the candy-colored treats" — is
  reused here as the bomb's stark black/yellow danger marking against the
  warm pizza/ooze palette.
- **Amit's notes.txt** (quoted verbatim in the report): *"For this genre I
  want us to focus on a 2d light atmosphere - humoristic ninja turtles game
  - where a ninja turtle (maybe option to choose one later on)"* — this is
  the direct source of the TMNT theme, the light/humorous tone, and the
  "choose your turtle" idea, which this brief places in Post-MVP exactly as
  the note frames it ("later on").
- **Amit's direct creative direction for this brief** (given at task time,
  not in notes.txt): Michelangelo specifically for MVP art, skateboard
  movement instead of running (his stated preference — "probably better"),
  the nunchaku-swing-as-attack reframe of "catching," pizza slices and a
  mutant-ooze power-up canister as the good items, and bombs (fuse + danger
  markings) as the clearly-legible hazard. All of these are built directly
  into the core loop above.

## Concept frame

Prompt used (also saved to `concepts/prompt.txt`):

> 2D side-scrolling video game key art in the hand-drawn-over-CG painterly
> style of the Mutant Mayhem-era TMNT movies (rough sketchy linework,
> textured painterly shading, warm nighttime city palette). Michelangelo,
> wearing his orange mask and matching orange elbow/knee wraps, is riding a
> skateboard sideways along a flat rooftop/alley ground strip, mid-action,
> swinging his nunchaku in a motion-blurred swirling arc to strike a
> falling pizza slice glowing with a small impact star. In the air above
> him: another pizza slice falling, a glowing green mutant-ooze canister
> with bubbling toxic liquid, and a cartoonish black bomb with a lit fuse
> and yellow-and-black danger stripes falling on the opposite side, clearly
> reading as dangerous. Background is a simple flat city rooftop at dusk
> with a few water towers and a soft glowing skyline, minimal depth, bright
> and humorous mood, no other characters. Vertical falling-item lane
> composition, character positioned in lower third, wide game-key-art
> framing.

Generated with `nano-banana-pro`, using 3 *Mutant Mayhem*-era reference
stills from `/Users/eladayzen/Documents/tmnt/` as style/mood guidance. Four
variations are in `concepts/concept-01.png` through `concept-04.png`.

**Selected: `concept-01.png`.** Amit's note: the camera/framing should be
pulled out a bit wider than this frame in the actual build (not critical,
just a preference for more breathing room around the action).
