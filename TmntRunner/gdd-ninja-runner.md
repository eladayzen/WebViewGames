# Sewer Sprint — Game Design & Technical PRD
### (TMNT-licensed endless runner — Babylon.js / Unity-WebView build)

Draft v1 — for implementation by Claude Code. Full spec, placeholder-art-first.

---

## 0. IP & monetization note (read first)

This is a **licensed TMNT product** — official character names, likenesses, and story elements can be used directly (subject to whatever approval process the license requires for final art/character likeness, which is outside this doc's scope). Character roster below uses the real turtle names. **No in-app purchases of any kind** — currency (coins/pizza) is earned exclusively through play; there is no real-money store, no paid currency packs, no ads-for-currency, nothing. This is a hard constraint, not a v1-only deferral — see §8 and §11.

Even though names are now real, the architectural principle from the original draft still holds and should not be relaxed: theme content (character data, biome art, VO/text referencing specific characters) lives in `/data` and `/assets`, not hardcoded into `/core`, `/track`, `/entities` logic. This keeps the door open for licensor-mandated changes (e.g. a character likeness gets rejected in approval, a biome needs re-theming) without a code rewrite.

---

## 1. Vision

A 3-lane endless runner in the Subway Surfers formula, reskinned to a mutant-turtle-in-the-city theme. Player character auto-runs forward down a procedurally chunked street/sewer/rooftop track, dodging obstacles by switching lanes and jumping, collecting coins and pizza slices, triggering periodic chase sequences with a robotic antagonist, and banking currency toward a character-unlock shop.

Target feel: readable at a glance, fast to reflex-react to, high visual polish (lighting, particle pop, juicy pickup feedback) despite lightweight assets — matching the reference frame's saturated comic-book city look, not a bare-bones prototype look.

Runs inside a Unity WebView, loaded from local bundled files (`file://`), not a remote server. All constraints from the existing web-games tech brief apply (single-bundle IIFE output, no ES modules, no React in the render loop, light payload, boring/broadly-supported APIs). This document assumes that brief as a given and does not repeat its bundling rationale — see "Technical Architecture" for how it's applied here specifically.

---

## 2. Core Loop

1. Player auto-runs forward at a constant (then gradually increasing) speed down one of 3 lanes.
2. Player swipes/taps left-right to change lanes, swipes/taps up (or presses jump) to jump over low obstacles. **No slide** — low-clearance obstacles are jumped, not slid under (confirmed scope: jump only, no slide mechanic, no crouch obstacles in v1).
3. Player collides with obstacles → run ends (or loses shield power-up if active).
4. Player collects coins (currency) and pizza slices (mission/combo currency) floating in lane-shaped or arc patterns.
5. Power-up pickups (shell, magnet, pizza) trigger timed effects.
6. Periodically, a chase sequence triggers: a robot antagonist closes in from behind, track narrows/adds hazards, tension music/UI state changes, player must survive N seconds or perform a dodge action to shake it.
7. Run ends on collision or (future) time-based mission complete. Score = distance + coin value + combo multipliers.
8. Post-run: currency banked, shown against shop (character unlocks, cosmetic skins, permanent power-up upgrades).

---

## 3. Controls

Input for touch/swipe, this project runs in an embedded WebView so touch is primary; keyboard as dev/testing fallback.

- Swipe left / Left arrow → move one lane left
- Swipe right / Right arrow → move one lane right
- Swipe up / tap / Space / Up arrow → jump
- No down-swipe/slide action in v1 (explicitly out of scope)

**Architecture requirement (carried from tech brief):** all input funnels through a single `handleAction(action)` function (`action` ∈ `LANE_LEFT`, `LANE_RIGHT`, `JUMP`). Swipe gesture detection, keyboard listeners, and (future) Bluetooth-gamepad-bridged input from Unity all call into this one function — never scatter raw `pointerdown`/`keydown` handling into gameplay code.

---

## 4. Track & World

### 4.1 Structure
- 3 fixed parallel lanes, fixed lane width, camera follows behind/above player (third-person chase cam, matching reference frame framing).
- Track built from **chunks**: fixed-length segments (e.g. 20–30 world units) pulled from a pool and stitched end-to-end ahead of the player, recycled behind once off-screen (object pooling, not per-chunk instantiation — see Technical Architecture).
- Each chunk is data-defined: which lane(s) have obstacles, obstacle type, coin/pickup arc pattern, whether it's a "chase" chunk variant.
- Difficulty scaling: run speed increases with distance/time (capped), obstacle density increases, chunk variety pool expands as distance milestones are hit.

### 4.2 Biomes (full spec — build in this order)
1. **City street** (v1 / reference image match) — street level, storefronts, crossing trains as a scripted hazard, neon signage.
2. **Rooftops** — gaps between buildings (visual only — obstacles still resolve to the same 3-lane logic, no real platforming/falling), water towers, AC units as obstacles.
3. **Sewer tunnels** — narrower visual space, pipes as obstacles, water/steam VFX, moving on rails/carts as a scripted hazard analogous to the train.
4. Biome is a purely visual/asset re-theme layer — obstacle logic, lane logic, and chunk data schema are biome-agnostic so new biomes are art-and-data additions, not code changes.

### 4.3 Obstacles (v1 set, city biome)
- Static full-lane blocker (barricade, trash pile) → must lane-change.
- Low overhead obstacle (banner, pipe, low sign) → must jump.
- Train (scripted set-piece, multi-lane, fixed timing) → must be in a clear lane when it passes.
- (Sewer/rooftop biomes add reskinned equivalents per 4.2 — same 3 obstacle *behaviors*, new art.)

### 4.4 Collectibles
- **Coin** — primary currency, spawned in lane-shaped arcs/lines to guide movement.
- **Pizza slice** — secondary currency / mission currency, rarer spawn, higher value.
- **Power-up pickups** (icons per reference image bottom bar):
  - **Shell** — timed invincibility, player rolls through obstacles instead of colliding.
  - **Magnet** — timed auto-collect of coins in all 3 lanes within radius.
  - **Pizza (power-up variant)** — score/coin multiplier for a timed window (distinct from the pizza-slice currency pickup — same art asset can double as both if desired, but they are logically separate: one is currency, one is a timed multiplier).

### 4.5 Chase sequences
- Triggered on a distance/time interval (tunable).
- A robot antagonist (per reference image) enters from behind, visually closing distance.
- During a chase: track behaviors escalate (more obstacles, faster required reaction, dedicated chase-only chunk pool), plus a distinct HUD/UI state (chase meter, per reference top-left "CHASE" bar) and audio state change.
- Chase ends after surviving a duration, or (later) via a dodge/special action — v1 can implement pure survive-the-timer, defer any special escape mechanic.

---

## 5. Player Character

- Roster (full spec): Leonardo (blue), Raphael (red), Michelangelo (orange), Donatello (purple) — differentiated cosmetically and by a minor stat difference (no hard pay-to-win-style gates even though there's no real-money purchase involved — differences should stay minor/flavorful, e.g. slightly different starting power-up duration, matching each turtle's established personality: Raphael tougher/more shell-durable, Michelangelo faster pizza-multiplier uptime, Donatello longer magnet range, Leonardo balanced/default). Leonardo is playable/available at project start; the other three unlock via in-run-earned currency only (see §8 — no purchase path exists).
- Animation states needed per character: idle (menu), run (loop), jump (rise/apex/fall), lane-change (bank/lean, can be a blend rather than a full separate clip), hit/death, shell power-up (roll loop), victory/menu pose.
- **Asset pipeline:** placeholder-first. Start with a capsule/blockout mesh driven by the full state machine and animation *system* (even if placeholder anims are just simple procedural transforms or a free rigged mock character), so swapping in a real rigged/animated glTF character later is an asset swap, not a code rewrite. Do not hardcode animation clip names beyond a small enum the real asset must conform to.
- Source real character models as glTF (convert from FBX via Blender/FBX2glTF per the existing tech brief) once placeholder gameplay is validated.

---

## 6. Antagonist / Chase Enemy

- Single Foot Clan combat robot type for v1 chase sequences (per reference image — hulking robot with net/claw; exact naming/design of this robot should go through licensor approval like any other TMNT-branded asset, this doc treats it as a generic "Foot-bot" placeholder concept).
- Needs: chase-loop animation, a "lunge/attack" animation triggered near-catch (used for game-over-by-caught state, distinct from obstacle-collision game over, if you want to distinguish causes of death — optional, can share one game-over state in v1).
- Same placeholder-first asset approach as player character.

---

## 7. HUD / UI

Per reference frame:
- Top-left: chase meter/label (only visible during chase sequences).
- Top-right: running score, coin count.
- Bottom-left: power-up icon tray (shell / pizza / magnet), showing available count or active-timer state.
- Game-over screen: run summary (distance, coins, pizza), revive-with-currency prompt (optional v1, can defer), return-to-menu / retry buttons.
- Shop screen (full spec): currency balance, character roster grid, unlock/select buttons.
- UI is DOM/CSS overlay on top of the Babylon canvas, **not** Babylon GUI or in-canvas rendering — per the existing tech brief's "no React in the render loop" rule, plain DOM+CSS (or a tiny non-framework templating approach) is fine for UI chrome since it's not the real-time game-rendering layer. Keep DOM element count low and static-ish (updated via textContent, not re-created per frame).

---

## 8. Scoring & Economy

- Score = base distance value + coin value + pizza value + any active multiplier from power-ups.
- Currency (coins) persists across runs (needs local persistence — `localStorage` is fine here since this is a normal DOM/browser context inside the WebView, not a Babylon-artifact sandbox restriction).
- Shop: spend in-run-earned currency to unlock new turtles / cosmetic skins. **No IAP, no paid currency, no ads-for-currency, no purchase path of any kind** — this is a firm product constraint, not just a v1 scope cut. There should be no code path, UI screen, or data field anywhere in the economy system that references a real-money transaction. If a "revive with currency" continue prompt is implemented (§7), it must only ever spend earned in-game currency, never trigger a purchase flow.

---

## 9. Technical Architecture (Babylon.js specifics)

### 9.1 Rendering & scene setup
- Single `Engine` + single `Scene`, third-person follow camera (not `ArcRotateCamera` — a scripted follow/chase cam locked to player lane position + fixed offset).
- Lane positions are 3 fixed X-coordinates; player and obstacles snap/lerp between them — do not build free-roam physics movement, this is a lane-slot state machine, not open 3D movement.
- Use Babylon's `AnimationGroup`s for all character animation states — do not hand-roll bone manipulation.

### 9.2 Procedural track via chunk pooling
- Chunk = a parent `TransformNode` containing its obstacle/pickup meshes, defined by a data object (lane occupancy per obstacle slot, pickup pattern, biome tag).
- Maintain a pool of chunk instances; on each chunk fully passing behind the camera, reposition it to the front of the track queue and re-populate from the next data entry, rather than creating/disposing meshes every chunk — this matters for a WebView with constrained memory.
- Obstacle/pickup meshes within chunks should themselves be instanced (`createInstance`) or thin-instanced from a small set of base meshes, not unique meshes per obstacle.

### 9.3 Collision
- Lane-slot + z-distance check (player z vs obstacle z, player lane vs obstacle lane), **not** full physics engine collision. This is a rhythm-timing problem, not a physics simulation — avoid pulling in Babylon's Havok/Cannon physics plugin for v1, it's unnecessary weight and complexity for lane-based hit detection.

### 9.4 Asset & bundle discipline (inherits from existing tech brief)
- Vite + `vite-plugin-singlefile`, `base: './'`, output must be tested via direct `file://` double-click before considering any milestone "done" — do not rely on `vite dev`/`vite preview` alone.
- Babylon.js is heavier than Three.js (~1.4MB vs ~168KB gzipped) — given the "keep payload light" constraint from the tech brief, import only the specific Babylon modules needed (core engine, glTF loader, GUI only if actually used, no physics plugin, no full "babylonjs" umbrella package) rather than the full bundle. Track bundle size at each milestone; flag if it balloons.
- Placeholder art = primitive meshes (capsules, boxes) + free CC0 rigged mock characters if a quick sanity-check of the animation pipeline is needed. Real art = glTF converted from FBX, per existing brief.
- Keep any postprocessing (bloom, glow on neon signage per reference image) behind an easy on/off toggle — same rationale as the tech brief's Three.js addendum: unverified GPU cost on real WebView hardware until tested on-device.

### 9.5 Suggested code structure
```
/src
  /core          - engine/scene bootstrap, game loop, state machine (menu/run/gameover/shop)
  /input         - handleAction() abstraction, swipe/keyboard listeners
  /track         - chunk pool, chunk data definitions per biome, spawn/recycle logic
  /entities      - player controller, obstacle behaviors, pickup behaviors, chase-enemy controller
  /economy       - currency, persistence (localStorage), shop unlock logic
  /ui            - DOM overlay components (HUD, game-over, shop) - plain JS/DOM, no framework
  /data          - biome configs, character roster data, obstacle/pickup definitions (JSON/JS objects)
  /assets        - placeholder meshes/anims now, real glTF later
```
Theme-specific content (turtle roster, pizza/shell naming, biome art) lives entirely under `/data` and `/assets` — `/core`, `/track`, `/entities` should have zero hardcoded theme references, so the IP reskin noted in §0 stays cheap.

---

## 10. Build Milestones (recommended order for Claude Code)

1. **Skeleton**: Babylon scene, single lane runner (no obstacles), fixed camera follow, placeholder capsule player, single-bundle Vite build verified via `file://`.
2. **Lane mechanics**: 3-lane switch + jump, input abstraction wired, placeholder box obstacles, collision → game over.
3. **Chunk pooling**: replace hand-placed obstacles with data-driven chunk pool + recycling.
4. **Collectibles**: coins + pizza + scoring, HUD overlay (score/coins).
5. **Power-ups**: shell/magnet/pizza-multiplier with timed effects + icon tray UI.
6. **Chase sequences**: antagonist entity, chase trigger/timer, chase HUD state, chase-specific chunk variants.
7. **Economy loop**: persistence, game-over screen, shop screen, character unlock (still placeholder art).
8. **Biome #2 + #3 reskins**: prove the data-driven theme layer by adding rooftop/sewer without touching core logic.
9. **Real art pass**: swap placeholder meshes/animations for converted glTF assets; re-verify bundle size and on-device WebView performance.
10. **Polish**: postprocessing toggle, particle/juice pass on pickups and near-misses, audio.

---

## 11. Explicitly Out of Scope (v1)

- Slide/crouch mechanic (confirmed — jump only).
- **Any real-money IAP, store, paid currency, or ad-for-currency integration — permanently out of scope for this product, not just v1** (see §0, §8).
- Bluetooth-gamepad input wiring (architecture supports it later via `handleAction`, not implemented now).
- Physics-based ragdoll/collision response.
- Networked leaderboards/multiplayer.

## 12. Open Questions / Risks

- Licensor approval process: confirm what needs sign-off before ship (character likeness fidelity, Foot-bot design, biome art, UI/HUD styling) and build that checkpoint into the milestone plan in §10 rather than discovering it at the end.
- Real character model source: commissioned, purchased, or AI-generated — affects rig compatibility with the placeholder `AnimationGroup` state enum, and AI-generated TMNT-likeness assets specifically may not be acceptable under a license agreement — confirm before committing to that sourcing path.
- Actual mobile-WebView GPU budget is unverified (per existing tech brief) — chunk pool size, mesh instance counts, and postprocessing all need on-device profiling before locking final numbers, not just desktop-browser testing.
- Chase-sequence "escape" mechanic (special dodge action vs pure survive-timer) — deferred decision, flagged in §4.5.
