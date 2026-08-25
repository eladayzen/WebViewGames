// The interceptor (§6.1) -- movement, roll state, auto-fire, damage/i-frames.
//
// Nose-north, roll-only, auto-firing. Three hard rules from §0.2/§4 live here:
//   1. Roll is PRESENTATIONAL. It changes the sprite and nothing else -- not
//      the hitbox, not the heading, not the gun direction.
//   2. The guns always fire straight up. There is no aim.
//   3. There is no fire input, no bomb input, and no input that changes rate.

import {
  PLAYER,
  INPUT,
  PLAYER_CLAMP_X,
  PLAYER_CLAMP_Y,
  BANDS,
  DESIGN_W,
  DESIGN_H,
  FX,
  FIRE_HOLD,
  weaponDef,
} from '../data/tuning.js';
import { alloc, RunPhase } from '../core/state.js';
import { sfx, sfxFire } from '../systems/audio.js';

export function updatePlayer(w, input, dt, fx) {
  const p = w.player;

  // --- movement (§4) ------------------------------------------------------
  p.vx = input.carve * INPUT.lateralMax;
  p.vy = input.nudge * INPUT.verticalMax;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const minX = PLAYER_CLAMP_X.min * DESIGN_W;
  const maxX = PLAYER_CLAMP_X.max * DESIGN_W;
  if (p.x < minX) {
    p.x = minX;
    p.vx = 0;
  }
  if (p.x > maxX) {
    p.x = maxX;
    p.vx = 0;
  }

  // Clamped to PLAYER_CLAMP_Y, not to the raw band. The band is the design's
  // statement about where the player LIVES; the clamp additionally keeps the
  // hull on screen, exactly as PLAYER_CLAMP_X keeps it out from under the HUD
  // gauges. See PLAYER_CLAMP_Y in tuning.js for why this changes no pacing
  // number.
  const minY = PLAYER_CLAMP_Y.min * DESIGN_H;
  const maxY = PLAYER_CLAMP_Y.max * DESIGN_H;
  if (p.y < minY) {
    p.y = minY;
    p.vy = 0;
  }
  if (p.y > maxY) {
    p.y = maxY;
    p.vy = 0;
  }

  // --- roll state, with hysteresis (§6.1) ---------------------------------
  // Without hysteresis the sprite strobes whenever the player parks the lean
  // right on the threshold, which on a board is most of the time.
  const c = input.carve;
  const a = Math.abs(c);
  if (p.roll === 0) {
    if (a > INPUT.rollOn) p.roll = Math.sign(c);
  } else if (a < INPUT.rollOff || Math.sign(c) !== p.roll) {
    p.roll = a > INPUT.rollOn ? Math.sign(c) : 0;
  }

  // --- timers -------------------------------------------------------------
  if (p.invulnT > 0) p.invulnT = Math.max(0, p.invulnT - dt);
  if (p.hitFlashT > 0) p.hitFlashT = Math.max(0, p.hitFlashT - dt);

  // --- auto-fire (§4) -----------------------------------------------------
  // Still unconditional in the sense §4 means it: no fire button, no cooldown
  // the player can affect, no input that changes it. What CAN change it is what
  // is on screen (FIRE_HOLD) and which weapon is running (WEAPONS) -- neither
  // is an input, so §4's rule that "there is no input that changes it" is
  // intact. POC pins rank at 1 (§8.1); the pickup swaps the weapon, not rank.
  const weapon = weaponDef(p.weapon);

  // The empty-screen hold. `holdT` is a GRACE, not a ramp: it only delays
  // stopping. The instant something is shootable the hold is released on the
  // same frame, and `fireT` is floored at zero so the very next step fires --
  // there is deliberately no spin-up, because a perceptible delay between
  // "something appeared" and "I am shooting" turns this from polish into a bug.
  if (shootableOnScreen(w)) {
    p.holdT = 0;
    if (p.holding) {
      p.holding = false;
      // Release with the gun already charged, so resume is instantaneous
      // rather than up to one fire interval late.
      p.fireT = Math.min(p.fireT, 0);
    }
  } else {
    p.holdT += dt;
    if (p.holdT >= FIRE_HOLD.holdDelayS) p.holding = true;
  }

  p.fireT -= dt;
  if (p.holding) {
    // Held: park the clock at zero rather than letting it run negative, or a
    // long hold would dump a burst of backdated volleys on release.
    p.fireT = 0;
    return;
  }
  let guard = 0;
  while (p.fireT <= 0 && guard++ < 8) {
    p.fireT += weapon.intervalS;
    fireVolley(w, p, weapon);
    // ONE SOUND PER VOLLEY, not per round: a scatter volley is three bolts
    // leaving one gun in the same instant, and three copies of the fire clip
    // would just be the fire clip three times as loud. The clip is chosen by
    // weapon, so a Lance sounds like a Lance -- see WEAPON_CLIP in
    // /systems/audio.js. The whole fire layer is mixed far under everything
    // else (AUDIO in /data/tuning.js); auto-fire is unconditional, so this
    // plays about ten times a second for the entire run.
    sfxFire(weapon.id);
  }
}

/**
 * Is there anything on or near the frame worth shooting at?
 *
 * Amit's rule, and the narrowness of it is the entire safety margin: "if
 * anything is near the screen, like everything is inside the screen, there's no
 * way I'm not shooting. It's only for those times where like there's nothing on
 * the screen and I keep on shooting." So this answers YES generously and NO
 * only for a genuinely empty playfield.
 *
 * Five sources, in the order they are cheapest to reject:
 *   * the boss, in ANY phase including the warning band and the entry descent;
 *   * any live enemy, in any state, within FIRE_HOLD.marginPx of the frame --
 *     which includes craft still off the side edge on their entry path, so the
 *     stream is already climbing before the first one is drawn (§5.5 enters
 *     squadrons from the side edges, and §5.3 sizes the pre-lock kill window
 *     against fire that is already in the air);
 *   * any enemy bullet still falling -- the screen is not empty while ordnance
 *     is on it, and holding fire mid-dodge would read as a fault;
 *   * a queued squadron launch inside FIRE_HOLD.leadS, covering the beat
 *     between "the wave started" and "the first craft exists";
 *   * ground targets, when they exist (MVP item 14) -- the hook is here so
 *     adding them is a line rather than a rediscovery of this rule.
 */
export function shootableOnScreen(w) {
  if (
    w.boss.active ||
    w.phase === RunPhase.BOSS_WARNING ||
    w.phase === RunPhase.BOSS ||
    w.phase === RunPhase.BOSS_DEATH
  ) {
    return true;
  }

  const m = FIRE_HOLD.marginPx;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.alive) continue;
    if (e.x < -m || e.x > DESIGN_W + m || e.y < -m || e.y > DESIGN_H + m) continue;
    return true;
  }
  for (let i = 0; i < w.enemyBullets.length; i++) {
    if (w.enemyBullets[i].alive) return true;
  }

  const d = w.director;
  for (let i = 0; i < d.pending.length; i++) {
    if (d.pending[i].t - d.waveT <= FIRE_HOLD.leadS) return true;
  }
  // Ground targets (§6.3) are MVP item 14 and do not exist yet.
  if (w.groundTargets) {
    for (let i = 0; i < w.groundTargets.length; i++) {
      if (w.groundTargets[i].alive) return true;
    }
  }
  return false;
}

/**
 * One volley of whatever weapon is running.
 *
 * A weapon is a list of angles (WEAPONS), so the standard bolt is a one-entry
 * list and the pickup weapon is a three-entry one -- there is no branch here
 * and no system downstream knows weapons exist. The bolt carries its own
 * damage, radius and texture key, which is what keeps /systems/collision.js and
 * /enemies/boss.js weapon-agnostic.
 *
 * §0.2 RULE 3 SURVIVES THIS. The nose still points north and the guns still
 * fire straight up: an angled round in a fixed authored fan is a SPREAD, not an
 * aim. Nothing here reads the player's position relative to anything, so there
 * is no aiming code to grow into aiming.
 */
// Monotonic round identity, for the pierce stamp (WEAPONS.lance). Not a
// gameplay value and never seeded -- it exists so a round can recognise a craft
// it has already passed through, which an index into a recycled pool cannot do.
let _boltUid = 1;

function fireVolley(w, p, weapon) {
  for (let i = 0; i < weapon.shots.length; i++) {
    const b = alloc(w.playerBolts);
    if (!b) return;
    const a = weapon.shots[i].angle;
    b.alive = true;
    b.x = p.x;
    b.y = p.y + PLAYER.fire.muzzleOffsetY;
    b.vx = Math.sin(a) * weapon.speed;
    b.vy = -Math.cos(a) * weapon.speed;
    b.r = weapon.radius;
    b.dmg = weapon.damage;
    b.weapon = weapon.id;
    // EVERYTHING A PICKUP WEAPON DOES DIFFERENTLY IS STAMPED ON THE ROUND HERE,
    // and nowhere downstream reads WEAPONS again. That is the same property the
    // three-round fan already relied on -- collision, the boss and the renderer
    // are weapon-agnostic -- extended to four weapons and three behaviours. A
    // fifth weapon is a WEAPONS row plus, at most, one field.
    b.pierce = weapon.pierce || 0;
    b.uid = _boltUid++;
    b.lifePx = weapon.rangePx || 0;
    b.turn = weapon.homing ? weapon.homing.turnRate : 0;
    b.acquire = weapon.homing ? weapon.homing.acquireRange : 0;
    b.retargetT = 0;
    b.target = -1;
    w.stats.shotsFired++;
  }
}

/**
 * Which live craft a homing round should steer at (WEAPONS.swarm).
 *
 * TWO RULES, AND BOTH ARE SAFETY RATHER THAN TARGETING QUALITY:
 *
 *   * ONLY CRAFT ABOVE THE ROUND are eligible. A round that could acquire
 *     something below it would turn back down through the player band, which
 *     puts a player-owned object on a collision course with the player's own
 *     read of the frame -- and §5.4's whole ownership coding exists so that
 *     nothing cyan is ever something to dodge.
 *   * NEVER A BOSS. Pods and the core are not in this pool at all, so a swarm
 *     round is straight-flying during a boss fight. That is the weapon's
 *     authored weakness (see WEAPONS.swarm) rather than an oversight.
 *
 * Returns a POOL INDEX, re-resolved on a timer rather than held, so a target
 * that dies and has its slot recycled cannot be chased as if it were the same
 * craft.
 */
function acquireTarget(w, b) {
  let best = -1;
  let bestD2 = b.acquire * b.acquire;
  for (let j = 0; j < w.enemies.length; j++) {
    const e = w.enemies[j];
    if (!e.alive || e.mode === 'fleeing') continue;
    if (e.y > b.y - 20) continue; // above the round only
    const dx = e.x - b.x;
    const dy = e.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = j;
    }
  }
  return best;
}

export function updatePlayerBolts(w, dt) {
  const pool = w.playerBolts;
  for (let i = 0; i < pool.length; i++) {
    const b = pool[i];
    if (!b.alive) continue;

    // --- steering (WEAPONS.swarm) ------------------------------------------
    // Heading is rotated toward the target at a bounded rate, which is what
    // makes the round CURVE rather than snap -- a snapping projectile reads as
    // a rendering bug, and the visible arc is most of what sells the weapon.
    // Speed is preserved exactly, so the round's own travel time is unchanged
    // by how hard it is turning.
    if (b.turn) {
      b.retargetT -= dt;
      if (b.target < 0 || b.retargetT <= 0) {
        b.target = acquireTarget(w, b);
        b.retargetT = 0.22;
      }
      const e = b.target >= 0 ? w.enemies[b.target] : null;
      if (e && e.alive && e.mode !== 'fleeing' && e.y < b.y) {
        const speed = Math.hypot(b.vx, b.vy) || 1;
        const cur = Math.atan2(b.vy, b.vx);
        let d = Math.atan2(e.y - b.y, e.x - b.x) - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const max = b.turn * dt;
        const next = cur + Math.max(-max, Math.min(max, d));
        b.vx = Math.cos(next) * speed;
        b.vy = Math.sin(next) * speed;
      } else {
        b.target = -1;
      }
    }

    const dx = b.vx * dt;
    const dy = b.vy * dt;
    b.x += dx;
    b.y += dy;

    // --- range (WEAPONS.flak) ----------------------------------------------
    // Measured as DISTANCE TRAVELLED, not as a lifetime, so the limit means the
    // same thing for a straight round and a curving one and does not change if
    // the weapon's speed is ever retuned. This is Flak's whole identity: see
    // the note on WEAPONS.flak before touching rangePx.
    if (b.lifePx) {
      b.lifePx -= Math.hypot(dx, dy);
      if (b.lifePx <= 0) {
        b.alive = false;
        continue;
      }
    }

    // Retire above the HUD strip -- a bolt must never be drawn into the boss
    // bar's band (§5.1) -- and off the sides, which only an angled round can
    // reach.
    if (b.y < BANDS.hudStrip.bottom * DESIGN_H - 40) b.alive = false;
    else if (b.x < -60 || b.x > DESIGN_W + 60) b.alive = false;
  }
}

/**
 * Apply damage. Attrition, not lives (§5.10): a hit costs a segment and the
 * score chain, nothing else. Rank is NEVER lost to damage -- that compounds
 * failure and punishes the player exactly when they are already losing, and
 * is deliberately not in this design.
 *
 * Returns true if the hit actually landed (i.e. was not absorbed by i-frames).
 */
export function damagePlayer(w, segments, fx) {
  const p = w.player;
  if (p.invulnT > 0 || !p.alive) return false;
  // Dev cheat (ui/devPanel.js). Deliberately checked HERE rather than at the
  // call sites: every path that can hurt the player already funnels through
  // this one function, so a future damage source cannot quietly bypass it.
  // Returns false, the same as an i-frame absorb, so nothing downstream needs
  // to know the difference.
  if (w.debug.invincible) return false;

  p.shield -= segments;
  p.invulnT = PLAYER.invulnS;
  p.hitFlashT = 0.35;
  w.stats.damageTaken += segments;
  w.director.hitsThisWave++;

  w.fx.shakeT = FX.screenShake.hitDurationS;
  w.fx.shakeMag = FX.screenShake.hitMagnitude;
  w.fx.flashT = 0.12;

  if (p.shield <= 0) {
    p.shield = 0;
    p.alive = false;
  }
  // Sounded HERE rather than at the three call sites in /systems/collision.js,
  // because this is the one function that knows whether a hit actually landed
  // (i-frames swallow the rest) and whether it was the last one. Two distinct
  // clips: the run continuing and the run ending must never sound the same.
  if (p.alive) sfx('playerHit');
  else sfx('playerDown');
  return true;
}
