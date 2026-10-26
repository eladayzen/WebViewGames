# RoboRun — QA Brief

**Build:** `StreamingAssets/RoboRun/` · **Source:** `WebViewGames/HalfShellHustle/` (branch `all-games`)
**Platform:** web game inside the GoBalance Unity app (WebView). Also runs in a plain browser for testing.

---

## What the game is

A 3-lane endless runner played by leaning on the GoBalance balance board. You are **Scrap-Bot**, a
small salvage robot with magnet hands, auto-running away from camera down a lane. Lean left/right
to change lane, lean forward/back to jump. Collect coins, dodge obstacles, clear six environments.

A run lasts roughly 3–5 minutes if the player survives to the end.

> **IP check — top priority.** This is a reskin of a Teenage Mutant Ninja Turtles game. There must
> be **zero** Turtles content anywhere: no turtle character, no shells, masks or shell patterns, in
> gameplay, UI, curtains or environment art. Anything that slipped through is a release blocker.

---

## Controls

| Action | Board | Keyboard (browser testing) |
|---|---|---|
| Change lane | Lean left / right | Arrow Left / Right |
| Jump | Lean forward / back | Arrow Up / Down |
| Menus | — | **Enter** = next row, **Space** = activate |

Inside the Unity app only **Space** and **Enter** reach the game, and there is no mouse pointer —
so every menu must be fully operable with those two keys. Test that, not just mouse clicks.

---

## Core loop

- Coins add points continuously; a rarer bonus coin is worth more.
- A tall glowing **energy pylon** stands in a lane — hitting it removes it, awards a bonus and
  bursts particles.
- **Barricades** must be dodged or jumped. Hitting one costs a life.
- **5 lives**, capped at 5. A rare pickup restores one.
- Points accumulate toward tier thresholds. Reaching one ends the level, plays a level-complete
  screen and curtain transition, then starts the next environment with **points, tier, lives and
  speed carried over**.

## Environments and thresholds

Points are lifetime totals, not per level.

| # | Environment | Clear at |
|---|---|---|
| 1 | Warehouse Roof (indoor) | 300 |
| 2 | Big Warehouses (outdoor) | 800 |
| 3 | Central City | 1500 |
| 4 | Harbor Docks | 2500 |
| 5 | Funky Forest | 3500 |
| 6 | Space City | **4500 — ends the run** |

Clearing Space City's 4500 **ends the run in victory**, it does not start a tier 7. An
**"ALL TIERS CLEARED!"** screen appears with confetti and the final score. It has **no timer and no
Space/Enter shortcut** — CONTINUE is the only way off it, deliberately, so a stray tap can't skip
an earned screen.

## How a run ends

All three endings bank the score and show a leaderboard:

- **Death** — game-over overlay with RETRY.
- **Quit mid-run** — the X (top right) pauses and asks to confirm ("Your score will still be
  counted"). KEEP PLAYING resumes exactly as it was; QUIT ends and submits the run.
- **Clearing Space City** — the victory screen above, then the same board.

> **Not a bug:** the leaderboard is **family-account scoped, not global**, and does nothing outside
> the Unity app. In a plain browser the section stays hidden. Don't file that.

---

## Settings panel (gear, top right)

Player-facing rows, in order:

1. **SENSITIVITY** — how far you must lean before the game reads a lane change.
2. **SFX** on/off
3. **MUSIC** on/off
4. **CALIBRATE BOARD** — opens the calibration wizard (below)
5. **MAX TILT ANGLE** — the measured value, adjustable by hand, 5°–45°
6. **CLOSE**

Opening Settings **pauses the game**, like the pause button, and restores the previous state on
close. All settings survive a reload.

### Calibration wizard — new, and the main thing to exercise

Measures how far the player can actually lean, and sets the board's tilt scale to match. Flow:

1. "Stand on the board, get comfortable."
2. **LEAN RIGHT** — amber pulsing ring, *"Keep going — all the way to your limit."* Nothing is
   being measured yet.
3. When the lean **stops growing**, it switches to a purple ring, *"Got it — hold it there…"* and a
   progress bar fills over ~1 second. **This is the measuring phase.**
4. Same for **LEAN LEFT**.
5. **"THAT'S YOUR RANGE"** — shows the angle it set.

Things to check:

- The two phases must be visually distinct — amber/"keep going" while moving, purple/"hold it"
  while recording. The player should never be told it's measuring while they're still travelling.
- **The result should not depend on how fast you lean.** Lean quickly in one run, slowly in the
  next; the measured angle should come out about the same. This was a real bug and is the main fix
  under test.
- Drifting back out mid-hold must **restart** the hold and empty the bar.
- Pausing halfway and then pushing further must measure the **final** position, not the pause.
- Afterwards, reopen Settings: **MAX TILT ANGLE shows the value just measured.**
- Press MAX TILT ANGLE within 15 seconds of calibrating and it **warns first** — *"You just
  calibrated — press again to change anyway."* A second press within ~4 seconds applies it.
- The highlighted footprint on the board illustration must match the side being asked for.

> **Not a bug:** with no board connected (plain browser, or Editor without hardware), the wizard
> waits 20 seconds per side and then says **"Couldn't measure that — nothing was changed."** That
> is the intended guard against writing a junk angle. The angle is **device-wide** — it affects
> every GoBalance game, not just this one — which is why it refuses to guess.

---

## Analytics

The build reports: `start_game`, `level_start`, `level_end`, `settings_changed`, `game_end`, and a
`heartbeat` every 30 seconds. Level events fire **per tier**.

> For anyone reading the data: **time played is `duration_seconds` on the LAST event received,
> never a sum.** Every heartbeat carries the session's running total, so adding them counts the
> same minutes repeatedly. A heartbeat landing between two tiers carries no tier id — expected.

---

## Dev tools — must not be reachable by accident

Steering MODE, lane-zone/hysteresis/jump-tilt knobs, VFX, RECENTRE BOARD and a tier-skip button
live in a hidden dev panel. To open: **hold** the area around the hearts (top left) for **7
seconds**, then enter **2128**. A wrench button appears bottom-left.

- The unlock does **not** persist — it re-locks on every reload, by design.
- A fresh load must always start in **STEPPED** steering mode. Starting in absolute mode is a bug.
- **Flag it if the wrench or dev panel is ever reachable without the hold-and-code gesture.**

---

## Suggested QA focus

1. **IP check** — no Turtles content anywhere.
2. **Calibration** — the speed-independence check above is the headline item.
3. **Keyboard-only menus** — every row reachable with Enter/Space in the app, where there's no pointer.
4. **Visual** — facade art tiles cleanly in all six environments, no seams or stray white lines.
5. **Level transition** — curtain fully closes before the swap, no black flash, music ducks and
   resumes, points/tier/lives/speed carry over.
6. **Victory** — clearing 4500 shows the victory screen, not a tier 7; only CONTINUE leaves it.
7. **Collision/scoring** — a barricade costs exactly one life per pass; pylons always score and
   vanish.
8. **Restart** — score, lives and tier reset; the robot never stays invisible after dying mid-blink.
9. **On real hardware** — tilt steering, pause, and the app's back button all work through the host
   bridge. Browser testing does not cover these.
