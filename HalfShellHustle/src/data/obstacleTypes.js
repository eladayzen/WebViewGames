// Per-obstacle-type visual/collision tuning, data-driven -- matches this
// project's data/enemyTypes.js convention: entities/obstacles.js reads
// everything about a spawned obstacle's look/size/jump-clearance from here.
//
// 'medium' is the original barricade -- visuals/size unchanged, but now
// jumpable too (direct feedback, once JUMP_HEIGHT was raised to 2.4
// specifically for this) with a tighter margin than 'low', since it's the
// taller/harder one. 'low' is shorter and easier -- real Kolbo art not done
// yet, so it uses this repo's plain-flat-color placeholder convention
// (entities/platform.js's ramp/kill-barrier/box). Still a billboard
// THREE.Sprite like every other obstacle, unlike platform.js's real 3D
// geometry -- that needed to read from every camera angle (a climbable
// structure); obstacles don't.

import { LANE_WIDTH } from './constants.js';
import { BARRICADE_TEXTURE } from './envArt.js';

const OBSTACLE_WIDTH = LANE_WIDTH * 0.82; // shared lane-fit ratio, both types

export const OBSTACLE_TYPES = {
  // jumpClearHeight = 2.0: entities/collision.js's checkObstacleHit fires
  // for a continuous ~0.19s window (2 * OBSTACLE_COLLISION_HALF_Z /
  // the current scroll speed) as this passes the player -- so it's WIDER at
  // the speed ramp's slower start and narrows as the run speeds up. player.airHeight must
  // stay >= this for the whole window. With entities/player.js's rise/hold/
  // fall arc (JUMP_HEIGHT 2.4), airHeight stays >= 2.0 for a continuous
  // ~0.45s stretch spanning the hold -- ~2.4x the required window, tighter
  // than 'low' on purpose (the taller/harder one) but still forgiving of a
  // roughly-timed jump, not frame-perfect.
  medium: {
    texture: BARRICADE_TEXTURE,
    color: null,
    width: OBSTACLE_WIDTH,
    height: OBSTACLE_WIDTH * BARRICADE_TEXTURE.aspect, // ~2.4, unchanged
    jumpable: true,
    jumpClearHeight: 2.0,
    // Contact shadow, same fields/semantics as data/enemyTypes.js -- direct
    // feedback: the barricades needed one like the Foot Soldiers have. Without
    // it a billboard sprite reads as hovering/pasted-on rather than standing on
    // the street, and it was the only street-level entity in the game missing
    // one. Slightly narrower than the prop itself (a barricade's legs don't
    // span its full painted width) and shallow, because it's a thin panel
    // standing across the lane rather than a body with depth.
    // Proportioned against data/enemyTypes.js's footSoldier (1.9 x 0.95 under a
    // 2.3-tall sprite) rather than derived from scratch, since the ask was for
    // one "like the enemy soldiers do". A first pass at 2.41 x 0.8 was measured
    // on screen and came out too faint: the shared shadow texture is a radial
    // gradient, so stretching it wide and shallow spreads its falloff thin and
    // the dark core all but disappears. Narrower and deeper concentrates it.
    shadowWidth: OBSTACLE_WIDTH * 0.85,
    shadowDepth: 0.95,
  },
  // jumpClearHeight = 1.5: same window math as medium above, but against
  // JUMP_HEIGHT=2.4 this holds for a continuous ~0.56s stretch -- ~3x the
  // required window, deliberately more forgiving than medium.
  low: {
    texture: null,
    color: 0x53c26b, // placeholder flat color -- no real art yet
    width: OBSTACLE_WIDTH,
    height: 1.1, // cosmetic only (reads as a low hurdle) -- clearance is airHeight vs jumpClearHeight, not a bounds check
    jumpable: true,
    jumpClearHeight: 1.5,
    // Wider/shallower than medium's in proportion to its own squat shape.
    // Inert while LOW_OBSTACLE_ENABLED is false, but carried so re-enabling
    // 'low' doesn't bring back a shadowless obstacle.
    shadowWidth: OBSTACLE_WIDTH * 0.95,
    shadowDepth: 0.7,
  },
};

export const DEFAULT_OBSTACLE_TYPE = 'medium';

// LOW_OBSTACLE_ENABLED / LOW_OBSTACLE_SPAWN_CHANCE moved to
// data/spawnConfig.js -- the single place for every spawn-frequency knob.
// This file stays the per-type shape/collision data (size, jumpability,
// jumpClearHeight), not spawn pacing.
