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
// ── RANGE IS THE MECHANIC NOW, SO RANGE IS THE NUMBER TO TUNE ──────────────
//
// The gun used to acquire through a flaring corridor along the board's
// heading, and the input to it was where you pointed. It now takes the NEAREST
// enemy, full stop (see `combat.js`). That moves the player's agency off the
// heading and onto distance: the only question the gun asks is how far away
// the closest thing is, so `rangeMax` stopped being a detail and became the
// mechanic.
//
// WHICH IS WHY THE REACH CAME DOWN AT THE SAME TIME. 86 m with a corridor was
// a long shot you had to earn by committing a line; 86 m with nearest-wins is
// a gun that fires continuously at whatever happens to be on the mountain, and
// a weapon that is always firing is a weapon with no decision in it. 52 m
// makes the approach a decision again — you are not shooting until you have
// chosen to be close.
//
// ── AND YOU STILL OUTRANGE THEM ────────────────────────────────────────────
//
// A star reaches 52 m and a drone's bolt reaches 44. That eight-metre band is
// the fight: a drone you kill while closing through it never fires, and one
// you do not kill starts shooting the moment you are inside its own reach.
//
// THE DRONES CAME DOWN WITH THE PLAYER, and that was not asked for — the brief
// was the main weapon. It is here because the ratio is load-bearing and
// cutting one side of it alone inverts the mode: at 52 against their old 58
// the drones would outrange the player, so every engagement would open with
// you being shot at and no answer available, which is a different game and
// not the one anyone chose. ONE NUMBER UNDOES IT. If the drones should out-
// reach the player, raise `blaster.rangeMax` past 52 and nothing else moves.
//
// THEIR RATE WENT UP BECAUSE THEIR REACH WENT DOWN, and this is the part that
// had to be measured rather than reasoned. The first cut took them to 34 m and
// left the cooldown near where it was, and the result was a mode with no teeth
// in it: nine bolts fired at a rider who spent nine hundred metres not fighting
// back, against twenty-eight before, and a health bar that barely moved. The
// drones had become decoration.
//
// The arithmetic is straightforward once it is written down. A drone's threat
// over one pass is (2 x reach / closing speed) / cooldown shots. At 58 m and
// 2.4 s that was 1.6; at 34 m and 1.9 s it was 1.2 — and at 44 m and 1.15 s it
// is 2.5, which puts the damage per kilometre back where it was measured
// before any of this moved. A shorter reach with a faster rate is also a
// better enemy than a long slow one: the engagement is tighter, so the
// decision to close or stay wide happens at a moment the player can see.
//
// ── WHAT IS STILL INHERITED, AND MEASURED ──────────────────────────────────
//
// The rate and the guidance are the constants the gun shipped with — 0.36 s,
// 11 rad/s — measured over a thousand ridden metres against three product
// faults. The SPEED changed on Elad's call (135 m/s to 78; the row's own note
// has the argument) and the REACH and the targeting rule changed on his call
// too. What none of those touched is the overkill rule, which was the actual
// finding in that thousand metres and is about flight time rather than aim.
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
    // 6, not the drones' 12. The player's own minimum is short because a star
    // leaving the hand of a rider who is already pointed at something does not
    // need room to turn; the drones' is long because they are shooting at a
    // target that is carving and their bolts are slow.
    rangeMin: 6,
    rangeMax: 52,
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
    // AND THE REACH GROWS. The default outranges a drone by 18 m; this
    // outranges it by 28. A power-up that only hits harder changes how fast a
    // fight ends; one that also starts it sooner changes whether the fight
    // happens at all, which is a bigger feeling for the same arithmetic.
    rangeMax: 62,
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
    rangeMax: 62,
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
    cooldown: 1.15,
    speed: 62,
    rangeMin: 12,
    rangeMax: 44,
    // VESTIGIAL. Both sides now acquire by distance alone, so nothing reads
    // these — they are kept because a weapon row with holes in it is a row
    // that crashes the first time something iterates it, and because the
    // corridor is one `acquire` away from coming back if the nearest-wins
    // rule does not survive play.
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

// ── WHAT A REWARD GATE MAY HAND OVER ───────────────────────────────────────
//
// Three outcomes, and they are deliberately not three sizes of the same thing.
// A gate that always gave a weapon is a gate you take or ignore depending on
// whether you already have one; a gate that always healed is one you take only
// when hurt. With all three in the pool EVERY reward gate is worth riding for,
// and which one you got is news rather than a number.
//
// THE HEAL IS THE COMMON ONE, at 4 of 10. Health is the resource the mode is
// actually about — it is the thing that ends a run — and it is also the only
// reward that is worthless at the wrong moment. Making it the likeliest
// outcome and making it LARGE (45, nearly half a bar) is what keeps a reward
// gate worth a detour even on a clean run, because a clean run is exactly when
// you can afford the detour that sets up the next bad one.
//
// THE STORM IS THE RARE ONE, at 2 of 10. It is the only gift that changes two
// things at once — the weapon AND the speed — and a mode where that arrives
// every third gate is a mode balanced around having it.
//
// `kind` is what the receiver switches on. A weapon gift is applied through
// `Fighter.givePower`, which knows about durations; a heal through
// `Fighter.heal`, which does not. Nothing downstream needs to know more than
// that, which is what lets a fourth kind be added here and nowhere else.
export const GIFTS = [
  {
    id: 'mend',
    kind: 'heal',
    label: 'repair',
    amount: 45,
    weight: 4,
    /** The legend drawn on the gate — see `makeSigilTexture` in course.js. */
    sigil: 'mend',
  },
  { id: 'keen', kind: 'weapon', label: WEAPONS.keen.label, weight: 4, sigil: 'keen' },
  { id: 'storm', kind: 'weapon', label: WEAPONS.storm.label, weight: 2, sigil: 'storm' },
];

/** @type {Record<string, typeof GIFTS[number]>} */
export const GIFT = Object.fromEntries(GIFTS.map((g) => [g.id, g]));

/** Pick a gift. `r` is a float in [0,1). */
export function rollGift(r) {
  let total = 0;
  for (const e of GIFTS) total += e.weight;
  let x = r * total;
  for (const e of GIFTS) {
    x -= e.weight;
    if (x < 0) return e.id;
  }
  return GIFTS[0].id;
}

/**
 * WHAT A GLOWING MOTE PAYS IN A MODE WITH NO CLOCK.
 *
 * The drift lines are the best-looking object in this game and in skirmish
 * they were paying a currency the mode does not have — a chain of glowing
 * motes that bought literally nothing. Riding one was a detour for nothing,
 * which is worse than the chain being absent, because the game had taught the
 * player to want it.
 *
 * ONE POINT A MOTE, THREE FOR A WHOLE LINE, and the numbers were set against
 * the damage rather than chosen. The arithmetic is worth writing down because
 * it is the only part of this mode that can quietly make it unloseable:
 *
 *   `pickups.js` runs BAND 60 at CHAIN_CHANCE 0.45, so 7.5 lines a kilometre,
 *   and a line is 5 to 8 motes — a mean of 6.5. That is 49 motes a kilometre.
 *   At 1 point each plus 3 a line, PERFECT COLLECTION RETURNS 71 POINTS OF
 *   HEALTH PER KILOMETRE.
 *
 *   Measured against it, the drones take 47 a kilometre from a rider who is
 *   not fighting back.
 *
 * So the ceiling sits above break-even, deliberately, and the reason is that
 * the ceiling is not reachable while fighting: the motes lie along steepest
 * descent and the drones do not, so a player collecting every line is a player
 * choosing not to close — and the squads they ride past keep their health,
 * their position and their next shot. The two lines compete, which is the
 * whole of what makes this an economy rather than a drip feed.
 *
 * IT IS ALSO THE FIRST NUMBER TO MOVE IF THE MODE PLAYS TOO SAFE. Five a line
 * was the first cut and took the ceiling to 86 against the same 47, which is
 * a rider who cannot die while riding well — and "dead is dead" stops meaning
 * anything the moment that is true.
 *
 * The chain bonus is flat rather than multiplied by the score streak. The
 * clock's own note has the reason and it survives the change of currency:
 * chains cannot arrive closer than 133 m however well anyone rides, so this
 * income has a ceiling skill cannot lift — and a multiplier on it would be a
 * second economy stacked on the one the mode is about.
 */
export const MOTE_HEAL = 1;
export const CHAIN_HEAL = 3;
