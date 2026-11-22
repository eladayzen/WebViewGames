// THE WORLD: a bounded plaza, a player on it, and a camera that follows.
//
// Ported from TMNT Survivor with the model kept and the renderer thrown away.
// What survives is deliberate: the arena is still a flat plane in x/y measured
// in sim pixels, so every tuned number in combat and pace means what it meant
// before. What changed is the SIZE.
//
// WHY THE ARENA SHRANK, 7680x4320 -> 3600x3600.
// Survivor's arena was four design-screens by four, which suited a top-down
// camera that showed a lot of ground. This camera is pitched over at 50
// degrees and sees about 19 units across -- roughly half of that -- and a
// plaza you need ten seconds to cross stops reading as a room and starts
// reading as a field. The reference footage is an arena: a place with corners
// you can be driven into, which is the only pressure the genre has. Square,
// because the dais is in the middle and a rectangle would put the player
// closer to two walls than the other two for no reason.
//
// It is also what the floor art can carry. One hand-painted 2048px plaza
// spread over 36 units is 57 texels per unit; spread over Survivor's arena it
// would be 27, and the stone would read as mush under a camera this close.

import { createBuild, ABILITIES } from './abilities.js';

// ?kit=max starts the run with EVERY ability at its cap, to see them all working at once.
const kitParam = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('kit') : null);
const kitMax = () => kitParam() === 'max' || kitParam() === 'allies';
// ?kit=allies is ONLY the turtle allies -- no stat upgrades -- to judge them on their own.
const maxBuild = () => {
  const b = createBuild();
  for (const k of Object.keys(ABILITIES)) if (kitParam() === 'allies') { if (ABILITIES[k].kind === 'temp') b[k] = 1; }       // base level: judge the timers as a new player sees them
    else b[k] = ABILITIES[k].max;
  return b;
};
import { resolveCircle } from './obstacles.js';

export const ARENA = { width: 3600, height: 3600 };

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

/** Unchanged from Survivor: the body's footprint, not the drawing's. */
export const PLAYER_RADIUS = 42;

// Read off the URL here rather than imported from core/foes.js, which imports
// ARENA from this file -- a cycle that bites at module-init time, not at call
// time, so it would have surfaced as an undefined constant rather than an error.
const PLAYER_HP_DEFAULT = (() => {
  const qs = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const v = Number(qs.get('php'));
  return Number.isFinite(v) && qs.get('php') !== null ? v : 100;
})();

export function createWorld() {
  return {
    // `facing` is the direction of TRAVEL. Where the body points is a
    // separate angle -- `bodyFacing` below -- because the two are no longer
    // the same thing; see core/facing.js.
    player: { x: ARENA.width / 2, y: ARENA.height / 2, facing: 0 },
    // Where the body points: at whatever he is shooting at, eased. Owned by
    // the frame loop rather than by updateWorld, because it depends on the
    // targeting and updateWorld must stay a pure walk.
    bodyFacing: 0,
    playerRadius: PLAYER_RADIUS,
    camera: { x: ARENA.width / 2, y: ARENA.height / 2 },
    timeS: 0,
    distanceWalked: 0,

    // WHAT THERE IS TO SHOOT -- crates and Foot Clan in ONE array, because
    // the whole combat system takes "anything with a position, a radius and
    // hp" and neither it nor the aiming needs to know which is which.
    targets: [],
    // WHAT YOU CANNOT WALK THROUGH in this room (core/obstacles.js), set by the
    // frame loop when a room begins. Empty means an open floor.
    obstacles: [],
    // THINGS THE ENEMIES HAVE THROWN, in flight (core/foes.js). The player's own
    // blades are in `bullets`; these are kept apart because they hurt HIM.
    foeShots: [],
    // References to the SAME objects as the foes in `targets`, never copies.
    // core/foes.js explains why that is the cheap way to have two views.
    foes: [],
    spawnT: 0,
    bullets: [],
    fireT: 0,

    // THE PLAYER CAN NOW LOSE, which is the only reason an enemy means
    // anything. `hurtT` is a flinch window for the renderer to read.
    // THE BUILD, and the progress toward the next pick. `speedMul` is written
    // by the frame loop from stats(build) -- updateWorld already multiplies
    // by it, so SWIFT needed no change in here at all.
    build: kitMax() ? maxBuild() : createBuild(),
    level: 1,
    xp: 0,
    speedMul: 1,

    hp: PLAYER_HP_DEFAULT,
    maxHp: PLAYER_HP_DEFAULT,
    hurtT: 0,
    allies: [], pizzas: [],
    knock: { vx: 0, vy: 0, t: 0 },     // a shove in progress, see KNOCK_S and core/foes.js hurtPlayer
    dead: false,
    diedAtS: -Infinity,

    // WHERE THE SHOT LEAVES FROM, in sim px, or null when nothing has said.
    // Survivor measured this off the sprite's barrel every frame; here it is
    // a point on the rig, and the renderer still owns it for the same reason:
    // it moves with the body, and the sim cannot know where the body is.
    muzzle: null,
    lastFireS: -Infinity,
  };
}

/**
 * Move the player along a WORLD-SPACE direction, then put the camera on them.
 *
 * The direction has already been rotated out of screen space by core/axes.js.
 * This function never learns which way the camera is pointing, which is what
 * keeps it testable and what kept it portable.
 */
/** How long a shove lasts. Short: it is a punch of motion, not a slide. */
export const KNOCK_S = 0.22;

export function updateWorld(w, dir, dt) {
  const p = w.player;
  const before = { x: p.x, y: p.y };

  const speed = speedGetter() * (w.speedMul || 1);
  p.x += dir.x * speed * dt;
  p.y += dir.y * speed * dt;

  // A SHOVE ADDS TO WALKING, it does not replace it, so the player can still lean
  // against it. Speed falls linearly to zero over KNOCK_S, so the total distance
  // is exactly the attack's `push` value (v0 = 2 * push / KNOCK_S).
  const k = w.knock;
  if (k && k.t > 0) {
    const step = Math.min(dt, k.t);
    const f = (k.t - step / 2) / KNOCK_S;      // mean of the falling speed over this step
    p.x += k.vx * f * step;
    p.y += k.vy * f * step;
    k.t -= step;
  }

  // Bounded, with the body's own radius held off the wall so he stops at it
  // rather than sinking half into it.
  const r = w.playerRadius;
  p.x = Math.max(r, Math.min(ARENA.width - r, p.x));
  p.y = Math.max(r, Math.min(ARENA.height - r, p.y));
  // AFTER the wall clamp, then the wall again: being pushed out of a pillar must
  // not push him out of the arena, and being clamped must not leave him in one.
  if (w.obstacles && w.obstacles.length) {
    resolveCircle(p, r, w.obstacles);
    p.x = Math.max(r, Math.min(ARENA.width - r, p.x));
    p.y = Math.max(r, Math.min(ARENA.height - r, p.y));
  }

  // FACING FOLLOWS TRAVEL, and only while travelling -- recomputing it from a
  // zero vector snaps him to face right every time the player stops, which
  // reads as a twitch rather than as standing still.
  const dx = p.x - before.x;
  const dy = p.y - before.y;
  if (dx !== 0 || dy !== 0) {
    p.facing = Math.atan2(dy, dx);
    w.distanceWalked += Math.hypot(dx, dy);
  }

  w.camera.x = p.x;
  w.camera.y = p.y;
  w.timeS += dt;
  if (w.hurtT > 0) w.hurtT = Math.max(0, w.hurtT - dt);
  return w;
}

// Read through a function so a URL override applies without this module
// importing the input layer at load time and freezing its value.
let speedGetter = () => 520;
export function __setSpeedSource(fn) { speedGetter = fn; }
