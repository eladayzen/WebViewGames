# Bloop Squad — POC handoff

**Read this before touching `BloopSquad/`.** It says what exists, what the POC is
*for*, and — most importantly — which decisions are already paid for and must
not be quietly undone.

Upstream: `pipeline/macro-briefs/approved/bloop-squad/brief.md` (approved) and
`pipeline/reports/viral-collapse-clip.md` (where the idea came from).
Art is locked to `concepts/art-bible-concept-09.jpg`.

---

## What this is

A cute-monster **field shooter** for **six- and eight-year-olds**, mostly boys.
The age range widened after the first board session (it was eight alone), and
that is the reason behind most of the numbers in `data/tuning.js` — see the
block at the top of that file. The short version: a six-year-old is not a worse
eight-year-old, the chain is just longer at every link (see it, decide, shift
weight, hold the aim), so the field has to stay **far away and uncrowded**
rather than weak. Structurally
it is the Viral Collapse family, which differs from Nova Vanguard in three ways
that are the whole reason it exists:

- **Enemies fill the field and pass beside and below the pod.** There is no
  protected band.
- **Bullets live in world space**, so moving sideways paints a ribbon of them
  behind the pod. That ribbon is the signature read; do not "fix" it by
  parenting shots to the player.
- **The camera is a question**, not a given (below).

## Run it

```
cd BloopSquad && npm run dev          # or: npx vite build && serve dist/
```

Landed in the SDK **sandbox** (`~/PracticulaProjects/gobalance_bobo_sdk`) for
board testing. **Not** in the product (`~/UnityProjects/gobalance`) — Amit's
call, it is too early. When it does go there, follow
`GOBALANCE_APP_INTEGRATION.md` exactly, manifest included.

## The two questions the POC exists to answer

Neither can be settled at a desk. Both are judged standing on a board.

**1. The camera.** `C` cycles `fixed → drift → lateral`.
- *fixed* — the world is one screen; nothing pans. The fallback that certainly
  works.
- *drift* — the starfield scrolls past the pod; the frame stays nailed down. The
  sense of travelling somewhere without the player ever dragging the camera.
- *lateral* — follows the pod horizontally. **The argument against it is already
  written down:** it moves the frame on the axis every dodge is made on. It is
  in the build to be ruled out honestly, not because it is expected to win.

**2. How close a monster may pass.** `[` `]` speed, `-` `=` clearance. The HUD
prints `passes / near / contacts / worst reaction`, and `__bloop.report()`
returns the same as JSON. **Worst reaction** is the number that matters: the
least time any monster gave between appearing and reaching the pod's row. Nova
Vanguard's floor is 1.2 s; **this game's is 1.8 s**, because the audience is
younger. Defaults now measure ~14 s on a headless 4-minute run, deliberately
gentle — "too easy" is easy to judge standing up; "unfair" is not recoverable
with a child. If a session reports a worst reaction under the floor, the field
is wrong no matter how it felt to the adult holding the laptop.

## Rules that are paid for — do not undo them by accident

- **Every threat must be answerable by leaning SIDEWAYS.** Forward/back is the
  expensive, imprecise axis on this hardware. `applyClearance()` in
  `systems/monsters.js` nudges a monster once, while it is still over a second
  out, so it clears the pod laterally. **Once, never re-applied** — something
  that steered continuously would be chasing the player by another name, and no
  one could learn where it was going.
- **No buttons. Ever.** Auto-fire, and toys activate on contact. There is no
  fire key, no bomb key, and no place to add one.
- **One toy at a time; a toy ADDS, it never replaces.** A new toy replaces the
  old toy outright — no inventory, no stacking, no state for a child to manage.
  But the forward cannon is not a toy: it fires straight up on its own clock for
  the whole run, underneath whatever the toy is doing, and nothing can stop,
  slow or bend it. A player can have a worse round but never a worse pod.
  **This was written down from the start and the code did not do it** — the
  twirl branch returned before reaching the base gun (nine seconds with the
  cannon off) and the wand converted the straight shot into a homing one. A
  player noticed from the board as the gun "stopping", which is what it was.
  `updateFiring()` now fires the base gun *first*, before the toy is even looked
  at, with no `if` in front of it; each toy then adds its own bullets on its own
  separate timer. Keep that shape — the bug was possible because one function
  had two jobs and an early return.
- **The toy timer is a BAR UNDER THE POD.** It was a ring around the pod, on the
  sound theory that a closing circle reads at three metres. It does — but it
  reads as a **shield**, and a player on the board asked what was protecting
  him. A ring drawn around a character means "wrapped in something" in every
  game that has ever drawn one, and being the right shape for a countdown does
  not survive that. A bar still travels with the pod so eyes stay on the field.
  Under, not over: up-screen is where the monsters, the shots and the aim are.
- **Vertical movement is greed, never survival.** Coins and toys spawn slightly
  above the pod's band on purpose: fetching one is a choice.

## Landmines already stepped on

- **Pixi `arc()` continues the current path.** Always `moveTo` the arc's start
  first, or it strokes a line from wherever the path last was. This drew a green
  streak across the whole field. Nova Vanguard hit the identical trap.
- **A "pass" must be measured near the pod.** The first version counted any
  crossing of the pod's row, so a monster entering from the left edge at that
  height passed it instantly from 900 px away and reported a worst reaction of
  0.25 s. `PASS_LANE_PX = 420` fixes it. **A metric that lies is worse than no
  metric**, because it sends the next session hunting a danger that is not there.
- **Presents have to actually arrive.** A 45 s run once produced zero toys —
  most of what dies is small, mediums take several hits. Drop rates are now
  medium 0.55 / large 1.0 with a token 5 % on smalls — raised twice, the second
  time because halving the crowd would otherwise have quietly halved the
  presents too. A headless 4-minute run now yields three toys; if a change to
  the tier mix or the spawn rate ever lands, re-measure this, because every
  number here is per-kill and the kill count keeps moving.
- **Test with a browser, not by reading.** Headless Chrome over CDP found all
  three of the above. Launch with `--mute-audio`; the harness lives in the job's
  tmp dir and is ~40 lines of raw WebSocket, no dependencies. `?toy=twirl` on
  the URL equips one at boot — the 1/2/3 keys for something that cannot press
  keys, and the only way to see what the timer and the two bullet streams look
  like without a person in front of the screen.
- **The systems import cleanly into node.** Everything except `renderer.js` is
  Pixi-free, so a whole run can be simulated headless in ~100 lines (same update
  order as `main.js`) and the tuning claims can be *measured* rather than
  argued: monsters alive over time, where they die, worst reaction, and whether
  the base gun really did keep firing under each toy. Do that before saying a
  tuning change did what it was supposed to.

## The six-and-eight pass, and what it cost

Asked for after the first board session: fewer creatures, slower, mostly far
away, time to shoot them. What actually moved, and why in this order —

| Lever | From → to | Why this one |
|---|---|---|
| `edgeWeights` top | 0.66 → 0.80 | **The biggest win, and it is not a speed number.** The top edge is the only one that is far *by construction*: an arrival there is 800+ px up the screen, in the half the player is already looking at. A side arrival is beside you the moment it exists. |
| `sideEntryMaxYFrac` | *(new)* 0.42 | Side arrivals now enter in the top 42 % of the screen, never at the pod's row. One arrival in six used to materialise at the player's own height with no travel time — precisely the case the reaction floor exists to catch. |
| `maxLive` / `spawnIntervalS` | 13 → 7 / 1.55 → 2.4 s | Seven is a field a child can count. These two are the dials to reach for first if the board still says "too much" — **and `spawnIntervalS` before `maxLive`**, because a low cap with a fast spawn just means the field is permanently full. |
| `driftPxS` | 68 → 46 | A top spawn now takes ~16 s to reach the pod's row. The time is spent aiming, not reacting. |
| `passClearancePx` | 150 → 240 | 150 px is a lean that has to be roughly right; 240 is a lean that only has to be in the right *direction*. Note the ramp never touches this, so it is a floor on how mean the game can ever get. |
| large tier `hp` | 26 → 16, **then back up to 28** | See below — this one reversed a day later, and the reversal is the more useful lesson. |
| ramp ceilings | all three lowered | What the ramp is *allowed to reach* matters more than how fast it gets there, since the top is where the rest of the run is spent. |
| `warmUpS` | *(new)* 3.5 s | An empty field for the first few seconds, so a run's first event is a discovery rather than a surprise. |

**One thing deliberately left alone: `ease` stays 1.6.** Stretching `rampS` and
steepening the ease together was tried and reverted — it put minute three at
36 % of the ramp, and since a run is a few minutes long that is a difficulty
curve that never happens. It matters more than it sounds: with two ages sharing
one build and no difficulty menu, **the ramp IS the difficulty setting**. The
eight-year-old survives longer and is therefore playing the harder game,
automatically. A ramp nobody reaches takes that away and leaves the
six-year-old's numbers as the only game in the box.

### Health went back up, and why that is not a flip-flop

Cut for the six-year-old pass, then **doubled** a day later on Amit's call from
the board (small 6 / medium 16 / large 28). Both decisions were right, because
the thing that made high health unaffordable changed in between.

Health is best read as **seconds of held aim**: `hp * 0.11` is how long you must
keep one target lined up while the rest of the field drifts. What matters is not
that figure on its own but how it compares to the monster's **travel time**. At
the old 68 px/s drift, a large tier's 2.9 s of aim was spent while it closed on
the pod — the fight happened in the player's lap. At 46 px/s the same monster has
~16 s of travel, so 3.1 s of aim is spent while it is still far away, which is
exactly the "far away, and I have time to shoot them" the pass was for.

**Slow arrivals are what buy tough monsters.** Drift and health are two halves of
one setting: if `driftPxS` ever goes back up, these come back down with it, and a
change to either that ignores the other will produce a game that feels unfair for
reasons nobody can locate.

### The hit reaction

Every hit — not just the killing one — flashes, squashes and opens the monster's
mouth (`MONSTERS.hit`, drawn in `drawMonster`). This was cheap and it was not
optional: with health doubled, a small takes six hits, so **five of every six
hits a child lands are on something that does not die.** Before, those five were
a white flash and nothing else, which reads as an unresponsive enemy rather than
a tough one — the same number of hits either way, felt completely differently.

The squash runs 1.25 oscillations so it passes through *stretch* on the way back
(+0.30 compression → −0.18 stretch → settle). At exactly 1.0 it only squashes and
eases back, which reads as a dent. Impulses restart rather than accumulate, so
sustained fire gives a fresh recoil per shot instead of a permanent deformation.

Both damage sites (bullets, buddy bots) now go through `registerHit()` in
`systems/monsters.js`. They each used to set `hitT = 0.12` by hand, which is
precisely how one of them ends up missing the next thing added here.

### Bigger, tougher, and the feedback loop that nearly hid

Third tuning pass from the board: enemies bigger AND tougher (small 58 px/9 hp,
medium 86/24, large 120/42), and the hit squash halved.

**Size and health have to move together.** A bigger monster is a bigger target,
so raising the radius alone makes the game easier; raising health alone makes a
small target take longer to chew, which reads as the gun getting weaker rather
than the enemy getting stronger. Together they read as a proper boss.

**The squash was halved (0.30 → 0.15)** because the recoil fires every 0.11 s and
the impulse lasts 0.26 s, so under sustained fire they overlap and the whole
field looked like jelly. The feedback has to read on one hit without the
twentieth being exhausting.

**The loop that nearly hid:** tougher monsters meant fewer kills, and every toy
drop chance is PER KILL, so a 4-minute run dropped from 3 toys to 1 — and then
kills fell too, because toys are what kill the things the forward gun cannot
reach. Presents drive kills drive presents. Raising `dropFrom` to 0.10/0.65/1.0
took the same run back to 28 kills and 5 toys. **`dropFrom` is the most fragile
number in the file**: any change to health, size or spawn rate silently moves it,
and the symptom (a boring run) does not point at it.

Watch `large`: 4.62 s of held aim, well past the 2.9 s cut as too long for a
six-year-old two passes ago. Affordable only because its 33 s of travel spends
that aim at a distance — but it is the longest single commitment in the game and
the first number to revisit if a child gets bored chewing on one monster.

### Sound, and the joke it is built around

All **synthesised** — no clips, no files. The brief was "make it funny", and the
specific idea is that a monster's hit note RISES as it loses health, so chewing
through a big one plays a run up the keyboard and the kill lands ON the
punchline. That is a pitch computed per hit, which is what oscillators are for
and what a folder of mp3s can only fake. It also ships zero audio assets, which
keeps the game clear of the host's fixed MIME switch and its lack of HTTP Range
support.

The ladder is **quantised to semitones**, not swept: a smooth glide reads as a
machine warming up, discrete steps read as a cartoon being squeezed. 19 semitones
across the monster's full health, so a small is a crisp nine-note run
(A♯ C D E G A B C♯ D♯) and a large is a long slow climb with each step repeated.

`systems/audio.js` follows the integration doc: separate `sfx`/`music` buses
under a master, prefs read **before** the graph is built (build from defaults and
a player who muted the music hears a burst of it every launch), a one-time
gesture unlock installed once rather than expected of every call site, and every
pause routed through `setAudioPaused` so the suspend cannot drift out of step
with the simulation. Nothing touches the audio API at module load — the systems
still import cleanly into node for the headless sim, which an `new
AudioContext()` at import time would have broken.

The two switches live in `settingsPanel.js` as a **generic `toggles` option**,
not an `onMusic`/`onSfx` pair: that file is copied between games and a per-game
parameter is how the copies drift. Sound is not per-game — the doc requires every
game to ship its own switches, because the app's mute does not reach the page.

### Fire rate, and what it silently re-tunes

The base gun slowed 35 % (0.11 → 0.17 s) to make room above it: with the cannon
already near-continuous there was nothing a rapid-fire pickup could offer. The
old 0.11 is now what the **RAPID** toy hands back, so the number a player used to
have permanently is the number they now earn.

RAPID is the only toy that touches the base gun, and that does not break rule 3:
a toy may never stop, replace or redirect the cannon — making it *better* is the
opposite failure mode. Base shots take its tint while it runs, because a rate
change is the hardest kind of buff to see.

**The knock-on, which is the part to watch.** Every health value in the file is
denominated in fire rate: `hp * intervalS` is seconds of held aim. Slowing the
gun 35 % made every monster 54 % tougher without a single hp changing:

| | before | after |
|---|---|---|
| small | 0.99 s | **1.53 s** |
| medium | 2.64 s | **4.08 s** |
| large | 4.62 s | **7.14 s** |

Seven seconds on a large, against the 2.9 s once cut as too long for a
six-year-old. It was not asked for and is not obviously wanted — it is arithmetic
that came along with the fire-rate change. The fix, if it plays as long as it
measures, is to divide the tier health by 1.54 (large 42 → 27), which restores
exactly the feel that was approved on the board while keeping the new rate.

### The art pass

Still drawn from code, but from the **concept-09 silhouettes** rather than
stand-in shapes: gummy blobs with a scalloped hem, thick outlines, gloss and
belly shading, big eyes with catchlights and a slow offset blink, thick curved
horns, wide grins with fangs; a silver saucer with a glass dome over a grinning
pilot and a flickering thruster; shots are tapered comets, not dots.

**Toy pickups are shapes, not tinted circles** — a star for the wand that seeks,
a spinning pinwheel for the spray, two little faces for the bots. They were
circles, and a player said the twirl "just looks like a big coin", which it did:
same silhouette, and its tint was the coin's exact yellow. Two colours moved for
the same reason — twirl to magenta, buddies off the small monster's exact green.
At 34 px, three metres from the screen, **shape carries identity and colour does
not**. Each pickup also pulses, so it is the one thing on the field that moves
in the corner of the eye.

Getting the silhouettes right *now* is what makes the eventual sprite swap a
swap rather than a redesign — the sizes and shapes are already the real ones.
Two deliberate departures from the frame: colour still encodes SIZE (green /
orange / purple) rather than varying freely, because a child reading "how tough
is that one" off colour beats palette variety; and confetti is mixed colours
rather than the dead monster's tint, since debris in its own colour is the one
thing rule 4 is trying not to show a six-year-old.

`?art=1` on the URL puts one of each tier on screen at fixed positions with the
middle one mid-hit. The art cannot be reviewed from a headless screenshot
otherwise — virtual time barely advances the game clock, so the field is still
in its warm-up when the shot is taken, and "the monsters look fine" would be a
guess.

Measured headless, 4 minutes, idle pod (never moves — the worst case): 1 contact,
avg 6.8 monsters alive, worst reaction 14.2 s against a 1.8 s floor, 3 toys.
**Not yet measured by a child on a board**, which is the only test that counts.
The risk now runs the other way — an emptier field can tip into boring — and
that is a spawn-rate question, so it is answered with `spawnIntervalS`.

## Production readiness — what Nova and TmntSkateSlice actually teach

Researched 2026-09-14, against `GOBALANCE_APP_INTEGRATION.md` (the authority —
read it, this section does not replace it) and the two games' code.

### The headline: only ONE of the two is a leaderboard reference

| | Nova Vanguard | TmntSkateSlice ("pizza slice") |
|---|---|---|
| `submitScore` / `getScoreboard` | **yes** — `src/systems/scoreboard.js`, 135 lines | **none. No `window.GoBalance` call of any kind.** |
| Audio buses + sound menu | yes | has audio, no menu |
| `devUnlock.js` | yes | no |
| Confirm-on-quit, three endings | yes | no |
| rAF shim, `#gameover-overlay`, `#gb-back`, `__gbSensor` | yes | yes |

TmntSkateSlice ships and runs correctly, but it predates the `GoBalance.*` API
entirely — it uses only the legacy surface (`__gbSensor`, an inline `nav:back`).
**Copying its shell gives a game with no leaderboard and no way to quit
deliberately.** It is the reference for *landing a build*; Nova is the reference
for *being finished*. A search across all nine games confirms Nova is the only
one that has ever called `submitScore`.

### What Bloop Squad already has

rAF shim, `#gameover-overlay` + `#restart-button` + literal `hidden`, `#gb-back`
with the inline fallback, `__gbSensor` polling, and the settings panel with host
sensitivity. The structural hazards from the doc's "five things that will break
you" are already handled.

### What is missing, in dependency order

1. **The scoreboard.** Lift `NovaVanguard/src/systems/scoreboard.js` — it is
   written to be lifted and the reasoning in its comments is the paid-for part:
   rows are RUNS not per-profile bests, every row carries its true rank assigned
   once, ties broken stably or the board reshuffles between screens, and the run
   just played is found by matching an `isYou` row on the exact score submitted
   (entries carry no timestamp and no run id). Plus `src/data/avatars.js` (51
   lines) — derive identity from `avatarIndex`, never mirror the app's PNGs.
2. **The three endings, all banking the score.** Died / quit / finished. Bloop
   Squad currently has only *died*, and `__gbBack` quits instantly — no confirm
   over the paused playfield, and **a run ended by choice is not submitted at
   all**. The doc is explicit that this was a direct instruction: a board that
   only records deaths teaches players to stand there and die rather than press
   the button meaning "I'm done". Bloop Squad has no campaign end, so it needs
   two of the three, not three.
3. **Audio.** There is none — no `audio.js`, no clips. Two switches (music,
   effects) over separate gain buses, prefs read *before* building the graph, and
   a one-time gesture listener to resume the context.
4. **`devUnlock.js`**, lifted from Nova — 7 s hold plus a 4-digit pad that judges
   only the completed code. Take Nova's version, not Hill Bomb's: that copy still
   leaks its code one digit at a time.
5. **The `?art=1` / `?toy=` debug hooks and the `1 2 3` keys must go**, or move
   behind the dev unlock, before this is in front of a child.

### Two decisions Bloop Squad has to make that Nova already made

- **What the score IS.** Nova's is points. Bloop Squad currently tracks score,
  coins and popped separately, and only one number can be submitted — the board
  takes an integer, and there is exactly one board per game (the key derives from
  `folderName`; no call takes a board id, so per-mode boards do not exist).
- **The folder name, which is permanent.** `WebGameKey()` derives the save/score
  key from it (`NovaVanguard` → `web_nova_vanguard`). Renaming after ship orphans
  every player's score with no migration. Decide before shipping, not after.

### One thing this POC settles for the whole repo

`WEB_MINIGAME_TECH_RETROSPECTIVE.md` has an open CTO question: stage 4 has no
agreed 2D default, and four games running had gone 3D or raw-Canvas, skipping
PixiJS — the retrospective's own recommended option (2) — every time. **Bloop
Squad is built on PixiJS.** That is the first game to take the recommended path,
so the open question now has a worked example rather than only a proposal. Worth
putting in front of whoever owns that decision rather than letting it settle by
accident.

## What to build next, in order

1. **Answer the two questions on a board.** Everything else is cheaper
   afterwards; the camera decision in particular changes the art (a panning
   camera needs parallax, a fixed one does not).
2. **Real sprites** from the art bible, via Kolbo per `KOLBO_ASSET_PIPELINE.md` —
   monsters in three size tiers, the pod, coins, toy bubbles. Everything is drawn
   from code today, and every shape is a placeholder standing in at the right
   size.
3. **The remaining toys**: Boomerang Bubble, Tickle Beam, Big Bloop (brief has
   the specs).
4. **The Mama healer** — heals nearby monsters through a visible tether. It is
   the fight's one decision and the roster's only interesting enemy so far.
5. **The shell**: audio, the three endings, the leaderboard, dev unlock and
   settings — lift from Nova Vanguard, follow `GOBALANCE_APP_INTEGRATION.md`.

## Map of the code

| File | What it owns |
|---|---|
| `data/tuning.js` | every knob, each with its reason. Start here |
| `systems/monsters.js` | spawning, drift, the clearance rule, the pass measurements |
| `systems/toys.js` | the temporary weapons, and **all** firing — base gun and toy together, from one function on purpose |
| `systems/play.js` | pod movement, bullets, coins, collisions |
| `render/renderer.js` | all placeholder art, drawn from code in the locked palette |
| `main.js` | the loop, the camera modes, the POC's keys and report |
