// Catch one Foot cannon shot from charge to impact: wait until a car is mid-charge, then take a
// quick run of frames. God mode on, autopilot off (wagon holds its lane so it gets hit).
//   node tools/shot-burst.mjs [port] [outDir] [frames] [gapMs]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [port = '8155', out = 'shotburst', n = '8', gap = '110'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => { window.__game.G.god = true; document.querySelector('.lil-gui')?.remove(); });
await p.waitForFunction(() => window.__game.enemies.some((e) => e.active && e.alive && e.charge > 0.45), { timeout: 40000, polling: 16 });
for (let i = 0; i < +n; i++) {
  await p.screenshot({ path: `${out}/s${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 80 });
  await new Promise((r) => setTimeout(r, +gap));
}
const st = await p.evaluate(() => ({ fired: window.__game.G.shotsFired, live: window.__game.shots.length }));
console.log(st, 'errors', errs.slice(0, 3));
await b.close();
