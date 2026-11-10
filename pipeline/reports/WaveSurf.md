# WaveSurf

## Source

- Folder: `pipeline/videos-inbox/WaveSurf/`
- Video: **`Screen Recording 2026-09-10 at 16.54.11.mov`** — a single macOS
  screen recording, **108.83 s** long, **2984 × 1358** (HEVC Main 10, HDR
  `bt2020nc/smpte2084`, 50.22 fps, ~35 Mbit/s, 476 MB on disk). It is the
  only file in the folder.
- Notes file: **none present.** No `notes.txt`, no `notes.rtf`, no
  differently-named `notes.*`, nothing else in the folder at all. Everything
  interpretive below is the analyst's own read, with no steer from Amit to
  reflect or disagree with.
- Frames sampled: **37 distinct frames**, in four passes, because the first
  pass raised timing questions the spacing couldn't answer:
  - **16 evenly-spaced frames** across the full runtime
    (`tools/pipeline/sample_frames.py <video> <dir> --interval-sec 3 --max-frames 16`,
    re-spaced to roughly **one frame every 6.8 s**) — the structural sample.
  - **10 frames at 1 fps, t ≈ 54–63 s** — to see how far the player moves
    between consecutive seconds.
  - **16 frames at 4 fps, t ≈ 62–66 s** — a 0.25 s micro-burst, used to
    actually *measure* world scroll speed and the base scoring rate rather
    than infer them.
  - **7 frames at ~0.8 fps, t ≈ 100–109 s**, plus one frame at **t = 0.2 s**
    and two magnified HUD crops.
- Because of the micro-burst, a few numbers in this report are **measured,
  not inferred** — they're flagged as such where they appear. Everything
  else (obstacle behaviour between samples, crash handling, the trick
  trigger) is still inference from stills plus genre knowledge.

### What the recording actually is

This is a **screen recording of a gameplay-capture video being played back on
a Mac**, not a direct capture of the game. Evidence:

- A **"TECH ARCADE" channel watermark** sits in the bottom-right corner of
  the t = 0.2 s frame — a third-party capture channel's bug, not game UI.
- A **mouse cursor** is visible inside the playfield in the opening frame and
  again near the end.
- The last ~2 s of the recording show the **macOS screenshot/record toolbar**
  ("Options", "Capture in HDR", stop button) and the capture-region
  marching-ants border, exactly as in the `Space Invadors` folder.

Practical consequences:

1. **The game itself is a portrait-or-landscape mobile title being played
   back in a landscape window.** The playfield fills the full 2984 × 1358
   frame edge to edge with no pillarboxing, and the HUD is anchored to the
   true screen corners — so unlike the `Space Invadors` reference, **this
   game's own layout really is landscape/widescreen**, which is directly
   useful to us.
2. Colour and shape are trustworthy; fine detail is soft from double
   compression (game capture → re-encode → screen recording). Small HUD
   glyphs needed magnified crops to read.
3. **No audio analysis is possible** — stills only.
4. The recording starts mid-session at the **beginning of a run** (score
   1050, the pre-run boost prompt still on screen) and ends **still mid-run**
   at score 371,161. **No menu, no game-over, no results screen, and no
   wipeout appears anywhere in the 108 s.**

## Notes, verbatim

**No notes file was present in this folder**, so there is nothing to
reproduce here. There was consequently no author steer about what to focus
on, and no instruction from Amit to run external research — the External
research section below exists because the task that commissioned this report
asked for the genre to be grounded online, and it is kept clearly separate
from what I actually observed.

---

## What's happening

### The premise, from the opening frame

The **t = 0.2 s** frame is the single most informative frame in the file. A
small wooden dinghy flying a **pink skull-and-crossbones pirate flag** sits
on the shoulder of a wave. A blonde character in sunglasses is at the tiller;
a second character — the one the player controls, a brown-haired girl in a
pink top with a board under her arm — is being dropped off the back. Below,
a **"TAP TO ACTIVATE"** prompt offers two consumables as hexagonal tokens:

- **COIN BOOST** — orange, count **28**
- **SCORE BOOST** — teal, count **20**

The player takes the score boost (frame 1, ~1.5 s, shows the teal
**"SCORE BOOST"** banner mid-screen and a `+20%` suffix appears next to the
score for the rest of the run). Score reads 1050; coins 0.

So the shape of a session is: *boat drops you into the wave → you ride one
continuous wave for as long as you can → score accumulates.* It is an
endless runner with a surf skin, and the wave is the track.

### The playfield

A **side-on 2D view of a single enormous breaking wave**, scrolling
**right-to-left** at a constant rate. The surfer is held at a **fixed screen
x of roughly 25 % from the left edge** in every non-airborne frame I looked
at — the camera does not chase her horizontally.

The wave occupies the lower ~60–70 % of the frame:

- Far left is the **curling lip / whitewater**, a near-vertical wall of foam
  that acts as the left boundary.
- The **wave face** is a broad sloped surface running from the crest
  (upper-left third) down to the trough (bottom edge). This face is the
  *entire* usable playfield.
- Above the crest is open **sky** with parallax clouds and background sea
  stacks — and the surfer genuinely goes up there (frames 5, 7, 13, 14 are
  all airborne).

**The player's position on that face is the whole game.** Everything the
player does is "how high am I on the wave right now."

### What's on the face

Across the sampled frames, the hazard and pickup bestiary is:

- **Blue-and-yellow fish** — the common obstacle, sitting in little foam
  puffs at scattered heights on the face. Frames 3, 8, 9, 10, 11, 15, 16 and
  most of the 1 fps burst have between one and eight of them on screen.
- **Larger purple fish** — a bigger, higher-value-looking variant (frames 10,
  15, micro-burst frames 9 and 13, where three of them are stacked at three
  different heights immediately in front of the player).
- **A magenta/purple pufferfish** with spines — noticeably larger than
  anything else, and in burst frames b_01–b_03 it holds station near the
  right edge for several seconds before closing. Reads as a heavier
  telegraphed hazard.
- **Rocks and sea stacks** breaching the face — dark wedge shapes with
  whitewater collars (frames 2, 10, 11, 15, 16, micro-burst). These sit *in*
  the face and have to be gone over or under.
- **A pelican** — frame 4 has a big white pelican diving through the player's
  space; frame 13 has one tumbling out of frame while a **25,920** payout
  flashes, i.e. the pelican was hit *as a trick target*, not avoided.
- **A purple crab** standing on a grass-topped island (frame 11) and again on
  a bamboo pier (frame 13, with a red **"!" alert bubble** over its head — a
  telegraph marker).
- **Bamboo piers / scaffolds** — frames 3, 7, 13, 14: rickety lashed-pole
  structures extending into the frame from above and to the right, with
  coins strung along them.
- **Gold coins**, strung in arcs and lines (frames 2, 7, 11, 12, 14, 15).
  Frame 2 has a classic Sonic-style coin trail curving down the face.
- **Trick / power-up orbs** — small circular tokens floating in the world:
  a **lightning-bolt** glyph (frame 15, lower-centre) and **purple "3x"
  discs** (frames 10, 14, 16, micro-burst 9 and 13).

### The set-pieces

Three sampled moments break out of plain wave-riding:

1. **Aerials off the lip.** Frame 5: the surfer is high in the sky inside a
   large translucent bubble, separated from her board, mid-rotation, with
   **4320** printed under her. Frame 13: airborne over a cliff and a bamboo
   pier with **25,920** printed. Frame 14: a small silhouette against open
   sky with the wave entirely out of frame. Micro-burst frames 1 and 5 catch
   the launch itself — she leaves the lip in a spray plume.
2. **Riding terrain, not water.** Frame 6 has the surfer boarding **up a
   sandy/rocky headland slope** with grass tufts and a palm above, the wave
   reduced to whitewater on the left. Frame 7 has her airborne *under a rock
   overhang* with the ceiling filling the top of the frame.
3. **Going inside/under the wave.** Frame 12 is **underwater** — a dim
   blue-green interior with kelp fronds, drifting bubbles, a starfish on the
   sand, coins, and a rocky ceiling. The multiplier dial reads **6x**, the
   highest value seen anywhere. This is a distinct, quieter, higher-reward
   sub-mode, and it matches the "slide under a wave to get bonuses" /
   "glide through the inside of the wave" special move described in the
   external sources below.

### The HUD (magnified crops read cleanly)

**Top-left**, two stacked slate bars:

- Row 1: **`x30`** in green, a green hexagonal token bearing an **X**, a dark
  plate with the **score** (`1050` → `371161` over the recording), and a
  ghosted **`+20%`** suffix.
- Row 2: a **coin count** with a yellow hexagonal coin token (`0` → `109`).

**Top-right**: a **`TOP RUN`** label (partly occluded by a grey **"RATE US"**
overlay from the capture), a framed **portrait of a different character** —
a dark-haired boy, not the girl being played — and a number beneath it, plus
a **pause** glyph.

That number is the best detail in the whole video and it is **measured, not
guessed**: it starts at **2,418,950** and ends at **2,048,839**, a fall of
exactly **370,111** — which is *exactly* the player's score gain over the same
span (371,161 − 1,050 = 370,111). So **`TOP RUN` is not the rival's score; it
is the remaining gap to the rival's score, ticking down in real time as you
earn.** A live "how much more do I need" readout with a face attached to it.

**Left edge, mid-height**: one or two **circular slots** with radial
sweep-timers. Observed contents: an empty ring (frames 4, 16), a
**lightning-bolt** glyph (frames 4, 5, 6, 15), and **`2x`**, **`3x`**, `6x`
numerals (frames 6, 10, 12, 13, 15, micro-burst). These fill from the
matching orbs picked up in the world and drain over time. They are **status
readouts, not buttons** — nothing in the footage suggests they're pressed.

### Measured numbers

From the 0.25 s micro-burst (t = 62–66 s):

- **Base score rate is exactly 1,950 points per second** while riding
  normally — 157,770 → 159,720 → 161,670 → 163,620 on consecutive whole
  seconds. It is a distance/time meter, not a skill meter. (1,950 = 65 × 30,
  which is presumably the `x30` multiplier applied to a per-tick base.)
- **World scroll speed:** a `3x` orb travelled from x ≈ 58 % to x ≈ 12 % of
  frame width in 1.0 s → roughly **0.45 screen-widths per second**, i.e. a
  full screen width in **~2.2 s**.
- Therefore **an obstacle entering at the right edge reaches the player's
  fixed x (~25 %) in about 1.6–1.7 s.** That is the reaction budget, and it
  is a genuinely comfortable one by mobile-arcade standards.
- **Player traverse speed on the face:** in the 1 fps burst the surfer moves
  from the trough (y ≈ 88 % of frame height) to the crest (y ≈ 30 %) in
  about 3 s, i.e. she crosses roughly **20 % of the screen height per
  second**. Vertical movement is *fast enough to be expressive but not
  twitchy* — it's momentum-driven, not instantaneous.
- **Score is monotonic across all 37 frames.** It never resets, never drops,
  and no wipeout, respawn or continue appears. One unbroken 108 s run.

---

## Genre & comparables

This is a **one-axis endless runner with a trick-scoring layer** — the
"ride-the-terrain, launch off it, land it" sub-family, not the
lane-switching sub-family.

The nearest reference points, in descending order of closeness:

- **Go Surf – The Endless Wave (Diverso Games)** — almost certainly *this
  game or an extremely close relative*. See External research: its documented
  feature list (procedurally generated endless wave, single-touch hold-to-
  climb control, a "match-3"-style trick-orb system, a special move that
  glides you *inside* the wave, five playable characters with different
  styles, a day/night cycle) matches what's on screen item for item —
  including the underwater section in frame 12 and the orb slots on the left
  edge. **I'm flagging the exact title as high-confidence-but-unconfirmed**,
  because the footage never shows a title card, and the chibi art here is
  chunkier than I'd expect from the store screenshots.
- **Ski Safari (Defiant Development, 2012)** and **Alto's Adventure /
  Alto's Odyssey (Snowman)** — the closest *mechanical* cousins. Same
  silhouette: side-on 2D, fixed camera x, a continuous undulating surface you
  ride, momentum you build by descending, launches off crests, mid-air tricks
  scored by rotation, and a collect-coins-and-chain-tricks scoring economy.
- **Tiny Wings (Andreas Illiger, 2011)** — the purest ancestor of the
  one-input version of this: hold to press down into a slope, release to
  launch off the crest. Same "your only decision is *when*, on a single
  axis" shape.
- **Line Rider / Downhill-style momentum toys** for the surface-riding feel;
  **Jetpack Joyride** for the HUD grammar (fixed-x avatar, coin trails,
  boosts bought pre-run, endless distance score).
- **Surf-specific siblings:** Endless Surf, True Surf, Microsoft's
  `edge://surf`. Named for completeness — none of them is as close
  mechanically as Ski Safari or Tiny Wings.

What it is *not*: it is not a lane runner (there are no lanes), not a dodger
with discrete positions, and not a 3D behind-the-back runner. It is a
**continuous-position 2D surface rider**.

---

## Core mechanic(s)

Stripped to the bone, and I think this is genuinely only two-and-a-half
verbs:

1. **Control your height on the wave face — one continuous axis.** Gravity
   pulls you down the face toward the trough; holding input drives you back
   up toward the crest. Everything downstream — dodging, collecting,
   launching — is an expression of this single decision. The surfer's
   horizontal position is not under player control at all.
2. **Launch off the lip and land.** Carry enough height/speed into the crest
   and you leave the wave. Airborne time is converted into trick payouts
   (**4,320**, **7,201**, **25,920**, and repeated **720**s — the numerals
   read like rotation degrees, so a 720 is two full spins). Tricks appear to
   fire **automatically while airborne**, not on a button — I never see a
   trick control, and the payouts appear without any visible input affordance.
   Landing cleanly presumably matters; I never saw a failed landing.
3. **(Half a verb) Route through pickups.** Coin arcs, `3x` multiplier discs
   and lightning orbs are placed at specific heights on the face, which turns
   "where should I be" from a pure safety question into a risk/reward
   question. The orbs feed the left-edge slots, which stack into escalating
   multipliers (`2x` → `3x` → `6x`) and — at `6x` — appear to trigger the
   underwater/inside-the-wave bonus section. This is a *consequence* of verb
   1, not an independent input.

Two things sit **outside** the moment-to-moment loop: the pre-run
**COIN BOOST / SCORE BOOST** consumables (a single menu tap before the wave
starts) and the persistent coin wallet.

**The base score is time, not skill.** 1,950 points/second accrues just for
staying alive. All player expression lives in the tricks and multipliers
layered on top. That's a clean, honest structure: survival is the floor,
skill is the ceiling.

---

## Input demand, explicitly checked against GoBalance

This is the section that matters, and the answer here is unusually positive.

### How many directions does the core loop actually need?

**One axis. Arguably one button.** The core loop is *up the face / down the
face* on a single continuous axis, with gravity supplying the "down" for
free. There is:

- **no horizontal control** (camera-locked x),
- **no jump button** (the launch is a consequence of your height and speed
  at the lip),
- **no trick button** that I can find,
- **no attack, no shoot, no dodge, no screen-clear panic button.**

For a product whose input is a physical lean, "one axis, no buttons" is close
to the best case that exists. Every other reference this pipeline has looked
at — the shmups, the lane runner, the tunnel dodger — needed more than this.

### How fast/reflexive is it?

**Measured, and comfortably slow:**

- Threats become visible at the right edge and reach the player in
  **~1.6–1.7 s**. Compare the `airPlanes` shmups, where the estimated worst
  case was 0.5 s or less.
- The player crosses the full height of the wave face in **~3 s**, i.e. the
  movement itself is momentum-y and gradual, not a snap.
- Obstacles are **large, high-contrast and individually trackable** — single
  fish and rocks, not curtains. At the densest moment sampled (micro-burst
  frame 13) there are six obstacles on screen at four distinct heights, and
  the gaps between them are multiple body-widths wide. Nothing in this
  footage asks for pixel-precise threading.

So: **one axis, ~1.6 s reaction windows, generous gaps, momentum-based
movement.** This is the pacing profile a lean-based board wants.

### The one real decision: which physical axis carries it

The core axis is **screen-vertical** (up/down the wave face). The established
GoBalance ergonomics finding is that **left/right lean is comfortable and
forward/back lean is hard**. So the obvious naive mapping — screen-up = lean
forward — would put the *entire game* on the expensive axis, and this game
asks the player to sit on that input continuously (you're holding "up" a
large fraction of the time, because gravity is always pulling you down).
Continuous hold on the forward/back axis is the worst-case exertion pattern.

There are two ways out, and stage 2 will have to pick one:

- **Remap the axis:** drive the surfer's height on the face with
  **left/right lean**. This is not as strange as it sounds — surfing is
  *actually* a weight-shift-along-the-board sport, and a lateral lean reading
  as "carve up the face / drop down the face" is defensible fiction. Costs a
  little intuitiveness, buys the comfortable axis.
- **Rotate the world:** re-orient the wave so its face runs left-to-right on
  screen. This preserves lean-direction intuitiveness but throws away the
  landscape framing that this genre depends on, and probably isn't worth it.

Flagging it plainly because it's the *only* input problem this reference has,
and it is a mapping decision rather than a design compromise. The mechanic
itself is already the right size and the right speed.

### The other things to watch

- **Continuous hold vs. discrete input.** This game's input is a *sustained*
  hold, not a tap. On a board that means a **sustained lean away from
  neutral**, held for seconds at a time. Even on the comfortable lateral
  axis, "hold a lean for 20 s straight" is more tiring than "make a lean
  and return to neutral." Worth designing the wave geometry so the
  *neutral* board position corresponds to a survivable mid-face line, with
  lean used for deviation from it — rather than making neutral equal
  "falling into the trough."
- **The aerials are a gift, ergonomically.** During the airborne stretches
  (frames 5, 7, 13, 14 — visibly several seconds each) the player has
  nothing to do. Those are built-in **rest beats** in the middle of the run,
  and they are also the highest-scoring moments. A game that gives you
  points *while you stand still* is ideal for an exertion product.
- **No panic button to re-home.** Unlike the shmup references, there is
  nothing button-shaped here that needs converting to a gesture. Nothing to
  strip.
- **The genre is 2D-native.** No 3D carve-out needed; this sits inside the
  current product scope without modification.

**Overall read:** on input demand alone, this is the **best-fitting reference
this pipeline has reviewed for GoBalance so far** — better than the shmups,
which were promising but needed three separate trims. Here the only open
question is which physical axis carries the one axis the game needs.

---

## Visual style notes

The art is the second-strongest thing about this reference after the input
profile. It is **hand-painted, illustrated, and warm** — no vector flatness,
no procedural gradients.

- **The wave is a painting, not a shader.** Broad brushed teal-to-navy
  gradients on the face, hand-drawn white streak marks reading as sunlight
  refracting through the lip, chunky opaque whitewater with hand-shaped
  edges. The lip curl is drawn with a confident single sweep. This is exactly
  the "illustrated art, not procedural canvas patterns" standard the project
  has previously insisted on for environment surfaces — it's a good example
  to point a style guide at.
- **Chibi characters with real personality.** Big heads, tiny bodies, huge
  eyes, drawn with visible line weight variation. Distinct silhouettes: the
  pink-topped girl, the blonde in sunglasses on the boat, the dark-haired boy
  in the `TOP RUN` frame. Charm carried entirely by the drawing, not by
  animation complexity.
- **Palette discipline.** The whole frame lives in a narrow cool band —
  slate blue sky, teal water, grey-violet sea stacks, off-white foam. Against
  that, the two things that matter are the *only* warm colours on screen:
  **gold coins** and the **pink/salmon of the player's top**. The player is
  always instantly findable. That's a cheap, extremely effective readability
  trick and it should carry straight into a style guide.
- **Obstacle readability is good but not perfect.** Fish are blue-and-yellow
  on teal water — they read, but they're the weakest contrast pairing in the
  frame, and the larger purple fish (frames 10, 15) read considerably better.
  If we borrow this palette, hazards want a dedicated colour slot that isn't
  a neighbour of the water.
- **Environmental variety within one continuous run.** In 108 s the same
  wave passes: open sea with distant stacks (frame 1), a rocky arch (frame
  2), a bamboo pier (frames 3, 7, 13), a grass-topped island with a palm
  (frames 6, 11), a rock overhang tunnel (frame 7), a dim underwater kelp
  interior (frame 12), and a cliff face (frame 13). All without a load break
  or a level transition. That's how a single endless track stays interesting,
  and it's cheap — it's set dressing along one axis.
- **Effects.** Trick moments are wrapped in a large **translucent bubble/
  lens** with a soft rim (frames 4, 5, 16, tail frames) that both frames the
  action and dims the background — a very clean way to say "something special
  is happening here" without a full-screen flash. Score payouts are drawn in
  the same chunky slab numerals as the HUD, in white with a soft glow,
  floating in world space.
- **HUD.** Dark translucent slate plates with soft rounded corners, cream
  slab-serif-ish numerals, hexagonal tokens for currencies. Corner-anchored,
  small, and it stays out of the playfield — with one exception: the
  **`TOP RUN` panel overlaps in-world objects** in frames 3, 5, 6 and 13 (a
  bamboo pier and a pelican both pass behind it). Worth not repeating.
- **Lighting.** A visible lens-flare disc drifts across the face in several
  frames (frames 8, 9, burst frames). Light touch, adds depth, cheap.

---

## Gaps / low-confidence areas

- **No crash, no wipeout, no game-over, no results screen, and no menus
  anywhere in 108 s.** I cannot say what failure looks like, what it costs,
  whether there are lives or a revive, or what the post-run flow is. The
  score is monotonic throughout, so the recorded player simply never died.
  **This is the single biggest hole in this report** — the fail state of an
  endless runner is half its design.
- **The exact title is unconfirmed.** No title card, no store page, no
  watermark that names the game. Go Surf – The Endless Wave (Diverso Games)
  matches the documented feature list point for point (see below) and is my
  strong working identification, but I did not see it *named* on screen and
  the art reads slightly chunkier than I'd expect. Treat as probable, not
  certain.
- **How the trick system is actually triggered.** I infer it's automatic
  while airborne because there is no visible button and no hand/touch
  affordance. But the external sources describe a "collect four of the same
  sequence orb → perform a special move" system, which *might* be
  player-triggered. If it is, that's a second input and the GoBalance read
  above needs revisiting. Unresolved, and it matters.
- **What the `x30` green X token is.** It's constant at `x30` for the entire
  recording and the base score works out to exactly 65 × 30 per second, so
  it reads as a persistent global score multiplier (character level? an
  equipped item?). Never seen changing, so unverified.
- **What the `+20%` is.** Almost certainly the SCORE BOOST consumable
  activated at the start; it persists for the whole run. Not confirmed.
- **Whether the `6x` multiplier causes the underwater section** or merely
  co-occurs with it. Frame 12 is the only underwater frame and the only `6x`
  frame, so I have a sample of one.
- **Collision rules.** I never see a hit. I can't tell whether fish are
  lethal, damaging, or merely slowing; whether the pelican is a hazard or a
  trick target (frame 13 suggests target); or whether rocks and fish behave
  differently.
- **Obstacle motion.** The pufferfish appears to hold station near the right
  edge across burst frames b_01–b_03, which would mean some obstacles move
  *with* the scroll rather than being static in world space. Two or three
  frames is not enough to be sure.
- **Whether the wave geometry is procedural or authored.** External sources
  say procedural for Go Surf; I can't verify from stills, and it matters for
  how the difficulty curve works.
- **Session length.** The run was still going at 108 s with no sign of
  ending. Endless runners have no fixed length, but I have no data on typical
  survival time, which is what a walk-up-turn product actually needs to know.
- **Sampling density.** The structural pass is one frame per 6.8 s. The three
  bursts cover only ~14 s of the 108 s in detail. Anything about the *shape*
  of a run over time — difficulty ramp, speed increase, enemy density curve —
  is not resolvable from this.
- **No audio.**

---

## External research

There was no notes file asking for this; the commissioning task asked for the
genre to be grounded online. **This section is research, not observation of
the provided footage**, and is kept separate on purpose.

### Probable identification: Go Surf – The Endless Wave (Diverso Games)

Published descriptions of Go Surf line up with the footage on every
checkable point:

| Documented feature of Go Surf | What's in our frames |
|---|---|
| "A single touch control keeps the surfer... over a procedurally generated wave... press the screen when you want to go up the wave, and release your finger to go down" | The one-axis up/down-the-face loop; fixed camera x; no other visible input |
| "An amazing 'match 3 puzzle' trick system... sequence orbs... once you get four of the same sequence, your surfer performs a special move" | The left-edge circular slots filling with lightning / `2x` / `3x` / `6x`, fed by orbs collected off the face |
| "Slide under a wave to get bonuses" / "gliding through the inside of the wave" | Frame 12 — the underwater kelp interior at `6x` |
| "Fly into the air and perform stunts" | Frames 5, 13, 14 and the 720/4320/25920 payouts |
| "Avoid crashes against boats, tourists, sharks and other dangers" | Fish, pufferfish, crab, pelican, rocks, piers |
| "Five characters, each with their own abilities and style" | The girl being played vs. the boy in the `TOP RUN` frame vs. the blonde on the boat |
| "Dynamic day/night cycle including rain mode" | The visibly dimmer, cooler frame 12 stretch |
| "Score based on distance" | The measured flat 1,950 points/second |
| "Several consuming items" | COIN BOOST ×28 / SCORE BOOST ×20 at run start |

I'd call this a strong match, short of a title card.

### The genre lineage worth knowing

The "ride a continuous undulating surface, one input, launch off crests"
formula has a short and very traceable history:

- **Tiny Wings (Andreas Illiger, 2011)** is the origin point of the pure
  one-input version. Hold to press the bird down into a slope so it
  accelerates, release to let it launch off the crest. The entire game is one
  binary input applied at the right *moment*, and the skill is reading the
  terrain ahead. Most importantly for us: it proved that a one-axis,
  one-input game can carry real depth, because the depth lives in *timing
  against terrain*, not in the number of things you can press.
- **Ski Safari (Defiant Development, 2012)** added the trick and vehicle
  layers over the same base — and, crucially, added an **airborne rotation
  score** that is the direct ancestor of the 720/4320 payouts here.
- **Alto's Adventure (Snowman, 2015)** and **Alto's Odyssey (2018)**
  refined it into something closer to this game's presentation: hand-painted
  illustrated art, a procedurally generated continuous surface, chained
  trick combos, and a deliberate *calm* to the moment-to-moment feel despite
  the twitch potential. Alto is the strongest art-direction comparable for
  what this reference is doing visually — the "one painterly surface plus
  silhouetted set dressing" approach.
- The **surf-specific branch** (Endless Surf, Go Surf, True Surf, and
  Microsoft's `edge://surf`) is thinner and less influential. Of these,
  `edge://surf` is worth a mention only because it's the one everyone has
  played by accident, and it goes the *opposite* way from our reference: it
  uses a top-down-ish view with genuine 2-axis steering, which is exactly the
  version of "surf game" that would NOT suit the board.

### Why the genre's own design history is relevant to us

Two points from the endless-runner design literature that bear directly on
the GoBalance read:

1. The genre self-classifies by **input count** — "two-touch endless runner"
   (jump + shoot, e.g. most platform runners) versus **"one-touch endless
   runner"** (1TER: Jetpack Joyride, Flappy Bird, Tiny Wings). The whole
   design tradition of the 1TER branch is about extracting depth from a
   *single* input by making the environment do the work. That is precisely
   the constraint GoBalance imposes, and it means there is a large, mature,
   proven design vocabulary to draw on rather than a compromise to invent.
2. The genre's stated core is that the player "controls timing and lane, not
   direction or speed" — the auto-scroll owns pacing, and the player owns
   *when*. Our reference removes even the lane, leaving only a continuous
   height and the timing of launches. That's about as reduced as an action
   game gets while still having a skill ceiling.

*Sources consulted for this section:*
[Go Surf – The Endless Wave (AppAdvice review)](https://appadvice.com/review/go-surf-the-endless-wave) ·
[Go Surf – The Endless Wave Runner (AppAdvice app page)](https://appadvice.com/app/go-surf-the-endless-wave-runner/1088941177) ·
[Go Surf – The Endless Wave (ModDB)](https://www.moddb.com/games/go-surf-the-endless-wave) ·
[Go Surf – The Endless Wave (Metacritic)](https://www.metacritic.com/game/ios/go-surf---the-endless-wave) ·
[Endless Runner Games: How to think and design (Game Developer)](https://www.gamedeveloper.com/design/endless-runner-games-how-to-think-and-design-plus-some-history-) ·
[HTML5 Endless Runner — History and Design Thinking (MarketJS)](https://www.marketjs.com/blog/html5-endless-runner-history-and-design-thinking/) ·
[Endless runner (Grokipedia)](https://grokipedia.com/page/Endless_runner) ·
[Endless Surf review (TouchArcade)](https://toucharcade.com/2014/02/25/endless-surf-review/) ·
[Endless Surf review (Cult of Mac)](https://www.cultofmac.com/news/endless-surf-is-a-gnarly-kind-of-endless-runner-dude-review) ·
[Best mobile surf games (Strike Mission)](https://www.strikemission.app/blog/best-mobile-surf-games)
