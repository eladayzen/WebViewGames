# Wagon Rampage

A GoBalance web-game prototype. The TMNT Party Wagon chases the Foot Clan through night-time
New York and wrecks their cars. The board steers by leaning left and right; there are no
buttons.

Three.js 0.185 and Vite 6. **Shipping:** landed in gobalance
`Assets/StreamingAssets/WagonRampage/` (first drop 2026-11-17). The gobalance session
(eladayzen-04) wires the scene and lobby tile (`lobby/TMNT Wagon Rampage.png`, 600x680) and
commits. To re-ship: commit and push to all-games, build a clean `git archive` of
origin/all-games, byte-diff it against your build, then
`python3 tools/ship-gobalance.py <clean dist> ~/UnityProjects/gobalance/Assets/StreamingAssets/WagonRampage`
(root `CLAUDE.md` has the why).

## Run

```
npm install
npm run build && npx vite preview      # http://127.0.0.1:8155/index.html
```

- **Input:** in a browser, the arrow keys or A/D stand in for the board, and so does
  click-dragging on the canvas.
- **On the device:** the game reads the analog `window.__gbSensor.x`, so its Unity
  `WebGameController` needs **forwardSteeringKeys off**.
- **Autopilot:** `?auto=1` turns on an autopilot that hunts Foot cars and follows April at forks.
  It also skips the talking scenes. The headless test tools use it.
- **Level:** `?level=2` starts at level 2.
- **Dev panel:** `?dev=1` shows it. It also shows on its own on localhost and 127.0.0.1; see
  [Dev panel](#dev-panel).

## The loop: six levels

`LEVELS` in `src/main.js`. Each level opens with the brothers talking (full-body art, speech
bubbles, tap or wait to advance), then a title card with the objective. A win plays the
outro line and offers NEXT LEVEL; a fail shows why and TRY AGAIN restarts **that same level**,
without the talking scene. After level 6, PLAY AGAIN goes back to level 1 with the story.

| Level | Goal | Unlocks | Fails on |
| --- | --- | --- | --- |
| **1 JOY RIDE** (100 s) | Wreck 10 Foot cars (the tutorial; waves) | Starts with Raph and Mikey | Time up, or the wagon's shell runs out |
| **2 PICK UP LEO** (100 s) | Leo heard we're in trouble: wreck 12 on the way to pick him up (waves) | Leo | Time up, or the shell |
| **3 SAVE APRIL** (70 s) | Keep April's van alive until the timer ends, following her at every fork | Donnie | April's van destroyed, losing her at a fork, or the shell |
| **4 ON OUR TAIL** (90 s) | They're chasing us: wreck 12. Every car comes from behind, fast and aggressive | Saw blades | Time up, or the shell |
| **5 BOSS RUN** (100 s) | Wreck the Foot boss (a big red truck, 1100 hp) | Nitro | He gets away (time), or the shell |
| **6 TECHNODROME** (95 s) | Reach the Technodrome, 3400 m, through waves of Foot | (everything) | Too slow (time), or the shell |

**Powers by level:** `LEVELS[].powers` is the pickup pool: everything from earlier levels
plus the one this level unlocks (`unlock`). The title card lists them all and tags the new one
NEW!. Before the card, a new power gets its own **unlock moment**
(`unlockMoment` in `story.js`; art and one-liners in `UNLOCK_SHOW` in `main.js`): spinning
burst in its colour, NEW POWER UNLOCKED!, the brother's full-body art and icon (or just the
icon for a gadget), its name and what it does; tap or wait, then the icon flies into its
chip on the card. Pickups are dealt from a shuffled bag of the pool, so every power comes up each round,
with the new one first. Pickups keep coming while Leo is held, and a held Leo also goes for
cars behind after 6 s. Riot shield and harpoon are built but not in any level.

**Level 1 must teach both starting powers:** until Raph's and Mikey's pickups have each been
taken, the next pickup is the missing one, placed in the wagon's lane with a bobbing arrow over
it. A missed one comes back 1.2 s later, and the level can't end until both are taken.

**Waves** (`spawnWave`): levels 1 and 2 (`waves: true`) run on waves only, 3 Foot cars at a time, a new wave when at
most one is left. They alternate: **pass** (they roar up from behind and past the wagon to
sit ahead) and **ahead** (already far up the road and slower, so you close in on them).
Level 6 mixes waves in too. Trucks join from the third wave.

**The boss** (`BOSS`, `bossAI`): a Foot truck scaled 1.35x, painted red, with a FOOT BOSS
tag and health bar. It alternates **run** (4.5 s, weaving 22-40 m ahead and shooting) and
**attack** (5.5 s, drops back alongside and swings into the wagon). The wagon can't speed up,
so the attack is the window to ram and grind it. Leo's katana does 250 to it instead of the
usual instant wreck, and Donnie can't lift it but can drop cars on it.

**Level 1 is the tutorial** (`levelScript`, `L1`):
- An empty street first. At 5 s two Foot cars come up from behind, with Donnie's and Leo's lines.
- At 12.5 s a Raph pickup is placed in the wagon's lane, with Donnie's line and a hint.
- 300 m before the first fork, Mikey says to pick a way and a hint says to lean. The first
  straight is 1400 m long (`firstLen`), so the lessons come one at a time.

**Level 3, April** (`APRIL`, `updateApril`):
- Her van is the Foot truck without its cannon, painted blue (`Car` with `friendly`). It drives
  18-30 m ahead of the wagon, always less than the fork lock-in distance, so the player
  chooses before she reaches the fork.
- 270 m before each fork she picks a side, moves over and blinks. A big caption says
  "APRIL IS TURNING / RIGHT ▶ / FOLLOW HER!", a giant arrow pulses on that side of the
  screen, and her van's tag gets the arrow too.
- Take the other fork and nothing happens at the fork itself: she drives off down hers
  (`forkPoint` in `world.js`) and you watch her go. At 12 m apart Raph says she went the
  other way; at 45 m, or after 1 s off screen, it's "WE LOST APRIL!" and the level fails
  (about 3 s after the fork, measured). Tuning: `APRIL.warnAt / lostAt / offFor`.
- Foot cars shoot at her now and then: one car lines up on her at a time, at most one shot
  every 3.2 s, 7 damage. The wagon can block them by being in the way.
- A tag over her van shows her health.

**The look:** the scenes and the end-of-level page are comic pages. They sit on two static
comic backgrounds made with Kolbo (`public/story/bg_night.webp` for intros and fails,
`bg_win.webp` for wins), with halftone dots and a panel frame. The 3D view isn't drawn or
updated while a page covers it. Speakers slam in on a burst of their colour, lines letter
themselves into ink-outlined bubbles, and the title card sits on a starburst. In-level
popups, hints and April's caption use the same comic style. The lettering is Impact with ink
strokes; a real comic font (Bangers, via npm) wasn't installed.

**Story text and art:** the lines are from Elad's script
(`~/Documents/TMNT/TMNT MM Full body/wagonPrototype/script.rtf`), with typos fixed.
`tools/make-story-art.py` trims each render, saves a 720 px WebP for the scenes and a 192 px
head crop for the in-level popups (`public/story/`, about 420 KB in total). `src/story.js`
plays the scenes and the popups.

## The run

The wagon drives itself forward and leaning steers it sideways.

| You do | What happens |
| --- | --- |
| Ram a car sideways | Damage grows with your closing speed. Pin it against the road edge for **WALLED!** |
| Hold the lean into a car | You grind it down (**GRINDED!**) |
| Rear-end a car | Damage grows with the speed difference |
| Drive onto the sidewalk | Allowed up to just short of the building fronts. The curb gives a bump; Foot cars stay on the road |
| Press into the buildings | You scrape them: sparks and dust off the rear corner, and a little lost speed |

**Foot cars:**
- There are two kinds (`KINDS` in `src/cars.js`): the small car (120 hp) and the truck (210 hp).
- Each has a twin roof cannon in the car's own paint. It tracks the wagon all the time.
- For 0.9 s before it fires, the muzzles glow and a laser sight locks onto the wagon.
- It then fires a pair of glowing balls through the air at where the wagon **was** when it
  fired, so moving out of the laser line dodges the shot.
- A car only fires from 14–70 m ahead, and never while you're touching it (`SHOT` in
  `src/main.js`).

**Your shell (health):** each hit costs 9 from a small car and 14 from a truck. Every wreck
gives 4 back.

## Pickups: two slots

Pickups float in the lanes. There are two independent slots, so a turtle power and a gadget
can run at the same time.

- **Back doors of the van:** the power roundel is always there, black until a power runs. While
  a gadget runs it splits into two, turtle on the left and gadget on the right.
- **On screen:** each slot has its own ring and timer.

### Turtle slot (`BUFFS` and Leo's strike in `src/main.js`)

Raph, Mikey and Donnie come up out of the roof hatch: its yellow lid slides open and the turtle
rises out of the black opening. When the power ends he sinks back down and the lid closes.

| Turtle | Power | What it does |
| --- | --- | --- |
| **Leo** | Katana strike. Held until it's worth using | Fires once 2 or more Foot cars are in reach, or 1 after waiting 6 s. Leo jumps from the hatch to the toughest car first and chains through up to 3 cars while the world slows to 0.12×. Blue trails come off his twin katanas, and each cut leaves crossed crescents of light. |
| **Raph** | SAI STORM, 8 s | Stands in the hatch throwing sais in straight lines. He turns his body to face the car, allowing for how the throw animation twists him. |
| **Mikey** | PIZZA CANNON, 8 s | Fires homing pizzas from a pizza gatling on his shoulder |
| **Donnie** | THUNDER STAFF, 7.5 s | He swings his bo staff (Raph's overhead throw clip a7). At the bottom of the swing a bolt from the staff's tip grabs the nearest Foot car. It rises and **hovers in front of the wagon** for 1.3 s, glowing electric purple, with Donnie holding it on a live bolt and turning to keep it in front of him. Then it drops: onto a Foot car under it (**CRUSHED!**: the thrown car is wrecked, the other takes 95), or onto the road in front of you (**SLAMMED!**, 90). One car at a time: no new swing until it's down, and the power doesn't run out while he holds one. The staff also destroys incoming shells. Tuning: `DON`. |

### Gadget slot (`GADGETS` in `src/main.js`)

These are add-ons bolted onto the van. Each has its own deploy and retract animation.

| Gadget | Duration | What it does | Tuning |
| --- | --- | --- | --- |
| **SAW BLADES** | 8 s | Steel decks slide out from under the chassis, the blades swing up and lock, then spin. They do 150 damage per second to anything alongside, and throw big sparks off the buildings. | `SAW` |
| **RIOT SHIELD** | 8 s | An armour skirt rises from the road around the van. You take no damage and can't be knocked back, and Foot shells bounce back at whoever fired them (45 damage). | `bounceShot` |
| **NITRO** | 5 s | Exhaust pipes extend with blue flame jets. The wagon goes 16 m/s faster, rams hit 3× as hard, it can't be knocked back, and the flames torch cars close behind. | `NITRO` |
| **HARPOON** | 9 s | A roof launcher hooks the nearest car ahead and reels it in to 7.5 m. The car swings like a pendulum against your lean, smashing into other cars (**FLAILED!**) and the road edge (**SLAMMED!**). When it wrecks, the harpoon grabs the next one. | `HARP` |

**Pickup mix:** pickups are drawn evenly from 8 kinds, and never the same kind twice in a row.
So each turtle comes up less often than when there were 4.

## Dev panel

The panel uses lil-gui. It shows on localhost or with `?dev=1`, so it never appears in the
WebView.

**Game folder:**
- Look presets: Default and **Custom 1** (Elad's tuning) are written into `LOOK_PRESETS`. You
  can save over a preset, save the current values as a new one, or delete one; your own saves
  live in this browser only.
- God mode.
- **Copy values (JSON):** puts the current values on the clipboard. Send them to bake them in
  as the defaults.
- Camera-shake and freeze-frame multipliers.

**Other folders:**
- Camera & post: exposure, grade, bloom.
- Directional (moon) light and hemisphere light.
- City lights.
- Wet road.
- **Foot cars:** tints, roughness, metalness, self-glow, cannon glow strips.
- Heroes: roof turtle height, hatch size and position.

**Hotkeys** (dev only), which summon a power without its pickup:

| Key | Power |
| --- | --- |
| Z | Leo |
| X | Raph |
| C | Mikey |
| V | Donnie |
| B | Saws |
| G | Shield |
| N | Nitro |
| H | Harpoon |

## Assets: the quick diet (`tools/optimize-assets.py`)

- `clips.json` keeps only the clips played (ride, flip, one frame of spin): 793 KB to 209 KB.
- Animation floats rounded to 4 decimals (`throws.json` 271 KB to 236 KB).
- UI icons are WebP (about 80% smaller).
- Three unused facade textures removed.
- **Not done:** mesh quantization of the car GLBs. The first attempt made every car vanish
  (the meshes weren't drawn at all), so it's disabled in the script. Each car GLB is still
  ~1.5 MB, mostly 32k-vertex geometry; that's the next real saving.

## How it's built: the parts that weren't obvious

- **The UI scales with the screen:** a `--s` factor (1 on a laptop, down to 0.56 on a short
  landscape phone, set by media queries at the end of `style.css`) zooms every HUD and overlay
  element, so phones keep the same proportions and the road stays visible. April's turn
  banner sits under the speech popup, with a side arrow at the screen edge
  (`tools/follow-ui.mjs` measures both at a given size).

- **Foot cars glow:** their paint gets a fresnel rim (`addRim` in `cars.js`; `footRim` and
  `footRimColor` in the dev panel) and a little self-glow, so they read against the night.
  New panel keys, so older saved looks still get the glow.

- **Wheels:** the Meshy car models are single meshes, so their wheels can't turn. Each car
  gets spinning tyre-and-rim covers over its own wheels.
  - **Position:** from the tyre contact patches, the only vertices touching the ground.
  - **Radius:** from a circle fitted to each tyre's outline (`WHEEL_R` in `src/cars.js`).
  - **Spin:** capped at about 2.5 turns a second. The true rate at chase speed strobes at
    60 fps and reads as standing still.
- **Body roll:** a sprung chassis (`ROLL` in `src/cars.js`). It grows with how hard you turn,
  how long you hold the turn, and pushing against a car. The 13° maximum is reached rarely.
  The hatch, the roof turtles and the back-door roundel ride on the rolling body.
- **Icons are unlit:** the turtle-head icons (pickups and back doors) are drawn after the whole
  post-processing chain, straight to the screen, so they keep their exact colours. They
  therefore always draw on top of everything.
- **Fog and the horizon:** the fog blends into the sky colour by view direction. That keeps
  distant buildings from popping in at the horizon. The sky and horizon colours are therefore
  **not** in the dev panel: changing them alone brings the popping back.
- **Particles:** sparks have to carry the wagon's own speed. A spark spawned standing still is
  behind the camera within a third of a second. They also have to spawn where the chase camera
  can see them: the gap along the van's far flank is hidden by the van itself.
- **Mikey and Donnie:** the same rig as Raph, recoloured by `tools/recolor-turtle.py`. Each is
  frozen in one pose found by `tools/pose-probe.mjs`.

## Tools (`tools/`)

Every browser tool runs headless Chrome with **`--mute-audio`**, against the preview server on
port 8155.

| Tool | Checks |
| --- | --- |
| `levels.mjs` | The level loop: `intro` (level 1 scene and tutorial), `april` (level 2 to the end), `wrong` (takes the other fork; logs when Raph warns and when she's lost), `level3` / `level4` / `level5` |
| `l1-pickups.mjs`, `pickup-mix.mjs`, `card.mjs` | Level 1's pickup rule; which pickups a level hands out; a level's title card |
| `make-mike-icon.py` | Mikey's power icon from the current art, in the medallion format |
| `donnie.mjs` | Frames through Donnie's swings, the lift / crush counts, then a frozen frame of the held car with its on-screen size |
| `optimize-assets.py` | The asset diet above |
| `make-story-art.py` | The story art from Elad's renders |
| `burst.mjs` | A burst of screenshots after optional setup code |
| `catch.mjs` | All four turtle powers firing naturally |
| `shot-burst.mjs`, `shot-rate.mjs` | One enemy shot from charge to impact; shots fired versus hits |
| `gadgets.mjs` | One gadget kept on under autopilot: wrecks, damage taken, bounces, hooks, popup labels |
| `gadget-pose.mjs`, `saw-deploy.mjs` | Frozen close-ups of a gadget, and the saw rig at stages of its deploy |
| `leo-pose.mjs`, `leo-hatch.mjs`, `hero-crop.mjs`, `raph-facing.mjs` | Leo's strike, the hatch timing during it, roof-turtle close-ups, Raph's facing error |
| `wheel-probe.mjs`, `wheel-view.mjs` | Finds the wheels in the models; side views of the covers |
| `hug-wall.mjs`, `scrape-probe.mjs` | Sidewalk driving and the building scrape |
| `roll.mjs`, `juice.mjs`, `wreck-rate.mjs`, `hotkeys.mjs` | Roll angles; shake and freeze; wreck pace against the mission; the hotkeys |
| `make-saw-icon.py`, `make-gadget-icons.py` | Draw the gadget icons |
| `recolor-turtle.py` | Recolours Raph's texture into Mikey and Donnie |

## Assets and licences: open before anything ships

| Asset | Where it came from |
| --- | --- |
| `raphael.glb` and its animation clips | From the Sewer Shred work: Elad's Mixamo files plus the TMNT licensee maquettes |
| `leo_tex`, `mike_tex`, `donnie_tex` | Recolours of the Raph texture |
| `ui/raph`, `leo`, `mike`, `donnie` | Turtle head icons from Elad's TDCars2 project |
| `ui/foot.png` | The Foot Clan symbol Elad supplied; currently not shown on the cars |
| `story/*.webp` | Elad's TMNT character renders (`~/Documents/TMNT/TMNT MM Full body`), resized |
| `story/bg_night.webp`, `bg_win.webp` | Kolbo (nano-banana-2.1), comic backgrounds, no characters |
| Foot car models | Kolbo and Meshy |
| Wagon | Elad's CustomCar_01 (Meshy) |
| Gadget icons | Drawn procedurally by the scripts above |

There is **no licence or provenance record** for `raphael.glb` or the Mixamo animations.
Shipping them is Elad's call; the same flag was raised for Sewer Shred.
