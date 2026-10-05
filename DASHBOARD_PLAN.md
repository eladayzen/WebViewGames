# Analytics dashboard — plan for a hosted version

Status: **plan, not built.** A working local version exists at
`tools/analytics-dashboard/` and is the starting point.

Every field, path and event name below was read out of the live Firestore
database, not from documentation or memory. Where something is unverified it
says so.

---

## 1. Why build rather than adopt

The obvious objection is that GA4 already exists, is already live, and is already
reachable. The reason to build anyway is narrow and specific:

**The correct interpretation of this data is non-obvious, and a generic BI tool
gets it wrong by default.** Point any tool at `event_log` and the first thing
anyone writes is `SUM(duration_seconds)` for play time. That answer is several
times too large, because every heartbeat carries the session's *running total*,
not an increment. It looks plausible. Nobody questions it.

Same for `level_id` meaning something different in every game, and for native
games using `value` + `net_session_length` where web games use `game` +
`duration_seconds`. That is domain knowledge, and it belongs in code we control
rather than in a dozen hand-written queries that each have to rediscover it.

The second reason is **immediacy**: Firestore is queryable the instant an event
lands. GA4 custom dimensions are not retroactive and take hours to populate,
which makes them useless while testing a build.

### What this is NOT

This is the dev and QA view, not the company's reporting system. If usage reaches
the point where someone wants cohort analysis over months, the answer is
GA4 → BigQuery, and this becomes the thing you watch while testing. **Build it
knowing that, and do not let it quietly become the source of truth.**

---

## 2. Architecture

    Firebase Hosting          the page. Free, HTTPS, custom domain supported.
         |
         v
    Cloud Function            the query. Admin SDK + service account.
         |
         v
    Firestore                 users/{uid}/event_log  +  profile documents

Everything stays inside the existing `particula-gobalance` project. No new
vendor, no new bill, no new login for anyone.

**Why a Function rather than reading Firestore from the browser:** the dashboard
must read across *all* accounts, which needs admin credentials and a
collection-group index. Doing that client-side would mean opening Firestore read
rules far wider than anyone should want.

### Blocker to clear first

The local dashboard authenticates by borrowing the `firebase login` refresh token
from `~/.config/configstore`. That is a personal credential and **cannot be
deployed**. Replacing it with a service account is the first task.

### Unrelated risk found while planning

`~/firebase-gobalance/firestore.rules` contains the default test rules —
`allow read, write: if request.time < timestamp.date(2026, 8, 7)` — wide open and
long expired. The live rules must differ, since the database works. **That local
file is stale and must never be deployed**; `firebase deploy --only
firestore:rules` from that directory would either open the database to everyone
or deny every client. Fix or delete it independently of this project.

---

## 3. The data model

    users/{uid}                          ACCOUNT — one login (household / venue / device)
      ├─ event_log/{id}
      │    profile: <upid>               PERSON — present on 100% of events
      │    event_name
      │    parameters: { ... }
      │    timestamp
      └─ {prefix}_user_profiles/{upid}   the person: name, DOB, avatar, saves
           └─ profile_saved_data/{gameKey}   WebState, WebStateRev, Score[]

`{prefix}` is build-dependent — `pro` | `home` | `kids` | `na`. **Read it from
the database, never assume.** The test account resolves to `home`.

**Every event already carries `profile`** (verified: 300/300). Per-player views
are therefore a grouping change, not an instrumentation change. Nothing needs
adding to any game.

### Three levels of aggregation

| level | key | answers | available |
|---|---|---|---|
| everyone | — | how is the product doing | needs a collection-group index |
| account | `uid` | how is this household doing | yes |
| player | `profile` | how is this person doing | **yes, already** |

The current local dashboard does none of these properly: it is hardcoded to one
`uid` and ignores `profile`, so several people's play is silently merged into one
line.

---

## 4. What is actually in `event_log`

Both web and native games write here. The local dashboard filters to `web_` and
**discards the rest** — roughly two thirds of the data.

Sampled from 800 consecutive events:

| event | count | prefix | carries |
|---|---|---|---|
| `settings_changed_angle` | 282 | native | board calibration |
| `select_content` | 241 | native | `content_type`, `item_id` |
| `dashboard_viewed` | 81 | native | |
| `open_game` | 50 | native | `screen_name` — **lobby clicks per game** |
| `web_heartbeat` | 37 | web | `duration_seconds`, `level_id` |
| `web_level_start` | 31 | web | `level_id`, `level_number`, `attempt`, `mode` |
| `web_start_game` | 24 | web | `mode` |
| `web_game_end` | 23 | web | `duration_seconds`, `runs` |
| `web_level_end` | 11 | web | `result`, `score`, `stars`, `progress_pct` |
| `sensor_connected` | 9 | native | |
| `start_game` | 5 | native | `player_count`, `levels_chosen`, `value` |
| `login` | 4 | app | |
| `game_end` | 2 | native | `net_session_length`, `levels_played`, `value` |

**One dashboard covering native and web is mostly a filtering change, not new
instrumentation.** `open_game` is already the "lobby clicks" metric.

### Normalisation needed

| concept | web games | native games |
|---|---|---|
| which game | `parameters.game` | `parameters.value` |
| session length | `duration_seconds` | `net_session_length` |
| event naming | `web_` prefixed | unprefixed |

### The rule that must live in code

> **Play time = `duration_seconds` on the LAST event of a session. NEVER a sum.**

See `ANALYTICS.md` §4. This is the single most likely thing for a future
contributor to get wrong, and the wrong answer looks reasonable.

---

## 5. Segmentation

A segment is a **named, saved predicate over a player roster**. All three kinds
the product needs collapse into one mechanism:

| kind | example | implementation |
|---|---|---|
| explicit list | "the five QA phones" | `uid IN (…)` |
| metadata filter | "players born ≥ 2012 on Android" | predicates over profile/account columns |
| behavioural query | "played RoboRun 3+ times, never cleared tier 2" | predicates over event aggregates |

### The roster

Build one flat row per player, joining:

- **account fields** from `users/{uid}`
- **profile fields** from the profile document
- **aggregates** from `event_log` — games played, total play time, levels
  reached, last seen

Then a segment is a predicate over that table and the three kinds stop being
different things.

**Filtering happens in the Function, not in Firestore.** These fields live on
three different document types and Firestore cannot join them. In-memory is fine
for hundreds to low thousands of players; past that the answer is BigQuery, not a
cleverer Firestore query.

Segments are stored as named JSON so they are shareable rather than re-typed.

### Fields verified to exist

**Account** (`users/{uid}`):

| field | example | use |
|---|---|---|
| `application_version` | `8.2.60-Particula-Development` | **"only the build I just shipped"** — the most useful QA filter |
| `application_platform` | `Android` | platform split |
| `GoBalanceSerial` | | specific boards |
| `DeviceId` | | specific devices |
| `FirstUse`, `LastLogin` | timestamps | signup cohorts, lapsed accounts |
| `Email`, `GoogleDisplayName` | | identification |
| `ActivationMode` | `0` | unverified meaning |

**Player** (profile document):

| field | example | use |
|---|---|---|
| `ProfileName` | `Tine`, `Rose`, `Anna` | naming people in the UI |
| `LastUse` | timestamp | active vs dormant |
| `AvatarType` / `AvatarIndex` | `sandals`, `cactus` | — |
| `ProfileYearOfBirth` | `1985`, `2018` | age bands — **see §6** |
| `ProfileGender` | `0`, `1` | **see §6** |
| `ProfileHeight` / `ProfileWeight` | map, 2 keys | **see §6** |

---

## 6. Privacy — decide before building, not after

Some of those profiles are **children** (birth years as recent as 2018). The
profile document carries date of birth, gender, height and weight.

A dashboard that segments by children's ages and body metrics is a materially
different proposition from one showing play time per game — especially on a URL
someone can open.

**Recommendation:** build the roster with `application_version`, platform,
`ProfileName`, activity and behavioural aggregates. **Leave age, gender, height
and weight out** unless there is a specific stated need, and if there is, put
them behind a separate permission rather than in the default view.

Including a field because it happens to exist is how this goes wrong.

---

## 7. Open decisions — needed before building

1. **Who can see it?** "Anyone with the link" / "signed in on the company
   domain" / "named people". This changes the auth design and is the one real
   blocker.
2. **Do the body-metric and age fields belong in it at all?** (§6)
3. **Is there an existing BI tool or hosting convention** the team would rather
   use? Asked, not yet answered. If the company already runs BigQuery + Looker,
   the right job is an export toggle rather than this.
4. **Custom domain?** Hosting gives `*.web.app` immediately; a custom domain is
   a DNS record and can be added later without rebuilding.

---

## 8. Phases

**Phase 1 — make the existing thing deployable.** Replace the borrowed token with
a service account in a Cloud Function; deploy page + function; add auth. Same
single-account view as today, but live and reachable.

**Phase 2 — the hierarchy.** Collection-group query plus index for all accounts.
Account → player drill-down using the `profile` field already on every event.

**Phase 3 — native games.** Include non-`web_` events with the normalisation in
§4. Mostly removing a filter.

**Phase 4 — segmentation.** The roster, the predicate engine, saved segments.

Phases 1 and 2 are the useful ones. 3 is cheap. 4 is the largest and should wait
until someone actually wants a segment that cannot be expressed as a filter row.

---

## 9. What already exists

`tools/analytics-dashboard/` — runs locally, reads Firestore, renders drop-off
per level, play time per day, and stat tiles.

| file | does |
|---|---|
| `server.mjs` | serves the page, exposes `/api/events` |
| `firestore.mjs` | token exchange + the query. **This is what Phase 1 replaces.** |
| `index.html` | the page |
| `charts.js` | the charts — form chosen before colour, validated palette, table views alongside |

`charts.js` carries the measurement rule in code: play time takes the **max**
`duration_seconds` per session, never the sum. Keep that when porting.
