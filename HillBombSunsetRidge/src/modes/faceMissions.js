// MISSIONS · OPEN FACE -- the same mission game, played on the wide hill.
//
// Amit, after both existed side by side: "divide it from the UI and the
// experience to, it's like we had two different games... Missions Original,
// Speed Race, and then Missions Open Face, and probably later Speed Race Open
// Face. And within them there should be no mix."
//
// So this is a front door, not a second implementation. The mode body is
// modes/missions.js's -- identical objectives, clock and scoring -- and which
// hill a run happens on is decided per mission by courseFor(). What this module
// buys is a separate registration, which is what puts a separate button in the
// lobby and lets main.js order them: originals first, open face after.
//
// NO MIX is enforced by the two mission LISTS, not here: main.js splits
// MISSIONS into those with a course (the face) and those without (the ridge),
// hands each list to its own select screen, and gives each its own unlock
// ladder. Neither screen can show the other's missions, and neither ladder
// gates on the other's progress.

import { registerMode } from './mode.js';
import { MISSION_MODE } from './missions.js';

export default registerMode({
  ...MISSION_MODE,
  id: 'faceMissions',
  name: 'MISSIONS · OPEN FACE',
  tagline: 'The wide mountain. Eight runs, and it drops.',
  /**
   * PARKED. Amit: "we will be eliminating the mission open face for now -- no
   * way to get to that menu. I want to make sure there's no way someone for
   * some reason exits and finds himself in the open face menu."
   *
   * `hidden` takes it off the lobby, which is the only route in: its mission
   * list is opened by that button and by nothing else, and the back-stack only
   * ever returns to a list a run was started from -- so with no way to start
   * one, there is no way to arrive at it either.
   *
   * Registered rather than deleted, and the eight levels, the terrain variants
   * and the world-steer controller all stay exactly as they are. What failed
   * was the combination, not the parts, and several of them -- the drops above
   * all -- have already come back to the ridge and are the best thing on it.
   * Reachable at ?gamemode=faceMissions if it is ever worth another look.
   */
  hidden: true,
});
