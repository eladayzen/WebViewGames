// DONNIE'S MACHINES (Elad, 24 Nov): every now and then, in the middle of a fight, one of Donatello's
// crates is teleported into the room. It is CLOSED and has health: hit it (the turtle's weapons already
// aim at it, it is a target like any other) and it breaks open, and a gadget pops out and works on the
// enemies. Each gadget is different; some are one-shot, some run for a while, some are several things.
//
//   STASIS FIELD  one time    every enemy is frozen for a few seconds
//   SHOCK COIL    for a while zaps the nearest few enemies, over and over
//   DART TURRET   for a while shoots the nearest enemy
//   SHELL MINES   three mines that blow up when an enemy walks onto them
//   GRAVITY WELL  for a while drags every enemy toward it
//
// Pure sim. The box is a target (`kind: 'machine'`) in w.targets so the existing gun hits it; this
// module only schedules it, notices when it breaks, and runs the gadgets.
import { hurtFoe } from './allies.js';
import { ARENA } from './world.js';
import { overlapsAny } from './obstacles.js';

export const MACHINE = {
  firstS: 14, everyS: 26, jitterS: 8,     // when the first crate arrives into a fight, and the gap between crates
  hp: 110, radius: 64,
  minFoes: 2,                             // not into an empty room
  popupS: 4.5,
  nearMin: 520, nearMax: 1100,            // how far from the player it lands
};

export const DEVICES = {
  stasis: { label: 'STASIS FIELD', say: 'Everything holds still!', weight: 1.0, freezeS: 3.0, lifeS: 0.9 },
  coil:   { label: 'SHOCK COIL',   say: 'Zap! Zap! Zap!',          weight: 1.2, lifeS: 9, every: 0.9, range: 520, targets: 3, damage: 14 },
  turret: { label: 'DART TURRET',  say: 'It shoots on its own!',   weight: 1.2, lifeS: 10, every: 0.45, range: 1150, damage: 12, dartS: 0.16 },
  mines:  { label: 'SHELL MINES',  say: 'Do not step on them!',    weight: 1.0, count: 3, ring: 190, lifeS: 30, trigger: 80, blast: 230, damage: 46, knock: 260 },
  magnet: { label: 'GRAVITY WELL', say: 'Come to papa!',           weight: 0.9, lifeS: 3.5, radius: 800, pull: 700, hold: 80 },
};

export const ARRIVE_LINES = [
  'Crate incoming! Smash it open!',
  'I built you something. Hit the crate!',
  'Gadget delivery! Break the box!',
];

const living = (w) => w.foes.filter((f) => f.alive);

export function machinesOf(w) {
  return w.mach || (w.mach = { t: MACHINE.firstS, box: null, devices: [], popup: null, fx: [], shots: [], popId: 0, fxId: 0 });
}
function say(m, title, text) { m.popup = { title, text, t: MACHINE.popupS, id: ++m.popId }; }
function zap(w, x0, y0, x1, y1, life = 0.2) {
  const p = w.powers || (w.powers = {});
  (p.arcs || (p.arcs = [])).push({ x0, y0, x1, y1, t: life });
}

function pickDevice(rng) {
  const keys = Object.keys(DEVICES);
  let r = rng() * keys.reduce((a, k) => a + DEVICES[k].weight, 0);
  for (const k of keys) { r -= DEVICES[k].weight; if (r <= 0) return k; }
  return keys[keys.length - 1];
}

function spawnBox(w, m, rng) {
  let x = w.player.x, y = w.player.y;
  for (let i = 0; i < 30; i++) {
    const a = rng() * Math.PI * 2, d = MACHINE.nearMin + rng() * (MACHINE.nearMax - MACHINE.nearMin);
    const cx = Math.max(250, Math.min(ARENA.width - 250, w.player.x + Math.cos(a) * d));
    const cy = Math.max(250, Math.min(ARENA.height - 250, w.player.y + Math.sin(a) * d));
    if (Math.hypot(cx - w.player.x, cy - w.player.y) < MACHINE.nearMin * 0.8) continue;
    if (w.obstacles && overlapsAny(cx, cy, MACHINE.radius + 30, w.obstacles)) continue;
    x = cx; y = cy; break;
  }
  const box = { kind: 'machine', x, y, radius: MACHINE.radius, hp: MACHINE.hp, maxHp: MACHINE.hp, alive: true, hitT: 0, bornAtS: w.timeS };
  m.box = box;
  w.targets.push(box);
  say(m, 'DONNIE', ARRIVE_LINES[Math.floor(rng() * ARRIVE_LINES.length)]);
}

function removeBox(w, m) {
  if (m.box) w.targets = w.targets.filter((t) => t !== m.box);
  m.box = null;
}

function openBox(w, m, rng) {
  const { x, y } = m.box;
  removeBox(w, m);
  const type = pickDevice(rng), D = DEVICES[type];
  m.fx.push({ type: 'break', x, y, t: 0.6, id: ++m.fxId });
  say(m, D.label, D.say);
  if (type === 'mines') {
    for (let i = 0; i < D.count; i++) {
      const a = (i / D.count) * Math.PI * 2 + rng();
      m.devices.push({ type, x: x + Math.cos(a) * D.ring, y: y + Math.sin(a) * D.ring, age: 0, lifeS: D.lifeS, cd: 0 });
    }
  } else {
    m.devices.push({ type, x, y, age: 0, lifeS: D.lifeS, cd: 0.3 });
    if (type === 'stasis') {
      for (const f of living(w)) { f.stunT = Math.max(f.stunT || 0, D.freezeS); f.stunImmT = 0; f.tell = null; }
      m.fx.push({ type: 'stasis', x, y, t: 0.8 });
    }
  }
  m.t = MACHINE.everyS + (rng() - 0.5) * 2 * MACHINE.jitterS;
}

function nearestN(foes, x, y, range, n) {
  return foes.map((f) => [Math.hypot(f.x - x, f.y - y), f]).filter(([d]) => d <= range).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, f]) => f);
}

function stepDevices(w, m, dt, hooks) {
  for (const d of m.devices) {
    d.age += dt;
    const D = DEVICES[d.type];
    const foes = living(w);
    if (d.type === 'coil') {
      d.cd -= dt;
      if (d.cd <= 0) {
        const hit = nearestN(foes, d.x, d.y, D.range, D.targets);
        if (hit.length) { d.cd = D.every; for (const f of hit) { zap(w, d.x, d.y, f.x, f.y, 0.25); hurtFoe(w, f, D.damage, hooks); } } else d.cd = 0.2;
      }
    } else if (d.type === 'turret') {
      d.cd -= dt;
      const [f] = nearestN(foes, d.x, d.y, D.range, 1);
      if (f) d.aim = Math.atan2(f.y - d.y, f.x - d.x);
      if (d.cd <= 0 && f) {
        d.cd = D.every;
        // a visible dart that flies out to where the foe was (the damage lands at once; the dart is the picture of it)
        (m.shots || (m.shots = [])).push({ x0: d.x, y0: d.y, x1: f.x, y1: f.y, t: D.dartS, dur: D.dartS });
        hurtFoe(w, f, D.damage, hooks);
      }
    } else if (d.type === 'magnet') {
      for (const f of foes) {
        const dx = d.x - f.x, dy = d.y - f.y, dist = Math.hypot(dx, dy) || 1;
        if (dist > D.radius || dist <= D.hold) continue;
        const step = Math.min(dist - D.hold, (D.pull * (1 - dist / D.radius * 0.5) / (f.mass || 1)) * dt);
        f.x += dx / dist * step; f.y += dy / dist * step;
      }
    } else if (d.type === 'mines' && !d.done) {
      if (foes.some((f) => Math.hypot(f.x - d.x, f.y - d.y) <= D.trigger + f.radius * 0.5)) {
        d.done = true; d.lifeS = 0;
        m.fx.push({ type: 'boom', x: d.x, y: d.y, t: 0.5, r: D.blast });
        for (const f of foes) {
          const dx = f.x - d.x, dy = f.y - d.y, dist = Math.hypot(dx, dy) || 1;
          if (dist > D.blast + f.radius * 0.5) continue;
          hurtFoe(w, f, D.damage, hooks);
          if (f.alive) { f.x += dx / dist * D.knock; f.y += dy / dist * D.knock; }
        }
        if (hooks?.onBlast) hooks.onBlast(d.x, d.y);
      }
    }
  }
  if (m.devices.some((d) => d.age >= d.lifeS)) m.devices = m.devices.filter((d) => d.age < d.lifeS);
}

/**
 * Step the machines. `fight` is true only while the room is being fought: outside it the crate and every
 * gadget are cleared away (a room's crate does not follow you to the next one).
 */
export function updateMachines(w, dt, fight, hooks, rng = Math.random) {
  const m = machinesOf(w);
  m.fx = m.fx.filter((f) => (f.t -= dt) > 0);
  if (m.shots) m.shots = m.shots.filter((s) => (s.t -= dt) > 0);
  if (m.popup) { m.popup.t -= dt; if (m.popup.t <= 0) m.popup = null; }
  if (!fight) {
    if (m.box) removeBox(w, m);
    m.devices = []; m.popup = null;
    m.t = Math.max(m.t, MACHINE.firstS * 0.7);
    return m;
  }
  if (m.box) {
    if (m.box.hitT > 0) m.box.hitT = Math.max(0, m.box.hitT - dt);
    if (!m.box.alive || m.box.hp <= 0) openBox(w, m, rng);
  } else {
    m.t -= dt;
    if (m.t <= 0 && !w.dead) {
      if (living(w).length >= MACHINE.minFoes) spawnBox(w, m, rng); else m.t = 1;
    }
  }
  stepDevices(w, m, dt, hooks);
  return m;
}
