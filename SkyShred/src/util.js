export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const easeOutBack = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const easeInOut = (t) => t * t * (3 - 2 * t);

/** Every saturated red pixel -> the same lightness and saturation, purple hue (makes Raphael into Donatello).
 *  Recipe from TmntRooftopRun/src/render/turtle.js. */
export function recolorRedToPurple(image) {
  const PURPLE_HUE = 272 / 360;
  const c = document.createElement('canvas');
  c.width = image.width; c.height = image.height;
  const g = c.getContext('2d');
  g.drawImage(image, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i] / 255, gg = a[i + 1] / 255, b = a[i + 2] / 255;
    const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
    if (max !== r) continue;
    const l = (max + min) / 2, dd = max - min;
    if (dd < 0.18) continue;
    const s = dd / (1 - Math.abs(2 * l - 1));
    let h = ((gg - b) / dd) / 6; if (h < 0) h += 1;
    if (!(h > 0.93 || h < 0.04) || s < 0.4) continue;
    const L = Math.min(0.85, l * 1.08), S = Math.min(1, s * 0.85);
    const q = L < 0.5 ? L * (1 + S) : L + S - L * S, pp = 2 * L - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
    a[i] = f(PURPLE_HUE + 1 / 3) * 255; a[i + 1] = f(PURPLE_HUE) * 255; a[i + 2] = f(PURPLE_HUE - 1 / 3) * 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}
