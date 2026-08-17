// Collision (§9.1) -- circle/circle with early rejects, over the flat pools.
//
// "At these counts (<= 30 enemy bullets x 1 player, <= 40 player bolts x <= 26
// enemies) no spatial partitioning is warranted; don't build one." Taken
// literally: this is two nested loops and a squared-distance test.

import {
  PLAYER,
  ENEMY,
  enemyDef,
  BULLET,
  BOSS,
  DESIGN_H,
  BANDS,
} from '../data/tuning.js';
import { damagePlayer } from '../player/player.js';
import { boltHitsBoss } from '../enemies/boss.js';

function hits(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

export function resolveCollisions(w, fx, instr) {
  const p = w.player;

  // --- player bolts vs enemies and the boss --------------------------------
  for (let i = 0; i < w.playerBolts.length; i++) {
    const b = w.playerBolts[i];
    if (!b.alive) continue;

    // The boss is tested first, and /enemies/boss.js decides in ONE call both
    // whether the bolt is stopped and what it hit.
    //
    // THE BUG THIS SHAPE EXISTS TO PREVENT. This used to be two calls: a hull
    // rect test that killed the bolt, then a damage call on the dead bolt's
    // position. Because a bolt flies straight up, the hull test always fired at
    // the hull's BOTTOM edge, 246px below every pod -- so the damage call was
    // always handed a point that matched nothing, and the boss was literally
    // undamageable while both halves looked individually correct. Any future
    // "early reject the boss before asking about damage" optimisation
    // reintroduces exactly that class of bug; the whole point of the single call
    // is that the stop and the damage can never disagree about where the bolt
    // was.
    if (w.boss.active) {
      const what = boltHitsBoss(
        w, b.x, b.y, b.r, PLAYER.fire.boltDamage, fx
      );
      if (what) {
        b.alive = false;
        // Only landed damage counts as a hit. Armour deflections used to count,
        // which made the accuracy metric read 100% through a fight in which
        // nothing whatsoever was being damaged -- the instrumentation agreed
        // with the bug instead of exposing it.
        if (what === 'pod' || what === 'core' || what === 'hullHp') w.stats.hits++;
        else w.stats.deflects++;
        continue;
      }
      // null means the bolt is unobstructed -- either clear of the hull, or
      // climbing a pod's shot channel. Fall through: nothing else is up there
      // during a boss fight, but the loop below is harmless and this stays
      // honest about the boss not being a wall.
    }

    for (let j = 0; j < w.enemies.length; j++) {
      const e = w.enemies[j];
      if (!e.alive || e.mode === 'fleeing') continue;
      // Early reject on y before doing the full test -- bolts travel fast and
      // most of them are nowhere near any enemy on any given frame. 90 clears
      // the widest possible real hit (Emitter radius 44 + bolt radius 9 = 53)
      // with room to spare, so adding a fatter type cannot silently turn this
      // optimisation into dropped collisions.
      if (Math.abs(e.y - b.y) > 90) continue;
      const def = enemyDef(e.type);
      if (!hits(b.x, b.y, b.r, e.x, e.y, def.radius)) continue;

      b.alive = false;
      e.hp -= PLAYER.fire.boltDamage;
      e.hitFlashT = 0.09;
      w.stats.hits++;
      if (e.hp <= 0) {
        killEnemy(w, e, fx, instr);
      } else {
        fx.impact(e.x, e.y);
      }
      break;
    }
  }

  if (!p.alive) return;

  // --- enemy bullets vs player -------------------------------------------
  for (let i = 0; i < w.enemyBullets.length; i++) {
    const b = w.enemyBullets[i];
    if (!b.alive) continue;

    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const d2 = dx * dx + dy * dy;

    // Near-miss bookkeeping: an enemy bullet passing within 40 px of the
    // hitbox without hitting. Feeds instrumentation now and the Overload
    // Vent's earned charge at MVP (§5.8).
    if (!b.counted) {
      const nr = BULLET.nearMissRadius + PLAYER.hitboxRadius + b.r;
      if (d2 <= nr * nr) {
        b.counted = true;
        instr.nearMiss();
      }
    }

    const hr = PLAYER.hitboxRadius + b.r;
    if (d2 > hr * hr) continue;

    b.alive = false;
    if (damagePlayer(w, PLAYER.damage.bullet, fx)) {
      fx.playerHit(p.x, p.y);
      instr.playerHit(w, 'bullet');
    }
  }

  // --- enemy bodies vs player (swoop contact damage, §5.5) ----------------
  // "Contact damage exists on the swoop, which is exactly what makes a player
  // who is drifting upward for a chevron take a real risk -- and exactly why
  // the drift must never be required."
  for (let j = 0; j < w.enemies.length; j++) {
    const e = w.enemies[j];
    if (!e.alive || e.mode === 'fleeing') continue;
    if (e.y < p.y - 260) continue; // early reject: still up in the band
    const def = enemyDef(e.type);
    if (!hits(e.x, e.y, def.radius * 0.8, p.x, p.y, PLAYER.hitboxRadius))
      continue;
    if (damagePlayer(w, def.contactDamage, fx)) {
      fx.playerHit(p.x, p.y);
      instr.playerHit(w, 'contact');
    }
  }

  // NOTE: there is deliberately no boss-hull contact test. §6.4 puts the
  // boss's lowest extent at y = 0.58, above the player band, and the boss
  // never descends -- so contact is geometrically impossible and a test for it
  // would be dead code implying otherwise. The constraints validator asserts
  // the geometry at boot instead, which is the honest place for the guarantee.
}

export function killEnemy(w, e, fx, instr) {
  const preLock = !e.locked;
  const def = enemyDef(e.type);
  e.alive = false;
  // The craft takes its pattern with it. For an Emitter this IS the reward --
  // the sweep it was running stops because the thing running it is gone
  // (§6.2) -- and dropping the instance rather than flagging it means there is
  // nothing left that could be re-enabled by a later edit.
  e.emitter = null;
  w.stats.kills++;
  w.director.killedThisWave++;
  // Pre-lock bonus x2 (§8.2). POC has no scoring UI, but the stat is tracked
  // because "killing them mid-entry is both the skill play and the score play"
  // is the loop's central claim and POC-8 wants to know whether players
  // actually find it.
  if (preLock) w.stats.preLockKills++;
  w.stats.score += def.score * (preLock ? ENEMY.preLockScoreMultiplier : 1);
  instr.kill(preLock);
  fx.explosion(e.x, e.y);
}

/** Runtime assertions on the invariants the pacing contract depends on
 *  (§9.4: "Runtime assertions on the same invariants (bullet count, banner
 *  queue depth) are cheap and should also be on in dev builds"). */
export function assertRuntimeInvariants(w, report) {
  let bullets = 0;
  let enemies = 0;
  for (let i = 0; i < w.enemyBullets.length; i++) {
    if (w.enemyBullets[i].alive) bullets++;
  }
  for (let i = 0; i < w.enemies.length; i++) if (w.enemies[i].alive) enemies++;

  if (bullets > w.caps.bullets) {
    report(`bullet cap exceeded at runtime: ${bullets} > ${w.caps.bullets}`);
  }
  if (enemies > w.caps.enemies) {
    report(`enemy cap exceeded at runtime: ${enemies} > ${w.caps.enemies}`);
  }
  // Band discipline: nothing locked may sit in the transit gutter (§5.1) --
  // "a hovering mini-boss or a stalled formation in the gutter instantly
  // removes the player's read and is forbidden at every tier."
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (e.alive && e.mode === 'locked' && e.y > BANDS.formation.bottom * DESIGN_H) {
      report(`locked enemy camping the gutter at y=${e.y.toFixed(0)}`);
    }
    // The swoop must never enter the player band.
    if (e.alive && e.y > ENEMY.swoop.minY * DESIGN_H + 4 && e.mode === 'swooping') {
      report(`swoop breached the player band at y=${e.y.toFixed(0)}`);
    }
    // §6.2's Emitter never swoops. The boot validator proves the TYPE TABLE
    // says so; this proves the running game agrees, which is the half that
    // survives someone adding a new way to enter the swoop state.
    if (e.alive && e.mode === 'swooping' && !enemyDef(e.type).swoops) {
      report(`type '${e.type}' entered a swoop but is declared swoops:false`);
    }
  }

  // The boss's lowest extent must stay above the player band (§6.4). This is
  // static geometry the validator already checks, but it is checked live too
  // because it is the one boss invariant whose failure is unrecoverable: a
  // hull in the player band is unavoidable contact on a machine where the
  // player cannot dodge upward.
  if (w.boss.active) {
    const halfH = (BOSS.width / Math.max(0.01, w.boss.aspect)) * 0.5;
    const bottom = w.boss.y + halfH;
    if (bottom > BOSS.maxExtentY * DESIGN_H + 1) {
      report(
        `boss extends to y=${bottom.toFixed(0)}, past its ` +
          `${(BOSS.maxExtentY * DESIGN_H).toFixed(0)} floor`
      );
    }
  }
  return { bullets, enemies };
}
