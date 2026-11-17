// Which pickups a level actually hands out: run it under autopilot and count spawns per kind,
// plus how long a held Leo blocked new pickups.
//   node tools/pickup-mix.mjs [port] [level] [secs]
import puppeteer from 'puppeteer-core';
const [port = '8155', level = '2', secs = '60'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1&level=${level}`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => {
  const g = window.__game; g.G.god = true;
  window.__spawns = {}; window.__leoHeld = 0;
  const push = g.orbs.push.bind(g.orbs);
  g.orbs.push = (o) => { window.__spawns[o.kind] = (window.__spawns[o.kind] || 0) + 1; return push(o); };
  setInterval(() => { if (g.G.power === 'leo') window.__leoHeld += 0.25; }, 250);
});
await new Promise((r) => setTimeout(r, +secs * 1000));
console.log(JSON.stringify(await p.evaluate(() => ({ powers: window.__game.LV.powers, spawns: window.__spawns, leoHeldSecs: window.__leoHeld, state: window.__game.G.state }))), 'errors', errs.slice(0, 3));
await b.close();
