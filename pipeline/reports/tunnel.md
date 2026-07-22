# tunnel

## Correction (from Amit, post-analysis)

This report's original read guessed the footage might be third-party
ride/arcade-attraction capture (based on "Next Ride Starts in," a "Guest"
leaderboard, and a "Show Playtest" debug button) and, on that basis,
recommended simplifying the control scheme down to discrete lane choices
for physical-board comfort. **Both of those are superseded:** this is
GoBalance's own in-development build (the dev-only touches noted above are
just leftover internal tooling, not evidence of third-party origin), and
its continuous hold-to-steer left/right tilt mapping is already working on
real hardware. Treat "Input demand" and "Core mechanic(s)" below as
accurate on direction count (2-direction, left/right) but treat the
pacing/lane-simplification recommendation as **not applicable** — continuous
steering is the validated, correct model. See
`pipeline/macro-briefs/proposed/tmnt-sewer-slide-dodger/brief.md` for the
brief revised around this correction.

## Source

- Folder: `pipeline/videos-inbox/tunnel/`
- Video: `Screen Recording 2026-07-21 at 17.44.16.mov` — a macOS screen
  recording, approx. 51.8 seconds long (probed via ffmpeg).
- Notes file: **none present**. The folder contains only the one video file
  — no `notes.txt`, `.rtf`, or any other `notes.*` file. This report is
  built from the video alone, per the task instruction to skip the
  read-notes-first step since there's nothing to read.
- Frames sampled: 12 frames from the single video, evenly re-spaced across
  its full ~51.8s runtime (`tools/pipeline/sample_frames.py ... --interval-sec 3
  --max-frames 12`, which re-spaces to roughly one frame every ~4.3s when the
  naive 3s interval would exceed the 12-frame cap). This is a sparse sample
  — treat exact obstacle cadence, hit/damage rules, and multiplier logic
  below as inferred, not verified frame-by-frame.

## Notes, verbatim

No notes file was present in this folder, so there is nothing to reproduce
here. Everything in this report is the analyst's own read of the video.

## What's happening

This is **not** raw external reference footage of a third-party game — it's
a screen recording of someone (presumably Amit) actually playing through a
webview-embedded 3D game, front to back: a loading screen, an instructions
modal, one full gameplay run, and the post-run leaderboard/lobby screen.
It's a complete, clean capture of a single play session, not a browsing
recording — no concern there.

That said, a few things about *what* was captured are worth flagging
plainly, because they affect how much weight to put on this as a design
reference:

- **The captured game is 3D**, not 2D — a third-person chase camera behind
  a 3D character model riding down a curving 3D tunnel. GoBalance is 2D-only
  at this stage (see the mandatory product constraint), so nothing here can
  be reused as-is; any takeaway has to be translated into a 2D equivalent.
- **The UI text strongly suggests this is a real installed
  attraction/arcade cabinet, not a standalone mobile/web game.** The lobby
  screen reads "Next Ride Starts in [10]" with a countdown, "Your Score"
  slotting into a shared "High Scores" leaderboard of "Guest" entries, and
  a visible "Show Playtest" debug button in the corner. "Next Ride" framing
  (not "Play Again" or "Retry") reads like a physical ride/queue attraction
  (theme park, FEC, or similar) built as a webview game, where each session
  is one rider's turn and the next person in line starts automatically.
- **The instructions text doesn't match the character skin**: the modal
  reads *"Stir your spaceship into safety. Tilt left or right to avoid the
  obstacles. Look for powerups to gain points faster! Good luck!"* — but
  the playable character is a Teenage Mutant Ninja Turtles-style green
  turtle (red mask/wrist wraps, Raphael-coded) riding a board/plank through
  a stone-and-rivet industrial pipe tunnel, not a spaceship. The
  instructional preview thumbnail also shows a generic purple/green low-poly
  tunnel with a tiny ship icon that doesn't match the actual in-game art at
  all. This, plus a loading screen literally labeled "Reloading Domain"
  (which reads like a leftover Unity editor/dev-build placeholder string,
  not consumer-facing copy) and the "Show Playtest" button, all point to
  this being a work-in-progress or generic template build with a TMNT skin
  dropped on top, not finished/polished product. Worth a human's attention:
  this looks like a different, unrelated build from this repo's own
  `TmntRunner` project (that one is a city-street runner per its
  `cityDressing.js`/`lanes.js` source files; this footage is a stone/metal
  pipe tunnel with no matching strings found anywhere in this repo) — so
  it's an external TMNT-licensed reference, not a recording of in-repo work,
  but it's similar enough in theme to `TmntRunner` that it's worth a human
  confirming that's understood before this gets used downstream.

With that framing, the actual gameplay: the turtle character rides a
board/plank on rails down a continuously forward-scrolling metal tunnel that
curves left and right. A single lit-green path strip marks the safe lane;
wooden crates, a spinning/studded drum obstacle, and a crossed-pipe girder
obstacle appear in the tunnel ahead and must be avoided. A score counter
(bottom right) counts up continuously — 71, 146, 220, 295, 371, 447, 523,
600 across the sampled gameplay frames — alongside a multiplier readout
that starts at "x3," drops to "x2" partway through, and drops again to "x1"
shortly before the run ends, suggesting either a decay-over-time mechanic
or a "lose progress on a hit" mechanic (frames don't clearly show a hit/
damage reaction, so which one it is isn't confirmed). Partway through the
run the character's pose changes to an arms-out/wings-out glide stance
coinciding with small colored particle streaks in the tunnel — plausibly a
powerup or boost state, but too ambiguous in the sample to be sure. Some
graffiti-style decals (splash marks, a bolt, a partial "NINJA"-style tag,
a purple squiggle) appear painted on the tunnel walls as set dressing. The
run ends at a score of 624, and the closing frame shows that score inserted
into the shared leaderboard at rank 20, with the "Next Ride Starts in 10"
countdown already running again for the next session.

Only one video was provided, so there's no cross-video comparison — this
is the read on that single continuous capture.

## Genre & comparables

This is an **on-rails 3D endless-tunnel dodger** — a first-cousin genre to
mobile endless runners (*Subway Surfers*, *Temple Run*) but narrower: there's
no jump/duck/vertical dimension visible, movement is forward-automatic, and
the player's only job is steering left/right within a tube to avoid
obstacles, closer in shape to arcade "tube run" games (e.g. *Tunnel Rush*-
style Y8/browser games) or classic tube-racer arcade cabinets than to a
full lane-switching runner. The "Next Ride" leaderboard framing additionally
reads as a physical attraction/redemption-cabinet game rather than a
mobile/web title in the conventional sense (see above) — that context
matters more for genre classification here than usual, since the pacing and
scoring conventions of an arcade attraction (short sessions, score-chasing
for a shared physical leaderboard) differ somewhat from a mobile endless
runner built for replay depth.

## Core mechanic(s)

1. **Continuous forward auto-run** — the player doesn't control speed or
   forward motion at all; the tunnel scrolls the character forward on rails.
2. **Left/right steering to dodge obstacles** — the in-game instructions say
   this explicitly: *"Tilt left or right to avoid the obstacles"* — the only
   player input is lateral positioning within the tunnel to avoid crates,
   spinning drums, and pipe-girder obstacles as they scroll toward the
   camera.
3. **Powerup/score-multiplier chasing** — the instructions call out
   "powerups to gain points faster," and the observed x3→x2→x1 multiplier
   decay implies some secondary system layered on top of dodging (collect
   to boost/maintain multiplier, lose it on a miss or over time) — exact
   rules unconfirmed from the sample.

## Input demand, explicitly checked against GoBalance

This is about as clean a match to GoBalance's 4-direction-but-really-lean
input as reference material gets: **the reference game's own instructions
already specify "tilt left or right"** as the entire control scheme, and the
instructional graphic shows literal left/right arrow icons flanking a
steering-wheel icon. This reads as a genuinely **2-direction (left/right)
core loop**, with no up/down input observed or implied anywhere in the
sample — a strong, direct fit for a lean-based board with no direction
count to trim.

The open question is **pace**, not direction count, same shape of concern
as flagged in other reports in this pipeline. The tunnel curves
continuously in addition to discrete obstacles appearing in clusters (e.g.
frames show 2-3 crates plus a spinning drum or pipe girder in view at once),
which implies the player needs fairly frequent, possibly quick, lateral
corrections to both follow the tunnel's curve *and* dodge obstacles within
it — closer to constant micro-steering than to the occasional binary
left/right decision of a slower catcher-style game. Even at a sparse
12-frame sample, the sense is that the "real" tempo of this genre (endless
runner / tube dodger) trends toward quick reflexive corrections, which is
exactly the kind of fast-alternating-direction demand this pipeline should
be cautious about for a physical lean board. **Recommendation for stage 2:**
the 2-direction control mapping itself is a good sign, but this genre's
native pacing (continuous curve-following plus frequent obstacle dodges)
would likely need to be slowed and spaced out substantially, and possibly
simplified from "continuous curve to follow" down to "discrete lane
choices," to be comfortable on a lean board rather than a thumb/tilt-phone
input.

## Visual style notes

- Stone-and-rivet industrial pipe/tunnel environment, dark grey base palette
  with a bright green-lit "safe path" strip running down the center —
  strong, legible wayfinding via color/light contrast that's a reasonable
  pattern to reuse regardless of the underlying build's rough edges.
  Occasional graffiti-style paint decals (pink/white splash, yellow bolt,
  purple tag) break up the tunnel walls as environmental detail.
  - The instructions-screen preview thumbnail uses a completely different,
  brighter purple/green low-poly aesthetic with a small ship silhouette —
  doesn't match the actual in-tunnel gameplay art at all (see "What's
  happening" — this looks like an unfinished/template build).
- Character is a stylized, rounded/cartoonish 3D TMNT-style turtle model
  (oversized head/shell, red mask and wrist wraps) riding some kind of
  board/plank — art direction reads as kid-friendly/cartoonish 3D, distinct
  from the grittier industrial tunnel backdrop it's placed in.
- Score and multiplier are simple white/green sans-serif HUD text,
  bottom-right, unobtrusive; standard mute and home icons top-right confirm
  this is packaged for embeddable/webview presentation, consistent with the
  rest of this pipeline's target format.

## Gaps / low-confidence areas

- **Multiplier logic** (x3 → x2 → x1 progression): unclear whether this
  decays over time, drops on hitting an obstacle, or something else —
  never observed a clear "hit" reaction frame in the sample to confirm.
- **The glide/wings-out pose mid-run**: unclear whether this is a powerup
  state, a jump/trick animation, or unrelated to player input — the sample
  doesn't include enough consecutive frames around the transition to tell.
- **Fail/lose condition**: the run ended around score 624 and returned to
  the leaderboard, but nothing in the sampled frames shows *why* it ended
  (obstacle collision, time limit, or reaching the end of a fixed course) —
  plausible it's simply a fixed-length "ride" given the attraction framing,
  but unconfirmed.
- **Obstacle variety and exact hit consequences**: crates, a spinning
  studded drum, and a crossed-pipe girder were seen, but whether they all
  behave identically on contact (instant end vs. score/multiplier penalty)
  isn't shown.
- **Whether this is genuinely a physical-attraction cabinet build or just a
  web build with ride/queue theming for flavor** — inferred from UI copy
  ("Next Ride Starts in," "Guest" leaderboard, "Show Playtest" debug
  button), not confirmed by anything explicit in the footage. Worth a human
  sanity-check given how much of this report's genre framing leans on that
  read.
- Only one reference video was provided, so there's no second playthrough
  to cross-check pacing, obstacle density, or the multiplier behavior
  against.
