// RACES -- the speed race's own ladder, one per hill.
//
// Amit: "when I click speed race, I want a new lobby screen where the player
// picks one out of six races, because we only have six levels right now... they
// don't have to be in the same order as the missions. You need to finish one --
// maybe at least third place -- to unlock the next."
//
// SIX RACES BECAUSE THERE ARE SIX HILLS. The race used to deal a random one and
// say nothing about it, which made every race the same event on scenery the
// player had no relationship with. Naming them turns the hills into places: THE
// NARROWS is somewhere you have been and somewhere you can go back to, and
// choosing it is choosing a track, which is what a race lobby is for.
//
// A DIFFERENT ORDER FROM THE MISSIONS, deliberately. The mission ladder teaches,
// so it starts on the hill with the least going on; a race ladder should start
// on the one that races best and build toward the ones that punish a bad line.
// Same six mountains, met in a different order -- which is also the cheapest
// possible way to make the two modes feel like different games.
//
// Difficulty here is a property of the HILL, not of a target: there is nothing
// to tune per race because the contest is the field beside you, and they ride
// whatever you ride. So the ordering below is the whole design.

/**
 * @typedef {{id:string, terrain:string, name:string, brief:string}} Race
 */

/** @type {Race[]} */
export const RACES = [
  {
    // Widest and straightest of the six -- the one where the racing line is
    // obvious and the player can learn what the gates are for before the road
    // starts arguing with them.
    id: 'raceLongFall',
    terrain: 'ridgeLongFall',
    name: 'DUNE RUN',
    brief: 'Wide open. Learn the gates.',
  },
  {
    id: 'raceStaircase',
    terrain: 'ridgeStaircase',
    name: 'SPIRE STEPS',
    brief: 'Shallow drops, one after another.',
  },
  {
    id: 'raceBowl',
    terrain: 'ridgeBowl',
    name: 'STORM BOWL',
    brief: 'Deep walls. Carry your speed high.',
  },
  {
    id: 'raceDrops',
    terrain: 'ridgeDrops',
    name: 'SUNSET DROP',
    brief: 'The ground gives way. Land it clean.',
  },
  {
    id: 'raceNarrows',
    terrain: 'ridgeNarrows',
    name: 'THE NARROWS',
    brief: 'Tight and pinching. No room to miss.',
  },
  {
    // Last because it is the twirliest road in the game -- measured, its
    // centreline moves sideways twice as fast as any other hill's. Holding a
    // line here while chasing gates is the hardest thing the mode asks.
    id: 'raceWeave',
    terrain: 'ridgeWeave',
    name: 'SWITCHBACK',
    brief: 'The road never stops turning.',
  },
];

/** Ids in ladder order, for the progress store's unlock chain. */
export const RACE_IDS = RACES.map((r) => r.id);

export function getRace(id) {
  return RACES.find((r) => r.id === id) || RACES[0];
}

/**
 * THE UNLOCK BAR. Amit: "maybe finish at least third place to unlock the next
 * one."
 *
 * Third of five is the right bar rather than a soft one: the field holds station
 * on the player now (entities/rivals.js), so finishing mid-pack is what happens
 * if you simply ride to the end without crashing. Asking for third means beating
 * two of them, which needs at least some of the gates -- and it still forgives
 * one bad crash, since a rival you drop can only claw back 1 m/s.
 *
 * Stars follow placement directly, so the lobby shows how well each race went
 * rather than just that it happened.
 */
export const RACE_UNLOCK_PLACE = 3;

/** @param {number} place 1-based finishing position. */
export function starsForPlace(place) {
  return place <= 1 ? 3 : place <= 2 ? 2 : place <= RACE_UNLOCK_PLACE ? 1 : 0;
}
