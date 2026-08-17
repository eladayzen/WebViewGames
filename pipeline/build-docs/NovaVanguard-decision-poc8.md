# Nova Vanguard — POC-8 decision note

Required by `NovaVanguard.md` §10: *"The outcome is written down before any MVP
work starts — record the chosen mode, the metric values that decided it, and any
tuning changes it implies, and set `FRAMING_MODE` accordingly."*

Date: 2026-08-16

---

## Decision: Mode S (scrolling surface) wins

Amit played the POC build with the full art pass wired in, toggling between the
two modes live via `M`, and called it:

> "I think the s-scroll mode, the different mode is much better."

**`FRAMING_MODE` is set to Mode S. MVP is built in Mode S.**

Per §10, **Mode A's code path is not deleted.** It stays behind the one config
flag; keeping it costs nothing and it remains available for comparison.

### How it was decided — be honest about this

This was a **subjective call made by the product owner on a played build**, not a
verdict read off the four instrumented POC-8 metrics. The instrumentation ran and
the constraints validator reported *pacing contract OK — 0 warnings, 6 notes,
both framing modes checked*, but the metric values were not the deciding input;
feel was.

That is a legitimate way to settle this question — the whole reason the POC built
both modes behind a toggle was to replace a paper argument with a played one —
but it should not be recorded as something it wasn't. Two consequences:

- The POC-8 acceptance criteria were **not** formally evaluated. In particular
  Mode S's stated risk — that the scroll induces *vertical drift-chasing* after
  ground pickups — has not been measured, only not-noticed. §5.6's lateral-only
  lure caps and the re-offer rule stay mandatory, and this risk should be
  re-checked in the on-device tuning pass (MVP item 23d, which already calls for
  exactly this).
- No tuning changes are implied by the decision itself. Mode S's specced pacing
  constraints stand as written: `APPROACH_BUDGET` 300 px/s, `SCROLL_SPEED`
  135 px/s (45%, hard cap 50%), Mode S pattern descent capped at 165 px/s.

---

## Change to §7.2 — inter-sector flow: continue by default

Raised by Amit while playing, and adopted. He asked for a level-complete beat
with a countdown into the next level, for two reasons: so finishing a sector
feels like finishing something, and so the surface swap has somewhere to happen.

Most of that is **already designed** — §7.2's results tally, the diegetic loading
console, and the 3 s auto-advancing sector briefing with its surface art strip.
What follows is the part that is genuinely new, plus the rationale the original
design was missing.

### 1. The default action on the results screen becomes CONTINUE, not exit

As specced, results offers `NEXT SECTOR / RETRY / SECTOR SELECT` with a **12 s
auto-timeout back to title**. That is a menu whose default outcome is *quit*.

**This contradicts the design's own rule.** §7.2 requires the sector briefing to
auto-advance specifically to preserve "the required no-key-press path to
playable" — because **on a balance board there is no thumb**. The results screen
breaks that rule: a player who has just cleared a sector and cannot conveniently
press anything is returned to the title screen rather than continuing.

**Change:** the results screen auto-advances into the **next sector** on a
**3–5 s countdown**, shown as a visible countdown so the player knows what will
happen. Any input skips it immediately. `RETRY` and `SECTOR SELECT` remain
available as explicit choices for anyone who does press something.

The 12 s timeout-to-title behaviour is **retained only for the end of the
campaign and for a failed run** — the walk-up-queue-stall problem it solves is
real, but it is the wrong default mid-campaign.

### 2. The pause is a rest beat, and should be treated as one

The original design frames the inter-sector gap as a UI transition. On a physical
product it is also **recovery time**: the player has been leaning on a board for
a 90–140 s sector. This is a reason to keep the gap a real pause rather than
trimming it to the minimum a UI would want.

### 3. This makes the far-void seam optional rather than load-bearing

§5.2/§5.4 transition surfaces via the far-void layer at the sector seam. With a
covering screen between sectors, that seam becomes **polish rather than a
dependency** — which de-risks MVP item 9. Build the screen-covered swap first;
add the diegetic fly-across seam after, if it earns its place.

### 4. Budget: do not let the sequence stack

Tally + console + briefing + countdown can easily reach 15–20 s of non-play
between 90–140 s sectors, and §8.3 already worries about walk-up queue time.

- **Every sector, not every second sector.**
- **The tally IS the reward beat** — do not add a separate "LEVEL COMPLETE"
  flourish on top of it.
- Target the whole inter-sector sequence at **≤ 10 s** unskipped.

---

---

## Playtest round 2 — Amit, 2026-08-16, on the POC with both surfaces

Four items. (1) is a structural change to §5.7 and needs a decision on session
length before it is built. (2)–(4) are straightforward.

### 1. Wave taxonomy is re-cut one level deeper

Amit's words:

> "the waves need to be much longer. Or even, I don't know, maybe what you call
> right now wave, like four wave, we don't actually say those waves, those are
> like inner smaller waves. What you call one loop is one wave, and we can use,
> and those even can be a bit longer, and then we can use four loops, I would
> say, to go from level one to level two. Level two has different background."

**New hierarchy:**

| Term | Was | Is now |
|---|---|---|
| **Sub-wave** | what the doc calls a "wave" | one squadron set — the inner beat |
| **Wave** | (didn't exist) — the POC's repeating loop | ~4 sub-waves, and each sub-wave a bit longer |
| **Level / sector** | 4 waves + boss, 90–140 s | **4 waves**, then advance — new surface |

Rename throughout §5.7, §7.1's banners, and `POC_SCENARIO`. What the code calls
`waves[]` today becomes `subWaves[]`.

**The session-length consequence, which needs an explicit call.** Measured from
`tuning.js`: a sub-wave has a 46 s timeout and clears in ~20 s typical, plus
1.2 s banner and 1.4 s gap. So:

- sub-wave ≈ 20–25 s (longer if stretched as requested)
- wave ≈ 4 sub-waves ≈ **90–110 s** — i.e. roughly what the doc called a *sector*
- level ≈ 4 waves ≈ **6–7 minutes**
- five levels ≈ **30+ minutes**

§8.3 already flagged that a 10-minute campaign does not fit one walk-up turn.
At 30+ minutes the five-level campaign is unreachable in a single session, which
collides with per-session campaign unlock — a walk-up player would never see
levels 3–5.

### DECIDED: three levels, not five

Amit's call, 2026-08-16. The campaign is **3 levels ≈ 20 minutes**, keeping the
long waves he asked for while staying reachable by a player who commits to a
session. §8.3's per-session unlock is **unchanged** — this is what makes it
survivable.

Consequences, which are all reductions:

- **§5.4's five surfaces become three.** Ashfall Crust and Kesselring Yards are
  built; **one more to generate**. Pick from the three remaining designs — The
  Bulwark (megastructure armour), Glacis Shelf (ice over a buried facility), The
  Hive Plate (organic chitin). The Bulwark and Glacis Shelf both contrast
  strongly with the two existing surfaces; the Hive Plate is the biggest
  departure in art idiom. Not yet chosen.
- **Five bosses become three** (§6.4, MVP item 16) — a large cut, since bosses
  were the single heaviest line in the asset inventory at 50 of ~202 sprites.
- **§7.2's sector select drops from 5 nodes to 3.**
- The dropped surfaces and bosses move to **Post-MVP**, which already lists
  "more sectors and surfaces" as backlog. Nothing is lost, only deferred.

### Boss placement — working assumption

The doc puts a boss at the end of every sector. Under the new taxonomy the
working assumption is **one boss at the end of each level** (after its 4 waves),
giving 3 bosses total, with the end of a wave marked only by a banner beat and
no combat set-piece. This keeps the boss a genuine event rather than something
seen every 90 seconds. Flagged rather than silently adopted — say so if you
wanted a lighter per-wave beat as well.

### 2. Enemy projectiles need to breathe

> "the projectiles fired by the enemies, they should have a bit of scaling up
> and down and glowing up and down animation to make it feel more live than just
> one sprite."

Runtime scale + additive-glow pulse on enemy projectile sprites. **No new art** —
this is exactly what the rendered idiom buys (§0.3: one sprite plus runtime
transforms). Keep it subtle enough not to disturb bullet-size readability, which
§5.3 sizes deliberately, and keep ownership colour-coding intact (§5.4: enemy
fire orange/magenta, player cyan-white).

### 3. Enemy and placement variation — it reads repetitive

> "We need a bit of variation with the enemies and the enemies placement. At some
> point, it feels a bit too repetitive."

Expected: the POC deliberately ships **one enemy type and F1 only** (`FORMATIONS`
in `tuning.js` has a single entry). MVP items 10–11 already plan the full F1–F5
formation set, B1–B5 patterns, and the 6-type bestiary. **This feedback says pull
that forward** — repetition is the POC's most-felt flaw, so formation and
placement variety should lead MVP rather than follow the director.

Cheapest first cut, no new art: vary squadron side/count/row/delay per sub-wave,
add F2–F3 shapes, and vary entry timing. A second enemy type is the first new art
needed.

### 4. Sub-waves themselves should run a bit longer

Folded into (1). Raise the per-sub-wave duration, not just the count.

---

## What this unblocks

MVP item 9 (sector/wave director) may now start, built in Mode S — but build it
against the **new taxonomy in playtest round 2 §1**, not the doc's original
wave/sector split, and settle the session-length question first.
