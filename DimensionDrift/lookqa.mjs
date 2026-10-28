// Canonical look captures — the same frames, every round, for ever.
//
// Judging a re-theme by "ride it and take a screenshot" compares two different
// moments as if they were two different palettes. The world is seeded, so a
// given course offset, run time and rider state reproduce the same terrain, the
// same scatter and the same gates exactly. This pins all of them and shoots a
// fixed set, so that between two rounds the ONLY difference in these images is
// the change under test.
//
//   node lookqa.mjs --tag before
//   node lookqa.mjs --tag after
//
// Adapted from carve's `vista.mjs` in bobo_play, with two changes this repo
// forced. It serves the real `dist/` and launches its own browser rather than
// attaching to a dev server over CDP — one command, nothing to leave running —
// and it drives the TWO-SCREEN lobby (mode, then place) that landed after vista
// was written, where vista clicked a single `start` button.
//
// IT PICKS CHILL VIBE AND THE BOWL, AND THAT IS NOT A PREFERENCE. The race
// draws a random course offset inside the place's band every run (`places.js`),
// so two rounds of a race are two different stretches of mountain and the
// terrain under the palette moves between them. Chill vibe returns
// `place.offset[0]` — 0 m on the bowl — so the ground is the same ground every
// time. The light is the variable here; everything else is held.
//
// The browser is MUTED. It loads the soundtrack and plays it out of whoever's
// speakers are nearby.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, 'dist');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const tag = arg('--tag', 'run');
const SHOTS = path.join(process.env.SHOTS ?? path.join(here, 'shots'), tag);
fs.mkdirSync(SHOTS, { recursive: true });

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary',
  '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
};
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  try {
    const body = await readFile(path.join(DIST, rel));
    res.writeHead(200, { 'content-type': TYPES[path.extname(rel)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The canonical moment. `T` is run seconds — it drives the audio clock and the
// course scheduler. `P_TARGET` is how far down the mountain the shot is taken:
// RIDE TO A DISTANCE, NEVER FOR A DURATION. The trail is laid behind the board
// as it moves, so the ride has to be long enough for the trench to reach the
// camera; but riding for six SECONDS makes the stopping point a function of
// frame rate, and this harness runs on a software rasteriser whose frame time
// moves with whatever else is on the machine. Waiting on distance pins it.
const T = 6.0;
const P_TARGET = 300;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--mute-audio', '--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const errors = [];
let shots = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const shot = async (name) => {
    // Two rAFs, so whatever was just poked has actually been drawn.
    await ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
    shots++;
    console.log('  shot', name);
  };

  await page.setViewport({ width: 1320, height: 800, deviceScaleFactor: 1 });
  await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.state === 'title',
    { timeout: 60000, polling: 100 });
  await page.click('[data-act="start"][data-mode="chill"]');
  await page.waitForSelector('[data-act="place"][data-place="bowl"]', { timeout: 20000 });
  await page.click('[data-act="place"][data-place="bowl"]');
  // THE STANCE SCREEN SITS BETWEEN THE PLACE AND THE COUNTDOWN, and it waits
  // for a human. vista.mjs predates it, which is why a straight port of that
  // script sat on `state === 'play'` for sixty seconds and timed out on a game
  // that was running perfectly — parked on a screen asking which foot leads.
  await page.waitForSelector('[data-act="stance-ok"]', { visible: true, timeout: 20000 });
  await page.click('[data-act="stance-ok"]');
  // Then the countdown, which is three real seconds before the state turns.
  await page.waitForFunction(() => window.CARVE?._game?.state === 'play',
    { timeout: 60000, polling: 100 });

  /**
   * Seek to the canonical moment, plant the rider on the centreline, pin the
   * light, and ride to the mark.
   *
   * Called before EVERY shot, not once at the top. The mood mixer is driven by
   * the run clock, so a six-shot session that seeks once drifts out of the stop
   * it claims to be in and into the next one partway down the list — and the
   * frames then get compared to each other as if they shared a light.
   */
  const canonical = async (mood) => {
    await ev((t) => {
      CARVE.debugSeek(t);
      const g = CARVE._game;
      g.rider.u = 0;
      g.rider.yaw = 0;
      g.rider.vh = 24;
      g.wipeouts = 3;
      g.rider.invuln = 0;
    }, T);
    await ev((m) => CARVE.pinMood(m), mood);
    await ev(() => CARVE.freeCam(null));
    // Let the chunk ring rebuild around the new position, then ride to the mark.
    await sleep(700);
    await page.waitForFunction((p) => CARVE._game.rider.p >= p,
      { timeout: 180000, polling: 50 }, P_TARGET);
    await sleep(120);
  };

  // ── the light, across the arc ──────────────────────────────────────────────
  // The chase view down the valley, at each stop the mixer interpolates
  // between. This is the set a palette is judged on: one frame per mood is the
  // only way to see that a re-theme carried the WHOLE arc rather than looking
  // right at the one hour it was dialled in at.
  const STOPS = [
    ['0-first-light', 0.00],
    ['1-sunrise', 0.18],
    ['2-bluebird', 0.46],
    ['3-squall', 0.68],
    ['4-alpenglow', 0.88],
  ];
  for (const [name, m] of STOPS) {
    await canonical(m);
    await shot(`chase-${name}`);
  }

  // ── the parts a chase frame cannot show ────────────────────────────────────
  // Far: sky gradient, the distant range, how the haze stacks.
  await canonical(0.0);
  await ev(() => {
    const r = CARVE._game.rider;
    const cx = CARVE._game.terrain.centerX(r.z - 300);
    CARVE.freeCam([r.x, r.y + 16, r.z + 14], [cx, r.y + 12, r.z - 320]);
  });
  await shot('far');

  // Near: the ground as a SURFACE and not a gradient — micro-relief, grooming,
  // the carve trench. The camera height is measured off the DRAWN surface and
  // never off `rider.y`: the rider sits in a trench and the piste rolls, so
  // `rider.y + 2.4` puts the lens under the snow and shoots the underside of
  // the mountain, which has been mistaken for a fog bug before.
  await canonical(0.0);
  await ev(() => {
    const r = CARVE._game.rider;
    const gz = r.z + 7.5;
    const gy = CARVE.meshHeight(r.x + 1.2, gz);
    CARVE.freeCam([r.x + 1.2, gy + 2.6, gz], [r.x, r.y + 0.6, r.z - 14]);
  });
  await shot('near');

  // Scatter against the sky, three-quarter lit: silhouettes, and whether the
  // things standing on the mountain sit IN the air or on top of it.
  await canonical(0.46);
  await ev(() => {
    const g = CARVE._game;
    const r = g.rider;
    const wz = r.z - 40;
    const wx = g.terrain.xAt(34, wz);
    const wy = CARVE.meshHeight(wx, wz);
    const cy = CARVE.meshHeight(r.x - 6, r.z + 10);
    CARVE.freeCam([r.x - 6, cy + 7, r.z + 10], [wx, wy + 4, wz]);
  });
  await shot('scatter');

  // ── portrait: the framing that actually ships ──────────────────────────────
  await ev(() => CARVE.freeCam(null));
  await page.setViewport({ width: 412, height: 892, deviceScaleFactor: 1 });
  await sleep(500);
  await canonical(0.46);
  await shot('portrait');

  const probe = await ev(() => CARVE.probe());
  fs.writeFileSync(path.join(SHOTS, 'report.json'),
    JSON.stringify({ tag, errors, rider: probe.rider, camera: probe.camera }, null, 1));
} finally {
  await browser?.close();
  server.close();
}

// A harness that threw before here never printed this line, which is the point.
console.log(`\n  ${shots} shots -> ${SHOTS}`);
if (errors.length) console.log(`  !! ${errors.length} page errors: ${errors.slice(0, 3).join(' | ')}`);
if (shots < 9) { console.log('  HARNESS DID NOT FINISH'); process.exit(2); }
process.exit(errors.length ? 1 : 0);
