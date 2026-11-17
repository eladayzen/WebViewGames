// A level's new power shown in play: under autopilot (which drives to pickups), log the first
// pickups (kind, time, featured), the hint and lines, when the new one is taken, and take a
// screenshot while the featured pickup is on screen with its arrow.
//   node tools/new-power.mjs [port] [outDir] [level]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', level = '2'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1&level=${level}`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => {
  const g = window.__game; g.G.god = true;
  window.__log = []; window.__says = [];
  const push = g.orbs.push.bind(g.orbs);
  g.orbs.push = (o) => { window.__log.push({ kind: o.kind, t: +g.G.time.toFixed(1) }); return push(o); };
  new MutationObserver(() => { const t = document.getElementById('say').textContent; if (t && window.__says.at(-1) !== t) window.__says.push(t); })
    .observe(document.getElementById('say'), { childList: true, subtree: true });
});
let shot = false, taken = null;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 250));
  const s = await p.evaluate(() => { const g = window.__game, o = g.orbs[0]; return { t: +g.G.time.toFixed(1), featured: !!(o && o.featured), arrow: !document.getElementById('orb-arrow').classList.contains('hidden'), hint: document.getElementById('hint').textContent, took: g.G.took, unlock: g.LV.unlock }; });
  if (!shot && s.featured && s.arrow && i > 4) { shot = true; await p.screenshot({ path: `${out}/newpower_L${level}.jpg`, type: 'jpeg', quality: 82 }); console.log('on screen', JSON.stringify(s)); }
  if (!taken && s.unlock.every((k) => s.took?.[k])) { taken = s.t; }
  if (taken && G_after(i)) break;
}
function G_after() { return false; }
await new Promise((r) => setTimeout(r, 3000));
console.log(JSON.stringify(await p.evaluate(() => ({ unlock: window.__game.LV.unlock, spawns: window.__log.slice(0, 4), says: window.__says.slice(0, 4) }))), 'newTakenAt', taken, 'errors', errs.slice(0, 3));
await b.close();
