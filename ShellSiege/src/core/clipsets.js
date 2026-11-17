// WHICH IDLE, AND WHICH GAIT.
//
// Both are open questions that only look answerable from a file name, so both
// are switched from the URL and every candidate ships. Picking one and
// deleting the rest is a decision for after somebody has watched a turtle
// crouch-walk across a plaza on a board, not before.
//
//   ?idle=a|b          a = Ninja Idle, b = Ninja Idle (1)
//   ?walk=crouch|sneak|mutant|crouched
//
// ONLY `crouch` IS A NATIVE FOUR-WAY SET. The others are single forward clips
// from the same folder, so a set built on one of them BORROWS the crouch set's
// sideways clips. That is stated here rather than left to be discovered from a
// strafe that does not match the walk: when `native4` is false, the forward
// gait is the thing being auditioned and the sideways motion is a stand-in.

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const WALK_SETS = {
  crouch: { f: 'walk_f', b: 'walk_b', l: 'walk_l', r: 'walk_r', native4: true },
  sneak: { f: 'walk_sneak', b: 'walk_backwards', l: 'walk_l', r: 'walk_r', native4: false },
  mutant: { f: 'walk_mutant', b: 'walk_backwards', l: 'walk_l', r: 'walk_r', native4: false },
  crouched: { f: 'walk_crouched', b: 'walk_b', l: 'walk_l', r: 'walk_r', native4: false },
};

export const IDLES = { a: 'idle', b: 'idle2' };

/** The named set, or the default. An unknown name is never a crash. */
export function pickWalkSet(name) {
  return WALK_SETS[name] || WALK_SETS.crouch;
}

export function pickIdle(name) {
  return IDLES[name] || IDLES.a;
}

export const WALK = pickWalkSet(QS.get('walk'));
// `b` by default -- Elad asked to see the second idle instead. `?idle=a` goes
// back to Ninja Idle. The fallback inside pickIdle() stays `a`, so an unknown
// name is still a safe landing rather than a second opinion.
export const IDLE = pickIdle(QS.get('idle') || 'b');

// WHAT A TRIMMED BUILD STANDS IN WITH.
//
// `tools/extract-clips.mjs` ships only the clips the defaults can reach --
// 566 KB instead of 1236 KB, on a file the WebView parses at every launch --
// and emits the rest only with `--all`. So in a shipped build `?walk=sneak`
// names a clip that is not there. Without this map the action comes back
// undefined and that limb simply STOPS MOVING, with nothing logged: a broken
// character that looks like a rendering bug rather than a missing file.
//
// Each audition clip therefore aliases to the shipped clip nearest it in
// role. The switch still works, it just shows the gait that shipped. Note
// that no two slots of any set alias onto the SAME clip -- if they did, the
// layer weights for two directions would be written to one action and fight.
export const CLIP_ALIAS = {
  idle: 'idle2',
  walk_sneak: 'walk_f',
  walk_mutant: 'walk_f',
  walk_crouched: 'walk_f',
  walk_backwards: 'walk_b',
  throw_down: 'throw_slash',
  throw_horiz: 'throw_slash',
};

/** The clips every build must contain, whatever the switches say. */
export function shippedClips() {
  return [...new Set([...clipsOf(WALK_SETS.crouch, IDLES.b), 'throw_slash'])];
}

/** Every clip name a set needs, for checking they all arrived. */
export function clipsOf(set, idle) {
  return [idle, set.f, set.b, set.l, set.r];
}
