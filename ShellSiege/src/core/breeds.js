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
// EACH BREED CHANGES ONE THING, so a player can name what just arrived:
//
//   slayer     the baseline everything else is read against -- a plate
//              knight, the most legible silhouette in the pack
//   evilgod    fast and fragile, a skinny metal frame -- the first that
//              gets PAST you
//   mechgolem  the first that does not die on the way in
//   elemgolem  slow, huge, survives most of a magazine
//   fortgolem  the wall. Its telegraph is the longest in the game ON
//              PURPOSE, because a thing that size landing an unreadable hit
//              is just unfair
//
// THE NUMBERS ARE NOT A SMOOTH CURVE. `evilgod` has less health than
// `slayer` and is far more dangerous, because speed and health are different
// questions for someone standing on a board.
//
// Measured against the base gun -- 10 damage, a shot every 0.55s, 620px
// range -- with your undivided attention on one enemy:
//
//   breed      hp   shots  kill    walk-in  margin
//   slayer     50   5      2.20s   2.99s    +0.79  dies just before it lands
//   evilgod    30   3      1.10s   2.19s    +1.09  dies early, if you see it
//   mechgolem  90   9      4.40s   3.31s    -1.09  ARRIVES ALIVE
//   elemgolem 130  13      6.60s   3.79s    -2.81
//   fortgolem 180  18      9.35s   4.43s    -4.92
//
// The sign flip between evilgod and mechgolem is the whole difficulty curve:
// before it you can kill anything one-on-one, after it you cannot, and the
// build has to start carrying you.
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
    hp: 50, speed: 165, damage: 13, radius: 46, reach: 126,
    height: 2.20, windupS: 0.40, recoverS: 0.52, cost: 1,
  },
  evilgod: {
    label: 'Evil God', glb: 'models/rivals/Character_EvilGod_01.glb', tex: 'tex/rivals.webp',
    hp: 30, speed: 230, damage: 9, radius: 38, reach: 116,
    height: 2.05, windupS: 0.32, recoverS: 0.45, cost: 1,
  },
  mechgolem: {
    label: 'Mechanical Golem', glb: 'models/rivals/Character_MechanicalGolem_01.glb', tex: 'tex/rivals.webp',
    hp: 90, speed: 145, damage: 17, radius: 54, reach: 140,
    height: 2.55, windupS: 0.50, recoverS: 0.62, cost: 2,
  },
  elemgolem: {
    label: 'Elemental Golem', glb: 'models/rivals/Character_ElementalGolem_01.glb', tex: 'tex/rivals.webp',
    hp: 130, speed: 125, damage: 22, radius: 58, reach: 146,
    height: 2.70, windupS: 0.55, recoverS: 0.66, cost: 3,
  },
  fortgolem: {
    label: 'Fort Golem', glb: 'models/rivals/Character_FortGolem_01.glb', tex: 'tex/rivals.webp',
    hp: 180, speed: 105, damage: 28, radius: 64, reach: 155,
    height: 2.95, windupS: 0.62, recoverS: 0.72, cost: 4,
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
