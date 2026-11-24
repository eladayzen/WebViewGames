// Board steering (Elad 2026-11-24): "it's not only sensitivity — currently the actual
// rotation of the board compared to the max angle is giving the final position of the
// player. It should be the same as arrows — right input = right arrow — start pushing
// movement. Continuous force movement."
//
// So the board is now a PUSH, exactly like holding an arrow key: lean right and he
// keeps travelling right around the pipe for as long as you lean, at a speed set by
// how far you lean; stand level and he stays where he is. The old mapping (tilt = a
// position on the ring) is kept as the OLD preset so the two can be compared; its
// values are logged in the backlog (BAL ticket, 2026-11-24).
//
//   dz    dead zone on the host's normalised tilt (0..1 of the board max angle)
//   curve exponent past the dead zone (>1 = gentle near the middle, firm at the edge)
//   rate  rad/s around the pipe at a full lean (the arrow keys are 2.6)
export const STEER_PRESETS = {
  soft:   { label: 'SOFT',   dz: 0.16, curve: 1.7, rate: 1.3 },
  medium: { label: 'MEDIUM', dz: 0.12, curve: 1.5, rate: 1.8 },   // the new default
  firm:   { label: 'FIRM',   dz: 0.09, curve: 1.3, rate: 2.4 },
  // the shipped behaviour up to 2026-11-24: dead zone 0.06, ×1.25 gain, ABSOLUTE
  old:    { label: 'OLD (TILT = SPOT)', dz: 0.06, gain: 1.25, abs: true },
};
export const STEER_ORDER = ['soft', 'medium', 'firm', 'old'];
const KEY = 'sewerShred.steer';

let current = 'medium';
try { const v = localStorage.getItem(KEY); if (v && STEER_PRESETS[v]) current = v; } catch { /* private */ }
try { const q = new URLSearchParams(location.search).get('steer'); if (q && STEER_PRESETS[q]) current = q; } catch { /* no window */ }

export const steerPreset = () => STEER_PRESETS[current];
export const steerKey = () => current;
export function setSteer(k) {
  if (!STEER_PRESETS[k]) return;
  current = k;
  try { localStorage.setItem(KEY, k); } catch { /* private */ }
}
export const nextSteer = () => setSteer(STEER_ORDER[(STEER_ORDER.indexOf(current) + 1) % STEER_ORDER.length]);

/** The board's raw tilt → lean in [-1, 1] under the current preset. */
export function shapeTilt(raw) {
  const p = steerPreset();
  const m = Math.max(0, Math.abs(raw) - p.dz) / (1 - p.dz);
  if (p.abs) return Math.sign(raw) * Math.min(1, m * p.gain);
  return Math.sign(raw) * Math.min(1, Math.pow(m, p.curve));
}
