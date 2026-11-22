// The Technodrome backdrop: level 6 with the goal pulled in, so it's big enough to judge.
//   node tools/env-techno.mjs [port] [outDir] [goal metres, default 700]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', goal = '700'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1&level=6`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate((g) => { window.__game.G.god = true; window.__game.backdrop.goal = +g; }, goal);
await new Promise((r) => setTimeout(r, 2500));
await p.screenshot({ path: `${out}/techno_${goal}.jpg`, type: 'jpeg', quality: 82 });
console.log('goal', goal, 'errors', errs.slice(0, 3));
await b.close();
