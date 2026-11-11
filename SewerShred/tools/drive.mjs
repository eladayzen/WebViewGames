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

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'shots';
const W = +(args.w || 1280), H = +(args.h || 720);
const script = args.script || 'default';
fs.mkdirSync(outDir, { recursive: true });

const ROOT = path.resolve('dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

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
  }
  console.log('kicks', await page.evaluate(() => window.__game.G.kicks));
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
  await page.evaluate((w) => { window.__want = w; }, args.type || 'foot');
  for (const at of [0, 330]) {
    await page.waitForFunction((a) => window.__game.player.s > a, { timeout: 60000 }, at);
    await page.waitForFunction(() => {
      const { player, obstacles } = window.__game;
      return obstacles.list.some((o) => o.type === window.__want && !o.flying && o.s - player.s > 10 && o.s - player.s < 16);
    }, { timeout: 60000 });
    await snap('foes-at-' + at);
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
