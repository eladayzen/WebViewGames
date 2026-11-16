// Start a roof power and save crops around that turtle as the player sees him.
//   node tools/hero-crop.mjs [port] [outDir] [raph|mike|donnie] [frames] [gapMs]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', kind = 'mike', n = '4', gap = '400'] = process.argv.slice(2);
const key = { raph: 'raphTop', mike: 'mikeTop', donnie: 'donTop' }[kind];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate((kind) => { const g = window.__game; g.G.god = true; document.querySelector('.lil-gui')?.remove(); g.startBuff(kind); }, kind);
await new Promise((r) => setTimeout(r, 1500));
for (let i = 0; i < +n; i++) {
  const sp = await p.evaluate((key) => {
    const g = window.__game, v = g[key].model.getObjectByName('mixamorigSpine2').getWorldPosition(g.camera.position.clone()).project(g.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  }, key);
  const w = 360, h = 300, x = Math.max(0, Math.min(1280 - w, sp.x - w / 2)), y = Math.max(0, Math.min(720 - h, sp.y - h / 2));
  await p.screenshot({ path: `${out}/${kind}_${i}.jpg`, type: 'jpeg', quality: 90, clip: { x, y, width: w, height: h } });
  await new Promise((r) => setTimeout(r, +gap));
}
console.log('errors', errs.slice(0, 3));
await b.close();
