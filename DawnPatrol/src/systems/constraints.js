// THE CONSTRAINTS VALIDATOR (§9.5). Runs at boot over all authored data in
// /data and FAILS LOUDLY on any violation -- on screen, because there is no
// devtools console on-device.
//
// This exists because §5.3 is "the numeric heart of the design and the thing
// most likely to be accidentally violated during content authoring". Every rule
// below is asserted in code over the authored data, not just documented.
//
// Rules 1-4 and the stand-still rule live here (they are data checks).
// Rules 5 and 6 -- the one-axis rule and the zero-input rule -- are STATIC
// SOURCE checks and live in tools/constraint-scan.js, wired into vite.config.js
// as a build plugin so they fail the dev server and the production build rather
// than a runtime pass that ships. They are the two rules most likely to be
// quietly violated by a well-meaning "small nudge" six weeks in.

import {
  H_TRIM, H_GAP_MIN, H_RATE_MAX, MAX_REQUIRED_MOVE, REACTION_FLOOR,
  SCROLL_MAX, SCROLL_BASE, SCROLL_CAP, RAMP_DURATION, PLAYER_H_HALF,
  HAZARDS, MIN_HAZARD_BAND, CAP_HAZARDS_ON_SCREEN, CAP_DISTINCT_BANDS,
  CAP_PUFFERS, MIN_GROUP_GAP_SEC, COIN_ARC_MAX_SPAN, HAZARD_GAP_DRIFT_MAX,
  HUD_RECTS, ENTITY_FADE, PROP_TOP_MIN_Y, SEABIRD_H_RANGE, H_LAUNCH,
  DESPAWN_X, SPAWN_X, PUFFER_TELEGRAPH_SEC, PUFFER_CLOSE_MULT,
  PUFFER_MIN_BUDGET, REACTION_SPAN_PX, PLAYER_X, PUFFER_TELEGRAPH_X,
  reactionTimeAt, reachableMoveAt, rampAt,
} from '../data/tuning.js';
import { HAZARD_GROUPS, PUFFER_GROUPS, ALL_GROUPS } from '../data/hazardGroups.js';
import { COIN_ARCS, BARREL_COIN_ARCS, arcSpan, arcPoints } from '../data/coinArcs.js';
import { ZONES } from '../data/zones.js';
import { crestY, troughY } from '../data/faceRail.js';

/** The h intervals a group's bodies occupy, worst case (all simultaneous). */
export function groupIntervals(group, driftSeconds = 0) {
  const out = [];
  for (const b of group.bodies) {
    const spec = HAZARDS[b.type];
    if (!spec) throw new Error(`group ${group.id}: unknown hazard type "${b.type}"`);
    const half = spec.band / 2;
    // Worst case across the drift window: take the union of where it starts and
    // where it ends up.
    const hEnd = b.h + (b.drift || 0) * driftSeconds;
    const lo = Math.min(b.h, hEnd) - half;
    const hi = Math.max(b.h, hEnd) + half;
    out.push([lo, hi]);
  }
  return mergeIntervals(out);
}

function mergeIntervals(list) {
  const s = list.slice().sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const iv of s) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], iv[1]);
    else out.push([iv[0], iv[1]]);
  }
  return out;
}

/** The clear bands in [0,1] left by a set of occupied intervals. */
export function clearBands(intervals) {
  const bands = [];
  let cursor = 0;
  for (const [lo, hi] of intervals) {
    if (lo > cursor) bands.push([cursor, Math.min(lo, 1)]);
    cursor = Math.max(cursor, hi);
    if (cursor >= 1) break;
  }
  if (cursor < 1) bands.push([cursor, 1]);
  return bands.filter((b) => b[1] > b[0]);
}

/** Distance from h to the nearest point inside a band. 0 if already inside. */
function distanceToBand(h, [lo, hi]) {
  if (h < lo) return lo - h;
  if (h > hi) return h - hi;
  return 0;
}

// ---------------------------------------------------------------------------

export function validateAll() {
  const errors = [];
  const warnings = [];

  ruleReactionFloor(errors);
  ruleGapFloor(errors);
  ruleDensityCaps(errors);
  ruleBandDiscipline(errors, warnings);
  ruleStandStill(errors);
  rulePufferBudget(errors);

  return { errors, warnings, ok: errors.length === 0 };
}

// -- rule 1: the reaction floor ---------------------------------------------

function ruleReactionFloor(errors) {
  if (SCROLL_CAP > SCROLL_MAX) {
    errors.push(`R1 SCROLL_CAP ${SCROLL_CAP} exceeds SCROLL_MAX ${SCROLL_MAX}`);
  }
  for (let t = 0; t <= RAMP_DURATION + 30; t += 5) {
    const speed = rampAt('scroll', t);
    const rt = reactionTimeAt(speed);
    if (rt < REACTION_FLOOR - 1e-9) {
      errors.push(`R1 reaction time ${rt.toFixed(3)}s at t=${t}s (speed ${speed.toFixed(0)}) is below REACTION_FLOOR ${REACTION_FLOOR}s`);
    }
    if (speed > SCROLL_MAX + 1e-9) {
      errors.push(`R1 scroll speed ${speed.toFixed(0)} at t=${t}s exceeds SCROLL_MAX ${SCROLL_MAX}`);
    }
  }
}

// -- rule 2: the gap floor --------------------------------------------------

function ruleGapFloor(errors) {
  // Evaluated at the ramp's fastest, which is the least forgiving reachability
  // budget the group will ever be spawned under.
  const speedFast = SCROLL_CAP;
  const reachFast = reachableMoveAt(speedFast);
  const driftWindow = reactionTimeAt(SCROLL_BASE);

  for (const group of ALL_GROUPS) {
    for (const window of [0, driftWindow]) {
      const intervals = groupIntervals(group, window);
      const bands = clearBands(intervals);
      const wide = bands.filter((b) => b[1] - b[0] >= H_GAP_MIN - 1e-9);

      if (!wide.length) {
        const widest = bands.reduce((m, b) => Math.max(m, b[1] - b[0]), 0);
        errors.push(`R2 group "${group.id}" leaves no clear band >= H_GAP_MIN (${H_GAP_MIN}); widest is ${widest.toFixed(3)}`);
        continue;
      }

      // At least one wide band must be REACHABLE from the trim line inside the
      // reaction window. "Never split the face into two gaps neither of which
      // is reachable" (§5.3).
      const dists = wide.map((b) => distanceToBand(H_TRIM, b));
      const nearest = Math.min(...dists);
      if (nearest > reachFast + 1e-9) {
        errors.push(`R2 group "${group.id}" needs a move of ${nearest.toFixed(3)} from trim; only ${reachFast.toFixed(3)} is reachable at SCROLL_CAP`);
      }
      if (nearest > MAX_REQUIRED_MOVE + 1e-9) {
        errors.push(`R2 group "${group.id}" requires a move of ${nearest.toFixed(3)}, above MAX_REQUIRED_MOVE ${MAX_REQUIRED_MOVE}`);
      }
    }

    // A moving gap may move no faster than half the player's traverse rate, so
    // following it is a committed lean rather than a chase (§5.3).
    for (const b of group.bodies) {
      const drift = Math.abs(b.drift || 0);
      const typeMax = HAZARDS[b.type].drift;
      if (drift > HAZARD_GAP_DRIFT_MAX + 1e-9) {
        errors.push(`R2 group "${group.id}" body ${b.type} drifts at ${drift}/s, above HAZARD_GAP_DRIFT_MAX ${HAZARD_GAP_DRIFT_MAX}`);
      }
      if (drift > typeMax + 1e-9) {
        errors.push(`R2 group "${group.id}" body ${b.type} drifts at ${drift}/s, above its own type max ${typeMax}`);
      }
    }
  }
}

// -- rule 3: density caps ---------------------------------------------------

function ruleDensityCaps(errors) {
  for (const group of ALL_GROUPS) {
    if (group.bodies.length !== group.size) {
      errors.push(`R3 group "${group.id}" declares size ${group.size} but has ${group.bodies.length} bodies`);
    }
    if (group.bodies.length > CAP_DISTINCT_BANDS) {
      errors.push(`R3 group "${group.id}" occupies ${group.bodies.length} bands, above CAP_DISTINCT_BANDS ${CAP_DISTINCT_BANDS}`);
    }
    const puffers = group.bodies.filter((b) => b.type === 'puffer').length;
    if (puffers > CAP_PUFFERS) {
      errors.push(`R3 group "${group.id}" has ${puffers} puffers, above CAP_PUFFERS ${CAP_PUFFERS}`);
    }
    if (puffers > 0 && group.bodies.length > 1) {
      errors.push(`R3 group "${group.id}" mixes a puffer with other bodies; the puffer is spawned solo (§5.10)`);
    }
    for (const b of group.bodies) {
      if (HAZARDS[b.type].band < MIN_HAZARD_BAND - 1e-9) {
        errors.push(`R3 hazard type "${b.type}" has band ${HAZARDS[b.type].band}, below MIN_HAZARD_BAND ${MIN_HAZARD_BAND}`);
      }
    }
  }

  // The ramp's own composition must never be able to exceed the on-screen caps
  // or shorten the minimum gap between consecutive groups.
  for (let t = 0; t <= RAMP_DURATION + 30; t += 5) {
    const interval = rampAt('groupInterval', t);
    if (interval < MIN_GROUP_GAP_SEC - 1e-9) {
      errors.push(`R3 group interval ${interval.toFixed(2)}s at t=${t}s is below MIN_GROUP_GAP_SEC ${MIN_GROUP_GAP_SEC}`);
    }
    const size = Math.round(rampAt('groupSize', t));
    // Worst case on screen: how many groups can be in flight at once, times the
    // largest group the ramp allows, plus one puffer.
    const inFlight = Math.ceil(reactionTimeAt(rampAt('scroll', t)) / interval);
    const worst = inFlight * size + CAP_PUFFERS;
    if (worst > CAP_HAZARDS_ON_SCREEN) {
      errors.push(`R3 ramp at t=${t}s can put ${worst} hazards on screen (${inFlight} groups x ${size} + puffer), above CAP_HAZARDS_ON_SCREEN ${CAP_HAZARDS_ON_SCREEN}`);
    }
  }
}

// -- rule 4: band discipline ------------------------------------------------

function ruleBandDiscipline(errors, warnings) {
  for (const group of ALL_GROUPS) {
    for (const b of group.bodies) {
      const half = HAZARDS[b.type].band / 2;
      if (b.h - half < -1e-9 || b.h + half > 1 + 1e-9) {
        errors.push(`R4 group "${group.id}" body ${b.type} at h=${b.h} puts its band outside [0,1]`);
      }
    }
  }

  for (const arc of COIN_ARCS) {
    const { lo, hi, span } = arcSpan(arc);
    if (span > COIN_ARC_MAX_SPAN + 1e-9) {
      errors.push(`R4 coin arc "${arc.id}" spans ${span.toFixed(3)} of the face, above COIN_ARC_MAX_SPAN ${COIN_ARC_MAX_SPAN}`);
    }
    if (lo < -1e-9 || hi > 1 + 1e-9) {
      errors.push(`R4 coin arc "${arc.id}" leaves [0,1]: [${lo.toFixed(3)}, ${hi.toFixed(3)}]`);
    }
    if (hi > H_LAUNCH - 1e-9) {
      errors.push(`R4 coin arc "${arc.id}" reaches h=${hi.toFixed(3)}, at or above H_LAUNCH ${H_LAUNCH} -- those coins cannot be taken, reaching the lip launches her`);
    }
  }

  // The barrel's arcs are deliberately exempt from COIN_ARC_MAX_SPAN: §5.7
  // specifies "long serpentine runs across the full interior height", and the
  // interior has no hazards at MVP, so the routing is the reward rather than a
  // risk decision. They still have to stay inside [0,1].
  for (const arc of BARREL_COIN_ARCS) {
    const { lo, hi } = arcSpan(arc);
    if (lo < -1e-9 || hi > 1 + 1e-9) {
      errors.push(`R4 barrel coin arc "${arc.id}" leaves [0,1]: [${lo.toFixed(3)}, ${hi.toFixed(3)}]`);
    }
  }

  // HUD-exclusion rects (§5.1). Sample the rail across the full travel and
  // assert that no point an entity can occupy lands inside one.
  const faceY = (x, h) => {
    const t = troughY(x), c = crestY(x);
    return t + (c - t) * h;
  };
  for (const [name, r] of Object.entries(HUD_RECTS)) {
    for (let x = DESPAWN_X; x <= SPAWN_X + 1e-9; x += 0.01) {
      if (x < r.x0 - 1e-9 || x > r.x1 + 1e-9) continue;
      // Entities are faded out entirely before the left-edge rect, so only x
      // beyond the fade-out point counts as "an entity can be here".
      if (x < ENTITY_FADE.end) continue;
      for (let h = 0; h <= 1.0001; h += 0.02) {
        const y = faceY(x, h);
        if (y >= r.y0 - 1e-9 && y <= r.y1 + 1e-9) {
          errors.push(`R4 face point (x=${x.toFixed(2)}, h=${h.toFixed(2)}) lands inside the "${name}" HUD-exclusion rect at y=${y.toFixed(3)}`);
          x = SPAWN_X + 1; h = 2; break;
        }
      }
    }
  }

  // The seabird flies in the sky band and must clear the TOP RUN rect for its
  // whole traversal -- this is the report's one explicit HUD criticism of the
  // reference (a pelican behind the panel) and we do not repeat it.
  const r = HUD_RECTS.topRun;
  for (let x = r.x0; x <= SPAWN_X + 1e-9; x += 0.01) {
    const y = faceY(x, SEABIRD_H_RANGE[1]);
    if (y <= r.y1 + 1e-9) {
      errors.push(`R4 seabird at max h=${SEABIRD_H_RANGE[1]} reaches y=${y.toFixed(3)} at x=${x.toFixed(2)}, inside the TOP RUN rect`);
      break;
    }
  }

  // Entities scroll leftward, so they must have reached zero alpha at an x
  // that is still to the RIGHT of the slots rect's right edge.
  if (ENTITY_FADE.end < HUD_RECTS.slots.x1 - 1e-9) {
    errors.push(`R4 ENTITY_FADE.end ${ENTITY_FADE.end} is left of the slots rect edge ${HUD_RECTS.slots.x1}; entities would still be visible behind the multiplier slots`);
  }
  if (ENTITY_FADE.start <= ENTITY_FADE.end) {
    errors.push('R4 ENTITY_FADE.start must be to the right of ENTITY_FADE.end');
  }

  if (PROP_TOP_MIN_Y < HUD_RECTS.topRun.y1 - 1e-9) {
    errors.push(`R4 PROP_TOP_MIN_Y ${PROP_TOP_MIN_Y} is above the TOP RUN rect bottom ${HUD_RECTS.topRun.y1}; props could pass behind the panel`);
  }

  for (const z of ZONES) {
    if (z.skyBandCeiling != null && z.skyBandCeiling >= 0.06 - 1e-9) {
      errors.push(`R4 zone "${z.id}" ceiling bottoms out at y=${z.skyBandCeiling}, intruding into the airborne arc peak at y=0.06 (§5.9)`);
    }
  }
}

// -- the stand-still rule (§5.3) --------------------------------------------

function ruleStandStill(errors) {
  const trimLo = H_TRIM - PLAYER_H_HALF;
  const trimHi = H_TRIM + PLAYER_H_HALF;
  const driftWindow = reactionTimeAt(SCROLL_BASE);

  for (const group of ALL_GROUPS) {
    if (group.tier !== 'base') continue;
    // Sample the whole drift window, not just its endpoints: a body that
    // crosses the trim band and comes back out would pass an endpoints-only
    // check and still wipe out a player who never leaned.
    // A puffer is on screen for its whole telegraph-plus-close budget, which is
    // longer than one reaction window, so its drift gets the longer window.
    const window = group.bodies.some((b) => b.type === 'puffer')
      ? Math.max(driftWindow, PUFFER_MIN_BUDGET)
      : driftWindow;
    for (let s = 0; s <= window + 1e-9; s += window / 16) {
      for (const b of group.bodies) {
        const half = HAZARDS[b.type].band / 2;
        const h = b.h + (b.drift || 0) * s;
        if (h + half > trimLo && h - half < trimHi) {
          errors.push(`R5 base-tier group "${group.id}" body ${b.type} crosses the trim band at t+${s.toFixed(2)}s (h=${h.toFixed(3)}); a player who never leans would be wiped out, breaking the stand-still rule`);
          s = window + 1;
          break;
        }
      }
    }
  }

  if (!PUFFER_GROUPS.some((g) => g.tier === 'base')) {
    errors.push('R5 there are no base-tier puffer templates, but the puffer starts spawning before STAND_STILL_SEC; a standing player would be wiped out by the set-piece');
  }
  if (!HAZARD_GROUPS.some((g) => g.tier === 'base')) {
    errors.push('R5 there are no base-tier hazard groups; the stand-still window would have nothing to spawn');
  }
}

// -- the urchin-puffer's telegraph budget (§6.2) ----------------------------

/**
 * How long the puffer holds station at PUFFER_TELEGRAPH_X, for a given scroll
 * speed.
 *
 * WHY THIS IS A FUNCTION AND NOT JUST THE CONSTANT. §6.2 authors three numbers
 * -- station at x=0.92, a 1.5 s hold, a close at 1.35x the scroll -- and
 * separately states a hard floor: "its total budget from first appearance to
 * contact is >= 2.6 s". Those four numbers are consistent at SCROLL_BASE
 * (2.91 s) but NOT at SCROLL_CAP, where they come out at 2.49 s. Since §5.10 is
 * explicit that reaction-time floors are floors and not levers, while nothing
 * forbids a telegraph being LONGER, the floor wins: the hold is extended just
 * far enough to keep the total budget at PUFFER_MIN_BUDGET, and never shortened
 * below the authored 1.5 s. Flagged in the build report as a doc-number
 * tension resolved conservatively rather than silently.
 */
export function pufferTelegraphFor(speed) {
  const toStation = ((SPAWN_X - PUFFER_TELEGRAPH_X) * 1920) / speed;
  const close = ((PUFFER_TELEGRAPH_X - PLAYER_X) * 1920) / (speed * PUFFER_CLOSE_MULT);
  return Math.max(PUFFER_TELEGRAPH_SEC, PUFFER_MIN_BUDGET - toStation - close);
}

function rulePufferBudget(errors) {
  for (const speed of [SCROLL_BASE, SCROLL_CAP]) {
    // It appears at the spawn edge, rides in to its station, holds there with
    // the ! bubble, then closes at PUFFER_CLOSE_MULT x the scroll.
    const toStation = ((SPAWN_X - PUFFER_TELEGRAPH_X) * 1920) / speed;
    const close = ((PUFFER_TELEGRAPH_X - PLAYER_X) * 1920) / (speed * PUFFER_CLOSE_MULT);
    const telegraph = pufferTelegraphFor(speed);
    const budget = toStation + telegraph + close;
    if (telegraph < PUFFER_TELEGRAPH_SEC - 1e-9) {
      errors.push(`R6 urchin-puffer telegraph is ${telegraph.toFixed(2)}s at scroll ${speed}, shorter than the authored ${PUFFER_TELEGRAPH_SEC}s. The ramp may never shorten a telegraph (§5.10).`);
    }
    if (budget < PUFFER_MIN_BUDGET - 1e-9) {
      errors.push(`R6 urchin-puffer total budget is ${budget.toFixed(2)}s at scroll ${speed}, below PUFFER_MIN_BUDGET ${PUFFER_MIN_BUDGET}s`);
    }
  }
  if (!PUFFER_GROUPS.length) errors.push('R6 no puffer templates authored');
}

// -- runtime assertions (§9.5's closing note) -------------------------------

/**
 * Cheap invariants checked every frame in dev builds: h bounds, hazards on
 * screen, banner queue depth. Returns a list of violations (usually empty).
 */
export function runtimeAssertions(state) {
  const out = [];
  if (state.player.h < -1e-6 || state.player.h > H_LAUNCH + 1e-6) {
    out.push(`h out of bounds: ${state.player.h}`);
  }
  const live = state.hazards.filter((e) => e.active).length;
  if (live > CAP_HAZARDS_ON_SCREEN + CAP_PUFFERS) {
    out.push(`${live} hazards live, above the ${CAP_HAZARDS_ON_SCREEN}+puffer cap`);
  }
  if (state.bannerQueueDepth > 3) {
    out.push(`banner queue depth ${state.bannerQueueDepth} above 3`);
  }
  return out;
}

export const _internals = { groupIntervals, clearBands, arcPoints, REACTION_SPAN_PX };
