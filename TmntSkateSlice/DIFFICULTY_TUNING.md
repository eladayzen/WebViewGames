# Difficulty & Spawn Tuning — TMNT: Skate & Slice

A plain-language map of how difficulty works and every knob you can turn to
control it. Nothing here is hard-coded magic — it's all data in two files:

- **`src/data/stages.js`** — the per-stage difficulty curve (speed, density, bomb rate, when to advance).
- **`src/data/powerUps.js`** — which power-ups drop and how often (the mix).
- (`src/data/boxColors.js` — how often the blue/purple/red pizza-box variants drop; `src/data/constants.js` — buff durations, movement, hit tolerance.)

---

## 1. How a falling item is chosen (the one mechanism to understand)

Every spawn (one item every `spawnIntervalSec`) rolls a single random number
`r` between 0 and 1 and walks down this ladder (`src/data/itemTypes.js`,
`rollItemType`):

```
r rolls 0.0 ─────────────────────────────────────────────► 1.0
   │ bomb        │ power-up      │ blue/purple/red │  plain pizza
   │ (bombChance)│ (powerUpChance)│  (box weights) │  (everything left over)
```

1. **Bomb?** if `r < bombChance` → bomb.
2. **Power-up?** else if `r < bombChance + powerUpChance` → a power-up. *Which*
   one is a second weighted roll among the mix in `powerUps.js`.
3. **Colored pizza box variant?** else the blue/purple/red slice weights.
4. **Plain pizza** — whatever probability is left. This is why pizza is always
   the most common drop: it's the remainder.

So the three big per-spawn levers are **bombChance**, **powerUpChance**, and
the leftover that becomes pizza. They compete for the same 0→1 space — raise
one and you shrink pizza.

Two more levers aren't about *what* drops but *how hard it is to deal with*:
**`fallSpeedFrac`** (how fast it falls = how much reaction time) and
**`spawnIntervalSec`** (how often things drop = how crowded the screen is).

---

## 2. The knobs, and which way is "harder"

| Knob | Where | ↑ raise it = | Feel it controls |
|---|---|---|---|
| `fallSpeedFrac` | stages.js | **harder** | reaction time (fast = twitchy) |
| `spawnIntervalSec` | stages.js | **easier** (bigger gap) | screen density / breathing room |
| `bombChance` | stages.js | **harder** | how punishing / tense |
| `powerUpChance` | stages.js | **easier** | how much help you get |
| power-up `weight` | powerUps.js | — | *which* help (shield vs wave vs magnet) |
| box variant weights | boxColors.js | — | how often the "interesting" colored goals appear |
| `advanceScore` / `advanceTimeSec` | stages.js | later = **longer** at that difficulty | pacing of the ramp |

**Difficulty** lives mostly in `fallSpeedFrac`, `spawnIntervalSec`, `bombChance`.
**Interest** lives in the *variety* of the drop mix — the colored pizza-box goals
and the power-ups. A game gets boring when the mix is flat (all plain pizza) or
when there's no goal beyond "don't die." Keep some colored-box weight and a
couple of flashy power-ups (wave/magnet) in the mix and there's always something
to chase, not just avoid.

---

## 3. Current curve (after the 2026-08-02 pass)

| Stage | interval | fallSpeed | bombChance | powerUpChance | advance at |
|---|---|---|---|---|---|
| 1 Rooftop | 1.40s | 0.16 | 20% | **16%** ← most help | 150 pts / 45s |
| 2 Fire Escape | 1.15s | 0.21 | 28% | 13% | 400 pts / 100s |
| 3 Alley | 0.95s | 0.26 | 35% | 14% | (holds — final) |

Difficulty climbs by three things at once each stage: items fall **faster**,
drop **more often**, and are **more likely to be bombs**. Stage 1 deliberately
has the **highest** power-up rate so a new player gets the most help while
learning; it tapers after.

**What each spawn actually is, per stage** (measured, 200k-roll simulation):

| Stage | bomb | shield | wave | magnet | plain pizza | colored boxes | → a shield about every |
|---|---|---|---|---|---|---|---|
| Rooftop | 20% | **9.6%** | 3.6% | 2.9% | 54% | 10% | **15s** |
| Fire Escape | 28% | 7.9% | 2.9% | 2.3% | 48% | 10% | 15s |
| Alley | 35% | 8.5% | 3.0% | 2.6% | 41% | 10% | 11s |

---

## 4. The power-up mix (`powerUps.js`)

`powerUpChance` decides *that* a power-up drops; the `weight` values decide
*which*. They're relative shares, not percentages:

- **ooze — DISABLED** (weight 0). It never drops, and its old share was folded
  into shield. To bring it back: give it a weight again and trim shield's.
- **shield — weight 0.60** (dominant). ≈60% of all power-ups are shields.
- **wave — 0.22**, **magnet — 0.18** — the rarer "flashy" ones, kept for variety.

To make shields even more common early without touching other stages, raise
**stage 1's `powerUpChance`** (it's the early-game help dial). To change the
shield-vs-wave-vs-magnet balance everywhere, change the **weights**.

---

## 5. Quick recipes

- **"Too hard early"** → raise stage 1 `spawnIntervalSec` (more gap) or lower
  `bombChance`, or raise `powerUpChance` (more shields).
- **"Too easy / boring"** → lower `spawnIntervalSec`, raise `fallSpeedFrac` or
  `bombChance`; add interest by raising colored-box weights (boxColors.js) so
  more goals appear, not just more danger.
- **"Ramp too fast/slow"** → move `advanceScore` / `advanceTimeSec`.
- **"Want more/less of a specific power-up"** → change its `weight` in
  powerUps.js.

Every number is directional — tune against real on-device feel.
