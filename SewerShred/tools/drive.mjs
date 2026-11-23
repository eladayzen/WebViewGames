// Headless verification run: serve dist/, open it in muted headless Chrome,
// play a scripted lean sequence, and take screenshots + numbers along the way.
//
//   node tools/drive.mjs [outDir] [--w=1280 --h=720] [--script=default|survive|loop]
//
// Screenshots measure, they don't infer — read them.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), ''] : [a.slice(2, i), a.slice(i + 1)]; }));
const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'shots';
const W = +(args.w || 1280), H = +(args.h || 720);
const script = args.script || 'default';
fs.mkdirSync(outDir, { recursive: true });

const ROOT = path.resolve('dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
// the level loop (levels.js) opens on a card at the saved level: older scripts
// want level 1 (the full sewer deck) with no card, unless they say otherwise
const q0 = script === 'levels' ? '' : 'level=1&card=0';
const qq = [args.q && args.q.includes('level=') ? '' : q0, args.q || ''].filter(Boolean).join('&');
const url = `http://127.0.0.1:${server.address().port}/index.html` + (qq ? '?' + qq : '');

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${W},${H}`],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.G.state !== 'loading', { timeout: 30000 });

const lean = (v) => page.evaluate((x) => { window.__leanOverride = x; }, v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const stat = () => page.evaluate(() => {
  const { G, player } = window.__game;
  return { state: G.state, s: +player.s.toFixed(1), theta: +player.theta.toFixed(2), speed: +player.speed.toFixed(1), score: Math.floor(G.score), lives: G.lives, combo: G.combo, pizza: G.pizza, fps: window.__fps };
});
await page.evaluate(() => {
  let n = 0, t0 = performance.now();
  (function c() { n++; const t = performance.now(); if (t - t0 > 1000) { window.__fps = Math.round(n * 1000 / (t - t0)); n = 0; t0 = t; } requestAnimationFrame(c); })();
});
let shot = 0;
const snap = async (name) => {
  const f = path.join(outDir, `${String(++shot).padStart(2, '0')}-${name}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 80 });
  console.log(f, JSON.stringify(await stat()));
};

if (script === 'default') {
  await wait(800); await snap('countdown');
  await wait(3000); await snap('go');
  await lean(0.6); await wait(900); await snap('lean-right');
  await lean(1); await wait(1400); await snap('wall-right');
  await lean(0); await wait(1200); await snap('swing-back');
  await lean(-1); await wait(1500); await snap('wall-left');
  await lean(-0.3); await wait(2500); await snap('cruise');
  await lean(0); await wait(4000); await snap('later');
  await wait(6000); await snap('much-later');
} else if (script === 'fork') {
  // ride up to the first Y-junction holding one side (--side=1 right / -1 left), shoot the approach + split
  const side = +(args.side || 1);
  await wait(1000);
  if (args.kind) await page.evaluate((k) => { window.__game.track.nextKind = k; }, args.kind);
  await wait(2800);
  const fs = await page.evaluate(() => window.__game.track.forkS());
  await page.evaluate((s) => { const { player } = window.__game; player.s = s; player.invuln = 99; }, fs - 190);
  await lean(0);
  await page.evaluate((d) => { window.__game.G.dirOff = d; }, side * +(args.off || 0.45));
  const marks = (args.marks || '140,70,25,5,-12,-30,-55,-90').split(',').map(Number);
  for (const m of marks) {
    await page.waitForFunction((t) => window.__game.player.s >= t, { timeout: 30000 }, fs - m);
    await snap('to' + m);
    console.log('  world', await page.evaluate(() => window.__game.worldName()), 'theta', await page.evaluate(() => window.__game.player.theta.toFixed(2)));
  }
} else if (script === 'trains') {
  // subway: stay on the floor, shoot trains coming; --dodge leans up the wall when one is close
  await wait(3800);
  await page.evaluate(() => { window.__game.player.invuln = 0; });
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < +(args.ms || 20000) && n < 8) {
    const d = await page.evaluate(() => window.__game.trainDist());
    if (d !== null && d < 90 && d > 60) { await snap('train' + (n++)); await wait(400); }
    if (args.dodge) await lean(d !== null && d < 70 ? 1 : 0);
    await wait(150);
  }
  console.log('final', JSON.stringify(await stat()));
} else if (script === 'at') {
  // jump to --s (comma list) and shoot each, --wait ms after the jump
  await wait(3800);
  for (const at of String(args.s || '280').split(',').map(Number)) {
    await page.evaluate((x) => { const { player } = window.__game; player.s = x; player.invuln = 99; }, at);
    await wait(+(args.wait || 300)); await snap('s' + at);
  }
} else if (script === 'shield') {
  // spawn a shield pickup just ahead on the river line and shoot it closing in
  await wait(3800);
  await page.evaluate(() => { const { player, obstacles, slimeAngle } = window.__game; player.invuln = 99; obstacles.add('shield', player.s + 30, slimeAngle(player.s + 30) + 0.5); });
  for (const t of [700, 1000, 1200, 1400]) { await wait(t === 700 ? 700 : 200); await snap('shield' + t); }
} else if (script === 'sai') {
  // grab SAI STORM and line up Foot Soldiers ahead: shoot the throws + returns
  await wait(3800);
  await page.evaluate(() => {
    const { player, obstacles, daggers, slimeAngle } = window.__game;
    player.invuln = 99; daggers.start();
    for (const [d, off] of [[22, 0.5], [30, -0.6], [38, 0.2], [46, -0.3]]) obstacles.add('foot', player.s + d, slimeAngle(player.s + d) + off, { base: 0, phase: 0 });
  });
  for (let i = 0; i < 10; i++) { await wait(140); await snap('sai' + i); }
  console.log(JSON.stringify(await page.evaluate(() => ({ kicks: window.__game.G.kicks, left: window.__game.daggers.left }))));
} else if (script === 'edges') {
  // Elad 2026-11-22: hold full right 20 s, then full left 20 s — does the rider
  // ever ride above the 180 seam (θ = ±90°)? Sample every 100 ms, shoot the worst.
  await wait(4200);
  await page.evaluate(() => { window.__game.player.invuln = 1e9; window.__game.G.lives = 99; });
  const hold = async (side, secs) => {
    await lean(side);
    let worst = { over: -1e9 }, n = 0, over = 0;
    for (let t = 0; t < secs * 10; t++) {
      await wait(100);
      const r = await page.evaluate(() => { const { player, G } = window.__game; const th = Math.atan2(Math.sin(player.theta), Math.cos(player.theta)); window.__game.player.invuln = 1e9; G.lives = 99; return { th: th * 180 / Math.PI, s: player.s, off: G.dirOff * 180 / Math.PI, state: G.state }; });
      if (t < 15) continue;                      // let him get there
      n++;
      const o = Math.abs(r.th) + 2.96 - 90;   // the board's outer EDGE (0.31 m half-width at R 6), not its centre
      if (o > 0.5) over++;
      if (o > worst.over) worst = { ...r, over: o };
    }
    console.log(`side ${side}: ${n} samples, ${over} with the board edge past the seam (>0.5°), worst ${worst.over.toFixed(1)}° over at s=${worst.s.toFixed(0)} (θ=${worst.th.toFixed(1)}°, dirOff=${worst.off.toFixed(1)}°, ${worst.state})`);
    await snap(side > 0 ? 'hold-right' : 'hold-left');
  };
  await hold(1, 20);
  await hold(-1, 20);
} else if (script === 'city') {
  // OPEN TOP look: ride, swing to each rim, shoot along the way
  await wait(1200); await snap('countdown');
  await wait(3000); await page.evaluate(() => { window.__game.player.invuln = 1e9; }); await snap('go');
  await wait(2500); await snap('cruise');
  await lean(1); await wait(1800); await snap('rim-right');
  await lean(-1); await wait(2600); await snap('rim-left');
  await lean(0); await wait(5000); await snap('later');
  await lean(0.6); await wait(6000); await snap('much-later');
  const kinds = await page.evaluate(() => { const c = {}; for (const o of window.__game.obstacles.list) c[o.type] = (c[o.type] || 0) + 1; return c; });
  console.log('obstacle types alive:', JSON.stringify(kinds));
} else if (script === 'street') {
  // OPEN TOP street set: deal each pattern in front of the rider, steer onto the
  // ones you ride (kicker / rail), log what happened, shoot it
  await wait(4300);
  await page.evaluate((m) => { window.__miss = m; }, +(args.miss || 0));
  await page.evaluate(() => { const g = window.__game; g.G.lives = 99; g.obstacles.nextS = 1e9; for (const o of g.obstacles.list) o.done = true; });
  for (const name of (args.only ? args.only.split(',') : ['cones', 'barricade', 'kicker', 'rail', 'tires', 'props'])) {
    const info = await page.evaluate((n) => {
      const g = window.__game, ob = g.obstacles, s = g.player.s + 40, n0 = ob.list.length;
      ob[`_p_${n}`](s, 0.5, g.slimeAngle(s));
      const fresh = ob.list.slice(n0);
      const aim = fresh.find((o) => o.type === 'kicker' || o.type === 'rail');
      window.__aim = aim ? aim.theta : null;
      window.__log = { maxHop: 0, lives: g.G.lives, score: g.G.score, pizza: g.G.pizza };
      return fresh.map((o) => o.type).join(',');
    }, name);
    for (let t = 0; t < 32; t++) {
      await wait(100);
      await page.evaluate(() => {
        const g = window.__game;
        if (window.__aim !== null) g.G.dirOff = window.__aim + (window.__miss || 0) - g.slimeAngle(g.player.s);
        window.__log.maxHop = Math.max(window.__log.maxHop, g.player.hop);
        g.G.lives = Math.max(g.G.lives, 50);
      });
      if (t === +(args.at || 18)) await snap(name);
    }
    const r = await page.evaluate(() => { const g = window.__game; return { ...window.__log, livesNow: g.G.lives, gained: Math.round(g.G.score - window.__log.score), pz: g.G.pizza - window.__log.pizza }; });
    console.log(name, '->', info, JSON.stringify({ maxHop: +r.maxHop.toFixed(2), hit: r.livesNow < r.lives, pts: r.gained, pizza: r.pz }));
    await page.evaluate(() => { const g = window.__game; g.G.dirOff = 0; g.player.invuln = 0; });
    await wait(1500);
  }
} else if (script === 'levels') {
  // the level loop end to end; progress is forced so it doesn't take minutes
  const st = () => page.evaluate(() => { const g = window.__game; return { state: g.G.state, level: g.G.level, open: g.G.openTop, s: Math.round(g.player.s), pickups: g.obstacles.list.filter((o) => o.type === 'shield' || o.type === 'sai').map((o) => o.type + '@' + Math.round(o.s)).join(' '), saved: localStorage.getItem('sewerShred.progress') }; });
  const space = async () => { await page.keyboard.press('Space'); await wait(400); };
  await page.evaluate(() => localStorage.removeItem('sewerShred.progress'));
  await wait(1200);
  // force each level's goal so the loop runs in seconds
  const force = {
    dist: (n) => `window.__game.player.s = ${n} - 10`,
    ko: (n) => `window.__game.G.kicks = ${n}`,
    air: (n) => `window.__game.G.airPizza = ${n}`,
    pizza: (n) => `window.__game.G.pizza = ${n}`,
  };
  const levels = await page.evaluate(() => window.__game.LEVELS.map((L) => ({ key: L.key, goal: L.goal })));
  for (let i = 0; i < levels.length; i++) {
    const L = levels[i];
    await snap(`L${i}-card`); console.log('card', i, JSON.stringify(await st()));
    await space(); await wait(9000); await snap(`L${i}-play`);
    console.log('play', i, L.key, JSON.stringify(await st()), 'world', await page.evaluate(() => window.__game.worldName()));
    await page.evaluate(force[L.goal.type](L.goal.n)); await wait(2200); await snap(`L${i}-clear`); console.log('clear', i, JSON.stringify(await st()));
    await space(); await wait(900);
  }
  console.log('after-last', JSON.stringify(await st()));
} else if (script === 'nofoes') {
  // GET HOME must deal no Foot at all: ride it and count what the deck put out
  await page.evaluate(() => { window.__game.G.lives = 99; window.__game.player.invuln = 9999; });
  let foes = 0, poles = 0, pizza = 0; const seen = new Set();
  for (let t = 0; t < 16; t++) {
    await wait(3000);
    const r = await page.evaluate(() => window.__game.obstacles.list.map((o) => [o.type, Math.round(o.s * 10), !!o.dummy]));
    for (const [ty, k, dm] of r) { const id = ty + k; if (seen.has(id)) continue; seen.add(id); if (ty === 'foot' && !dm) foes++; if (ty === 'pole') poles++; if (ty === 'pizza') pizza++; }
    if (t === 8) await snap('ride');
  }
  console.log('nofoes', JSON.stringify({ s: await page.evaluate(() => Math.round(window.__game.player.s)), foes, poles, pizza, deck: await page.evaluate(() => window.__game.obstacles.deckMode) }));
} else if (script === 'routes') {
  // which fork kinds the current level deals: ride ~650 m and list every fork met
  await page.evaluate(() => { window.__game.G.lives = 99; window.__game.player.invuln = 9999; });
  const goal = await page.evaluate(() => { const g = window.__game; g.LEVELS[g.G.level].goal.n = 99999; return g.LEVELS[g.G.level].key; });
  let shot0 = 0;
  for (let t = 0; t < 18; t++) {
    await wait(3000);
    const near = await page.evaluate(() => { const g = window.__game; const f = g.FORKS.find((x) => x.s - g.player.s > 8 && x.s - g.player.s < 30); return f ? f.kind : null; });
    if (near && shot0 < 3) { shot0++; await snap('fork-' + near); }
  }
  console.log('routes', goal, JSON.stringify(await page.evaluate(() => ({ s: Math.round(window.__game.player.s), forks: window.__game.FORKS.map((f) => f.kind + '@' + Math.round(f.s)) }))));
} else if (script === 'climbseq') {
  // ride through one forced rise or drop (--kind=rise|drop) and snap it frame by frame
  const kind = args.kind || 'rise';
  await page.evaluate((k) => { const g = window.__game; g.track.nextKind = k; g.G.lives = 99; g.LEVELS[g.G.level].goal.n = 99999; }, kind);
  await page.evaluate(() => window.__game.startRun());
  await page.evaluate(() => { window.__game.G.lives = 99; });
  await wait(1500);
  const fs0 = await page.evaluate(() => window.__game.FORKS[0] && [window.__game.FORKS[0].kind, Math.round(window.__game.FORKS[0].s)]);
  console.log('fork', JSON.stringify(fs0));
  for (const d of [45, 15, 0, -15, -30, -50]) {
    await page.waitForFunction((dd) => { const g = window.__game; return g.FORKS[0] && g.FORKS[0].s - g.player.s < dd; }, { timeout: 90000 }, d);
    await page.evaluate(() => { window.__game.G.lives = 99; });
    await snap(kind + '_' + d);
  }
} else if (script === 'halfpipe') {
  // the dojo: past its 2nd fork (a climb) the roof turns to grey concrete — snap the way through
  await page.evaluate(() => { const g = window.__game; g.G.lives = 99; g.LEVELS[g.G.level].goal.n = 99999; });
  await page.waitForFunction(() => window.__game.FORKS.length >= 2, { timeout: 90000 });
  console.log('fork 2', await page.evaluate(() => { const f = window.__game.FORKS[1]; return f.kind + '@' + Math.round(f.s); }));
  for (const d of [-40, -5, 30, 70, 110]) {
    await page.waitForFunction((dd) => { const g = window.__game; return g.player.s - g.FORKS[1].s > dd; }, { timeout: 90000 }, d);
    await page.evaluate(() => { window.__game.G.lives = 99; });
    await snap('hp' + d);
  }
  console.log('world', await page.evaluate(() => window.__game.worldName()));
} else if (script === 'gear') {
  // ?gear=1: glide, then saws — snap both, count what the saws cut
  await page.evaluate(() => { const g = window.__game; g.G.lives = 99; g.LEVELS[g.G.level].goal.n = 99999; });
  await page.waitForFunction(() => window.__game.G.state === 'play', { timeout: 20000 }); await wait(500);
  await page.keyboard.press('KeyG'); await wait(600); await snap('glide-up');
  await wait(1500); await snap('glide-high');
  console.log('glide', JSON.stringify(await page.evaluate(() => ({ hop: +window.__game.player.hop.toFixed(2), pizza: window.__game.G.pizza }))));
  await wait(3800); await snap('glide-end');
  console.log('after glide', JSON.stringify(await page.evaluate(() => ({ hop: +window.__game.player.hop.toFixed(2), pizza: window.__game.G.pizza, lives: window.__game.G.lives }))));
  const before = await page.evaluate(() => ({ score: window.__game.G.score, kicks: window.__game.G.kicks || 0 }));
  await page.keyboard.press('KeyH'); await wait(700); await snap('saws-out');
  // lay a row of things right in his lane so the saws have work
  await page.evaluate(() => { const g = window.__game, o = g.obstacles, p = g.player;
    o.add('crate', p.s + 30, p.theta); o.add('foot', p.s + 45, p.theta + 0.2, { base: p.theta + 0.2, strafe: 0, phase: 0, yaw: 0 }); o.add('crate', p.s + 60, p.theta - 0.3); });
  let cut = 0;
  for (let i = 0; i < 6; i++) { await wait(1000); if (i === 2) await snap('saws-cutting'); }
  cut = await page.evaluate(() => window.__game.gear.cuts || 0);
  console.log('saws', JSON.stringify({ cut, ...(await page.evaluate(() => ({ kicks: window.__game.G.kicks || 0, lives: window.__game.G.lives }))), before }));
} else if (script === 'shatter') {
  // a dummy right in his lane: snap just after the kick, to see the cardboard burst
  await page.waitForFunction(() => window.__game.G.state === 'play', { timeout: 20000 }); await wait(800);
  const k0 = await page.evaluate(() => { const g = window.__game, p = g.player; g.obstacles.add('foot', p.s + 22, p.theta, { base: p.theta, strafe: 0, phase: 0, yaw: 0, dummy: true, kind: 1 }); return g.G.kicks || 0; });
  await page.waitForFunction((k) => (window.__game.G.kicks || 0) > k, { timeout: 20000 }, k0);
  for (const t of [90, 250, 500]) { await wait(t === 90 ? 90 : t - 90); await snap('shatter-' + t); }
} else if (script === 'portalend') {
  // NIGHT CITY's finish: jump near the end and snap the portal, then the dev panel
  await page.waitForFunction(() => window.__game.G.state === 'play', { timeout: 20000 });
  await page.evaluate(() => { const g = window.__game; g.G.lives = 99; g.player.s = g.LEVELS[g.G.level].goal.n - 150; });
  await wait(4500); await snap('portal-near');
  await wait(2500); await snap('portal-close');
  await page.click('#dev-btn'); await wait(400); await snap('devpanel');
} else if (script === 'pack') {
  // the pack rides his spine: snap riding, then mid-kick; G must not change move mode / camera
  await page.waitForFunction(() => window.__game.G.state === 'play', { timeout: 20000 }); await wait(600);
  await page.evaluate(() => { const g = window.__game; g.gear.on = true; g.G.lives = 99; });
  const m0 = await page.evaluate(() => [window.__game.G.moveMode, window.__game.G.fixCam]);
  await snap('pack-ride');
  await page.keyboard.press('KeyG'); await wait(400);
  const m1 = await page.evaluate(() => [window.__game.G.moveMode, window.__game.G.fixCam, window.__game.gear.gliding]);
  console.log('mode before', JSON.stringify(m0), 'after G', JSON.stringify(m1));
  await wait(6500);
  const k0 = await page.evaluate(() => { const g = window.__game, p = g.player; g.obstacles.add('foot', p.s + 24, p.theta, { base: p.theta, strafe: 0, phase: 0, yaw: 0 }); return g.G.kicks || 0; });
  await page.waitForFunction((k) => (window.__game.G.kicks || 0) > k, { timeout: 20000 }, k0);
  for (const t of [120, 300, 500]) { await wait(t === 120 ? 120 : t - (t === 300 ? 120 : 300)); await snap('pack-kick-' + t); }
} else if (script === 'powers') {
  // one ability at a time + the shield's timer; then NIGHT CITY's portal end
  await page.waitForFunction(() => window.__game.G.state === 'play', { timeout: 20000 }); await wait(500);
  const st = () => page.evaluate(() => { const g = window.__game; return { shield: g.player.shieldOn, stars: g.daggers.active, saws: g.gear.sawing, glide: g.gear.gliding, power: document.getElementById('power').classList.contains('on') }; });
  await page.click('#dev-btn'); await wait(200);
  await page.click('#dev-shield'); await wait(300); console.log('shield', JSON.stringify(await st()));
  await page.click('#dev-saws'); await wait(300); console.log('then saws', JSON.stringify(await st()));
  await snap('saws-bar');
  await page.click('#dev-sai'); await wait(300); console.log('then stars', JSON.stringify(await st()));
  await page.click('#dev-shield'); await wait(10600); console.log('shield +10.6s', JSON.stringify(await st()));
  await page.evaluate(() => { const g = window.__game; g.G.lives = 99; g.player.s = g.LEVELS[g.G.level].goal.n - 60; });
  await page.waitForFunction(() => window.__game.G.state === 'clear', { timeout: 30000 }); await wait(700);
  await snap('portal-through');
  await wait(1800); await snap('portal-clear');
} else if (script === 'hit') {
  // a crate in his lane, no shield: after the hit the bubble must stay off
  await page.waitForFunction(() => window.__game.G.state === 'play', { timeout: 20000 }); await wait(500);
  const l0 = await page.evaluate(() => { const g = window.__game, p = g.player; g.obstacles.add('crate', p.s + 25, p.theta); return g.G.lives; });
  await page.waitForFunction((l) => window.__game.G.lives < l, { timeout: 20000 }, l0);
  await wait(250); await snap('after-hit');
  console.log('hit', JSON.stringify(await page.evaluate(() => ({ lives: window.__game.G.lives, invuln: +window.__game.player.invuln.toFixed(2), bubble: window.__game.player.shield.visible }))));
} else if (script === 'dojo') {
  // the dojo level: ride, sway across the wall, count dummies down, see the stars
  await wait(4500);
  await page.evaluate(() => { const { player, obstacles, slimeAngle } = window.__game; for (const [d, off, k] of [[16, -0.5, 0], [19, 0.1, 1], [22, 0.6, 2]]) obstacles.add('foot', player.s + d, slimeAngle(player.s + d) + off, { base: 0, phase: 0, dummy: true, kind: k }); });
  await wait(250); await snap('dummies-close'); await wait(500); await snap('dummies-hit');
  for (let k = 0; k < 8; k++) {
    await page.keyboard.down(k % 2 ? 'ArrowLeft' : 'ArrowRight'); await wait(1100); await page.keyboard.up(k % 2 ? 'ArrowLeft' : 'ArrowRight');
    await wait(900); await snap('dojo' + k);
    console.log(JSON.stringify(await page.evaluate(() => { const g = window.__game; return { s: Math.round(g.player.s), kicks: g.G.kicks, lives: g.G.lives, stars: g.daggers.active, dummies: g.obstacles.list.filter((o) => o.dummy && !o.done).length, world: g.worldName() }; })));
  }
} else if (script === 'firstpick') {
  await wait(9000);
  console.log('first pickups:', await page.evaluate(() => window.__game.obstacles.list.filter((o) => o.type === 'shield' || o.type === 'sai').map((o) => `${o.type}@${Math.round(o.s)}`).join(' ') || 'none'), 'level', await page.evaluate(() => window.__game.G.level));
} else if (script === 'quit') {
  // fake the GoBalance SDK, press X mid-run: confirm card, then quit screen + board
  await wait(5200);
  await page.evaluate(() => { window.__subs = []; window.GoBalance = { available: true, submitScore: async (v) => { window.__subs.push(v); }, getScoreboard: async () => ({ complete: true, entries: [{ name: 'Maya', score: 4200, isYou: false }, { name: 'Elad', score: 2600, isYou: true }, { name: 'Noa', score: 900, isYou: false }] }), back: () => { window.__left = true; } }; });
  await page.evaluate(() => document.getElementById('gb-back').click());
  await wait(300); await snap('confirm');
  const paused = await page.evaluate(() => window.__game.G.paused);
  await page.evaluate(() => document.getElementById('qc-yes').click());
  await wait(500); await snap('quitscreen');
  console.log(JSON.stringify(await page.evaluate(() => ({ paused: window.__game.G.paused, state: window.__game.G.state, subs: window.__subs, rows: document.querySelectorAll('#q-board li').length, restartBtns: document.querySelectorAll('#restart-button').length }))), 'pausedOnConfirm', paused);
  await page.evaluate(() => document.getElementById('q-leave').click());
  console.log('left', await page.evaluate(() => window.__left));
} else if (script === 'devunlock') {
  await wait(1500);
  const before = await page.evaluate(() => getComputedStyle(document.getElementById('dev-btn')).display + '/' + getComputedStyle(document.getElementById('foe-btn')).display);
  const r = await page.evaluate(() => { const b = document.getElementById('lives').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(r.x, r.y); await page.mouse.down(); await wait(7400); await page.mouse.up();
  await snap('pad');
  for (const k of '2128') await page.evaluate((d) => [...document.querySelectorAll('.devcode-key')].find((b) => b.textContent === d)?.click(), k);
  await wait(400); await snap('unlocked');
  const after = await page.evaluate(() => getComputedStyle(document.getElementById('dev-btn')).display + '/' + getComputedStyle(document.getElementById('foe-btn')).display);
  console.log('dev-btn/foe-btn before', before, 'after', after);
} else if (script === 'zones') {
  // jump to the middle of each zone (invulnerable) and shoot it
  await wait(3800);
  const n = +(args.n || 8);
  for (let z = 0; z < n; z++) {
    await page.evaluate((s) => { const { player } = window.__game; player.s = s; player.invuln = 99; }, z * 300 + 120);
    await wait(1600); await snap('zone' + z);
  }
} else if (script === 'loop') {
  await wait(3500);
  await lean(1); for (let i = 0; i < 6; i++) { await wait(500); await snap('loop' + i); }
} else if (script === 'water') {
  // ride the floor (invulnerable so obstacles don't end the run) until a pool
  await page.evaluate(() => { setInterval(() => { window.__game.player.invuln = 5; window.__game.player.shield.visible = false; }, 100); });
  await lean(0);
  await page.waitForFunction(() => window.__game.G.waterOn, { timeout: 40000 });
  await wait(120); await snap('splash-in');
  await wait(500); await snap('in-water');
  await page.waitForFunction(() => window.__game.G.slimeOn, { timeout: 40000 }).catch(() => {});
  await wait(300); await snap('slime');
} else if (script === 'sewage') {
  // BAL-646: ride into the sewage, then hold a line up on the right wall so the
  // river is in view beside the rider. Immune to obstacles.
  await page.evaluate(() => { setInterval(() => { const g = window.__game; g.player.invuln = 5; g.player.shield.visible = false; g.G.lives = 99; }, 100); });
  await lean(0);
  await page.waitForFunction(() => window.__game.G.slimeOn, { timeout: 40000 });
  await wait(80); await snap('sewage-splash');
  await wait(700); await snap('in-sewage');
  await page.evaluate(() => { window.__hold = setInterval(() => { const { player } = window.__game; window.__leanOverride = Math.max(-1, Math.min(1, (1.25 - player.theta) * 1.6 - player.omega * 0.4)); }, 30); });
  await wait(2500);
  for (let i = 0; i < 5; i++) { await snap(`beside-${i}`); await wait(350); }
} else if (script === 'kick') {
  // autopilot: steer at the nearest Foot Soldier ahead; immune to obstacles
  await page.evaluate(() => {
    setInterval(() => {
      const { player, obstacles } = window.__game;
      window.__game.G.lives = 99;
      const foes = obstacles.list.filter((o) => o.type === 'foot' && !o.flying && o.s - player.s > 1 && o.s - player.s < 45).sort((a, b) => a.s - b.s);
      if (!foes.length) { window.__leanOverride = -player.theta * 0.8; return; }
      let d = (foes[0].theta - player.theta) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
      window.__leanOverride = Math.max(-1, Math.min(1, d * 2.2 - player.omega * 0.5));
    }, 30);
  });
  for (let k = 1; k <= 2; k++) {
    await page.waitForFunction((n) => (window.__game.G.kicks || 0) >= n, { timeout: 60000 }, k);
    for (let i = 0; i < 6; i++) { await snap(`kick${k}-${i}`); await wait(60); }
    for (let i = 0; i < 8; i++) {
      await wait(120);
      console.log('spin', JSON.stringify(await page.evaluate(() => { const p = window.__game.player; return { boardYaw: +p.bank.rotation.y.toFixed(2), riderYaw: +(p.model.rotation.y - Math.PI).toFixed(2), pending: +p.trickSpin.toFixed(2) }; })));
    }
  }
  console.log('kicks', await page.evaluate(() => window.__game.G.kicks));
} else if (script === 'attacks') {
  // DEV audition: ride into 10 Foot Soldiers, snap each attack mid-swing
  await page.evaluate(() => {
    setInterval(() => {
      const { player, obstacles } = window.__game;
      window.__game.G.lives = 99;
      const foes = obstacles.list.filter((o) => o.type === 'foot' && !o.flying && o.s - player.s > 1 && o.s - player.s < 45).sort((a, b) => a.s - b.s);
      if (!foes.length) { window.__leanOverride = -player.theta * 0.8; return; }
      let d = (foes[0].theta - player.theta) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
      window.__leanOverride = Math.max(-1, Math.min(1, d * 2.2 - player.omega * 0.5));
    }, 30);
  });
  for (let k = 1; k <= 11; k++) {
    await page.waitForFunction((n) => (window.__game.G.kicks || 0) >= n, { timeout: 90000 }, k);
    await wait(350);
    const info = await page.evaluate(() => {
      const p = window.__game.player;
      const run = p.attacks.map((a) => a.action.isRunning() ? `${a.n}@${a.action.time.toFixed(2)}` : null).filter(Boolean);
      return { tag: document.body.lastElementChild?.textContent, running: run };
    });
    console.log('attack', k, JSON.stringify(info));
    await snap(`attack${k}`);
  }
} else if (script === 'dissolve') {
  // ride into Foot Soldiers; snap each kicked one mid-flight as he dissolves
  await page.evaluate(() => {
    setInterval(() => {
      const { player, obstacles } = window.__game;
      window.__game.G.lives = 99;
      const foes = obstacles.list.filter((o) => o.type === 'foot' && !o.flying && o.s - player.s > 1 && o.s - player.s < 45).sort((a, b) => a.s - b.s);
      if (!foes.length) { window.__leanOverride = -player.theta * 0.8; return; }
      let d = (foes[0].theta - player.theta) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
      window.__leanOverride = Math.max(-1, Math.min(1, d * 2.2 - player.omega * 0.5));
    }, 30);
  });
  for (let k = 1; k <= 3; k++) {
    await page.waitForFunction((n) => (window.__game.G.kicks || 0) >= n, { timeout: 90000 }, k);
    for (const ms of [120, 220, 220]) {
      await wait(ms);
      const d = await page.evaluate(() => window.__game.obstacles.list.filter((o) => o.flying).map((o) => +(o.dissolve || 0).toFixed(2)));
      console.log('kick', k, 'dissolve', JSON.stringify(d), 'fps', await page.evaluate(() => window.__fps));
      await snap(`kick${k}-${ms}`);
    }
  }
} else if (script === 'shield') {
  // give a shield, ride straight into whatever comes, log state around hits
  await wait(3500);
  await page.evaluate(() => { const p = window.__game.player; p.shieldOn = true; window.__game.G.lives = 99; window.__leanOverride = 0; });
  const st = () => page.evaluate(() => { const p = window.__game.player, G = window.__game.G; return { shieldOn: p.shieldOn, bubble: p.shield.visible, invuln: +p.invuln.toFixed(2), lives: G.lives }; });
  let prev = await st(); console.log('start', JSON.stringify(prev));
  for (let i = 0; i < 400; i++) {
    await wait(100);
    const now = await st();
    if (now.shieldOn !== prev.shieldOn || now.lives !== prev.lives || now.bubble !== prev.bubble) console.log((i / 10).toFixed(1) + 's', JSON.stringify(now));
    prev = now;
    if (now.lives <= 97) break;
  }
} else if (script === 'modes') {
  // each Direct mode: hold full right lean, then full left; log angle from the water's centre
  await page.evaluate(() => { window.__game.G.lives = 99; });
  await wait(3500);
  for (const m of (args.modes || 'd180,d220,d360').split(',')) {
    await page.evaluate((mm) => { window.__game.setMoveMode(mm); window.__game.player.invuln = 99; }, m);
    for (const [l, ms] of [[1, 2500], [-1, 2500], [0, 800]]) {
      await lean(l); await wait(ms);
      const r = await page.evaluate(() => { const { player, slimeAngle, G, camera } = window.__game;
        // rider's on-screen height (px) and where his middle is (0..1)
        const feet = player.root.position.clone(), head = player.root.localToWorld(new (feet.constructor)(0, 2.0, 0));
        const a = feet.clone().project(camera), b = head.clone().project(camera);
        const px = Math.round(Math.hypot((a.x - b.x) * innerWidth / 2, (a.y - b.y) * innerHeight / 2));
        const mid = { x: +((a.x + b.x) / 4 + 0.5).toFixed(2), y: +(0.5 - (a.y + b.y) / 4).toFixed(2) };
        return { px, mid, mode: G.moveMode, offDeg: Math.round((player.theta - slimeAngle(player.s)) * 180 / Math.PI), label: document.getElementById('mode-btn').textContent }; });
      console.log('mode', JSON.stringify({ lean: l, ...r }));
      if (args.snapEach) await snap(`mode-${m}-lean${l}`);
    }
    if (!args.snapEach) await snap('mode-' + m);
  }
} else if (script === 'junction') {
  // ride to the first junction (spawns at 120 m) and snap the approach
  await page.evaluate(() => { window.__game.G.lives = 99; window.__game.player.invuln = 999; });
  const near = () => page.evaluate(() => { const j = window.__game.junctions.items.filter((i) => i.on).map((i) => +(i.s - window.__game.player.s).toFixed(0)); return j; });
  await page.waitForFunction(() => window.__game.junctions.items.some((i) => i.on && i.s - window.__game.player.s < 60), { timeout: 60000 });
  for (const d of [45, 25, 12, 4]) {
    await page.waitForFunction((dd) => window.__game.junctions.items.some((i) => i.on && i.s - window.__game.player.s < dd), { timeout: 30000 }, d);
    console.log('junction ahead', JSON.stringify(await near()));
    await snap('junction-' + d);
  }
} else if (script === 'buttons') {
  const st = () => page.evaluate(() => ({ mode: window.__game.G.moveMode, b1: document.getElementById('mode-btn').textContent, b2: document.getElementById('var-btn').textContent, b2dim: document.getElementById('var-btn').classList.contains('inactive') }));
  console.log('boot', JSON.stringify(await st()));
  for (let i = 0; i < 4; i++) { await page.click('#var-btn'); console.log('var', JSON.stringify(await st())); }
  await page.click('#mode-btn'); console.log('phys', JSON.stringify(await st()));
  await page.click('#mode-btn'); console.log('phys', JSON.stringify(await st()));
  await snap('buttons');
} else if (script === 'cams') {
  // each fixed-cam preset: rider centred on the floor, then at the 220 limit
  await page.evaluate(() => { window.__game.G.lives = 99; window.__game.setMoveMode('d220f'); });
  await wait(3500);
  for (const c of (args.cams || 'low,high,side,wide').split(',')) {
    await page.evaluate((cc) => { window.__game.setFixCam(cc); window.__game.player.invuln = 99; }, c);
    for (const [l, ms, tag] of (args.sweep ? [[0, 1, 'centre'], [1, 2200, 'wall'], [-0.35, 900, 'drift-left'], [0, 1500, 'back-centre'], [-1, 2200, 'left-wall']] : [[0, 1, 'centre'], [1, 2200, 'wall']])) {
      if (tag === 'centre') await page.evaluate(() => { window.__game.G.dirOff = 0; });
      await lean(l); await wait(ms === 1 ? 1500 : ms);
      if (tag === 'wall') await lean(0);
      const r = await page.evaluate(() => { const { player, camera } = window.__game;
        const feet = player.root.position.clone(), head = player.root.localToWorld(new (feet.constructor)(0, 2.0, 0));
        const a = feet.clone().project(camera), b = head.clone().project(camera);
        return { side: +window.__game.G.autoSignS.toFixed(2), w: +window.__game.G.autoW.toFixed(2), px: Math.round(Math.hypot((a.x - b.x) * innerWidth / 2, (a.y - b.y) * innerHeight / 2)), x: +((a.x + b.x) / 4 + 0.5).toFixed(2), y: +(0.5 - (a.y + b.y) / 4).toFixed(2), fps: window.__fps }; });
      console.log('cam', c, tag, JSON.stringify(r));
      await snap(`cam-${c}-${tag}`);
    }
  }
} else if (script === 'autocam') {
  await page.evaluate((c) => { window.__cam = c; }, args.cam || 'auto');
  // place the rider at fixed offsets from the water's centre; measure framing
  await page.evaluate(() => { window.__game.G.lives = 99; window.__game.setMoveMode('d220f'); window.__game.setFixCam(window.__cam); });
  await wait(3500);
  await lean(0);
  for (const deg of [0, 20, 45, 80, 110, 30, 0, -20, -45, -110, -10]) {
    await page.evaluate((d) => { window.__game.G.dirOff = d * Math.PI / 180; window.__game.player.invuln = 0; }, deg);
    await wait(1400);
    const r = await page.evaluate(() => { const { player, camera, G } = window.__game;
      const feet = player.root.position.clone(), head = player.root.localToWorld(new (feet.constructor)(0, 2.0, 0));
      const a = feet.clone().project(camera), b = head.clone().project(camera);
      return { sideW: +G.autoW.toFixed(2), sign: +G.autoSignS.toFixed(2), px: Math.round(Math.hypot((a.x - b.x) * innerWidth / 2, (a.y - b.y) * innerHeight / 2)), x: +((a.x + b.x) / 4 + 0.5).toFixed(2), y: +(0.5 - (a.y + b.y) / 4).toFixed(2), fps: window.__fps }; });
    console.log('auto', String(deg).padStart(4) + '°', JSON.stringify(r));
    await snap(`auto${deg}`);
  }
} else if (script === 'pole') {
  // park on the floor, immortal; photograph the first poles as they come up
  await page.evaluate(() => { setInterval(() => { window.__game.G.lives = 99; }, 100); });
  await lean(0);
  for (let k = 0; k < 3; k++) {
    const info = await page.waitForFunction((n) => {
      const { player, obstacles } = window.__game;
      const p = obstacles.list.filter((o) => o.type === 'pole' && o.s - player.s > 6 && o.s - player.s < 12)[0];
      return p && p !== window.__lastPole ? (window.__lastPole = p, { beta: +p.beta.toFixed(2), n: p.n, ds: +(p.s - player.s).toFixed(1) }) : null;
    }, { timeout: 60000 }, k);
    console.log('pole', JSON.stringify(await info.jsonValue()));
    await snap('pole' + k);
  }
} else if (script === 'foes') {
  // photograph Foot Soldiers as they approach, in two different zones
  await page.evaluate(() => { setInterval(() => { window.__game.G.lives = 99; }, 100); });
  await lean(0);
  await page.evaluate((w, n) => { window.__want = w; window.__near = n; }, args.type || 'foot', +(args.near || 10));
  for (const at of [0, 330]) {
    await page.waitForFunction((a) => window.__game.player.s > a, { timeout: 60000 }, at);
    await page.waitForFunction(() => {
      const { player, obstacles } = window.__game;
      const lo = window.__near || 10;
      return obstacles.list.some((o) => o.type === window.__want && !o.flying && o.s - player.s > lo && o.s - player.s < lo + 6);
    }, { timeout: 60000 });
    await snap('foes-at-' + at);
  }
} else if (script === 'foestyles') {
  // one close shot of approaching Foot Soldiers per style
  await page.evaluate(() => { setInterval(() => { window.__game.G.lives = 99; }, 100); });
  await lean(0);
  for (const st of (args.styles || 'sprite,purple').split(',')) {
    await page.evaluate((x) => window.__game.setFootStyle(x), st);
    await page.waitForFunction(() => {
      const { player, obstacles } = window.__game;
      return obstacles.list.some((o) => o.type === 'foot' && !o.flying && !o.hit && o.s - player.s > 7 && o.s - player.s < 11);
    }, { timeout: 60000 });
    await snap('foe-' + st);
    await wait(1500);
  }
} else if (script === 'lanes') {
  // bounded-mode lane audit: every 2 m of spawned track, is there a clear lane >= LANE_MIN
  // inside slimeAngle ± 110°? --mode=d220 (fixed) vs d360 (old dealing, judged at the same reach)
  const mode = args.mode || 'd220';
  await page.evaluate((m) => { setInterval(() => { window.__game.G.lives = 99; window.__game.player.invuln = 5; }, 100); window.__game.setMoveMode(m); }, mode);
  await lean(0);
  const seen = new Set(); let tot = 0, bad = 0;
  for (let k = 0; k < 40; k++) {
    await wait(1500);
    const r = await page.evaluate(() => {
      const { obstacles, player } = window.__game; const keep = obstacles.reach; obstacles.reach = 110 * Math.PI / 180;
      const out = [];
      for (let s = Math.ceil(player.s / 2) * 2 + 20; s < player.s + 190; s += 2) out.push([s, obstacles._laneOK(s)]);
      obstacles.reach = keep; return { out, s: player.s, fps: window.__fps };
    });
    for (const [s, ok] of r.out) if (!seen.has(s)) { seen.add(s); tot++; if (!ok) bad++; }
  }
  console.log('lanes', mode, JSON.stringify({ samples: tot, blocked: bad, pct: +(100 * bad / tot).toFixed(1) }));
} else if (script === 'lanes2') {
  // deal 400 patterns offline at high difficulty, judge each for a clear lane within ±110°
  await wait(3500);
  for (const fit of [false, true]) {
    const r = await page.evaluate((fit) => {
      const { obstacles } = window.__game; const H = 110 * Math.PI / 180;
      let bad = 0, n = 0; const byName = {};
      const orig = obstacles._fitReach.bind(obstacles);
      for (let i = 0; i < 400; i++) {
        const s = 20000 + i * 60, first = obstacles.list.length;
        obstacles.reach = fit ? H : null;
        obstacles._pattern(s, 0.9, 0);
        obstacles.reach = H;
        n++; if (!obstacles._laneOK(s)) bad++;
        for (const o of obstacles.list.slice(first)) { o.done = true; o.mesh.visible = false; }
      }
      obstacles.reach = null;
      return { fit, patterns: n, blocked: bad };
    }, fit);
    console.log('lanes2', JSON.stringify(r));
  }
} else if (script === 'direct') {
  await page.evaluate(() => document.getElementById('mode-btn').click());
  await wait(3500);
  await lean(1); await wait(600); await lean(0); await wait(900); await snap('direct-held');
  await lean(-1); await wait(1200); await lean(0); await wait(900); await snap('direct-left');
} else if (script === 'pose') {
  // freeze the world and look at the rider
  await wait(4000);
  await page.evaluate(() => { window.__game.G.hitStop = 999; });
  await snap('pose');
}
console.log('--- console ---');
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
server.close();
