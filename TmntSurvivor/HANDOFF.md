# TMNT Survivor — session handoff, 2026-11-04

Written before Elad restarted the terminal. This file is the state of the
"sewer-swarm" session. It is NOT meant to be committed — delete it once the
work it describes has landed.

## 1. Where to start

```
cd /Users/eladayzen/UnityProjects/WebViewGames/.claude/worktrees/sewer-swarm/TmntSurvivor
```

Repo: `WebViewGames`. Branch: **`claude/sewer-swarm`** (own worktree — do not
work on this branch from the main checkout, other sessions share that HEAD).
Worktree HEAD: `828304e` "TMNT Survivor: twelve hearts, and hearts that drop".

## 2. What this session was doing

Ticket **BAL-632** (TMNT Survivor). A run of gameplay/feel/art requests from
Elad, all on the Vampire-Survivors-style TMNT game: pause button, katana
replacing the nunchaku (duration + cooldown), ability-selection screen art,
pickup art, walk-cycle fix, then the two most recent asks —
**double HP with the bar over the player's head + 30% more heart drops**, and
**slow the whole game down** because the lean input is hard to control.

## 3. State

**Committed:** nothing since `828304e`. Everything below is **uncommitted**
in this worktree. Elad has not asked for a commit, and the standing rule is
never to commit unprompted.

**Done and verified (84 tests pass, 0 fail, `npm run build` succeeds):**

| Area | Files |
|---|---|
| HP pool 7 → **14** | `src/systems/survival.js` |
| Heart drop +30% → `0.0273` | `src/systems/horde.js` |
| World-space HP bar over the player's head (replaced the corner pips) | `src/main.js`, `index.html`, `src/style.css`, `src/ui/hud.js` |
| Global pace scale, default **0.7** | `src/core/pace.js` (new), `input.js`, `horde.js`, `combat.js` |
| Shot lifetime bound (`SHOT.maxAliveS`) | `src/systems/horde.js` |
| New tests | `test/pace.test.mjs` (7), plus `test/katana.test.mjs` wired into `package.json` — **it had never run before** |

Also untracked and part of this work: `src/core/pace.js`, `src/systems/ground.js`,
`src/systems/sprites.js`, `src/ui/`, `assets/`, `reference/`, and the test files
`facing/ground/katana/pace/shooter/walk.test.mjs`.

**Dev hooks for testing:** `?hp=N` starting lives, `?pace=N` global speed,
`?spd= ?espd= ?lives= ?hdrop= ?sfire=`.

## 4. Next steps, in order

1. **Get Elad's verdict on `?pace=0.7` on a real board.** It is explicitly a
   starting point. `?pace=0.6` and `?pace=0.85` are one reload apart.
2. **Same session: does the air feel too busy with enemy shots?** Peak live
   shots went 15 (pace 1.0) → 48 (pace 0.7) → 34 (with the time bound). It is
   not back to 15 and will not be — slower enemies spend longer inside every
   fixed radius, so more of them are in firing range at once. `?sfire=5.5`
   lengthens the shooter cooldown if he wants it thinner.
3. Only then commit (ask first) and land.
4. Remaining BAL-632 items, untouched: the vertical-axis board test, confirming
   the shipped folder name `TmntSurvivor`, two-player camera/wall, enemy aggro.

## 5. Gotchas

- **Port 5210 is `python3 -m http.server --directory dist`, not vite.** Every
  visual check needs `npm run build` first or you are looking at the old build.
  A HalfShellHustle vite also binds 5210 on IPv6; the python one wins on IPv4.
- **The game cannot be observed through the claude-in-chrome MCP tab.** That tab
  group is `visibilityState: "hidden"`, so `requestAnimationFrame` never fires
  and the clock sits at 0:00 forever. Screenshots of static state work; motion
  does not. Measure in Node instead.
- **Seed any simulation.** An unseeded A/B of the pace change reported 31 vs 20
  peak shots for the *same* configuration — pure spawn RNG. Use
  `mulberry32` and assign `Math.random = rng`.
- **`SURVIVAL.maxLives` and `HEART.dropChance` are ONE decision.** `test/shooter.test.mjs`
  pins the pair and is deliberately written to go red when either is tuned alone.
  Change both or change neither.
- **Pace is applied exactly once.** `SHOT.speedPxS` is derived from
  `ENEMY.speedPxS`, which is already paced — do not wrap it in `paced()` again.
  Distances are never paced; only px/sec.
- **Unresolved:** a garbled dictated sentence from Elad, never clarified —
  *"just bring me a contact. So, it comes back maybe he wouldn't have done
  anything, no one would repeat what happened."* Ask him what it meant.

## 6. Not this session's work, but open and worth knowing

- **RoboRun coin art is a possible IP blocker.** `coin_common` and `coin_bonus`
  carry a turtle-shell hex rosette; the RoboRun QA brief calls any Turtles
  content a release blocker. Verified in the live source at `d214bbf`. Reported
  to Elad, **deliberately not fixed** — it is new art plus his call. The
  characters are clean (`leo_*` / `foot_soldier_*` are legacy filenames only).
- Four Bloop Squad / Nova Vanguard drops are committed in the gobalance tree and
  wait on Elad to call a CI build.

---

## Update, 8 Nov 2026 — the prototype has been landed

Elad asked for the prototype to be deployed. Done, agent half only:

`~/UnityProjects/gobalance/Assets/StreamingAssets/TmntSurvivor/` — new,
untracked, **not committed**. 30 files / 1.2 MB (index.html, 11 js, 1 css,
17 webp). The app repo is on branch `8.2.90`.

Verified: manifest 30 lines == 30 content files, doesn't list itself, no `.meta`
entries, every path resolves; zero orphaned `.meta`; `__pumpFrames`,
`#gameover-overlay`, `#restart-button` all survived the build; `.webp` is in
`MimeFor()`. 84 tests pass, vite build clean.

**Still needed — the project owner's four edits (NEW game, not a refresh):**

| | |
|---|---|
| `folderName` | `TmntSurvivor` — exact, no trailing space; it is also the save key |
| `displayName` | TMNT Survivor |
| `forwardSteeringKeys` | **0** — the game reads `window.__gbSensor`. Left at the default 1, the player steers about twice as fast as they lean. Copy AstroTunnel or TmntSkateSlice, not a 1/1 scene. |
| `forwardVerticalAxis` | irrelevant — both axes come from `__gbSensor.x/.y`, not Arrow keys. Keyboard is the browser fallback only. |

Plus `EditorBuildSettings.asset` and a `GameEntry` in `GamesList.unity`.

**Could not hand this to Remote config:** no session was running in
`~/UnityProjects/gobalance` at the time (checked by process cwd, not assumed),
and no peer answers to that name after the restart. The registration brief is
in Elad's hands instead.

## Update, 8 Nov — board y was inverted, fixed, re-dropped

Elad on the real board: "up is down and down is up." The board reports
lean-forward as POSITIVE y; screen space points positive y DOWN, and the game
passed the raw value through.

Nova Vanguard already found and documented this (`NovaVanguard/src/data/tuning.js`,
"BOARD AXIS SIGNS"). `GOBALANCE_SDK.md` publishes `__gbSensor = {x, y}` without
stating a sign convention for y, so every game that uses the axis rediscovers it.

Fix: `TUNING.sensorXSign: 1` / `sensorYSign: -1` in `src/systems/input.js`,
applied in `signed()` on the sensor read only — both the `__gbSensor` path and
the `__gbPlayers` seat-0 path. NOT a negation on the movement, which would also
invert the desktop keyboard where ArrowDown is already correct.

`test/axes.test.mjs` (6 tests, wired into `package.json`) pins the direction on
both input paths and asserts the keyboard is untouched. Two tests in
`test/movement.test.mjs` had quietly encoded the raw passthrough and were
corrected. **90 pass, 0 fail.**

Re-dropped to `StreamingAssets/TmntSurvivor/`; bundle `index-C6OWQThd.js` ->
`index-CvQBvRQh.js`. Needs a Unity re-import (all `assets/` filenames changed),
no scene change. Registration is done — see the gobalance session's work on
branch `8.2.90`. **Thumbnail is the only remaining gap, waiting on Elad.**
