// Donnie's THUNDER STAFF: a burst of chase-camera frames through his swings (wind-up, strike,
// a Foot car thrown up and onto another), plus the counts: swings that lifted a car, CRUSHED /
// SLAMMED labels, wrecks during the power.
//   node tools/donnie.mjs [port] [outDir] [frames] [gapMs]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', frames = '24', gap = '140'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1&auto=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => {
  const g = window.__game; g.G.god = true; document.querySelector('.lil-gui')?.remove();
  g.G.script.foot = g.G.script.pickup = g.G.script.fork = true;   // no tutorial interruptions
  window.__autopilot = false;
  // a cluster of Foot cars ahead, two lanes either side, so a thrown car has somewhere to land
  g.spawnEnemy('racer', 22, -5.4); g.spawnEnemy('racer', 30, -1.8); g.spawnEnemy('truck', 40, 5.4); g.spawnEnemy('racer', 26, 9);
  window.__labels = {};
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { const t = (n.textContent || '').replace(/[+\-]?\d+/g, '').trim(); if (t) window.__labels[t] = (window.__labels[t] || 0) + 1; } })
    .observe(document.getElementById('popups'), { childList: true, subtree: true });
  window.__w0 = g.G.wrecks;
  g.startBuff('donnie');
});
for (let i = 0; i < +frames; i++) {
  await new Promise((r) => setTimeout(r, +gap));
  await p.screenshot({ path: `${out}/don_${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 80 });
}
await new Promise((r) => setTimeout(r, 4000));
console.log(JSON.stringify(await p.evaluate(() => ({ lifts: window.__game.G.lifts || 0, wrecks: window.__game.G.wrecks - window.__w0, labels: window.__labels }))), 'errors', errs.slice(0, 3));
await b.close();
