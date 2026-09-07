# Viral Collapse — clip analysis, and a plan for a game like it

Source: a ~3 min screen capture (848x384, 60 fps) of the GoBalance app: lobby →
**VIRAL COLLAPSE** → ~2.5 min of play → back to lobby. Sampled at 32 frames.
(One frame catches a personal WhatsApp notification; ignored, not recorded.)

---

## 1. What the game actually is

A **field shooter**, not a lane shooter. The player is a small character in a
pod near the bottom-centre, auto-firing a continuous stream straight up. Enemies
are blobs carrying printed HP (`251.4K`, `2.7M`, `512.1K`) that drift slowly in
from every edge. Kills drop coins. A bar at the top reads `Remain: 30%` — level
progress, not a boss's health.

Four structural things it does that Nova Vanguard deliberately does not:

1. **Enemies occupy the whole field and pass the player** — left of, right of,
   and below. There is no protected band.
2. **The player roams; the camera is not locked to them.** In one frame the pod
   is off the left edge entirely, with only its bullet stream visible.
3. **Bullets live in world space, so lateral movement paints a diagonal ribbon**
   of them behind the player. That ribbon is the game's visual signature — it is
   a readout of where you have just been.
4. **Support enemies.** Red tethers link a nurse-hatted blob to its neighbours;
   it is healing them. Killing the healer first is the fight's one decision.

Progression is **cross-run**: HP in the millions, permanent upgrades, two
buff slots on the right rail.

## 2. What we can take, and what we must not

**Cannot take: the meta.** Cross-session upgrades and millions-scale numbers are
a permanent product constraint for our games (no IAP, no paid currency, no
cross-session progression). The felt growth has to happen **inside one run** —
which is a better fit anyway for a machine somebody stands on for four minutes.

**Take carefully: threats that pass you.** This is the real design change and it
collides with the one rule that governs everything on this hardware: lateral
lean is comfortable and sustainable, forward/back is expensive and imprecise.
A field where things come at you from below turns survival into a two-axis dodge
— on the axis the board serves worst. So the rule for this game:

> **Every threat must be resolvable by leaning sideways.** Vertical movement is
> for greed — reaching a coin, closing on a target — and never for survival.
> Things that pass you telegraph early and drift slowly; nothing dives.

That keeps what Amit liked (the field feels alive, the screen is not a wall of
enemies queueing politely above you) without making the game a forward-lean test.

**Take freely:** the ribbon-of-bullets look, printed HP on enemies, the healer
that makes target priority matter, coins as the constant small reward.

## 3. What "using this engine" actually means

Nova Vanguard is ~13k lines across 33 modules. The split is not "copy the game";
it is **copy the plumbing, design the game fresh**.

| Layer | Files | Verdict |
|---|---|---|
| Loop, RNG, fixed timestep | `core/loop.js`, `core/rng.js` | **as-is** |
| Board input: sensor read, sign fixes, deadzone rescale, keyboard fallback | `input/input.js` | **as-is** — the axis signs and deadzone shape are hardware findings, not preferences |
| Audio: two buses, prefs, gesture unlock, mute menu | `systems/audio.js` | **as-is** |
| Board screens: start / result / quit, ranks, windowing | `ui/hud.js`, `systems/scoreboard.js` | **as-is** |
| Dev unlock + player settings | `ui/devUnlock.js`, `ui/settingsPanel.js` | **as-is** — written as templates |
| Quit / confirm / campaign-end flow | `main.js` (the endings) | **as-is**, per the arcade-endings rules in `GOBALANCE_APP_INTEGRATION.md` |
| Boot validator harness | `systems/constraints.js` | **pattern as-is, rules fresh** — the harness is the valuable part |
| Renderer, particles, texture atlas build | `render/*` | **adapt** — add a camera; the rest transfers |
| Collision | `systems/collision.js` | **adapt** — a full field needs a spatial hash; NV's band assumptions do not hold |
| Pickups | `systems/pickups.js` | **adapt** — drops now fall through a moving field |
| Enemies, patterns, director, bosses, surfaces, tuning | the other ~9k lines | **fresh.** This is the game |

Realistically: **the shell is a day, the game is the work** — which is the right
ratio and the reason to reuse at all.

## 4. The two unknowns worth prototyping before anything else

Nova Vanguard's POC-8 settled its core question with a two-mode build the human
could switch between on the board. Same approach here, one build, one toggle:

**A. The camera.** Three candidates, and the answer must be found standing up:
- *Follow with a dead zone* — camera tracks the pod once it leaves a centre box.
- *Lateral-only follow* — camera never moves vertically. Cheapest to read, and
  it protects the expensive axis from being fought by the camera.
- *Slow auto-scroll* — the field moves at a constant rate, the player moves in it.

My prior is lateral-only follow, precisely because a camera that moves vertically
while the player leans forward compounds the axis that is already hardest.

**B. Threats passing the player.** How close, how fast, how well telegraphed
before it stops being a field and starts being a hazard you cannot answer with a
sideways lean. Measure it as time-to-contact from first visible: NV's floor is
1.2 s for something arriving in the player's band.

Both are questions about feel on hardware, so the POC ships to the app early and
gets played standing on a board rather than judged at a desk.

## 5. Cute, concretely

Cute is a rendering and motion decision more than a subject decision:
rounder silhouettes, squash-and-stretch on hits, oversized eyes, a bouncy
death pop instead of a debris burst, warm palette against a dark field.
Subject candidates, all of which keep the "swarm with printed HP" read:

- **Garden bugs** — ladybirds, snails, bees over a night garden; the healer is a
  fat bumblebee. Warm, immediately legible, easy to make cute.
- **Deep sea** — jellyfish and pufferfish; bioluminescence does the colour work.
- **Bakery** — dough blobs and cupcakes; the most novel, the riskiest to read.

Art comes from Kolbo as illustrated 2D, same pipeline as Nova Vanguard's, and the
surfaces must be generated art rather than procedural canvas patterns.

## 6. Sequence

1. **Macro brief** (theme, one page) → approval gate.
2. **POC**: shell lifted from NV, one screen, the camera toggle and the
   pass-the-player rule, placeholder art. Ship to the app; play it standing.
3. **Decision note** from that session, the way POC-8 was written.
4. **Build doc** once the camera and threat model are settled.
5. **Build**: enemies → director → in-run upgrades → art pass → audio.
6. **Land** per `GOBALANCE_APP_INTEGRATION.md`, including all three endings.
