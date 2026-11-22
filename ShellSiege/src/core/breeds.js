// WHAT WALKS AT YOU, AND IN WHAT ORDER.
//
// The prototype had one enemy and a flat spawn rate: minute five played
// exactly like minute zero. That answers "can you read a threat" once and
// then says nothing, because a loop with no shape has nothing to learn.
//
// This file is the shape. Five breeds off ONE skeleton and ONE 22-bone
// retarget (tools/make-rival.mjs), and a timeline that introduces them one at
// a time while the pressure climbs.
//
// EVERY BREED IS ARMOURED, AND NOT ONE HAS AN ORGANIC FACE.
//
// That is a licensing decision before it is an art one. The pack's other
// fifteen characters are orcs, trolls, a pig butcher, a tentacled mutant,
// demons and a Medusa, and Elad's read is that Paramount is unlikely to
// approve a TMNT title whose enemies are fantasy monsters. The constructs
// avoid that -- and they do better than avoid it: THE FOOT CLAN ARE ROBOTS
// in the 2012 series. A wave of faceless machines reads as the Foot. A wave
// of orcs reads as a different game wearing a TMNT skin.
//
// EACH BREED HAS ITS OWN JOB, so a player can name what just arrived and knows
// what to do about it. Elad, 22 Nov: "Slayer is currently the relatively fast
// simple soldier" and the rest should be different. The behaviours live in
// core/behaviors.js; the numbers that tune them are the `job` on each breed below.
//
//   slayer     GRUNT    chases and swings. The baseline everything is read against.
//   evilgod    THROWER  low health; keeps its distance and throws a slow orb.
//                       Sidestep the orb, hide behind a pillar, or rush it.
//   mechgolem  CHARGER  locks a lane on the floor, then rushes down it. Lean
//                       sideways. Crashing into a pillar stuns it.
//   elemgolem  SLAMMER  stops near you; a ring fills on the floor, then the ground
//                       is struck. Walk out of the circle.
//   fortgolem  WARDEN   slowest and biggest; calls Slayers (twice, no more).
//                       Kill it first.
//
// SIZES (Elad, 22 Nov): Slayer -15%, Evil God +15%, Mechanical Golem +20%, and
// the Elemental and Fort Golems +80%. Drawn height, hitbox radius and reach all
// move together (test/breeds.test.mjs pins that), or a giant would have a small
// hitbox and a small one a giant's.
//
// THE NUMBERS ARE FIRST GUESSES. The old table of kill-time-versus-walk-in
// margins is gone with the thing it measured: that arithmetic assumed every
// enemy simply walked up and swung. What a job costs the player is a matter of
// how readable its warning is and how fast he can lean, and only a board can say.
//
//   ?room=3        start in the third room, to look at it without clearing two
//   ?level=2       start on a later level (more enemies, and a bit tougher)
//   ?pool=curve    use the designed introduction order instead of everyone
//   ?breed=fortgolem   force every spawn to one breed

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

export const BREEDS = {
  slayer: {
    label: 'Slayer', glb: 'models/rivals/Character_Slayer_01.glb', tex: 'tex/rivals.webp',
    hp: 50, speed: 165, damage: 13, radius: 39, reach: 107,
    height: 1.87, windupS: 0.40, recoverS: 0.52, cost: 1,
    behavior: 'melee',
  },
  evilgod: {
    label: 'Evil God', glb: 'models/rivals/Character_EvilGod_01.glb', tex: 'tex/rivals.webp',
    hp: 30, speed: 230, damage: 9, radius: 44, reach: 133,
    height: 2.36, windupS: 0.32, recoverS: 0.45, cost: 1,
    behavior: 'thrower',
    job: { keepMin: 380, keepMax: 520, throwEvery: 2.0, windupS: 0.50, shotSpeed: 360, shotRadius: 24, shotDamage: 9, shotLifeS: 2.8 },
  },
  mechgolem: {
    label: 'Mechanical Golem', glb: 'models/rivals/Character_MechanicalGolem_01.glb', tex: 'tex/rivals.webp',
    hp: 90, speed: 145, damage: 17, radius: 65, reach: 168,
    height: 3.06, windupS: 0.50, recoverS: 0.62, cost: 2,
    behavior: 'charger',
    job: { chargeMin: 260, chargeMax: 650, dist: 780, speed: 760, every: 3.0, windupS: 0.70, stunS: 1.6, hitDamage: 17 },
  },
  elemgolem: {
    label: 'Elemental Golem', glb: 'models/rivals/Character_ElementalGolem_01.glb', tex: 'tex/rivals.webp',
    hp: 130, speed: 125, damage: 22, radius: 104, reach: 263,
    height: 4.86, windupS: 0.55, recoverS: 0.66, cost: 3,
    behavior: 'slammer',
    job: { trigger: 300, radius: 320, every: 2.0, windupS: 0.90, damage: 22 },
  },
  fortgolem: {
    label: 'Fort Golem', glb: 'models/rivals/Character_FortGolem_01.glb', tex: 'tex/rivals.webp',
    hp: 180, speed: 105, damage: 28, radius: 115, reach: 279,
    height: 5.31, windupS: 0.62, recoverS: 0.72, cost: 4,
    behavior: 'summoner',
    job: { first: 2, every: 7, max: 2, count: 2, breed: 'slayer', windupS: 0.80 },
  },
};

/**
 * THE BREED EVERYTHING FALLS BACK TO, by key rather than by name written into
 * four other files. The roster has already been replaced once -- the whole
 * cast changed from fantasy monsters to constructs -- and the last time, the
 * fallback was the literal string 'skeleton' in core/foes.js and
 * render/foes.js, which would have silently become undefined.
 */
export const DEFAULT_BREED = 'slayer';

/**
 * WHAT A BREED COSTS TO SPAWN. It is the same number that used to be the XP a
 * kill paid, and it is the right unit for the job: an ork was worth three
 * skeletons because it took about four times as long to put down, which is
 * exactly what a room's budget has to account for. A room is a sum of these,
 * not a count of bodies.
 */
export const costOf = (key) => (BREEDS[key] || BREEDS[DEFAULT_BREED]).cost;

/**
 * THE SHAPE OF A LEVEL. Each level is a bundle of rooms in one place, ending
 * in a boss. `pools[i]` is who may appear in room i, and a new breed ENTERS
 * ALONGSIDE the old ones for two rooms before the weakest drop out -- swapping
 * the roster wholesale reads as the game changing the subject, overlapping
 * reads as something arriving.
 *
 * `boss` is a STAND-IN: the biggest breed, guaranteed in the last room. A real
 * boss -- its own model, its own attacks -- is phase 4.
 */
export const LEVELS = [
  {
    name: 'The Plaza',
    floor: 'plaza',
    pools: [
      ['slayer'],
      ['slayer', 'evilgod'],
      ['slayer', 'evilgod', 'mechgolem'],
      ['evilgod', 'mechgolem', 'elemgolem'],
      ['mechgolem', 'elemgolem', 'fortgolem'],
    ],
    boss: 'fortgolem',
  },
];

/**
 * SHOW EVERYTHING, FOR NOW. Elad, 22 Nov: "i want to see maximum enemies in
 * the prototype ... it's temporary so i can see everything we've got". So the
 * designed order above is IGNORED unless `?pool=curve` asks for it, and every
 * room draws from all five breeds.
 *
 * It is a constant with a name and not a deleted table because the designed
 * order is the real game and this is the stage in which it gets judged. Flip
 * the default here when the curve is wanted back.
 */
export const SHOW_EVERYTHING = QS.get('pool') !== 'curve';

/** Who may spawn in a room. `everything` is a parameter so a test can ask for the designed one. */
export function poolFor(levelIdx, roomIdx, everything = SHOW_EVERYTHING) {
  if (everything) return Object.keys(BREEDS);
  const def = LEVELS[levelIdx % LEVELS.length];
  return def.pools[Math.min(roomIdx, def.pools.length - 1)];
}

/** Rooms in a level -- one per entry in the pool list. */
export const roomsIn = (levelIdx) => LEVELS[levelIdx % LEVELS.length].pools.length;

/** Every breed the build has to load -- the union of every level and room. */
export function usedBreeds() {
  const forced = QS.get('breed');
  if (forced && BREEDS[forced]) return [forced];
  if (SHOW_EVERYTHING) return Object.keys(BREEDS);
  return [...new Set(LEVELS.flatMap((l) => [...l.pools.flat(), l.boss]))];
}

/** `?room=N` (1-based) and `?level=N`: where a run begins, for looking at one thing. */
export const START = {
  level: Math.max(1, Math.round(num('level', 1))),
  room: Math.max(0, Math.round(num('room', 1)) - 1),
};
