// FREE RIDE -- the endless run the game has always been, now expressed as a
// mode rather than as the absence of one.
//
// That distinction is the point. If "no mode selected" meant the old behaviour,
// every other mode would be a special case bolted onto a default path, and the
// mode host would have a null branch in it forever. Making free ride an ordinary
// mode means there is exactly one code path: a mode is always running.
//
// It is also the thinnest possible proof that the contract is honest. Free ride
// subscribes to nothing, ends on nothing, and draws no panel -- and the game
// plays exactly as before. Anything it needed to reach into the simulation for
// would be a hole in the seam.

import { registerMode } from './mode.js';
import { DEFAULT_COURSE } from '../data/courses.js';

export default registerMode({
  id: 'freeride',
  name: 'FREE RIDE',
  tagline: 'No clock. No list. Just the hill.',
  // OFF THE FRONT DOOR, not deleted. A mode with no goal and no ending is a
  // hard thing to put in front of a player -- it answers "what am I meant to be
  // doing" with "nothing" -- so the lobby offers the two modes that have an
  // answer. It stays REGISTERED because it is the cleanest possible harness for
  // working on the controller: no clock, no rivals, no objectives to satisfy,
  // just the board. Reachable at ?gamemode=freeride.
  hidden: true,
  course: DEFAULT_COURSE,

  create() {
    return {
      start() {},
      stop() {},
      // The run ends when the rider wipes out, which the game already handles.
      panel: () => null,
    };
  },
});
