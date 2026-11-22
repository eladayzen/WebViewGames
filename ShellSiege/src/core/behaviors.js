// WHAT EACH ENEMY DOES, which is the point of having five of them.
//
// Elad, 22 Nov: the enemies should differ by JOB, not just by hit points.
// "Slayer is currently the relatively fast simple soldier"; the Evil God "should
// be the low-HP ranged attacker ... she should throw stuff"; and the golems
// should each have their own game job. So:
//
//   melee     Slayer           chases you and swings. Today's behaviour, unchanged.
//   thrower   Evil God         keeps its distance and throws a slow orb.
//   charger   Mechanical Golem locks a line, then rushes down it; crashing
//                              into a pillar stuns it.
//   slammer   Elemental Golem  stops near you and slams the ground in a circle.
//   summoner  Fort Golem       calls Slayers, and swings if you get close.
//
// A JOB IS A RHYTHM THE PLAYER LEARNS, and what makes it learnable is the
// WARNING. Every job here has a telegraph state (`throw`, `charge`, `slam`,
// `cast`) in which the foe stands still and publishes `f.tell` -- WHERE the
// danger will be -- and the damage is decided on the release frame against where
// the player is THEN, not when the warning began. That is the same contract the
// melee swing has always had, and it is what makes stepping out of a danger a
// dodge instead of a cosmetic retreat.
//
// THE DODGES FIT THE BOARD. The charge is a straight line, so the answer is a
// sideways lean -- the one axis a child on a board does comfortably. The slam is
// a circle, so the answer is simply to walk out of it.
//
// PURE: a function of a foe and a context, no DOM and no world imports. The
// context (built in core/foes.js) supplies the player's position and the few
// things a behaviour may DO: hurt the player, move with collision, throw, spawn.
//
//   ctx = { w, p, dt, dx, dy, d, slack, pr, onStrike, hurt, move, shoot, spawn, clear }
//   clear() : is there a clear line to the player for a thrown thing?
//   dx, dy, d : vector from the foe to the player, and its length
//   pr        : the player's radius
//   move(mx,my,slide) -> null | 'obstacle' | 'wall'   (slide: get round obstacles; off for a dash)

/** The states in which a foe is WARNING you, and so should show f.tell. */
export const TELEGRAPH_STATES = new Set(['windup', 'charge', 'slam', 'throw', 'cast']);

/** The ordinary swing. This is the code that was in updateFoes before there were jobs. */
export function meleeStep(f, c) {
  if (f.state === 'walk') {
    if (c.d <= f.reach) {
      f.state = 'windup';
      f.stateT = 0;
    } else {
      const step = Math.min(f.speed * c.dt, c.d - f.reach);
      f.x += (c.dx / c.d) * step;
      f.y += (c.dy / c.d) * step;
      f.stepped = step;
    }
  } else if (f.state === 'windup') {
    if (f.stateT >= f.windupS) {
      // THE RELEASE FRAME. Re-measured now, not when the swing started -- that
      // is what makes stepping out of range a dodge rather than a cosmetic
      // retreat, and it is the whole point of the telegraph.
      if (c.d <= f.reach + c.slack && !c.w.dead) {
        c.hurt(f.damage, f.push, f);
        if (c.onStrike) c.onStrike(f);
      }
      f.state = 'recover';
      f.stateT = 0;
    }
  } else if (f.stateT >= f.recoverS) {
    f.state = 'walk';
    f.stateT = 0;
  }
}

const state = (f, name) => { f.state = name; f.stateT = 0; };

/**
 * WHAT TO DRAW AS THE WARNING, from the foe's state AFTER this frame's step.
 *
 * Computed in one place, from the final state, rather than set inside each
 * behaviour's branch. The branch version had a one-frame gap: on the frame a
 * foe ENTERED a warning state the data was still empty and only appeared on the
 * next, so the renderer was briefly told "throwing" with nothing to show.
 * `t` runs 0 to 1 over the warning, for the marker to fill.
 */
export function tellOf(f) {
  const j = f.job, b = f.b;
  if (!j) return null;
  const t = Math.min(1, f.stateT / (j.windupS || 1));
  switch (f.state) {
    case 'throw':  return { kind: 'orb', t };
    case 'charge': return { kind: 'line', x: f.x, y: f.y, dx: b.dx, dy: b.dy, len: j.dist, halfW: f.radius, t };
    case 'slam':   return { kind: 'ring', x: f.x, y: f.y, r: j.radius, t };
    case 'cast':   return { kind: 'sigil', x: f.x, y: f.y, r: f.radius * 1.5, t };
    default:       return null;
  }
}

/**
 * EVIL GOD. Holds a ring around you, backs off if you close in, and throws a
 * slow orb. The orb is slower than you are, so it is dodged by moving, and
 * stopped by a tall obstacle, so it is also dodged by standing behind one.
 */
export function throwerStep(f, c) {
  const j = f.job;
  const b = f.b || (f.b = { cool: j.throwEvery * 0.4 });     // the first throw comes soon
  b.cool = Math.max(0, b.cool - c.dt);

  if (f.state === 'walk') {
    // IT ONLY THROWS WITH A CLEAR LINE. Found by the soak test: a thrower with a
    // wall between it and the player stood there throwing orbs into the wall --
    // and, worse, stopping to throw reset its wall-following, so it oscillated on
    // the spot for good. With no line it ignores its preferred range and works
    // round the obstacle (committed, see core/obstacles.js) until it has one.
    const clear = c.clear();
    let step = 0;
    if (!clear) step = Math.min(f.speed * c.dt, Math.max(0, c.d - 60));              // no shot: go and find one
    else if (c.d > j.keepMax) step = Math.min(f.speed * c.dt, c.d - j.keepMax);      // too far: close in
    else if (c.d < j.keepMin) step = -Math.min(f.speed * 0.9 * c.dt, j.keepMin - c.d); // too near: back off
    if (step) {
      c.move((c.dx / c.d) * step, (c.dy / c.d) * step, true);   // true: slide round obstacles, like any walker
      f.stepped = Math.abs(step);
    }
    if (b.cool <= 0 && clear && c.d <= j.keepMax + 160) state(f, 'throw');
  } else if (f.state === 'throw') {
    if (f.stateT >= j.windupS) {
      c.shoot(j);                         // aimed at where the player is NOW
      state(f, 'recover');
      b.cool = j.throwEvery;
    }
  } else if (f.stateT >= f.recoverS) {
    state(f, 'walk');
  }
}

/**
 * MECHANICAL GOLEM. Walks at you; at mid range it locks the line to you, shows
 * it on the floor, and rushes down it. It does not steer, so a sideways step is
 * a dodge. If it hits a tall obstacle it is stunned, which is the reason to
 * stand with a pillar behind you.
 */
export function chargerStep(f, c) {
  const j = f.job;
  const b = f.b || (f.b = { cool: 1.0, dx: 1, dy: 0, left: 0, hit: false });
  b.cool = Math.max(0, b.cool - c.dt);

  if (f.state === 'walk') {
    if (b.cool <= 0 && c.d >= j.chargeMin && c.d <= j.chargeMax) {
      b.dx = c.dx / c.d;
      b.dy = c.dy / c.d;
      state(f, 'charge');
      return;
    }
    meleeStep(f, c);
  } else if (f.state === 'charge') {
    // THE LINE IS LOCKED THE MOMENT THE WARNING STARTS and does not follow the player.
    f.facing = Math.atan2(b.dy, b.dx);
    if (f.stateT >= j.windupS) {
      b.left = j.dist;
      b.hit = false;
      state(f, 'dash');
    }
  } else if (f.state === 'dash') {
    f.facing = Math.atan2(b.dy, b.dx);
    const step = Math.min(j.speed * c.dt, b.left);
    const hit = c.move(b.dx * step, b.dy * step);
    f.stepped = step;
    b.left -= step;
    // contact hurts ONCE per charge, measured body to body after the move
    if (!b.hit && Math.hypot(c.p.x - f.x, c.p.y - f.y) <= f.radius + c.pr) {
      b.hit = true;
      c.hurt(j.hitDamage, j.push, f);
      if (c.onStrike) c.onStrike(f);
    }
    if (hit === 'obstacle') { b.cool = j.every; state(f, 'stunned'); }      // crashed
    else if (hit === 'wall' || b.left <= 0.5) { b.cool = j.every; state(f, 'recover'); }
  } else if (f.state === 'stunned') {
    if (f.stateT >= j.stunS) state(f, 'walk');
  } else {
    meleeStep(f, c);                       // 'windup' and 'recover' are the ordinary swing
  }
}

/**
 * ELEMENTAL GOLEM. Slow. Near you it stops, a ring fills on the floor around it,
 * and then the ground is struck: anyone inside the ring at that instant is hit.
 * Walk out of the circle. Between slams it swings like anything else, if you
 * are within reach.
 */
export function slammerStep(f, c) {
  const j = f.job;
  const b = f.b || (f.b = { cool: 1.0 });
  b.cool = Math.max(0, b.cool - c.dt);

  if (f.state === 'walk') {
    if (b.cool <= 0 && c.d <= j.trigger) { state(f, 'slam'); return; }
    meleeStep(f, c);
  } else if (f.state === 'slam') {
    if (f.stateT >= j.windupS) {
      // measured NOW: stepping out of the ring during the warning is a dodge
      if (c.d <= j.radius + c.pr && !c.w.dead) {
        c.hurt(j.damage, j.push, f);
        if (c.onStrike) c.onStrike(f);
      }
      f.shock = { x: f.x, y: f.y, r: j.radius, t: 0.4 };       // the expanding ring the renderer draws
      b.cool = j.every;
      state(f, 'recover');
    }
  } else {
    meleeStep(f, c);
  }
}

/**
 * FORT GOLEM. The slowest and the biggest. It calls Slayers: a sigil spreads
 * under it, then they arrive beside it. Capped, so it cannot bury the room
 * forever, and killing it first is what stops the reinforcements.
 */
export function summonerStep(f, c) {
  const j = f.job;
  const b = f.b || (f.b = { cool: j.first, casts: 0 });
  b.cool = Math.max(0, b.cool - c.dt);

  if (f.state === 'walk') {
    if (b.casts < j.max && b.cool <= 0) { state(f, 'cast'); return; }
    meleeStep(f, c);
  } else if (f.state === 'cast') {
    if (f.stateT >= j.windupS) {
      // arrive on the player's side of the golem, fanned out, so they are seen coming
      const toward = Math.atan2(c.dy, c.dx);
      for (let i = 0; i < j.count; i++) {
        const a = toward + (i - (j.count - 1) / 2) * 0.9;
        c.spawn(j.breed, f.x + Math.cos(a) * (f.radius + 70), f.y + Math.sin(a) * (f.radius + 70));
      }
      b.casts += 1;
      b.cool = j.every;
      state(f, 'recover');
    }
  } else {
    meleeStep(f, c);
  }
}

export const BEHAVIORS = {
  melee: meleeStep,
  thrower: throwerStep,
  charger: chargerStep,
  slammer: slammerStep,
  summoner: summonerStep,
};
