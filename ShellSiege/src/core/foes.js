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
import { ARENA } from './world.js';
import { BREEDS, DEFAULT_BREED } from './breeds.js';

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
export function makeFoe(x, y, timeS = 0, breedKey = DEFAULT_BREED) {
  const b = BREEDS[breedKey] || BREEDS[DEFAULT_BREED];
  return {
    kind: 'foe',
    breed: breedKey,
    x, y,
    radius: b.radius ?? FOE.radius,
    speed: b.speed ?? FOE.speed,
    reach: b.reach ?? FOE.reach,
    damage: b.damage ?? FOE.damage,
    windupS: b.windupS ?? FOE.windupS,
    recoverS: b.recoverS ?? FOE.recoverS,
    cost: b.cost ?? 1,
    hp: b.hp ?? FOE.hp,
    maxHp: b.hp ?? FOE.hp,
    hitT: 0,
    alive: true,
    deadAtS: -Infinity,
    bornAtS: timeS,
    // 'walk' -> 'windup' -> 'recover' -> 'walk'
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
export function spawnPoint(px, py, rand = Math.random) {
  const m = FOE.radius + 10;
  for (let tries = 0; tries < 8; tries++) {
    const a = rand() * Math.PI * 2;
    const x = Math.max(m, Math.min(ARENA.width - m, px + Math.cos(a) * FOE.spawnDist));
    const y = Math.max(m, Math.min(ARENA.height - m, py + Math.sin(a) * FOE.spawnDist));
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

  for (const f of w.foes) {
    f.stepped = 0;
    if (!f.alive) continue;
    if (f.hitT > 0) f.hitT = Math.max(0, f.hitT - dt);

    const dx = p.x - f.x;
    const dy = p.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    // He always turns to face the player, even mid-swing: a swing that lands
    // behind the enemy is unreadable, and turning is not the same as moving.
    f.facing = Math.atan2(dy, dx);
    f.stateT += dt;

    if (f.state === 'walk') {
      if (d <= f.reach) {
        f.state = 'windup';
        f.stateT = 0;
      } else {
        const step = Math.min(f.speed * dt, d - f.reach);
        f.x += (dx / d) * step;
        f.y += (dy / d) * step;
        f.stepped = step;
      }
    } else if (f.state === 'windup') {
      if (f.stateT >= f.windupS) {
        // THE RELEASE FRAME. Re-measured now, not when the swing started --
        // that is what makes stepping out of range a dodge rather than a
        // cosmetic retreat, and it is the whole point of the telegraph.
        if (d <= f.reach + FOE.strikeSlack && !w.dead) {
          hurtPlayer(w, f.damage);
          if (onStrike) onStrike(f);
        }
        f.state = 'recover';
        f.stateT = 0;
      }
    } else if (f.stateT >= f.recoverS) {
      f.state = 'walk';
      f.stateT = 0;
    }
  }

  separate(w.foes);
  cullCorpses(w);
}

/** Take damage, with a brief flinch window the renderer can read. */
export function hurtPlayer(w, amount) {
  if (w.dead) return;
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
