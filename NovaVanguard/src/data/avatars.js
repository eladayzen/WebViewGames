// Profile avatars, mirrored from the GoBalance app (playtest round 13).
//
// WHY THESE ARE COPIES. The scoreboard entries carry `avatarType` (a name like
// "astronaut") and `avatarIndex`, but the art itself lives in the Unity
// project's own sprite folder -- and the page can only load files the host
// serves out of THIS game's folder. There is no /__gobalance/avatar/<type>.png
// endpoint, so the images have to be here.
//
// THE COST, stated plainly: these are duplicates. If the app ever adds, removes
// or redraws an avatar, this folder is stale until someone re-runs the copy,
// and every other web game that wants avatars needs its own copy too. The right
// long-term fix is for the host to serve them the way it already serves the SDK
// -- worth raising with the app team rather than solving five times.
//
// GENERATED, NOT HAND-WRITTEN. Resolved from the app's own
// `Avatars List.asset` by walking each entry's sprite GUID to the .meta that
// declares it. The colours are the avatar's own authored colour from that same
// asset, used as the ring behind the image so a row still reads at a glance if
// the art ever fails to load.

export const AVATARS = {
  astronaut: { src: 'assets/avatars/astronaut.png', color: '#fee44f' },
  skateboard: { src: 'assets/avatars/skateboard.png', color: '#36c09e' },
  drums: { src: 'assets/avatars/drums.png', color: '#ee5d2c' },
  chess: { src: 'assets/avatars/chess.png', color: '#b8beba' },
  toothbrush: { src: 'assets/avatars/toothbrush.png', color: '#0191f1' },
  tape: { src: 'assets/avatars/tape.png', color: '#f48dd4' },
  aligator: { src: 'assets/avatars/aligator.png', color: '#b6f8a2' },
  fries: { src: 'assets/avatars/fries.png', color: '#d5aa32' },
  sandals: { src: 'assets/avatars/sandals.png', color: '#87dbe6' },
  cactus: { src: 'assets/avatars/cactus.png', color: '#e85850' },
  floatie: { src: 'assets/avatars/floatie.png', color: '#f8afba' },
  sports: { src: 'assets/avatars/sports.png', color: '#0569dd' },
  rocket: { src: 'assets/avatars/rocket.png', color: '#bfc6bf' },
  icecream: { src: 'assets/avatars/icecream.png', color: '#e6aa30' },
  bicycle: { src: 'assets/avatars/bicycle.png', color: '#ebbfbe' },
  guitar: { src: 'assets/avatars/guitar.png', color: '#3d74cd' },
};

/** Art + colour for a scoreboard entry, or null if the type is unknown. An
 *  unknown type is not an error: the app can add an avatar at any time and this
 *  copy will not know about it until someone re-runs the mirror. */
export function avatarFor(type) {
  return (type && AVATARS[type]) || null;
}
