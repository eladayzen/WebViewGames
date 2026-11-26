// POWERS THAT CHANGE HOW YOU PLAY (Elad, 24 Nov): not a stat, a different way of fighting.
//
//   ORBIT  (Spinning Blades)  a ring of blades circles the turtle for a while, cutting anything that
//          touches it, then goes away for a cooldown. You fight by WALKING INTO THINGS.
//   BURST  (Shell Shock)      a charge builds around you (a ring fills on the floor), and when it is
//          full the burst is ARMED. It goes off as soon as enough enemies stand inside the ring, or
//          after a short fuse. You time it by leading the crowd in, and by not waiting for the fuse.
//
// Pure: a function of the world and a clock. No DOM, no three.js. Both are temporary abilities, so
// they last the level, and both only act in a fight (the caller does not step them while frozen).
import { hurtFoe } from './allies.js';
import { ARENA } from './world.js';
import { overlapsAny } from './obstacles.js';

export const ORBIT = {
  baseCount: 1,            // blades = baseCount + level, capped
  maxCount: 5,
  radius: 210,             // px from the player
  bladeR: 52,              // a blade's own hit radius
  spinRadS: 4.2,
  damage: 10, damagePerLevel: 3,
  hitEvery: 0.4,           // one foe is cut at most this often by the ring
  knock: 50,
  activeS: 5, activePerLevel: 1,
  cooldownS: 6, cooldownPerLevel: 0.8, minCooldownS: 2.5,
};

export const BURST = {
  chargeS: 5, chargePerLevel: 0.6, minChargeS: 2.2,
  radius: 330, radiusPerLevel: 30,
  damage: 36, damagePerLevel: 10,
  knock: 340,
  fuseS: 2.0,              // armed this long and it goes off even with nobody near
  triggerFoes: 2,          // ...or as soon as this many are inside the ring
};

export const orbitCount = (lvl) => Math.min(ORBIT.maxCount, ORBIT.baseCount + lvl);
export const orbitActiveS = (lvl) => ORBIT.activeS + (lvl - 1) * ORBIT.activePerLevel;
export const orbitCooldownS = (lvl) => Math.max(ORBIT.minCooldownS, ORBIT.cooldownS - (lvl - 1) * ORBIT.cooldownPerLevel);
export const burstChargeS = (lvl) => Math.max(BURST.minChargeS, BURST.chargeS - (lvl - 1) * BURST.chargePerLevel);
export const burstRadius = (lvl) => BURST.radius + (lvl - 1) * BURST.radiusPerLevel;

/** Where the blades are right now: [{x, y}] in sim px. Empty when the ring is down. */
export function orbitBlades(w) {
  const o = w.powers?.orbit;
  if (!o || !o.up) return [];
  const n = orbitCount(w.build.orbit || 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = o.ang + (i / n) * Math.PI * 2;
    out.push({ x: w.player.x + Math.cos(a) * ORBIT.radius, y: w.player.y + Math.sin(a) * ORBIT.radius });
  }
  return out;
}

function stepOrbit(w, dt, hooks) {
  const o = w.powers.orbit;
  const lvl = w.build.orbit || 0;
  if (lvl <= 0) { o.up = false; o.started = false; return; }
  if (!o.started) { o.started = true; o.up = true; o.t = orbitActiveS(lvl); o.dur = o.t; }
  o.t -= dt;
  if (o.up) {
    o.ang += ORBIT.spinRadS * dt;
    const blades = orbitBlades(w);
    const dmg = ORBIT.damage + (lvl - 1) * ORBIT.damagePerLevel;
    for (const f of w.foes) {
      if (!f.alive) continue;
      if (f.orbitT > 0) { f.orbitT = Math.max(0, f.orbitT - dt); continue; }
      for (const b of blades) {
        if (Math.hypot(f.x - b.x, f.y - b.y) <= ORBIT.bladeR + f.radius * 0.8) {
          f.orbitT = ORBIT.hitEvery;
          hurtFoe(w, f, dmg, hooks);
          if (f.alive) { const dx = f.x - w.player.x, dy = f.y - w.player.y, d = Math.hypot(dx, dy) || 1; f.x += dx / d * ORBIT.knock; f.y += dy / d * ORBIT.knock; }
          break;
        }
      }
    }
    if (o.t <= 0) { o.up = false; o.t = o.cd = orbitCooldownS(lvl); o.dur = o.t; }
  } else if (o.t <= 0 && !w.dead) { o.up = true; o.t = orbitActiveS(lvl); o.dur = o.t; }
}

function stepBurst(w, dt, hooks) {
  const b = w.powers.burst;
  const lvl = w.build.burst || 0;
  b.flashT = Math.max(0, b.flashT - dt);
  if (lvl <= 0) { b.charge = 0; b.armed = false; b.armT = 0; return; }
  const R = burstRadius(lvl);
  if (!b.armed) {
    b.charge = Math.min(1, b.charge + dt / burstChargeS(lvl));
    if (b.charge >= 1) { b.armed = true; b.armT = 0; }
    return;
  }
  b.armT += dt;
  let inside = 0;
  for (const f of w.foes) if (f.alive && Math.hypot(f.x - w.player.x, f.y - w.player.y) <= R) inside++;
  if (inside >= BURST.triggerFoes || (b.armT >= BURST.fuseS && inside > 0) || b.armT >= BURST.fuseS * 2.5) {
    const dmg = BURST.damage + (lvl - 1) * BURST.damagePerLevel;
    for (const f of w.foes) {
      if (!f.alive) continue;
      const dx = f.x - w.player.x, dy = f.y - w.player.y, d = Math.hypot(dx, dy) || 1;
      if (d > R + f.radius * 0.5) continue;
      hurtFoe(w, f, dmg, hooks);
      if (f.alive) { const k = BURST.knock / Math.max(1, (f.mass || 1) ** 0.5); f.x += dx / d * k; f.y += dy / d * k; }
    }
    b.charge = 0; b.armed = false; b.armT = 0; b.flashT = 0.45; b.firedR = R;
    if (hooks?.onBurst) hooks.onBurst(w.player.x, w.player.y, R);
  }
}

// ======================= THE OTHER EIGHT (Elad, 24 Nov: "try all of them") =======================
export const DASH = { cooldownS: 5.5, perLevel: 0.7, minS: 2.5, range: 380, rangePerLevel: 30, width: 70, damage: 22, damagePerLevel: 8, trigger: 520 };
export const CALTROP = { every: 150, maxBase: 8, maxPerLevel: 2, lifeS: 4, lifePerLevel: 1, radius: 60, damage: 9, damagePerLevel: 3, hitEvery: 0.6 };
export const BOOM = { everyS: 3.2, perLevel: 0.3, minS: 1.6, out: 520, speed: 900, hitR: 62, damage: 14, damagePerLevel: 4, hitEvery: 0.5, maxCount: 3 };
export const DECOY = { cooldownS: 12, perLevel: 1, minS: 6, lifeS: 11, lifePerLevel: 2, speed: 430, standOff: 150, retargetS: 0.5, knotR: 260, hp: 60, hpPerLevel: 30, radius: 45, near: 900 };
export const ARC = { baseJumps: 1, maxJumps: 4, range: 280, frac: 0.4, fracPerLevel: 0.15, lifeS: 0.2 };
export const VORTEX = { activeS: 2, activePerLevel: 0.4, cooldownS: 9, perLevel: 1, minS: 5, radius: 700, pull: 650, hold: 120 };
export const FROST = { cooldownS: 8, perLevel: 0.8, minS: 4, radius: 420, radiusPerLevel: 30, slowS: 2.5, slowPerLevel: 0.5, slowMul: 0.4 };
export const RUSH = { maxStacks: 5, holdS: 3.5, holdPerLevel: 0.5, perStack: 0.10, perStackPerLevel: 0.04 };

const lv = (w, k) => w.build[k] || 0;
const living = (w) => w.foes.filter((f) => f.alive);
function nearestFoe(w, x, y, max = Infinity) {
  let best = null, bd = max;
  for (const f of w.foes) { if (!f.alive) continue; const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } }
  return best;
}
function ensure(w) {
  const p = w.powers || (w.powers = {});
  p.orbit ||= { up: false, t: 0, ang: 0 };
  p.burst ||= { charge: 0, armed: false, armT: 0, flashT: 0 };
  p.dash ||= { cd: 1, trail: null };
  p.caltrops ||= []; p.caltrop ||= { lx: null, ly: null };
  p.boom ||= []; p.boomCd ??= 1;
  p.arcs ||= [];
  p.vortex ||= { up: false, t: 0 };
  p.frost ||= { cd: 2, ringT: 0 };
  p.rush ||= { n: 0, t: 0 };
  p.decoyCd ??= 3;
  return p;
}

/** DASH STRIKE: a blink toward the nearest foe that cuts everything on the way. */
function stepDash(w, dt, hooks) {
  const d = ensure(w).dash, L = lv(w, 'dash');
  if (d.trail) { d.trail.t -= dt; if (d.trail.t <= 0) d.trail = null; }
  if (L <= 0) return;
  d.cd -= dt;
  if (d.cd > 0 || w.dead) return;
  const f = nearestFoe(w, w.player.x, w.player.y, DASH.trigger);
  if (!f) return;
  const range = DASH.range + (L - 1) * DASH.rangePerLevel;
  const dx = f.x - w.player.x, dy = f.y - w.player.y, dist = Math.hypot(dx, dy) || 1;
  const len = Math.min(range, dist + 90), ux = dx / dist, uy = dy / dist;
  const x0 = w.player.x, y0 = w.player.y;
  let x = x0, y = y0;
  for (let s = 20; s <= len; s += 20) {
    const nx = Math.max(60, Math.min(ARENA.width - 60, x0 + ux * s)), ny = Math.max(60, Math.min(ARENA.height - 60, y0 + uy * s));
    if (w.obstacles && overlapsAny(nx, ny, w.playerRadius || 40, w.obstacles)) break;
    x = nx; y = ny;
  }
  w.player.x = x; w.player.y = y;
  const dmg = DASH.damage + (L - 1) * DASH.damagePerLevel;
  const sx = x - x0, sy = y - y0, sl = Math.hypot(sx, sy) || 1;
  for (const g of w.foes) {
    if (!g.alive) continue;
    const t = Math.max(0, Math.min(1, ((g.x - x0) * sx + (g.y - y0) * sy) / (sl * sl)));
    if (Math.hypot(g.x - (x0 + sx * t), g.y - (y0 + sy * t)) <= DASH.width + g.radius * 0.6) hurtFoe(w, g, dmg, hooks);
  }
  d.trail = { x0, y0, x1: x, y1: y, t: 0.3 };
  d.cd = Math.max(DASH.minS, DASH.cooldownS - (L - 1) * DASH.perLevel);
  if (hooks?.onDash) hooks.onDash(x0, y0, x, y);
}

/** CALTROPS: spikes dropped behind you as you move. Running in circles becomes an attack. */
function stepCaltrops(w, dt, hooks) {
  const p = ensure(w), L = lv(w, 'caltrop'), c = p.caltrop;
  for (const t of p.caltrops) t.age += dt;
  if (p.caltrops.some((t) => t.age >= t.lifeS)) p.caltrops = p.caltrops.filter((t) => t.age < t.lifeS);
  if (L <= 0) { c.lx = null; return; }
  if (c.lx === null) { c.lx = w.player.x; c.ly = w.player.y; }
  if (Math.hypot(w.player.x - c.lx, w.player.y - c.ly) >= CALTROP.every) {
    c.lx = w.player.x; c.ly = w.player.y;
    p.caltrops.push({ x: w.player.x, y: w.player.y, age: 0, lifeS: CALTROP.lifeS + (L - 1) * CALTROP.lifePerLevel });
    const max = CALTROP.maxBase + L * CALTROP.maxPerLevel;
    if (p.caltrops.length > max) p.caltrops.shift();
  }
  const dmg = CALTROP.damage + (L - 1) * CALTROP.damagePerLevel;
  for (const f of w.foes) {
    if (!f.alive) continue;
    if (f.caltropT > 0) { f.caltropT = Math.max(0, f.caltropT - dt); continue; }
    for (const t of p.caltrops) if (Math.hypot(f.x - t.x, f.y - t.y) <= CALTROP.radius + f.radius * 0.6) { f.caltropT = CALTROP.hitEvery; hurtFoe(w, f, dmg, hooks); break; }
  }
}

/** BOOMERANG SHELL: a spinning shell goes out toward the nearest foe and comes back, cutting both ways. */
function stepBoom(w, dt, hooks) {
  const p = ensure(w), L = lv(w, 'shellboom');
  for (const b of p.boom) {
    if (b.phase === 'out') {
      b.x += b.ux * BOOM.speed * dt; b.y += b.uy * BOOM.speed * dt; b.dist += BOOM.speed * dt;
      if (b.dist >= BOOM.out) b.phase = 'back';
    } else {
      const dx = w.player.x - b.x, dy = w.player.y - b.y, d = Math.hypot(dx, dy) || 1;
      if (d < 60) { b.dead = true; continue; }
      b.x += dx / d * BOOM.speed * dt; b.y += dy / d * BOOM.speed * dt;
    }
    const dmg = BOOM.damage + (L - 1) * BOOM.damagePerLevel;
    for (const f of w.foes) {
      if (!f.alive) continue;
      if (f.boomT > 0) { f.boomT = Math.max(0, f.boomT - dt); continue; }
      if (Math.hypot(f.x - b.x, f.y - b.y) <= BOOM.hitR + f.radius * 0.7) { f.boomT = BOOM.hitEvery; hurtFoe(w, f, dmg, hooks); }
    }
  }
  if (p.boom.some((b) => b.dead)) p.boom = p.boom.filter((b) => !b.dead);
  if (L <= 0 || w.dead) return;
  p.boomCd -= dt;
  if (p.boomCd > 0) return;
  const f = nearestFoe(w, w.player.x, w.player.y, 700);
  if (!f) return;
  const n = Math.min(BOOM.maxCount, L), base = Math.atan2(f.y - w.player.y, f.x - w.player.x);
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.5;
    p.boom.push({ x: w.player.x, y: w.player.y, ux: Math.cos(a), uy: Math.sin(a), dist: 0, phase: 'out' });
  }
  p.boomCd = Math.max(BOOM.minS, BOOM.everyS - (L - 1) * BOOM.perLevel);
  if (hooks?.onThrow) hooks.onThrow(null);
}

/** The foe with the most other foes round it: where the shadow should go to be worth chasing. */
function thickestKnot(w, x, y) {
  const live = living(w); let best = null, bn = -1;
  for (const f of live) {
    let n = 0;
    for (const g of live) if (Math.hypot(g.x - f.x, g.y - f.y) < DECOY.knotR) n++;
    const d = Math.hypot(f.x - x, f.y - y);
    const score = n - d / 900;                 // a bigger knot wins, a nearer one breaks ties
    if (score > bn) { bn = score; best = f; }
  }
  return best;
}

/**
 * SHADOW (was "pizza decoy"): a copy of Raphael that foes chase and hit instead of you, until it breaks or its time
 * is up. It lasts long (Elad, 25 Nov) and WALKS ITSELF to the thickest knot of foes, stopping a little short of it.
 */
function stepDecoy(w, dt) {
  const p = ensure(w), L = lv(w, 'decoy');
  if (w.decoy) {
    const d = w.decoy;
    d.age += dt; d.retargetT = (d.retargetT ?? 0) - dt;
    if (d.retargetT <= 0) { d.retargetT = DECOY.retargetS; d.goal = thickestKnot(w, d.x, d.y); }
    if (d.goal && d.goal.alive) {
      const dx = d.goal.x - d.x, dy = d.goal.y - d.y, dist = Math.hypot(dx, dy) || 1;
      d.face = Math.atan2(dy, dx);
      if (dist > DECOY.standOff) { const st = Math.min(DECOY.speed * dt, dist - DECOY.standOff); d.x += (dx / dist) * st; d.y += (dy / dist) * st; d.moving = true; }
      else d.moving = false;
    } else d.moving = false;
  }
  if (w.decoy) { if (w.decoy.age >= w.decoy.lifeS || w.decoy.hp <= 0) { w.decoy.alive = false; w.decoy = null; } }
  if (L <= 0 || w.dead) { if (L <= 0 && w.decoy) w.decoy = null; return; }
  p.decoyCd -= dt;
  if (p.decoyCd > 0 || w.decoy || !nearestFoe(w, w.player.x, w.player.y, DECOY.near)) return;
  w.decoy = { x: w.player.x, y: w.player.y, radius: DECOY.radius, age: 0, alive: true, hp: DECOY.hp + (L - 1) * DECOY.hpPerLevel, maxHp: DECOY.hp + (L - 1) * DECOY.hpPerLevel, lifeS: DECOY.lifeS + (L - 1) * DECOY.lifePerLevel, hitT: 0 };
  p.decoyCd = Math.max(DECOY.minS, DECOY.cooldownS - (L - 1) * DECOY.perLevel);
}
/** A foe's hit that lands on the decoy instead of the player. */
export function hitDecoy(w, n) { if (w.decoy) { w.decoy.hp -= n; w.decoy.hitT = 0.12; } }

/**
 * LIGHTNING CHAIN: when a dagger hits `from`, an arc jumps on to the nearest others (a fraction of the
 * dagger's damage). Arcs never start arcs, so it cannot run away.
 */
export function chainArc(w, from, baseDamage, hooks) {
  const L = lv(w, 'arc');
  if (L <= 0 || !from) return;
  const p = ensure(w);
  const jumps = Math.min(ARC.maxJumps, ARC.baseJumps + L);
  const dmg = baseDamage * (ARC.frac + (L - 1) * ARC.fracPerLevel);
  const hit = new Set([from]);
  let cur = from;
  for (let j = 0; j < jumps; j++) {
    let best = null, bd = ARC.range;
    for (const f of w.foes) { if (!f.alive || hit.has(f)) continue; const d = Math.hypot(f.x - cur.x, f.y - cur.y); if (d < bd) { bd = d; best = f; } }
    if (!best) break;
    p.arcs.push({ x0: cur.x, y0: cur.y, x1: best.x, y1: best.y, t: ARC.lifeS });
    hurtFoe(w, best, dmg, hooks);
    hit.add(best); cur = best;
  }
}
function stepArcs(w, dt) { const p = ensure(w); for (const a of p.arcs) a.t -= dt; if (p.arcs.some((a) => a.t <= 0)) p.arcs = p.arcs.filter((a) => a.t > 0); }

/** VORTEX: for a few seconds the crowd is dragged in around you (heavier foes resist). Sets up a Shell Shock. */
function stepVortex(w, dt) {
  const v = ensure(w).vortex, L = lv(w, 'vortex');
  if (L <= 0) { v.up = false; v.started = false; return; }
  if (!v.started) { v.started = true; v.up = false; v.t = 3; }
  v.t -= dt;
  if (v.up) {
    for (const f of w.foes) {
      if (!f.alive) continue;
      const dx = w.player.x - f.x, dy = w.player.y - f.y, d = Math.hypot(dx, dy) || 1;
      if (d > VORTEX.radius || d <= VORTEX.hold) continue;
      const step = Math.min(d - VORTEX.hold, (VORTEX.pull * (1 - d / VORTEX.radius * 0.5) / (f.mass || 1)) * dt);
      f.x += dx / d * step; f.y += dy / d * step;
    }
    if (v.t <= 0) { v.up = false; v.t = Math.max(VORTEX.minS, VORTEX.cooldownS - (L - 1) * VORTEX.perLevel); }
  } else if (v.t <= 0 && !w.dead && nearestFoe(w, w.player.x, w.player.y, VORTEX.radius)) { v.up = true; v.t = VORTEX.activeS + (L - 1) * VORTEX.activePerLevel; }
}

/** FREEZE NOVA: a ring of cold goes out from you and slows every foe it crosses. */
function stepFrost(w, dt, hooks) {
  const f = ensure(w).frost, L = lv(w, 'frost');
  f.ringT = Math.max(0, f.ringT - dt);
  for (const g of w.foes) if (g.slowT > 0) g.slowT = Math.max(0, g.slowT - dt);
  if (L <= 0 || w.dead) return;
  f.cd -= dt;
  if (f.cd > 0) return;
  const R = FROST.radius + (L - 1) * FROST.radiusPerLevel;
  let any = false;
  for (const g of w.foes) if (g.alive && Math.hypot(g.x - w.player.x, g.y - w.player.y) <= R + g.radius * 0.5) { g.slowT = FROST.slowS + (L - 1) * FROST.slowPerLevel; any = true; }
  if (!any) { f.cd = 0.5; return; }
  f.ringT = 0.5; f.R = R;
  f.cd = Math.max(FROST.minS, FROST.cooldownS - (L - 1) * FROST.perLevel);
  if (hooks?.onFrost) hooks.onFrost(w.player.x, w.player.y, R);
}

/** ADRENALINE: every kill stacks a faster throw for a few seconds. */
export function noteKill(w) {
  const L = lv(w, 'rush');
  if (L <= 0) return;
  const r = ensure(w).rush;
  r.n = Math.min(RUSH.maxStacks, r.n + 1);
  r.t = RUSH.holdS + (L - 1) * RUSH.holdPerLevel;
}
function stepRush(w, dt) { const r = ensure(w).rush; if (r.n > 0) { r.t -= dt; if (r.t <= 0) r.n = 0; } if (lv(w, 'rush') <= 0) r.n = 0; }
/** The fire-rate multiplier from adrenaline (1 when none). */
export function rushMul(w) {
  const L = lv(w, 'rush');
  return L > 0 && w.powers?.rush ? 1 + w.powers.rush.n * (RUSH.perStack + (L - 1) * RUSH.perStackPerLevel) : 1;
}

export function updatePowers(w, dt, hooks) {
  const p = ensure(w);
  stepOrbit(w, dt, hooks);
  stepBurst(w, dt, hooks);
  stepDash(w, dt, hooks);
  stepCaltrops(w, dt, hooks);
  stepBoom(w, dt, hooks);
  stepDecoy(w, dt);
  stepArcs(w, dt);
  stepVortex(w, dt);
  stepFrost(w, dt, hooks);
  stepRush(w, dt);
  return p;
}


/**
 * COOLDOWNS FOR THE HUD (Elad, 25 Nov: "show the cool down ... to explain and show fire rate"). For each temporary ability that works
 * on a timer: `cover` is the share of the wait still to go (1 = just used, 0 = ready), `on` is true while it is running or armed, and
 * `label` is a few words of rate (ninja stars: seconds between throws). `st` is the current stats(build).
 */
export function cooldownsOf(w, st) {
  const out = {};
  const p = w.powers || {};
  const c01 = (x) => Math.max(0, Math.min(1, x));
  const lvl = (k) => w.build[k] || 0;
  if (st?.stars && lvl('stars') > 0) out.stars = { cover: c01((w.starT ?? 0) / st.stars.intervalS), on: false, label: `${st.stars.intervalS.toFixed(1)}s` };
  if (lvl('orbit') > 0 && p.orbit) {
    const o = p.orbit;
    out.orbit = o.up ? { cover: c01(1 - o.t / (o.dur || 1)), on: true } : { cover: c01(o.t / (o.dur || 1)), on: false };
  }
  if (lvl('burst') > 0 && p.burst) out.burst = { cover: p.burst.armed ? 0 : c01(1 - p.burst.charge), on: !!p.burst.armed };
  if (lvl('frost') > 0 && p.frost) out.frost = { cover: c01(p.frost.cd / Math.max(FROST.minS, FROST.cooldownS - (lvl('frost') - 1) * FROST.perLevel)), on: (p.frost.ringT || 0) > 0 };
  if (lvl('vortex') > 0 && p.vortex) out.vortex = p.vortex.up ? { cover: 0, on: true } : { cover: c01(p.vortex.t / Math.max(VORTEX.minS, VORTEX.cooldownS - (lvl('vortex') - 1) * VORTEX.perLevel)), on: false };
  if (lvl('decoy') > 0) out.decoy = w.decoy ? { cover: 0, on: true } : { cover: c01((p.decoyCd ?? 0) / Math.max(DECOY.minS, DECOY.cooldownS - (lvl('decoy') - 1) * DECOY.perLevel)), on: false };
  return out;
}
