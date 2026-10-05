# Web game analytics — what it sends, where it lands, how to test it

Covers all five web games: **Skateboard Extreme** (HillBombSunsetRidge), **Nova
Vanguard**, **Rooftop Ninja** (TmntSkateSlice), **RoboRun** (HalfShellHustle) and
**Bloop Squad**.

Every event name, parameter and value in this document was read out of the code
and confirmed against live events in Firestore, not written from memory.

---

## 1. The pipeline — where an event actually goes

    game JS                    src/systems/analytics.js
       |                       builds the event
       v
    SDK bridge                 src/systems/gbSdk.js
       |                       window.GoBalance.logEvent(name, params)
       v
    Unity (WebGameController)  receives it over the WebView bridge
       |
       +---> Firebase Analytics (GA4)        <- the reporting product
       +---> Firestore users/{uid}/event_log <- the mirror we can read directly

**Two destinations, and they behave differently.** GA4 is the product for
reporting but applies custom dimensions only from the moment they are registered
— it is *not* retroactive. Firestore is a raw mirror, queryable immediately, and
is what the local dashboard reads.

**Event names gain a `web_` prefix on the way out.** The game sends `level_start`;
Firestore stores `web_level_start`. Search for the prefixed form.

### Mobile only

Firebase Analytics is active on device builds. On desktop/Editor it is a stub for
GA4 — **but the Firestore mirror still writes**, which is why Editor testing is
useful and why events from an Editor session do appear in the dashboard.

---

## 2. The event vocabulary

Six events, identical across all five games. This is deliberate: one shared
vocabulary means a single report works for every game, and a stranger reading it
does not need to know what a hill bomb is.

| event | fires when | key parameters |
|---|---|---|
| `start_game` | a run begins | `mode` |
| `level_start` | a level begins, **including on retry** | `level_id`, `level_number`, `attempt`, `mode` |
| `level_end` | that level ended, however it ended | `result`, `score`, `stars`, `progress_pct`, `duration_seconds`, + the `level_start` set |
| `settings_changed` | a setting was changed | `setting`, `setting_value` |
| `game_end` | player left the game for the app | `duration_seconds`, `runs` |
| `heartbeat` | **every 30 seconds while playing** | `duration_seconds`, `level_id` (when in a level) |

### `result` — how a level ended

| value | meaning |
|---|---|
| `clear` | the ask was met |
| `fail` | the game ended the run (clock ran out, objectives unmet) |
| `quit` | the **player** ended it |
| `dnf` | race-shaped fail — the clock beat them to the line |

`quit` and `fail` are deliberately separate. **A level with a high quit rate and a
low fail rate is boring, not hard.** Collapsing them loses that distinction.
`dnf` is separate because "did not finish" and "finished last" are not the same
result.

### Parameters worth understanding

- **`attempt`** — increments per `level_id` within a session. Lets a report
  answer "how many tries before this level clears" across the whole catalogue.
- **`progress_pct`** — how far they got. On a `fail` or `quit` this is the useful
  number; on a `clear` it is always 100.
- **`duration_seconds`** on `level_end` — time **spent**, not time left.
- **`stars`** — 0 on anything that is not a clear.

---

## 3. Per-game mapping — what `level_id` and `mode` mean

Confirmed against live events:

| game | `mode` | `level_id` | what a "level" is |
|---|---|---|---|
| Skateboard Extreme | `missions`, `speedRace` | `sundown`, `raceDrops`, … | the mission or race id |
| Nova Vanguard | `campaign` | `ashfall`, … | the surface |
| Rooftop Ninja | `arcade` | `rooftop`, … | stage, derived from score band |
| RoboRun | `arcade` | `tier_1`, `tier_2`, … | difficulty tier |
| Bloop Squad | `party` | `level_1`, `level_2`, … | the XP-bar level |

Each game maps its own structure onto the shared vocabulary. The ids are stable
strings, safe to group by in a report.

---

## 4. THE HEARTBEAT — read this before interpreting any duration

### Why it exists

**People kill the app without closing the game.** There is no reliable exit
event: `game_end` fires only on a clean exit through the app, and a force-quit,
a crash or a flat battery produces nothing at all. A session measured only by its
end event would silently lose every run that ended the common way.

So every 30 seconds a `heartbeat` carries the session's play time so far.

### The rule, and the mistake it prevents

> **Time played = `duration_seconds` on the LAST event received for that session.
> NEVER a sum.**

Every heartbeat carries the session's **running total**, not an increment:

    heartbeat  duration_seconds=30
    heartbeat  duration_seconds=60
    heartbeat  duration_seconds=90     <- the session is 90s, not 180s

Summing them produces a number several times too large, and it looks plausible,
which is why it goes unquestioned. Take the maximum, or the last.

### Known wart

A heartbeat landing **between** two levels carries no `level_id`, because the
player is not in a level at that moment. Semantically correct; it means that one
heartbeat cannot be attributed to a level. Does not affect levels-reached or
time-played.

---

## 5. QA — what to test and how to confirm it

### Where to look

**Local dashboard** (reads Firestore directly, fastest feedback):

    node tools/analytics-dashboard/server.mjs      ->  http://localhost:7788

Scoped to one `uid` by default. Override with `UID=... node …`. It is scoped
rather than global because a collection-group query would need a Firestore index.

**GA4 DebugView** — for confirming the GA4 half specifically. Requires a device
build; the Editor does not feed GA4.

### Test checklist

| # | test | pass looks like |
|---|---|---|
| 1 | Launch a game | `start_game` with the right `mode` |
| 2 | Start a level | `level_start`, correct `level_id`, `attempt=1` |
| 3 | **Retry the same level** | a second `level_start`, **`attempt=2`** |
| 4 | Complete a level | `level_end` `result=clear`, `progress_pct=100`, `stars`>0, sane `duration_seconds` |
| 5 | Fail a level | `level_end` `result=fail`, `stars=0`, `progress_pct`<100 |
| 6 | **Quit mid-level** | `result=quit` — **not** `fail` |
| 7 | Play > 30 s | `heartbeat` every 30 s, `duration_seconds` climbing in 30s steps |
| 8 | Play through 2+ levels | `level_end` then `level_start` with the **next** `level_id` |
| 9 | Change a setting | `settings_changed` with `setting` + `setting_value` |
| 10 | Exit cleanly to the app | `game_end` with total `duration_seconds` and `runs` |
| 11 | **Force-quit the app mid-run** | no `game_end` — but the last `heartbeat` holds the correct time |

Test 11 is the one that matters most and is easiest to skip. It is the reason the
heartbeat exists.

### What "correct" looks like — a real captured session

    05:59:44  start_game
    05:59:44  level_start  level_1
    06:00:10  level_end    level_1   26s  clear
    06:00:10  level_start  level_2
    06:00:44  heartbeat    level_2   60s
    06:00:45  level_end    level_2   35s  clear
    06:00:45  level_start  level_3
    06:00:52  game_end              68s

Levels advance, each `level_end` carries a duration and a result, `game_end`
carries the session total.

### Traps that produce a false failure

- **Too short a sample.** A game that has not reached its second level yet looks
  identical to one whose level mapping is broken. Play long enough to progress.
- **Guest profiles.** Saves and scores are skipped entirely for guest profiles —
  nothing is written, so "missing" is expected rather than a bug.
- **Editor vs device.** The Editor writes to Firestore but not GA4, and bypasses
  the Android extraction path entirely.

---

## 6. Scores are a different system — do not confuse them

Analytics events and the leaderboard are **two separate paths**. A game can
report a score through analytics and still never put it on a leaderboard.

**Score document** (written by Unity, not by the web game):

    users/{uid}/{prefix}_user_profiles/{upid}/profile_saved_data/{gameKey}

- `{prefix}` is build-dependent: `pro` | `home` | `kids` | `na`. **Read it from
  the database rather than assuming.**
- `{gameKey}` is `web_` + the **shipped folder name**, snake-cased:
  `RoboRun` → `web_robo_run`, `BloopSquad` → `web_bloop_squad`.
- Fields: `Score` (array of runs, capped at 100), `WebState` (save blob),
  `WebStateRev` (revision).

**The leaderboard is a family board** — it flattens every profile under the same
`uid`. There is no cross-account board.

### Known gap

**Skateboard Extreme never calls `submitScore`.** Confirmed across six profiles,
52 save revisions and a live run: it reports `score` through analytics and saves
`WebState` fine, but no `Score` array has ever been written. The other four games
all have leaderboard entries.

This is a **design question, not a bug**: the other games produce one number per
run, while the skateboard produces a score per mission across 40 missions plus
race placements, and the save document holds only one `Score` array per game.
A scheme has to be chosen (career total, total stars, or best single) before it
can be wired.

---

## 7. For developers and agents picking this up

- **One shared vocabulary, one file per game:** `src/systems/analytics.js`. Do not
  invent per-game event names — a report that works for one game should work for
  all five.
- **`src/systems/gbSdk.js` must EXTEND the host's `window.GoBalance`, not replace
  it.** The WebView injects its own SDK. An earlier version bailed out when it
  found one, and events went nowhere with no error anywhere. That failure is
  silent by construction — always confirm events arrive, never assume.
- **Branch from `all-games`.** See `CLAUDE.md` in the repo root.
- **Verifying a shipped bundle:** grep for strings that survive minification
  (event names, DOM ids), not numeric constants — minifiers rewrite `20000` as
  `2e4`.

---

## 8. Adding this to a new game (including one in another repo)

The system is two files and a handful of call sites. Nothing is specific to any
game except the `level_id` mapping, which is the one real decision.

### Step 1 — copy two files

    src/systems/gbSdk.js       the bridge. Copy VERBATIM, do not adapt.
    src/systems/analytics.js   the vocabulary. Copy, then change only the
                               per-game mapping described in step 4.

`gbSdk.js` is identical in all five games on purpose. If a sixth copy diverges,
the thing that breaks is silent.

### Step 2 — install the bridge at boot

    import { installGbSdk } from './systems/gbSdk.js';
    import { analytics } from './systems/analytics.js';

    installGbSdk();        // before anything that might report

**Importing is not enough — it must be CALLED.** Two games shipped with the
import present and the call missing, and reported nothing at all. Nothing errors;
the events simply never leave.

### Step 3 — wire the call sites

The API, in the order a run uses it:

| call | when |
|---|---|
| `analytics.runStarted(mode)` | a run begins. `mode` is the shape of play (`arcade`, `campaign`, `missions`…) |
| `analytics.levelStarted(id, number)` | a level begins — **also on retry**, the attempt counter is internal |
| `analytics.levelCleared(id, stars, score, durationSeconds)` | the ask was met |
| `analytics.levelFailed(id, done, total, score, durationSeconds)` | the game ended it |
| `analytics.levelQuit(id, done, total, score, durationSeconds)` | the **player** ended it |
| `analytics.raceFinished(id, place, score, durationSeconds)` | race-shaped: finished, with a placing |
| `analytics.raceDnf(id, metresCovered, courseLength, score, durationSeconds)` | race-shaped: clock beat them to the line |
| `analytics.settingChanged(setting, value)` | a setting changed |
| `analytics.gameLeft()` | leaving the game for the app |

The heartbeat needs no wiring — `runStarted` starts it, `gameLeft` stops it.

A game with no levels still calls `levelStarted`/`level*` once per run: the run
**is** the level. A game with no races never touches the two race calls.

### Step 4 — decide the `level_id` mapping

**This is the only real design work, and it is worth five minutes.** `level_id`
is what every drop-off report groups by, so it has to mean "the part of the game
they were in" in a way that stays stable across builds.

How the existing five chose:

| game | shape | mapping |
|---|---|---|
| Skateboard Extreme | authored levels | the mission/race id |
| Nova Vanguard | authored surfaces | the surface name |
| Bloop Squad | XP-bar progression | `level_1`, `level_2`, … |
| RoboRun | continuous difficulty | `tier_1`, `tier_2`, … bucketed from progress |
| Rooftop Ninja | endless | `rooftop`, … a stage derived from score band |

Rules that matter:

- **Stable strings, not indices into a list that may be reordered.**
- **Bucket a continuous axis** — an endless runner should not emit a distinct
  `level_id` per metre. RoboRun buckets difficulty into tiers; Ninja buckets
  score into stages.
- **Pick a bucket count you can read.** Three to eight is useful; forty is a
  table nobody looks at, one is a report that says nothing.

### Step 5 — verify before trusting it

Run section 5's checklist. The two that catch real mistakes:

1. **Play past the first level**, then confirm a second `level_start` with a
   *different* `level_id`. A mapping that never advances looks identical to a
   correct one if you only watch the first 30 seconds.
2. **Force-quit mid-run** and confirm the last heartbeat holds the right time.

### If the game is in a different repo

Nothing above depends on this repo. The two files have no imports beyond each
other, and the bridge talks to whatever `window.GoBalance` the host injects.

What does **not** travel, and must be set up on the host side instead:

- the local dashboard (`tools/analytics-dashboard/`) — reads Firestore, usable
  from anywhere, just point it at the same project
- GA4 custom dimensions — registered per Firebase project, not per game. A new
  game sending the same vocabulary needs no new registration; a new **parameter**
  does, and is not retroactive.
