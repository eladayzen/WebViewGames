// Close look at Leo during a real strike: trigger it, then every gapMs project his chest to the
// screen and save a crop around him (to check the katanas in his hands).
//   node tools/leo-pose.mjs [port] [outDir] [frames] [gapMs]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', n = '12', gap = '90'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => { const g = window.__game; g.G.god = true; document.querySelector('.lil-gui')?.remove(); g.G.power = 'leo'; g.G.powerAt = -10; });
await p.waitForFunction(() => window.__game.G.strike, { timeout: 30000, polling: 16 });
let k = 0;
for (let i = 0; i < +n; i++) {
  const sp = await p.evaluate(() => {
    const g = window.__game, v = g.leo.model.getObjectByName('mixamorigSpine2').getWorldPosition(g.camera.position.clone()).project(g.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, on: v.z < 1 };
  });
  if (sp.on) {
    const w = 420, h = 380, x = Math.max(0, Math.min(1280 - w, sp.x - w / 2)), y = Math.max(0, Math.min(720 - h, sp.y - h / 2));
    await p.screenshot({ path: `${out}/leo_${String(k++).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 85, clip: { x, y, width: w, height: h } });
  }
  await new Promise((r) => setTimeout(r, +gap));
}
console.log('frames', k, 'errors', errs.slice(0, 3));
await b.close();
