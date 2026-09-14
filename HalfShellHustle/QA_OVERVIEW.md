# Half Shell Hustle — Scrap-Bot Skin — QA Overview

## What the game is

A 3-lane endless runner controlled via balance-board tilt (GoBalance hardware) or
keyboard in browser. The player character is **"Scrap-Bot,"** a small salvage robot
with magnet hands who runs down an endless lane, switching between 3 lanes and
jumping to dodge obstacles, collect coins, and bump into a tall standing "energy
pylon" prop for bonus points. This is a **reskinned build** — same engine/mechanics
as the existing TMNT (Half Shell Hustle) game, but with all character art, enemy
art, and curtain/UI art replaced. **There should be zero Ninja Turtles content
anywhere in this build** — no turtle character, no shell/mask imagery, no
turtle-shell patterns. Flagging any that slips through is a top-priority QA item.

## Core loop

- Player auto-runs forward; lean left/right (or arrow keys) to change lanes, lean
  forward/back (or up/down) to jump.
- Coins and a rarer "bonus" coin type add points continuously.
- A tall glowing "energy pylon" (4 color variants) stands in the lane — bumping
  into it removes it, awards a bonus, and triggers a small particle burst.
- Barricade obstacles must be dodged or jumped; hitting one costs a life (3 lives
  total, some pickups can restore one).
- Points accumulate toward tier thresholds (300 / 800 / 1500, then +1000 each tier
  after). Reaching a threshold ends the current level, plays a level-complete
  screen + curtain transition, and starts the next level in a **new environment**,
  with points/tier/lives/speed carrying over.

## Environments (tiers, in final order)

1. **Big Warehouses — Under Roof** (indoor variant — visible steel roof
   trusses/skylights overhead, muted colorful box-pile walls)
2. **Big Warehouses** (outdoor variant — same warehouse district, open sky,
   corrugated-panel walls with crate stacks)
3. **Harbor Docks**
4. **Sunny Street**
5. **Funky Forest** (bright/vivid non-naturalistic forest — glowing mushrooms,
   tall wood-cabin-style buildings, NOT tree-trunk shaped — should read as a
   forest but built from normal box-shaped buildings)

After the last tier, the rotation loops back to tier 1 with escalating point
thresholds — this is intentional, not a bug.

## Audio & settings

- SFX: jump, coin collect, enemy/pylon-bump collect, hit/damage, game over, level
  complete, UI tap.
- One looping background music track.
- Settings panel (gear icon, top-right chrome row) has independent **SFX on/off**,
  **Music on/off**, and **VFX on/off** toggles, plus steering-mode/sensitivity
  tuning. All persist across reloads (localStorage).
- Music should duck/stop during the level-complete transition and resume when the
  next level starts. Pausing the game should also pause the music, and resume it
  on unpause (except mid-transition).

## Dev-only tool (not for release)

The settings panel also has a **"NEXT THEME (DEV)"** button that force-skips to
the next tier/environment immediately, using the real transition (not a
shortcut) — this exists purely to speed up QA/theme review and is expected to
remain, but flag if it's ever visible in a way that looks like a real player
feature.

## Suggested QA focus areas

- **IP check**: confirm no Ninja Turtles imagery anywhere (character, enemies,
  curtains, UI, environment art).
- **Visual**: buildings/walls should have clean, tiled facade art with no visible
  seams, gaps, or stray white/background lines at corners or edges, in every one
  of the 5 environments.
- **Character animation**: run cycle and jump should look fluid, robot should
  always be shown from behind (never facing camera).
- **Collision/scoring**: obstacle hits cost exactly one life (not multiple per
  pass); pylon bump always awards points and disappears; coins always increment
  score.
- **Level transition**: curtain closes fully before the environment swap, no
  black-frame flash, music ducks and resumes correctly, tier/points/lives carry
  over correctly into the next level.
- **Settings persistence**: SFX/Music/VFX toggles and steering settings survive a
  page reload.
- **Game over → restart**: score/lives/tier reset correctly on restart;
  sprite/shadow never gets stuck invisible after a death mid-blink.
- **Cross-device**: since this ships to a Unity WebView host (GoBalance app),
  test on the actual board/app build, not just browser — verify tilt steering,
  back button, and pause all work via the host bridge.
