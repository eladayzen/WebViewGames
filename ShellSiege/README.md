# Shell Siege — phases 1 and 2

A Diablo-style isometric arena, built from TMNT Survivor's model with the
renderer replaced. **Name is provisional** — see "Before the first Unity drop".

    npm install && npm run dev        # http://localhost:5182/
    npm test                          # 112 tests

## What is here

| | |
|---|---|
| **Phase 1 — the stage** | Flat painted plaza, fixed isometric camera, rune dais, colonnade, four braziers |
| **Phase 2 — the character** | Raphael's rigged glb in the room, moved by the board, throwing stars at crates |
| **Animation** | Two layers: walk on the legs, throws on the arms. Idle/gait/shading all switchable |
| **Weapons** | Returning sai (default) or the shuriken, `?weapon=` |

What is **not** here, on purpose: no horde, no health, no level-up, no score,
no Diablo HUD. None of them change the three questions this build exists to
answer, and all of them would have slowed down getting to it.

## The three questions it is for

1. **Does the camera angle read?** 50° of pitch is a guess until somebody has
   stood on a board and looked at it. `?pitch=` and `?cdist=`.
2. **Is a bright green turtle legible on this floor, with things happening on
   it?** That is the one thing the floor art has to pass.
3. **Does the lean still mean what the player thinks it means** once the camera
   is turned 45°? See `src/core/axes.js` — and the bug below.

## What was ported, and what was thrown away

TMNT Survivor is 3,485 lines; 1,518 of them touched Pixi. The renderer is
gone. `core/pace.js`, `systems/input.js` and `systems/combat.js` came across
essentially untouched, which is the point: the walk speed, the fire interval,
the range, the bullet speed and the global 0.7 pace are a week of board tuning
and they still mean exactly what they meant. **The sim is still in pixels**;
`render/units.js` divides by 100 on the way to the scene and nothing else
knows about metres.

## The bug worth knowing about

The forward axis shipped inverted in the first cut: holding ArrowUp walked
Raphael *toward* the camera. The camera sits at `target + dist·(cos yaw, ·,
sin yaw)`, so its forward vector points away from the viewer — travelling
along it goes *up* the screen, not down.

**The unit test did not catch it, because it had been written from the same
wrong premise and agreed with the bug.** It was caught by driving a real
browser and projecting the player through the real camera matrix. The tests in
`test/axes.test.mjs` are now stated the only way an inverted mapping cannot
satisfy: by distance from where the camera actually is.

## Weapons — two abilities, not one in two coats

    ?weapon=sai     Raphael's sai. The DEFAULT, for now.
    ?weapon=star    the shuriken. Kept, not replaced.

The **sai flies 2.6x faster**, buries itself in the first thing it bites,
**bounces, and arcs home** to whatever hand is there by then. It cuts on the way
back too — a returning blade that passes harmlessly through the crowd it just
cut into is the opposite of the fantasy.

**The return is an arc, not a straight line.** A blade that retraces its own
path reads as the animation played backwards; it is the one shape the eye
refuses to accept as "coming back". The bow also gets it out from behind
whatever it just hit, so the return is not spent hidden inside a crate.
Consecutive throws bow opposite ways so two sai never trace the same line, and
the bow scales with the distance home — a short flick stays a flick.

**It comes home even if it hits nothing.** A thrown weapon that vanishes at the
end of its range reads as a bug, and it is a weapon the player has silently
lost. The return curve is rebuilt every frame against where the player is *now*,
so it lands in his hand rather than where he was standing when he threw it.
The tests are mostly about the weapon *ending*: a sai that never comes home
leaks a bullet per shot and the only symptom is the frame rate.

Pierce still works on the way out, and the turn happens at the end of the line.

## Art

Each floor is one hand-painted 2048px image covering the whole 36×36-unit arena
(Kolbo). One painting, not a tile: a bounded arena means no seam and no repeat
to spot. `?floor=warm|tile|stone`, registry in `src/render/floors.js`.

| | |
|---|---|
| `floor_warm.jpg` | **the default.** Warm sandstone flagstones, inlaid compass medallion |
| `floor_tile.jpg` | a finer warm mosaic — same brief, different hand |
| `floor_plaza.jpg` | the original grey dais. **Kept, not deleted** |

### Why the first plaza was replaced

It painted a **staircase onto a flat plane**. Its centrepiece was a stepped
dais: concentric rings of stone with the shading of real steps and a cast
shadow under the lip. It is good art and it lies about the one thing this game
has committed to — the whole reason the 3D stairs were cut is that gameplay
happens on **one plane**. A player who can see steps expects to climb them.

It was also simply **dim**: mean value **0.480**. A floor is most of the screen,
so a dim floor makes a dim room, and the fix for "I can't see him" then gets
reached for in the wrong place (see the self-illumination note below). Both new
floors measure about **0.83** — 1.7× the light off the same lamps.

So the dais art is kept at `?floor=stone`, for a later scene that has real
height in it.

### The stones have to be the right size on the ground

The first warm floor drew about **eight** flagstones across the painting. The
painting covers the whole arena, so each stone landed at **4.5 units** — a
four-and-a-half-metre paving slab next to a 1.55-unit turtle — and its medallion
filled most of the screen. It looked like a close-up of a floor rather than a
floor.

The shipped art draws about **eighteen** across, which puts a stone at 2 units.
It was regenerated at that density rather than fixed in code: tiling or scaling
the UVs would have multiplied the medallion too.

### Grading, again, and in the other direction

`tools/grade-floor-warm.py`. The generation that won on composition came back at
saturation **0.506** / value **0.910** — correct in direction, overshot in
amount. Elad asked for "a bit more casual — just a bit", not for the floor to
become the loudest thing on screen. Saturation is pulled much harder than value
(×0.80 against ×0.93), because *less dark* is the instruction and *less orange*
is only the correction. Output ≈ 0.37 / 0.83.

(`tools/grade-floor.py` is the older one, which made the opposite correction
when the first plaza came back mint.)

### Everything else

`raphael.glb` is Sewer Shred's, unmodified. `crate.jpg` likewise.
`shuriken.webp` is TMNT Survivor's. `sai.webp` is Kolbo (gpt-image-2), white
keyed out.

## Light — "much less dark"

Three changes, in order of how much they did:

| | was | now | |
|---|---|---|---|
| fog / background | `0x16242c` | `0x8d94a0` | fog colour is also the *background* colour, so the darkest value in the scene was filling the edges of the screen |
| hemisphere | 0.85, cold ground | 1.3, **warm** ground | carried here rather than on the key: raising the key deepens every shadow by as much as it brightens the lit side |
| the floor | value 0.480 | value 0.83 | most of the screen |

The apron, kerb, colonnade and brazier bowls were all re-tinted from blue-grey
to warm stone to match, and exposure went 1.0 → 1.2.

### Self-illumination is off, and that is the point

`?emis=` now defaults to **0**. It was added to solve "he is hard to see in a
murky room" and it is the wrong tool: emissive light has no direction, so it
fills the shadow side at exactly the strength it fills the lit side. It does not
brighten a character, it **flattens** one — worst precisely along the terminator,
where the form reads. On the toon path it is worse still, because the banding it
exists to produce gets lifted off the bottom step and the hard edge dissolves.

The fix for a murky room is to stop the room being murky. The knob stays so a
board can borrow a little back.

## The blades in his hands

`src/render/held.js`. Two sai parented to the hand bones, so they inherit the
skinned pose for free and cannot lag it by a frame the way a per-frame copy of
the bone matrix always can.

Three things worth keeping:

- **What hides a blade is the throw, not the bullet count.** The obvious rule —
  "he carries two, so hide one per bullet in the air" — reads the simulation and
  can never disagree with the screen. It also leaves him empty-handed
  essentially always: he throws every 0.55 s and a round trip takes about as
  long. Measured over 40 frames it had a blade in his right hand **11 frames out
  of 40**. Two blades are the *fantasy*, not an inventory the game has. So both
  are visible, and the right one — the hand the throw animation swings — goes
  from the release frame to the end of the throw, about a third of a second.
- **A fist does not grip along the fingers.** Measured: both finger chains leave
  the hand bone along local `(±0.25, 0.97, 0)` and the thumb along
  `(0.63, 0.71, 0.33)`, so `+Y` runs down the fingers and the thumb side is
  `+X`. A weapon runs through the tunnel the curled fingers make — the **X**
  axis. The first cut put it along `+Y` and the blade ran straight through his
  chest. Turning it the other way instead (`?heldry=180`, reverse grip) buries
  both blades inside the body mesh — measured, not guessed: they stay visible
  and stay at the hands, they are simply inside him.
- **It rolls about its own length to face the camera.** A blade drawn as a flat
  quad has a side and an edge, and for a good part of every stride the camera
  was looking down the edge — present, correct and invisible. Only the roll is
  taken, so the blade still points wherever the fist points. `?heldbill=0`.

Held at **half** the flying blade's size: the one in the air is sized to stay
legible crossing a cluttered floor at 2.6× speed, and at that size in his fist
it is 0.73 of his own height, which is a sword.

### And the fingers close round it

`src/render/fist.js`. The hand pose comes from the clip, and the clips were
auditioned for the body — both the idle and the walk leave the fingers loosely
open, so a weapon in that hand was being held like a wine glass.

Every phalanx gets `quaternion.multiply(curl)` after the mixer has written the
frame, so it composes onto the animated pose instead of replacing it and can
never accumulate. Only a hand that is **holding** something closes, which means
the throwing hand opens on the release frame with no code saying so.

**The flexion axis cost two wrong versions, and both failed quietly.**

1. *Rotate each phalanx about its own local X.* A fair guess — every finger
   bone's child sits at local `(0, 1, 0)`, so the bone runs along `+Y` and
   flexion has to be about X or Z. Measured on the rig, 52 + 80 + 52 degrees of
   commanded curl moved the fingertip **17 degrees**: the first phalanx came out
   at +105° about X and the second at −87°, because each bone's *bind*
   orientation differs, so one bone's local X is another's local −X. The joints
   closed against each other and the hand stayed flat.
2. *Derive the axis from the live skeleton each frame.* Sounds more careful, and
   is the actual bug: by the time it looked, the pose it measured already
   contained the curl it was about to apply, so the palm normal came off a
   half-closed hand and the thumb test could flip. One application added 21°;
   the next **took 35 back**. The fingers oscillated instead of closing.

What works is to measure once, in the **bind pose**, in world space —

    f = wrist -> middle knuckle      (along the fingers)
    a = middle -> index knuckle      (across the knuckles), with the component
                                      along f removed: that part is a twist
    n = f × a, flipped to agree with the thumb — the palm side

— flex about `−a` so Rodrigues takes the tip toward `n` rather than over the
back of the hand, and store that axis **in each bone's own frame**. A bone's
anatomical flexion axis is fixed in that bone's frame, and the frame turns with
the animation, so it stays correct for free and nothing is measured again. This
is why `makeFist` has to be built while the model is still in bind pose —
`main.js` builds the held weapons straight after `loadRig`, before `loadClips`.

Result on the rig: the middle joint sits at 44° on the clip alone and 125° with
the fist. `?fist=0` to compare, `?fistamt=` to scale it.

**On the tests.** Two of them exist only because of the above. One asserts the
last phalanx passes 170°, not merely that it *moved* — a loose assertion would
have passed version 1. One applies the curl twice and requires the second to add
— which is the only cheap way to catch an axis that does not hold still. Both
run against a fake hand built with real offsets and real parenting, because a
bag of loose `Object3D`s cannot catch an axis bug at all. The curl is measured
as accumulated **joint rotation**, not fingertip **position**: the last bone in
a Mixamo finger has no end effector, so its position can only ever reach ~60°
off straight however hard the hand closes.

## Animation — two layers

Five clips, extracted from `~/Documents/3d/fightAnimations/move animatrions`:

| clip | source | cycle | stride |
|---|---|---|---|
| `idle` | Ninja Idle | 3.33s | 0.21 femurs (in place) |
| `walk_f` | Crouch Walk Forward | 1.13s | 4.53 femurs |
| `walk_b` | Crouch Walk Back | 1.23s | 3.60 femurs |
| `walk_l` | Crouch Walk Left | 1.17s | 3.78 femurs |
| `walk_r` | Crouch Walk Right | 1.27s | 3.56 femurs |
| `idle2` | Ninja Idle (1) | 4.93s | — |
| `walk_sneak` | Sneak Walk | 1.07s | 4.74 femurs |
| `walk_mutant` | Mutant Walking | 1.43s | 4.25 femurs |
| `walk_crouched` | Crouched Walking | 1.03s | 3.32 femurs |
| `walk_backwards` | Walking Backwards | 0.97s | 3.04 femurs |
| `throw_slash` | Stable Sword Inward Slash | 2.20s | release at **1.20s** |
| `throw_down` | Standing Melee Attack Downward | 2.27s | release at **0.83s** |
| `throw_horiz` | Standing Melee Attack Horizontal | 1.00s | release at **0.12s** |

The three throws are the ones the **Sewer Shred attack audition tagged THROW**
in `~/Documents/3d/fightAnimations/TAGS.md` (2026-11-16) — clips it dropped as
melee because they read as throwing. `throw_slash` is the default (`?throw=slash
|down|horiz`).

### The legs walk while the arms throw

three.js has no animation layers and no bone masking, so `render/mask.js` builds
one the only way its mixer allows: **every clip is split into sub-clips by
bone**, and each slice gets its own action. A slice with no leg tracks cannot
move a leg, whatever weight it is given.

In every bucket the throw takes `w x mask` and the locomotion keeps
`1 - w x mask`. That is the whole design:

| bones | mask | at peak throw | with no throw |
|---|---|---|---|
| hips + legs (9) | 0 | walk 1.0 | walk 1.0 |
| `Spine` | 0.5 | throw 0.5 / walk 0.5 | walk 1.0 |
| `Spine1` | 0.75 | throw 0.75 / walk 0.25 | walk 1.0 |
| `Spine2`, neck, head, arms, hands (41) | 1 | throw 1.0 | **walk 1.0** |

**The fallback is arithmetic, not a special case.** With no throw playing `w` is
0, so the walk drives every bone at full strength including the whole upper
body — there is nothing to forget. Measured live while strafing: the two layers
sum to exactly 1 in every bucket, worst deviation `0`.

**The spine is graded rather than cut.** A hard line at the waist makes the hips
follow the walk while the spine directly above follows the throw, and the join
reads as a break.

**The release lands on the shot.** `w.fireT` is a countdown the sim already
keeps, so the next shot is not a surprise: the window opens `preS` early and the
hand opens on the frame the star appears. Triggering on the shot would play the
whole wind-up after the star had already gone. After a pause in firing there is
no countdown to use, so `startThrow(skip)` begins part-way in rather than
throwing a fifth of a second late.

    node tools/extract-clips.mjs --list     # what is in the source FBXs
    node tools/extract-clips.mjs            # -> public/models/clips.json (445 KB)

**The four-way set is a design decision, not four spare walks.** A character
who always faces the way he travels needs exactly one walk clip. Four of them
only mean something if the body can face one way while the feet go another —
so Raphael turns to face **what he is shooting at** and strafes around it
(`core/facing.js`), and the blend is picked from his travel direction relative
to that facing (`core/locomotion.js`). It also fixes the thing flagged on TMNT
Survivor, where the weapon pointed wherever the player happened to be walking.

**The feet do not slide, and that is measured rather than tuned.**
`tools/extract-clips.mjs` records how far each clip's root actually travelled
in one cycle, in **femurs** — a bone's rest length is the one unit the FBX and
the glb agree on. Hips height would not do: these are crouch walks, so the hips
sit lower than the glb's bind pose by exactly the amount of the crouch. At run
time the cadence is `speed ÷ blended stride`, so one stride carries him exactly
as far as he is actually moving.

**The four walks share one clock.** Their lengths differ (1.13s to 1.27s), so
letting the mixer advance them independently drifts them apart within seconds
and blends a left foot into a right one. Their `timeScale` is 0 and a single
phase drives all four.

### Switching between them

    ?idle=a|b                            a = Ninja Idle, b = Ninja Idle (1) -- the DEFAULT
    ?walk=crouch|sneak|mutant|crouched   crouch is the default
    ?shade=lambert|toon   ?emis=0        shading and self-illumination
    ?floor=warm|tile|stone               warm is the default

All six animation switches are live and all 13 clips ship in `clips.json`; the
loaded set is readable at runtime as `__ss.rig.set` and `__ss.rig.idleName`.

**Only `crouch` is a native four-way set.** The others are single forward clips
from the same folder, so a set built on one of them **borrows the crouch set's
sideways clips** — the forward gait is what is being auditioned and the strafe
is a stand-in. That is marked `native4: false` in the data, and a test asserts
the borrowing is real rather than accidental.

A test also checks every clip every set names is actually in `clips.json`:
otherwise `?walk=sneak` would resolve to an undefined action and that limb would
simply stop moving, with nothing logged.

**Toon shading** (`?shade=toon`) is not just a different material — it bands the
diffuse through a 3-step nearest-filtered ramp, which puts a hard terminator on
him. A cartoon turtle under a smooth falloff reads as a plastic model of a
cartoon turtle. Side by side it is clearly the better look; it is a switch
rather than the default because that is a call for a board, not a desk.

### Three things that were measured, not assumed

- **Which way "right" is.** Root motion says forward is `+Z`, back `−Z`, left
  `+X`, right `−X` — exactly `forward × up`. So Mixamo's names match the
  convention the code assumes, and it independently confirms the mesh faces
  `+Z`, which `?yaw0=0` had only been assuming.
- **Loop seams.** Every clip used closes to within 0.4°. (`Walk Forward Arc`
  and `Walk Backward Arc` are 7° and 21° — they are turns, not loops, and are
  not used.)
- **The femur.** Measured as the world gap between `mixamorigLeftUpLeg` and
  `mixamorigLeftLeg`, *not* as `bone.position.length()`: a bone's local offset
  carries none of the scale stacked above it, which gave a 36-unit femur on a
  1.55-unit character and one step every forty seconds.

### Still open on animation

- **Cadence is at 0.7**, per Elad — movement animation 30% slower. The measured
  answer is 1.0 (feet exactly matching the ground), but at full walk speed that
  is 2.5 cycles/s against a clip authored at 0.89, and a crouch walk at nearly
  3× reads frantic. 0.7 trades a little foot slide for a gait that looks like a
  gait. `?cad=1` restores the measured value. A run clip above some speed is
  still the real fix.
- **Only one idle was in the folder** (`Ninja Idle.fbx`); every FBX there holds
  exactly one clip.
- **`clips.json` is 1.2 MB and `dist/` is 4.5 MB**, because every audition clip
  ships. That is the right trade while the choice is open and a one-line trim in
  `tools/extract-clips.mjs` once it is not.
- **Only the throw is layered.** A second upper-body action (a hit reaction, a
  melee) would need its own slot; today the upper layer holds one clip.
- **The throw can play with no shot behind it** — the trigger is predictive, so
  if the target dies or leaves range inside that 0.18s the throw still finishes.
  It reads as a feint, and it is rare.

## The Foot Clan — the smallest enemy that answers a board question

`src/core/foes.js` (sim), `src/render/foes.js` (drawing). One question only:
**can a player on a board read a threat walking at them, turn, and deal with it
before it lands a hit?** No wave pacing, no elites, no ranged attacker, no
score — none of those change that answer and each costs a day.

**They are targets that walk and hit back.** A foe goes into the *same*
`w.targets` array the crates live in, which is the reason this is small:
`nearestTarget`, `updateFiring` and `updateBullets` already take anything with
a position, a radius and hp, so aiming, the sai's bounce-and-return, pierce and
the hit flash all work on enemies **without one line of combat code changing**.
`w.foes` holds references to the *same objects*, never copies.

**The attack is the throw, inside out.** The player's throw is windup →
release frame → recovery; a melee swing is those three beats with the
projectile removed. So the windup is a real, visible chunk of time, and the
damage is committed on the release frame and **re-measured then** — which is
what makes stepping out of range a dodge rather than a cosmetic retreat. An
enemy that damages you the instant it touches you cannot be read, cannot be
dodged, and tells you nothing about whether the board is responsive enough to
dodge with. *The telegraph is the experiment.*

### The number that mattered

First run: 19 seconds of play, **zero damage taken, not one swing ever fired.**
A foe crosses from the gun's 620 px range to its own 120 px reach in 2.9
seconds — about five throws at 10 damage — so at 20 hp none of them ever
arrived. A prototype whose mechanic cannot happen is not a cheap prototype, it
is a decoration. At **60 hp** a single foe with full attention just reaches
him, and two at once reliably get a swing off. Standing still and taking it now
kills the player in 19.6 s, with 10 strikes landed and 10 foes converging.

### They are the Dungeon Skeleton, with the pack's own motion

`tools/make-skeleton.mjs` turns the Dungeon Skeletons demo pack into one glb —
mesh, skeleton and all three clips (idle, walk, attack) in a single file the
game already knows how to load through `GLTFLoader`. 410 KB plus a 14 KB atlas.

The advice that came with the packs was that FBX into a JS game means rendering
sprite sheets or "converting to glTF and pulling in three.js — real work, not
an import step". That is true of a 2D canvas game. **This one is already
three.js**, already loads a rigged glb, and `tools/extract-clips.mjs` already
parses FBX in Node, so the whole job was one script.

Three things that cost time and are worth keeping:

- **`FileReader` is not a global in Node**, and `GLTFExporter` writes its binary
  chunk by handing a Blob to one. The failure is a bare `ReferenceError` from
  inside the exporter that names nothing. Node's `Blob` already has
  `arrayBuffer()`, so the shim is three lines.
- **The FBX carries the authoring scene's ambient light**, which would have been
  exported inside the enemy and then added to the scene once per Foot Soldier.
- **The pack exports position, rotation *and* scale for all 24 bones** — 72
  tracks a clip. On a skeleton the scale never changes and only the root ever
  translates. Trimming that and rounding to 3dp took the glb from 610 KB to
  410 KB, and the atlas went 111 KB → 14 KB as WebP.

**The sim owns the timing, not the clip.** The attack animation is 1.50 s and
the swing it serves is `windupS + recoverS` = 0.95 s, so the clip is *scrubbed*
from the sim's own state clock rather than played and hoped for. The frame where
the blade is furthest forward lands on the frame the damage is committed, and it
stays true if those numbers are tuned.

One mixer per enemy, each slot a `SkeletonUtils.clone` of the same glb — geometry
and map shared, only bone matrices per-enemy.

### What happened to the maquette

This drew the licensed Foot Soldier maquette (a static 7k-tri mesh, slid and
bobbed) while nothing with a walk cycle existed. It is gone from `public/` now
that a rigged enemy exists; it is one `cp` from Sewer Shred's
`public/models/foot.bin` if it is ever wanted back.

### On the other pack, and whether there is a fast rigging route

There is, and `tools/make-rival.mjs` is it — **paused, not abandoned**, and
nothing from it is in the build.

Polygon Fantasy Rivals has **no character animation at all**: the only two
`.anim` files in 173 MB are `Runes_Inner` and `Runes_Outer`. But all twenty
characters share ONE 49-bone skeleton, so this is not twenty rigging jobs — it
is one bone map, 22 lines, and then every character can play every clip we own.
The tool retargets our Mixamo clips onto any of them and it runs: the clips
bind, the bones move.

**Four things went wrong on the way, and every one of them failed silently.**
Nothing threw, nothing logged, and the character simply stood there — which is
why each one had to be caught by measuring a bone over a hundred frames rather
than by looking at an error.

1. **The skin collapsed.** Lifting the mesh and its bone root into a fresh
   group and scaling that broke the bind — bodies rendered as nothing while
   their blob shadows sat in exactly the right places. Isolate in place and
   scale the root that holds mesh and bones together.
2. **It exported 180.9 units tall** whatever the root was scaled to: a
   SkinnedMesh's bind matrices cancel an ancestor scale. The game multiplied
   that by its own enemy height and the camera stood inside a 380-unit giant.
   `render/foes.js` now measures the *posed* skin at load, which cannot be
   wrong for any pack.
3. **`retargetClip` silently produced flat tracks.** It resolves each target
   bone through `options.names[bone.name]`, and ten characters in one FBX means
   the fourth one's bones are called `Hips_4`. Keyed by clean names, every
   lookup missed, every bone was skipped, and the clip came out correctly named
   and completely empty.
4. **The source had no bind pose.** A Mixamo animation-only FBX has bones and
   no skin, so a stand-in skeleton is bound in whatever frame zero is — a
   mid-stride crouch. Retargeting against that treats a crouch as "standing
   straight" and every character came out hunched on all fours. Mixamo's
   `model@…` exports carry a real skin and fix it.

What is left is a bind-pose correction on the posture. Bounded, but real — and
an enemy that is nearly right is not something to put in front of a child.

Worth knowing: the two character FBXs are only 2.1 MB and 2.9 MB and hold ten
characters each on a shared rig. The 173 MB is Unity prefabs, textures and a
demo scene, none of which this game would use.

## Dying, and what is left

`src/render/debris.js`. The body is hidden on the frame it dies and replaced
by what it was made of: a skull, bone pieces, and a puff of dust. Nothing
lies around afterwards, which matters more here than anywhere — the whole
camera argument is that a crowd stays readable.

The first version folded the body forward and sank it through the floor over
1.2 s. That is the cheapest possible "it died" and it reads as one: a corpse
politely lying down and melting, which is the wrong note for a hit that is
meant to land.

**The debris is from the Fantasy Rivals pack, and this is the honest use of
it.** That pack has no character animation, so its twenty rigged fighters are
not enemies without a retargeting job — but its *props* need no rig, no clip
and no retarget. A skull and a pile of bones are exactly what a skeleton
should come apart into. `tools/make-debris.mjs`, 31 KB for both, no texture:
they are on screen for under a second and never larger than a fist, so
carrying a 1024px atlas for them would be absurd.

Everything is pooled; nothing allocates per death. Ten skeletons dying inside
a second is a normal moment here, and a burst that built twelve meshes each
time would hitch exactly when the screen is busiest.

## Abilities, and choosing one

`src/core/abilities.js` and `src/core/levelup.js`, both lifted from TMNT
Survivor — that game already solved this and the solution is not
Survivor-specific. `levelup.js` came across **unchanged** and its eight tests
passed verbatim, which is what a pure module with no DOM in it buys you.

**Two cards, one per lean direction, and centre deliberately means nothing.**
A balance board has no buttons, so the choice is made with the only thing the
player can do. Hold to confirm: lean, a bar fills, the pick lands when it
completes; standing back up empties it. Nobody wobbling on a board gets a card
taken out from under them, and because the fill is visible the rule teaches
itself.

**Every ability is a stat modifier**, which is the answer to "we need systems
that synergise": we do not. +2 blades and +60% throw rate is already a
different character from +120% damage and pierce. What did *not* come across:
Survivor's MAGNET (there are no drops here — a kill is XP the moment it
happens, because a pickup is a second system) and its KATANA (a behaviour, not
a number).

`stats(build)` is derived every frame, never cached. A cached stat is a bug
that only appears after a level-up, which is the hardest moment to reproduce.

### The bug this uncovered, which was mine

Kills read zero for the whole session. `updateBullets` called `onHit` **before**
resolving the death, so `e.alive` was still true inside the callback and every
caller asking "did that kill it?" got false. That silently disabled the kill
counter, the XP feeding the level-up screen, the death burst, and the number
on the game-over card. None of them throw when they never run, so the game
looked fine and simply never progressed. The order is now fixed and a test
pins it.

### The enemy health number, wrong twice

| | result |
|---|---|
| 20 hp | **nothing ever arrived** — 19 s, zero damage taken, the melee swing never fired |
| 60 hp | **nothing ever died** — they arrived reliably, 25 s produced zero kills, so the level-up could never open |
| **35 hp** | three and a half hits: a single foe dies just before reaching you, several converging get through |

35 is the only setting where both halves of the loop happen.

## Weight and speed

| | before | after |
|---|---|---|
| `dist/` | 6.6 MB | **3.46 MB**, with a rigged animated enemy, debris and the ability system added |
| three floor textures | 2.9 MB JPEG | 0.9 MB WebP, two floors |
| `clips.json` | 1236 KB | **566 KB** |

- **WebP** (`tools/to-webp.py`, quality 86). `MimeFor()` already serves it and
  every target WebView decodes it; these are smooth painted illustrations, the
  case WebP is best at, under a camera that never gets within 8 units.
- **The clip set is trimmed to what the defaults can reach.**
  `tools/extract-clips.mjs --all` emits every audition clip; the default emits
  six. Quaternion values went 4dp → 3dp, worst case about 0.06° of joint error,
  well under what a 30 fps resample already costs.
  Any audition clip a trimmed build lacks **aliases to its nearest shipped
  stand-in** (`CLIP_ALIAS`) — otherwise `?walk=sneak` resolves to an undefined
  action and that limb silently stops moving. A test asserts no set's four
  slots can collapse onto one clip, which would make two directions fight over
  one action's weight.
- **The second warm floor is gone** — it lost the audition, and a 1 MB texture
  kept alive for a switch nobody will flick never gets removed later. The grey
  dais stays, because it was asked for.
- **Pixel ratio 1.75 → 1.5** (≈25% fewer fragments) and **two of the four
  braziers carry a real light** instead of all four. A point light costs its
  shading on every fragment of a per-pixel floor whether or not that fragment
  is near it. Since the room was brightened those pools barely read anyway —
  they were carrying the old murk. All four bowls and flame sprites stay.
  `?dpr=`, `?brazlit=`.

## For the Unity drop

`npm run build && node tools/manifest.mjs` — the manifest lists content files
only, never a `.meta`, and never itself. Only Android reads it, which is
exactly why a stale one survives so long: it is invisible on whatever platform
you happen to be testing on, and then the game will not launch on a phone.

The DOM contract is live rather than ceremonial now: the Foot Clan can end a
run, so `#gameover-overlay` and `#restart-button` are reachable. Restart resets
in place rather than reloading the page.

**The dev readout starts closed.** `?dev=1` opens it on load and the `⋯` button
toggles it; it is wired inline in `index.html` rather than in the module, the
same reasoning as the quit button's fallback. What the player sees is a health
bar and a kill count.

## Knobs

Camera `?yaw=45 ?pitch=50 ?cdist=22 ?vieww=20 ?clag=9` ·
light `?exp=1.2 ?hemi=1.3 ?key=1.0` · fog `?fog=8d94a0 ?fnear=30 ?ffar=62` ·
stage `?floor=warm ?ring=4.14 ?colon=1.6 ?braz=7 ?brazlit=2` · render `?dpr=1.5` · debris `?debris=7 ?dust=5 ?debrisS=1.1 ?gravity=14` ·
foes `?foes=10 ?fhp=35 ?fspd=170 ?freach=120 ?fdmg=10 ?fwind=0.4 ?frec=0.55 ?fspawn=1.2 ?php=100 ?enemyh=1.62 ?enemyyaw=0 ?walkcad=1` · rig `?rh=1.55 ?yaw0=0` · locomotion `?turn=9 ?aimr=1.25 ?cad=0.7 ?locomin=0.25 ?locomix=12` ·
throw `?throw=slash ?thpre=0.18 ?thpost=0.32 ?thin=0.08 ?thout=0.14` ·
held `?held=1 ?heldsize=0.5 ?heldbill=1 ?heldgrip=0.13 ?heldrx/ry/rz=0` · fist `?fist=1 ?fistamt=1 ?fistsign=1` ·
look `?shade=lambert ?emis=0 ?toonsteps=3 ?idle=b ?walk=crouch` ·
weapon `?weapon=sai ?saispd=2.6 ?sairet=1500 ?saibow=0.38 ?saipx=38` ·
range `?crates=14 ?chp=30 ?cresp=2.5` · gun `?sfire=0.55 ?sproj=1 ?srange=620` ·
movement `?pace=0.7 ?spd=520 ?dzx=0.08 ?dzy=0.20`

## Before the first Unity drop

- **The save key is `TurtlesActionGame`** -- settled by Elad, 17 Nov. The drop
  folder is `Assets/StreamingAssets/TurtlesActionGame/`; the source project
  stays `ShellSiege` and the display title stays "Shell Siege", because the key
  comes from the StreamingAssets folder name and nothing else.
  `FirestoreStructureStrings.WebGameKey()` derives it from the StreamingAssets
  folder, so renaming after ship orphans every player's data. `ShellSiege` is a
  working title and nobody has signed off on it.
- `manifest.txt` is hand-maintained, regenerated every build, content files
  only, never `.meta`, never itself.
- Count `.meta` files in **both** directions after landing — a content-hashed
  rebuild leaves new files bare, and an orphan check cannot see it.
