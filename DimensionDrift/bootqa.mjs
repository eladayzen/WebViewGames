// Does the game actually RUN?
//
// `vite build` exiting 0 proves the modules parsed. It proves nothing about
// three.js initialising, the rig loading, the track parsing or the title screen
// arriving -- and this port changed every asset URL in the game, which is
// exactly the class of break a green build cannot see. So this serves the real
// `dist/` over real HTTP (never file://; ES modules are blocked there --
// GOBALANCE_SDK.md, "Gotchas") and watches the page reach its title screen.
//
// EXIT CODE IS THE RESULT. Not a grep of the output: a harness that prints
// "FAIL" and exits 0 gets piped into a build gate that passes. And an
// exception is not a failure report -- it is a harness that stopped before it
// checked anything, which looks identical to one that passed. Hence the
// try/finally and the explicit `checked` count at the bottom.
//
// The browser is MUTED. It loads the game's soundtrack and plays it out of
// whoever's speakers are nearby.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, 'dist');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// puppeteer-core is resolved from carve's install rather than duplicated here
// until this game earns its own; see package.json.
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary',
  '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg',
};

const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) fails.push(name);
  return ok;
};

const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  try {
    const body = await readFile(path.join(DIST, rel));
    res.writeHead(200, { 'content-type': TYPES[path.extname(rel)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

let browser;
let checked = 0;
// Raised once the lobby says how many modes there are. Until then it is "the
// nine page checks, plus the mode count, plus at least one mode" -- so a
// harness that dies before it has even read the registry still trips the
// did-not-finish guard rather than reporting a tidy pass over nothing.
let expected = 11;
try {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--mute-audio', '--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader',
      '--window-size=1280,720'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  const missing = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => missing.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });

  await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 30000 });

  // The title screen is the proof: reaching it means the bundle ran, the
  // renderer came up, the rig and the track loaded and the menu built.
  let state = '';
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    state = await page.evaluate(() => document.body.dataset.state ?? '');
    if (state && state !== 'load') break;
    await new Promise((r) => setTimeout(r, 100));
  }

  checked++; check('the page leaves the loading screen', state !== 'load' && state !== '', `state=${state || '(none)'}`);
  checked++; check('it lands on the title screen', state === 'title', `state=${state}`);
  checked++; check('nothing 404s or fails to load', missing.length === 0, missing.slice(0, 6).join(' | '));
  checked++; check('no console errors, no uncaught exceptions', errors.length === 0, errors.slice(0, 4).join(' | '));

  // A canvas that exists but was never drawn into is the quiet failure here:
  // the DOM is fine and the screen is black. Ask the renderer, not the DOM.
  const gl = await page.evaluate(() => {
    const c = document.getElementById('stage');
    if (!c) return { ok: false, why: 'no #stage canvas' };
    return { ok: c.width > 0 && c.height > 0, w: c.width, h: c.height };
  });
  checked++; check('the canvas has real backing pixels', gl.ok, `${gl.w ?? '?'}x${gl.h ?? '?'}${gl.why ? ` ${gl.why}` : ''}`);

  // The SDK's own DOM contract (GOBALANCE_SDK.md). Cheap to assert, and the
  // failure is device-only and silent if it regresses.
  const sdk = await page.evaluate(() => ({
    pump: typeof window.__pumpFrames === 'function',
    overlay: !!document.getElementById('gameover-overlay'),
    restart: !!document.getElementById('restart-button'),
    hidden: document.getElementById('gameover-overlay')?.classList.contains('hidden'),
  }));
  checked++; check('__pumpFrames is installed for the occluded WebView', sdk.pump);
  checked++; check('#gameover-overlay and #restart-button exist', sdk.overlay && sdk.restart);
  checked++; check('the overlay starts hidden, so restart is not auto-clicked', sdk.hidden === true);

  // #gb-back is a REPO convention, not an app lookup -- nothing in
  // Assets/GoBalance/WebGames references the id, and the button works through
  // its own act either way. It is asserted here because the day something
  // drives every web game and asks each one for its way off the board, the game
  // that named its quit button something else is the one that fails, and the
  // failure will look like that game having no exit at all.
  const back = await page.evaluate(() => {
    const b = document.getElementById('gb-back');
    if (!b) return { ok: false };
    const r = b.getBoundingClientRect();
    return { ok: r.width > 0 && r.height > 0, w: Math.round(r.width), h: Math.round(r.height) };
  });
  checked++; check('#gb-back exists and is actually on screen', back.ok, `${back.w ?? 0}x${back.h ?? 0}`);

  await page.screenshot({ path: path.join(here, 'bootqa-title.png') });
  console.log(`\n  screenshot -> bootqa-title.png`);

  // ── EVERY MODE ACTUALLY STARTS ─────────────────────────────────────────────
  //
  // Reaching the title screen is where this harness used to stop, and the title
  // screen is a MENU. It proved the bundle ran and the renderer came up; it
  // proved nothing about the two things behind the two buttons on it.
  //
  // Race mode was broken by the port and shipped that way. `modes/race.js`
  // reset its boost streak with `chain = 0`, naming a variable that had not
  // existed since the streak was split per player -- dead code that carve
  // never noticed, because carve bundles to `format: 'iife'` and sloppy mode
  // turns an assignment to an undeclared name into a harmless global. A module
  // is always strict. Here the same line threw, every race died between the
  // route screen and the countdown, and the only sign was an unhandled
  // rejection in the console while the lobby sat there looking fine.
  //
  // One class of bug, two instances in one evening (see `test/source-parses`),
  // and the same root: this game is a STRICTER host than the one the code grew
  // up in. Neither was visible from the title screen.
  //
  // THE LIST COMES FROM THE LOBBY, not from an array written here. The lobby
  // builds its buttons from the mode registry, so a mode registered tomorrow is
  // covered tomorrow without anyone remembering to extend this -- which is the
  // only kind of coverage that survives.
  const modes = await page.evaluate(() =>
    [...document.querySelectorAll('#modeList button[data-mode]')].map((b) => b.dataset.mode));
  expected = 9 + modes.length;
  console.log(`\n  modes registered: ${modes.join(', ') || '(none)'}`);
  checked++; check('the lobby offers at least one mode', modes.length > 0);

  for (const mode of modes) {
    const tab = await browser.newPage();
    await tab.setViewport({ width: 1280, height: 720 });
    const boom = [];
    tab.on('console', (m) => { if (m.type() === 'error') boom.push(m.text()); });
    tab.on('pageerror', (e) => boom.push(`pageerror: ${e.message}`));
    let why = '';
    try {
      await tab.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 30000 });
      await tab.waitForFunction(() => document.body.dataset.state === 'title',
        { timeout: 30000, polling: 100 });
      await tab.click(`[data-act="start"][data-mode="${mode}"]`);
      // The route screen, then the stance screen -- which waits for a human and
      // is the reason a naive "click start and wait for play" times out on a
      // game that is running perfectly.
      await tab.waitForSelector('[data-act="place"]', { visible: true, timeout: 15000 });
      await tab.click('[data-act="place"]');
      await tab.waitForSelector('[data-act="stance-ok"]', { visible: true, timeout: 15000 });
      await tab.click('[data-act="stance-ok"]');
      // Then a real three-second countdown before the state turns.
      await tab.waitForFunction(() => window.CARVE?._game?.state === 'play',
        { timeout: 30000, polling: 100 });
      // AND STAY there. A mode that throws on its first integrated frame
      // reaches `play` and leaves it again, which a bare state check would call
      // a pass.
      await new Promise((r) => setTimeout(r, 2000));
      const still = await tab.evaluate(() => window.CARVE?._game?.state);
      if (still !== 'play') why = `left play for ${still}`;
      else if (boom.length) why = boom[0].slice(0, 160);
    } catch (err) {
      why = `${err.name}: ${String(err.message).split('\n')[0]}`.slice(0, 160);
      if (boom.length) why = boom[0].slice(0, 160);
    }
    await tab.screenshot({ path: path.join(here, `bootqa-mode-${mode}.png`) }).catch(() => {});
    checked++; check(`mode '${mode}' reaches play and keeps running`, why === '', why);
  }
} finally {
  await browser?.close();
  server.close();
}

// A harness that threw before here never printed this line, which is the point.
console.log(`\n  ${checked} checks run, ${fails.length} failed`);
if (checked < expected) { console.log('  HARNESS DID NOT FINISH'); process.exit(2); }
process.exit(fails.length ? 1 : 0);
