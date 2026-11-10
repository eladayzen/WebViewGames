// The crew ladder (§8.3) -- five named local surfers whose marks you climb
// through INSIDE this game, inside a run.
//
// THE MARKS ARE FIXED AUTHORED CONSTANTS (they live in tuning.js, alongside
// SCORE_RATE, because §12 says the two are one tuning relationship). They are
// not derived from the player's history, they do not adapt, they do not
// accumulate, and they are the same every run and every session.
//
// No online service, no leaderboard, no account, no cross-game anything. The
// portraits are five authored illustrations shipped with the game (§8.3).
//
// Chromatically these five deliberately avoid the coral warm slot -- that is
// reserved for Wren, so the player is always the findable warm thing on screen
// (§1, §9.6 rule 7).

import { CREW_MARKS } from './tuning.js';

export const CREW = [
  { name: 'BIRDIE',  portrait: 'crew-birdie',  mark: CREW_MARKS[0] },
  { name: 'OTTO',    portrait: 'crew-otto',    mark: CREW_MARKS[1] },
  { name: 'MARISOL', portrait: 'crew-marisol', mark: CREW_MARKS[2] },
  { name: 'GHOST',   portrait: 'crew-ghost',   mark: CREW_MARKS[3] },
  { name: 'OLD SAL', portrait: 'crew-oldsal',  mark: CREW_MARKS[4] },
];

export const TOP_OF_THE_PEAK = 'TOP OF THE PEAK';
