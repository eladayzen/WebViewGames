# Half Shell Hustle — Scrap-Bot Skin — QA Overview

## What the game is

A 3-lane endless runner controlled via balance-board tilt (GoBalance hardware) or
keyboard in browser. The player character is **"Scrap-Bot,"** a small salvage robot
with magnet hands who runs down a lane, switching between 3 lanes and jumping to
dodge obstacles, collect coins, and bump into a tall standing "energy pylon" prop
for bonus points. This is a **reskinned build** — same engine/mechanics as the
existing TMNT (Half Shell Hustle) game, but with all character art, enemy art, and
curtain/UI art replaced. **There should be zero Ninja Turtles content anywhere in
this build** — no turtle character, no shell/mask imagery, no turtle-shell
patterns. Flagging any that slips through is a top-priority QA item.

## Core loop

- Player auto-runs forward; lean left/right (or arrow keys) to change lanes, lean
  forward/back (or up/down) to jump.
- Coins and a rarer "bonus" coin type add points continuously.
- A tall glowing "energy pylon" (4 color variants) stands in the lane — bumping
  into it removes it, awards a bonus, and triggers a small particle burst.
- Barricade obstacles must be dodged or jumped; hitting one costs a life (5 lives
  total, some pickups can restore one).
- Points accumulate toward tier thresholds (300 / 800 / 1500, then +1000 each tier
  after). Reaching a threshold ends the current level, plays a level-complete
  screen + curtain transition, and starts the next level in a **new environment**,
  with points/tier/lives/speed carrying over.
- Reaching the **last tier's own threshold ends the run entirely** — see
  "Finishing the game" below. This is new; it used to loop forever.

## Environments (tiers, in final order)

1. **Big Warehouses — Under Roof** (indoor variant — visible steel roof
   trusses/skylights overhead, muted colorful box-pile walls)
2. **Big Warehouses** (outdoor variant — same warehouse district, open sky,
   corrugated-panel walls with crate stacks)
3. **Central City**
4. **Harbor Docks**
5. **Funky Forest** (bright/vivid non-naturalistic forest — glowing mushrooms,
   tall wood-cabin-style buildings, NOT tree-trunk shaped — should read as a
   forest but built from normal box-shaped buildings)
6. **Space City** (sleek chrome/glass sci-fi towers, vivid nebula sky — the LAST
   tier; clearing its threshold ends the run, see below)

## Finishing the game

Clearing Space City's own point threshold (currently 4500 lifetime points) ends
the run in victory, not another tier-up:

- A dedicated **"ALL TIERS CLEARED!"** screen appears — its own confetti burst,
  bouncy title animation, the run's final score. This screen has no timer and no
  Space/Enter shortcut; **CONTINUE** is the only way off it (a stray tap must
  never skip it).
- CONTINUE leads to the same end-of-run board the quit flow uses (see below),
  headlined "ALL TIERS CLEARED!" instead of "RUN ENDED," with PLAY AGAIN / QUIT.

## Ending a run — leaderboard & quit flow

Every way a run can end (die, quit mid-run, or clear the last tier) banks the
score and shows a family-account leaderboard (GoBalance `submitScore`/
`getScoreboard` — no-op outside the app, section stays hidden in a plain
browser):

- **Die**: the usual game-over overlay (`#gameover-overlay`) gets a leaderboard
  section above the RETRY button.
- **Quit mid-run**: tapping the X (top-right) pauses and raises a confirm ("Your
  score will still be counted.") — KEEP PLAYING resumes exactly as it was
  paused; QUIT ends the run, submits it, and shows a "RUN ENDED" board (PLAY
  AGAIN / QUIT) with the same leaderboard.
- **Clear the last tier**: see "Finishing the game" above — same board, "ALL
  TIERS CLEARED!" headline.

QA note: the leaderboard is **account/device-scoped, not global** — expect it
empty/hidden in a plain browser, and don't file a bug for that. Do check: your
own run's row is highlighted when the board isn't empty; PLAY AGAIN and QUIT
both work from every board; the confirm modal's KEEP PLAYING resumes correctly
even if the game was already paused before the X was tapped.

## Audio & settings

- SFX: jump, coin collect, enemy/pylon-bump collect, hit/damage, game over, level
  complete, UI tap.
- One looping background music track.
- **Settings panel** (gear icon, top-right chrome row) — player-facing only:
  **SENSITIVITY**, **SFX on/off**, **MUSIC on/off**. Persists across reloads
  (localStorage).
- Music should duck/stop during the level-complete transition and resume when the
  next level starts. Pausing the game should also pause the music, and resume it
  on unpause (except mid-transition).

## Dev tools (not for release, and shouldn't be reachable by accident)

Everything else that used to live in the settings panel — steering **MODE**
(stepped/absolute), the absolute-mode tuning knobs (lane zone, hysteresis, jump
tilt), **VFX on/off**, **RECENTRE BOARD**, and the **"NEXT THEME (DEV)"**
tier-skip button — now lives in a separate dev tools panel, hidden until a
deliberate unlock gesture:

- **Hold** the wide invisible area around the lives tray (top-left, around the
  hearts) for **7 seconds**, then enter the code **2128** on the numeric pad that
  appears. A wrench button then appears bottom-left; tapping it opens/closes the
  panel.
- The unlock is **not persisted** — it re-locks on every reload, by design.
- **The default steering mode is always STEPPED** on a fresh install/reload —
  flag it as a bug if a clean load ever starts in absolute mode.
- Flag if the wrench button or panel is ever visible/reachable without going
  through the hold+code gesture first.

## Suggested QA focus areas

- **IP check**: confirm no Ninja Turtles imagery anywhere (character, enemies,
  curtains, UI, environment art).
- **Visual**: buildings/walls should have clean, tiled facade art with no visible
  seams, gaps, or stray white/background lines at corners or edges, in every one
  of the 6 environments.
- **Character animation**: run cycle and jump should look fluid, robot should
  always be shown from behind (never facing camera).
- **Collision/scoring**: obstacle hits cost exactly one life (not multiple per
  pass); pylon bump always awards points and disappears; coins always increment
  score.
- **Level transition**: curtain closes fully before the environment swap, no
  black-frame flash, music ducks and resumes correctly, tier/points/lives carry
  over correctly into the next level.
- **Finishing the game**: clearing Space City's threshold shows the victory
  screen (not another tier-up); CONTINUE (and only CONTINUE) leads to the
  leaderboard board; PLAY AGAIN from there starts a genuinely fresh run.
- **Leaderboard/quit flow**: see its own section above.
- **Settings persistence**: SENSITIVITY/SFX/MUSIC (player panel) and
  MODE/lane-zone/hysteresis/jump-tilt/VFX (dev panel) all survive a page reload.
- **Game over → restart**: score/lives/tier reset correctly on restart;
  sprite/shadow never gets stuck invisible after a death mid-blink.
- **Cross-device**: since this ships to a Unity WebView host (GoBalance app),
  test on the actual board/app build, not just browser — verify tilt steering,
  back button, and pause all work via the host bridge.
