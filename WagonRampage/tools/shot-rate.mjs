// Autopilot run: how many Foot cannon shots are fired, and how many land on the wagon.
//   node tools/shot-rate.mjs [port] [secs]
import puppeteer from 'puppeteer-core';
const [port = '8155', secs = '40'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 960, height: 540 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => { window.__game.G.god = true; });
await new Promise((r) => setTimeout(r, +secs * 1000));
console.log(await p.evaluate(() => { const G = window.__game.G; return { fired: G.shotsFired, hit: G.shotsHit, state: G.state }; }), 'errors', errs.slice(0, 3));
await b.close();
