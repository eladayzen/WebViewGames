# The Web-Game Bible

How **Sewer Shred** and **Wagon Rampage** were built: the method, the tech, and the rules that
made them work. Written for a fresh Claude session on a new machine that knows nothing about
this project. Read this first, then the root `CLAUDE.md`, then the game's own README.

Written 2026-11-17 by the session that built both games.

---

## 0. The thirty-second version

1. **One game is one Vite + Three.js folder** in the `WebViewGames` repo. It ships as a static
   bundle into a Unity app (GoBalance) that shows it in a WebView.
2. **The player has one input: leaning left or right on a balance board.** There are no
   buttons. Every mechanic has to work with one analog axis.
3. **Measure, don't infer.** Every change is checked in a headless, **muted** Chrome that
   drives the game, takes screenshots and prints numbers. Nothing is "done" until a tool has
   shown it.
4. **Build in small, playable steps.** Elad plays every version and replies in one line. Act
   on the feedback right away, decide the small things yourself, and report short.
5. **Ship only what can be rebuilt from `origin/all-games`.** Use the hash check, the
   `manifest.txt` and the `.meta` pairing check. Never commit in the Unity repo.

---

## 1. The setting

### Who you work with

- **Elad** (product owner and designer) plays the build in a browser and on the device. He
  writes short, fast messages, often with typos. Read for intent, not for the exact words.
  "the donny ability feels bad" means: look at it, find what's weak, and fix it with
  something you can see.
- He sends new requests **mid-task**. Finish or park what you're doing cleanly, then pick
  up the new one. Keep a running list so nothing he asked for gets lost.
- He wants **decisions, not questions**. For routine choices (a number, a layout, a colour,
  which of two reasonable approaches), pick the best one, do it, and say in one line what you
  picked. Ask only when the answer really changes the outcome and you can't find it out
  yourself.
- Other Claude sessions run on the same machine. They share the repo, the git stash and
  sometimes the Unity project. One of them is the **gobalance session** (shows up as
  `eladayzen-04`, once known as "Remote config"). It owns the Unity side: scenes, lobby tiles,
  commits and pushes there.

### The repos

| Path | What | Rules |
| --- | --- | --- |
| `~/UnityProjects/WebViewGames` | All the web games, one folder each | Branch from and land on **`all-games`**. Work in your **own worktree** (`.claude/worktrees/<name>`). Commit or push only when asked in that message. |
| `~/UnityProjects/gobalance` | The Unity app that hosts the games | **Never commit here.** Copy the build into `Assets/StreamingAssets/<Game>/` and stop. The gobalance session commits. Pushing is Elad's call, said directly to that session. |

The root `CLAUDE.md` in WebViewGames is law. It explains **why** each shipping rule exists
(each one is a real incident). Read it before any ship.

### A new machine needs

- Node (v24 worked) and npm. Each game runs `npm install` on its own.
- **Google Chrome** at `/Applications/Google Chrome.app`. The tools use `puppeteer-core`
  pointed at it; there's no bundled Chromium.
- Python 3 with Pillow, for the asset scripts.
- The **Kolbo MCP** connected, for generating art and music.
- The Unity project checked out at `~/UnityProjects/gobalance` if you're going to ship.

---

## 2. The platform contract (GoBalance)

The full contract is in `GOBALANCE_SDK.md` and `GOBALANCE_APP_INTEGRATION.md`. These are the
parts that shape how a game is designed.

- **Input is one analog axis.** The Unity host writes the board's tilt to
  `window.__gbSensor.x` every frame (positive = lean right). The game's Unity
  `WebGameController` must have **`forwardSteeringKeys` OFF** for the analog value to arrive.
  - Read the sensor, keyboard (arrows / A-D) and pointer-drag **all at once and add them
    up**. The same build then works on the device and in a browser with nothing to switch.
  - Give the sensor a small dead zone (0.06) and a gain (1.6).
  - `__gbSensor.y` exists but forward/back lean is uncomfortable on the board. Build the core
    loop on **left/right only**, and prefer free, continuous movement over snapping lanes.
- **Ship the boilerplate in `index.html`** (copy it from an existing game, don't retype it):
  - the error forwarder to `window.Unity.call` (there's no console on the device);
  - the **rAF shim**: WKWebView suspends `requestAnimationFrame` behind the Unity overlay, so
    callbacks are queued and Unity pumps them through `window.__pumpFrames()`;
  - the **Back button** (`#gb-back`, which calls `Unity.call('nav:back')`).
- **Vite config:** `base: '/'`, a normal multi-file module build, `assetsInlineLimit: 0`. The
  game is served over http from StreamingAssets, never from `file://`.
- **The folder name is forever.** The StreamingAssets folder name also becomes the save key
  and the Firestore document id (`WagonRampage` → `web_wagon_rampage`). Settle the final name
  with Elad **before the first ship**. Renaming later loses everyone's progress.
- **Lobby tile:** 600x680 RGBA PNG with square corners (Unity rounds them). It goes in
  `gobalance/Assets/GoBalance/App/MainMenu/Sprites/NewDesign/new games/` and is named like the
  others ("TMNT Wagon Rampage.png"). The gobalance session imports and wires it.

---

## 3. The tech stack and why

| Choice | Why |
| --- | --- |
| **Three.js** (0.185) | Full control of camera, shaders and post. Both games are 3D chase games where the camera *is* the feel. |
| **Vite 6** | Fast dev server, hashed production build, and nothing else to learn. |
| **Plain ES modules, no framework** | The game is one render loop. UI is a few DOM overlays styled with CSS. React would only add weight. |
| **DOM for UI, WebGL for the world** | Text, speech bubbles, cards and banners are HTML/CSS: crisp at every size, easy to animate, and free to scale with one CSS variable. |
| **lil-gui dev panel** | Tune the look live. It only appears on localhost or with `?dev=1`, so it never reaches the WebView. |
| **puppeteer-core + system Chrome** | The test harness. See section 5. |
| **Kolbo MCP** | Generated art (textures, comic backgrounds, lobby tiles, concept frames) and music (Suno). |

**The file layout that worked** (Wagon Rampage; Sewer Shred has the same shape):

```
<Game>/
  index.html          GoBalance boilerplate + every DOM overlay (HUD, story, popups, end page)
  vite.config.js      base '/', port pinned (8155)
  src/main.js         game state, levels, the loop, powers, HUD; window.__game test hooks
  src/world.js        the space: road/pipe coordinates, generation, frames (s,u) -> world
  src/cars.js         an entity class (pose, wheels, roll, looks); Sewer Shred: player.js / obstacles.js
  src/story.js        scenes, unlock moments, in-level popups (DOM)
  src/fx.js           particles, sparks, trails
  src/audio.js        WebAudio: music + synthesized or generated SFX
  src/input.js        sensor + keys + drag -> lean in [-1, 1]
  src/devpanel.js     lil-gui (dev only)
  src/style.css       everything visual in DOM, plus the screen-scaling variable
  public/             models, textures, story art, UI icons, audio
  tools/              the test and asset scripts (they ARE part of the game)
  README.md           how it plays, how it's built, the traps, the tools table
```

`main.js` grew to about 2,700 lines. That was fine for a prototype because every system is a
named block with a **tuning object at the top** (`DON`, `BOSS`, `APRIL`, `SAW`, `NITRO`,
`LEVELS`…). When Elad says "slower" or "bigger", you change one number in one place.

---

## 4. The core technical ideas

### 4.1 A curvilinear coordinate system for everything

This is the most important architectural decision in both games.

- **Sewer Shred:** everything lives in tube coordinates **(s, θ)**: distance down the pipe
  and angle around the wall. `frameAt(s)` turns that into world space. The pipe's centreline
  is a sum of slow sines, so it winds and always reads as going downhill.
- **Wagon Rampage:** everything lives in road coordinates **(s, u)**: metres along the route
  and metres right of the centre line. The route is a chain of pieces (straights, arcs,
  Y-forks). `pointAt(s, u)`, `frameAt(s)` and `yawAt(s)` are the only functions that know
  the road bends.

Why it matters:
- Gameplay code is one-dimensional and simple: "spawn 90 m ahead in lane 3", "is it within
  2 m sideways", "hover 5 m in front of the wagon".
- Collisions are cheap: compare s and u.
- The world can bend, fork and wind without touching gameplay code.
- Branches before a choice, cars that went the other way, and a blended pose through a
  junction are all just different answers from the pose function.

### 4.2 Endless, recycled worlds

- Build the world in chunks ahead of the player (`SEG` metres at a time, at most a few chunks
  per frame so there's no hitch) and drop chunks behind.
- A fork builds **both** branches before the choice so the player can see them. The chosen
  one is *promoted*: same pieces, same meshes, nothing rebuilt, nothing pops. The other is
  dropped later.
- Fog that blends into the sky colour hides the far end. If you change the sky without the fog,
  buildings start popping in at the horizon.

### 4.3 Feel comes from physics with one axis

- **Lean is a force, not a position** (Sewer Shred): lean accelerates you around the pipe and
  gravity pulls you back to the floor, so the pipe behaves like an endless half-pipe. Holding
  high on the wall costs effort; neutral is restful. That's the whole skill.
- **Lean is lateral speed with a ramp** (Wagon Rampage): keys ramp in over about 0.15 s, so
  a tap is a nudge and a hold is a full lean.
- **Forward speed is not the player's.** The wagon holds its pace (clamped between 0.72 and
  1.08 of cruise speed). Design every encounter around that: the boss had to get **run** and
  **attack** phases because a wagon that can't speed up could never catch it.

### 4.4 Readability tricks that came out of measuring

- **Make enemies glow** against a night scene: a fresnel rim injected with `onBeforeCompile`,
  plus a little self-glow. The first "they're not seen enough" came from dark cars on a dark
  road.
- **Show the important thing in front of the camera.** Donnie's lifted car hovers 5 m ahead
  at 6.2 m height, about 106 px wide on screen. The first version was correct in code and
  invisible on screen.
- **Particles inherit the vehicle's speed.** A spark spawned at rest is behind the camera
  within a third of a second.
- **Wheels on single-mesh models:** fit spinning covers over the tyres (found from contact
  patches) and cap the spin at about 2.5 turns/s. The true rate strobes at 60 fps and looks
  frozen.
- **Body roll as a spring**, growing with how hard and how long you turn, gives weight with no
  animation work.
- **Icons drawn after post-processing** keep their exact colours.
- **UI scales with the screen through one CSS variable** (`--s`, set by media queries on
  height: 1 on a laptop, down to 0.56 on a short landscape phone). Every HUD element zooms by
  it. Measure how much of the screen a banner covers at 1280x720 and 844x390 (the
  follow-April banner: 3.8% and 1.5%).

### 4.5 Animation from Mixamo without an animator

- One rigged character (`raphael.glb`, Mixamo bone names) plus clips pulled from Mixamo FBXs
  with a Node script (`SewerShred/tools/extract-clips.mjs`). It keeps the bone rotations and
  only the hips' **vertical** motion, because forward root motion would fight the game's own
  steering.
- **Use part of a clip.** Measure where the interesting frame is
  (`kick-timing.mjs`, `clip-pose.mjs`), enter just before it, speed up into it, and hand off
  in the direction the body is already spinning, so the blend doesn't unwind the short way.
- **Recolour one rig into several characters** (Raph → Mikey and Donnie, with
  `recolor-turtle.py`). Freeze a pose found by a probe script for characters that only need to
  stand in a hatch.

### 4.6 Post and look

- Use an `EffectComposer` with a small-resolution bloom (256x256 is enough and cheap) plus a
  grade pass (exposure, speed blur), ACES tone mapping, and pixel ratio capped at 1.75.
- **Stop rendering 3D while a full-screen comic page covers it.** It saves battery and frames
  on the device.
- Keep the look values in **presets** in the dev panel ("Copy values (JSON)" → Elad sends them
  → bake them in as defaults).

---

## 5. The method: measure, don't infer

This is the habit that made the difference. Code that "should" work very often doesn't on
screen.

### 5.1 The harness

- Build with `npm run build`, then keep `npx vite preview` (port pinned in `vite.config.js`)
  running **in the background** for the whole session.
- Each check is a small `tools/<name>.mjs` script:
  - launch **headless Chrome with `--mute-audio`** (always: Elad hears unmuted headless
    audio and can't close it), plus `--use-angle=metal` for real GPU rendering;
  - open `index.html?auto=1&level=N`;
  - wait for `window.__game.G.state === 'play'`;
  - poke the game through `window.__game` (spawn a wave, force a power, set god mode, jump to
    a level);
  - wait for the moment you care about, **screenshot it**, and **print numbers** as one JSON
    line;
  - collect `pageerror`s and print them. Zero errors is part of every pass.
- Wagon Rampage ended up with about 40 tools. Write a new one whenever you build a feature.
  Each one is reusable for regression later.

### 5.2 The game has to be testable

- **`?auto=1` autopilot** steers toward Foot cars and pickups, follows April at forks (or
  deliberately takes the wrong fork with `window.__wrongFork`), and skips the talking scenes.
  Every level can then be played end to end headless: "L3 cleared in 71 s, 5 forks, April on
  93 HP".
- **`window.__game`** exposes state and hooks: `G`, `player`, `enemies`, `orbs`, `path`,
  `world`, `spawnWave`, `startLevel`, `liftStep`, and so on.
- **`?level=N`** to start anywhere. God mode and `__noOrbs` to isolate a system.
- **Dev hotkeys** (Z X C V B G N H) summon a power without its pickup.

### 5.3 What to measure

| Instead of assuming… | …measure |
| --- | --- |
| "the car is visible" | its on-screen size in pixels at the key moment |
| "the transition is smooth" | the biggest per-frame jump in world position and yaw around it (the fork lock: 0.16 m / 0.04 rad, same as steering) |
| "the UI fits" | its bounding box and % of screen at a laptop and a phone size, plus overlaps with other elements |
| "the level is balanced" | autopilot clear time, HP left, wrecks, shots fired vs hit |
| "the warning comes before the loss" | the timestamps of both |
| "the new power is presented" | when its pickup spawns, when it's taken, what line played |
| "the shipped bundle has the change" | a byte diff of the whole `dist/`, and grepping for strings that survive minification (UI text, DOM ids), never numbers (`20000` becomes `2e4`) |

**Look at the screenshots yourself** (open the JPG). Make a contact sheet with Pillow when
there are five frames to compare. Several real bugs were only visible in a picture:
- the title overlapping the turn sign;
- a car rendering at 70000x scale after mesh quantization;
- a lifted car that was too dark to see.

### 5.4 When a number surprises you

Find the cause before changing anything. Two examples:
- **A 0.4 m jump at the fork lock.** Logging the frames around it showed the eased offset was
  only applied on the *next* frame. One line fixed it.
- **Leo one-shotting the boss.** Leo's katana wrecks any car instantly, and that rule had
  never been told about bosses. It now does 250 damage to the boss.

---

## 6. Game design principles that worked

1. **Feel first, content second.** Sewer Shred spent its first day on the lean physics and the
   kick timing. Wagon Rampage started with ramming, grinding, roll and sparks before any
   level existed.
2. **Make powers you can see.** Every power has an entrance (a turtle rises from the
   roof hatch, saws swing out and lock), a clear action and an exit. "Donnie lifts a car with
   lightning, holds it in front of you, drops it on another car" beats "Donnie does damage".
   **One target at a time, finished before the next**, so it reads.
3. **Show it, then let them use it.** A newly unlocked power gets:
   - a moment on the start screen (burst, art, name, what it does, then the icon flies into
     its slot on the card);
   - its pickup first in the level, in your lane, with an arrow;
   - the brother calling it, and a missed pickup coming straight back;
   - one line on how it works once it's taken.
4. **Unlocks add, never replace.** Level N's pickup pool is everything before it plus the new
   one, dealt from a shuffled bag so every power comes up each round.
5. **Tutorials gate on doing, not on time.** Level 1 can't end until both starting powers
   have been taken. The missing one keeps respawning in your lane with an arrow over it.
6. **Enemies must be felt.** Arriving one by one and dying instantly feels empty. **Waves** of
   three work better: alternate "roar past from behind" with "slow ones ahead you close in
   on".
7. **Fail in a way the player saw coming.** Losing April only ends the level after you have
   watched her drive off down the other road and Raph has warned you. A fail restarts **the
   same level**, without the talking scene.
8. **Choices are spatial and read late.** At a fork, the side of the painted divider you're on
   at its tip is the road you take. The road, camera and April already follow your side
   before the lock, so the lock moves nothing.
9. **Every level has a one-line story and a different verb.** Joy ride (wreck), pick up Leo
   (wreck on the way), save April (escort, follow forks), they're on our tail (chase from
   behind), boss run (hunt one target with phases), Technodrome (distance under pressure).
   Most of them reuse the same systems with different settings.
10. **Comic presentation for anything static.** Start and end pages are comic pages on a
    generated background (not the 3D chase), with speakers slamming in, typewriter bubbles,
    halftone and ink strokes. In-level popups use the same style, smaller.

---

## 7. Art and assets

- **Elad's material comes first.** His renders, scripts and models live under
  `~/Documents/TMNT/…` and `~/Documents/3d/…` (not in the repo). Process them with a script
  in `tools/` (trim, crop, resize to WebP) so they can be rebuilt.
- **Kolbo for generated art. Use it wisely: few calls, explicit models, check the result.**
  Load the `kolbo-mcp-basics` skill first. Key points:
  - pass a `model` explicitly (`nano-banana-pro`, `gpt-image-2`; edits via
    `nano-banana-pro/edit`);
  - reference images must be URLs (upload local files first);
  - `edit_image removebg` has been broken: ask for a plain white background and key it out
    locally;
  - `generate_music` returns two variations.
- **3D surfaces need real illustrated textures** (Kolbo), not procedural canvas patterns.
- **Asset diet before shipping:**
  - keep only the animation clips that are played, rounded to 4 decimals;
  - WebP for icons and story art, JPEG re-encode for textures;
  - delete unused files.
- **Don't quantize the GLBs yet.** Quantizing them made the cars render at the wrong scale
  (invisible), and it's disabled in `optimize-assets.py`. If you try again, verify on screen.
- **Track provenance.** Every drop's message to the gobalance session states where any new
  art came from. The licence log is `gobalance/Assets/GoBalance/ASSET_LICENCES.md`. We're at
  the prototype stage, so it's a log of OPEN rows, not clearances. `raphael.glb`, the Mixamo
  clips and the TMNT marks are OPEN.

---

## 8. Shipping (the exact procedure)

From the root `CLAUDE.md`. Each step exists because skipping it broke something live once.

1. Work on your branch in your worktree, based on `origin/all-games`.
2. When Elad says ship: commit, pull, and **push to `all-games`**.
3. Rebuild from a **clean `git archive` of `origin/all-games`**, not your worktree. A dirty
   worktree always matches itself.
4. **Byte-diff the whole `dist/`** (clean vs yours), not only the hashed JS. `index.html` and
   `manifest.txt` aren't hashed. Note the entry chunk name (`index-XXXX.js`).
5. Land it with `WagonRampage/tools/ship-gobalance.py <clean dist> <gobalance>/Assets/StreamingAssets/<Game>`.
   It copies the files, sweeps stale ones and their `.meta`s, writes `manifest.txt`
   (`index.html` first, then sorted, without the `.meta`s), writes Unity `.meta` files with
   **trailing spaces** (keeping existing GUIDs), and checks pairing **in both directions**.
   Expect "bare 0 orphan 0". Copy this script for new games.
6. **Don't commit in gobalance.** Send the gobalance session a short heads-up: what changed,
   the exact file diff, the entry chunk hash, and where any new art came from. It commits.
   Pushing (and the CI build) is Elad's word, given to that session directly.
7. Verify on the device by behaviour (strings in the bundle, the game actually running).
   `manifest.txt` missing only fails on Android.

---

## 9. Working style that Elad responded to

- **Short status, every few minutes, in plain words.** "The choice is now read where the
  divider ends; holding one side works with no jump. Smoothing the last case."
- **Reports lead with what he can see and play**, then the numbers, then what isn't done or
  is uncertain (for example "the boss run finished with 17 shell vs 51 last time; one sample").
  Never claim more than you measured.
- **Keep the README current as you go.** It's written for the next person: how it plays, the
  tuning objects, the traps ("the sky colour isn't in the dev panel because…"), the tools
  table, and asset provenance.
- **Save what's non-obvious to memory** (`~/.claude/projects/<repo>/memory/`): people,
  session names, contracts, decisions. Not code facts the repo already holds.
- **Don't stop to ask about small things. Do stop before anything outward or irreversible:**
  commits, pushes, messages to other sessions that change their work, deleting.
- When you are refused (a permission or classifier block), don't work around it. Pick the
  safe alternative and tell him. Example: the comic font install was blocked, so the
  lettering uses Impact with ink strokes, and that's written in the README.

---

## 10. Mistakes that cost time (don't repeat them)

| Mistake | Lesson |
| --- | --- |
| Quantized GLBs, cars vanished | Every optimization gets a screenshot check before it's kept |
| A held car correct in code, invisible on screen | Measure on-screen size; place things in front of the camera |
| A boss the wagon could never reach | Check the player's own limits (fixed speed) against the encounter |
| Warning and failure firing in the same frame | Log timestamps of related events and space them out |
| A hint cleared by an unrelated system | When two systems write the same UI element, decide which one wins and write it down |
| A big banner covering the road on phones | Test at a phone size (844x390) every time UI changes |
| Level 2 showing only Leo | Re-run the pickup mix tool after any change to pickups |
| Guessed hashes in a heads-up message | Only report values you just verified. The classifier blocked the guessed version, and it was right to |
| Heredocs and chained git commands refused by the worktree guard | Split them into separate calls; put patch scripts in the scratchpad |
| Pose jump when a fork locks | Hand over with the same position (convert u) and ease any leftover offset, applied on the same frame |

---

## 11. Starting a new game: checklist

1. Read the root `CLAUDE.md`, `GOBALANCE_SDK.md`, this file, and the latest game's README.
2. Make a worktree from `origin/all-games`, and a new folder named with the **final shipped
   name** (confirm it with Elad first).
3. Copy from Wagon Rampage: `vite.config.js` (change the port), the `index.html` boilerplate,
   `input.js`, `devpanel.js`, `tools/drive.mjs` style harness, and `ship-gobalance.py`.
4. Decide the coordinate system (section 4.1) before writing gameplay.
5. Get the one-axis feel right first and have Elad play it in a browser.
6. Add `?auto=1`, `?level=N` and `window.__game` from day one.
7. For every feature: build, write a tool, screenshot and measure, update the README, report.
8. Ship by section 8 when asked, with the tile and a provenance note.

---

## 12. Where to look

| What | Where |
| --- | --- |
| Shipping rules and their history | `WebViewGames/CLAUDE.md` |
| Platform contract | `GOBALANCE_SDK.md`, `GOBALANCE_APP_INTEGRATION.md` |
| Kolbo asset pipeline | `KOLBO_ASSET_PIPELINE.md` and the `kolbo-mcp-basics` skill |
| Wagon Rampage (6 levels, powers, forks, story, tools) | `WagonRampage/README.md` |
| Sewer Shred (tube coordinates, lean physics, Mixamo clips) | `SewerShred/src/track.js`, `player.js`, `tools/extract-clips.mjs`; the commit messages `3cb0f27` and `04d3554` |
| Lessons across all the web games | `WEB_MINIGAME_TECH_RETROSPECTIVE.md`, `PERF_FINDINGS.md` |
| Licence log | `gobalance/Assets/GoBalance/ASSET_LICENCES.md` |
