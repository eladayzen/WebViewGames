# airPlanes

## Source

- Folder: `pipeline/videos-inbox/airPlanes/` — contains two subfolders, one per
  game, plus a shared `notes.txt` at the folder root.
- **`1/` — Space Shooter (Galaxy Attack), ONESOFT.** Two Android screen
  recordings, both 1080×2340 portrait:
  - `Screen_Recording_20260813_104223_Space Shooter.mp4` — ~140.1 s.
  - `Screen_Recording_20260813_104505_Space Shooter.mp4` — ~90.0 s.
- **`2/` — 1945 Air Force, ONESOFT.** Two Android screen recordings, both
  1080×2340 portrait:
  - `Screen_Recording_20260813_105025_1945 Air Force.mp4` — ~167.8 s.
  - `Screen_Recording_20260813_105227_1945 Air Force.mp4` — ~101.7 s.
- Notes file: **`notes.txt` present** at the folder root, covering both
  subfolders. Reproduced verbatim below.
- Frames sampled: **16 per video, 64 total** — deliberately above the usual
  12 because this is a four-video, two-game folder and I didn't want to
  under-sample either title
  (`tools/pipeline/sample_frames.py <video> <dir> --interval-sec 3 --max-frames 16`,
  which re-spaces to roughly one frame every 5.6 s–10.5 s depending on clip
  length). That is still a sparse sample: **every claim below about bullet
  speed, dodge cadence, enemy AI behaviour and exact scoring rules is
  inferred from static frames plus genre knowledge, not measured.** Where
  that matters I've said so in "Gaps".
- Both games identify themselves on screen: Space Shooter shows a planet-map
  level select (EARTH / MARS / MERCURY / JUPITER), a `Guest#NFDPZV` account
  and a `24 ms-A.2010.13` debug overlay; 1945 Air Force shows a
  `1945 AIR FORCE` pixel-art loading console and an `ID: 325305287 v.15.68`
  watermark on every frame. These are the real retail products, not
  prototypes or reskins.

## Notes, verbatim

```
Notes from Amit (airPlanes folder)
==================================

What's in here
--------------
Two subfolders, two videos each — two SEPARATE mobile games, but they are
very close to each other in gameplay:

  1/  Space Shooter          (2 clips)
  2/  1945 Air Force         (2 clips)

Both take strong reference from retro PC games (classic vertical
scrolling shoot-'em-ups / arcade shmups). That retro-PC lineage is the
thing I want understood — not just "these are two mobile shooters".

What to keep in mind while analysing
------------------------------------
* WE ARE 16:9. These reference games are portrait mobile games. Do NOT
  carry their portrait framing across. Everything about the layout,
  playfield shape, enemy formations, scroll direction, readable
  danger zone and UI placement has to be re-thought for a 16:9
  landscape screen. Call out explicitly what breaks and what the
  landscape equivalent should be.

* WE ARE NOT CLASSIC FREE-TO-PLAY. No gacha, no energy timers, no
  ad-gates, no IAP-driven power curve, no premium-currency shop, no
  "watch an ad to revive". Anything in these references that only
  exists to serve an F2P monetisation loop should be identified as
  such and stripped — but say what the loop was actually DOING for
  pacing/progression, so we can keep the good part (session shape,
  sense of growth, difficulty ramp) without the monetisation scaffolding.

* Treat the two games as a pair: what do they share (the genre core
  worth taking), and where do they differ (the design choices that are
  optional/interchangeable)?

* Retro PC references matter — draw the line back to the arcade/PC
  shmup ancestors these are descended from, and say what the mobile
  versions gained and what they lost versus those originals.

Deliverable
-----------
One report covering the whole folder, both games together.
```

---

## What's happening

### Game 1 — Space Shooter (Galaxy Attack), folder `1/`

A neon sci-fi vertical shooter set against a dark purple nebula. The player
flies a small fighter parked in the **bottom ~15 % of the screen**, firing
upward continuously with no fire button; waves of insectoid alien craft
occupy the upper half.

**Clip A (~140 s, 16 frames from 0:19 to 2:10)** captures one complete level
from tutorial to results screen:

- **0:19** — Onboarding. The ship sits inside a translucent spawn-shield
  bubble with a hand icon and the caption *"Move finger to control the
  ship."* HUD: pilot avatar + a blue score bar (0) top-left, a row of ten
  chevron pips underneath (the weapon-level meter), a clock + elapsed timer
  `00:19` top-centre.
- **0:28 → 0:41** (score 300 → 3900) — Classic formation combat. A 7 + 5 + 3
  Galaga-style block of horned bug-craft; later a full **ring/diamond
  formation** of ~20 green spore enemies with orange ones inside it. Damaged
  enemies carry small red HP pips above them. A glowing chevron pickup drops
  and the weapon meter climbs from 1 pip to 3; the player's fire goes from a
  single stream to a 3-wide spread.
- **0:49** (6850) — A second tutorial banner: *"Use Bomb to deal massive
  damage to enemies and remove all bullets on the screen."* The bomb button
  (a dark `B` dial, count 0) in the **lower-left** flashes `+1` with a hand
  prompt. Enemy fire is glowing orange orbs.
- **0:56** — `WAVE 3/4` banner mid-screen; a clean beat with no enemies, just
  the player's bullet stream travelling up an empty field.
- **1:03** (15450) — A wide wasp formation spanning the full width plus a
  diagonal squadron peeling in from the right edge. A `+2000 SCORE` pickup
  fires, and the ship visually upgrades (green → blue hull, twin blue lasers).
- **1:12** (22700) — `WAVE 4/4`, then a full-width red `WARNING / BOSS` band
  with a skull roundel and animated chevron chase-lights. Note that the
  banner **collides with** a simultaneous `GOOD! / +1000 SCORE` toast — three
  overlapping text layers in one frame.
- **1:21 → 2:01** — Boss fight. A large pink-and-chrome organic/mechanical
  "brain-crab" occupying the top third to half of the frame, with a thin
  full-width red HP bar pinned just under the top HUD. The player stays low
  and strafes. At 1:43 the player briefly gains a **large white winged aura**
  and unleashes a very dense bullet stream (unexplained — see Gaps). Boss
  breaks apart at 2:01.
- **2:10** — Level clear: the field empties and the ship flies up out of
  frame, then the `WIN` panel: three star objectives (*Destroy 50 % / 80 % /
  90 % of enemy forces!*), `SCORE 28230 / BEST 28230`, a `FIRST TIME REWARD`
  row (1000 coins, 100, ×1, ×10), a red `VIPO 0% coin` badge, a *"Do you like
  this level?"* thumbs-up/down telemetry prompt, replay / home / next
  buttons — and, sliding up from the bottom, a **spin wheel** marked
  ×2 ×3 ×2 ×5 ×2 ×4 ×2 with an orange *watch-ad → 1000 coins* button.

**Clip B (~90 s, 16 frames)** covers the pre-level screen and a second,
denser level:

- **Pre-level `LEVEL 1-2` panel** over the planet map: the same three star
  objectives, a nine-slot **Power Ups grid** of buyable consumables
  (+5 / +10 firepower, +5 % / +10 % fire, shield, +10 % lightning, +25 % coin,
  +10 % other) each with a green `+` purchase button, a `FIRST TIME REWARD`
  row, difficulty tabs `1-2 Normal` / `1-2 Elite`, and a `START` button with
  a *"Let's play!"* tooltip. Top bar: 0 gems, 2000 coins.
- **In-run** (16 frames, score 0 → 31000): a different pilot avatar and a
  ship already at 3 weapon pips. Waves cycle through green rocket-bugs,
  yellow sunburst bugs and blue moth craft; a ~30-strong **circular swarm**
  at 0:25; a textbook **7 × 6 Galaga grid** at 0:41 with a blue `POW` capsule
  descending; at 1:04 the formation has advanced far enough to overlap the
  HUD text at the top of the screen.
- **1:15 is the most important frame in this clip**: a **staircase wall of
  large red bullets** sweeping diagonally from the top-right down to the
  left, pinning the player against the far-left edge at mid-height. This is
  the game briefly turning into bullet-hell, and it is the pattern least
  likely to survive a landscape port (see below).
- **1:20** — a purple objective banner: *"Finish any 2 campaign level"*.

### Game 2 — 1945 Air Force, folder `2/`

A pixel-art WW2 Pacific-theatre vertical shooter. The player flies a yellow
US-roundel prop fighter (a Boeing P-26 Peashooter, named in the hangar
screen) over an ocean that scrolls past with islands, reefs, beaches,
waterfalls, ground installations and submerged ship silhouettes. Enemy
fighters, bombers, helicopters and warships come down from the top.

**Clip A (~168 s, 16 frames)** — end of one mission, a loading screen, and
most of the next:

- **Combat and terrain.** Frame 1 shows the player at the bottom-left over a
  lush island, with coins scattered *across the island's surface* as a
  collection lure; a green bomber and fighters above; pixel rain streaking
  the whole screen. HUD: a **fuel-can-shaped segmented HP bar** top-left
  (red→orange→yellow), a pause button top-right, a coin count under it, and a
  **green circular special-weapon button in the lower-left** (a fan-of-bullets
  glyph).
- **Bullet design.** Frame 3 (`0:31`-ish) is a diagonal cascade of yellow
  flame-teardrop bullets with magenta trails pouring from the top-right
  across the whole field. Frame 5 adds **red ring bullets rising from the
  bottom edge** while the boss fires down — threat from both vertical
  directions at once.
- **Boss.** A **battleship** whose sprite fills roughly two-thirds of the
  portrait height, with a full-width red HP bar across the top. The player
  strafes alongside the hull, and over four sampled frames the ship visibly
  chars and breaks apart section by section. At one point the player
  detonates a **blue shockwave** that clears the bullet field, and the
  special button goes to a dark radial cooldown.
- **Loading screen (frames 9 and 16).** A full-screen pixel-art **radar /
  cockpit console** — riveted panel, red warning lamps, toggle switches,
  analogue dials, a green sweeping radar scope with `100%` in the middle, and
  the `1945 AIR FORCE` title stencilled in. Diegetic, gorgeous, and by some
  distance the strongest single art asset in either reference.
- **Next mission** — a green skull badge top-right showing **kill progress
  as a percentage** (0 % → 23 % → 46 % → 65 % → 70 %, at which point the
  skull flips to a green tick). Coin count resets to 0 and climbs. Enemies
  include curved column flybys entering from the left edge, twin-engine
  bombers with HP bars, gold fighters, and two attack helicopters firing
  tracking rockets.

**Clip B (~102 s, 16 frames)** — the meta layer, then a full mission:

- **Hangar.** `Slot 1` plus three locked loadout slots; `POWER 67K (+1.3K)`
  rising to `75.6K (+1.5K)`; upgrade cost jumping **200 → 600 coins** for the
  same increment; a plane-level readout of `10`; a `Weekly Bonus Stats`
  banner (*"Aircraft, Wingman, Device deal ×1.3 Shocking Damage"*); a grid of
  greyed-out locked aircraft under `TIER 1 / 2 / 3 / 4` tabs. Currency bar:
  **dog-tag energy 135/100**, coins 2052 → 652, wrench/parts 0, gems 2 —
  each with a `+` buy button.
- **Base / main menu.** `Player #4765`, `VIP 0`, a `2/5` progress tile, a
  trophy tile reading `4 day(s) left`, `Battle Pass`, mail and shop tiles, a
  `STARTER PACK` offer, four squadron slots (three locked), a bottom nav of
  five tabs, and three mode buttons: `MISSION` / `QUICK PLAY Level 3 [Easy]`
  / `PVP`.
- **Pre-level `Level 3`.** Three objective slots — the first reads *Destroy
  70% enemies!*, the other two are padlocked. A `REWARDS` row: 530 coins,
  1 gem, 1 medal, 5 plane parts. Below that an `Aircrafts` loadout row
  (1 of 4 unlocked) and an `Advanced Tech` consumable row (extra plane,
  missiles, clock, fuel — each with a `+`). The `PLAY` button costs **5 dog
  tags**.
- **The mission itself** — `DESTROY 70% ENEMIES!` banner over a cloud-covered
  atoll; progress 0 → 70 %; cloud layers drift *over* the playfield as a
  parallax scrim; the player picks up a blue hex shield bubble; enemy variety
  ramps through green fighter rows, helicopters, a descending oversized
  torpedo, two spiky red mine-bosses with individual HP bars, and a gold
  helicopter mini-boss. The final frame is another wide red-orange bullet
  cascade filling the left half of the screen.

### Shared vs. different, at the level of what's on screen

Both clips-pairs show the same silhouette: an auto-firing avatar pinned near
the bottom edge, choreographed waves above it, floating HP bars, a
chevron-glyph weapon-upgrade pickup, a lower-left screen-clear button, a
fixed-length level ending in a boss, and a results/objectives screen.

The visible differences: Space Shooter plays on an **empty starfield** with
**geometric formations** (grids, rings, arcs) and a **discrete-lives** feel
(spawn shield, respawn); 1945 Air Force plays over **detailed scrolling
terrain** with **naturalistic squadron flybys plus ground and sea targets**,
and uses an **attrition HP bar** (the fuel can) instead of lives.

---

## Genre & comparables

Both are **2D vertically-scrolling shoot-'em-ups (shmups)** in the
free-movement, auto-fire, mobile-casual mould. They are not the same
sub-genre, though, and Amit's framing is worth sharpening here:

- **Space Shooter is a Galaga descendant** — a *formation shooter*. Its
  enemies fly in, lock into geometric grids/rings, hold position, and dive
  out. Nearest comparables: *Galaxian*, *Galaga*, *Galaga '88*, and on mobile
  *Galaxy Attack: Alien Shooter* (a near-clone of it, from the same
  developer lineage).
- **1945 Air Force is a 1942/1943 descendant** — a *military scrolling
  shmup*. Terrain scrolls, squadrons fly by naturalistically, warships and
  installations are targets, health is an attrition bar, bosses are capital
  ships. Nearest comparables: *1942*, *1943: The Battle of Midway*,
  *Raiden*, *Aero Fighters / Sonic Wings*, *Strikers 1945*, and on modern
  mobile *Sky Force* / *Sky Force Reloaded*.

That distinction matters for stage 2, because the two ancestors give
different answers to the landscape question (see below).

---

## Core mechanic(s)

Stripped to the bone, and identically in both games:

1. **Free continuous 2D positioning of an auto-firing avatar.** Drag anywhere
   on screen; the ship follows the finger with a vertical offset so the
   thumb doesn't cover it. There is **no fire button** — the gun runs
   constantly. The entire moment-to-moment verb is *"where do I stand"*.
2. **Read and thread incoming choreography.** Waves arrive from the far edge
   on set paths; the player finds and holds the safe aisle while keeping the
   gun pointed at something worth killing. Positioning is simultaneously the
   dodge *and* the aim.
3. **Collect drops that alter that positioning problem.** Weapon-level
   chevrons, shields, coins/score pickups — all of which pull the player up
   into contested airspace, deliberately trading safety for growth. 1945 Air
   Force is the more aggressive of the two here (its coins are strewn across
   the map like a Sonic ring trail).
4. **One panic button.** A screen-clearing bomb (Space Shooter, consumable
   count) or special weapon (1945 Air Force, cooldown dial) that wipes
   bullets and damages everything.

Everything else in both products — hangar, tiers, currencies, PvP, battle
pass — sits outside the moment-to-moment loop.

---

## Portrait → 16:9 landscape: what breaks, and the concrete equivalent

The reference frames are 1080 × 2340, i.e. **2.17 × taller than wide**. A
16:9 landscape frame is **1.78 × wider than tall**. The width-to-height ratio
changes by a factor of roughly **3.9×**. Nothing about this genre's layout
survives that untouched. Element by element:

### 1. Playfield shape and the reaction-time budget

**What breaks.** In portrait, an enemy or bullet spawning at the top edge has
~2.17 screen-*widths* of travel before it reaches the player. That distance
*is* the player's reading time, and the genre's entire difficulty tuning is
built on it. Drop the same content into 16:9 at the same pixel speed and that
travel becomes ~0.56 screen-widths — you lose roughly **three-quarters of the
reaction budget** in one move.

**The landscape equivalent — two options, and they conflict.**

- **Option A — rotate to a horizontal scroller.** Travel axis becomes the
  long axis: enemies enter from the right, the player holds the left third,
  and the *short* (vertical) axis becomes the dodge axis. This is the
  Gradius / R-Type / Darius framing, and it preserves the reaction budget
  natively — it is what the arcade tradition actually did whenever it had a
  landscape screen. **Problem: it puts the dodge axis on up/down**, which is
  the physically expensive lean on GoBalance.
- **Option B — keep the vertical scroll, treat 16:9 as a wide arena
  (recommended).** Enemies still descend, but you compensate for the lost
  depth in *time* rather than distance: cut enemy and bullet speeds by
  roughly 40–50 %, scale sprites down so more of them fit in the shallow
  field, and spend the surplus width on lateral formations and lateral
  movement instead of depth. **This puts the dodge axis on left/right**,
  which is GoBalance's comfortable axis.

Flagging the conflict plainly because it's the single most consequential
choice stage 2 will make from this report: *the framing that's best for
readability (A) is the worst for the board, and vice versa.* On the strength
of the existing GoBalance lean-axis finding, Option B is the right trade —
but it has to be paid for with pacing, not hand-waved.

### 2. Scroll direction and length

**What breaks.** Portrait gives a long "corridor" you read down. 16:9 has no
corridor on the vertical axis. Also, 1945 Air Force's terrain scroll is a big
part of its sense of *progress through a mission* — in landscape the terrain
passes in a third of the time.

**Equivalent.** Keep vertical scroll for the backdrop (it still reads as
flight) but slow it and widen the terrain features so a single island fills
the frame for several seconds rather than flashing past. Telegraph threats
with an **entry band along the top edge** — warning markers or shadow
silhouettes that appear ~1 s before the enemy does, buying back the reading
time the short axis took away. 1945 Air Force already does an accidental
version of this with cloud layers; formalise it.

### 3. Enemy formation design

**What breaks.** Space Shooter's grids are ~7 wide × 5–6 deep and fill the
top ~40 % of a portrait screen, leaving ~60 % as the player's safe corridor.
The same grid in 16:9 would occupy essentially the whole height. Worse, the
Galaga signature — *dive out of formation, loop, return* — is a vertical
manoeuvre that in landscape crosses the entire short axis instantly, giving
no time to react.

**Equivalent.**
- Formations become **wide and shallow**: 10–14 across × 2–3 deep, occupying
  the top **30–35 %** of the frame. The extra width is genuinely useful — a
  wide formation is a more interesting *lateral* targeting problem, which is
  exactly the axis we want the player working on.
- Re-choreograph the dive as a **horizontal swoop**: enemies peel off and
  arc *across* the width in an S-curve, dipping toward the player band
  rather than plunging through it. Travel stays mostly on the long axis, so
  reading time is preserved and the required dodge is lateral.
- 1945 Air Force's curved column flybys (entering from the side edge and
  arcing) already work this way and port almost unchanged. Its
  straight-down-from-the-top squadrons do not.

### 4. Bullet-pattern readability

**What breaks.** Both games' hardest moments are **diagonal staircase walls**
of bullets travelling top-to-bottom (Space Shooter clip B at 1:15; 1945 Air
Force clip A frame 3 and clip B frame 16). Those patterns are legible in
portrait purely because they take a long time to traverse. In 16:9 they
collapse into an instantaneous curtain with no readable aisle.

**Equivalent.**
- **Fewer, larger, slower bullets.** Trade bullet count for bullet size so
  the pattern is still visually dense but individually trackable.
- **Prefer laterally-travelling patterns**: fans, sweeping sine waves and
  rotating spokes that move *across* the width. Their travel is on the long
  axis, so the player has time; and the required response is a committed
  lateral move rather than a stutter of micro-corrections.
- **Hard-cap simultaneous on-screen bullets** and enforce a guaranteed
  minimum aisle width in every pattern. Both references let patterns
  degenerate into "find the one pixel gap"; that is not survivable on a
  balance board.
- **Keep the colour discipline.** Both games colour-separate ownership well —
  player fire is green/blue (Space Shooter) or yellow-with-magenta-trail
  (1945 Air Force), enemy fire is orange/red orbs. That reads at a glance and
  costs nothing. Carry it over verbatim.
- **Do not carry over 1945 Air Force's bullets-from-below.** Clip A frame 5
  has red ring bullets rising from the bottom edge while the boss fires
  down. In a short frame that means simultaneous pressure from both vertical
  directions with no escape lane — and on a board, an emergency forward or
  back lean.

### 5. The safe zone / danger zone the player occupies

**What breaks.** In the sampled frames the Space Shooter player is almost
always inside the bottom ~15 % band, and 1945 Air Force's player mostly in
the bottom ~30 % (it does climb — clip A frame 6 has it flying alongside the
battleship at mid-height). Portrait affords a tall neutral no-man's-land
between the player band and the enemy band. 16:9 has no such buffer.

**Equivalent.** Make the three bands explicit and budget them:
- **Player home band: bottom ~30 %** of the frame. This is where the avatar
  lives and where the game promises the player *can* be safe if they read
  correctly.
- **Enemy formation band: top ~30 %.**
- **A transit gutter of at least ~25 %** in the middle that enemies cross but
  never camp in. Anything that parks in the gutter (a hovering mini-boss, a
  stalled formation) instantly removes the player's read.
- Enforce a HUD-exclusion rule so enemies can't drift into the readout
  strips — Space Shooter clip B at 1:04 shows a formation physically
  overlapping the score and timer, which in a shallow frame is much worse.

### 6. Boss framing

**What breaks.** 1945 Air Force's battleship boss *is* its vertical sprite:
a long hull filling two-thirds of the portrait height, which you strafe along
and chew apart section by section. That shape cannot exist in landscape.
Space Shooter's boss occupies the top half — also gone.

**Equivalent.**
- **Wide bosses.** The obvious 1945-flavoured translations: a battleship seen
  **broadside / lengthwise horizontally** across the frame; an aircraft
  carrier whose flight deck spans the width; a heavy bomber formation as a
  single multi-part entity. All of these preserve the "attack the hull
  section by section" pleasure, just rotated.
- **Multi-part bosses with destructible turrets spread across the width.**
  This is the mechanical heart of what 1945 Air Force's boss actually does
  and it maps onto the wide frame better than it did onto the tall one.
- **Boss HP bar full-width along the top edge.** Both games already do this
  and it transfers cleanly — it's one of the very few HUD elements that is
  *better* in landscape.
- Space Shooter's `WARNING / BOSS` banner is a full-width horizontal band;
  it also survives the rotation intact. Keep the idea, fix the collision
  (clip A frame 8 has it stacked under two other text layers).

### 7. UI / HUD placement

**What breaks.** Portrait puts everything in the top strip because the top of
a portrait screen is dead space anyway — the action happens below it. In
16:9 the top strip *is* prime playfield. Conversely, the left and right
margins, which are precious in portrait, are cheap in landscape.

**Equivalent.**
- Push persistent readouts into the **top-left and top-right corners only**
  and keep the central column of the top edge clear for incoming enemies.
- Use the **left and right margins** for anything vertical: HP/fuel as a
  vertical gauge up the left edge, mission progress up the right edge. This
  is essentially free real estate in landscape and it de-clutters the top.
- The full-width banner (`WAVE 3/4`, `WARNING BOSS`, `DESTROY 70% ENEMIES!`)
  is the one pattern that improves in landscape — it gets wider and shorter,
  so it can occupy less of the play area for the same legibility. Keep it,
  but make it a single-slot queue so two banners can never overlap.

### 8. Thumb reach and input zones

**What breaks.** Both games are one-thumb portrait games: drag anywhere to
move, with a single button in the **lower-left thumb arc** (Space Shooter's
bomb dial, 1945 Air Force's special weapon). In portrait the reachable
semicircle from a bottom corner covers essentially the whole playfield width.
Landscape inverts this: the two reachable arcs are at the bottom corners and
the **centre of the screen is the hardest place to reach**, which is exactly
where a landscape shmup's action is.

**Equivalent, and the bit that matters most for us.** On GoBalance the board
is the input, so touch reach is moot — but the corollary is not: **there is
no thumb available to press the bomb button at all.** Any button-shaped verb
has to be re-homed. Three viable routes, in order of preference:

1. **Automatic** — the screen-clear fires itself when the bullet count or
   incoming-threat score crosses a threshold, as a mercy system. Removes the
   verb, keeps the beat.
2. **Pickup-triggered** — flying into a bomb pickup detonates it immediately
   rather than banking it. Converts a button press into a positioning
   decision, which is the verb the player already has.
3. **A distinct lean gesture** — e.g. a deliberate hold at a lean extreme.
   Workable, but if it needs the forward/back axis it carries the ergonomic
   cost, so treat it as a fallback.

Note that 1945 Air Force's cooldown-dial special is a better base for any of
these than Space Shooter's consumable bomb, because it's always eventually
available and doesn't depend on an inventory.

---

## Free-to-play scaffolding: what it was doing, and how to keep the function

Everything monetisation-adjacent visible in the footage, what it was
structurally *for*, and the non-monetised replacement.

| Observed in footage | What it was structurally doing | Keep the function this way |
|---|---|---|
| **3-star objectives** (SS: *Destroy 50 % / 80 % / 90 % of enemy forces*; AF: *Destroy 70 % enemies!* with two locked slots) | **Not monetisation.** Replay scaffolding and a skill ladder — one clear, three mastery targets. | **Keep verbatim, free.** This is the single most portable idea in either game and costs nothing. |
| **`FIRST TIME REWARD` row** (both pre-level and win screens) | Marks novelty; pulls the player toward unseen content rather than farming a cleared level. | Keep as a **first-clear flourish** — a unique animation, a badge, an unlock. Drop the currency payload. |
| **In-run coin pickups** (AF strews them across islands and behind enemies; SS drops `+500` / `+1000` / `+2000 SCORE` chips) | Two jobs: a **movement lure** that routes the player into contested airspace, and a soft-currency feed. The lure half is real level design. | **Keep the lure, drop the wallet.** Coins become score/combo pips whose *placement* shapes the flight path. |
| **Coins + gems + parts/wrenches + dog tags** (four currencies in AF, two in SS) | Price discrimination and conversion funnels. | **Delete all of it.** Nothing in the moment-to-moment loop depends on any of it. |
| **Energy** (`135/100` dog tags; `PLAY` costs 5) | Caps session length and forces a return visit. | **Delete outright.** On a physical installation the queue *is* the session cap. Replace with an explicit, honest mission length — the observed levels run **~100–170 s**, which is already about right for a walk-up turn. |
| **Aircraft power ladder** (`POWER 67K → 75.6K` for 200 then 600 coins; TIER 1–4 tabs; three locked plane slots; wingman/device slots) | An IAP-shaped power curve. But its real design job is (a) making the difficulty ramp survivable and (b) supplying a **visible growth number**. | **Move all growth inside the run.** Both games already ship the free version of this: the **chevron weapon-level pickup** (SS's 10-pip meter filling from 1 → 10 over a single level; AF's chevron drops). Growth arcs within a run, resets between runs. Persistence across runs should be cosmetic/unlock only. |
| **Pre-level consumable shop** (SS's 9-slot Power Ups grid with `+` buttons; AF's `Advanced Tech` extra-plane / missiles / clock / fuel) | Pay-to-lower-difficulty: a release valve for stuck players, sold. | Keep the valve, don't sell it: **explicit difficulty selection** (both games already have the free version — SS's `Normal` / `Elite` tabs, AF's `Level 3 [Easy]`) and/or a quiet **dynamic difficulty** that eases spawn density after repeated deaths. |
| **End-of-run spin wheel** (×2 ×3 ×5 multipliers) **+ watch-ad → 1000 coins** | A variable-reward dopamine beat placed precisely at session end, where drop-off risk is highest. | **Keep the beat, earn it.** A score-tally animation where multipliers are revealed one at a time from things the player actually did — accuracy, no-hit streak, objectives met, boss time. Same escalating-reveal rhythm, no ad. |
| **VIP tier, Starter Pack, Battle Pass, `4 day(s) left` event, `2/5` daily tiles, `Finish any 2 campaign level` task** | Login retention and lifetime-value shaping across days. | **Delete.** These solve a problem (day-2 return) that a physical installation does not have. If a persistent hook is ever wanted, it should be a **local leaderboard**, not a calendar. |
| **`Do you like this level?` thumbs** | Telemetry, not monetisation. | Harmless. Drop it — it breaks the fiction and we can instrument silently. |
| **`WAVE 3/4` banners, boss at wave 4/4, AF's kill-% meter** | Pure pacing and legibility. Free already. | **Keep, and prefer AF's percentage meter.** For a queue-based product, a visible "how close am I to the end" readout is worth more than a count-up timer — Space Shooter's clock tells you how long you've been playing, AF's `70 %` tells you how long is left. |

**The one-line summary for stage 2:** almost everything valuable in these
games' structure — objectives, wave pacing, in-run power ramp, boss cadence,
end-of-run reveal — is already free. The monetisation layer is bolted *on
top* of a working arcade loop, not woven into it, and removing it leaves the
loop intact. The only thing that genuinely has to be redesigned rather than
deleted is the **between-run power curve**, and the fix is to move that
growth inside the run.

---

## The pair: shared core vs. interchangeable choices

Amit's note says the two are "very close to each other in gameplay". I agree
at the level of the core loop, and I'd add that the divergences are more
load-bearing than they first look.

### Shared — the genre core worth taking

1. **Auto-fire.** Neither game asks you to press shoot. This halves the input
   demand and is the single most important shared property for us.
2. **Free continuous 2D positioning**, not discrete lanes. Absolute,
   analogue, drag-to-place.
3. **Choreographed waves from the far edge**; the player's job is to read and
   thread them.
4. **In-run power ramp via dropped pickups** — both games literally use the
   same chevron/rank glyph for it.
5. **One screen-clearing panic button** on a count or cooldown.
6. **Fixed-length level (~100–170 s) terminating in a boss or a percentage
   objective**, then a results screen with star objectives.
7. **Colour-coded bullet ownership** and floating HP bars over damaged
   enemies.

### Divergent — the optional/interchangeable choices, and who does what better

| Dimension | Space Shooter | 1945 Air Force | Better for us |
|---|---|---|---|
| **Damage model** | Discrete lives; spawn-shield bubble; respawn visible mid-run | Attrition **fuel-can HP bar** that drains over many hits | **1945 Air Force.** A bar degrades gracefully — a walk-up player on a balance board gets one turn and should not lose it to a single mistake. |
| **Enemy grammar** | Geometric **formations** — grids, rings, arcs — that hold position and dive | Naturalistic **squadron flybys** plus sea/ground targets | **Space Shooter** for legibility (a grid is instantly parseable); **1945 Air Force** for variety. Take SS's structure and AF's bestiary. |
| **Background** | Empty dark starfield | Rich scrolling terrain, plus cloud layers drifting *over* the playfield | **Space Shooter** on pure readability — bullets are never lost. AF wins on sense-of-place but frames 6–8 of its clip B show coins and bullets fighting the island art and the cloud scrim. If we take terrain, it must be desaturated/low-contrast under the action layer. |
| **Progress feedback** | Count-up timer + score + `WAVE n/4` | **Kill-percentage meter** that flips to a tick at the objective | **1945 Air Force**, clearly. |
| **Screen-clear** | Consumable bomb, count starts at 0, essentially a shop item | Cooldown dial, always eventually available | **1945 Air Force.** A cooldown is a design element; a purchasable count is a store hook. |
| **Threat directions** | Almost exclusively top-down | Top-down, side entries, **and bullets from below** during bosses | **Space Shooter.** AF's omnidirectional pressure is the thing to explicitly *not* port. |
| **Meta layer** | Light: planet map, level tabs, consumable grid | Heavy: hangar, tiers, wingmen, devices, PvP, battle pass, VIP | Neither — but SS's lightness means less to strip. |
| **Art direction** | Glossy neon vector/3D-ish, heavy bloom | Handmade pixel art with diegetic military UI | **1945 Air Force**, decisively — see below. |

**Composite read:** the ideal reference is *Space Shooter's readability and
formation grammar wearing 1945 Air Force's damage model, progress meter,
cooldown special and art direction.*

---

## Input demand, explicitly checked against GoBalance

**Direction count.** The core loop needs **two axes of continuous positioning
— nominally all four directions.** But the important nuance is *how* it needs
them:

- **There is no action button in the core loop.** Firing is automatic in both
  games. The only verb is movement. That is unusually clean for this product.
- **The movement is analogue and continuous**, not discrete lane-hopping —
  which matches the established GoBalance preference for free continuous
  movement over discrete lanes.
- **The axes are not used equally.** Across all 64 sampled frames, the Space
  Shooter player sits inside the bottom ~15 % band and moves almost purely
  **laterally**; vertical movement is rare, small, and slow (nudging up to
  catch a chevron drop, backing off during a boss). 1945 Air Force uses more
  vertical range — it does climb to mid-screen — but still spends most frames
  low and moving side to side.

**So the honest characterisation is: this is a primarily lateral game with
occasional slow vertical adjustment** — which is close to the best possible
shape for a lean-based board. The comfortable axis carries the reflexive
load; the expensive forward/back axis carries only slow, deliberate,
non-time-critical repositioning. That is the tolerable use of that axis.

**Speed is the problem, not direction count.** In the reference footage,
bullets appear to cross the full portrait height in roughly **1–1.5 s**
(inferred from sprite trails and spacing across frames — *not measured*), and
during the bullet-wall moments the player is making **several corrections per
second** (Space Shooter clip B 1:15; 1945 Air Force clip A frames 3 and 5,
clip B frame 16). That cadence is a touchscreen cadence. It is not achievable
with a physical lean, and attempting it is an exertion problem, not just a
controls problem.

**Recommendation.** This is, so far, the **best-fitting reference genre this
pipeline has reviewed** for GoBalance — better than the lane runner, and
comparable to the on-rails tunnel dodger but with more depth — *provided*
three trims are made:

1. **Demote the vertical axis.** Design so the player can win playing almost
   entirely laterally, with forward/back reserved for slow, optional,
   generously-timed moves (grabbing a pickup, closing on a boss). Never
   require a fast vertical dodge, and never require simultaneous fast lateral
   + vertical threading.
2. **Slow the threat clock.** Cap enemy bullet speed so the **shortest
   reaction window is ≥ ~0.8–1.0 s**, cap simultaneous on-screen threats, and
   convert bullet walls into slow lateral sweeps that need *one committed
   lean* rather than a stutter of micro-corrections.
3. **Re-home the bomb.** No thumb exists to press it (see §8 above). Make it
   automatic, pickup-triggered, or gesture-bound.

**Explicitly do not port:** the diagonal staircase bullet curtains, the
simultaneous top-and-bottom pressure in 1945 Air Force's boss fights, and any
pattern whose safe aisle is narrower than the player's realistic lean
precision.

---

## Visual style notes

**Space Shooter.** Glossy rendered-3D-looking sprites on a near-black purple
nebula gradient; heavy bloom on everything; saturated neon green and cyan
player bullets against orange/red enemy orbs. Chunky italic display type for
banners, with a red `WARNING` band carrying a skull roundel and animated
chevron chase-lights. Gold-and-blue plated UI panels with bevels and wing
motifs. It reads well for one reason worth extracting: **maximum contrast
against a near-empty dark field.** The art itself is generic 2015-era mobile
arcade and isn't worth imitating; the contrast discipline is.

**1945 Air Force.** Genuine pixel art with a restrained palette and real
craft:

- **Diegetic military UI** — the health bar is a **jerrycan**, the energy
  currency is a **dog tag**, panels are riveted steel with wear and rust.
- **The loading screen radar console** (clip A frames 9 and 16) is the
  standout asset in either reference: a full-screen pixel-art cockpit panel
  with warning lamps, toggle switches, analogue dials and a sweeping green
  radar scope. It is a model for how to make a loading screen part of the
  fiction rather than an interruption, and it should go into a style guide
  as a reference for **diegetic UI** generally.
- **Bullets drawn as flame-teardrops with magenta trails** — legible against
  the mid-blue ocean at any size, and instantly distinguishable from the
  player's own fire. Excellent, cheap readability trick.
- **Environment storytelling in the scroll**: beaches, cliffs, waterfalls,
  huts, watchtowers, tanks, bomb craters, and **submerged ship silhouettes
  visible under the water**. The terrain does real narrative work.
- **Caveats.** The cloud layers pass *over* the playfield as a parallax scrim
  and measurably hurt readability (clip B frames 6–8). Coins sitting on busy
  island art also lose contrast. If we take terrain, it needs to be
  desaturated and lower-contrast beneath the action layer than 1945 Air
  Force's is.

**Both.** Floating red HP pips above damaged enemies; a chevron/rank glyph
for the weapon-upgrade pickup; full-width horizontal boss HP bars. All three
are cheap, legible, and port to landscape unchanged.

---

## Gaps / low-confidence areas

- **Sampling density.** 16 frames per video across 90–168 s means one frame
  every ~5.6–10.5 s. **All timing claims are inferred**, including bullet
  speeds, dodge cadence, wave durations, and the Galaga dive-and-return
  behaviour in Space Shooter (which I attribute from formation geometry and
  genre knowledge, having never caught a dive mid-motion).
- **No death, game-over or continue screen was captured in either game.** So
  the death penalty, retry flow, and — importantly for the F2P audit — any
  **ad-revive** are unverified. I'd expect an ad-revive in both (it's
  standard for the genre) but it is *not* in these frames and I won't assert
  it.
- **Space Shooter clip A, 1:43: the white winged aura.** The player briefly
  gains a large white wing effect and a very dense bullet stream. Could be an
  invulnerability/revive state, a limit-break super, or a wingman pairing.
  Unresolved.
- **Space Shooter clip B: the ship changes green → blue mid-run**, and a
  small ship with an orange ring appears bottom-left at 0:58. Could be lives
  remaining, a respawn, or a ship-swap power-up. Unresolved.
- **The bomb economy.** Space Shooter's `B` counter reads `0` for almost all
  of clip A and shows a scripted `+1` during the tutorial. I can't tell from
  the footage how bombs are earned in normal play versus bought.
- **1945 Air Force's loadout depth is unverified.** I never saw `MISSION`
  mode, a `PVP` match, or a wingman/device equipped and firing, so I can't
  say what those slots actually do to the moment-to-moment game.
- **Exact scoring rules in both.** Space Shooter's `+500` / `+1000` /
  `+2000 SCORE` with `GOOD!` toasts look like wave-clear or accuracy
  bonuses, but the trigger condition is unconfirmed.
- **No audio.** Frames only, so nothing about music or SFX design — which for
  a genre this reliant on impact feedback is a real blind spot.
- **Unexplained UI:** Space Shooter's `VIPO 0% coin` badge and the `0/3` and
  `0/10` counters on the map screen.

---

## External research

Amit's notes ask specifically for the retro lineage to be traced and say
"research the genre online where it sharpens the analysis". This section is
**research, not observation of the provided footage** — kept separate on
purpose.

### The two ancestries

**Space Shooter → Galaxian / Galaga (Namco, 1979 / 1981).** *Galaxian*
(designed by Kazunori Sawano) was Namco's answer to *Space Invaders*, and its
innovation was exactly the thing Space Shooter still runs on: enemies hold a
formation at the top of the screen and then **break off to dive-bomb the
player** while firing, rather than just marching downward. *Galaga* refined
it by having waves **fly in along a path before locking into formation**,
giving the player a window to kill them pre-formation — and by escalating so
that, once enough enemies die, the survivors stop returning to formation and
dive continuously. Space Shooter's grids, rings and arcs, its
hold-then-dive behaviour, and its wave-count banners are this lineage
essentially unchanged, forty-five years on.

**1945 Air Force → 1942 / 1943 (Capcom, 1984 / 1987).** *1942* established
the WW2 Pacific-theatre vertical shmup as a template — prop planes, formation
flybys, an ocean backdrop, power-up planes — and is widely credited as one of
the most influential shmups ever made. *1943: The Battle of Midway* added the
two things that make 1945 Air Force recognisably its descendant: an
**energy/fuel bar that doubles as a timer** (Capcom's jerrycan-adjacent
"ENERGY" gauge) and **giant capital-ship bosses attacked section by
section**. 1945 Air Force's fuel-can HP bar and its battleship boss with a
full-width health bar are near-direct quotations. Store and press framing for
1945 Air Force names *1942*, *Galaga* and *Sky Force* as its explicit
references, and ONESOFT (its developer) also publishes the Space Shooter
line — which explains how similar the two feel.

**The retro *PC* half of Amit's framing is real but sits in a specific
place.** The arcade coin-ops above are the gameplay ancestors. The
**hangar/upgrade-between-levels loop** — the part that looks most like
monetisation today — actually comes from the DOS shareware shmups:
**Raptor: Call of the Shadows (Apogee, 1994)** and **Tyrian (Epic, 1995)**
both ran a between-mission shop where you spent mission earnings on hulls,
guns and shields. Worth saying plainly to stage 2: *the shop-between-levels
loop is retro-PC heritage, not an F2P invention.* It only became a
monetisation vector later. That means the loop's *design* function (visible
growth, difficulty smoothing) is separable from its *business* function, and
keeping the former while dropping the latter is historically legitimate, not
a compromise.

Other titles worth naming for the arcade line: *Raiden* (1990), *Aero
Fighters / Sonic Wings* (1992), *Strikers 1945* (1995).

**The modern proof point: Sky Force / Sky Force Reloaded (Infinite Dreams).**
Directly relevant because it demonstrates the whole progression shape running
**without energy, gacha or ad-gates**: stars collected in-run feed a
persistent upgrade tree (and you keep most of them even when you die), and
each level carries **four objectives whose medals are the currency that
unlocks the next stage** — so replaying earlier levels *is* the progression
system rather than padding. That is a working, shipped, commercially
successful version of "3-star objectives + growth curve, minus the
monetisation scaffolding", and it's the closest existing reference for what
Amit is describing.

### Why the genre is portrait at all — and why landscape isn't heresy

Vertical shmups are portrait because of an **accident of arcade hardware**:
cabinet CRTs could be physically rotated 90°, turning a 4:3 screen into 3:4,
and *1942*, *TwinBee* and their peers were built for that rotated tube
(hence "TATE mode", from the Japanese for *vertical*). Mobile inherited that
orientation for free because phones are portrait. Modern 16:9 displays are
where the format falls apart — the standard complaint is that a faithful
vertical shmup on a widescreen display wastes 60 % of the panel on borders.

The useful reframe for stage 2: **going landscape is not abandoning the
genre's tradition, it's picking up the other half of it.** The same arcade
era that produced *1942* also produced *Defender* (1981), *Gradius* (1985),
*R-Type* (1987) and *Darius* (1986) — horizontally-scrolling shmups built
natively for a landscape tube, with the travel axis on the long edge and the
dodge axis on the short one. Every layout problem catalogued in the
"Portrait → 16:9" section above was solved once already by those games. They
are the reference set to raid for landscape formation choreography, boss
staging and HUD placement — with the one caveat noted earlier, that their
solution puts the dodge axis on vertical, which is the axis GoBalance would
rather not use.

### What the mobile versions gained versus the arcade/PC originals

- **Absolute analogue positioning.** Drag-to-move is strictly better than a
  4- or 8-way stick for threading dense patterns — which is precisely why
  modern mobile shmups can run bullet densities *1942* never attempted.
- **Auto-fire.** The arcade original required button-mashing; removing that
  frees the whole input budget for movement. (This is the single most
  GoBalance-relevant thing mobile did to the genre.)
- **Replay structure.** Arcade shmups were historically ~20 minutes of total
  content mastered over hundreds of attempts. Per-level star objectives and
  persistent progression give them a reason to be replayed by players who
  aren't chasing a one-credit clear.
- **Legibility affordances** the originals lacked: floating enemy HP bars,
  telegraph banners, colour-coded bullet ownership, boss health bars.
- **Far more art fidelity per sprite**, and — in 1945 Air Force's case —
  genuinely lovely pixel craft that 1987 hardware could not have held.

### What they lost

- **The one-credit-clear discipline.** Arcade shmups were about mastering a
  *fixed* challenge with *fixed* power. When a stat upgrade can solve a
  level, skill stops being the axis of progress. Both reference games have
  this problem: 1945 Air Force's `POWER 67K → 75.6K` is a number that beats
  levels for you.
- **Difficulty tuned for fairness.** Once a shop exists, there is commercial
  pressure to tune levels to be *just* unfair enough to sell a power-up. That
  corruption is invisible in a single session but it is why both games' spike
  moments (the bullet walls) feel arbitrary rather than authored.
- **Scoring depth.** Arcade shmups had rank systems, chains, medal
  multipliers — real strategic layers built on top of survival. Both these
  games score simply and treat score as decoration rather than a system.
- **The finger.** Touch control means the player's hand occludes the
  playfield exactly where the action is. (Not our problem — GoBalance
  removes the hand from the screen entirely, which is a genuine advantage
  worth stating.)

---

*Sources consulted for the External research section:*
[Capcom 1942 and its influence on the shoot-'em-up genre](https://avi-8.com/blogs/the-aviation-journal/capcom-1942-and-its-influence-on-the-shoot-em-up-genre) ·
[1942 (Video Game) — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/NineteenFortyTwo) ·
[A brief history of World War II shoot 'em ups](https://arcadethrowback.blogspot.com/2012/06/BriefHistoryWWIIShmups.html) ·
[1945 Air Force (Uptodown listing)](https://1945-air-force.en.uptodown.com/android) ·
[Galaxian — Wikipedia](https://en.wikipedia.org/wiki/Galaxian) ·
[Recreate Galaxian's iconic attack patterns — Raspberry Pi / Wireframe](https://www.raspberrypi.com/news/recreate-galaxians-iconic-attack-patterns-wireframe-50/) ·
[Galaga — Giant Bomb](https://giantbomb.com/wiki/Games/Galaga) ·
[Rediscovering the Vertical: TATE Mode Gaming](https://siit.co/blog/rediscovering-the-vertical-tate-mode-gaming/33214) ·
[What are "TATE Mode" games](https://www.yahoo.com/tech/tate-mode-games-best-way-113013771.html) ·
[Sky Force Reloaded review — TheSixthAxis](https://www.thesixthaxis.com/2017/11/29/sky-force-reloaded-review/) ·
[Sky Force Reloaded review — Nintendo Insider](https://www.nintendo-insider.com/sky-force-reloaded-review/)
