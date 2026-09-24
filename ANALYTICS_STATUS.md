# Web-game analytics — where this stands

Written 2026-09-16, when the work was parked to go back to game fixes. Read this
before picking it up again; three things are true that are not obvious from the
code, and one of them is time-sensitive.

Companion docs: `GOBALANCE_ANALYTICS_SHORT.md` is the handover written for the
app team. `GOBALANCE_ANALYTICS_REQUEST.md` is the original design argument and
is marked superseded at the top.

---

## The one thing that is time-sensitive

**GA4 custom dimensions are not retroactive.** An event parameter that has not
been registered as a custom dimension arrives, is stored in the payload, and is
invisible in every report — permanently, for every event collected before the
registration. There is no backfill.

So the registration below wants doing **before an APK reaches real players**,
not after the first interesting week of data.

It is not a data-loss risk, only a reporting one: the Firestore mirror at
`users/{uid}/event_log` records the full parameter set with the sub-profile
stamped on each event, and that is independent of anything configured in GA4.
Worst case, early data is readable there and not chartable in GA.

## PROVEN END TO END (2026-09-24)

A mission played in the Unity Editor produced real documents in Firestore, with
the whole chain exercised: game -> `window.Unity.call` -> `WebGameBridge` parse
-> validation -> `AnalyticsManager` -> `event_log`. Two runs, one cleared and one
abandoned, both recorded correctly:

```
web_level_end   speedGates  #4   clear  100%  11,172 pts  3 stars  33s
web_level_end   lastCall    #39  quit     0%       0 pts  0 stars   1s
```

`game: "HillBombSunsetRidge"` was attached by the bridge, `profile` was stamped
server-side, and every number arrived as a number rather than a string -- so the
numeric inference in `HandleAnalytics` works and the metrics can be summed.

Only the final hop into GA4 is unproven, and that needs an APK: Firebase
Analytics is a no-op stub on desktop, and DebugView additionally only shows
devices explicitly in debug mode.

### The bug that run found, which reading could not have

`installGbSdk()` opened with `if (window.GoBalance) return true`, on the belief
that nothing else provided the object. THE APP PROVIDES IT: WebGameController
serves `Resources/GoBalanceWebSdk.txt` at `/__gobalance/sdk.js` and injects the
tag as the first script in `<head>`. It is absent from every shipped index.html
because the host rewrites the HTML as it serves it -- which is exactly why an
audit of the built games found no trace of it and drew the wrong conclusion.

That SDK has sixteen methods and no `logEvent`, so the guard saw the host's
object, declared victory, and left `analytics.js` feature-checking for a method
that was never going to appear. Every event was a silent no-op. The shim now
adds the one method the host lacks and touches nothing else.

**The lesson for the rollout:** an audit of shipped builds cannot see what the
host injects at serve time. Check `WebGameController` before concluding anything
about what a web game has available to it.

## What is blocking it

`elad@particula-tech.com` — the account the automation Chrome is signed into —
has **read-only access** to the `particula-gobalance` GA4 property
(`a222490802p426551238`). Verified three ways rather than inferred from one
missing button:

- No "Create custom dimensions" control exists anywhere on the Custom
  definitions page. Every `button`, `a` and `role="button"` on a fresh full-width
  load was enumerated; it is absent, not clipped.
- The Options cell on every existing dimension row renders an empty `<mat-menu>`
  with zero trigger buttons. GA4 builds the container and omits the trigger when
  the user cannot edit.
- Navigating to Property Access Management redirects to reports home, which is
  what GA4 does when admin access is missing.

**Any one of these unblocks it:**

1. Sign the automation Chrome into an account holding Editor on the property.
2. Grant `elad@particula-tech.com` Editor on `particula-gobalance`.
3. Hand the table below to whoever owns the property.

## What to register

Fourteen definitions, all event-scoped. Parameter name and display name can be
identical. This is the whole list — it is meant to be the last one anyone
registers, because the vocabulary is deliberately game-neutral (see below).

**Custom dimensions (5)**

| parameter | what it holds |
|---|---|
| `game` | which web game. Attached by the bridge from the folder name, not by the game |
| `level_id` | the mission or track id within that game |
| `mode` | which half of the game — `missions`, `speedRace` |
| `result` | `clear` / `fail` / `quit` / `dnf` |
| `setting` | which setting changed, e.g. `sensitivity` |

**Custom metrics (9)**

| parameter | unit |
|---|---|
| `score` | standard |
| `stars` | standard |
| `level_number` | standard |
| `attempt` | standard |
| `progress_pct` | standard (0–100) |
| `place` | standard |
| `duration_seconds` | standard |
| `runs` | standard |
| `setting_value` | standard |

`setting_value` rather than `value` on purpose: GA4 treats a bare `value` as the
monetary amount on an event and pairs it with `currency`, so a sensitivity of 60
would quietly become revenue in any report that touches it.

## The events themselves

Five, each prefixed `web_` by the bridge. Ten events and seventeen parameters
were collapsed into this, so that one GA4 configuration serves every web game we
ship rather than one per title — and so cross-game questions ("which game retains
best", "where in a ladder do we lose people") are a single query.

```
web_start_game       mode
web_level_start      level_id, level_number, attempt, mode
web_level_end        level_id, level_number, attempt, mode, result,
                     score, stars|place, progress_pct, duration_seconds
web_settings_changed setting, setting_value
web_game_end         duration_seconds, runs
```

**Nine parameters is the ceiling, not ten.** `WebGameBridge.MaxParams` is 10 and
the bridge spends one of them on `game` itself, so `web_level_end` is exactly at
the limit. That is why a mission sends `stars` and a race sends `place` rather
than both carrying both — adding a tenth would silently drop one.

## Where the code is

**Ours (WebViewGames).** Branch `skateboard-analytics`.

- `HillBombSunsetRidge/src/systems/gbSdk.js` — the JS half of the host bridge.
  This also exists on the stable line (`hillbomb-face-shapes`, `25cc26b`), because
  it is what makes progress save per PROFILE rather than to one device-wide
  localStorage bucket. That was a release bug fix, not analytics.
- `HillBombSunsetRidge/src/systems/analytics.js` — the vocabulary. Analytics-branch
  only; the stable line has no reporting in it at all.

The stable line carries `gbSdk.js`, so a grep of a shipped build finds the
strings `logEvent` and `analytics.log`. That is the SDK method table. Nothing
calls it there — `analytics.js` does not exist on that branch — so no event is
ever sent from a stable build.

**Theirs (gobalance).** Three files, committed as **`8b61437b` "analytics work +
robogame" on branch `Particula-Development`**.

> The repo is currently on `hotfix/games-quick-improvements`, where **none of
> those three changes exist**. Anyone testing from the current branch will find
> the bridge has no `analytics.log` case and conclude the wiring was never done.
> It was; it is on another branch.

- `WebGames/Scripts/WebGameBridge.cs` — the `analytics.log` case and
  `HandleAnalytics`: name pattern, param cap, value length, rate limit,
  reserved-prefix rejection, duplicate-key guard.
- `App/Data/Firebase/Analytics/AnalyticsManager.cs` — `LogWebGameEvent`, routed
  through the existing `LogEvent` so web games inherit both the Firestore mirror
  and the Pro-tablet guard.
- `WebGames/Scripts/GameLauncher.cs` — `LogOpenGame(entry.sceneName)`, so we can
  finally tell which web games get opened. Needs no GA config: it feeds the
  existing `Open Game Name` dimension, already registered against `screen_name`.

## How to verify, and what each method can actually prove

**In the Unity Editor — proves everything except the last hop.** The gree
WebView has a full `UNITY_EDITOR_OSX` implementation and `WebViewSupported()`
excludes only Linux, so the game really runs in the Editor on a Mac.
`UseFirebaseAnalytics()` is `!IsRunningOnProTablet`, true there, so `LogEvent`
fires both sinks. `FirebaseAnalytics.LogEvent` is a no-op stub on desktop, but
`AddLogEvent` writes a real Firestore document — readable afterwards with the
Firebase MCP. Requires being signed into the app in the Editor;
`AddLogEvent` no-ops when the uid is empty.

**On an Android build — the only way to see events reach GA4.** Firebase
Analytics is mobile-only. Note it will not work on the Bobo Pro tablet either:
no Google services there, and `UseFirebaseAnalytics()` correctly skips it.

**Headless, against the real shim — proves the payloads.** The wire format has
been verified end to end across both modes: attempt increments on a replay,
starts and ends balance, every `level_end` carries the mode its level *started*
under, and durations and progress are real numbers.

Two bugs were found that way and would otherwise have shipped, both recorded in
`c940c57`: `mode` was read at send time, so a mission ending while the next run
started was filed under the wrong mode; and the outgoing mode was stopped after
`reset()`, so an abandoned race reported its own distance and score as zero.

## Still genuinely undecided

**How the sub-profile reaches GA.** Firestore already records `profile` on every
event. GA identifies by app instance, so on a shared family board every child is
one GA user, and "how many players cleared mission 5" cannot be answered in GA4.

The clean fix is a GA user property set on profile switch, which would need a
little more of their C# and a **user-scoped** custom dimension here. It would
close the same gap for the native games, which have it too.

Worth deciding deliberately rather than by default: it is the difference between
per-device and per-child analytics, and it is the kind of thing that is cheap now
and expensive to backfill — for the same non-retroactive reason as everything
else on this page.
