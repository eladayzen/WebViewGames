// Elevated "platform stretch" system (direct feedback: "this game won't be
// interesting until we have this element of height" -- a Subway-Surfers-
// style raised train-top/rooftop section joined to the street by ramps). A
// single flat list of values, matching data/introSequence.js's convention
// -- edit directly, core/main.js and entities/platform.js just read them.
//
// v1 scope, explicitly agreed after planning: ONE GLOBAL elevation state
// shared by the player and whatever obstacle/enemy is at that z -- not true
// independent per-lane elevation (that would require forking street/
// building rendering per lane, a much bigger job) and no fall-risk gap yet.
// Placeholder flat-colored geometry for now, matching this project's own
// "placeholder-first" convention (build doc §2) -- real illustrated deck/
// ramp art is a natural follow-up once the mechanic itself feels right.

export const PLATFORM_ENABLED = true;

// World units the deck sits above the street.
export const PLATFORM_HEIGHT = 3.5;

// Ramp length (world units), used for BOTH the up-ramp (ramp-type entries
// only) and the down-ramp (every stretch, regardless of entry type) -- how
// much travel distance the rise/fall is spread across, not an instant snap.
export const PLATFORM_RAMP_LENGTH = 10;

// Flat elevated deck length -- direct feedback: "longer stretch (~5-8s),
// its own mini-pacing", landed on the middle of that range.
export const PLATFORM_DECK_LENGTH = 104; // ~6.5s at FORWARD_SPEED=16

// Spawn pacing -- own timer, like the obstacle/enemy spawners
// (systems/spawner.js). First stretch waits until the intro wall/obstacle
// ramp-in (data/introSequence.js) has already settled.
export const PLATFORM_FIRST_DELAY_SEC = 14;
export const PLATFORM_INTERVAL_SEC = 22;

// Entry-type mix -- direct feedback: "we need a switch" for this
// specifically, since the lean-board's jump is harder to control than a
// swipe and should stay a rare spice, not the main way up. Off falls back
// to every stretch using an automatic full-width ramp.
export const PLATFORM_JUMP_ENTRY_ENABLED = true;
export const PLATFORM_JUMP_ENTRY_CHANCE = 0.25; // fraction of stretches using a jump-trigger instead of a ramp

// Jump-trigger entries: how far the player's OWN rise is spread once they
// press jump within the entry window (their personal "hop up onto the
// platform" arc) -- independent of PLATFORM_RAMP_LENGTH, which is the
// physical ramp geometry a ramp-type ENTRY uses (a jump-type entry has no
// physical up-ramp at all, just a gap, see entities/platform.js).
export const PLATFORM_JUMP_RISE_LENGTH = 6;
