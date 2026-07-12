# Shipping a web game to the GoBalance SDK

## The process, in one sentence

**We build here, we move it over there — that's it.**

- **Here** = this repo, `~/UnityProjects/WebViewGames` — each game is its own Vite/Three.js
  project (`Astro_Tunnel/`, `CarRacer/`, and whatever comes next).
- **There** = `~/PracticulaProjects/gobalance_bobo_sdk` — the Unity project that hosts every
  game via an embedded WebView, controlled by a BoBo balance board instead of a keyboard.

## Who owns what

This split is fixed and doesn't change per-game — read it before touching either project.

**If you're an agent working on a game in this repo, your job is:**
1. Make the game's own Vite build satisfy the contract below (module output, DOM ids, input
   handling, the boilerplate snippets).
2. `npm run build`.
3. Copy that build into `gobalance_bobo_sdk/Assets/StreamingAssets/<GameName>/`, replacing
   whatever was there.
4. Regenerate that folder's `manifest.txt` to match.
5. **Stop there.** Report that the build has landed in `StreamingAssets`. Do not create or edit
   Unity scenes, do not touch `WebGameController` components, do not touch Build Settings or
   the GamesList — that's not your job even if you technically could.

**The project owner (human) handles, in the Unity Editor:**
- Opening the project so Unity imports whatever new files just landed in `StreamingAssets`
  (generates their `.meta` files — this can't be done from outside the Editor).
- Creating the game's scene under `Assets/Games/<GameName>/`, adding/configuring the
  `WebGameController` component, adding the scene to Build Settings, and registering it in
  `GoBalanceSDK/Scenes/GamesList`'s `GameLauncher`.
- Testing and playing it.

If you're an agent and you're not sure whether something is "your side" or "their side": if it
involves opening the Unity Editor, a `.unity` scene file, `ProjectSettings/`, or the
`GameLauncher`'s game list — it's not yours. If it's the Vite project or the contents of one
`StreamingAssets/<GameName>/` folder — it is.

Ground truth for the Unity-side contract, if this doc and the code ever disagree:
**`Assets/GoBalanceSDK/Scripts/WebGames/WebGameController.cs`** in the SDK project. Everything
below is this repo's half of a contract that file already defines.

## Phase 1 (agent): prepare the build and land it in the SDK project

1. **New game only** — add the boilerplate below to `index.html` (and the input snippet if
   going analog). A game that already has it carries it forward automatically on every future
   build; that's the entire reason it lives in source instead of being hand-patched into a
   build after the fact (see "Why this doc exists" at the bottom).
2. Confirm the Vite config is compatible — see "Build config requirements" below. Don't build a
   game around `file://` assumptions; the SDK never loads over `file://`.
3. `npm run build`.
4. Copy into `gobalance_bobo_sdk/Assets/StreamingAssets/<GameName>/`:
   - **Delete** the old `assets/*.js` / `assets/*.css` and their `.meta` files first — Vite
     content-hashes filenames on every build, so the new build's filenames won't match the old
     ones and you'll leave stale orphaned duplicates behind if you don't.
   - Copy in the new `dist/index.html` and `dist/assets/*`.
5. **Regenerate `manifest.txt`** — one relative path per line, must exactly match what's
   actually in the folder now (`index.html`, `assets/<hash>.js`, `assets/<hash>.css`, ...).
   Only read on Android (to extract the game out of the compressed APK before serving it — see
   `ExtractStreamingAssets` in `WebGameController.cs`); the Editor, iOS, and macOS/Windows
   standalone all read `StreamingAssets` directly and ignore it — which is exactly why a stale
   manifest can go unnoticed for a long time on whichever platform someone happens to be
   testing on.
6. `gobalance_bobo_sdk` is itself a git repo, and shared — other games' folders under
   `Assets/Games/`, or in-progress `ProjectSettings/` changes, may belong to someone else's
   work in flight. Only stage/commit the paths for the game you're actually shipping.
7. Report back that the build landed. **Do not proceed to Phase 2** — that's not your job (see
   "Who owns what" above).

## Phase 2 (project owner, in Unity): wire it into the SDK

1. Open the Unity Editor and let it focus on the project — this imports whatever new files
   landed in `StreamingAssets` and generates their `.meta` files.
2. **New game only:**
   - Create a scene under `Assets/Games/<GameName>/`.
   - Add a `WebGameController` component to a GameObject in it; set `folderName` to the
     `StreamingAssets` subfolder name, and decide `forwardSteeringKeys` (digital synthetic
     keys vs. analog `window.__gbSensor` — see below).
   - Add the scene to `File > Build Settings`.
   - Open `GoBalanceSDK/Scenes/GamesList`, select `GameLauncher`, add a row (button label +
     scene name).
3. Test. `gree/unity-webview` has no Linux renderer, so the WebView shows an "unsupported"
   message there — test in the macOS/Windows Editor or build to a device (Android/iOS).

## How it actually works

Unity does **not** load a game via `file://`. `WebGameController.cs` spins up a real local
HTTP server (`http://127.0.0.1:809x`, port auto-picked in the 8090-8099 range) serving
`Assets/StreamingAssets/<GameName>/` as the site root, and points a `gree/unity-webview`
WebView at it. This is required, not an optimization — ES module scripts are silently blocked
under `file://`'s null origin, and `.js` needs to be served with the right MIME type, which
`file://` can't do at all. **If a game's build tooling was written assuming `file://` — a
single-file bundle, a script that strips `type="module"`, a `base: './'` config — that
tooling is solving a problem this target doesn't have, and needs to change; see "Build config
requirements" below.**

Every frame, the host:

- Reads the board via `Vector2 tilt = BaseInputManager.Instance.getClampedAngleAsRatio()` —
  the exact same call every SDK game uses. In the Editor this is the keyboard; on-device it's
  the real board. Both resolve through the identical code path.
- Forwards that tilt into the page in **one or both** of two ways, controlled per-game by the
  `forwardSteeringKeys` checkbox on the scene's `WebGameController` component (set by the
  project owner in Phase 2, but the game's own code determines which mode it's compatible
  with):
  - **`forwardSteeringKeys = true` (default):** synthetic `ArrowLeft`/`ArrowRight` (and
    optionally `ArrowUp`/`ArrowDown`) `keydown`/`keyup` `KeyboardEvent`s are dispatched on
    `window`, with hysteresis (press above 0.35 tilt, release below 0.20) so it doesn't
    chatter at the threshold. **An unmodified game that already listens for real arrow-key
    events (keyed on `e.code`, not `e.key`) needs zero code changes** — that's the whole point
    of this mode.
  - **`forwardSteeringKeys = false`:** no synthetic keys. Instead, the raw analog value is
    published as `window.__gbSensor = {x, y}` every frame (~60Hz), and the game must read it
    itself. Use this when you want smooth analog steering instead of a discrete on/off key
    press. **Astro Tunnel uses this mode.**
  - Never build a game that does both — reading `__gbSensor` while `forwardSteeringKeys` is
    also on double-applies the input and the game over-steers. Pick one and tell the project
    owner which mode the game needs for Phase 2.
- Calls `window.__pumpFrames && window.__pumpFrames()`. This one is easy to miss: **WKWebView
  suspends real `requestAnimationFrame` for a WebView that's occluded by Unity's own overlay**,
  so without a shim the game's render loop simply stops. The page must queue `rAF` callbacks
  instead of scheduling them natively and expose `window.__pumpFrames()` to flush that queue —
  Unity becomes the thing driving the frame rate.
- Forwards `Space`/`Enter` `keydown`/`keyup`, and — only while `#gameover-overlay` is visible
  (i.e. doesn't have the `hidden` class) — also synthetically clicks `#restart-button`. This is
  purely for restart; the very first countdown/playable state must be reached on page load
  with no key needed.
- Listens for hardware/Editor **Escape** to return to the games list, independent of the page.
  The in-page Back button is a convenience on top of that, not a replacement for it.

The page, in turn, is expected to:

- Call `window.Unity.call(string)` to report JS errors — there is **no devtools console
  on-device**, so this bridge is the only visibility into a crash. `window.Unity` is
  auto-injected by the `gree/unity-webview` plugin, so it's always safe to guard with
  `if (window.Unity)` and no-ops cleanly in a normal browser.
- Provide a Back button wired to `window.Unity.call('nav:back')`.

## Build config requirements

Vite's default output already satisfies this — a game only needs custom config for reasons
unrelated to the SDK. In particular, undo anything built around `file://`:

- `base: '/'` (Vite's default — don't override it). The local HTTP server serves the game
  folder as `/`, so root-relative asset paths (`/assets/...`) resolve correctly. `base: './'`
  is a `file://`-era workaround and isn't needed here.
- Normal multi-file output: `dist/index.html` + `dist/assets/*.js` + `dist/assets/*.css`, with
  a real `<script type="module" src="/assets/....js">` entry tag. Don't use
  `vite-plugin-singlefile` or a custom IIFE `rollupOptions.output` to inline everything into
  one file, and don't post-process the build to strip `type="module"` — ES modules work fine
  once served over real HTTP, which is all the SDK ever does.

## The exact DOM/JS contract a game must satisfy

- `#gameover-overlay` — toggles a `hidden` class when not shown (Unity checks this exact
  class name before synthetically clicking restart).
- `#restart-button` — inside that overlay, does the actual restart on click. Must be this
  exact id (hyphenated), not e.g. `restartBtn`.
- Real `keydown`/`keyup` listeners keyed on `e.code` (`'ArrowLeft'`, `'ArrowRight'`, `'Space'`,
  `'Enter'`, ...), not `e.key` — if using `forwardSteeringKeys = true`. **Or** a read of
  `window.__gbSensor` if using `forwardSteeringKeys = false`.
- The game auto-starts (or at least reaches its first playable/countdown state) on load,
  without requiring an initial key press.
- `<script type="module">` entry point, root-relative asset paths.

## Boilerplate every game needs (copy verbatim)

**`index.html`** — inside `<head>`, before anything else, and a Back button as the very first
thing in `<body>`:

```html
<head>
  ...
  <script>
    // GoBalance SDK integration — see GOBALANCE_SDK.md for the full contract this depends
    // on. Everything below is a no-op outside the Unity WebView (guarded by
    // `if (window.Unity)` / feature checks), so it's always safe to ship, including when
    // testing in a normal browser.

    // The only channel for JS errors on-device — there's no devtools console inside the
    // WebView, so surface them through the native bridge instead.
    window.addEventListener('error', function (e) {
      if (window.Unity) window.Unity.call('JS ERROR: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
    });
    window.addEventListener('unhandledrejection', function (e) {
      if (window.Unity) window.Unity.call('JS UNHANDLED REJECTION: ' + e.reason);
    });

    // rAF shim: WKWebView treats the occluded Unity overlay as a background tab and
    // suspends requestAnimationFrame entirely. Queue callbacks instead of scheduling them
    // natively; Unity's WebGameController flushes the queue via window.__pumpFrames() every
    // frame (~60Hz) regardless of tab visibility. A real native rAF loop keeps running
    // underneath too, so a normal browser (testing outside Unity) behaves exactly as before.
    (function () {
      var nativeRAF = window.requestAnimationFrame.bind(window);
      window.__rafQueue = [];
      window.requestAnimationFrame = function (cb) { window.__rafQueue.push(cb); return window.__rafQueue.length; };
      window.cancelAnimationFrame = function () {};
      window.__pumpFrames = function () {
        var q = window.__rafQueue;
        if (!q.length) return;
        window.__rafQueue = [];
        var t = performance.now();
        for (var i = 0; i < q.length; i++) {
          try { q[i](t); }
          catch (e) { if (window.Unity) window.Unity.call('RAF CB ERROR: ' + e.message); }
        }
      };
      (function nativeLoop() { nativeRAF(function () { window.__pumpFrames(); nativeLoop(); }); })();
    })();
  </script>
  ...
</head>
<body>
  <!-- GoBalance SDK: native-bridge Back button. Returns to the SDK games list. -->
  <button id="gb-back"
    onclick="if(window.Unity)window.Unity.call('nav:back');"
    style="position:fixed;top:12px;left:12px;z-index:9999;padding:8px 16px;border:none;
           border-radius:999px;background:rgba(20,20,40,0.72);color:#eafcff;
           font:600 15px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;cursor:pointer;
           -webkit-tap-highlight-color:transparent;">&#8249; Back</button>
  ...
</body>
```

**Input code** — only needed if the game will run with `forwardSteeringKeys = false` (analog
mode). Add this wherever movement input is assembled, additively so it composes cleanly with
keyboard/pointer and no-ops in a normal browser:

```js
// GoBalance SDK: the Unity host publishes the balance board's raw analog tilt here every
// frame (~60Hz) whenever the game's WebGameController has forwardSteeringKeys off (this game
// reads the analog value directly instead of via synthetic arrow-key events — see
// GOBALANCE_SDK.md). Purely additive, so it composes cleanly with keyboard/pointer, and is a
// no-op in a normal browser where window.__gbSensor is simply undefined.
const sensor = window.__gbSensor;
if (sensor) {
  x += sensor.x;
  y += sensor.y;
}
```

If instead a game is fine with `forwardSteeringKeys = true` (digital, default), skip this
entirely — as long as it listens for real `keydown`/`keyup` on `ArrowLeft`/`ArrowRight` keyed
on `e.code`, Unity's synthetic key events just work with no game code changes at all.

## Gotchas

- **Stale filenames.** Content hashes change every build. Always delete old `assets/*` + their
  `.meta` before copying in new ones, and always regenerate `manifest.txt` to match.
- **Double input.** `forwardSteeringKeys = true` *and* reading `__gbSensor` in the same game
  applies the tilt twice. Pick exactly one mechanism.
- **`file://` for local testing.** Never use it to sanity-check a production build — ES
  modules are blocked outright. Use `vite preview`, `npx serve dist`, or similar to serve it
  over real HTTP if you want to check the build outside the SDK.
- **`e.key` vs `e.code`.** Unity's synthetic events set `code` (e.g. `'ArrowLeft'`), not a
  physical `key` value that varies by keyboard layout. A game listening on `e.key` won't react
  to them.

## Why this doc exists

Astro Tunnel already had a working build sitting in `StreamingAssets/AstroTunnel` — but every
piece of the contract above (the rAF shim, the `__gbSensor` read, the Unity error bridge, the
Back button) had been hand-patched directly into that one built `index.html` at some point,
and never made it back into this repo's actual Vite source. Every subsequent `npm run build`
silently produced a dist that dropped the entire integration, and swapping it in "almost
worked" — it loaded, but the board didn't steer it and it risked freezing under WKWebView
occlusion. Tracing that back to `WebGameController.cs` line by line is what this doc captures,
so it doesn't have to happen again for the next game.
