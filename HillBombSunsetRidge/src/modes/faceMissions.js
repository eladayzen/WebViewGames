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
});
