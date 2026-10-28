// The ratios `mood.js` says its table was SOLVED for, read back off the table.
// Not a test — a measuring stick. A palette change is a change to these numbers,
// and this is the difference between dialling by eye and knowing which of the
// findings in that file you just walked back.
//
//   node moodmetrics.mjs                 the table in this repo
//   node moodmetrics.mjs ../../..../carve/src/mood.js    any other table
//
// three.js `Color(hex)` with colour management on stores LINEAR, which is the
// only space a "7 to 1 luminance ratio" can mean.

import * as THREE from 'three';

const target = process.argv[2]
  ? new URL(process.argv[2], `file://${process.cwd()}/`).href
  : './src/mood.js';
const { MOODS } = await import(target);

const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const hue = (c) => { const h = {}; c.getHSL(h, THREE.SRGBColorSpace); return h.h * 360; };
const hueSep = (a, b) => { const d = Math.abs(hue(a) - hue(b)) % 360; return d > 180 ? 360 - d : d; };
const sat = (c) => { const m = Math.max(c.r, c.g, c.b), n = Math.min(c.r, c.g, c.b); return m <= 0 ? 0 : (m - n) / m; };

// Each row is [label, how it is read, the band mood.js argues for].
const COLS = [
  ['key:fill', 'uSunColor / uSkyColor luminance. Below ~2 the frame has no light direction in it: every surface comes out the same colour whichever way it faces. Solved at ~7.', 2.5, 14],
  ['fog/horiz', 'uFogColor / uHorizon luminance. Below ~0.7 the far range stops being distance and becomes a dark wall hung across the valley. Measured target 0.86.', 0.68, 1.15],
  ['z->h stops', 'log2(uHorizon / uZenith). The reference sky spans 1.09 stops. Past ~1.8 a third of the frame is a near-black void that bands on its way down.', 0.4, 1.9],
  ['ground S', 'Saturation of uSnowColor. The colour of the ground belongs in the LIGHT, not the albedo: bake it in and it survives at every brightness, so highlights and shadows share a hue.', 0, 0.30],
  ['rock:grnd', 'uRockColor / uSnowColor luminance. Too close and the rock reads as dark ground rather than as another material.', 0.01, 0.35],
  // MEASURED OFF CARVE, 2026-10-28, after a first Dimension X pass came back as
  // five flat monochromes. Luminance ratio alone does not buy a lit frame: a key
  // 7x the fill but the SAME HUE paints the lit faces and the shadowed faces the
  // same colour, just at two brightnesses, and the terrain loses its form.
  // Carve's three stops that read — sunrise, bluebird, alpenglow — sit at 169,
  // 176 and 131 degrees of separation: a warm key against a cold fill, every
  // time. Its two that do not are first light (4) and squall (0), and first
  // light is the one its own comments describe as having no light direction in
  // it. The fill is what the SHADOWS are, so this is the number that decides
  // whether a slope has shape in it.
  ['key/fill H', 'Hue separation in degrees between uSunColor and uSkyColor. Under ~100 the lit and shadowed faces share a hue and the frame flattens into one colour at two brightnesses. Carve\'s readable stops: 131-176.', 100, 180],
];

console.log('stop'.padEnd(13) + COLS.map(([h]) => h.padStart(12)).join(''));
const bad = [];
for (const m of MOODS) {
  const v = [
    lum(m.uSunColor) / lum(m.uSkyColor),
    lum(m.uFogColor) / lum(m.uHorizon),
    Math.log2(Math.max(1e-6, lum(m.uHorizon)) / Math.max(1e-6, lum(m.uZenith))),
    sat(m.uSnowColor),
    lum(m.uRockColor) / lum(m.uSnowColor),
    hueSep(m.uSunColor, m.uSkyColor),
  ];
  const cells = v.map((x, i) => {
    const [, , lo, hi] = COLS[i];
    const out = x < lo || x > hi;
    if (out) bad.push(`${m.label}: ${COLS[i][0]} = ${x.toFixed(2)} (want ${lo}..${hi})`);
    return `${x.toFixed(2)}${out ? '!' : ' '}`.padStart(12);
  });
  console.log(m.label.padEnd(13) + cells.join(''));
}
if (bad.length) {
  console.log('\nOUTSIDE THE BAND:');
  for (const b of bad) console.log('  ' + b);
  console.log('\nWhy each band exists:');
  for (const [h, why] of COLS) console.log(`  ${h}: ${why}`);
}
process.exit(bad.length ? 1 : 0);
