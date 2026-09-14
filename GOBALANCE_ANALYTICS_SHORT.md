Hi — web games reported nothing to Google Analytics: not a mission cleared, not
a race finished, not even that the game was opened. The analytics layer itself
was fine; the web-game path was never wired into it (no analytics calls anywhere
in `GoBalance/WebGames/Scripts/`).

**This is a handover, not a request — both halves are written and in your repo,
waiting on your review.** What follows is what changed and what is still open.

---

**1. Which web games get opened — `GameLauncher.LaunchGame()`**

One line before the existing `changeScene`:

    AnalyticsManager.Instance.LogOpenGame(entry.sceneName);

`open_game` and `LogOpenGame()` both already existed; this is Unity-side so it
touches no bridge, and it goes through `AnalyticsManager` so it inherits the
Firestore mirror and the Pro-tablet guard. It fixes **all five active web games
at once** — until now there was no way to tell which web games anyone opened, or
whether they opened at all.

`entry.sceneName`, not `displayName`: the label changes (ours said "Skate World"
for a while) and keying analytics on a label forks its own history the day it is
edited. It also lands in the `Open Game Name` custom dimension you already have
registered against `screen_name`, so it needs no GA config.

`GameLauncher.cs` was also missing `using GoBalance.App.Data;` — added, or it
would not have compiled.

**2. What happens inside a game — one new bridge method**

An eleventh RPC alongside `save.set` / `score.submit`:

    GoBalance.logEvent(name, params?)

Routed through a new `AnalyticsManager.LogWebGameEvent` rather than
`FirebaseAnalytics` directly, so a web game cannot sidestep the Pro-tablet kill
switch. Validation lives in `WebGameBridge.HandleAnalytics`, where the untrusted
string arrives, not in `AnalyticsManager`: name pattern, 10-parameter cap,
100-char values, 60 events/minute, reserved-prefix rejection, and a duplicate-key
guard — `LogEvent`'s `ToDictionary` would otherwise throw on a repeated key, and
not at the bridge but downstream.

The payload is **delimited, not JSON**: `name|key=value|key=value`. There is no
JSON parser on that side, so accepting JSON would have meant a hand-rolled one
fed by the least trusted place in the system. Two `Split`s cannot be subtly
wrong. Numbers are detected and passed to GA as numbers, since a value arriving
as text cannot be summed or averaged in a report.

**3. Our side**

`window.GoBalance` never existed. The game called it and fell back to
`localStorage` every time, which is why progress was device-wide rather than per
profile — the unreproducible "different children see the same progress" report.
`systems/gbSdk.js` is the missing JS half of your `gb2:` protocol; it installs
only inside the WebView, so a plain dev URL still uses the local fallback.

---

**Decided since, so you don't need to answer it:** shared event names with a
`game` parameter, not per-game names. The bridge attaches `game` itself from the
folder, so games cannot lie about it, and "which of our games retains best" is
one query rather than five. Our events are now generic on purpose — `level_start`
/ `level_end` with a `result`, rather than `mission_clear` and `race_dnf` — so
the GA4 custom dimensions get registered once for the whole catalogue instead of
per title.

**Still open, and it needs you:** how the sub-profile reaches GA. Firestore
already records `profile` on every event, but GA identifies by app instance, so
on a shared family board every child is one GA user and "how many players cleared
mission 5" cannot be answered there. The clean fix is a GA user property set on
profile switch — which would close the same gap for the native games.

**Worth flagging:** GA4 will not show event parameters in reports until they are
registered as custom dimensions. If that step is missed the events arrive and the
parameters are invisible, which looks exactly like a broken integration. That
registration is ours to do and is in hand.

**Verification:** Firebase Analytics is a no-op on desktop, so nothing reaches
GA4 from the Editor — but `AddLogEvent` writes a real Firestore document to
`users/{uid}/eventLogs`, and Firestore does run on desktop. An Editor session
therefore proves the whole chain except the final hop into GA4, which needs a
device build.
