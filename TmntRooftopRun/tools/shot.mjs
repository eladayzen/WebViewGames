// Headless look: open the built game, autopilot on, screenshots on a clock.
//   node tools/shot.mjs <outDir> [url] [times ms, comma list]
import puppeteer from 'puppeteer-core';
const out = process.argv[2], url = process.argv[3] || 'http://127.0.0.1:8170/?dev=1&seed=3';
const times = (process.argv[4] || '1500,4000,7000,10000,14000').split(',').map(Number);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', userDataDir: out + '/.prof', args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 1600, height: 720 });
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('console', m.type(), m.text()); });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto(url, { waitUntil: 'networkidle0' });
if (process.env.NOSKIP) await p.evaluate(() => { window.__tfd.setAutopilot(true); }); else await p.evaluate(() => { window.__tfd.skipCountdown(); window.__tfd.setAutopilot(true); });
if (process.env.HIGH) await p.evaluate(() => window.__tfd.setHighRoad(true));
if (process.env.WARP) await p.evaluate((x) => window.__tfd.warp(x), +process.env.WARP);
let last = 0;
for (const t of times) {
  await new Promise((r) => setTimeout(r, t - last)); last = t;
  await p.screenshot({ path: `${out}/t${t}.png` });
  console.log(t, await p.evaluate(() => document.getElementById('dbg').textContent.replace(/\n/g, ' | ')));
}
await b.close();
