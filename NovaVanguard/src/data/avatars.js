// Leaderboard identity, WITHOUT mirroring the app's avatar art.
//
// WHAT THIS REPLACED, AND WHY. The scoreboard entries carry `avatarType` and
// `avatarIndex`, but the art itself lives in the Unity project and the page can
// only load files served from this game's own folder -- there is no
// /__gobalance/avatar/<type>.png. The first version therefore copied 16 PNGs
// (636 KB) into the game and generated a name->file table from the app's
// `Avatars List.asset`.
//
// That was the wrong trade and it was rejected: every web game would need its
// own copy, and every copy goes stale the moment the app adds, removes or
// redraws an avatar -- silently, since a missing type just falls back.
//
// So identity is now DERIVED, not fetched: the player's initial on a colour
// that is stable for that profile. No assets, nothing to keep in sync, and a
// row is still recognisable at a glance on a shared device -- which is the job.
//
// IF THE HOST EVER SERVES AVATARS, this is the one place to change: return a
// src alongside the colour and /ui/hud.js will draw it.

// A small fixed wheel rather than a generated hue: these are read at a glance,
// side by side, on a dark card. Hand-picked values stay distinguishable from
// each other and from the player's own cyan-white; evenly spaced hues do not.
const WHEEL = [
  '#fee44f', '#36c09e', '#ee5d2c', '#8ab4ff',
  '#f48dd4', '#9be564', '#ffa14a', '#7fd7ff',
];

/**
 * Stable colour for a profile.
 *
 * Prefers `avatarIndex`, because the app already assigns it per profile and it
 * is what makes two siblings look different in the app's own UI -- so the
 * board agrees with the lobby without sharing any art. Falls back to a hash of
 * `profileId` so a row is never uncoloured, and `profileId` rather than `name`
 * because two profiles on one account can share a name.
 */
export function identityFor(entry) {
  if (!entry) return { color: WHEEL[0], initial: '?' };
  let i = entry.avatarIndex;
  if (typeof i !== 'number' || !isFinite(i) || i < 0) {
    const key = String(entry.profileId || entry.name || '');
    i = 0;
    for (let k = 0; k < key.length; k++) i = (i * 31 + key.charCodeAt(k)) >>> 0;
  }
  const name = String(entry.name || '').trim();
  return {
    color: WHEEL[i % WHEEL.length],
    initial: (name.charAt(0) || '?').toUpperCase(),
  };
}
