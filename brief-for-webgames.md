# Web Minigame Tech Brief (draft, for discussion)

Context for the other Claude: this game will run inside a mobile app, embedded in a native WebView (gree/unity-webview) hosted by a Unity game, loaded from local files bundled with the app (not a remote server, at least initially). It needs to be fast to build. Optimize choices for that specific box, not for "a website."

## Rendering approach — pick one

| Approach | Verdict |
|---|---|
| Canvas 2D via a framework | Recommended for almost everything. |
| Raw hand-written Canvas/WebGL, no framework | Only for something trivially simple (a tap-timing game, single mechanic). Gets painful fast otherwise. |
| DOM/CSS-based (moving `<div>`s) | Fine for very simple/low-sprite-count games (menus, match-3-ish), bad for anything with many moving objects — DOM manipulation is slow, especially on mobile WebView. |
| 3D (Three.js/Babylon.js) | Only if the game genuinely needs 3D. Real mobile-WebView GPU/memory risk — verify perf early if this path is taken, don't assume it'll be fine. |

## Framework — pick one

- **Phaser** — the default recommendation. Mature, huge community/example base, handles rendering (Canvas/WebGL), input, physics, scenes, audio, asset loading all in one. Best fit for "fast 2D game."
- **PixiJS** — lower-level, rendering only (no game-loop/scene/physics scaffolding) — pick this only if Phaser feels like overkill and they want to hand-roll game structure.
- **Kaboom/Kaplay** — simpler/jammier API than Phaser, smaller ecosystem, viable for something very small and quick.
- **Three.js / Babylon.js** — only if 3D is required (see above).

### What NOT to use

- React/Vue/Angular as the game-rendering layer. Wrong tool for a real-time game loop — fine only as a UI shell wrapping a canvas, never for the actual gameplay rendering.
- Exporting a full engine to web (Unity WebGL, Godot HTML5, etc.) just to nest it in this Unity app. Defeats the entire point (not built in Unity), and the payload size/memory footprint is brutal for a WebView embedded inside another app on mobile.
- WASM-heavy game engines/frameworks. Same problem — huge bundle size, slow first-load, works against "fast to build and light."
- Bleeding-edge browser APIs (newest WebGPU features, very recent ES syntax without transpilation). Mobile WebViews often lag behind the latest desktop Chrome/Safari — stick to broadly-supported, boring APIs.

## Build/bundling — the one constraint that actually matters here

- Use a modern bundler — Vite is the easy default and has ready-made Phaser starter templates.
- Output as a single bundled script (IIFE/UMD), not native ES modules with dynamic `import()`. This isn't a style preference — loading local files via `file://` in a mobile WebView breaks fetch/XHR-based module loading (a real, documented WebKit/WebView limitation), and ES modules typically rely on exactly that. A single-file bundle sidesteps the problem entirely for the first prototype, before we build the local-HTTP-server workaround.
- Keep total asset payload light (textures/audio) — this is a WebView inside a native app, not a website with unlimited bandwidth.

## Input — deprioritized per your note, one thing worth doing anyway

Just use the framework's normal input handling (touch/keyboard/mouse — Phaser has this built-in) for now. The one thing worth doing even now: route all input through a single abstraction function (e.g. `handleAction(action)`) rather than scattering `pointerdown`/`keydown` listeners everywhere — so when Bluetooth-gamepad-bridged input arrives from Unity later, it plugs into that same function instead of requiring a rewrite.

## Addendum — lessons from actually shipping a first prototype (verified against a real build, not just theory)

- Vite's default `vite build` does **not** give you the single-bundle output this brief requires, even with zero other config. Building a plain Vite app (no framework, just Three.js in our case) produced `index.html` with `<script type="module" crossorigin src="/assets/index-XXXX.js">`. That's two separate breakages for a `file://` WebView load, not one: (1) it's a real ES module script tag — the exact problem this brief already calls out; and (2) the src path is root-absolute (leading slash), which resolves to the filesystem root under `file://`, not relative to the HTML file — a second, independent failure this brief didn't previously mention. Fix: add the `vite-plugin-singlefile` plugin (inlines all JS/CSS directly into the HTML as one non-module `<script>` block, no separate file fetch at all) and/or set `base: './'` in `vite.config` so any remaining asset paths are relative.
- Critically, neither of those two problems is visible from the normal dev workflow. `npm run dev` and `vite preview` both serve over `http://localhost`, where module loading and absolute paths both work fine — so a build that looks completely working in every normal check can still be silently broken the moment it's actually loaded via `file://` in a WebView. Concrete cheap test: before assuming a Unity WebView will handle a build, just double-click the built `index.html` to open it directly via `file://` in a normal desktop browser. That alone reproduces the failure with no device needed, and should be a standard step before calling a build done.
- 3D via Three.js: GPU/memory cost on a real mobile WebView is still genuinely unverified for us — all testing so far has been a desktop browser, never actual WebView/mobile hardware. Worth being extra cautious about postprocessing effects (we added bloom via a multi-pass `EffectComposer` for visual polish) — that's meaningfully more GPU work than a single forward render and is exactly the kind of addition that can look fine on a desktop GPU and choke on a weaker WebView GPU. Recommend building any such effect behind an easy toggle so it can be dropped as a fallback if real-device testing shows trouble, rather than assuming it'll be fine.
- Concrete payload data point: a Three.js-based prototype (basic scene + postprocessing + game logic, no external art assets) landed at ~560KB minified JS / ~145KB gzipped. Useful reference number when weighing this brief's "keep payload light" guidance against a 3D choice — that's the real cost of invoking the 3D carve-out above, not a hypothetical.
- The single input-abstraction-function advice held up well in practice. The control scheme was rewritten twice, including a complete swap from free 2D joystick movement to a fixed-radius rotate-around-the-tunnel model — and the input layer itself never needed to change at all, only how the game code interpreted the vector it returned. Worth keeping this recommendation exactly as-is.
