Hi — web games currently report nothing to Google Analytics. Not a mission
cleared, not a race finished, not even that the game was opened. The analytics
layer itself is fine; the web-game path was just never wired into it (no
analytics calls anywhere in `GoBalance/WebGames/Scripts/`). Attached doc has the
detail. Two phases, very different sizes.

**Phase A — one line, and I'd suggest doing it regardless.**
In `GameLauncher.LaunchGame()`, before the existing `changeScene`:

    AnalyticsManager.Instance.LogOpenGame(entry.sceneName);

That's it. `open_game` and `LogOpenGame()` both already exist, it's Unity-side
so nothing touches the bridge, and it goes through `AnalyticsManager` so it
inherits the Firestore mirror and the Pro-tablet guard. It fixes **all five
active web games at once** — right now you can't tell which web games anyone
opens, or whether they open at all.

Please use `entry.sceneName`, not `displayName` — the label will change (ours
still says "Skate World") and keying analytics on a label forks the data.

**Phase B — one new bridge method, for what happens inside the game.**
An eleventh RPC alongside `save.set` / `score.submit`:

    GoBalance.logEvent(name, params?)

Routed through `AnalyticsManager` rather than `FirebaseAnalytics` directly, so
web games can't sidestep the Pro-tablet kill switch, with validation at the
bridge (name pattern, param cap, rate limit). That gets us mission
start/clear/fail/quit, race finish/place, and retry counts — the last being what
tells us where a level is mis-tuned instead of guessing from playtests.

**Two decisions we'd like from you:**
1. Per-game event names (`skateboard_mission_clear`) or shared events with a
   game parameter (`web_game_mission_clear` + `{game: ...}`)? We'd prefer
   shared — "which game retains best" is then one query instead of five — but
   the convention is yours.
2. How should the sub-profile reach GA? Firestore already records `profile`,
   but GA identifies by app instance, so on a shared family board every child
   is one GA user and "how many players cleared mission 5" can't be answered
   there. Cleanest fix is a GA user property on profile switch — that would
   close the same gap for the native games too.

**One thing worth flagging:** GA4 won't show event parameters in reports until
they're registered as custom dimensions. If that step is missed, the events
arrive and the parameters are invisible, which looks exactly like a broken
integration.

**On our side:** we'll write our half behind a feature check so it's inert
until the RPC exists and starts working the day it ships. Happy to hand over
the Unity-side changes as a reviewable patch plus a short test checklist — we
can't run the Editor or see DebugView, so verification has to sit with you.
