// Centerline spline (§5.1, §9.1) -- same technique proven in this repo's
// Astro_Tunnel/src/tunnel.js `tunnelCenterAt(z)`: a gentle sine-based bend,
// deliberately zero at z=0 (PLAYER_Z) so Raphael's own fixed-radius circle
// around the world origin always lines up with the tunnel's local center
// exactly, no special-casing needed at his fixed plane. The camera stays
// near this same z=0 plane (same trick Astro_Tunnel uses -- the world
// scrolls toward a near-stationary camera rather than the camera literally
// translating down an ever-growing spline), so this same bend is what gives
// the cosmetic banking/curve "for free" once features at other z values
// pick up a different centerline offset than the player's.
//
// POC calls straight geometry only (§2) -- BEND_* are gated off entirely
// during the POC milestone by main.js not yet ramping past section 0's
// straight intro stretch; see main.js for how the first stretch stays calm.

const BEND_X1 = 1.3;
const BEND_X1_FREQ = 0.05;
const BEND_X2 = 0.7;
const BEND_X2_FREQ = 0.02;
const BEND_Y1 = 0.6;
const BEND_Y1_FREQ = 0.035;

export function tunnelCenterAt(z) {
  const x = Math.sin(z * BEND_X1_FREQ) * BEND_X1 + Math.sin(z * BEND_X2_FREQ) * BEND_X2;
  const y = Math.sin(z * BEND_Y1_FREQ) * BEND_Y1;
  return { x, y };
}
