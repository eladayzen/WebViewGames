// SHARDS QA — the four claims made for the holographic level, measured.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, 'dist');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const SHOTS = path.join(process.env.SHOTS ?? path.join(here, 'shots'), 'shards');
fs.mkdirSync(SHOTS, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary',
  '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
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

let pass = 0; let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${name}${detail ? `  ${detail}` : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--mute-audio', '--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  await page.setViewport({ width: 1320, height: 800, deviceScaleFactor: 1 });
  await page.goto(`${base}/index.html?all=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.state === 'title', { timeout: 60000, polling: 100 });
  await page.click('[data-act="start"][data-mode="shoulder"]');
  await page.waitForSelector('[data-act="place"][data-place="needles"]', { timeout: 20000 });
  await page.click('[data-act="place"][data-place="needles"]');
  await page.waitForSelector('[data-act="stance-ok"]', { visible: true, timeout: 20000 });
  await page.click('[data-act="stance-ok"]');
  await page.waitForFunction(() => window.CARVE?._game?.state === 'play', { timeout: 60000, polling: 100 });

  // ── 1. the level is the one we think it is ──────────────────────────────
  const world = await ev(() => {
    const g = CARVE._game;
    return { place: g._place?.id, style: g.mountain?.style, gatesOn: g.course?.gatesOn,
      marksOn: g.course?.marksOn, scatterSolid: g.scatter?.solid,
      scatterVisible: g.scatter?.trees?.mesh?.visible, boons: CARVE.probe().boons };
  });
  check('the shards level is loaded', world.place === 'needles', world.place);
  check('its ground is the hologram', world.style === 'holo', world.style);

  // ── 2. nothing invisible can hit me ─────────────────────────────────────
  check('the forest is not drawn', world.scatterVisible === false);
  check('and it is not solid either', world.scatterSolid === false);
  const ghost = await ev(() => {
    // Walk the live colliders and stand exactly on one. If the forest were
    // still solid this is a guaranteed crash; it must answer null.
    const sc = CARVE._game.scatter;
    let c = null;
    for (const list of sc.colliders) { if (list && list.length) { c = list[0]; break; } }
    if (!c) return { tested: false };
    return { tested: true, hit: sc.hitTest(c.x, c.z) !== null, r: c.r };
  });
  check('a collider exists to stand on (so this is not vacuous)', ghost.tested === true);
  check('standing dead centre of one reports no hit', ghost.tested && ghost.hit === false);

  // ── 3. there is something to aim for ────────────────────────────────────
  check('the gates are drawn on this level', world.gatesOn === true);
  check('the painted floor marks still are not', world.marksOn === false);
  const placed = await ev(() => {
    const c = CARVE._game.course;
    const live = (c.gates ?? []).filter((g) => g.active);
    return { live: live.length, visible: live.filter((g) => g.poles[0].visible).length,
      sigils: live.filter((g) => g.sigil.visible).length };
  });
  check('gates are actually standing on the hill', placed.live > 0, `${placed.live} active`);
  check('and they are visible', placed.visible === placed.live, `${placed.visible}/${placed.live}`);
  check('the boons are on in this mode', world.boons.enabled === true);
  check('boons are standing in the air', world.boons.standing > 0, `${world.boons.standing} up`);

  // ── 4. a rider who steers at them takes them ────────────────────────────
  //
  // STEERED, NOT RIDDEN PAST. A first pass let the rider fall straight down
  // the line and took 1 boon in 1607 m, which is the mode working rather than
  // a fault: a boon has a 2.5 m grab radius and is scattered across 40 m of
  // reward band, so it is a DETOUR by construction, where a gate is a line you
  // are already riding. Asserting on a passive ride would be asserting on luck.
  //
  // The controller is skirmishqa's PD, aimed at the nearest boon ahead instead
  // of at a drone. Error clamped before the gain, damping on how fast `u` is
  // already moving; a proportional controller saturates and oscillates.
  //
  // THE SIGN IS PROBED ON A PLANTED RIDER, which is combatqa's own correction
  // and it had to be made here too. Probing on a rider already drifting across
  // a banked course reads the DRIFT rather than the lean -- and a probe that
  // comes back inverted makes the whole phase steer away from everything it is
  // aiming at. Measured: with the sign wrong this phase collected 0 boons in
  // 1600 m while the identical controller with no sign at all collected one.
  const sign = await (async () => {
    await ev(() => {
      const g = CARVE._game;
      g.rider.x = g.terrain.centerX(g.rider.z);
      g.rider.yaw = 0;
    });
    await sleep(300);
    const u0 = await ev(() => CARVE._game.rider.u);
    await ev(() => CARVE.lean(0.45, 0));
    await sleep(900);
    const u1 = await ev(() => CARVE._game.rider.u);
    await ev(() => CARVE.lean(0, 0));
    await sleep(500);
    return u1 - u0 >= 0 ? 1 : -1;
  })();
  console.log(`  lean sign ${sign}`);

  const start = await ev(() => CARVE._game.rider.p);
  let taken = 0; let kinds = {}; let passed = 0;
  const until = Date.now() + 150000;
  while (true) {
    const s = await ev((sgn) => {
      const g = CARVE._game;
      // The nearest boon still ahead of the rider, in its own band ring.
      let best = null;
      for (const b of g.boons.boons) {
        if (!b || b.taken) continue;
        const dp = b.p - g.rider.p;
        if (dp < 2 || dp > 260) continue;
        if (!best || dp < best.p - g.rider.p) best = b;
      }
      const aim = best ? best.u : 0;
      const err = Math.max(-12, Math.min(12, aim - g.rider.u));
      const du = g.rider.u - (window.__lastU ?? g.rider.u);
      window.__lastU = g.rider.u;
      CARVE.lean(Math.max(-0.42, Math.min(0.42, (err * 0.030 - du * 0.55) * sgn)), 0);
      const p = CARVE.probe();
      return { p: g.rider.p, state: g.state, boons: p.boons, aiming: !!best };
    }, sign);
    taken = Math.max(taken, s.boons.taken);
    kinds = s.boons.byKind;
    if (s.state !== 'play') break;
    if (s.p - start >= 1600) break;
    if (Date.now() > until) break;
    await sleep(50);
  }
  await ev(() => CARVE.lean(0, 0));
  await page.screenshot({ path: path.join(SHOTS, 'shards.png') });
  const m = Math.round((await ev(() => CARVE._game.rider.p)) - start);
  passed = Math.round(m / 260);
  console.log(`\n  ${m} m ridden on the shards, steering at the boons`);
  console.log(`  boons taken ${taken} of about ${passed} passed  ${JSON.stringify(kinds)}\n`);
  check('a rider who steers at a boon takes it', taken > 0, `${taken} taken`);
  check('and takes most of the ones they pass', taken >= Math.max(1, passed * 0.5),
    `${taken}/${passed}`);
  check('more than one kind turns up over a long ride',
    Object.keys(kinds).length >= 2, Object.keys(kinds).join(',') || 'none');

  // ── 5. the barrier, granted directly ────────────────────────────────────
  //
  // GRANTED RATHER THAN ROLLED FOR. A barrier is 3 of 8 in the pool, so a
  // phase that waited for one to turn up would be a phase that passes or fails
  // on a dice roll -- and the thing worth proving is the MECHANIC, not the
  // drop table. The drop table is phase 4's business.
  const shield = await ev(() => {
    const g = CARVE._game;
    g.roster.fighters[0].hp = 60;
    g._takeGift(0, { power: 'shield' });
    return { left: g.roster.fighters[0].shieldLeft, hp: g.roster.fighters[0].hp };
  });
  check('a barrier grant puts seconds on the clock', shield.left > 0, `${shield.left}s`);
  await sleep(250);
  const drawn = await ev(() => ({
    bubble: !!CARVE._game.bubbles[0]?.visible,
    opacity: CARVE._game.bubbles[0]?.material.opacity ?? 0,
    chip: !document.getElementById('shieldChip')?.hidden,
  }));
  check('it is drawn around the rider', drawn.bubble === true);
  check('and faintly, not as a solid ball', drawn.opacity > 0 && drawn.opacity < 0.45,
    drawn.opacity.toFixed(3));
  check('the HUD says it is running', drawn.chip === true);
  await page.screenshot({ path: path.join(SHOTS, 'shards-shielded.png') });

  // The whole point of it: a hit that does not land.
  const blocked = await ev(() => {
    const f = CARVE._game.roster.fighters[0];
    const before = f.hp;
    const landed = f.damage(25, null);
    return { before, after: f.hp, landed, shieldLeft: f.shieldLeft };
  });
  check('a hit taken behind the barrier costs no health',
    blocked.after === blocked.before, `${blocked.before} -> ${blocked.after}`);
  check('but the shot is still retired, not left in the air', blocked.landed === true);
  check('and the barrier does not burn its grace window on it',
    blocked.shieldLeft > 0, `${blocked.shieldLeft.toFixed(1)}s left`);

  // And it expires rather than lasting the run.
  const gone = await ev(() => {
    const f = CARVE._game.roster.fighters[0];
    f.shieldLeft = 0.01;
    f.step(0.2);
    const before = f.hp;
    f.iframes = 0;
    f.damage(7, null);
    return { left: f.shieldLeft, before, after: f.hp };
  });
  check('once it expires, hits land again', gone.after < gone.before,
    `${gone.before} -> ${gone.after}`);
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.close();
}
console.log(`\n  ${pass + fail} checks run — ${pass} pass, ${fail} fail\n`);
process.exit(fail ? 1 : 0);
