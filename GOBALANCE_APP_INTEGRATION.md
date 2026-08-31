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

Ground truth, if this doc and the code ever disagree:
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
GoBalance.audio                      // {volume, muted} — read-only, host-pushed
GoBalance.on('audiochange', fn)
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

**Scope:** a personal best works. A family board across the profiles on one
account works — that is what `getScoreboard()` returns. A **global** board across
different accounts does not exist and needs shared Firestore collections and
write rules that are not there. Don't design for it.

### Avatars

`avatarType` is a name (`astronaut`, `skateboard`, …) and the art lives in the
Unity project, which the page cannot reach — the server only serves your game's
folder. Today that means **mirroring the PNGs into your own assets**.

They resolve from `Assets/GoBalance/App/MainMenu/ScriptableObjects/Avatars
List.asset` — walk each entry's sprite GUID to the `.meta` that declares it
(they land in `App/GeneralSprites/UiImages/UserProfiles/uppN.png`). Each entry
also carries an authored colour, useful as a ring behind the image.

Mirrored art is a **duplicate**: it goes stale when the app changes, and every
game needs its own copy. Handle an unknown `avatarType` by falling back to an
initial rather than a broken image. Worth asking the app team to serve avatars
the way they already serve the SDK.

---

## Audio — read this before wiring sound

**The SDK shadows `AudioContext.prototype.destination`** and splices a
host-owned `GainNode` in front of the real destination, so it can enforce the
app's mute. Consequences:

- Benign for a normal graph — your nodes sit upstream and are never touched.
- `ctx.destination` is **a GainNode, not the real `AudioDestinationNode`**.
  Identity comparisons and `maxChannelCount` will misbehave.
- It only ever *undoes its own* muting, so a game's own toggle is never
  silently switched back on.

**The app's mute is authoritative and one-way.** `PREF_GLOBAL_VOLUME` (0 or 1)
is pushed to the page; the SDK sets its gain to 0. There is **no `setMuted` or
`setVolume`** — a game can observe and nothing more.

So while the app is muted, **a web game cannot make a sound, and no in-game
control can change that.** Design for it:

- Subscribe to `audiochange` and track the app's mute as a **separate input**
  from the player's own, OR'd together. Collapsing them means the app unmuting
  clears a mute the player set themselves.
- Drive your mute icon from the *effective* state, or it will claim sound is on
  while the game is silent.
- Keep your own controls usable while app-muted — record the preference and
  apply it when the app unmutes — and say plainly on screen that the app is
  muted, or the silence reads as a broken game.

> **OPEN ISSUE (2026-08-31).** Amit is checking with the developers whether app
> mute should hard-mute web games at all, or only set their initial state, and
> whether a one-way `setMuted(false)` should exist so a game can offer sound
> inline. **Update this section when that lands.** Until then the above is the
> contract.

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
from the game-over overlay; the app's mute reaches the game.

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
| Silent, in-game mute button does nothing | the app is muted; nothing in the game can override it |
| Module script refused | file type not in `MimeFor()` |
| Saved progress vanished | the StreamingAssets folder was renamed after shipping |
