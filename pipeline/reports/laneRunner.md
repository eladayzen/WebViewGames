# laneRunner

## Source

- Folder: `pipeline/videos-inbox/laneRunner/`
- Video: `Screen_Recording_20260722_102047_Subway Surf.mp4` — a single mobile
  screen recording, approx. 112.1 seconds long (probed via ffmpeg).
- Notes file: **none present**. The folder contains only the one video file
  — no `notes.txt`, `.rtf`, or any other `notes.*` file. This report is
  built from the video alone.
- Frames sampled: 12 frames from the single video, re-spaced evenly across
  its full ~112s runtime (`tools/pipeline/sample_frames.py ... --interval-sec 3
  --max-frames 12`, which re-spaces to roughly one frame every ~10.2s when
  the naive 3s interval would exceed the 12-frame cap). This is a sparse
  sample relative to the video's length — treat exact obstacle cadence,
  fail-state rules, and late-game pacing below as inferred, not verified
  frame-by-frame.

## Notes, verbatim

No notes file was present in this folder, so there is nothing to reproduce
here. Everything in this report is the analyst's own read of the video.

## What's happening

The filename suggested a Subway Surfers-style lane runner, and the footage
confirms this directly rather than just by association: this is a screen
recording of the actual mobile game **Subway Surfers** (SYBO Games) being
played, not a prototype, reskin, or unrelated build. On-screen evidence
across multiple frames removes any doubt — a Paris setting with a visible
Eiffel Tower and French street signage ("PHARMACIE"), the player character
wearing a backpack/jacket with a "Sub Surf" graffiti-style logo, a
"Double tap for Hoverboard" tutorial prompt, a "TOP RUN" high-score badge,
a "Mission Set 1" objectives screen, and the classic chasing
inspector-guard-plus-dog duo are all specific, recognizable Subway Surfers
elements, not generic runner tropes. This is genuinely the genre-defining
title itself, not an approximation of it.

The captured session covers parts of at least two runs plus the results/
lobby screen between them:

- **Run intro** (frame 1): the camera opens on the back of a green-uniformed
  guard character with a dog running beside him down the subway tracks,
  fists raised — this reads as the standard Subway Surfers "chased by the
  inspector" intro shot before control hands off to the player character;
  score is already ticking (48) at this point, which is a minor oddity
  worth flagging (see Gaps).
- **Normal running** (frame 2): the player character (default "Jake" skin —
  white/red cap, denim jacket) runs down a straight 3-lane subway track
  between two parked trains, city buildings and power lines scrolling past.
- **Hoverboard tutorial and use** (frames 3–4): a "Double tap for Hoverboard"
  prompt appears over a swipe-down/double-tap hand icon; shortly after, the
  character is riding an active hoverboard with a countdown meter in the
  bottom-left HUD.
- **Coin stream + power-up activation** (frames 5–7): a dense vertical
  stream of star-coins appears ahead of the player; shortly after, a
  "PICK UP COINS — MISSION COMPLETE" toast appears alongside a jetpack
  power-up activation — the character is shown airborne/diving forward with
  a bright rainbow-colored trail (the jetpack's signature VFX), continuing
  across rooftops in the following frame.
- **Bridge crossing** (frame 8): normal running resumes on a bridge lined
  with lamp posts and statues, Eiffel Tower visible in the background,
  confirming the Paris setting.
- **Obstacle interaction** (frame 9): the character is shown balanced with
  arms out atop a red-and-white striped rail barrier, mid-tunnel-entrance —
  reads as a jump/mount interaction with an obstacle rather than a plain
  dodge, though the actual jump input wasn't caught in an earlier frame.
- **Reward pickup approach** (frame 10): the character runs toward a glowing
  treasure-chest/reward icon near a train-car obstacle inside a tunnel arch.
- **End-of-run results screen** (frame 11): a "Mission Set 1" objectives
  panel appears — "Pick up 20 Coins" (completed, 20/20), "Score 500 points
  in one run" (0/500), "Jump 5 times" (0/5) — alongside a total currency
  count of 10,144 coins, a x2 score multiplier stat, and a "PLAY" button,
  confirming this is a session-based meta-progression loop between runs.
- **New run start** (frame 12): a fresh run begins with the guard-and-dog
  chase pair visible behind the player again, a "TOP RUN 24850" badge, an
  Eiffel-Tower-icon mission tracker reading "0/5" (likely a location-themed
  collectible objective), and the x2 multiplier already active from the
  prior run's progression.

Only one video was provided, so there's no cross-video comparison — but the
single recording usefully spans two separate run instances plus the
inter-run meta screen, giving a reasonably complete picture of the full
game loop (run → score/coins → results/missions → next run) despite the
sparse 12-frame sample.

## Genre & comparables

This is a **3-lane endless runner** — literally Subway Surfers itself, the
title that (alongside Temple Run) defined the genre. Direct comparables:
*Temple Run*, *Minion Rush*, *Talking Tom Gold Run*, *Sonic Dash* — all
share the same shape (continuous forward auto-run, discrete left/center/
right lanes, jump/slide verbs, coin collection, chase pressure, power-ups).
It's a related but distinct genre from the on-rails free-steering tunnel
dodger covered in `pipeline/reports/tunnel.md` — that game asks for
continuous lateral positioning within a curving tube, while this one asks
for discrete lane-to-lane jumps plus separate jump/slide inputs on a flat
(if branching) track layout.

## Core mechanic(s)

1. **Continuous forward auto-run** — no player control over speed; the
   character runs automatically down subway tracks, streets, and rooftops.
2. **Discrete 3-lane switching** (left/center/right) to dodge trains,
   barriers, and obstacles positioned in specific lanes.
3. **Jump and slide/duck verbs** — vertical dodges over low barriers or
   under overhead obstacles; not directly caught mid-action in the sampled
   frames, but confirmed to exist by the "Jump 5 times" mission objective
   and by known Subway Surfers design (this is one of the genre's signature
   mechanics alongside lane-switching).
4. **Coin collection and power-up management** — collecting coins along
   lanes for currency/missions, and triggering temporary power-ups
   (hoverboard = extra protection + coin magnet-like path, jetpack =
   auto-piloted boosted flight path) that temporarily override manual lane
   control.
5. **Session-to-session meta progression** — missions/objectives, a
   persistent score multiplier, and an accumulating coin bank carried
   between runs (10,144 coins, x2 multiplier visible at frame 11–12).

## Input demand, explicitly checked against GoBalance

This is the textbook case the product constraint exists to flag. Subway
Surfers' core loop natively demands **all four directions** — left/right
for lane changes, up for jump, down for slide — and it demands them at
**fast, reflexive tempo**: obstacles and lane-choice moments in this genre
are well known to arrive roughly once per second or faster at higher speed
tiers, often requiring a lane-change and a jump/slide in quick succession
(the sampled frames show obstacles clustering — a barrier right at a tunnel
mouth, a train car right after a coin stream — consistent with this).

**Recommendation for stage 2:** this genre is a poor fit for GoBalance's
lean-based input as-is. The direction count nominally matches GoBalance's
4-direction capability, but the *combination* of fast left/right lane
corrections with equally fast up/down jump-or-slide reactions is exactly
the "requiring all four directions in a fast action/timing mechanic" case
called out as a real exertion problem, not just a controls-complexity one
— physically leaning up and down repeatedly on a balance board, interleaved
with left/right lane changes, at Subway-Surfers-native tempo, would be far
more strenuous than the equivalent swipe/tap on a touchscreen. If this
genre is pursued for GoBalance, it would likely need significant trimming:
either drop to left/right-only lane switching (auto-resolving or removing
jump/slide), or slow the pacing substantially and space out the vertical-
dodge moments so they aren't stacked against lane-change decisions — the
same shape of recommendation as `tunnel.md` made for its on-rails dodger,
but with an added a fourth-direction concern this report's other reviewed
runner didn't have.

## Visual style notes

- Bright, saturated, cartoonish stylized 3D with chibi-style proportions
  (oversized heads/hands on the runner and chase characters) — classic
  "casual mobile" art direction.
- Detailed themed city backdrops (this capture is the Paris content
  update: Eiffel Tower, French rooftops, "PHARMACIE" signage, an ornate
  bridge with angel statuary) — strong environmental storytelling/theming
  per location, worth noting as a pattern (thematic reskins over a stable
  core loop) even though GoBalance is 2D-only and this reference is 3D.
- Legible, high-contrast HUD: gold star-coins and score readout top-right,
  color-coded mission toasts (green checkmark = "Mission Complete"),
  power-up icons with countdown meters bottom-left.
- Power-up VFX are very readable at a glance — a multicolor rainbow trail
  clearly signals "jetpack boost active," and a gold light-burst clearly
  signals "reward pickup" — a good pattern for legibility regardless of the
  genre's fit for this product.
- Chase characters (guard, dog) are staged with strong, readable silhouettes
  even viewed from behind at a distance — useful reference for "visible
  threat over the shoulder" staging if a chase mechanic is ever wanted.

## Gaps / low-confidence areas

- **No lane-switch, jump, or slide action was caught mid-motion** in any
  sampled frame — all such transitions happened between the ~10s gaps in
  the sample. Their existence and rough shape are known from the mission
  text ("Jump 5 times") and general Subway Surfers design, but this report
  cannot confirm the specific timing/animation/hit-window of this build
  from the footage alone.
- **No crash/collision/game-over frame was captured** — both visible runs
  either ended off-sample or transitioned cleanly to the results screen;
  it's unclear from this footage specifically how a miss is penalized
  (instant end, life loss, hoverboard-save, etc.) in this build, though the
  genre generally uses instant-end-on-collision without a shield active.
  This wasn't a gap in the reference tunnel.md report but is one here since
  no fail-state frame happened to fall in the sample.
- **Late-game pacing/difficulty escalation not directly observed** — all
  sampled frames fall within scores roughly 48–1893 in the earlier run,
  which is likely still early/mid-pace by this genre's standards; the
  genre's well-known speed-up-over-time curve isn't directly evidenced in
  this sample.
- **The "TOP RUN 24850" badge and "Eiffel Tower 0/5" mission-tracker icon**
  in frame 12 aren't fully explained by the sample — plausibly a personal
  best score and a location-themed collectible/character-unlock objective,
  but not confirmed.
- Only one reference video was provided (a single ~112s continuous
  recording spanning two runs), so there's no second independent capture
  to cross-check pacing or obstacle density against.
