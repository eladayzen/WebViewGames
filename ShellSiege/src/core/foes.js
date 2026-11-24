// THE FOOT CLAN -- the smallest enemy that can answer a board question.
//
// WHAT THIS IS FOR. One thing: can a player standing on a balance board read a
// threat walking at them, turn to face it, and deal with it before it lands a
// hit? Nothing here exists for any other reason. There is no horde pacing, no
// wave structure, no elite, no ranged attacker, no loot and no score, because
// none of those change that answer and every one of them costs a day.
//
// THEY ARE TARGETS THAT WALK AND HIT BACK. A foe goes into the SAME
// `w.targets` array the crates live in, which is not a shortcut -- it is the
// reason this is small. `nearestTarget`, `updateFiring` and `updateBullets`
// already take anything in that array with a position, a radius and hp, so
// aiming, the sai's bounce-and-return, pierce and the hit flash all work on
// foes without one line of combat code changing. `w.foes` holds references to
// the SAME objects, not copies, so the two views can never disagree.
//
// THE ATTACK IS THE THROW, INSIDE OUT. The player's throw is a windup, a
// release frame on which the damage is committed, and a recovery. A melee
// swing is the same three beats with the projectile removed, so that is what
// this is -- and it is why the windup is a real, visible chunk of time rather
// than an instant hit on contact. An enemy that damages you the moment it
// touches you cannot be read, cannot be dodged, and tells you nothing about
// whether the BOARD is responsive enough to dodge with. The telegraph IS the
// experiment.
//
//   ?fhp=20      hit points                      ?fspd=170    walk, px/s
//   ?freach=120  centre-to-centre strike range   ?fdmg=10     damage per hit
//   ?fwind=0.4   telegraph, seconds              ?frec=0.55   recovery
//   ?php=100     the player's health
import { ARENA, KNOCK_S } from './world.js';
import { BREEDS, DEFAULT_BREED } from './breeds.js';
import { resolveCircle, overlapsAny, blocksShot } from './obstacles.js';
import { BEHAVIORS, meleeStep, tellOf } from './behaviors.js';
import { shieldCut } from './allies.js';
import { hitDecoy } from './powers.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

export const FOE = {
  radius: num('frad', 44),
  // 35, AND THE NUMBER IS THE WHOLE EXPERIMENT. It has been wrong twice in
  // both directions, which is the useful part.
  //
  // At 20 hp NONE OF THEM EVER ARRIVED: a foe crosses from the gun's 620 px
  // range to its own 120 px reach in 2.9 seconds, about five throws at 10
  // damage, so the melee swing -- the thing this build exists to put on a
  // board -- never fired once in nineteen seconds.
  //
  // At 60 hp the opposite: they arrived reliably and then NOTHING EVER DIED.
  // Six hits each, one weapon, one target at a time, ten of them converging:
  // twenty-five seconds of play produced zero kills, which also meant the
  // level-up screen could never open.
  //
  // 35 is three and a half hits. A single foe with the player's full
  // attention dies just before it reaches him; once several are converging
  // the fire splits and some get through. That is the pressure the board is
  // being asked about, and it is also the only setting where both halves of
  // the loop -- killing and being hit -- actually happen.
  hp: num('fhp', 35),
  // A THIRD OF THE PLAYER'S 520 px/s. Faster than this and the board cannot
  // win a retreat, which turns every encounter into a trade and hides the
  // thing being measured; slower and nothing is ever at stake.
  speed: num('fspd', 170),
  // Centre to centre. The two radii already account for 86 px of it, so this
  // is about 34 px of arm.
  reach: num('freach', 120),
  // The strike keeps a little slack past `reach`, or a player drifting one
  // pixel out mid-swing makes the whole animation a no-op and the hit reads
  // as broken rather than as dodged.
  strikeSlack: num('fslack', 40),
  windupS: num('fwind', 0.4),
  recoverS: num('frec', 0.55),
  damage: num('fdmg', 10),
  // Just past the corner of a 20-unit view (2000 px across), so they walk in
  // from off screen instead of appearing in front of you.
  spawnDist: num('fsdist', 1400),
  // A GRACE WINDOW, NOT A DEATH ANIMATION. The body disappears on the frame
  // it dies and bursts into debris; this is only how long the dead entry
  // lingers in the arrays before they are compacted, which keeps a bullet
  // that is mid-iteration from losing the object under it.
  corpseS: num('fcorpse', 0.25),
};

export const PLAYER_HP = num('php', 100);

/**
 * A foe at a point, ready to go into `w.targets`.
 *
 * EVERY TUNABLE IS COPIED ONTO THE FOE, not read from FOE at use time. Five
 * breeds walk at different speeds and swing at different ranges, so the sim
 * has to ask the individual rather than the module -- and copying at birth
 * means a `?fspd=` override still works as the default for breeds that do
 * not state their own.
 */
/**
 * LATER LEVELS MAKE EACH ENEMY A LITTLE TOUGHER, not only more numerous. It lives
 * here rather than in core/rooms.js because a Fort Golem's summoned Slayers must
 * be scaled too, and rooms.js imports this file, not the other way round.
 */
export const LEVEL_SCALE = { hpPerLevel: 0.17, dmgPerLevel: 0.13 };

/** { hp, dmg } multipliers for level `level`. Level 1 is exactly 1. */
export function levelMul(level) {
  return {
    // COMPOUNDING, not linear: the player's build tops out (every ability is capped), so
    // the enemies must keep growing past that point or a finished build never loses again.
    hp: Math.pow(1 + LEVEL_SCALE.hpPerLevel, level - 1),
    dmg: Math.pow(1 + LEVEL_SCALE.dmgPerLevel, level - 1),
  };
}

/** Toughen a freshly made foe for its level, including the damage of its special attack. */
export function applyLevel(f, level) {
  const m = levelMul(level);
  f.level = level;
  f.hp = f.maxHp = Math.max(1, Math.round(f.hp * m.hp));
  f.damage = Math.round(f.damage * m.dmg);
  if (f.job) {
    for (const k of ['shotDamage', 'hitDamage', 'damage']) {
      if (typeof f.job[k] === 'number') f.job[k] = Math.round(f.job[k] * m.dmg);
    }
  }
  return f;
}

let nextFoeId = 0;

export function makeFoe(x, y, timeS = 0, breedKey = DEFAULT_BREED) {
  const b = BREEDS[breedKey] || BREEDS[DEFAULT_BREED];
  const id = nextFoeId++;
  return {
    kind: 'foe',
    breed: breedKey,
    id,
    // WHICH WAY ROUND A PILLAR. A chaser lined up dead behind one is pushed back
    // exactly as hard as it walks forward and stands still; each foe is given a
    // fixed side to slide toward (core/obstacles.js), alternating so a crowd
    // splits round an obstacle instead of queueing on one side of it.
    side: id % 2 ? 1 : -1,
    x, y,
    radius: b.radius ?? FOE.radius,
    speed: b.speed ?? FOE.speed,
    reach: b.reach ?? FOE.reach,
    damage: b.damage ?? FOE.damage,
    push: b.push ?? 0,
    windupS: b.windupS ?? FOE.windupS,
    recoverS: b.recoverS ?? FOE.recoverS,
    cost: b.cost ?? 1,
    mass: b.mass ?? 1,               // how hard gravity grenades pull it (core/allies.js)
    hp: b.hp ?? FOE.hp,
    maxHp: b.hp ?? FOE.hp,
    hitT: 0,
    alive: true,
    deadAtS: -Infinity,
    bornAtS: timeS,
    // WHAT THIS ONE DOES (core/behaviors.js). `job` is a COPY, because level
    // scaling raises its damage numbers and the breed table must not change.
    behavior: b.behavior || 'melee',
    job: b.job ? { ...b.job } : null,
    level: 1,
    // Per-behaviour scratch (cooldowns, a locked charge line); created on first use.
    b: null,
    // What the renderer should draw as the WARNING while the foe is telegraphing
    // (a ground ring, a charge line, a charging orb); null the rest of the time.
    tell: null,
    // A ring that has just gone off, for the renderer to expand and fade.
    shock: null,
    // 'walk' -> 'windup' -> 'recover' -> 'walk'; the jobs add 'throw', 'charge',
    // 'dash', 'stunned', 'slam' and 'cast' (see core/behaviors.js).
    state: 'walk',
    stateT: 0,
    facing: 0,
    // Distance covered this frame, for the renderer's walk cadence.
    stepped: 0,
    spin: 0,
  };
}

/**
 * A point to walk in from: on a ring around the player, pulled inside the
 * arena. Angles that would land it on top of the player are rejected rather
 * than clamped, because clamping a corner spawn is exactly what puts one in
 * your face.
 */
export function spawnPoint(px, py, rand = Math.random, obstacles = null, ahead = null) {
  const m = FOE.radius + 10;
  for (let tries = 0; tries < 8; tries++) {
    // `ahead` (radians): a cone about the player's heading, for the waves that come at a kiter
    const a = ahead === null || tries >= 5 ? rand() * Math.PI * 2 : ahead + (rand() - 0.5) * 1.7;
    const x = Math.max(m, Math.min(ARENA.width - m, px + Math.cos(a) * FOE.spawnDist));
    const y = Math.max(m, Math.min(ARENA.height - m, py + Math.sin(a) * FOE.spawnDist));
    // 130 clears the biggest body in the roster, so a giant is never born
    // already inside a wall and spat out of it on its first frame.
    if (overlapsAny(x, y, 130, obstacles)) continue;
    if (Math.hypot(x - px, y - py) > FOE.spawnDist * 0.6) return { x, y };
  }
  // Every angle was pinned against a wall -- the player is in a corner. Put it
  // at the far corner rather than giving up and spawning nothing.
  return {
    x: px < ARENA.width / 2 ? ARENA.width - m : m,
    y: py < ARENA.height / 2 ? ARENA.height - m : m,
  };
}

/**
 * Walk them at the player, swing when close, and commit the damage on the
 * release frame.
 *
 * @param onStrike called when a swing connects, for the renderer's feedback.
 */
export function updateFoes(w, dt, onStrike) {
  const p = w.player;

  // ONE CONTEXT, REUSED. A behaviour is handed what it needs and the few things
  // it may DO; it never touches the world directly. `cur` is whichever foe is
  // being stepped, so the closures below act on the right one without a new
  // object per foe per frame.
  let cur = null;
  let decoyTarget = null;     // set per foe: the pizza decoy, while one stands (core/powers.js)
  const c = {
    w, p, dt, onStrike,
    slack: FOE.strikeSlack,
    pr: w.playerRadius,
    dx: 0, dy: 0, d: 1,
    hurt: (n, push, from) => (decoyTarget ? hitDecoy(w, n) : hurtPlayer(w, n, push, (from || cur).x, (from || cur).y)),
    move: (mx, my, slide) => moveFoe(w, cur, mx, my, slide),
    shoot: (spec) => spawnFoeShot(w, cur, spec),
    spawn: (breed, x, y) => spawnFoe(w, cur, breed, x, y),
    clear: () => clearShot(w, cur),
  };

  for (const f of w.foes) {
    f.stepped = 0;
    if (!f.alive) continue;
    if (f.hitT > 0) f.hitT = Math.max(0, f.hitT - dt);
    if (f.shock) { f.shock.t -= dt; if (f.shock.t <= 0) f.shock = null; }
    // BEING KNOCKED BACK (core/allies.js): flies for a moment, even while stunned.
    if (f.kb) {
      const k = Math.min(dt, f.kb.t);
      f.x = Math.max(f.radius, Math.min(ARENA.width - f.radius, f.x + f.kb.vx * k));
      f.y = Math.max(f.radius, Math.min(ARENA.height - f.radius, f.y + f.kb.vy * k));
      f.kb.t -= dt; if (f.kb.t <= 0) f.kb = null;
    }
    // STUNNED (core/allies.js): it does nothing at all until this runs out.
    if (f.stunImmT > 0) f.stunImmT = Math.max(0, f.stunImmT - dt);
    if (f.stunT > 0) {
      f.stunT = Math.max(0, f.stunT - dt);
      if (f.stunT === 0) f.stunImmT = 0.8;        // STUN_IMMUNE_S (core/allies.js): no stun-lock
      f.tell = null; f.ustep = 0; f.ux = 0; f.uy = 0;
      continue;
    }

    // FREEZE NOVA slows it; the PIZZA DECOY steals its attention (throwers still shoot the player).
    const fdt = f.slowT > 0 ? dt * 0.4 : dt;
    decoyTarget = w.decoy && w.decoy.alive && f.behavior !== 'thrower' ? w.decoy : null;
    const tp = decoyTarget || p;
    c.p = tp; c.dt = fdt; c.pr = decoyTarget ? decoyTarget.radius : w.playerRadius;
    const dx = tp.x - f.x;
    const dy = tp.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    // He always turns to face the player, even mid-swing: a swing that lands
    // behind the enemy is unreadable, and turning is not the same as moving.
    // (A charger overrides this: its line is locked, and so is its facing.)
    f.facing = Math.atan2(dy, dx);
    f.stateT += fdt;
    f.tell = null;

    cur = f;
    c.dx = dx; c.dy = dy; c.d = d;
    const x0 = f.x, y0 = f.y;
    (BEHAVIORS[f.behavior] || meleeStep)(f, c);
    f.tell = tellOf(f);
    // WHERE IT WAS TRYING TO GO this frame, for the obstacle pass below: round a
    // wall, a foe should slide the way it is already heading (core/obstacles.js).
    // A foe that did not move falls back to heading for the player.
    const mx = f.x - x0, my = f.y - y0, ml = Math.hypot(mx, my);
    f.ux = ml > 1e-6 ? mx / ml : dx / d;
    f.uy = ml > 1e-6 ? my / ml : dy / d;
    f.ustep = ml;                       // how far it tried to go: the obstacle slide is a fraction of this
  }

  separate(w.foes);
  // OBSTACLES LAST, so a crowd shoving a foe cannot leave it inside a pillar. The
  // arena clamp comes after, because being pushed out of a pillar must not put
  // a foe outside the room.
  if (w.obstacles && w.obstacles.length) {
    for (const f of w.foes) {
      if (!f.alive) continue;
      // WALL-FOLLOWING: the first contact picks a way round and the foe keeps it
      // until it has been clear of everything for a moment (core/obstacles.js).
      const slide = { dx: f.ux ?? 0, dy: f.uy ?? 0, step: f.ustep || 0, side: f.side, commit: f.slideSign || 0, chosen: 0 };
      if (resolveCircle(f, f.radius, w.obstacles, slide)) {
        f.slideSign = slide.chosen || f.slideSign || f.side;
        f.slideIdle = 0;
      } else if (f.slideSign) {
        f.slideIdle = (f.slideIdle || 0) + dt;
        if (f.slideIdle > 0.6) f.slideSign = 0;
      }
      f.x = Math.max(f.radius, Math.min(ARENA.width - f.radius, f.x));
      f.y = Math.max(f.radius, Math.min(ARENA.height - f.radius, f.y));
    }
  }
  cullCorpses(w);
}

/**
 * Move a foe by a step WITH collision, and say what stopped it: `null`, an
 * 'obstacle' (a charger that hits one is stunned) or the arena 'wall'.
 */
function moveFoe(w, f, mx, my, slide = false) {
  f.x += mx;
  f.y += my;
  let hit = null;
  // `slide` is for a foe that is WALKING (the thrower closing in or backing off):
  // it must get round a pillar like any chaser. A charger's DASH leaves it off on
  // purpose -- hitting the obstacle is the point, and is what stuns it. Without
  // this the thrower stood pinned behind every pillar it met head-on.
  const len = Math.hypot(mx, my);
  const sl = slide && len > 1e-6
    ? { dx: mx / len, dy: my / len, step: len, side: f.side, commit: f.slideSign || 0, chosen: 0 }
    : 0;
  if (w.obstacles && w.obstacles.length && resolveCircle(f, f.radius, w.obstacles, sl)) {
    hit = 'obstacle';
    if (sl) { f.slideSign = sl.chosen || f.slideSign || f.side; f.slideIdle = 0; }
  }
  const nx = Math.max(f.radius, Math.min(ARENA.width - f.radius, f.x));
  const ny = Math.max(f.radius, Math.min(ARENA.height - f.radius, f.y));
  if (nx !== f.x || ny !== f.y) { f.x = nx; f.y = ny; hit = hit || 'wall'; }
  return hit;
}

/**
 * Is there a clear line from this foe to the player, for a thrown thing? Sampled
 * every 40px along the segment, against TALL obstacles only (low ones are flown
 * over). A thrower uses this to decide whether to throw at all.
 */
function clearShot(w, f) {
  if (!w.obstacles || w.obstacles.length === 0) return true;
  const dx = w.player.x - f.x, dy = w.player.y - f.y;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 40));
  const r = f.job?.shotRadius ?? 20;
  for (let i = 1; i < n; i++) {
    if (blocksShot(f.x + (dx * i) / n, f.y + (dy * i) / n, r, w.obstacles)) return false;
  }
  return true;
}

/** Add a foe to the room mid-fight (a summon), scaled for the summoner's level. */
function spawnFoe(w, from, breedKey, x, y) {
  const nf = makeFoe(x, y, w.timeS, breedKey);
  applyLevel(nf, from.level || 1);
  w.foes.push(nf);
  w.targets.push(nf);          // the SAME object -- see the header
  return nf;
}

// ---- THROWN THINGS -------------------------------------------------------------
//
// An orb is aimed at where the player is at the moment of RELEASE and then flies
// straight: it does not home. That, and a speed lower than his own, is what makes
// it a thing you dodge by moving rather than a hit you simply take. Tall obstacles
// stop it; low ones do not (core/obstacles.js).

function spawnFoeShot(w, f, spec) {
  const dx = w.player.x - f.x, dy = w.player.y - f.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  // From the HAND when the job says where the hand is, else from the body's edge.
  const m = spec.muzzle, reach = m ? m.fwd : f.radius;
  w.foeShots.push({
    x: f.x + ux * reach, y: f.y + uy * reach, h: m ? m.h : 0.7, age: 0,
    vx: ux * spec.shotSpeed, vy: uy * spec.shotSpeed,
    r: spec.shotRadius, damage: spec.shotDamage, push: spec.push || 0, lifeS: spec.shotLifeS,
    alive: true, from: f.id,
  });
}

/** Fly the orbs, stop them on tall obstacles, and hurt the player ONCE per orb. */
export function updateFoeShots(w, dt, onHit) {
  const p = w.player;
  for (const s of w.foeShots) {
    if (!s.alive) continue;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.lifeS -= dt;
    s.age = (s.age || 0) + dt;
    if (s.lifeS <= 0 || blocksShot(s.x, s.y, s.r, w.obstacles) || s.x < 0 || s.y < 0 || s.x > ARENA.width || s.y > ARENA.height) { s.alive = false; continue; }   // walls stop every projectile
    if (!w.dead && Math.hypot(s.x - p.x, s.y - p.y) <= s.r + w.playerRadius) {
      hurtPlayer(w, s.damage, s.push, s.x - s.vx, s.y - s.vy);
      s.alive = false;
      if (onHit) onHit(s);
    }
  }
  // The array only ever needs the living; keeping the dead would grow it all run.
  if (w.foeShots.some((s) => !s.alive)) w.foeShots = w.foeShots.filter((s) => s.alive);
}

/** Take damage, with a brief flinch window the renderer can read. */
export function hurtPlayer(w, amount, push = 0, fromX = 0, fromY = 0) {
  if (w.dead) return;
  // EVERY ATTACK SHOVES BY ITS OWN AMOUNT (`push`, px), straight away from where it came
  // from. A Slayer's cut nudges; a charging golem throws you. Not on the killing blow.
  if (push > 0) {
    const dx = w.player.x - fromX, dy = w.player.y - fromY, d = Math.hypot(dx, dy) || 1;
    const v = (2 * push) / KNOCK_S;
    w.knock = { vx: (dx / d) * v, vy: (dy / d) * v, t: KNOCK_S };
  }
  // THE SHELL SHIELD, while it is ON in its on-off loop (core/allies.js), cuts every hit by a percentage.
  const sh = w.shield;
  if (sh && sh.up && sh.hp > 0) {
    amount = Math.round(amount * (1 - shieldCut(w.build.shield || 1)));
    sh.hitT = 0.3;
    if (amount <= 0) return;
  }
  w.hp = Math.max(0, w.hp - amount);
  w.hurtT = 0.35;
  if (w.hp <= 0) {
    w.dead = true;
    w.diedAtS = w.timeS;
  }
}

/**
 * Push overlapping foes apart. O(n^2) over at most ten bodies is nothing, and
 * without it a crowd converges into one spot and reads as a single enemy --
 * which would make a test of "can you read a threat" meaningless.
 */
function separate(foes) {
  for (let i = 0; i < foes.length; i++) {
    const a = foes[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < foes.length; j++) {
      const b = foes[j];
      if (!b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.radius + b.radius;
      const d = Math.hypot(dx, dy);
      if (d >= min || d === 0) continue;
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
    }
  }
}

/** Drop bodies out of both arrays once they have been down a moment. */
function cullCorpses(w) {
  const gone = (f) => !f.alive && w.timeS - f.deadAtS > FOE.corpseS;
  if (!w.foes.some(gone)) return;
  const dead = new Set(w.foes.filter(gone));
  w.foes = w.foes.filter((f) => !dead.has(f));
  w.targets = w.targets.filter((t) => !dead.has(t));
}
