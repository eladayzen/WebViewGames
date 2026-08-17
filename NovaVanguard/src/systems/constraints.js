// The constraints validator (§9.4) -- "build this early, it pays for itself".
//
// Runs at boot over ALL authored data in /data and fails loudly on any
// violation. Crucially it checks BOTH framing modes, not just the active one:
// the content is shared between them by design (§5.2), so a wave that is
// legal in Mode A and illegal in Mode S is a real bug that would otherwise
// only surface after someone flips the toggle on a board.
//
// "Every one of these is a rule this document states in prose and that content
// authoring will otherwise quietly violate around sector 4 at 11pm."
//
// POC-6 requires at least rules 1, 2 and 4. All five are implemented; rule 5
// is trivially satisfied at POC (no pickups exist yet) but is written now so
// MVP's pickup work inherits it rather than retrofitting it.

import {
  APPROACH_BUDGET,
  REACTION_GAP_PX,
  REACTION_FLOOR_S,
  SCROLL_SPEED,
  SCROLL_SPEED_HARD_CAP,
  AISLE_MIN,
  AISLE_MOVE_MAX,
  PATTERNS,
  PATTERN_DESCENT_HARD_CAP,
  MODES,
  DENSITY_CAPS,
  POC_ENEMY_CAP_OVERRIDE,
  ENEMY,
  enemyDef,
  BOSS,
  INPUT,
  FORMATIONS,
  FORMATION_X,
  PLAYABLE_X,
  PLAYER_CLAMP_X,
  PLAYER_CLAMP_Y,
  PLAYER,
  BANDS,
  BANNER_Y,
  BANNER_Y_BOSS,
  POC_SCENARIO,
  LATERAL_ONLY_TEST_Y,
  FX,
  DESIGN_W,
  DESIGN_H,
  PICKUPS,
  TELEGRAPH,
  WEAPONS,
  FIRE_HOLD,
  LEVELS,
} from '../data/tuning.js';
// Pure geometry, no world state -- the validator runs at boot, before a world
// exists, and calls these exactly as the game does so the two cannot diverge.
import { slotPosition, slotCount } from '../enemies/enemies.js';
import { bossGeometry } from '../enemies/boss.js';
import { BOSSES, bossIsHullBoss } from '../data/bosses.js';
import { SURFACES } from '../data/surfaces.js';

const TWO_PI = Math.PI * 2;

export function validateAll(opts = {}) {
  const errors = [];
  const warnings = [];
  const notes = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  // =========================================================================
  // Rule 1 -- the reaction floor (§5.3)
  // "every pattern's and entity's maximum downward velocity component, plus
  //  the active mode's scroll speed, is <= APPROACH_BUDGET"
  // =========================================================================

  const trueBudget = REACTION_GAP_PX / REACTION_FLOOR_S;
  if (APPROACH_BUDGET > trueBudget + 0.001) {
    err(
      `R1: APPROACH_BUDGET ${APPROACH_BUDGET} exceeds the derived floor ` +
        `${trueBudget.toFixed(1)} (${REACTION_GAP_PX}px / ${REACTION_FLOOR_S}s)`
    );
  }

  if (SCROLL_SPEED > SCROLL_SPEED_HARD_CAP) {
    err(
      `R1: SCROLL_SPEED ${SCROLL_SPEED} exceeds its absolute cap ` +
        `${SCROLL_SPEED_HARD_CAP} (50% of the approach budget)`
    );
  }

  for (const id of Object.keys(MODES)) {
    const m = MODES[id];

    // The per-mode share of the budget must be exactly what is left after the
    // scroll takes its cut. The scroll counts against the budget uniformly,
    // for everything with a downward component -- including air projectiles,
    // which is the part most likely to get "optimised" away.
    const expected = APPROACH_BUDGET - m.scrollSpeed;
    if (Math.abs(m.patternDescentCap - expected) > 0.5) {
      err(
        `R1[${id}]: patternDescentCap ${m.patternDescentCap} != ` +
          `APPROACH_BUDGET - scroll (${expected})`
      );
    }

    const hard = PATTERN_DESCENT_HARD_CAP[id];
    if (m.patternDescentTuned > hard) {
      err(`R1[${id}]: tuned descent ${m.patternDescentTuned} > hard cap ${hard}`);
    }
    if (m.patternDescentTuned + m.scrollSpeed > APPROACH_BUDGET) {
      err(
        `R1[${id}]: effective approach ${m.patternDescentTuned}+${m.scrollSpeed}` +
          ` exceeds ${APPROACH_BUDGET}`
      );
    }

    // The floor applies to swoop descent too (§5.5).
    if (m.swoopDescentSpeed + m.scrollSpeed > APPROACH_BUDGET) {
      err(
        `R1[${id}]: swoop descent ${m.swoopDescentSpeed}+${m.scrollSpeed} ` +
          `exceeds ${APPROACH_BUDGET}`
      );
    }
    // ...and the resulting swoop must still fit its authored duration window.
    // Measured from the band bottom, which is where §5.5 starts the clock --
    // the peel-out from the slot down to that line is a separate, uncounted
    // phase (see ENEMY.swoop.startY in tuning.js).
    const startY = ENEMY.swoop.startY * DESIGN_H;
    const dip = ENEMY.swoop.minY * DESIGN_H;
    const descentS = (dip - startY) / m.swoopDescentSpeed;
    const total = descentS + ENEMY.swoop.returnS;
    if (total < ENEMY.swoop.durationS[0] || total > ENEMY.swoop.durationS[1]) {
      warn(
        `R1[${id}]: deepest swoop takes ${total.toFixed(2)}s, outside the ` +
          `authored ${ENEMY.swoop.durationS[0]}-${ENEMY.swoop.durationS[1]}s window`
      );
    }

    // The entry path's own vertical loop is a downward component too.
    const shortest = ENEMY.entry.durationS[0];
    const loopPeak = (m.entryLoopAmp * DESIGN_H * TWO_PI) / shortest;
    if (loopPeak > m.patternDescentCap) {
      warn(
        `R1[${id}]: authored entryLoopAmp ${m.entryLoopAmp} peaks at ` +
          `${loopPeak.toFixed(0)} px/s on the shortest entry ` +
          `(cap ${m.patternDescentCap}); it will be clamped at spawn`
      );
    }
  }

  // =========================================================================
  // Rule 2 -- the aisle floor (§5.3)
  // =========================================================================

  for (const key of Object.keys(PATTERNS)) {
    const p = PATTERNS[key];
    if (!(p.guaranteedAisle >= AISLE_MIN)) {
      err(
        `R2[${p.id}]: guaranteed aisle ${p.guaranteedAisle} < AISLE_MIN ${AISLE_MIN}`
      );
    }
    if (p.aisleMoveSpeed > AISLE_MOVE_MAX) {
      err(
        `R2[${p.id}]: aisle moves at ${p.aisleMoveSpeed} > ${AISLE_MOVE_MAX} px/s`
      );
    }
    if (p.orbRadius < DENSITY_CAPS.normal.minBulletRadius) {
      err(
        `R2[${p.id}]: orb radius ${p.orbRadius} below the minimum readable ` +
          `${DENSITY_CAPS.normal.minBulletRadius}`
      );
    }
  }

  // B2's aisle is produced by omitting orbs within half a gap of the gap
  // centre. Verify the geometry actually yields the declared clear span,
  // rather than trusting the emitter's arithmetic.
  {
    const d = PATTERNS.B2;
    const half = d.guaranteedAisle * 0.5 + d.orbRadius;
    const clearSpan = 2 * (half - d.orbRadius);
    if (clearSpan < AISLE_MIN) {
      err(
        `R2[B2]: emitted clear span ${clearSpan.toFixed(0)} < AISLE_MIN ${AISLE_MIN}`
      );
    }
    // A row whose orbs are spaced further apart than the authored aisle has
    // incidental gaps wider than the guaranteed one. That is safe (more ways
    // through), but worth stating so nobody "fixes" it by tightening spacing.
    const incidental = d.orbSpacing - 2 * d.orbRadius;
    if (incidental >= AISLE_MIN) {
      notes.push(
        `B2 orb spacing ${d.orbSpacing} leaves incidental ${incidental.toFixed(0)}px ` +
          `gaps as well as the authored ${d.guaranteedAisle.toFixed(0)}px one — ` +
          `sparse by construction, which is the intent`
      );
    }
  }

  // The enemy-projectile breathe (playtest round 2 §2) must not undercut the
  // bullet sizing §5.3 chose against the reaction budget. The pulse is authored
  // one-sided so the drawn orb is never smaller than its authored radius; that
  // is a property of the numbers, so assert it rather than trusting the
  // comment. A +/- swing here would silently shrink every orb below its own
  // hitbox for half of every cycle.
  {
    const p = FX.enemyBulletPulse;
    if (p.scaleAmp < 0) {
      err(`R2: enemyBulletPulse.scaleAmp ${p.scaleAmp} is negative — the pulse ` +
        `must swing upward only, never below the authored radius`);
    }
    if (p.scaleAmp > 0.25) {
      warn(`R2: enemyBulletPulse.scaleAmp ${p.scaleAmp} grows orbs by more than ` +
        `25%, which starts to read as a size change rather than a glow`);
    }
    if (p.glowMin <= 0.5) {
      warn(`R2: enemyBulletPulse.glowMin ${p.glowMin} dims orbs past half ` +
        `opacity at the trough — enemy fire must stay legible at all times`);
    }
  }

  // Reachability (§5.3): worst case is the aisle at one clamp and the player
  // at the other. Check the pattern can be answered from a standing start.
  for (const id of Object.keys(MODES)) {
    const m = MODES[id];
    const spawnY = BANDS.formation.bottom * DESIGN_H * 0.72;
    const tti = (LATERAL_ONLY_TEST_Y * DESIGN_H - spawnY) / m.patternDescentTuned;
    const reach = 840 * (tti - 0.25);
    const worstGap = (PLAYER_CLAMP_X.max - PLAYER_CLAMP_X.min) * DESIGN_W;
    if (reach < worstGap * 0.5) {
      warn(
        `R2[${id}]: reachable lateral distance ${reach.toFixed(0)}px is under ` +
          `half the player's clamp span (${(worstGap * 0.5).toFixed(0)}px); ` +
          `B2 clamps its aisle into reach at commit, but a future full-width ` +
          `pattern would violate the aisle`
      );
    }
  }

  // =========================================================================
  // Rule 3 -- density caps (§5.3)
  // =========================================================================

  const caps = { ...DENSITY_CAPS.normal, enemies: POC_ENEMY_CAP_OVERRIDE };

  for (const id of Object.keys(MODES)) {
    const m = MODES[id];
    for (const wave of POC_SCENARIO.waves) {
      if (wave.patterns.length > caps.simultaneousPatterns) {
        err(
          `R3[${id}/${wave.name}]: ${wave.patterns.length} simultaneous ` +
            `patterns > cap ${caps.simultaneousPatterns}`
        );
      }

      // Theoretical peak concurrent bullets: per-volley count x how many
      // volleys can be alive at once (lifetime / interval).
      let peak = 0;
      for (const pid of wave.patterns) {
        const p = PATTERNS[pid];
        const spawnY =
          pid === 'B2' ? BANDS.formation.bottom * DESIGN_H * 0.72 : DESIGN_H * 0.13;
        const lifetime = (1.02 * DESIGN_H - spawnY) / m.patternDescentTuned;
        let perVolley;
        if (pid === 'B1') {
          perVolley = p.orbs;
        } else {
          const usable = (PLAYABLE_X.max - PLAYABLE_X.min) * DESIGN_W;
          const perRow = Math.ceil(usable / p.orbSpacing);
          perVolley = p.rows * perRow;
        }
        peak += perVolley * Math.max(1, Math.ceil(lifetime / p.volleyIntervalS));
      }
      if (peak > caps.bullets) {
        err(
          `R3[${id}/${wave.name}]: theoretical peak ${peak} bullets > cap ` +
            `${caps.bullets}`
        );
      }

      // Craft-owned patterns count against the simultaneous-pattern cap too
      // (§5.3), because /patterns pools all three sources into one budget.
      // An Emitter is a pattern the wave is authoring, whether or not the
      // wave says so in `patterns`.
      let owned = 0;
      for (const sq of wave.squadrons) {
        if (!sq.types) continue;
        for (const k of Object.keys(sq.types)) {
          if (enemyDef(sq.types[k]).pattern) owned++;
        }
      }
      if (owned > 0) {
        notes.push(
          `${wave.name} authors ${wave.patterns.length} wave pattern(s) + ` +
            `${owned} craft-owned; /patterns caps concurrent firing at ` +
            `${caps.simultaneousPatterns}, so ` +
            `${Math.max(0, wave.patterns.length + owned - caps.simultaneousPatterns)}` +
            ` hold fire until a slot frees`
        );
      }

      let craft = 0;
      for (const sq of wave.squadrons) craft += sq.count;
      if (craft > caps.enemies) {
        err(
          `R3[${id}/${wave.name}]: ${craft} authored craft > enemy cap ` +
            `${caps.enemies}`
        );
      }
      if (craft > DENSITY_CAPS.normal.enemies) {
        notes.push(
          `${wave.name} authors ${craft} craft, above Normal's documented ` +
            `${DENSITY_CAPS.normal.enemies}-enemy cap — running under the ` +
            `POC_ENEMY_CAP_OVERRIDE (${POC_ENEMY_CAP_OVERRIDE}) documented ` +
            `deviation. NEEDS A STAGE-3 RESOLUTION (see tuning.js).`
        );
      }
    }
  }

  // =========================================================================
  // Rule 4 -- band discipline (§5.1, §9.4)
  // =========================================================================

  {
    // EVERY SLOT OF EVERY SHAPE, walked through the same geometry function the
    // game uses -- not a per-shape hand-check. F2's ellipse and F3's chevron
    // were added to answer playtest round 2's repetition note, and the whole
    // reason adding a shape is safe is that a slot which drifted out of the
    // formation band, or overlapped its neighbour, fails here at boot rather
    // than being spotted (or not) by eye at 11pm.
    // Sized against the TALLEST and FATTEST types, whichever they are, rather
    // than against the drone -- band discipline has to hold for whatever
    // actually occupies the slot.
    //
    // This check used to approximate vertical extent with `spriteWidth`, which
    // was wrong in both directions: it under-reported the drone (117 px tall,
    // 92 wide) and would have over-reported the Emitter (90 tall, 118 wide).
    // Correcting it exposed a latent violation in the authored formation rows,
    // which are nudged a few pixels down in tuning.js -- see the note there.
    let tallest = 0;
    let fattest = 0;
    for (const id of Object.keys(ENEMY.types)) {
      tallest = Math.max(tallest, ENEMY.types[id].spriteHeight);
      fattest = Math.max(fattest, ENEMY.types[id].radius);
    }
    // No bob term: per-craft vertical motion was tried and removed because the
    // authored rows have ~2 px of slack (see ENEMY.vary). If it is ever
    // reintroduced, its amplitude belongs in this number.
    const halfH = tallest * 0.5;
    const bandTop = BANDS.formation.top * DESIGN_H;
    const bandBottom = BANDS.formation.bottom * DESIGN_H;

    for (const fid of Object.keys(FORMATIONS)) {
      const n = slotCount(fid);
      let minSep = Infinity;
      let prev = null;
      for (let s = 0; s < n; s++) {
        const p = slotPosition(fid, s);
        const x = p.x;
        const y = p.y;
        if (y - halfH < bandTop) {
          err(
            `R4[${fid}]: slot ${s} (y=${y.toFixed(0)}) overlaps the entry/HUD ` +
              `bands above ${bandTop.toFixed(0)}`
          );
        }
        if (y + halfH > bandBottom) {
          err(
            `R4[${fid}]: slot ${s} (y=${y.toFixed(0)}) spills into the transit ` +
              `gutter below ${bandBottom.toFixed(0)}`
          );
        }
        if (x < FORMATION_X.min * DESIGN_W - 0.5 || x > FORMATION_X.max * DESIGN_W + 0.5) {
          err(
            `R4[${fid}]: slot ${s} (x=${x.toFixed(0)}) is outside the ` +
              `formation layout bounds`
          );
        }
        // Craft must stay individually countable -- a formation whose slots
        // overlap reads as one mass and the pre-lock kill window stops being
        // a legible offer (§5.5).
        if (prev) {
          const d = Math.hypot(x - prev.x, y - prev.y);
          if (d < minSep) minSep = d;
        }
        prev = { x, y };
      }
      if (minSep < fattest * 2) {
        err(
          `R4[${fid}]: adjacent slots are ${minSep.toFixed(0)}px apart, inside ` +
            `two of the fattest type's radii (${fattest * 2}px) — craft would overlap`
        );
      }
      if (n > POC_ENEMY_CAP_OVERRIDE) {
        err(`R4[${fid}]: ${n} slots exceeds the simultaneous-craft cap ${POC_ENEMY_CAP_OVERRIDE}`);
      }
    }

    // NOT CHECKED, and deliberately so: a formation does not declare a
    // traversable aisle. §5.3's aisle floor is a property of BULLET PATTERNS
    // (rule 2 above walks every one of them), because the aisle is the thing
    // the player steers through. Formations sit in the top band and are never
    // traversed — F1's own 12 columns are only ~48px apart, far under
    // AISLE_MIN, and that is correct rather than a violation. What a formation
    // owes the contract is band discipline, layout bounds and slot separation,
    // which is what is asserted above.

    // Formations are laid out inside x in [0.10, 0.90], and the whole-formation
    // drift must not push the outermost slot into a HUD margin.
    const driftAmp = Math.min(
      ENEMY.formationDriftMax * (ENEMY.formationDriftPeriodS / TWO_PI),
      0.04 * DESIGN_W
    );
    if (FORMATION_X.min * DESIGN_W - driftAmp < PLAYABLE_X.min * DESIGN_W) {
      err(`R4: formation drift (${driftAmp.toFixed(0)}px) pushes slots into the left margin`);
    }
    if (FORMATION_X.max * DESIGN_W + driftAmp > PLAYABLE_X.max * DESIGN_W) {
      err(`R4: formation drift (${driftAmp.toFixed(0)}px) pushes slots into the right margin`);
    }
    if (ENEMY.formationDriftMax > 60) {
      err(`R4: formation drift ${ENEMY.formationDriftMax} px/s exceeds the 60 px/s cap`);
    }
  }

  if (ENEMY.swoop.startY > BANDS.formation.bottom) {
    err(
      `R4: swoop startY ${ENEMY.swoop.startY} is below the formation band ` +
        `bottom ${BANDS.formation.bottom} — the dip must begin at the band edge`
    );
  }

  // The swoop dips to the TOP of the player band and never into it (§5.5).
  if (ENEMY.swoop.minY >= BANDS.player.top) {
    err(
      `R4: swoop minY ${ENEMY.swoop.minY} reaches the player band top ` +
        `${BANDS.player.top} — the swoop must never enter the player band`
    );
  }
  if (ENEMY.swoop.minWidthTravelled < 0.35) {
    err(`R4: swoop horizontal travel ${ENEMY.swoop.minWidthTravelled} < 0.35 of width`);
  }

  // Entry y range must sit in the enemy half of the frame, never in the gutter.
  if (ENEMY.entry.yRange[1] > BANDS.formation.bottom) {
    err(
      `R4: entry yRange top ${ENEMY.entry.yRange[1]} reaches past the ` +
        `formation band into the gutter`
    );
  }
  if (ENEMY.entry.minWidthCrossed < 0.6) {
    err(`R4: entry path crosses ${ENEMY.entry.minWidthCrossed} < 0.60 of the width`);
  }

  // The transit gutter must stay at or above the 25% floor (§5.1).
  const gutter = BANDS.gutter.bottom - BANDS.gutter.top;
  if (gutter < 0.25) err(`R4: transit gutter ${gutter} below the 0.25 floor`);

  // The player is clamped tighter than the playable width so the craft is
  // never visually under a gauge.
  if (
    PLAYER_CLAMP_X.min < PLAYABLE_X.min ||
    PLAYER_CLAMP_X.max > PLAYABLE_X.max
  ) {
    err(`R4: player clamp escapes the playable width`);
  }

  // ...and tighter than the player band's floor, so the hull stays ON SCREEN
  // at maximum southward travel. This was a real, reported bug -- the craft's
  // bottom ~16% was cut off by the frame edge -- and it is exactly the kind
  // that comes back the moment the art changes size, so it is asserted from
  // the authored sprite height rather than trusted to the clamp's comment.
  {
    const halfH = PLAYER.spriteHeight * 0.5;
    const lowest = PLAYER_CLAMP_Y.max * DESIGN_H + halfH;
    if (lowest > DESIGN_H) {
      err(
        `R4: at its lowest the player sprite reaches y=${lowest.toFixed(0)}, ` +
          `past the ${DESIGN_H} frame edge — ${(lowest - DESIGN_H).toFixed(0)}px ` +
          `of the hull is off screen. Lower PLAYER_CLAMP_Y.max.`
      );
    }
    if (PLAYER_CLAMP_Y.max > BANDS.player.bottom) {
      err(`R4: PLAYER_CLAMP_Y.max ${PLAYER_CLAMP_Y.max} escapes the player band`);
    }
    // The clamp's ceiling is DELIBERATELY above the player band's top edge --
    // §5.6's pickups and §6.4's vulnerable window both sit at y = 0.62, and
    // the band is "where the interceptor lives", not a wall (see
    // PLAYER_CLAMP_Y). What must not happen is the player reaching the
    // ENEMY's space: the formation band is where craft lock and hold, and a
    // player who could fly into it would break the whole read.
    if (PLAYER_CLAMP_Y.min < BANDS.gutter.top) {
      err(
        `R4: PLAYER_CLAMP_Y.min ${PLAYER_CLAMP_Y.min} reaches into the ` +
          `formation band (above ${BANDS.gutter.top}) — the player could fly ` +
          `into the enemy's own space`
      );
    }
    if (PLAYER_CLAMP_Y.min < BANDS.player.top) {
      notes.push(
        `R4: the player may drift to y=${PLAYER_CLAMP_Y.min}, above the band ` +
          `top ${BANDS.player.top}. Intended: §5.6 and §6.4 both place optional ` +
          `rewards at 0.62, and §5.5 wants a drifting player inside a swoop's ` +
          `reach. The reaction gap is measured off the BAND and is unaffected.`
      );
    }
    // The clamp must not have eaten the lateral-only hold line, or §5.3's
    // testable assertion would be checking a position the player cannot reach.
    if (
      LATERAL_ONLY_TEST_Y < PLAYER_CLAMP_Y.min ||
      LATERAL_ONLY_TEST_Y > PLAYER_CLAMP_Y.max
    ) {
      err(
        `R4: the lateral-only hold line y=${LATERAL_ONLY_TEST_Y} is outside ` +
          `the reachable clamp ${PLAYER_CLAMP_Y.min}..${PLAYER_CLAMP_Y.max}`
      );
    }
  }

  // =========================================================================
  // Rule 5 -- the vertical rule (§5.3, §5.6)
  // =========================================================================
  //
  // POC has no pickups (§2), so there is nothing yet to place above y = 0.62
  // or to offset beyond 0.35 of the width. What CAN be checked now is the
  // line the rule is stated against: a player holding y = 0.82 and moving
  // only laterally must be able to clear every wave. Verify that line is
  // inside the player band and that nothing hostile is authored to reach it
  // from above.

  if (
    LATERAL_ONLY_TEST_Y < BANDS.player.top ||
    LATERAL_ONLY_TEST_Y > BANDS.player.bottom
  ) {
    err(`R5: the lateral-only test line ${LATERAL_ONLY_TEST_Y} is outside the player band`);
  }
  if (ENEMY.swoop.minY > LATERAL_ONLY_TEST_Y) {
    err(
      `R5: swoops reach y=${ENEMY.swoop.minY}, past the lateral-only test line ` +
        `${LATERAL_ONLY_TEST_Y} — a player holding that line could not avoid contact`
    );
  }

  // --- pickups (§5.6) -----------------------------------------------------
  // These now exist, so the rule that was written as a placeholder gets teeth.
  // §12 names Mode S's specific failure mode as vertical drift-chasing, and the
  // POC-8 decision note records that it "has not been measured, only
  // not-noticed" -- so every one of §5.6's mitigations is asserted rather than
  // trusted, because the thing they prevent is the most expensive input this
  // product has (§0.5).
  {
    if (PICKUPS.maxOffsetFrac > 0.35 + 1e-9) {
      err(
        `R5: pickup offset cap ${PICKUPS.maxOffsetFrac} exceeds §5.6's 0.35 of ` +
          `the width — a lure past that is a sprint, not a decision`
      );
    }
    // The offset must be crossable well inside the time a canister takes to
    // fall past the player, or the "decision" is one the player cannot act on.
    const travelS = (PICKUPS.maxOffsetFrac * DESIGN_W) / INPUT.lateralMax;
    for (const id of Object.keys(MODES)) {
      const m = MODES[id];
      const fall = m.scrollSpeed > 0 ? m.scrollSpeed : PICKUPS.driftSpeedA;
      // Worst case: born at the bottom of the formation band, collectable
      // until it passes the player's lowest reachable y.
      const dropPx =
        (PLAYER_CLAMP_Y.max - BANDS.formation.bottom) * DESIGN_H +
        PICKUPS.collectRadius;
      const windowS = dropPx / fall;
      if (windowS < travelS + 0.6) {
        err(
          `R5[${id}]: a canister is reachable for ${windowS.toFixed(2)}s but the ` +
            `capped lateral offset takes ${travelS.toFixed(2)}s to cross — the ` +
            `offer would be a sprint`
        );
      }
    }
    // THE VERTICAL RULE, stated as the thing it actually guarantees. A pickup
    // is never a target above y = 0.62; it is born at a kill site and DESCENDS
    // past every y the player can occupy, so collecting one is purely a
    // question of x and no vertical input helps at all.
    if (PICKUPS.maxLureY > BOSS.window.rewardY + 1e-9) {
      err(
        `R5: PICKUPS.maxLureY ${PICKUPS.maxLureY} is above §5.6's y = 0.62 line`
      );
    }
    // Falling past the bottom of the frame is what makes the previous sentence
    // true; a canister that stopped anywhere would become a thing to climb to.
    for (const id of Object.keys(MODES)) {
      const m = MODES[id];
      const fall = m.scrollSpeed > 0 ? m.scrollSpeed : PICKUPS.driftSpeedA;
      if (fall <= 0) {
        err(
          `R5[${id}]: pickups do not descend, so one could come to rest above ` +
            `the player and become a climb`
        );
      }
      if (fall + 0 > APPROACH_BUDGET) {
        err(`R5[${id}]: pickup descent ${fall} exceeds the approach budget`);
      }
    }
    if (PICKUPS.reOfferS > 8 + 1e-9) {
      err(
        `R5: re-offer delay ${PICKUPS.reOfferS}s exceeds §5.6's 8 s — "anything ` +
          `that scrolls past uncollected is re-offered within 8 s"`
      );
    }
    // A re-offered canister enters from the TOP EDGE, which §5.3 requires a
    // telegraph for. The lead has to fit inside the re-offer delay or the
    // marker would fire before the canister was even scheduled.
    if (TELEGRAPH.leadS >= PICKUPS.reOfferS) {
      err(
        `R5: the entry telegraph's ${TELEGRAPH.leadS}s lead does not fit inside ` +
          `the ${PICKUPS.reOfferS}s re-offer delay`
      );
    }
    // The expected yield, printed rather than asserted -- "about two in level
    // one" is a design target that depends on how many craft the player
    // actually kills, so a hard bound would be a lie. Printing it means a
    // retune that quietly triples the rate is visible on the next boot.
    {
      let craft = 0;
      const byType = {};
      for (const wave of POC_SCENARIO.waves) {
        for (const sq of wave.squadrons) {
          craft += sq.count;
          const named = sq.types ? Object.values(sq.types) : [];
          for (const t of named) byType[t] = (byType[t] || 0) + 1;
        }
      }
      let expected = 0;
      let drones = craft;
      for (const t of Object.keys(byType)) {
        drones -= byType[t];
        expected += byType[t] * (PICKUPS.dropChance[t] || 0);
      }
      expected += drones * (PICKUPS.dropChance.drone || 0);
      notes.push(
        `R5: level one authors ${craft} craft (${drones} drones + ` +
          `${craft - drones} named), so PICKUPS.dropChance expects ` +
          `${expected.toFixed(2)} drops per full clear, with ` +
          `PICKUPS.maxKillsWithoutDrop=${PICKUPS.maxKillsWithoutDrop} ` +
          `guaranteeing ${Math.floor(craft / PICKUPS.maxKillsWithoutDrop)} as a ` +
          `floor. Target per Amit: "like two chances".`
      );
      if (expected < 1.2 || expected > 3.5) {
        warn(
          `R5: expected level-one pickup yield ${expected.toFixed(2)} is outside ` +
            `the 1.2-3.5 band the "about two" target implies`
        );
      }
    }
  }

  // =========================================================================
  // Rule 6 -- the air-enemy type table (§6.2)
  //
  // Not one of §9.4's original five, because when it was written there was one
  // enemy type and nothing to disagree with. With two types and four more
  // planned, the composition IS authored data and gets the same treatment as
  // everything else here.
  // =========================================================================

  for (const id of Object.keys(ENEMY.types)) {
    const t = ENEMY.types[id];
    if (t.id !== id) err(`R6[${id}]: type id '${t.id}' does not match its key`);
    if (t.hp < 1) err(`R6[${id}]: hp ${t.hp} is not a positive integer`);
    if (t.radius <= 0) err(`R6[${id}]: radius ${t.radius} is not positive`);
    // A hit radius larger than the drawn craft would mean invisible collisions.
    if (t.radius > t.spriteWidth * 0.5) {
      err(
        `R6[${id}]: hit radius ${t.radius} exceeds half its sprite width ` +
          `${t.spriteWidth / 2} — the craft would be hittable outside its art`
      );
    }
    if (t.pattern && !PATTERNS[t.pattern]) {
      err(`R6[${id}]: owns pattern '${t.pattern}', which is not authored`);
    }
    // EVERY per-craft pattern variant must be an authored, validated row.
    //
    // This is the check that makes the per-craft-variation thread safe to
    // finish. The previous pass refused to vary a pattern's ORB COUNT or aisle
    // per craft, because §5.3's guarantees are proved per PATTERN and a runtime
    // variation would be a pattern this validator cannot see. Selecting between
    // authored rows is the honest version -- and it only stays honest if every
    // selectable row is one of the rows rule 2 above walked.
    for (const pid of t.patternVariants || []) {
      if (!PATTERNS[pid]) {
        err(
          `R6[${id}]: pattern variant '${pid}' is not authored in PATTERNS, so ` +
            `§5.3's aisle and descent guarantees were never proved for it`
        );
      }
    }
    // The Splitter's fragments must be a real type, or a kill would silently
    // produce nothing and the whole point of the type would evaporate.
    if (t.splitsInto && !ENEMY.types[t.splitsInto]) {
      err(`R6[${id}]: splits into '${t.splitsInto}', which is not a type`);
    }
    if (t.shieldHits !== undefined && t.shieldHits < 1) {
      err(`R6[${id}]: shieldHits ${t.shieldHits} is not a positive count`);
    }
    // Slot separation is checked against the DRONE's radius in R4; a fatter
    // type in the same slots would overlap its neighbours.
    if (t.radius > ENEMY.types.drone.radius) {
      let worst = Infinity;
      let worstF = '';
      for (const fid of Object.keys(FORMATIONS)) {
        const n = slotCount(fid);
        for (let s = 1; s < n; s++) {
          const a = slotPosition(fid, s - 1);
          const b = slotPosition(fid, s);
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < worst) {
            worst = d;
            worstF = fid;
          }
        }
      }
      if (worst < t.radius * 2) {
        err(
          `R6[${id}]: radius ${t.radius} needs ${t.radius * 2}px of slot ` +
            `separation, but ${worstF} has slots ${worst.toFixed(0)}px apart`
        );
      }
    }
  }

  // §6.2's Emitter "never swoops", and that is the entire reason it was chosen
  // as the second type -- it is a persistent threat cleared deliberately
  // rather than reacted to. A future edit that flips this would not look like
  // a bug, it would look like a tuning change, so it is asserted by name.
  if (ENEMY.types.emitter.swoops) {
    err(
      `R6: the Emitter is declared swoops:true. §6.2 says it never swoops, ` +
        `and a swooping Emitter is just a slow drone — the type stops being a ` +
        `behavioural contrast at all.`
    );
  }
  {
    // The point of the second type is CONTRAST. If a later edit converged the
    // two, say so rather than letting the repetition note quietly come back.
    const d = ENEMY.types.drone;
    const e2 = ENEMY.types.emitter;
    if (d.swoops === e2.swoops && !!d.pattern === !!e2.pattern) {
      warn(
        `R6: drone and emitter now have the SAME slot behaviour and the same ` +
          `pattern ownership. The second type exists to break "every craft ` +
          `enters, holds and swoops the same way"; as configured it no longer ` +
          `does.`
      );
    }
  }

  // PER-CRAFT VARIATION MUST STAY PRESENTATION AND CADENCE. `size` scales the
  // drawn sprite only, `tint` skews inside §5.4's enemy family, `cadence`
  // shifts when an owned emitter fires, and `patternVariants` selects between
  // authored patterns -- not one of them moves a craft or changes a pattern's
  // geometry.
  //
  // A per-craft hover bob WAS built here and was rejected by R4 at boot, which
  // is the check earning its keep: the authored formation rows clear the band
  // ceiling by 1.7 px, so any vertical excursion breaches §5.1 -- and the rows
  // that would have to move are level one's, which is locked. The assertion
  // stays so the idea cannot come back silently; if the rows are ever
  // re-authored, the amplitude also belongs in R4's halfH above.
  if (ENEMY.vary.bobAmp) {
    err(
      `R6: ENEMY.vary.bobAmp is set again. Per-craft vertical motion breaches ` +
        `§5.1 band discipline at the authored row positions (F1's top row ` +
        `clears the ceiling by 1.7px). Re-author the rows — which are level ` +
        `one's, and locked — or leave it off.`
    );
  }

  // THE EXIT ARC (ENEMY.fragment) -- Splitter fragments and Brood Gantry's
  // bay launches share it, and it is the one place in the game where a craft is
  // born ABOVE the player mid-fight. §5.5's do-not-port list forbids
  // straight-down plunges and anything that would demand an emergency vertical
  // lean (§0.5), so the arc's floor is asserted rather than described.
  {
    const F = ENEMY.fragment;
    if (F.floorY > ENEMY.swoop.minY + 1e-9) {
      err(
        `R6: the exit arc bottoms out at y=${F.floorY}, below the swoop's own ` +
          `${ENEMY.swoop.minY} floor — a craft born mid-fight would reach ` +
          `deeper into the frame than the one dive shape this game has`
      );
    }
    if (F.floorY >= BANDS.player.top) {
      err(
        `R6: the exit arc reaches the player band top ${BANDS.player.top} — ` +
          `nothing born above the player may enter it`
      );
    }
    for (const id of Object.keys(MODES)) {
      const m = MODES[id];
      if (F.descentSpeed + m.scrollSpeed > APPROACH_BUDGET) {
        err(
          `R6[${id}]: exit-arc descent ${F.descentSpeed}+${m.scrollSpeed} ` +
            `exceeds the ${APPROACH_BUDGET} approach budget`
        );
      }
    }
  }

  // =========================================================================
  // Rule 8 -- levels (§5.7's campaign ramp)
  //
  // New with the per-level content table. §5.7 is explicit about which levers a
  // campaign ramp may pull -- "formation size and shape complexity, number of
  // simultaneous patterns, enemy HP, ground-target count, and swoop frequency"
  // -- and equally explicit that it "NEVER scales by raising SCROLL_SPEED past
  // its cap, exceeding APPROACH_BUDGET, narrowing AISLE_MIN, or introducing any
  // required vertical move. Those four are floors, not levers." A level table is
  // exactly the place someone will eventually reach for one of the four, so the
  // rule says so out loud on every boot.
  // =========================================================================

  {
    const capsL = { ...DENSITY_CAPS.normal, enemies: POC_ENEMY_CAP_OVERRIDE };
    // LEVEL ONE IS LOCKED. Asserted by identity, not by comparison: its wave
    // list must BE POC_SCENARIO.waves, so a copy-paste that forked it is a boot
    // error rather than a slow divergence nobody notices until the demo.
    if (LEVELS[0].waves !== POC_SCENARIO.waves) {
      err(
        `R8: level one's wave list is no longer POC_SCENARIO.waves by ` +
          `reference. Level one is locked; forking its content is the thing ` +
          `this check exists to catch.`
      );
    }
    if (LEVELS[0].hp) {
      err(`R8: level one authors HP overrides, which changes locked content`);
    }

    for (let li = 0; li < LEVELS.length; li++) {
      const L = LEVELS[li];
      if (!L.waves) {
        notes.push(
          `R8: ${L.name} (${L.id}) has no authored waves yet and falls back to ` +
            `level two's — a declared gap, not a silent loop.`
        );
        continue;
      }
      for (const wave of L.waves) {
        let craft = 0;
        for (const sq of wave.squadrons) craft += sq.count;
        // Splitters answer their own death with more craft, so a wave packed to
        // the cap would drop a fragment on the floor and the type's whole
        // promise would fail in exactly the wave it matters most.
        let extra = 0;
        for (const sq of wave.squadrons) {
          if (!sq.types) continue;
          for (const k of Object.keys(sq.types)) {
            const t = ENEMY.types[sq.types[k]];
            if (t && t.splitsInto) extra += t.splitCount || 2;
          }
        }
        if (craft > capsL.enemies) {
          err(
            `R8[${L.id}/${wave.name}]: ${craft} authored craft > enemy cap ` +
              `${capsL.enemies}`
          );
        } else if (extra && craft + extra > capsL.enemies) {
          warn(
            `R8[${L.id}/${wave.name}]: ${craft} craft + ${extra} possible ` +
              `Splitter fragments would exceed the ${capsL.enemies} cap, so ` +
              `some fragments will be dropped — leave headroom or the type ` +
              `stops meaning anything here`
          );
        }
        if (wave.patterns.length > capsL.simultaneousPatterns) {
          err(
            `R8[${L.id}/${wave.name}]: ${wave.patterns.length} wave patterns > ` +
              `cap ${capsL.simultaneousPatterns}`
          );
        }
        // Every slot a squadron claims must exist in the formation it names, or
        // craft are silently dropped and the wave is quietly smaller than it
        // reads on the page.
        const n = slotCount(wave.formation || 'F1');
        for (const sq of wave.squadrons) {
          if ((sq.slot || 0) + sq.count > n) {
            err(
              `R8[${L.id}/${wave.name}]: a squadron claims slots ` +
                `${sq.slot || 0}..${(sq.slot || 0) + sq.count - 1} of ` +
                `${wave.formation}, which has only ${n}`
            );
          }
          for (const k of Object.keys(sq.types || {})) {
            if (!ENEMY.types[sq.types[k]]) {
              err(
                `R8[${L.id}/${wave.name}]: unknown craft type '${sq.types[k]}'`
              );
            }
          }
        }
      }
      // Per-level HP is a sanctioned lever; a level that doubled everything
      // would still be legal by §5.7 but is worth saying out loud, and a level
      // that made the drone tougher than the Emitter would be a mistake.
      for (const t of Object.keys(L.hp || {})) {
        if (!ENEMY.types[t]) {
          err(`R8[${L.id}]: HP override for unknown type '${t}'`);
        } else if (L.hp[t] > ENEMY.types[t].hp * 3) {
          warn(
            `R8[${L.id}]: ${t} HP override ${L.hp[t]} is over 3x §6.2's ` +
              `authored ${ENEMY.types[t].hp} — that is a different type, not a ramp`
          );
        }
      }
      if (L.hp) {
        notes.push(
          `R8[${L.id}]: HP overrides ` +
            Object.keys(L.hp).map((t) => `${t} ${ENEMY.types[t].hp}→${L.hp[t]}`).join(', ') +
            ` (§5.7 lists enemy HP as a sanctioned campaign lever).`
        );
      }
    }
    if (LEVELS.length !== SURFACES.length) {
      warn(
        `R8: ${LEVELS.length} levels against ${SURFACES.length} surfaces — the ` +
          `two are indexed by the same number and must stay 1:1`
      );
    }
  }

  // =========================================================================
  // Rule 9 -- weapons and the empty-screen fire hold (§4, §5.4, §5.6)
  //
  // Both are new, and both touch rules that are stated as absolutes elsewhere,
  // which is exactly when an assertion is worth more than a comment.
  // =========================================================================

  {
    for (const id of Object.keys(WEAPONS)) {
      const wd = WEAPONS[id];
      if (wd.id !== id) err(`R9[${id}]: weapon id '${wd.id}' does not match its key`);
      if (!wd.shots || !wd.shots.length) {
        err(`R9[${id}]: authors no shots, so auto-fire would produce nothing`);
      }
      if (wd.intervalS <= 0) err(`R9[${id}]: fire interval ${wd.intervalS} is not positive`);
      // §5.4's ownership coding is absolute -- "player fire is cyan-white,
      // enemy fire is orange/magenta [...] No exceptions, including for
      // bosses." A temporary weapon may change shape, count, speed and size,
      // and may never change side. Checked as a real constraint on the tint:
      // blue must lead and red must not.
      const t = wd.tint;
      const r = (t >> 16) & 0xff;
      const g = (t >> 8) & 0xff;
      const bch = t & 0xff;
      if (!(bch >= g && g >= r)) {
        err(
          `R9[${id}]: tint #${t.toString(16).padStart(6, '0')} is not cyan-white ` +
            `(needs blue >= green >= red). §5.4 colour-codes bullet OWNERSHIP ` +
            `and admits no exceptions.`
        );
      }
      // A round the player could not see coming out is not a weapon change.
      if (wd.radius < 6) warn(`R9[${id}]: round radius ${wd.radius} is very small`);
      // A spread's outer rounds must still be able to reach the formation band
      // from the player's own clamp, or the extra rounds would be decoration.
      for (const s of wd.shots) {
        if (Math.abs(s.angle) > 0.45) {
          warn(
            `R9[${id}]: a round at ${(s.angle * 57.3).toFixed(0)}° leaves the ` +
              `frame before it reaches the formation band`
          );
        }
      }
      // Fire rate against the simultaneous-bolt pool: a weapon that outran the
      // pool would silently drop rounds.
      const inFlight =
        (wd.shots.length * (DESIGN_H / wd.speed)) / wd.intervalS;
      if (inFlight > 80) {
        warn(
          `R9[${id}]: ~${inFlight.toFixed(0)} rounds in flight at once, close to ` +
            `the 96-slot bolt pool`
        );
      }
    }
    if (!WEAPONS.standard) err('R9: there is no standard weapon to fall back to');

    // THE FIRE HOLD. Its scope is its safety margin, so the margin is asserted.
    // §5.5 spawns entering craft at ±0.07 of the width outside the frame; the
    // hold's margin must comfortably exceed that or fire would resume AFTER the
    // first craft is already visible, which would shorten the pre-lock kill
    // window §5.3 sizes against a stream that is already in the air.
    const spawnOut = 0.07 * DESIGN_W;
    if (FIRE_HOLD.marginPx <= spawnOut) {
      err(
        `R9: FIRE_HOLD.marginPx ${FIRE_HOLD.marginPx} does not cover the ` +
          `${spawnOut.toFixed(0)}px entry spawn offset — fire would resume ` +
          `after the first craft is drawn, not before`
      );
    } else if (FIRE_HOLD.marginPx < spawnOut * 2) {
      warn(
        `R9: FIRE_HOLD.marginPx ${FIRE_HOLD.marginPx} is under 2x the ` +
          `${spawnOut.toFixed(0)}px entry spawn offset; err generous here`
      );
    }
    if (FIRE_HOLD.holdDelayS <= 0) {
      warn(
        `R9: FIRE_HOLD.holdDelayS ${FIRE_HOLD.holdDelayS} gives no grace, so a ` +
          `half-second gap between kills would chop the stream`
      );
    }
    notes.push(
      `R9: fire holds only on a genuinely empty playfield — a ` +
        `${FIRE_HOLD.marginPx}px margin, a ${FIRE_HOLD.leadS}s launch lead, ` +
        `enemy bullets and every boss phase all count as "not empty". Resume ` +
        `is same-frame; only stopping has a ${FIRE_HOLD.holdDelayS}s grace.`
    );
  }

  // =========================================================================
  // Rule 7 -- bosses (§6.4)
  // =========================================================================

  {
    // Geometry is computed from the REAL hull aspect where the caller can
    // supply it (main.js reads it off the loaded texture), so the 0.58 rule is
    // checked against what actually shipped rather than against an assumption.
    const aspect = opts.bossAspect || 2.7;
    const g = bossGeometry(aspect);

    if (g.bottom > BOSS.maxExtentY * DESIGN_H + 0.5) {
      err(
        `R7: boss extends to y=${g.bottom.toFixed(0)} at aspect ` +
          `${aspect.toFixed(2)}, past §6.4's ${(BOSS.maxExtentY * DESIGN_H).toFixed(0)} ` +
          `floor — reduce BOSS.width or raise BOSS.stationY`
      );
    }
    if (g.bottom >= g.playerBandTop) {
      err(`R7: boss reaches the player band top ${g.playerBandTop.toFixed(0)}`);
    }
    if (g.top < BANDS.entryTelegraph.bottom * DESIGN_H) {
      warn(
        `R7: boss top y=${g.top.toFixed(0)} rises into the entry telegraph ` +
          `band, which must stay legible for top-edge arrivals (§5.3)`
      );
    }
    // THE BANNER/HULL COLLISION, NOW RESOLVED RATHER THAN JUST REPORTED.
    //
    // §7.1 puts banners in the gutter at BANNER_Y and §6.4 hangs the boss into
    // the UPPER GUTTER, so the two authored positions overlap and every
    // boss-fight banner was printed on armour. This used to be a standing note
    // on the grounds that picking between two authored numbers is not stage 4's
    // call. That was the wrong read of the trade: the banner most affected is
    // "CORE EXPOSED — CLIMB", which is the one line telling the player what the
    // vertical axis is for, and an instruction that cannot be read is not an
    // instruction. §7.1's actual requirement is that the band sits in the gutter
    // and never over the formation or the player; BANNER_Y_BOSS satisfies all of
    // that and additionally clears the hull. So the band moves for the duration
    // of a boss and this rule now checks the RESOLUTION instead of restating the
    // problem.
    if (BANNER_Y * DESIGN_H < g.bottom && BANNER_Y * DESIGN_H > g.top) {
      const by = BANNER_Y_BOSS * DESIGN_H;
      // Clear of the hull below it...
      if (by <= g.bottom) {
        err(
          `R7: the boss-phase banner at y=${by.toFixed(0)} (BANNER_Y_BOSS) is ` +
            `still inside the hull's ${g.top.toFixed(0)}..${g.bottom.toFixed(0)} ` +
            `extent — the whole point of the second position is to clear it`
        );
      }
      // ...and clear of anywhere the player can actually fly, which is the
      // PLAYER_CLAMP_Y ceiling and not the player band's nominal top: §6.4's
      // vulnerable window exists to pull the player above the band, and it would
      // pull them straight into the banner.
      if (by >= PLAYER_CLAMP_Y.min * DESIGN_H) {
        err(
          `R7: the boss-phase banner at y=${by.toFixed(0)} is at or below the ` +
            `player's upward clamp ${(PLAYER_CLAMP_Y.min * DESIGN_H).toFixed(0)} ` +
            `— a player claiming the vulnerable window would fly into it`
        );
      }
      if (BANNER_Y_BOSS <= BANDS.gutter.top || BANNER_Y_BOSS >= BANDS.gutter.bottom) {
        warn(
          `R7: the boss-phase banner at y=${BANNER_Y_BOSS} has left §7.1's ` +
            `gutter (${BANDS.gutter.top}..${BANDS.gutter.bottom})`
        );
      }
      notes.push(
        `R7: banners step from y=${(BANNER_Y * DESIGN_H).toFixed(0)} (§7.1) to ` +
          `y=${by.toFixed(0)} while a boss hull is on screen, clearing the ` +
          `hull's ${g.top.toFixed(0)}..${g.bottom.toFixed(0)} extent (§6.4) ` +
          `above and the player's ${(PLAYER_CLAMP_Y.min * DESIGN_H).toFixed(0)} ` +
          `ceiling below. Both authored numbers kept; only the position within ` +
          `the gutter moves.`
      );
    }

    // "no bullet, pickup, ground target, explosion or locked enemy may occupy
    // the margins or the top HUD strip" (§5.1) -- the hull is the largest
    // thing that could, and it sways, so check the swept extent.
    if (g.left < g.marginLeft || g.right > g.marginRight) {
      err(
        `R7: boss spans x ${g.left.toFixed(0)}..${g.right.toFixed(0)} at full ` +
          `sway, outside the playable width ${g.marginLeft}..${g.marginRight}`
      );
    }

    // The vulnerable window must fit the round trip it invites, with margin.
    // §0.5 allows the vertical axis only for "slow, optional, generously-timed
    // moves"; a window that needs the whole 3.5 s just to travel would make
    // the drift a reaction test on the axis this product serves worst.
    const driftPx = (LATERAL_ONLY_TEST_Y - BOSS.window.rewardY) * DESIGN_H;
    const legS = driftPx / INPUT.verticalMax;
    const roundTrip = legS * 2;
    const W = BOSS.window;
    if (roundTrip >= W.durationS) {
      err(
        `R7: the vulnerable window is ${W.durationS}s but the round trip from ` +
          `y=${LATERAL_ONLY_TEST_Y} to y=${W.rewardY} and back takes ` +
          `${roundTrip.toFixed(2)}s — there is no time in it to actually fire`
      );
    } else if (W.durationS - roundTrip < 0.8) {
      warn(
        `R7: only ${(W.durationS - roundTrip).toFixed(2)}s of the vulnerable ` +
          `window is left for firing after a ${roundTrip.toFixed(2)}s round ` +
          `trip; §6.4 wants "a beat of fire [...] with margin"`
      );
    } else {
      notes.push(
        `R7: vulnerable window ${W.durationS}s = ${legS.toFixed(2)}s up + ` +
          `${(W.durationS - roundTrip).toFixed(2)}s firing + ${legS.toFixed(2)}s ` +
          `back, announced ${W.announceS}s ahead. Optional throughout.`
      );
    }
    // The reward line must be REACHABLE. Not "inside the player band" -- §5.6
    // and §6.4 both deliberately put optional rewards at 0.62, just above the
    // band, and §5.5 wants a drifting player to be in a swoop's reach. What
    // must hold is that the movement clamp actually permits the drift, which
    // is the thing that was silently false before PLAYER_CLAMP_Y existed.
    if (W.rewardY < PLAYER_CLAMP_Y.min) {
      err(
        `R7: the window's reward line y=${W.rewardY} is above the player's ` +
          `upward clamp ${PLAYER_CLAMP_Y.min} — it could never be claimed, so ` +
          `§6.4's one designed use of the vertical axis would be unreachable`
      );
    }
    // ...and it must be a drift, not a dash. §0.5 permits the vertical axis
    // only for slow, generously-timed moves.
    {
      const leg = ((LATERAL_ONLY_TEST_Y - W.rewardY) * DESIGN_H) / INPUT.verticalMax;
      if (leg < 0.6) {
        warn(
          `R7: the climb to the window takes only ${leg.toFixed(2)}s — fast ` +
            `enough to read as a dash rather than the drift §0.5 allows`
        );
      }
    }

    // Entry descent obeys the approach budget in BOTH modes (§5.3).
    for (const id of Object.keys(MODES)) {
      const m = MODES[id];
      const drop = BOSS.stationY * DESIGN_H - BOSS.entryFromY * DESIGN_H;
      const dur = Math.max(BOSS.entryMinS, drop / m.patternDescentCap);
      const speed = drop / dur;
      if (speed + m.scrollSpeed > APPROACH_BUDGET + 0.5) {
        err(
          `R7[${id}]: boss entry descends at ${speed.toFixed(0)}+` +
            `${m.scrollSpeed} px/s, over the ${APPROACH_BUDGET} budget`
        );
      }
    }

    // Per-boss data.
    //
    // TWO SHAPES OF ROW (see /data/bosses.js): a HULL BOSS with one pool and no
    // weak points, or a POD BOSS with pods gating a core. Every check below is
    // scoped to the shape it belongs to, and the first thing asserted is that a
    // row is unambiguously one or the other -- a row with both would run half of
    // each system, and a row with neither would be a boss that cannot be killed
    // at all, which is precisely the failure this rule now exists to catch.
    for (const id of Object.keys(BOSSES)) {
      const b = BOSSES[id];
      if (!b.built) continue;
      const hullBoss = bossIsHullBoss(b);
      const podCount = (b.pods || []).length;

      if (hullBoss && podCount) {
        err(
          `R7[${id}]: authors both hullHp (${b.hullHp}) and ${podCount} pods. ` +
            `A row is one shape or the other — see /data/bosses.js`
        );
      }
      if (!hullBoss && !podCount) {
        err(
          `R7[${id}]: has neither hullHp nor pods, so nothing about it can take ` +
            `damage — it would be an unkillable boss`
        );
      }

      if (hullBoss) {
        // §5.3 caps simultaneous distinct patterns. A pod boss respects it by
        // ROTATING its pods; a hull boss has no rotation, so its authored
        // pattern list is the cap and has to be checked directly.
        const hp = b.hullPatterns || [];
        const cap = DENSITY_CAPS.normal.simultaneousPatterns;
        if (hp.length > cap) {
          err(
            `R7[${id}]: authors ${hp.length} hull patterns against §5.3's ` +
              `${cap}-simultaneous-pattern cap at Normal`
          );
        }
        for (const pid of hp) {
          if (!PATTERNS[pid]) {
            err(`R7[${id}]: hull pattern '${pid}' is not authored in PATTERNS`);
          }
        }
        if (!hp.length) {
          warn(`R7[${id}]: is a hull boss with no patterns — it cannot fight back`);
        }
        // The fight's length, stated out loud. §6.4 gives no duration, so this
        // is a note rather than a bound -- but "lots of HP" and "not a chore"
        // are only 30 seconds apart, and the number should never be a surprise.
        const dps = PLAYER.fire.boltDamage / PLAYER.fire.rank1IntervalS;
        notes.push(
          `R7[${id}]: hull boss, ${b.hullHp} HP at ${dps.toFixed(1)} damage/s ` +
            `sustained = ~${(b.hullHp / dps).toFixed(0)}s of on-target fire. ` +
            `No pods, no core, no vulnerable window — hit it anywhere.`
        );
      }

      if (podCount && podCount !== 4) {
        warn(`R7[${id}]: §6.4 specifies 4 destructible pods, found ${podCount}`);
      }

      // PER-BOSS EXTENT, against THIS boss's own hull art.
      //
      // The extent check above runs on a single aspect handed in by the caller,
      // which used to be the only built boss's. With two built bosses of
      // visibly different proportions (2.72 vs 3.35), checking one and trusting
      // the other is how §6.4's "never enters the player band" quietly stops
      // being true for the boss nobody measured.
      {
        const a = (opts.bossAspects && opts.bossAspects[id]) || aspect;
        const gb = bossGeometry(a);
        if (gb.bottom > BOSS.maxExtentY * DESIGN_H + 0.5) {
          err(
            `R7[${id}]: extends to y=${gb.bottom.toFixed(0)} at its own aspect ` +
              `${a.toFixed(2)}, past §6.4's ` +
              `${(BOSS.maxExtentY * DESIGN_H).toFixed(0)} floor`
          );
        }
        if (gb.bottom >= gb.playerBandTop) {
          err(`R7[${id}]: reaches the player band top`);
        }
      }

      // --- launch bays (§6.4, BOSS.bay) ------------------------------------
      // Boss two's mechanic, and the two things that make a cycling weak point
      // safe rather than a repeat of boss one's unreadable fight.
      {
        const bays = (b.pods || []).filter((p) => p.launches);
        if (bays.length) {
          const B = BOSS.bay;
          // GUARANTEE 1: SOMETHING IS ALWAYS OPEN. With n bays evenly phased,
          // the number open at any instant is floor(n*openFrac) at worst. A
          // fight with a reachable state where nothing can be damaged is the
          // exact failure boss one shipped with -- it must be unreachable, not
          // unlikely, so it is arithmetic rather than a play-test note.
          const phases = bays.map((p) => p.phase || 0).sort((x, y) => x - y);
          let worst = bays.length;
          // Sample the cycle finely; the open set only changes at phase
          // boundaries, so this is exact for any authored phase list.
          for (let s = 0; s < 720; s++) {
            const k = s / 720;
            let open = 0;
            for (const ph of phases) {
              if (((k + ph) % 1) < B.openFrac) open++;
            }
            worst = Math.min(worst, open);
          }
          if (worst < 1) {
            err(
              `R7[${id}]: its ${bays.length} bays can all be shut at once ` +
                `(openFrac ${B.openFrac}, phases ${phases.join('/')}) — there ` +
                `would be a moment with nothing on the boss to shoot, which is ` +
                `exactly how a working fight reads as invulnerable`
            );
          } else {
            notes.push(
              `R7[${id}]: at least ${worst} of ${bays.length} bays are open at ` +
                `every instant (openFrac ${B.openFrac}), so there is never a ` +
                `beat with nothing to shoot. Below ` +
                `${B.alwaysOpenAtOrBelow} survivors they jam open.`
            );
          }
          // GUARANTEE 2: THE ENDGAME NEVER WAITS.
          if (B.alwaysOpenAtOrBelow < 1) {
            err(
              `R7[${id}]: alwaysOpenAtOrBelow ${B.alwaysOpenAtOrBelow} means the ` +
                `last bay still cycles, so the fight's tail would be ` +
                `${((1 - B.openFrac) * 100).toFixed(0)}% invulnerable waiting`
            );
          }
          // The door travel has to be visible AND has to finish well inside the
          // open window, or "open" would be a state the bay is never fully in.
          if (B.doorS * 2 >= B.cycleS * B.openFrac) {
            err(
              `R7[${id}]: doors take ${B.doorS}s each way against a ` +
                `${(B.cycleS * B.openFrac).toFixed(2)}s open window — the bay ` +
                `would spend most of "open" opening`
            );
          }
          // A bay that could not launch inside its own open window would be a
          // carrier that never disgorges anything.
          if (B.launchIntervalS > B.cycleS * B.openFrac) {
            warn(
              `R7[${id}]: launch interval ${B.launchIntervalS}s exceeds the ` +
                `${(B.cycleS * B.openFrac).toFixed(2)}s open window, so a bay ` +
                `may open and shut without launching`
            );
          }
          // The brood must not be able to fill §5.3's enemy cap by itself.
          if (B.maxLaunched >= POC_ENEMY_CAP_OVERRIDE) {
            err(
              `R7[${id}]: maxLaunched ${B.maxLaunched} is at or over the ` +
                `${POC_ENEMY_CAP_OVERRIDE} enemy cap — the carrier could fill ` +
                `the frame on its own`
            );
          }
        }
      }
      for (const pod of b.pods || []) {
        if (!PATTERNS[pod.pattern]) {
          err(`R7[${id}]: pod at dx=${pod.dx} owns unauthored pattern '${pod.pattern}'`);
        }
        const px = DESIGN_W * 0.5 + (pod.dx - 0.5) * BOSS.width;
        if (
          px - BOSS.podRadius - BOSS.swayAmpX < g.marginLeft ||
          px + BOSS.podRadius + BOSS.swayAmpX > g.marginRight
        ) {
          err(`R7[${id}]: pod at dx=${pod.dx} (x=${px.toFixed(0)}) reaches a HUD margin`);
        }
        // EVERY TARGET MUST BE REACHABLE BY LATERAL MOVEMENT ALONE.
        //
        // New, and it is the check that would have caught the shipped bug's
        // sibling. A player bolt travels straight up, so hitting a pod means
        // standing under it -- and the player's lateral clamp is tighter than
        // the playable width. A pod outside PLAYER_CLAMP_X could be drawn,
        // lit, reticled and still be unhittable, which is the exact class of
        // "verified by harness, unreachable by player" this pass is about.
        const reach = px + BOSS.swayAmpX < PLAYER_CLAMP_X.min * DESIGN_W ||
          px - BOSS.swayAmpX > PLAYER_CLAMP_X.max * DESIGN_W;
        if (reach) {
          err(
            `R7[${id}]: pod at dx=${pod.dx} (x=${px.toFixed(0)}) is outside the ` +
              `player's own lateral clamp — no amount of leaning can line up ` +
              `under it, so it could never be shot`
          );
        }
      }
      // Shot channels must not overlap: /enemies/boss.js resolves a bolt against
      // the FIRST live pod whose channel contains it, so two overlapping lanes
      // would make the second pod unhittable while the first is alive.
      for (let i = 0; i < podCount; i++) {
        for (let j = i + 1; j < podCount; j++) {
          const sep = Math.abs(b.pods[i].dx - b.pods[j].dx) * BOSS.width;
          if (sep < BOSS.podHitHalfW * 2) {
            err(
              `R7[${id}]: pods at dx=${b.pods[i].dx} and dx=${b.pods[j].dx} are ` +
                `${sep.toFixed(0)}px apart, closer than their ` +
                `${BOSS.podHitHalfW * 2}px shot channels — the far one could ` +
                `not be hit while the near one lives`
            );
          }
        }
      }
      // The core must not sit under a pod, or the vulnerable window would open
      // onto something the player cannot see or shoot past. Measured against the
      // CHANNEL width now, not the drawn pod radius, because the channel is what
      // a bolt is really tested against.
      for (const pod of b.pods || []) {
        const sep = Math.abs(pod.dx - b.coreDx) * BOSS.width;
        if (sep < BOSS.podHitHalfW + BOSS.coreRadius) {
          err(
            `R7[${id}]: pod at dx=${pod.dx} overlaps the core at ` +
              `dx=${b.coreDx} (${sep.toFixed(0)}px apart, needs ` +
              `${BOSS.podHitHalfW + BOSS.coreRadius})`
          );
        }
      }
      if (podCount) {
        // §6.4's "killable without ever leaving y = 0.82, just slower" -- the
        // pods must be enough on their own, so the core has to open once they
        // are gone regardless of the window.
        notes.push(
          `R7[${id}]: killable from y=${LATERAL_ONLY_TEST_Y} alone — all ` +
            `${podCount} pods (${BOSS.podHp} HP each) then a ` +
            `${BOSS.coreHp} HP core at x1. The window's x` +
            `${BOSS.window.damageMultiplier} is a shortcut, never a gate.`
        );
      }
    }

    // Every surface names a boss; say out loud which ones cannot yet run, so a
    // level with no ending is a reported gap rather than a silent loop.
    for (const s of SURFACES) {
      const b = BOSSES[s.boss];
      if (!b) {
        err(`R7: surface '${s.id}' names boss '${s.boss}', which is not declared`);
      } else if (!b.built) {
        notes.push(
          `R7: surface '${s.id}' has no built boss yet (${b.name}) — that ` +
            `sector ends on its wave cycle instead of a fight`
        );
      }
    }
  }

  return { errors, warnings, notes, ok: errors.length === 0 };
}

/**
 * Run the validator and fail loudly (§9.4). Loud, not fatal: a thrown error
 * inside the Unity WebView would produce a black screen with no console to
 * read it in, which is strictly worse than a running game with a red banner.
 * Errors also go over the Unity bridge, which is the only channel that exists
 * on-device.
 */
export function runValidator({ onReport, bossAspect, bossAspects } = {}) {
  const res = validateAll({ bossAspect, bossAspects });
  const tag = '[NovaVanguard/constraints]';

  for (const n of res.notes) console.info(`${tag} note: ${n}`);
  for (const wmsg of res.warnings) console.warn(`${tag} WARNING: ${wmsg}`);
  for (const e of res.errors) console.error(`${tag} VIOLATION: ${e}`);

  if (res.errors.length && window.Unity) {
    window.Unity.call(`CONSTRAINTS: ${res.errors.length} violation(s): ${res.errors[0]}`);
  }
  if (!res.errors.length) {
    console.info(
      `${tag} pacing contract OK — ${res.warnings.length} warning(s), ` +
        `${res.notes.length} note(s), both framing modes checked.`
    );
  }
  if (onReport) onReport(res);
  return res;
}
