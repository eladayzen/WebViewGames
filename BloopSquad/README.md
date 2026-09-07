# Bloop Squad

**Cute-monster field shooter for eight-year-olds. This is a POC.**

## Read this first

**`../pipeline/build-docs/BloopSquad-poc.md`** — the handoff. What the POC is
for, which decisions are already paid for, the landmines already stepped on, and
what to build next in order. Do not start editing before reading it; several
things in here look arbitrary and are load-bearing.

Then, in this order:

| File | Why |
|---|---|
| `../pipeline/macro-briefs/approved/bloop-squad/brief.md` | the approved design, including the toy specs not yet built |
| `.../bloop-squad/concepts/art-bible-concept-09.jpg` | the locked art direction. Everything drawn in code today is a placeholder at the right size |
| `src/data/tuning.js` | every knob, each carrying the reason it holds that value |
| `../GOBALANCE_APP_INTEGRATION.md` | required before this ever goes to the product app |

## Run it

```sh
npm install
npm run dev            # a plain browser is a first-class target: no SDK needed
```

Keyboard stands in for the board: **arrows/WASD** fly · **C** camera mode ·
**`[` `]`** monster speed · **`-` `=`** pass clearance · **1 2 3** force a toy ·
**R** restart. `__bloop.report()` in the console dumps the run's numbers.

## The five rules that are not up for grabs

1. **Every threat must be answerable by leaning SIDEWAYS.** Forward/back is the
   expensive, imprecise axis on this hardware. Vertical movement is for greed --
   a coin, a toy, closing on a monster -- and never for survival.
2. **No buttons, ever.** Auto-fire; toys activate on contact and run on a timer.
3. **One toy at a time, and the plain gun never goes away.** A player can have a
   worse round; they can never have a worse pod.
4. **Nobody dies.** A monster out of hearts giggles, puffs into confetti and
   floats off. Failure should be funny.
5. **No meta-progression.** No IAP, no currency that survives the run, no unlock
   ladder. Product constraint, not a v1 cut.

## Where it is deployed

- **SDK sandbox** (`~/PracticulaProjects/gobalance_bobo_sdk`) — yes, for board
  testing.
- **Product app** (`~/UnityProjects/gobalance`) — **no, deliberately.** Too
  early. When it does go, follow `GOBALANCE_APP_INTEGRATION.md` exactly, and
  note that the folder name becomes a permanent save key.

## The two questions this POC exists to answer

Both need a balance board and a person standing on it. Neither is answerable at
a desk, and everything else is cheaper once they are settled — the camera answer
in particular decides whether the art needs parallax.

1. **The camera:** fixed, drifting starfield, or lateral follow.
2. **How close a monster may pass** before the field stops being a playground.
