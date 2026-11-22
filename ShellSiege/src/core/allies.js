// THE OTHER TURTLES: LEONARDO AND DONATELLO, CALLED IN BY A TEMPORARY ABILITY.
//
// Elad, 22 Nov: summon the other turtles. Leonardo with swords doing melee damage,
// following the player; revised after playing: he should DASH, not teleport, "like
// a relatively short attacker NPC". Donatello should feel different: no drone, stay
// close to Raphael, swing the staff WIDE, and every time it hits, STUN every enemy
// in a 30-degree cone.
//
// THEY COME AND GO. Elad: the turtles "should not be constant -- or they do most of
// the damage. They should have a timer and a break. Then you can upgrade them by
// increasing duration." So each ally is ACTIVE for `activeS`, then gone for `breakS`,
// then back, and each further copy of the ability adds `upgradeS` to how long he
// stays. The break does not shrink: the upgrade is time on the field, nothing else.
//
// ALLIES ARE A BEHAVIOUR, NOT A STAT, which is why they are `temp` abilities
// (core/abilities.js): the build says whether an ally is called, and this file
// turns that into bodies. Nothing here is stored twice -- `syncAllies` makes
// the list match the build every frame.
//
// THEY CANNOT BE HURT. A child on a board has enough to dodge, and an ally that
// dies is an ability that silently stops working in the middle of a room.
//
// THE TWO ARE DIFFERENT JOBS, not two copies of one ally:
//
//   LEONARDO  the SKIRMISHER. Stands by you until an enemy is near, DASHES at it
//             (fast, in a straight line), cuts it up at close range, then dashes
//             back. A short-range attacker who is at his best on the enemy that
//             is hurting you right now.
//   MICHELANGELO the SUPPORT. No damage at all, on purpose (Elad: "support"): he stays behind
//             you and every few seconds bakes a pizza on the floor nearby; walk onto it
//             and it heals you. It only gets made when you are hurt, and he does nothing
//             that Raphael or Leonardo do. More copies of the ability: longer on the
//             field AND a bigger heal per pizza.
//   DONATELLO the CONTROLLER. Stays at your shoulder. His staff is a wide sweep;
//             when it connects it fires a narrow stun wave down the line he is
//             facing -- every enemy in that 30-degree cone stops dead. He does
//             little damage; what he gives you is a lane of frozen enemies.
//
// A STUNNED FOE does nothing for `stunT` seconds: no walking, no attacking, and
// any wind-up it was in is cancelled. That cancel is the point -- stunning a
// golem mid-slam is the reward for it, and the reason to want Donatello near.
import { TELEGRAPH_STATES } from './behaviors.js';
import { ARENA } from './world.js';
import { overlapsAny } from './obstacles.js';

export const ALLY = {
  mikey: {
    label: 'Michelangelo',
    activeS: 8, upgradeS: 4, breakS: 12,
    followDist: 190, speed: 560,
    bakeEvery: 2.6,           // seconds between pizzas while he is out and you are hurt
    bakeS: 0.9, bakeAtS: 0.55,  // the flourish: the pizza appears this far in
    needBelow: 0.95,          // only bakes when you are below this share of your health
    maxOut: 3,                // never more than this many on the floor
    pizza: { near: 190, far: 330, lifeS: 9, radius: 95, heal: 0.10, healPerLevel: 0.03 },
  },
  leo: {
    label: 'Leonardo',
    followDist: 170,          // where he stands beside you, px
    speed: 560,               // walking speed to that spot
    seek: 620,                // he goes for foes within this of YOU
    activeS: 8, upgradeS: 4, breakS: 12,
    dashSpeed: 1800,          // px/s: fast enough to read as a dash, slow enough to see him go
    dashCooldownS: 0.8,
    strikeEvery: 0.5, windupS: 0.16, reach: 190, damage: 17, arc: 2.6,   // arc: total radians swept
    stayS: 3.2,               // how long he fights one place before looking for the next
    knock: 70,
  },
  donnie: {
    label: 'Donatello',
    activeS: 8, upgradeS: 4, breakS: 12,
    followDist: 120,          // CLOSE to Raphael
    speed: 600,
    staffEvery: 1.1, staffWindupS: 0.28,
    staffReach: 310, staffArc: 3.6,           // a wide sweep: about 206 degrees
    staffDamage: 12, staffKnock: 150,
    // THE STUN CONE: on every hit, all enemies inside this narrow cone go still.
    stun: { coneDeg: 30, range: 600, stunS: 1.3 },
  },
};

/** How long an ally of this key stays when called, at `level` copies of the ability. */
export const durationOf = (key, level) => ALLY[key].activeS + Math.max(0, level - 1) * ALLY[key].upgradeS;

/** One ally, standing next to the player. */
export function makeAlly(key, w) {
  const a = ALLY[key];
  return {
    present: true, phase: 'active', timer: durationOf(key, w.build[key] || 1), duration: durationOf(key, w.build[key] || 1),
    fx: null,                       // {x, y, t}: a pop of light where he arrived or left
    key, x: w.player.x + (key === 'leo' ? -a.followDist : a.followDist), y: w.player.y + 60,
    facing: 0, state: 'follow', t: 0, target: null,
    cool: 0.4, stay: 0, vis: 1,
    walking: false, dashing: false,
    slashT: -1,                     // >= 0 while a swing is playing: 0 -> 1 over its windup + recover
    hitDone: false,
    pulse: null,                    // Donatello's stun cone, for the renderer: {x, y, facing, t}
  };
}

/** Make `w.allies` match the build: a called ally exists, an uncalled one does not. */
export function syncAllies(w) {
  if (!w.allies) w.allies = [];
  for (const key of Object.keys(ALLY)) {
    const have = w.allies.find((a) => a.key === key);
    if (w.build[key] > 0 && !have) w.allies.push(makeAlly(key, w));
    else if (!(w.build[key] > 0) && have) w.allies = w.allies.filter((a) => a !== have);
  }
}

/** Stop a foe in its tracks for `s` seconds and cancel whatever it was winding up. */
export function stunFoe(f, s) {
  if (!f.alive) return;
  f.stunT = Math.max(f.stunT || 0, s);
  if (TELEGRAPH_STATES.has(f.state) || f.state === 'dash') { f.state = 'walk'; f.stateT = 0; }
  f.tell = null;
}

/**
 * Damage a foe. `hooks.onKill(f)` is told AFTER the death is resolved, the same
 * order the player's own blades use (systems/combat.js), so a caller asking
 * "did that kill it?" gets the true answer.
 */
export function hurtFoe(w, f, dmg, hooks) {
  if (!f.alive) return;
  f.hp -= dmg;
  f.hitT = 0.09;
  if (f.hp <= 0) {
    f.alive = false;
    f.deadAtS = w.timeS;
    if (hooks?.onKill) hooks.onKill(f);
  }
  if (hooks?.onHit) hooks.onHit(f);
}

const living = (w) => w.foes.filter((f) => f.alive);

function nearest(list, x, y, within = Infinity) {
  let best = null, bd = within;
  for (const f of list) {
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

/** Walk toward (tx, ty) and stop when there. Returns true while moving. */
function walkTo(a, tx, ty, speed, dt, stopAt = 30) {
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  if (d <= stopAt) return false;
  const step = Math.min(d - stopAt, speed * dt * (d > 500 ? 1.8 : 1));      // catches up when left behind
  a.x += (dx / d) * step; a.y += (dy / d) * step;
  a.facing = Math.atan2(dy, dx);
  return true;
}

const HOME_ANGLE = { leo: -2.2, donnie: 2.2, mikey: Math.PI };      // where each stands about the player's facing

/** The spot an ally likes to stand: off the player's shoulder, away from the foes' side. */
function homeSpot(a, w, dist) {
  const ang = w.player.facing + (HOME_ANGLE[a.key] ?? 2.2);
  return { x: w.player.x + Math.cos(ang) * dist, y: w.player.y + Math.sin(ang) * dist };
}

/** Does a swing of `arc` radians centred on `facing` from (ox,oy) reach `f`? */
function inSweep(ox, oy, facing, arc, reach, f) {
  const dx = f.x - ox, dy = f.y - oy, d = Math.hypot(dx, dy);
  if (d > reach + f.radius) return false;
  if (d < f.radius + 20) return true;
  let da = Math.atan2(dy, dx) - facing;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  return Math.abs(da) <= arc / 2;
}

function shove(f, fromX, fromY, px) {
  const dx = f.x - fromX, dy = f.y - fromY, d = Math.hypot(dx, dy) || 1;
  f.x += (dx / d) * px; f.y += (dy / d) * px;
}

// ---- LEONARDO ----------------------------------------------------------------

/** Dash toward a point at `speed`, in a straight line. True while still going. */
function dashTo(a, tx, ty, speed, dt, stopAt) {
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  a.facing = Math.atan2(dy, dx);
  if (d <= stopAt) return false;
  const step = Math.min(d - stopAt, speed * dt);
  a.x += (dx / d) * step; a.y += (dy / d) * step;
  return d - step > stopAt + 1e-6;
}

function leoStep(a, w, dt, hooks) {
  const C = ALLY.leo;
  a.cool = Math.max(0, a.cool - dt);
  a.t += dt;
  a.walking = false;
  a.dashing = false;
  const foes = living(w);

  if (a.state === 'follow') {
    const h = homeSpot(a, w, C.followDist);
    a.walking = walkTo(a, h.x, h.y, C.speed, dt, 40);
    if (a.cool <= 0) {
      const t = nearest(foes, w.player.x, w.player.y, C.seek);
      if (t) { a.target = t; a.state = 'dash'; a.t = 0; }
    }
  } else if (a.state === 'dash') {
    // straight at the target, arriving at cutting distance; if it dies on the way, take the next
    if (!a.target || !a.target.alive) a.target = nearest(foes, a.x, a.y, C.seek);
    const t = a.target;
    if (!t) { a.state = 'dashHome'; a.t = 0; return; }
    a.dashing = true;
    const going = dashTo(a, t.x, t.y, C.dashSpeed, dt, C.reach * 0.55 + t.radius);
    if (!going) { a.state = 'fight'; a.t = 0; a.stay = 0; a.slashT = -1; a.cool = 0; }     // the first cut is immediate
  } else if (a.state === 'dashHome') {
    a.dashing = true;
    const h = homeSpot(a, w, C.followDist);
    if (!dashTo(a, h.x, h.y, C.dashSpeed, dt, 40)) { a.state = 'follow'; a.cool = C.dashCooldownS; }
  } else if (a.state === 'fight') {
    a.stay += dt;
    // keep the target, or take the nearest foe to HIM when it dies
    if (!a.target || !a.target.alive) a.target = nearest(foes, a.x, a.y, C.reach * 2.2);
    const t = a.target;
    if (!t || a.stay >= C.stayS) {
      // nothing left here (or he has had his fill): dash to the next, or home
      const nxt = nearest(foes.filter((f) => f !== t), w.player.x, w.player.y, C.seek);
      a.target = nxt;
      a.state = nxt ? 'dash' : 'dashHome'; a.t = 0; a.slashT = -1;
      return;
    }
    a.facing = Math.atan2(t.y - a.y, t.x - a.x);
    const d = Math.hypot(t.x - a.x, t.y - a.y);
    if (a.slashT < 0) {
      // close the last few steps on foot, then swing when he can reach
      if (d > C.reach * 0.7 + t.radius) a.walking = walkTo(a, t.x, t.y, C.speed * 1.3, dt, C.reach * 0.6 + t.radius);
      else if (a.cool <= 0) { a.slashT = 0; a.hitDone = false; }
    }
    if (a.slashT >= 0) {
      a.slashT += dt / (C.strikeEvery);
      // the cut lands when the windup ends
      if (!a.hitDone && a.slashT * C.strikeEvery >= C.windupS) {
        a.hitDone = true;
        for (const f of foes) {
          if (!f.alive || !inSweep(a.x, a.y, a.facing, C.arc, C.reach, f)) continue;
          hurtFoe(w, f, C.damage, hooks);
          if (f.alive) shove(f, a.x, a.y, C.knock);
        }
        if (hooks?.onSwing) hooks.onSwing(a);
      }
      if (a.slashT >= 1) { a.slashT = -1; a.cool = 0.02; }
    }
  }
}

// ---- DONATELLO ---------------------------------------------------------------

/** Is `f` inside the narrow cone from (ox, oy) along `facing`? */
export function inCone(ox, oy, facing, coneDeg, range, f) {
  const dx = f.x - ox, dy = f.y - oy, d = Math.hypot(dx, dy);
  if (d > range + f.radius) return false;
  if (d < f.radius + 20) return true;
  let da = Math.atan2(dy, dx) - facing;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  // A body has width: widen the cone by the angle the foe's own radius subtends.
  return Math.abs(da) <= (coneDeg * Math.PI) / 360 + Math.asin(Math.min(1, f.radius / d));
}

function donnieStep(a, w, dt, hooks) {
  const C = ALLY.donnie;
  a.cool = Math.max(0, a.cool - dt);
  const foes = living(w);
  a.walking = false;
  if (a.pulse) { a.pulse.t += dt; if (a.pulse.t > 0.5) a.pulse = null; }

  // the staff: a wide sweep at anything near him
  const near = nearest(foes, a.x, a.y, C.staffReach + 40);
  if (a.slashT < 0) {
    if (near && a.cool <= 0) {
      a.slashT = 0; a.hitDone = false;
      a.facing = Math.atan2(near.y - a.y, near.x - a.x);
    } else {
      const h = homeSpot(a, w, C.followDist);
      a.walking = walkTo(a, h.x, h.y, C.speed, dt, 36);
    }
  }
  if (a.slashT >= 0) {
    a.slashT += dt / C.staffEvery;
    if (!a.hitDone && a.slashT * C.staffEvery >= C.staffWindupS) {
      a.hitDone = true;
      let hit = 0;
      for (const f of foes) {
        if (!f.alive || !inSweep(a.x, a.y, a.facing, C.staffArc, C.staffReach, f)) continue;
        hit++;
        hurtFoe(w, f, C.staffDamage, hooks);
        if (f.alive) shove(f, a.x, a.y, C.staffKnock);
      }
      // THE HIT FIRES THE CONE. Only a staff that actually connected does.
      if (hit > 0) {
        for (const f of living(w)) {
          if (inCone(a.x, a.y, a.facing, C.stun.coneDeg, C.stun.range, f)) stunFoe(f, C.stun.stunS);
        }
        a.pulse = { x: a.x, y: a.y, facing: a.facing, t: 0 };
        if (hooks?.onStun) hooks.onStun(a);
      }
      if (hooks?.onSwing) hooks.onSwing(a);
    }
    if (a.slashT >= 1) { a.slashT = -1; a.cool = 0.1; }
  }
}

const POP_S = 0.4;

// ---- MICHELANGELO ------------------------------------------------------------

/** Where a pizza goes: near the player, inside the arena, not inside a wall. */
function pizzaSpot(w, rng) {
  const P = ALLY.mikey.pizza;
  for (let tries = 0; tries < 12; tries++) {
    const ang = rng() * Math.PI * 2, d = P.near + rng() * (P.far - P.near);
    const x = Math.max(60, Math.min(ARENA.width - 60, w.player.x + Math.cos(ang) * d));
    const y = Math.max(60, Math.min(ARENA.height - 60, w.player.y + Math.sin(ang) * d));
    if (!overlapsAny(x, y, 50, w.obstacles)) return { x, y };
  }
  return { x: w.player.x, y: w.player.y + P.near };
}

function mikeyStep(a, w, dt, hooks) {
  const C = ALLY.mikey;
  a.cool = Math.max(0, a.cool - dt);
  a.walking = false;
  if (a.slashT < 0) {
    const hurt = w.hp < w.maxHp * C.needBelow && !w.dead;
    const out = (w.pizzas || []).length;
    if (a.cool <= 0 && hurt && out < C.maxOut) { a.slashT = 0; a.hitDone = false; }
    else {
      const h = homeSpot(a, w, C.followDist);
      a.walking = walkTo(a, h.x, h.y, C.speed, dt, 40);
    }
  }
  if (a.slashT >= 0) {
    a.facing = Math.atan2(w.player.y - a.y, w.player.x - a.x);       // he looks at you while he cooks
    a.slashT += dt / C.bakeS;
    if (!a.hitDone && a.slashT * C.bakeS >= C.bakeAtS) {
      a.hitDone = true;
      const spot = pizzaSpot(w, hooks?.rng || Math.random);
      const level = Math.max(1, w.build[a.key] || 1);
      (w.pizzas || (w.pizzas = [])).push({
        x: spot.x, y: spot.y, from: { x: a.x, y: a.y }, age: 0, alive: true,
        heal: C.pizza.heal + (level - 1) * C.pizza.healPerLevel, lifeS: C.pizza.lifeS,
      });
      if (hooks?.onBake) hooks.onBake(a);
    }
    if (a.slashT >= 1) { a.slashT = -1; a.cool = C.bakeEvery; }
  }
}

/** Age the pizzas, and heal the player who walks onto one. */
export function updatePizzas(w, dt, hooks) {
  if (!w.pizzas || !w.pizzas.length) return;
  const R = ALLY.mikey.pizza.radius;
  for (const p of w.pizzas) {
    p.age += dt;
    if (p.age >= p.lifeS) { p.alive = false; continue; }
    if (!w.dead && Math.hypot(p.x - w.player.x, p.y - w.player.y) <= R + w.playerRadius * 0.5) {
      if (w.hp < w.maxHp) {
        w.hp = Math.min(w.maxHp, w.hp + Math.round(w.maxHp * p.heal));
        p.alive = false;
        if (hooks?.onPizza) hooks.onPizza(p);
      }
    }
  }
  if (w.pizzas.some((p) => !p.alive)) w.pizzas = w.pizzas.filter((p) => p.alive);
}

/** Step every ally: on the field for `duration`, away for `breakS`, and back. */
export function updateAllies(w, dt, hooks) {
  syncAllies(w);
  for (const a of w.allies) {
    if (a.fx) { a.fx.t += dt; if (a.fx.t >= POP_S) a.fx = null; }
    a.timer -= dt;
    if (a.phase === 'active') {
      if (a.timer <= 0) {
        // time is up: gone, with whatever he was doing
        a.fx = { x: a.x, y: a.y, t: 0 };
        a.phase = 'away'; a.present = false;
        a.timer = ALLY[a.key].breakS; a.duration = a.timer;
        a.state = 'follow'; a.target = null; a.slashT = -1; a.pulse = null; a.walking = false; a.dashing = false;
        continue;
      }
    } else if (a.timer <= 0) {
      // the break is over: back at the player's shoulder, for as long as the ability has been upgraded to
      const h = homeSpot(a, w, ALLY[a.key].followDist);
      a.x = h.x; a.y = h.y; a.cool = 0.3;
      a.fx = { x: a.x, y: a.y, t: 0 };
      a.phase = 'active'; a.present = true;
      a.duration = a.timer = durationOf(a.key, w.build[a.key] || 1);
    }
    if (!a.present) continue;
    (a.key === 'leo' ? leoStep : a.key === 'mikey' ? mikeyStep : donnieStep)(a, w, dt, hooks);
  }
}
