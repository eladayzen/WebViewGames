/* Pickups, and the perks they arm.
 *
 * Still orientation-free: a pickup lives at an (along, across) pair like
 * everything else, so it lands correctly in either layout without this file
 * knowing which one is running.
 *
 * The rule that shapes the whole thing: only YOUR ball collects. A pickup is
 * tested against the ball only while the last paddle to have struck it was a
 * human's, so collecting one is always the consequence of a shot the player
 * chose to play. An opponent's return sails through untouched -- otherwise the
 * best perks would land on whoever happened to be hitting at the time, which
 * is the opposite of a reward.
 */

import { SHARED, PICKUPS, PERKS } from '../data/tuning.js';
import { SIDE_NEAR } from './world.js';

function isHumanSide(w, side) {
  return side === SIDE_NEAR || w.twoPlayer;
}

export function resetPickups(w) {
  w.pickups.length = 0;
  w.spawnIn = PICKUPS.firstSpawnSec;
  for (const key of Object.keys(w.perks)) w.perks[key] = 0;
}

export function updatePickups(w, dt) {
  // Age out anything that has been sitting too long, so a court left alone
  // does not silently fill up with targets nobody went for.
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const p = w.pickups[i];
    p.age += dt;
    if (p.age >= PICKUPS.lifetimeSec) w.pickups.splice(i, 1);
  }

  w.spawnIn -= dt;
  if (w.spawnIn <= 0) {
    w.spawnIn = PICKUPS.spawnEverySec;
    if (w.pickups.length < PICKUPS.maxAlive) spawn(w);
  }
}

function spawn(w) {
  // A few attempts to find a spot clear of the others, then give up rather
  // than loop -- a missed spawn is invisible, a hang is not.
  for (let attempt = 0; attempt < 12; attempt++) {
    const along = (PICKUPS.alongMin + w.rng() * (PICKUPS.alongMax - PICKUPS.alongMin)) * w.L;
    const across =
      PICKUPS.acrossMargin + w.rng() * (w.A - PICKUPS.acrossMargin * 2);

    let clear = true;
    for (const other of w.pickups) {
      const d = Math.hypot(other.along - along, other.across - across);
      if (d < PICKUPS.radius * 3) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;

    w.pickups.push({
      along,
      across,
      age: 0,
      kind: pickKind(w),
      // Purely cosmetic, so two pickups on screen are not pulsing in lockstep.
      phase: w.rng() * Math.PI * 2,
    });
    return;
  }
}

function pickKind(w) {
  const kinds = Object.keys(PERKS);
  return kinds[Math.floor(w.rng() * kinds.length) % kinds.length];
}

/* Distance from a segment to a point, squared. The ball can cross a whole
 * pickup between two samples at the top of its speed ramp, so this tests the
 * path it travelled rather than the two endpoints. */
function segmentHits(a, b, cx, cy, radius) {
  const dx = b.along - a.along;
  const dy = b.across - a.across;
  const fx = a.along - cx;
  const fy = a.across - cy;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) t = Math.max(0, Math.min(1, -(fx * dx + fy * dy) / len2));
  const nx = fx + dx * t;
  const ny = fy + dy * t;
  return nx * nx + ny * ny <= radius * radius;
}

/* Test the ball's path this step against every live pickup. Returns the perk
 * id collected, or null. */
export function collidePickups(w, from, to) {
  if (!w.ball.live) return null;
  if (!isHumanSide(w, w.lastHitBy)) return null;

  const reach = PICKUPS.radius + SHARED.ballRadius;
  for (let i = 0; i < w.pickups.length; i++) {
    const p = w.pickups[i];
    if (!segmentHits(from, to, p.along, p.across, reach)) continue;
    w.pickups.splice(i, 1);
    const perk = PERKS[p.kind];
    if (perk) {
      // Re-collecting refreshes rather than stacks: two of the same perk
      // running at once means nothing on screen, and a stacked timer just
      // hides how long is left.
      w.perks[p.kind] = perk.durationSec;
      return p.kind;
    }
    return null;
  }
  return null;
}

/* Run down the active perk timers. */
export function tickPerks(w, dt) {
  for (const key of Object.keys(w.perks)) {
    if (w.perks[key] > 0) w.perks[key] = Math.max(0, w.perks[key] - dt);
  }
}

export function activePerk(w) {
  for (const key of Object.keys(w.perks)) {
    if (w.perks[key] > 0) return { id: key, left: w.perks[key], ...PERKS[key] };
  }
  return null;
}
