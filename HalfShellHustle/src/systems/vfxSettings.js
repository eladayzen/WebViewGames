// VFX on/off toggle -- persisted, same ownership split as systems/audio.js
// (this file owns the enabled state; callers in core/main.js and ui/hud.js
// just check it before spawning). Gates the DECORATIVE particle/celebration
// effects: foot-contact dust, enemy kill poof, coin sparkle, speed streaks,
// the points-counter burst, and level-complete confetti. Deliberately does
// NOT gate the red damage flash or camera shake -- those are core damage
// feedback (telling the player they got hit), not flourish, and turning
// them off would make getting hit read as nothing happened.

const STORAGE_KEY = 'hsh:vfx';

const state = { vfxEnabled: true };

// localStorage can throw outright in a restricted WebView (private mode,
// storage disabled) -- a display preference must never take the game down
// with it, so both directions are guarded and fall back to the default.
function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.vfxEnabled === 'boolean') state.vfxEnabled = saved.vfxEnabled;
  } catch {
    // Keep the default.
  }
}
function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal: the preference just won't survive a reload.
  }
}
load();

export function getVfxEnabled() { return state.vfxEnabled; }
export function setVfxEnabled(on) {
  state.vfxEnabled = on;
  save();
}
