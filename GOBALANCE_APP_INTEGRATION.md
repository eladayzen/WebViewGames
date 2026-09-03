# Shipping a web game into the GoBalance app

How to take a game from this repo and make it run inside the real product.

**Which project is which** — get this right first:

| Path | What it is |
|---|---|
| `~/UnityProjects/gobalance` | **The product.** The BoBo app. This is where games ship. |
| `~/PracticulaProjects/gobalance_bobo_sdk` | The older SDK sandbox. `GOBALANCE_SDK.md` documents *that* one. |

The two hosts are similar but not identical, and the differences bite. This
document covers the **product**. Where it disagrees with `GOBALANCE_SDK.md`,
this one wins for `~/UnityProjects/gobalance`.

### Read the app team's README first

**`~/UnityProjects/gobalance/Assets/GoBalance/WebGames/README.md`** — 148 lines,
maintained by the BoBo app team, and the definitive statement of the API you
build against. Read it before this document, not instead of it.

The division, so neither goes stale:

| Their README | This document |
|---|---|
| The **contract** — what `GoBalance.*` offers, what each call returns, what is and isn't possible | The **practice** — what breaks when you actually land a game, and what we learned costing hours |
| Owned by the app team, changes when the API changes | Owned by us, changes when we get burned |

Where the two disagree, **theirs wins on the API** and this one wins on process.
Deliberately not copied here: the full call list, the leaderboard scope table,
the save-state paths. Duplicating them means two versions drifting apart — the
same mistake as mirroring avatar art, one directory up.

Ground truth beneath both, if either disagrees with the code:
`~/UnityProjects/gobalance/Assets/GoBalance/WebGames/` — `WebGameController.cs`,
`WebGameBridge.cs`, `WebGameSaveStore.cs`, and `Resources/GoBalanceWebSdk.txt`.

---

## The split: what an agent owns, and what it must not touch

**You own:** the Vite project in this repo, and the contents of one folder,
`Assets/StreamingAssets/<GameName>/`, in the app.

**You do not own** `Assets/GoBalance/WebGames/`. That folder is the app team's,
is shared by every web game, and you cannot test the games you would break. If
the API doesn't do what you need, **say what's missing and stop** — do not
extend the bridge in your branch and do not work around it.

The Unity-side registration (scene, Build Settings, games list) is the project
owner's, not yours. Prepare it; don't perform it.

---

## The five things that will actually break you

Ranked by how much time they cost, not by how interesting they are.

### 1. `manifest.txt` is mandatory, hand-maintained, and fails silently

`WebGameController.ExtractStreamingAssets()` reads it to pull the game out of
the compressed APK **on Android**. Missing or stale ⇒ **blank screen on device,
works perfectly in the Editor.** There is no generator anywhere in either
project, and Vite content-hashes every filename, so it must be regenerated on
every single build.

Format: one relative path per line, `index.html` first, then every asset. It
must not list itself.

```bash
{ echo "index.html"; cd "$SDK" && find assets -type f -not -name '*.meta' | sort; } > "$SDK/manifest.txt"
# then verify:
#   line count == file count (excluding manifest.txt and *.meta)
```

### 2. Delete the old `assets/*` **and their `.meta` files** before copying

Vite re-hashes filenames every build. Leave the old ones and you accumulate dead
files plus orphaned `.meta`s that Unity keeps re-importing.

### 3. The rAF shim is the page's job, not the SDK's

WKWebView treats the occluded Unity overlay as a background tab and stops firing
`requestAnimationFrame`. Every shipped game replaces `requestAnimationFrame`
with a queue in an inline `<head>` script and exposes `window.__pumpFrames()`,
which the host calls every frame. **Without it the game freezes on iOS.**

Keep it in your tracked `index.html` so it survives `npm run build`. Copy the
block from any shipped game.

### 4. `#gameover-overlay` + `#restart-button` + the literal class `hidden`

The host synth-clicks the button on Space/Enter whenever an element with that id
is visible:

```csharp
"var o=document.getElementById('gameover-overlay');" +
"var b=document.getElementById('restart-button');" +
"if(b&&o&&!o.classList.contains('hidden'))b.click();"
```

So: do not rename either id, do not use a different class for "hidden", and
**never reuse `#gameover-overlay` for a start screen, level-complete or results
screen** — Space/Enter would restart through it. Give other screens their own id.

### 5. `forwardSteeringKeys` must be `false` if you read the sensor

Default is `true`, which synthesises held Arrow keys from board tilt. If your
game also reads `window.__gbSensor`, **both inputs apply and the player steers
about twice as fast as they lean.** Multiplayer forces it off too — synthetic
keys can only ever drive one player.

Scenes already set correctly to `0`: `AstroTunnel`, `TmntSkateSlice`. Copy one
of those rather than a `1/1` scene.

---

## The build-and-land loop

Source of truth is this repo. The app holds built output only — six of the eight
originally shipped games have no source in that repo at all.

```bash
cd <Game>/
npm run build

SDK=~/UnityProjects/gobalance/Assets/StreamingAssets/<GameName>
find "$SDK/assets" -type f -delete          # stale hashed files AND their .meta
cp dist/index.html "$SDK/index.html"
cp -R dist/assets/* "$SDK/assets/"
{ echo "index.html"; cd "$SDK" && find assets -type f -not -name '*.meta' | sort; } > "$SDK/manifest.txt"
```

Then verify, every time:

- manifest line count == file count
- zero orphaned `.meta` in `assets/`
- `__pumpFrames` still present in the shipped `index.html`
- `#gameover-overlay` and `#restart-button` still present
- every shipped extension is in `MimeFor()` (below)

**Do not commit in the app repo.** That repo is shared and usually carries other
people's in-flight work.

---

## Host constraints worth knowing before you design

- **`MimeFor()` is a fixed switch**: `.html .js .css .json .png .jpg .jpeg .svg
  .wasm .mp3 .ogg .woff2 .woff .ttf`. Anything else is served as
  `application/octet-stream` — fine for `fetch`, fatal for a module script, and
  awkward for `<video>`. `.mp4`, `.webm`, `.webp`, `.m4a` are **not** in it.
- **No HTTP Range support.** Long `<audio>`/`<video>` seeking will not work.
- **Ports 8090–8099 only.** Ten simultaneous games max.
- **Nothing outside the game folder.** The server rejects any resolved path not
  under its root, and ES modules are dead on `file://` anyway.
- **`folderName` is used raw and never trimmed.** A leading space silently
  resolves to a folder that does not exist ⇒ blank screen. In the scene YAML a
  correct value is unquoted; if you see `folderName: ' Name'` **quoted**, YAML
  quoted it *because* of the space. That is the tell.
- **Whatever is written in `index.html` is the first thing the player sees.**
  The WebView paints the markup before your bundle runs, so any placeholder text
  is on screen for real — over the app's own loading, it can be the *only* thing
  read. Placeholder copy that later goes stale ships a visible lie: ours said
  "Starting in 10" long after the wait became five seconds, and that is what the
  player saw every launch. Write the pre-JS text as something that stays true
  with no number in it, and let the script fill in specifics.
- **The folder name is permanent.** `FirestoreStructureStrings.WebGameKey()`
  derives the save/score key from it (`NovaVanguard` → `web_nova_vanguard`).
  Renaming after ship orphans every player's data with no migration. **Decide the
  name before shipping.**

---

## The SDK

Injected, not imported. The host serves `Resources/GoBalanceWebSdk.txt` at
`/__gobalance/sdk.js` and rewrites each `index.html` in flight to load it as the
**first tag in `<head>`**. You do not add a script tag; if you ship one pointing
at that path, the injector leaves your file alone.

**`window.GoBalance` does not exist outside the app.** At a plain dev URL that
path 404s and the global is undefined. Feature-detect everything:

```js
const gb = typeof window !== 'undefined' ? window.GoBalance : null;
if (!gb) return;   // degrade to hidden or local-only, never throw
```

That is not politeness — it is how the game is developed and tested.

### Surface

```js
GoBalance.available                  // false in a normal browser
GoBalance.audio                      // STUB: always {volume:1, muted:false}
GoBalance.on('playerschange', fn)
await GoBalance.getProfile()         // {signedIn, isGuest, id, name, avatarType,
                                     //  avatarIndex, gender, yearOfBirth}
await GoBalance.load()               // your last save(), or null
await GoBalance.save(state)          // any JSON-serialisable value
await GoBalance.submitScore(1234)    // one run; integers only, it rounds
await GoBalance.getScoreboard()      // {complete, entries:[...]}
GoBalance.multiplayer                // true once >1 board is paired
GoBalance.getPlayers()               // call each frame
GoBalance.back()
GoBalance.setSensitivity(0..100)
```

Legacy `window.__gbSensor`, `nav:back` and `gb:sensitivity:<n>` still work and
are not going away.

### Input

`window.__gbSensor = {x, y}` is a **plain global you poll**, rewritten at 60Hz.
Not an event. Multiplayer adds `window.__gbPlayers`.

### Saved state, in one paragraph

**First ask whether you need it at all.** These are arcade games — a run is whole
or it is nothing (see below) — so a run in progress is never saved and there is
nothing to resume. `save()` is for what survives BETWEEN runs, which for most
games so far is nothing at all. Scores are not this: they go through
`submitScore`, which is the only path the app can rank.

`save()`/`load()` store an opaque per-profile blob the app never parses — see
their README for the Firestore path and the key derivation. Three consequences
worth designing around: a copy is always mirrored to **PlayerPrefs**, so saves
survive offline play, guest profiles and BoBo Pro tablets (no Google services,
therefore no Firestore), with a monotonic revision deciding which copy wins on
load; **guest profiles are never written to the cloud**, so their data and their
board rows exist only on the device that played them; and because the blob is
opaque, **you own every migration** — old saves keep arriving after you change
its shape, so version the payload from the first build.

### Scores, and the difference from `save()`

`save()` stores an **opaque blob the app never parses** — a score buried in it
can never be ranked. `save()` is for game state; `submitScore()` is for anything
compared.

Entries look like:

```js
{ profileId, name, avatarType, avatarIndex, score, isYou }
```

Three things that catch people:

- **They are RUNS, not per-profile bests.** One profile holds several rows.
  Decide deliberately whether to reduce; showing raw runs on a family board lets
  whoever played most fill it.
- **There is no timestamp and no run id.** You cannot positively identify the
  run just played. The workable anchor is matching an `isYou` row on the exact
  score you just submitted — ambiguous only between runs that are identical
  anyway.
- **`complete: false` means only this device could be read** (offline, or nobody
  signed in). Label it "on this device", never as the whole family.

**What the store actually keeps** (`WebGameSaveStore.cs`), because it changes
what your result screen can promise:

- **Your best 100 runs per profile, per game — not your last 100.** The array is
  sorted high-to-low and *then* truncated, so a low run is discarded at write
  time once 100 better ones exist. This was 10 until it bit us: a player who
  quit early submitted a low score, it fell off immediately, and the result
  screen correctly showed a board without the run they had just played. If a run
  you just submitted is missing, this is the first thing to check.
- **`submitScore()` resolves before the write commits.** It reports success while
  the Firestore write is still in flight, so a `getScoreboard()` fired the
  instant it resolves can come back without that run. Intermittent by nature.
  If you must show the run with certainty, hold the value you submitted and
  render it from that rather than trusting it to come back.

Both live on the host side. Neither is yours to fix — report them.

**Scope:** a personal best works. A family board across the profiles on one
account works — that is what `getScoreboard()` returns. A **global** board across
different accounts does not exist and needs shared Firestore collections and
write rules that are not there. Don't design for it.

### Avatars — derive them, do not mirror them

`avatarType` is a name (`astronaut`, `skateboard`, …) and `avatarIndex` is the
slot the app assigned that profile. The art itself lives in the Unity project,
which **the page cannot reach** — the server only serves your game's own folder.

The first version of this mirrored the PNGs into the game's assets. **Do not.**
That was rejected on the grounds that decide it: every game needs its own copy,
and each copy goes stale the day the app adds or redraws an avatar.

Render an identity you can derive instead — the player's initial on a colour
picked from `avatarIndex`:

```js
const WHEEL = ['#fee44f','#36c09e','#ee5d2c','#8ab4ff','#f48dd4','#9be564','#ffa14a','#7fd7ff'];
// avatarIndex is what the app already uses to tell two siblings apart, so the
// board agrees with the lobby without sharing a single asset.
// Fall back to a hash of profileId -- NOT name, since two profiles can share one.
```

Working reference: `NovaVanguard/src/data/avatars.js` (~50 lines, copyable).

Two things that make it hold up:

- **A small hand-picked wheel, not generated hues.** These are read at a glance,
  side by side, on a dark card. Evenly spaced hues produce neighbours nobody can
  tell apart, and some will collide with your own player colour.
- **Never key the colour off the name.** Names repeat and change; `profileId`
  does not. A row must not change colour because someone was renamed.

Keep the derivation in **one exported function**. If the app ever serves avatars
the way it already serves the SDK (`/__gobalance/avatar/<type>.png` — worth
asking for), that function starts returning a `src` too and nothing else moves.

---

## Audio — the game owns it

**A web game's audio is entirely its own.** The app's mute button does not reach
the page, and the page does not report its sound state back. Every game starts
with sound ON and ships its own control if it wants one.

`GoBalance.audio` still exists as a constant `{volume: 1, muted: false}` and
`on('audiochange', …)` still registers, purely so older code does not throw.
**Both are stubs.** Reading them tells you nothing — do not build behaviour on
them.

### How it got here, so nobody rebuilds it

This was wired up once and deliberately removed (`d6fb9fda`, 2026-08-31). The
SDK used to shadow `AudioContext.prototype.destination` and splice in a gain
node the app controlled, so the app's mute silenced the page. It worked, and it
was the wrong shape: the app's mute became authoritative and one-way, so a
player entering a game from a muted lobby had **no route to sound at all** —
no in-game control could override a gain node upstream of everything the game
owned, and there was no `setMuted` to ask with. The fix was to detach.

The lesson worth keeping: `AudioListener.volume` has no effect inside a WebView,
which is why the app's mute never reached web games in the first place. Anything
that "fixes" that by clamping the page's audio recreates the same trap.

### What a game should do

Ship a **speaker button that opens a small menu with two switches, Music and
Sound effects**, each on/off. That is the shape Nova Vanguard uses and the one
to copy:

- **Two switches, not one.** They are separately wanted — a player often wants
  the game's feedback while listening to their own music, and an all-or-nothing
  toggle gets a game silenced entirely by anyone who dislikes its soundtrack.
- **Separate gain buses** under a master, so a switch is one gain write rather
  than a flag every play path has to remember to check.
- **Persist the choice** (`localStorage`, guarded — it can throw outright in a
  restricted WebView) and **read it before building the audio graph**, or the
  buses are created from defaults and a player who muted the music hears a burst
  of it on every launch.
- **Turning music off should stop the source**, not leave it playing into a
  silent gain.
- **Drive the speaker icon from the effective state** — master muted, or both
  channels off, both mean silence, and an icon tracking only one contradicts the
  other.

### The one WebAudio rule that still applies

Browsers block audio until a genuine user gesture, and a WebView is stricter,
not looser. Self-install a one-time `pointerdown` / `touchstart` / `keydown`
listener that resumes the `AudioContext`, rather than expecting every call site
to remember. A tap on your own mute control is itself a gesture — use it.

## These are arcade games: a run is whole, or it is nothing

**There is no mid-run save, and there should not be one.** A player steps onto a
board, plays until they die or stop, and steps off. Nothing carries into the next
run. Design to that and a lot of hard questions stop existing — no resume, no
"continue?", no partial state to migrate, no half-finished run to reconcile
against a board.

What that buys you is one rule, and it is worth stating as a rule because every
ending in the game has to obey it:

> **Every way a run can end, ends the same way: bank the score, then show the
> board.** No exceptions for the endings that feel like they don't count.

There are three of them, and it is easy to build only the first:

| How the run ended | Screen | Clock? |
|---|---|---|
| **Died** | result screen | yes — restarts itself, so an abandoned machine never parks on a dead screen |
| **Quit** (pressed X mid-run) | board + PLAY AGAIN / QUIT | **no** — they chose to stop |
| **Finished** (beat the last level) | a beat, then the same board + PLAY AGAIN / QUIT | **no** — the beat is the one screen they earned |

### The score counts even when the player quit

This is the one most likely to be got wrong, and it was a direct instruction:
**a run that ended by choice still happened.** A board that only records deaths
quietly punishes stopping — it teaches players to stand there and die on purpose
rather than press the button that means "I'm done". So the quit path submits,
exactly like the death path.

Practically: `submitScore` on the way into the quit screen, not on the way out.
The player may leave to the lobby from that screen and the page is gone.

### Whether the run is worth submitting is not your call

Don't filter out short runs, zero scores, or "they only played ten seconds".
The host stores your best N runs per profile and drops the rest, so a run that
does not deserve a place will not get one — that decision already exists one
layer down, and making it twice means the second one is invisible.

### A clock is for abandonment, not for pacing

Put a self-restarting timer only on the screen a player lands on **without
choosing to** — the death screen. A screen they pressed a button to reach should
wait for them. Getting this backwards is how a celebration screen yanks itself
away while someone is reading their score.

And if a screen has both a clock and a skip, guard the skip on the screen's
**age**, not on listener order: one press can reach two skip listeners, and the
second one will skip the screen the first one was opening. Ours ignores skips in
the first 0.3 s.

### Restart means restart

PLAY AGAIN and the death screen's timer both start a **complete fresh run** —
level one, score zero, world reset. There is no "continue where you left off",
because there is nothing to continue: see the top of this section. Reset the
renderer's surface too, or a restart taken on level five leaves the wrong art
under level one.

### Guard "this screen is up" on state, not on a timer

A subtle one that cost us a bug report. A screen whose timer expires calls its
own handler with the timer already negative, so a handler that guards re-entry
with `if (timer < 0) return;` rejects the very call the expiry makes — and then
every button on that screen is dead for the rest of the run. Guard on the state
enum instead: it answers the honest question, "is this screen what's on screen?"

Related: give **finishing** its own state, separate from dying. They suppress the
simulation identically, but the state is also what the X reads to leave without
asking and what Space reads to restart — and on a screen with its own buttons,
"play again" must be a button the player chooses, not a key firing under their
hands.

---

## Quitting — the X is the only way out

On the board there is no keyboard, no gesture and no home button the player can
reach. `#gb-back` is it. That cuts both ways: **it must always work, and it must
not end a run on a single mis-tap.**

### Route it through your own handler, keep the inline fallback

Every shipped game's button carries an inline `onclick`. Prefer a game-owned
hook and fall back to a direct `nav:back`:

```html
<button id="gb-back"
  onclick="(window.__gbBack || function(){ if(window.Unity) window.Unity.call('nav:back'); })()">×</button>
```

The fallback is not belt-and-braces — **a game that fails to load a module must
still be escapable.** Without it, one broken import strands the player.

### Ask, but only when there is a run to lose

Confirm on a mis-tap mid-run. Do **not** confirm from a start screen, a results
screen or a quit screen: the player is already stopped, and asking "are you
sure?" over a screen they chose to be on is noise.

```js
window.__gbBack = () => {
  if (hud.isQuitOpen()) return leaveToLobby();
  if (!started) return leaveToLobby();
  if (world.state !== GameState.RUNNING) return leaveToLobby();
  pausedBeforeConfirm = world.paused;   // remember, see below
  setPaused(true);
  hud.showConfirm();
};
```

### The confirm is a modal over the paused game, not a screen

It must **not** paint over the playfield. The player has to see the run they are
being asked to abandon — a light scrim and a card, with the game visible
underneath.

And it **must pause**, precisely because the game is still visible: leaving it
running means the player watches themselves die while deciding.

**Restore the previous pause state, not "unpaused".** Someone who paused,
reached for the X, then changed their mind should still be paused. Blindly
resuming drops them into a live game they had deliberately stopped.

Route every pause through one function, so the audio suspend/resume can never
drift out of step with it.

### After confirming: a quit screen, not an exit

Leaving straight to the lobby throws away the run. Show the board screen
instead — the run's result, the leaderboard, **the score submitted even though
the player quit**, no timer, and two buttons: play again and quit. See "a run is
whole, or it is nothing" above for why each of those is not optional.

Build this screen ONCE and reuse it for finishing the game, too. Quitting and
completing the campaign leave the player in exactly the same position — the run
is over, the score is banked, and the only question left is play again or leave —
so they should differ in the headline and nothing else. We built the victory
ending as a separate screen first and then deleted it.

The X stays where it is and leaves from there.

> **Do not build this screen out of `#gameover-overlay`.** See rule 4 above —
> the host synth-clicks `#restart-button` whenever an element with that id is
> visible, and a screen with its own buttons would be firing a restart behind
> them. Give it its own id and verify there is exactly one `#restart-button` in
> the document.

### The trade to be aware of

A quit screen with no timeout sits there indefinitely. That is right for a
deliberate quit, and it does mean a player who walks away parks the machine on
it — where a death screen would have auto-restarted. Decide knowingly.

---

## Dev tools and player settings — two different things

These are the same in every game, so copy them rather than reinventing them.
`NovaVanguard/src/ui/devUnlock.js` and `src/ui/settingsPanel.js` are written to
be lifted wholesale.

**Split them by audience, not by convenience.** One panel mixing both means the
player who wants to change their controller has to walk past a spawn-rate slider.

### Player settings: visible, and only what a player would want

Controller sensitivity belongs here. It is a real player-facing need on a
balance board — people differ in weight and confidence, and the default will be
wrong for someone in every family.

```js
GoBalance.setSensitivity(percent);   // 0..100, higher = reacts to a smaller lean
```

Persist the choice yourself (`localStorage`) and re-apply on boot; the host does
not remember it for you. Keep the range sane — 10–100 in steps of 5 — and drive
the host on change, so the player feels it while adjusting rather than after.

### Dev tools: hidden behind a deliberate gesture

Debug overlays must not be reachable by a curious child, and must stay reachable
by you on a device with no keyboard. The pattern:

1. **Press and hold a fixed, unlabelled element for 7 seconds** — something
   always on screen (the health bar works) with no hint that it does anything.
   A hold cannot happen by accident the way a tap sequence can.
2. **Then a numeric pad** — digits and an X, nothing else.
3. **Judge the code only when it is complete, and make every key look the
   same.** This is the part that is easy to get wrong: our first pad compared
   as-you-type and reset on the first wrong digit, so a correct digit added a
   dot and a wrong one did nothing. The pad was answering each digit on its own
   — nine taps found the first, nine more the second, and a 4-digit code was
   worth about 36 guesses. It also made eight of the nine keys feel broken,
   which is how it got noticed. Every press adds a dot; nothing is judged until
   the last one; a wrong code holds the full row for a moment and then clears,
   so failure looks exactly like success right up until it doesn't. Ignore
   presses during that pause, or a fast tapper starts the next attempt
   half-typed.
4. The backdrop **swallows clicks but does not close** the pad, so a mis-tap
   while entering the code does not dump you back into the game.

Ship with dev tools hidden by default. **Do not persist the unlock** — keep it
in memory so a reload re-locks it. Player settings are the opposite: persist
those, or the player re-picks their sensitivity every launch.

---

## Registering the game (the project owner's four edits)

1. **`Games/<Name>/<Name>.unity`** — copy an existing web-game scene. The scene
   holds only a `Main Camera` and a `WebGameController`. Set `folderName`
   (exactly matching StreamingAssets, no stray spaces), `displayName`, and
   `forwardSteeringKeys` / `forwardVerticalAxis`.
2. **`ProjectSettings/EditorBuildSettings.asset`** — add the scene, `enabled: 1`,
   or the launcher reports "Scene … is not in Build Settings".
3. **`Scenes/GamesList.unity`** — add a `GameEntry` (`displayName` / `sceneName`
   / `active`) to the serialized list. There is no ScriptableObject; the registry
   is inline in the scene YAML.
4. Optionally a display name in `Assets/Resources/localizedText_en.txt`.

**Known gap:** `GamesList` is currently orphaned — `ScenesStrings.GamesList` is
defined and never referenced, and the app's real carousel
(`App/MainMenu/Scenes/GameSelection.unity`) wires buttons by string with no web
game among them. Today a registered game is reachable by opening its scene
directly, or via the Admin scene field. Registering is still correct; it just
isn't the route in yet.

Playing a web-game scene standalone can NRE in `Update()` because
`BaseInputManager.Instance` is a singleton carried from the app's boot scene. If
that happens, start from the app's normal entry scene and switch.

---

## Verification checklist

**Browser first** (`vite build` + a static server, or the dev server): the game
boots and behaves with **no `GoBalance` present**. This proves your feature
detection is real.

**Editor:** board drives the game with no double-input; Space/Enter restarts
from the game-over overlay; the game starts with sound on and its own mute
control works; X asks before ending a run, and leaves without asking from any
screen where the player is already stopped; **exercise all three endings — die,
quit mid-run, and finish the last level — and confirm each one banks the score
and shows the board**; **quit mid-run and confirm the run you just played appears
on the quit board** — that path exercises submit, fetch
and placement in one go, and it is the one that broke; dev tools are invisible
until the hold-and-code unlock, and player settings are reachable without it.

**Device — the only place two failures are visible at all:**
- blank screen ⇒ manifest missing or stale
- frozen after a few seconds on iOS ⇒ the rAF shim did not survive the build

---

## Failure modes, and what they actually mean

| Symptom | Cause |
|---|---|
| Blank screen on device, fine in Editor | `manifest.txt` missing or stale |
| Blank screen everywhere | `folderName` wrong — check for a leading space; a quoted value in the YAML is the tell |
| Freezes on iOS after a moment | rAF shim / `__pumpFrames` missing from `index.html` |
| Steers about twice as fast as you lean | `forwardSteeringKeys: 1` while the game reads `__gbSensor` |
| Space/Enter restarts a run that never started | a non-game-over screen reusing `#gameover-overlay` |
| Silent until the player interacts | the AudioContext was never unlocked — no gesture listener |
| Module script refused | file type not in `MimeFor()` |
| Saved progress vanished | the StreamingAssets folder was renamed after shipping |
| Player stranded in a game | `#gb-back` routed only through a module that failed to load — keep the inline `nav:back` fallback |
| A run ends on a stray tap | X quitting without confirming while a run is in progress |
| A screen's buttons are all dead and it never advances | its handler guards re-entry on a timer that has already gone negative — guard on the state instead |
| Pressing a button skips the screen it just opened | one press reaching two skip listeners; guard the skip on screen age, not listener order |
| A run the player quit is missing from the board | the quit path never called `submitScore` — every ending banks the score |
| A restart plays level one under level five's art | the world was reset but the renderer's surface was not |
| The run just played is missing from the board | it fell off the host's best-N cap (low score, e.g. a quit), or the board was fetched before the write committed |
| Avatars look wrong or blank after an app update | the game mirrored the app's PNGs — derive the identity instead |
