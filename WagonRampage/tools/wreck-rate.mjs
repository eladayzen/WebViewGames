// Autopilot (with its pickups and powers) for a while: wrecks, time left, state — to check
// the mission target against enemy HP.
//   node tools/wreck-rate.mjs [port] [secs]
import puppeteer from 'puppeteer-core';
const [port = '8155', secs = '60'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 960, height: 540 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => { window.__game.G.god = true; });
for (let t = 15; t <= +secs; t += 15) {
  await new Promise((r) => setTimeout(r, 15000));
  console.log(`${t}s`, await p.evaluate(() => { const G = window.__game.G; return `wrecks ${G.wrecks}  left ${Math.round(G.left)}s  state ${G.state}`; }));
}
console.log('errors', errs.slice(0, 3));
await b.close();
