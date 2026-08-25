// Pickups (§5.6) -- drops, flight path, collection, and the temporary weapon.
//
// Amit asked for this first and in these words:
//
//   "add some pickups that every now and then when an enemy dies we should
//    have a value to control it on what's the chances of getting a pick up.
//    Basically when the enemy dies he gives birth to like a pick up item. If I
//    pick it up I have some abilities. The simplest one is another weapon like
//    a fire different kind of projectiles for limited time."
//
// THE VALUE HE ASKED FOR IS `PICKUPS.dropChance` IN /data/tuning.js, one row
// per enemy type. Nothing in this file decides how often a pickup appears; it
// reads that table. That separation is the request, not a style preference --
// retuning drop frequency has to be editing a number in the one findable place
// (§9.3), never reasoning about code in here.
//
// ---------------------------------------------------------------------------
// THE PART THAT MATTERS MORE THAN THE DROP RATE: WHERE A PICKUP MAY GO.
//
// §5.6 gives Mode S four flight-path rules, and §12 names the reason they
// exist: "Mode S's specific failure mode is vertical drift-chasing" -- a player
// leaning forward or back to chase something before it scrolls away. That lean
// is the expensive one on a balance board (§0.5) and the POC-8 decision note
// records that the risk "has not been measured, only not-noticed". So the rules
// are implemented as hard geometry rather than as guidance:
//
//   1. LATERAL LURE ONLY, capped at 0.35 of the width from the player.
//   2. Never a target above y = 0.62 -- a canister is born at the kill site up
//      in the formation band and FALLS toward the player. It is a thing that
//      comes to you, never a thing you climb for.
//   3. In Mode S it rides the surface; in Mode A it drifts at its own speed.
//   4. One that scrolls past uncollected is re-offered.
//
// The consequence worth stating plainly, because it is the whole safety
// argument: a pickup descends past EVERY y the player can occupy
// (PLAYER_CLAMP_Y is 0.620..0.930 and the pickup runs to 1.02), so collecting
// one is always purely a question of x. There is no vertical input that helps.
// ---------------------------------------------------------------------------

import {
  PICKUPS,
  PLAYER,
  PLAYABLE_X,
  PLAYER_CLAMP_X,
  TELEGRAPH,
  DESIGN_W,
  DESIGN_H,
  weaponDef,
} from '../data/tuning.js';
import { cfg } from '../core/mode.js';
import { alloc, liveCount } from '../core/state.js';
import { makeRng } from '../core/rng.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------------------
// A SEPARATE RANDOM STREAM, and this is load-bearing rather than tidy.
//
// Level one is locked -- Amit is demoing it -- and its squadron script is a
// deterministic replay of /core/rng.js's seeded stream: entry side, path shape,
// timing jitter and prop recycling all draw from it in a fixed order. A drop
// roll on that stream would advance it once per kill, which would reshuffle
// every subsequent draw and quietly rewrite level one's choreography. The
// content would still be deterministic; it just would not be the content Amit
// is showing people.
//
// So pickups roll on their own stream, reseeded alongside the scenario. The
// main stream is left byte-for-byte where it was, which is the same discipline
// varyHash in /enemies/enemies.js was introduced for.
// ---------------------------------------------------------------------------
const prng = makeRng(0x5069636b); // 'Pick'

export function resetPickups(w, seed) {
  prng.reseed((seed ^ 0x5069636b) >>> 0);
  for (const p of w.pickups) p.alive = false;
  w.pickup.killsSinceDrop = 0;
  w.pickup.lastDropT = -999;
  w.pickup.dropped = 0;
  w.pickup.collected = 0;
  w.player.weapon = 'standard';
  w.player.weaponT = 0;
}

// ---------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------

/**
 * A craft just died. Decide whether it "gives birth to" a pickup.
 *
 * Two gates before the roll, and both are about legibility rather than
 * generosity: at most PICKUPS.maxOnScreen exist at once, and never two inside
 * PICKUPS.minGapS. §5.6's whole design is that a pickup pulls the player a
 * measured distance out of the safe lane -- two of them at once is not two
 * lures, it is a scatter of choices with no measured distance to anything.
 */
export function maybeDropPickup(w, type, x, y) {
  if (liveCount(w.pickups) >= PICKUPS.maxOnScreen) return false;
  if (w.time - w.pickup.lastDropT < PICKUPS.minGapS) return false;

  const chance = PICKUPS.dropChance[type];
  const p = chance === undefined ? PICKUPS.dropChance.default : chance;

  // THE FLOOR UNDER THE RANDOMNESS. "About two per level" and "sometimes none"
  // are different promises, and the run where a first-time player never sees
  // the mechanic is the run that fails the brief -- so a long enough dry spell
  // forces the next kill to drop. This is what turns an expectation of 2.2 into
  // a reliable 2.
  const forced = w.pickup.killsSinceDrop >= PICKUPS.maxKillsWithoutDrop;
  if (!forced && prng.next() >= p) {
    w.pickup.killsSinceDrop++;
    return false;
  }

  spawnPickup(w, x, y, rollKind(w));
  return true;
}

/**
 * WHICH weapon this canister grants.
 *
 * Weighted from PICKUPS.weaponWeights, so "how often do pickups appear" and
 * "which one do I get" are two separate knobs in the same findable place (§9.3)
 * rather than one knob and a hardcoded id -- which is what the first version
 * was, correctly, when there was only one weapon to grant.
 *
 * THE RUNNING WEAPON IS EXCLUDED (PICKUPS.excludeRunningWeapon). §5.6's design
 * is that a canister pulls the player a measured distance out of the safe lane,
 * and with four kinds an unfiltered draw would make one collection in four
 * refresh a clock and change nothing on screen. A lure has to be worth the
 * lean, so every canister visibly changes what comes out of the guns.
 *
 * Drawn from the pickup stream, not the scenario's -- see the note at the top
 * of this file. Level one's choreography must stay byte-for-byte where it is.
 */
function rollKind(w) {
  const running = w.player.weaponT > 0 ? w.player.weapon : '';
  let total = 0;
  for (const id of Object.keys(PICKUPS.kinds)) {
    if (PICKUPS.excludeRunningWeapon && PICKUPS.kinds[id].weapon === running) continue;
    total += PICKUPS.weaponWeights[id] || 0;
  }
  // Every candidate excluded or unweighted: fall back to the introductory one
  // rather than to nothing. Unreachable with the authored table, and a canister
  // that granted nothing would be the worst possible failure mode for a lure.
  if (total <= 0) return 'scatter';
  let r = prng.next() * total;
  for (const id of Object.keys(PICKUPS.kinds)) {
    if (PICKUPS.excludeRunningWeapon && PICKUPS.kinds[id].weapon === running) continue;
    r -= PICKUPS.weaponWeights[id] || 0;
    if (r <= 0) return id;
  }
  return 'scatter';
}

/**
 * Put a canister in the world.
 *
 * `x` is the kill site, and it is CLAMPED rather than used: §5.6 caps a
 * pickup's lateral offset from the player at 0.35 of the width ("~1.1 s of
 * travel at LATERAL_MAX. Enough to be a decision, never a sprint"). A craft
 * killed at the far edge of a 12-wide grid while the player sits at the other
 * clamp is 0.84 of the width away, so without this the offer would routinely be
 * a sprint the player cannot make -- which is how a lure becomes a tax.
 */
function spawnPickup(w, x, y, kind) {
  const q = alloc(w.pickups);
  if (!q) return null;
  q.alive = true;
  q.kind = kind;
  q.x = lureX(w, x);
  q.y = y;
  q.t = 0;
  q.vy = 0;
  q.reOffers = PICKUPS.reOffers;
  q.reOfferT = 0;
  q.reOfferX = q.x;
  w.pickup.lastDropT = w.time;
  w.pickup.killsSinceDrop = 0;
  w.pickup.dropped++;
  return q;
}

/** §5.6's offset cap, plus the playable-width clamp so a canister can never sit
 *  under a HUD gauge (§5.1's HUD-exclusion rule covers pickups by name). */
function lureX(w, x) {
  const max = PICKUPS.maxOffsetFrac * DESIGN_W;
  const px = w.player.x;
  let out = Math.max(px - max, Math.min(px + max, x));
  // Tighter of the two bounds: the playable width, and the player's own
  // lateral clamp. A pickup outside PLAYER_CLAMP_X could be drawn and lit and
  // still be uncollectable, which is the same class of bug as boss one's
  // unreachable pods.
  const lo = Math.max(PLAYABLE_X.min, PLAYER_CLAMP_X.min) * DESIGN_W;
  const hi = Math.min(PLAYABLE_X.max, PLAYER_CLAMP_X.max) * DESIGN_W;
  return Math.max(lo, Math.min(hi, out));
}

// ---------------------------------------------------------------------------
// Per-frame
// ---------------------------------------------------------------------------

export function updatePickups(w, dt) {
  const m = cfg();
  // "Pickups drift downward slowly (Mode A: 90 px/s; Mode S: they ride the
  // surface)" (§5.6). Riding the surface is literal: the same SCROLL_SPEED the
  // ground moves at, so the canister is visibly ON the world rather than
  // floating in the air frame.
  const fall = m.scrollSpeed > 0 ? m.scrollSpeed : PICKUPS.driftSpeedA;

  for (let i = 0; i < w.pickups.length; i++) {
    const q = w.pickups[i];
    if (!q.alive) continue;

    // A re-offer in flight: nothing is drawn, a clock is running.
    //
    // THE RE-OFFER IS A TOP-EDGE ARRIVAL, so it obeys §5.3's entry-band
    // telegraph like every other one: "Anything arriving from the top edge --
    // every ground target in Mode S, every top-edge spawn anywhere -- is
    // preceded by a marker in the entry telegraph band at its x, 1.0 s before
    // it appears." In Mode S that marker "is what buys back the reading time
    // the scroll consumes", and the reading it buys here is specifically
    // lateral: the player learns WHICH x the canister is coming back at while
    // there is still a second to lean.
    if (q.reOfferT > 0) {
      const before = q.reOfferT;
      q.reOfferT -= dt;
      // Fire the marker exactly once, when the lead time opens.
      if (before > TELEGRAPH.leadS && q.reOfferT <= TELEGRAPH.leadS) {
        q.reOfferX = lureX(w, w.player.x);
        pushTelegraph(w, q.reOfferX, TELEGRAPH.leadS);
      }
      if (q.reOfferT <= 0) {
        q.y = -80;
        q.x = q.reOfferX;
        q.t = 0;
      }
      continue;
    }

    q.t += dt;
    q.y += fall * dt;

    if (q.y > 1.02 * DESIGN_H) {
      // "Anything that scrolls past uncollected is either optional or
      // re-offered within 8 s" (§5.6). Once, then it is gone -- an infinitely
      // re-offered pickup would eventually be collected by a player standing
      // still, which is the exact opposite of a lure.
      if (q.reOffers > 0) {
        q.reOffers--;
        q.reOfferT = PICKUPS.reOfferS;
        q.reOfferX = w.player.x;
      } else {
        q.alive = false;
      }
      continue;
    }

    // Collection. "A generous radius (72 px), so a near-miss is a hit" (§5.6).
    if (!w.player.alive) continue;
    const dx = q.x - w.player.x;
    const dy = q.y - w.player.y;
    const r = PICKUPS.collectRadius + PLAYER.hitboxRadius;
    if (dx * dx + dy * dy <= r * r) {
      collect(w, q);
    }
  }

  // The temporary weapon's clock. Expiry is immediate -- there is no input to
  // warn about and nothing the player can do differently, so the countdown in
  // the margin (see /ui/hud.js) and one falling cue are the whole notice.
  //
  // THE CUE IS NEW AND THE VISUAL SILENCE IS NOT AN ARGUMENT AGAINST IT: the
  // player is standing on a board reading the centre of the screen, and the
  // weapon timer lives in the left margin. On the board, the moment the gun
  // changes back is exactly the moment a sound carries better than a bar.
  const p = w.player;
  if (p.weaponT > 0) {
    p.weaponT = Math.max(0, p.weaponT - dt);
    if (p.weaponT === 0) {
      p.weapon = 'standard';
      sfx('weaponExpire');
    }
  }
}

function collect(w, q) {
  q.alive = false;
  w.pickup.collected++;
  const kind = PICKUPS.kinds[q.kind] || PICKUPS.kinds.scatter;
  const def = weaponDef(kind.weapon);
  const p = w.player;
  // `refresh` tops the clock back up rather than stacking, so two drops close
  // together are never wasted and can never bank into a minute of scatter.
  p.weaponT = def.refresh
    ? Math.max(p.weaponT, def.durationS)
    : def.durationS;
  p.weapon = def.id;
  // Mixed near the top of the range: crossing the frame for a canister is the
  // one thing in the game the player chooses to do, and the reward for it
  // should be the loudest good news there is.
  sfx('pickup');
}

/** Whether a pickup is drawable this frame (a re-offer in flight is not).
 *  Exported so /render does not have to know what a re-offer is. */
export function pickupVisible(q) {
  return q.alive && q.reOfferT <= 0;
}

// ---------------------------------------------------------------------------
// The entry-band telegraph (§5.3)
//
// The pool and the band have existed since POC-1 with nothing to put in them --
// "POC has no top-edge spawns (no ground targets), but the band and the marker
// system exist so MVP does not have to retrofit them". The re-offered pickup is
// the first top-edge arrival the game has, so this is that system going live,
// unchanged in shape: a marker at the arrival's x, TELEGRAPH.leadS ahead,
// fading in over TELEGRAPH.fadeInS and pulsing.
// ---------------------------------------------------------------------------

export function pushTelegraph(w, x, leadS) {
  const t = alloc(w.telegraphs);
  if (!t) return null;
  t.alive = true;
  t.x = x;
  t.t = 0;
  t.lead = leadS;
  return t;
}

export function updateTelegraphs(w, dt) {
  for (let i = 0; i < w.telegraphs.length; i++) {
    const t = w.telegraphs[i];
    if (!t.alive) continue;
    t.t += dt;
    if (t.t >= t.lead) t.alive = false;
  }
}
