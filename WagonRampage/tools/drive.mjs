// Headless run with screenshots and numbers. Needs a server on the port (npx vite preview).
//   node tools/drive.mjs <port> <outDir> [--secs=40] [--auto] [--portrait] [--shots=8]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const args = process.argv.slice(2);
const port = args[0] || '8155';
const out = args[1] || 'shots';
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const secs = +(opt.secs || 40), shots = +(opt.shots || 8);
fs.mkdirSync(out, { recursive: true });

const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu-rasterization'],
});
const p = await b.newPage();
await p.setViewport(opt.portrait ? { width: 430, height: 860, deviceScaleFactor: 2 } : { width: 1280, height: 720 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://127.0.0.1:${port}/index.html${opt.auto ? '?auto=1' : ''}`);
await p.waitForFunction(() => window.__game && window.__game.G.state !== 'loading', { timeout: 60000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
let frames0 = await p.evaluate(() => { window.__fc = 0; (function c() { window.__fc++; requestAnimationFrame(c); })(); return 0; });
// catch the Raph strike mid-air (first two) — it lasts ~1.3 s so the timed shots miss it
let strikeShots = 0;
const poll = setInterval(async () => {
  if (strikeShots >= 2) return;
  try {
    const t = await p.evaluate(() => (window.__game.G.strike ? window.__game.G.strike.t : -1));
    if (t > 0.3 && t < 0.6) { const n = strikeShots++; await p.screenshot({ path: `${out}/strike${n}.jpg`, type: 'jpeg', quality: 85 }); }
  } catch (e) { /* page busy */ }
}, 90);
for (let i = 0; i < shots; i++) {
  await wait((secs * 1000) / shots);
  await p.screenshot({ path: `${out}/s${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 80 });
  const st = await p.evaluate(() => {
    const g = window.__game, G = g.G;
    return { t: +G.time.toFixed(1), state: G.state, wrecks: G.wrecks, score: G.score, combo: G.bestCombo, hp: Math.round(G.hp), power: G.power, used: G.powersUsed || 0, orbs: G.orbsTaken || 0, shots: (G.shotsFired || 0),
      live: g.enemies.filter((e) => e.active && e.alive).map((e) => `${e.kind[0]}${Math.round(e.s - g.player.s)}/${e.u.toFixed(1)}/${Math.round(e.hp)}`).join(' '),
      pu: g.player.u.toFixed(1), vs: g.player.vs.toFixed(1), junctions: g.world.jcount, chunks: g.world.chunks.length };
  });
  console.log(JSON.stringify(st));
}
clearInterval(poll);
const fc = await p.evaluate(() => window.__fc);
console.log('fps', (fc / ((Date.now() - t0) / 1000)).toFixed(1), 'errors', errs.slice(0, 5));
await b.close();
