// Level 1's pickup rule: the autopilot dodges every pickup (window.__noOrbs) for `dodge` s —
// pickups must keep coming (in the wagon's lane, with the arrow over them) and 10 wrecks must
// NOT end the level. Then it starts taking them: the level must end once Raph's and Mikey's are
// both taken. Logs spawns per kind, arrow visibility, and when the level ended.
//   node tools/l1-pickups.mjs [port] [outDir] [dodgeSecs]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', dodge = '45'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => {
  window.__noOrbs = true; window.__game.G.god = true;
  window.__spawns = {};
  const g = window.__game, orbs = g.orbs, push = orbs.push.bind(orbs);
  orbs.push = (o) => { window.__spawns[o.kind] = (window.__spawns[o.kind] || 0) + 1; return push(o); };
});
const st = () => p.evaluate(() => { const G = window.__game.G; return { t: +G.time.toFixed(1), state: G.state, wrecks: G.wrecks, took: G.took, spawns: window.__spawns, arrow: !document.getElementById('orb-arrow').classList.contains('hidden'), hint: document.getElementById('hint').textContent }; });
let shot = false;
for (let i = 0; i < +dodge * 2; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const s = await st();
  if (!shot && s.arrow) { shot = true; await new Promise((r) => setTimeout(r, 400)); await p.screenshot({ path: `${out}/l1_arrow.jpg`, type: 'jpeg', quality: 85 }); }
  if (i % 10 === 0) console.log('dodging', JSON.stringify(s));
  if (s.state === 'over') { console.log('FAIL: ended while dodging', JSON.stringify(s)); break; }
}
console.log('after dodging', JSON.stringify(await st()));
await p.evaluate(() => { window.__noOrbs = false; });
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const s = await st();
  if (s.state === 'over') { console.log('ENDED', JSON.stringify(s)); break; }
  if (i % 10 === 0) console.log('taking', JSON.stringify(s));
}
console.log('errors', errs.slice(0, 3));
await b.close();
