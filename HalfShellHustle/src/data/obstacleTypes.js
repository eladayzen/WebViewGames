// Per-obstacle-type visual/collision tuning, data-driven -- matches this
// project's data/enemyTypes.js convention: entities/obstacles.js reads
// everything about a spawned obstacle's look/size/jump-clearance from here.
//
// 'medium' is the original, unchanged barricade -- unjumpable by design
// (its ~2.4-unit height exceeds JUMP_HEIGHT's 2.0-unit peak, so it never
// fit under the jump even now that jump timing is load-bearing for entities/
// platform.js's kill barriers). 'low' is new: a shorter, jumpable hazard --
// real Kolbo art not done yet, so it uses this repo's plain-flat-color
// placeholder convention (entities/platform.js's ramp/kill-barrier/box).
// Still a billboard THREE.Sprite like every other obstacle, unlike
// platform.js's real 3D geometry -- that needed to read from every camera
// angle (a climbable structure); obstacles don't.

import { LANE_WIDTH } from './constants.js';
import { BARRICADE_TEXTURE } from './envArt.js';

const OBSTACLE_WIDTH = LANE_WIDTH * 0.82; // shared lane-fit ratio, both types

export const OBSTACLE_TYPES = {
  medium: {
    texture: BARRICADE_TEXTURE,
    color: null,
    width: OBSTACLE_WIDTH,
    height: OBSTACLE_WIDTH * BARRICADE_TEXTURE.aspect, // ~2.4, unchanged
    jumpable: false,
    jumpClearHeight: Infinity, // never read (jumpable is false), kept for shape-consistency with 'low'
  },
  // jumpClearHeight = 1.5: entities/collision.js's checkObstacleHit fires
  // for a continuous ~0.19s window (2 * OBSTACLE_COLLISION_HALF_Z /
  // FORWARD_SPEED) as this passes the player, and player.airHeight must
  // stay >= this for the whole window. With entities/player.js's rise/hold/
  // fall arc (JUMP_HEIGHT 2.0), airHeight stays >= 1.5 for a continuous
  // ~0.50s stretch spanning the hold -- ~2.7x the required window, so a
  // reasonably-timed jump (not frame-perfect) clears it reliably.
  low: {
    texture: null,
    color: 0x53c26b, // placeholder flat color -- no real art yet
    width: OBSTACLE_WIDTH,
    height: 1.1, // cosmetic only (reads as a low hurdle) -- clearance is airHeight vs jumpClearHeight, not a bounds check
    jumpable: true,
    jumpClearHeight: 1.5,
  },
};

export const DEFAULT_OBSTACLE_TYPE = 'medium';

// Type mix -- a deliberate difficulty knob (a miss ends the run), not just
// "show variety" like data/enemyTypes.js's uniform random pick. Tuning
// starting point, easy to retune.
export const LOW_OBSTACLE_SPAWN_CHANCE = 0.3;
