// THE WORLD, AND WHERE THE CAMERA IS LOOKING.
//
// This is the whole of prototype 1's model: a position in a world larger than
// the screen, and a camera that keeps it centred. No enemies, no firing, no
// art, deliberately -- see BAL-632. If walking around does not feel good on a
// real board, nothing built on top of it will, and that is cheaper to find out
// now than after the loop exists.
//
// THE WORLD IS BOUNDED, not endless. A survivor level is a space you can be
// cornered in; an infinite plane is a space you can run away across forever,
// which removes the only pressure the genre has. The size below is a guess and
// is meant to be argued with once someone has walked it.

export const WORLD = {
  // Four screens by four screens, at the design size every game here uses.
  width: 1920 * 4,
  height: 1080 * 4,
};

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

export const PLAYER_RADIUS = 42;

export function createWorld() {
  return {
    player: { x: WORLD.width / 2, y: WORLD.height / 2, facing: 0 },
    playerRadius: PLAYER_RADIUS,
    camera: { x: WORLD.width / 2, y: WORLD.height / 2 },
    distanceWalked: 0,
    timeS: 0,

    // --- the run ----------------------------------------------------------
    enemies: [],
    bullets: [],
    gems: [],
    // Dropped hearts. A separate list from gems because they behave
    // differently on purpose -- see systems/horde.js.
    hearts: [],
    fireT: 0,
    orbitPhase: 0,
    kills: 0,
    contact: false,

    // --- staying alive ----------------------------------------------------
    lives: 0,          // filled from SURVIVAL.maxLives at boot
    // INVULNERABILITY AFTER A HIT, and it is not generosity. Enemies converge,
    // so the frame you are touched you are usually touching three of them --
    // without a window, one mistake is the whole run, and the player never
    // finds out what they did wrong. A second is long enough to walk out of
    // the pile.
    invulnS: 0,
    dead: false,

    // --- the loop ---------------------------------------------------------
    // XP is a count of gems, not of points. Score and XP being the same
    // number is a rule Bloop Squad learned the hard way, but a horde game has
    // no score yet -- when it gets one, they should be the same number there
    // too, awarded by one function so they cannot drift apart.
    xp: 0,
    level: 1,
    choice: null,       // non-null means the run is paused on a level-up
  };
}

/**
 * Move the player, then put the camera on them.
 *
 * SINGLE PLAYER PUTS THE CAMERA ON THE PLAYER, FULL STOP. The centroid rule
 * and the frame edge in the PRD exist only when a second board is connected;
 * with one player there is nothing to frame but them, and no wall.
 *
 * The input is a direction, not a velocity: `speedPxS` is the same whether the
 * player is leaning slightly or hard over, scaled by how far they lean. That
 * is how every other game here reads the board, and it is why the deadzone
 * matters so much -- below it the player is simply not moving.
 */
export function updateWorld(w, input, dt) {
  const p = w.player;
  const before = { x: p.x, y: p.y };

  const speed = TUNING_SPEED() * (w.speedMul || 1);
  p.x += input.x * speed * dt;
  p.y += input.y * speed * dt;

  // Bounded. Walking into the edge stops you rather than scrolling nothing.
  p.x = Math.max(0, Math.min(WORLD.width, p.x));
  p.y = Math.max(0, Math.min(WORLD.height, p.y));

  // FACING FOLLOWS TRAVEL, and only while actually travelling. Recomputing it
  // from a zero vector would snap the character to face right every time the
  // player stops, which reads as a twitch rather than as standing still.
  const dx = p.x - before.x;
  const dy = p.y - before.y;
  if (dx !== 0 || dy !== 0) {
    p.facing = Math.atan2(dy, dx);
    w.distanceWalked += Math.hypot(dx, dy);
  }

  w.camera.x = p.x;
  w.camera.y = p.y;
  w.timeS += dt;
  return w;
}

// Read through a function so a URL override applies without this module
// importing the input layer's tuning at load time and freezing it.
let speedGetter = () => 520;
export function __setSpeedSource(fn) { speedGetter = fn; }
function TUNING_SPEED() { return speedGetter(); }
