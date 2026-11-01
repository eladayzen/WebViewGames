// WEAPONS — what a shot is, as data.
//
// Every projectile in this game is the same object with different numbers on
// it, and that is a decision rather than a convenience. The gun has no trigger
// (see `combat.js`): the only input is where the board points, so a weapon
// cannot differ in how it is FIRED — there is nothing to fire it with. What a
// weapon can differ in is its envelope, its rate, its damage and its colour,
// and all four of those are table entries.
//
// The consequence is the one that matters for the mode: a power gate does not
// swap code paths, it swaps a row. Nothing downstream of `WEAPONS[id]` knows
// or cares whether the shooter is a player, a rival or a drone.
//
// ── THE ONE RULE THE TABLE ENCODES ─────────────────────────────────────────
//
// YOU OUTRANGE THEM. A ninja star reaches 86 m and a drone's bolt reaches 58.
// That twenty-eight-metre band is the whole fight: a drone you kill while
// closing through it never fires a shot, and a drone you do not kill starts
// shooting the moment you are inside its own reach. Nothing else in this file
// is as load-bearing as that pair of numbers, and they are the first two to
// move if the mode plays wrong.
//
// MOST OF THE STAR'S ENVELOPE IS NOT NEW. The reach, the corridor, the rate
// and the guidance are the constants the gun already shipped with — 86 m, a
// 5-to-15 m corridor, 0.36 s, 11 rad/s. They were measured over a thousand
// metres of ride and three product faults were found and fixed against them,
// and none of that work was about snow or about a clock, so moving them to
// build a new mode would have thrown the measurement away.
//
// THE SPEED IS THE ONE THAT CHANGED, on Elad's call: 135 m/s down to 78. The
// row's own note has the argument. It is the one constant in that list that
// was never about the gun WORKING — every fault the thousand metres found was
// in the aim, the formation geometry or the overkill rule, and none of them
// moved when the flight time doubled.
//
// It also means the skill is the one this game already asks for and not a new
// one. Acquiring at 70 m and HOLDING the heading through the approach is a
// commitment of line, paid in the same currency as every gate and every mote.
//
// ── DAMAGE IS AN INTEGER AND HEALTH IS A HUNDRED ───────────────────────────
//
// A drone has 3 HP and a star does 1, so three stars kill one — which is the
// brief ("higher than damage inflicted by single ninja star") and also the
// reason the power gates have anything to give. A powered star does 3 and
// therefore kills in one, which is a change of KIND and not of degree: the
// drone that took a second of sustained aim now dies on the first hit, and a
// squad that was a problem becomes a sweep. That is what a power-up should
// feel like, and it is why the step is 1 -> 3 rather than 1 -> 1.5.
//
// A fighter's health is on a hundred so the bar has somewhere to go and so the
// drones' damage can be tuned in single points without the bar stepping in
// visible quarters.

/** Team ids. Anything may shoot anything whose team is not its own. */
export const TEAM = {
  /** The players, and later the AI competitors riding alongside them. */
  CREW: 'crew',
  /** The hill's own. */
  DRONE: 'drone',
};

/**
 * HOW A PVP MATCH IS EXPRESSED, since it is the reason the team field exists
 * at all rather than a boolean `isEnemy`.
 *
 * Co-op (and today's single player): every rider is CREW, the drones are
 * DRONE, and `foesOf` gives each side the other.
 *
 * PVP: player two is registered on PVP_B instead of CREW. Nothing else in the
 * targeting code changes, because nothing in it ever asks "is this a player" —
 * it asks "is this team the same as mine". The drones then shoot at both, both
 * shoot at the drones, and the two riders shoot at each other, which is the
 * match. Rivals arrive the same way: CREW for a co-op field, PVP_B for a
 * contest.
 */
export const PVP_A = 'pvpA';
export const PVP_B = 'pvpB';

/**
 * @typedef {object} Weapon
 * @property {string} id
 * @property {string} label        what the HUD calls it
 * @property {number} damage       health points per projectile that connects
 * @property {number} cooldown     seconds between shots
 * @property {number} speed        metres per second
 * @property {number} rangeMin     closer than this and the shot cannot turn in time
 * @property {number} rangeMax     further than this and it is not taken
 * @property {number} aimNear      corridor half-width at the muzzle, metres
 * @property {number} aimFar       corridor half-width at rangeMax, metres
 * @property {number} turn         guidance authority, radians per second
 * @property {number} hitR         metres
 * @property {number} life         seconds before it expires
 * @property {number} burst        projectiles per shot
 * @property {number} spreadDeg    lateral fan between burst projectiles
 * @property {number} color
 * @property {number} scale        visual size multiplier on the base mesh
 * @property {number} spin         radians per second about the flight axis
 * @property {string} shape        which geometry: 'star' or 'bolt'
 * @property {number} [duration]   seconds a power lasts; absent means permanent
 * @property {object} [speedUp]    {addSpeed, seconds, ceiling} granted on pickup
 */

/** @type {Record<string, Weapon>} */
export const WEAPONS = {
  // ── THE DEFAULT, AND THE ONE EVERY NUMBER BELOW IS A MULTIPLE OF ─────────
  //
  // A ninja star is a THROWN object and it is DELIBERATELY SLOW — 78 m/s,
  // where the energy bolt it replaced flew at 135.
  //
  // The old number was inherited from a gun that was never meant to be seen.
  // At 135 m/s a shot crosses its own eighty-six metres of range in 0.64 s and
  // is three or four frames of travel at any distance the player is actually
  // looking at: it reads as a hitscan line, the kill arrives on the same beat
  // as the throw, and the spin and the shape this file spends paragraphs on
  // are simply never resolved.
  //
  // At 78 it takes 1.1 s to cross the same range. That is the whole feel of a
  // thrown weapon: you watch it go, the drone you led is somewhere else when
  // it lands, and the guidance has visible work to do. It also makes the
  // player's fire and the drones' tell themselves apart in MOTION as well as
  // in colour and pitch — 78 against their 62 is a real difference you can see
  // without being told, where 135 against 62 was two different phenomena.
  //
  // It costs range-at-a-moment, and that is the trade to watch: a drone
  // closing at 30 m/s covers 33 m while a star crosses 86, so the shot has to
  // be taken earlier. That is the mode's thesis — commit the heading early —
  // charged more honestly than before.
  //
  // The spin is not decoration either: a flat disc seen edge-on from a chase
  // camera is invisible, and a spinning one catches the key once a revolution,
  // which is what makes a star read as a star at sixty metres rather than as a
  // dash. At 135 there was not time for a revolution.
  star: {
    id: 'star',
    label: 'ninja stars',
    damage: 1,
    cooldown: 0.36,
    speed: 78,
    // 6, not the drones' 16. The player's own minimum is short because a star
    // leaving the hand of a rider who is already pointed at something does not
    // need room to turn; the drones' is long because they are shooting at a
    // target that is carving and their bolts are slow.
    rangeMin: 6,
    rangeMax: 86,
    aimNear: 5.0,
    aimFar: 15.0,
    turn: 11.0,
    hitR: 1.6,
    life: 2.4,
    burst: 1,
    spreadDeg: 0,
    // Cold steel with a little of the sky in it. Deliberately NOT lime, violet
    // or orange: those three already mean reward, boost and hostile, and a
    // projectile that shares a hue with any of them is a projectile that has to
    // be read twice.
    color: 0xcfe3f5,
    scale: 1.0,
    spin: 26,
    shape: 'star',
  },

  // ── WHAT THE POWER GATES GIVE ───────────────────────────────────────────
  //
  // Both powers are CYAN, and so is the gate that grants them. That is the
  // whole vocabulary lesson: the thing you rode through and the thing now
  // leaving your hand are the same colour, so nobody has to be told what the
  // gate did. It is the one hue the course had not claimed — lime is a mote or
  // a time gate, violet is a boost, pink is a slalom pole, orange is hostile.
  keen: {
    id: 'keen',
    label: 'keen stars',
    // 3, so a drone dies on the first hit instead of the third. See the header.
    damage: 3,
    cooldown: 0.30,
    speed: 88,
    rangeMin: 6,
    // AND THE REACH GROWS. The default outranges a drone by 28 m; this
    // outranges it by 38. A power-up that only hits harder changes how fast a
    // fight ends; one that also starts it sooner changes whether the fight
    // happens at all, which is a bigger feeling for the same arithmetic.
    rangeMax: 96,
    aimNear: 6.0,
    aimFar: 17.0,
    turn: 13.0,
    hitR: 2.0,
    life: 2.6,
    burst: 1,
    spreadDeg: 0,
    color: 0x2ee6d6,
    scale: 1.35,
    spin: 32,
    shape: 'star',
    duration: 14,
  },

  // The second power, and the rarer one: the same star, thrown three at a time
  // in a fan, AND a speed boost. "Sometime speed boosts + strong weapon."
  //
  // THE FAN IS WHY IT IS NOT JUST A BIGGER KEEN. Three projectiles on slightly
  // different bearings means one pass of a chevron can put a star into three
  // different drones, so the weapon changes the SHAPE of the engagement rather
  // than its rate — a squad that had to be swept with a traverse can be taken
  // from one heading. Pairing that with a speed boost is deliberate: it is the
  // one moment in the mode where you are moving too fast to traverse, so it
  // hands you the tool that does not need you to.
  storm: {
    id: 'storm',
    label: 'star storm',
    damage: 3,
    cooldown: 0.40,
    speed: 88,
    rangeMin: 6,
    rangeMax: 96,
    aimNear: 7.0,
    aimFar: 20.0,
    turn: 13.0,
    hitR: 2.0,
    life: 2.6,
    burst: 3,
    spreadDeg: 9,
    color: 0x7df9ff,
    scale: 1.35,
    spin: 34,
    shape: 'star',
    duration: 11,
    // Lifted straight from chill vibe's own boost rather than invented, so a
    // boost means one thing in this game and not two.
    speedUp: { addSpeed: 12, seconds: 2.8, ceiling: 30 },
  },

  // ── THE HILL'S OWN ──────────────────────────────────────────────────────
  //
  // SLOW, and that is the single most important number in this row. 62 m/s
  // against a rider doing 30 means the bolt takes most of a second to arrive
  // from the edge of its range, and the guidance authority is 2.6 rad/s
  // against the star's 11 — so a bolt fired at where you were can be carved
  // away from. That is what makes incoming fire a thing you PLAY rather than
  // a tax: the drones' accuracy is a function of whether you changed your line
  // after they committed.
  //
  // It is also why the drone cooldown is long. Two slow dodgeable shots per
  // pass is an encounter; a stream of them is weather.
  blaster: {
    id: 'blaster',
    label: 'drone bolt',
    damage: 6,
    cooldown: 2.4,
    speed: 62,
    rangeMin: 16,
    rangeMax: 58,
    // A WIDE CORRIDOR, because a drone is a turret and can face anywhere. The
    // player's narrow one exists because the player's heading is the input;
    // a drone has no such constraint and pretending it does would read as the
    // enemy being bad at its job for no reason the player can see.
    aimNear: 10.0,
    aimFar: 26.0,
    turn: 2.6,
    hitR: 1.9,
    life: 2.4,
    burst: 1,
    spreadDeg: 0,
    color: 0xff6a1f,
    scale: 1.0,
    spin: 0,
    shape: 'bolt',
  },
};

/** The weapon a fighter carries when nothing has been granted. */
export const DEFAULT_WEAPON = 'star';

/** The powers a power gate may hand out, and how often each comes up. */
export const POWER_TABLE = [
  { id: 'keen', weight: 3 },
  { id: 'storm', weight: 1 },
];

/** Pick a power. `r` is a float in [0,1). */
export function rollPower(r) {
  let total = 0;
  for (const e of POWER_TABLE) total += e.weight;
  let x = r * total;
  for (const e of POWER_TABLE) {
    x -= e.weight;
    if (x < 0) return e.id;
  }
  return POWER_TABLE[0].id;
}
