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
import { overlapsAny, resolveCircle } from './obstacles.js';

/** Seconds a foe cannot be stunned again after a stun wears off. */
export const STUN_IMMUNE_S = 0.8;

export const ALLY = {
  mikey: {
    label: 'Michelangelo',
    activeS: 8, upgradeS: 4, breakS: 12, firstS: 12,
    // HE DOES WHAT DONATELLO USED TO (Elad, 23 Nov: "for now have him do exactly what donnie is
    // currently doing"), with nunchucks: a wide sweep at anything near him, and every hit
    // stuns everything in a 30-degree cone.
    followDist: 270, speed: 600,       // keeps well back from Raphael
    // SPINJITZU (Elad, 24 Nov): a short 0.5 s spin, then he WALKS again. The cleave lands mid-spin and is a full
    // circle round him: little damage, a BIG push, and a stun on everything it reaches.
    staffEvery: 1.0, staffWindupS: 0.4, cooldownS: 2.0, cooldownJitterS: 1.0,      // a 1 s spin every 2-3 s
    staffReach: 340, staffArc: Math.PI * 2,
    staffDamage: 5, staffKnock: 340,
    stun: { coneDeg: 30, range: 600, stunS: 1.3 },     // the cone numbers are kept for inCone(); the cleave stuns by its own reach
    // DORMANT: the pizza-baking healer. Off, because healing was not good for the game.
    // `bakes: true` wakes it (the tests do), and the code below is untouched.
    bakes: false,
    bakeEvery: 2.6, bakeS: 0.9, bakeAtS: 0.55, needBelow: 0.95, maxOut: 3,
    pizza: { near: 190, far: 330, lifeS: 9, radius: 95, heal: 0.10, healPerLevel: 0.03 },
  },
  leo: {
    label: 'Leonardo',
    followDist: 170,          // where he stands beside you, px
    speed: 560,               // walking speed to that spot
    seek: 620,                // he goes for foes within this of YOU
    activeS: 6, upgradeS: 2, breakS: 14, firstS: 8,
    dashSpeed: 1800,          // px/s: fast enough to read as a dash, slow enough to see him go
    dashCooldownS: 0.8,
    strikeEvery: 0.65, windupS: 0.16, reach: 190, damage: 12, arc: 2.6,   // arc: total radians swept
    stayS: 3.2,               // how long he fights one place before looking for the next
    knock: 70,
  },
  donnie: {
    label: 'Donatello',
    activeS: 8, upgradeS: 4, breakS: 12, firstS: 4,
    // THE CLOSE GUARD. He never leaves Raphael's side and never chases: he jabs with his stick at
    // whatever comes within reach, while walking, for little damage. His real job is the SHIELD.
    followDist: 95, speed: 640,
    staffEvery: 0.7, staffWindupS: 0.16,
    staffReach: 175, staffArc: 2.2,
    staffDamage: 5, staffKnock: 40,
    // GRAVITY GRENADES: he lobs one at the thickest knot of foes; it lands and pulls them in.
    // Pull strength is divided by each breed's `mass`, so a Slayer is dragged and a golem barely moves.
    grenade: { every: 4.2, range: 760, flightS: 0.55, lifeS: 2.6, lifePerLevel: 0.5, radius: 330, pull: 900 },
  },
};

/** THE SHELL SHIELD: its own ability (core/abilities.js), no turtle needed. It has no hit points: it runs an ON-OFF loop, cutting every hit by a percentage while it is on. */
export const SHIELD = { cut: 0.5, cutPerLevel: 0.12, maxCut: 0.9, activeS: 5, activePerLevel: 1, cooldownS: 8, cooldownPerLevel: 1, minCooldownS: 3 };

/** How long an ally of this key stays when called, at `level` copies of the ability. */
export const durationOf = (key, level) => ALLY[key].activeS + Math.max(0, level - 1) * ALLY[key].upgradeS;

/** One ally, standing next to the player. */
export function makeAlly(key, w) {
  const a = ALLY[key];
  return {
    // A NEW ROOM STARTS WITH THE COOLDOWN, not the turtle: he is called when the break runs out.
    // and each turtle's first call is staggered (firstS), so they do not all land together
    present: false, phase: 'away', timer: a.firstS, duration: a.firstS,
    rise: RISE_S,                   // 0 -> RISE_S while he is being summoned in; he does nothing until it is full
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
  // NO STUN-LOCK: a foe that has just woken is immune for a moment. Mikey sweeps every 1.1s and stuns for
  // 1.3s, so without this a whole crowd stood frozen for as long as he lived and the game looked stuck.
  if ((f.stunImmT || 0) > 0) return;
  f.stunT = Math.max(f.stunT || 0, s);
  // 'recover' too: the swing pose is scrubbed from the state clock, which a stun freezes, so a foe stunned
  // mid-recovery stood frozen in the middle of its swing (the animation bug).
  if (TELEGRAPH_STATES.has(f.state) || f.state === 'dash' || f.state === 'recover') { f.state = 'walk'; f.stateT = 0; }
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
  f.hitT = 0.14;
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

/** A BIG PUSH, spread over 0.18 s (core/foes.js moves it) so a foe is seen to fly, not to teleport. */
function knock(f, fromX, fromY, px) {
  const dx = f.x - fromX, dy = f.y - fromY, d = Math.hypot(dx, dy) || 1;
  f.kb = { vx: (dx / d) * px / 0.18, vy: (dy / d) * px / 0.18, t: 0.18 };
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

/** The wide staff sweep with a stun cone on every hit. Michelangelo does this now (nunchucks). */
function sweepStep(a, w, dt, hooks, C) {
  a.cool = Math.max(0, a.cool - dt);
  const foes = living(w);
  a.walking = false;
  if (a.pulse) { a.pulse.t += dt; if (a.pulse.t > 0.5) a.pulse = null; }
  if (a.cleave) { a.cleave.t += dt; if (a.cleave.t > 0.4) a.cleave = null; }      // the cleave the renderer draws on every swing

  // the staff: a wide sweep at anything near him
  const near = nearest(foes, a.x, a.y, C.staffReach + 40);
  // HE SPINS EVERY NOW AND THEN, whether or not anyone is close, and keeps WALKING while he does (Elad, 24 Nov)
  if (a.slashT < 0 && a.cool <= 0) {
    a.slashT = 0; a.hitDone = false;
    if (near) a.facing = Math.atan2(near.y - a.y, near.x - a.x);
  }
  {
    const h = homeSpot(a, w, C.followDist);
    a.walking = walkTo(a, h.x, h.y, C.speed, dt, 36);
  }
  if (a.slashT >= 0) {
    a.slashT += dt / C.staffEvery;
    if (!a.hitDone && a.slashT * C.staffEvery >= C.staffWindupS) {
      a.hitDone = true;
      a.cleave = { x: a.x, y: a.y, facing: a.facing, t: 0 };
      let hit = 0;
      for (const f of foes) {
        if (!f.alive || !inSweep(a.x, a.y, a.facing, C.staffArc, C.staffReach, f)) continue;
        hit++;
        hurtFoe(w, f, C.staffDamage, hooks);
        if (f.alive) knock(f, a.x, a.y, C.staffKnock);
      }
      // THE CLEAVE STUNS EVERYTHING IT REACHES. Only a swing that actually connected does.
      if (hit > 0) {
        for (const f of living(w)) {
          if (inSweep(a.x, a.y, a.facing, C.staffArc, C.staffReach, f)) stunFoe(f, C.stun.stunS);
        }
        if (hooks?.onStun) hooks.onStun(a);
      }
      if (hooks?.onSwing) hooks.onSwing(a);
    }
    if (a.slashT >= 1) { a.slashT = -1; a.cool = (C.cooldownS ?? 0.1) + (C.cooldownJitterS ? (hooks?.rng || Math.random)() * C.cooldownJitterS : 0); }
  }
}


/**
 * DONATELLO, the close guard. He stays at Raphael's shoulder and never chases anything. The
 * stick is a short, light jab that fires whenever something is within its reach and does NOT
 * stop him walking: attack while moving, in range only. His real job is the shield.
 */
function donnieStep(a, w, dt, hooks) {
  const C = ALLY.donnie;
  a.cool = Math.max(0, a.cool - dt);
  const h = homeSpot(a, w, C.followDist);
  a.walking = walkTo(a, h.x, h.y, C.speed, dt, 30);

  a.grenadeT = (a.grenadeT ?? C.grenade.every * 0.5) - dt;
  if (a.grenadeT <= 0) {
    const t = crowdCentre(w, a.x, a.y, C.grenade.range, C.grenade.radius * 0.8);
    if (t) {
      a.grenadeT = C.grenade.every;
      const lvl = Math.max(1, w.build.donnie || 1);
      (w.grenades || (w.grenades = [])).push({
        x: t.x, y: t.y, from: { x: a.x, y: a.y }, age: 0, flightS: C.grenade.flightS, landed: false, alive: true,
        lifeS: C.grenade.lifeS + (lvl - 1) * C.grenade.lifePerLevel, radius: C.grenade.radius,
      });
      if (hooks?.onThrow) hooks.onThrow(a);
    } else a.grenadeT = 0.5;
  }
  if (a.slashT < 0) {
    const near = nearest(living(w), a.x, a.y, C.staffReach);
    if (near && a.cool <= 0) {
      a.slashT = 0; a.hitDone = false;
      a.aim = Math.atan2(near.y - a.y, near.x - a.x);        // where THIS jab goes; he does not turn to hunt
    }
  }
  if (a.slashT >= 0) {
    a.facing = a.aim;
    a.slashT += dt / C.staffEvery;
    if (!a.hitDone && a.slashT * C.staffEvery >= C.staffWindupS) {
      a.hitDone = true;
      for (const f of living(w)) {
        if (!inSweep(a.x, a.y, a.aim, C.staffArc, C.staffReach, f)) continue;
        hurtFoe(w, f, C.staffDamage, hooks);
        if (f.alive) shove(f, a.x, a.y, C.staffKnock);
      }
      if (hooks?.onSwing) hooks.onSwing(a);
    }
    if (a.slashT >= 1) { a.slashT = -1; a.cool = 0.05; }
  }
}

/** How much of a hit the shield takes off, 0..1, at `level` copies. */
export const shieldCut = (level) => Math.min(SHIELD.maxCut, SHIELD.cut + Math.max(0, level - 1) * SHIELD.cutPerLevel);
/** Seconds the shield stays ON each cycle. */
export const shieldActive = (level) => SHIELD.activeS + Math.max(0, level - 1) * SHIELD.activePerLevel;
/** Seconds it stays OFF between cycles. */
export const shieldCooldown = (level) => Math.max(SHIELD.minCooldownS, SHIELD.cooldownS - Math.max(0, level - 1) * SHIELD.cooldownPerLevel);

/**
 * THE SHIELD is an ability of its own (`shield` in the build), not part of any turtle. It is an
 * ON-OFF LOOP, like the turtles' timers and nothing to do with hits taken:
 *  - ON for shieldActive(level) seconds, during which EVERY hit is cut by shieldCut(level) percent
 *    (core/foes.js hurtPlayer);
 *  - then OFF for shieldCooldown(level) seconds, then on again, forever.
 * More copies: a bigger cut, longer on, shorter off. It starts ON.
 */
export function stepShield(w, dt, hooks) {
  const sh = w.shield || (w.shield = { hp: 0, max: 0, cd: 0, up: false, hitT: 0, t: 0 });
  sh.hitT = Math.max(0, (sh.hitT || 0) - dt);
  if (!(w.build.shield > 0)) { sh.up = false; sh.hp = 0; sh.t = 0; sh.started = false; return sh; }
  const lvl = w.build.shield;
  const on = () => { sh.up = true; sh.hp = sh.max = 1; sh.t = shieldActive(lvl); sh.cd = 0; if (hooks?.onShield) hooks.onShield(null); };
  if (!sh.started) { sh.started = true; on(); return sh; }
  sh.t -= dt;
  if (sh.t > 0) return sh;
  if (sh.up) { sh.up = false; sh.hp = 0; sh.t = sh.cd = shieldCooldown(lvl); if (hooks?.onShieldBreak) hooks.onShieldBreak(); }
  else if (!w.dead) on();
  return sh;
}

// ---- GRAVITY GRENADES (Donatello) ------------------------------------------------

/** The foe whose neighbourhood holds the most other foes, within `range` of (x, y). */
function crowdCentre(w, x, y, range, radius) {
  const foes = living(w).filter((f) => Math.hypot(f.x - x, f.y - y) <= range);
  let best = null, bestN = -1;
  for (const f of foes) {
    let n = 0;
    for (const g of foes) if (Math.hypot(g.x - f.x, g.y - f.y) <= radius) n++;
    if (n > bestN) { bestN = n; best = f; }
  }
  return best;
}

/** Tick every grenade: fly, land, pull. Foes move toward the centre at pull / mass. */
export function updateGrenades(w, dt, hooks) {
  if (!w.grenades || !w.grenades.length) return;
  const C = ALLY.donnie.grenade;
  for (const g of w.grenades) {
    g.age += dt;
    if (!g.landed) {
      if (g.age >= g.flightS) { g.landed = true; g.age = 0; if (hooks?.onGrenade) hooks.onGrenade(g); }
      continue;
    }
    if (g.age >= g.lifeS) { g.alive = false; continue; }
    for (const f of living(w)) {
      const dx = g.x - f.x, dy = g.y - f.y, d = Math.hypot(dx, dy);
      if (d > g.radius || d < 8) continue;
      const k = 1 - d / g.radius * 0.6;                       // stronger near the middle
      const step = Math.min(d, (C.pull * k / (f.mass || 1)) * dt);
      f.x += dx / d * step; f.y += dy / d * step;
      f.x = Math.max(f.radius, Math.min(ARENA.width - f.radius, f.x));
      f.y = Math.max(f.radius, Math.min(ARENA.height - f.radius, f.y));
      if (w.obstacles && w.obstacles.length) resolveCircle(f, f.radius, w.obstacles);
    }
  }
  if (w.grenades.some((g) => !g.alive)) w.grenades = w.grenades.filter((g) => g.alive);
}

const POP_S = 0.4;
/** Seconds he spends rising out of the floor when called, rooted, before he acts. */
export const RISE_S = 0.7;

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

function bakeStep(a, w, dt, hooks) {
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

/** Michelangelo: the staff-sweep job with nunchucks; the healer is dormant behind `bakes`. */
function mikeyStep(a, w, dt, hooks) {
  if (ALLY.mikey.bakes) bakeStep(a, w, dt, hooks); else sweepStep(a, w, dt, hooks, ALLY.mikey);
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
  stepShield(w, dt, hooks);
  updateGrenades(w, dt, hooks);
  for (const a of w.allies) {
    if (a.fx) { a.fx.t += dt; if (a.fx.t >= POP_S) a.fx = null; }
    a.timer -= dt;
    if (a.phase === 'active') {
      if (a.timer <= 0) {
        // time is up: gone, with whatever he was doing
        a.fx = { x: a.x, y: a.y, t: 0 };
        a.phase = 'away'; a.present = false;
        a.timer = ALLY[a.key].breakS; a.duration = a.timer;
        a.state = 'follow'; a.target = null; a.slashT = -1; a.pulse = null; a.cleave = null; a.walking = false; a.dashing = false;
        continue;
      }
    } else if (a.timer <= 0) {
      // the break is over: back at the player's shoulder, for as long as the ability has been upgraded to
      const h = homeSpot(a, w, ALLY[a.key].followDist);
      a.x = h.x; a.y = h.y; a.cool = 0.3; a.rise = 0;
      a.fx = { x: a.x, y: a.y, t: 0 };
      a.phase = 'active'; a.present = true;
      a.duration = a.timer = durationOf(a.key, w.build[a.key] || 1);
    }
    if (!a.present) continue;
    if (a.rise < RISE_S) { a.rise += dt; a.walking = false; continue; }     // still being summoned
    (a.key === 'leo' ? leoStep : a.key === 'mikey' ? mikeyStep : donnieStep)(a, w, dt, hooks);
  }
}
