# Analytics for web games — Phase A now, Phase B next

Web games currently report **nothing** to Google Analytics. Not a mission
cleared, not a race finished, not even that the game was opened.

This splits into two very different sizes of job, so it is written as two
phases. **Phase A is one line in your code, needs no bridge work and no
decisions, and fixes all five active web games at once.** Phase B is the real
telemetry and needs a contract plus two calls from you.

Phase A is worth doing on its own even if Phase B is never approved.

---

## Where things stand

Checked against the project rather than assumed — please correct anything that
has moved.

**The analytics layer itself is complete and good.** `AnalyticsEvents.cs` is a
catalogue of ~50 events, each with an inline comment saying when it fires and
what its value means. `AnalyticsManager.LogEvent` sends every event to two
sinks: `FirebaseAnalytics.LogEvent(name, parameters)` for Google Analytics, and
`MyFirebaseFirestore.AddLogEvent`, which mirrors it to
`users/{uid}/{eventLogsCol}` as `{ event_name, timestamp, profile, parameters }`.
Both sit behind `MyFirebaseManager.UseFirebaseAnalytics()`.

**Web games are wired into none of it.** No analytics calls exist anywhere in
`GoBalance/WebGames/Scripts/` — six files, ~1,800 lines, zero references.
Specifically:

- `open_game` is logged by `TemplateBtnScript`, which is the **scene** path: it
  logs, then calls `changeScene(scene)`. Web games are a WebView, so nothing
  routes through it.
- `GameLauncher.LaunchGame()`, the button that actually opens a web game from
  `WebGames/Scenes/GamesList.unity`, logs nothing.
- `start_game` / `game_end` are never called for a web game, and
  `GameSessionTimeTracker` measures via `OnSceneLoaded`, so a WebView living
  inside one scene never participates.
- Nothing outside the `WebGames` folder references `WebGameController`,
  `WebGameBridge`, or the `GoBalance.WebGames` namespace. The app's only
  mention of web games anywhere is `FirestoreStructureStrings.WebGameKey()`.

So this was never broken — the path was simply never built.

---

# PHASE A — "the game was opened"

## The change

One line in `GameLauncher.LaunchGame()`, immediately before the existing
`MasterManager.changeScene(entry.sceneName)`:

```csharp
AnalyticsManager.Instance.LogOpenGame(entry.sceneName);
MasterManager.changeScene(entry.sceneName);
```

That is the whole of Phase A. It mirrors `TemplateBtnScript` exactly — log,
then change scene — so a web game open becomes indistinguishable from a native
game open in the data.

## Why this is the whole job

- `open_game` **already exists** in the catalogue. No new event, no new entry.
- `LogOpenGame(string)` **already exists** and is public.
- `GameLauncher` is Unity-side, so nothing crosses the bridge. No JS, no RPC,
  no contract, nothing for us to implement.
- It goes through `AnalyticsManager`, so it inherits the Firestore mirror and
  the Pro-tablet kill switch automatically.

## Please use `entry.sceneName`, not `entry.displayName`

`sceneName` is the stable folder key (`HillBombSunsetRidge`). `displayName` is a
label someone will change — ours currently reads "Skate World" while the game
calls itself Skateboard Extreme on its own lobby. Keying analytics on a label
forks the data the day the label changes.

Worth knowing for whoever reads the reports: `LogOpenGame` puts the value in
GA's `screen_name` parameter, not in a parameter named after the event.

## What it answers

Today you cannot tell which of the five active web games anyone opens, or
whether they open at all. After Phase A, for every web game:

- how many opens, per day, per game
- which web games are picked over which native games, in the same query,
  because it is the same event
- whether a game that was just shipped is being found at all

That is the single most valuable question per line of code in this whole
document.

## What Phase A deliberately does NOT do

Being explicit so the data is not over-read:

- it fires when the **button is pressed**, not when the game finishes loading —
  so it counts intent, not successful launches
- it says nothing about what happened next: no session length, no result, no
  whether they played for ten seconds or ten minutes
- it cannot distinguish sub-profiles in GA (see the profile note in Phase B) —
  the Firestore mirror does record `profile`, so per-child questions are
  answerable there

## Verifying Phase A

1. one `open_game` in GA4 DebugView with `screen_name` = the scene name, from a
   real device
2. the same event in Firestore under `users/{uid}/{eventLogsCol}` with the right
   `profile`
3. nothing logged on the Pro tablet — confirming the kill switch covers it
4. native games' `open_game` unchanged

---

# PHASE B — what happens inside the game

Phase A stops at the door. Everything past it — missions, races, where players
get stuck — has to come from the page, which means the bridge.

## The ask: one new RPC method

`WebGameBridge.HandleMessage` already dispatches ten methods: `nav.back`,
`sensitivity.set`, `log`, `ready`, `profile.get`, `players.get`, `save.load`,
`save.set`, `score.submit`, `score.board`. We are asking for an eleventh.

There is a `log` method already, but it is `Debug.Log` only — a console for a
device with no devtools. We are not proposing to overload it: an analytics event
needs validating and forwarding, a log line does not.

### The contract

JS side, matching the existing SDK surface:

```js
GoBalance.logEvent(name, params?)   // fire and forget; resolves true/false
```

Over the wire, in the existing format (`gb:rpc:<id>:<method>:<payload>`):

```
gb:rpc:<id>:analytics.log:{"name":"mission_clear","params":{"mission":"crystal_run","stars":3}}
```

Unity side, in the same shape as the neighbouring cases:

```csharp
case "analytics.log":
    // validate, then hand to the existing sink
    AnalyticsManager.Instance.LogWebGameEvent(gameKey, name, params);
    break;
```

### Please route it through `AnalyticsManager`, not `FirebaseAnalytics`

The one implementation detail we would ask for specifically. Going through the
existing manager means a web game automatically gets:

- the **Firestore mirror**, which is the sink that matters for BI — per-user,
  per-profile, server-timestamped, queryable
- the **Pro-tablet kill switch**. `UseFirebaseAnalytics()` returns false there
  because Firebase would crash it. A web game reaching Firebase directly would
  sidestep that and take the tablet down.
- one place where the event vocabulary stays reviewable

`LogEvent` is private today, so this needs one new public method on the manager.
Everything below it is unchanged.

## Validation belongs at the bridge

A web page is the least trusted thing in the system, and GA silently drops
malformed events rather than erroring. Better to reject at the bridge than lose
data quietly. All cheap:

- **event name** `^[a-z][a-z0-9_]{0,39}$`, rejecting the reserved `firebase_`,
  `google_` and `ga_` prefixes
- **parameters**: at most 10 per event (GA4 allows 25). Names on the same
  pattern. Strings truncated at 100 characters. Numbers passed as numbers, or
  they cannot be summed in a report.
- **rate limit**, e.g. 30 events/minute per run, excess dropped with one
  warning — a per-frame bug should cost a warning, not a quota
- **prefix the name with the game at the bridge**, from the game folder, so a
  page cannot claim to be another game

Those limits are GA4's documented ones as we understand them and are worth
confirming your side; the shape matters more than the exact numbers.

## Two things we would like you to decide

Yours to call, and they change what we build.

### a. Per-game event names, or shared events with a game parameter?

The catalogue is per-game today — `color_tunnel_died`,
`snowboard_coin_pickup`. Following it, ours would be
`skateboard_mission_clear`.

The alternative is a small shared set with the game as a parameter:
`web_game_mission_clear` with `{game: "skateboard_extreme"}`. That keeps the
name count down (GA4 allows 500 distinct names per app) and makes
cross-game comparison one query instead of a union of five.

**We would prefer the shared form**, because the BI question is usually "which
game retains best" — one query that way, five the other. But the convention is
yours and we will follow whichever you pick.

### b. How should the sub-profile reach Google Analytics?

This matters more than it looks. A BoBo is shared by a family. The Firestore
mirror already records `profile` on every event; **GA does not get it** — GA
identifies by app instance, so in GA every child on one board is one user, and
"how many players cleared mission 5" is unanswerable there.

Options, in the order we would suggest:

1. set the profile id as a **GA user property** on profile switch — cleanest,
   done once, applies to every event including the native games', and closes
   the same blind spot they have today
2. send it as an event **parameter** — simple, but must be registered as a
   custom dimension in GA4 or it appears nowhere
3. leave GA device-level and answer per-profile questions from Firestore only

Either way, worth flagging: **event parameters do not appear in GA4 reports
until registered as custom dimensions.** If nobody registers them, events
arrive and their parameters are invisible, which looks exactly like a broken
integration.

## The events we would send

A proposal, not a fixed list — cut anything you consider noise.

**Lifecycle.** Phase A covers `open_game`. These two complete it:

| event | when | parameters |
|---|---|---|
| `start_game` | the run actually begins, after the briefing | game, mode (`missions`/`race`) |
| `game_end` | the player leaves the game | game, session_seconds |

`game_end` also closes the gap that `GameSessionTimeTracker` cannot cover for a
WebView, since we know our own session boundaries.

**Missions**

| event | when | parameters |
|---|---|---|
| `mission_start` | a mission run begins | mission, mission_number |
| `mission_clear` | objectives met | mission, stars, score, seconds_left |
| `mission_fail` | the clock runs out unmet | mission, objectives_done, objectives_total |
| `mission_quit` | the player leaves mid-run | mission, banked |

**Race**

| event | when | parameters |
|---|---|---|
| `race_finish` | the line is crossed | track, place, score |
| `race_dnf` | the time cap is hit first | track, metres_short |

**Difficulty signal** — the reason we want this at all. These tell us where a
ladder is mis-tuned instead of us guessing from playtests:

| event | when | parameters |
|---|---|---|
| `mission_retry` | the same mission started again after a fail | mission, attempt |
| `settings_changed_sensitivity` | on leaving settings, if changed | value |

That last one deliberately reuses the app's existing event name and its
"check at exit, not on every step" rule, so a sensitivity story reads the same
whether the change happened in the app or in one of our games.

**Volume**: a typical 10-minute session is roughly 15 events — 1 open, 1 start,
6–10 mission events, 1 end.

## What we do on our side

- call `GoBalance.logEvent` at the moments above; all of them already exist as
  points in our code, since the game already tracks missions, stars, places and
  session boundaries
- keep it behind a feature check, so the game runs unchanged at a plain dev URL
  and on any host without the method — exactly as our save and score paths
  already do
- ids and numbers only: no free text, nothing identifying, all from our own
  content
- nothing per-frame; every event above is a discrete moment

## Verifying Phase B

1. one event in GA4 DebugView from a real device
2. the same event in Firestore with the right `profile`
3. an invalid name and an oversized payload both rejected at the bridge, with a
   warning and no crash
4. nothing logged on the Pro tablet
5. native games' events unchanged

---

## Not asking for

Stated so it is not read into the above:

- no new Firestore collection, document shape, or index
- no change to existing native events, or to `AnalyticsEvents.cs` beyond adding
  entries
- no bypass of `UseFirebaseAnalytics()` — the Pro-tablet guard should cover
  these paths too
- no user-level identity, no free text from the page, nothing that is not an id
  or a number we generate

---

## PS — one unrelated thing we noticed

In `WebGames/Scenes/GamesList.unity` our entry is labelled **"Skate World"**
(scene `HillBombSunsetRidge`). The game is now called **Skateboard Extreme** and
says so on its own lobby, so the launcher and the game disagree. That scene is
yours, so we have not touched it.
