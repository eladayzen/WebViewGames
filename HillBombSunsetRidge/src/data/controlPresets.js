// Two distinct control feels, switchable live from the lab.
//
// Amit rode both tunings back to back and liked different things about each:
// the current one is "really fun when I'm in the center", the previous one
// "made sense when I'm reaching the sides". Rather than average them into
// something that's neither, both ship and you pick.
//
// The values are the literal before/after of the phase-1 retune, not
// reconstructions.

export const CONTROL_PRESETS = {
  // Post-retune. Carve is a strong torque and the trough's geometry is the only
  // brake, so full lean reaches the lip and dropping back in pumps you fast.
  // Lively in the middle; you arrive at the wall with real energy.
  loose: {
    label: 'Loose — fast, reaches the lip',
    carveTorque: 1.7,
    damp: 0.9,
    heightExchange: 18.0,
    carveScrub: 0.10,
  },

  // Pre-retune. A heavier board: weaker carve torque, more damping, and a real
  // lateral scrub so turning itself costs speed. Full lean settles part-way up
  // the wall instead of slamming the lip, which is why the sides felt more
  // sensible -- you never reach the hard limit, so you never hit it.
  planted: {
    label: 'Planted — heavier, settles mid-wall',
    carveTorque: 1.15,
    damp: 1.35,
    heightExchange: 7.5,
    carveScrub: 0.85,
  },
};

// Mutable active set. main.js reads through this every frame, so switching
// preset takes effect immediately mid-run without a restart.
export const CONTROLS = { ...CONTROL_PRESETS.loose, key: 'loose' };

export function setControlPreset(key) {
  const preset = CONTROL_PRESETS[key];
  if (!preset) return;
  Object.assign(CONTROLS, preset, { key });
}
