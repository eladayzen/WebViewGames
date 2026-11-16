// Close-ups of each gadget fully deployed: start it, let it deploy, freeze, and shoot the van
// from behind at three-quarters (and from the chase camera).
//   node tools/gadget-pose.mjs [port] [outDir] [shield,nitro,harpoon,saws]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', kinds = 'shield,nitro,harpoon'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const errs = [];
for (const kind of kinds.split(',')) {
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/index.html?auto=1&dev=1`);
  await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
  await p.evaluate((kind) => { const g = window.__game; g.G.god = true; document.querySelector('.lil-gui')?.remove(); g.startGadget(kind); }, kind);
  await new Promise((r) => setTimeout(r, kind === 'harpoon' ? 3500 : 1500));
  await p.screenshot({ path: `${out}/gp_${kind}_chase.jpg`, type: 'jpeg', quality: 85 });
  await p.evaluate(() => {
    const g = window.__game; g.G.paused = true;
    const car = g.player, V = car.group.position.constructor; car.group.updateMatrixWorld(true);
    g.camera.position.copy(car.group.localToWorld(new V(4.5, 3.4, 8)));
    g.camera.lookAt(car.group.localToWorld(new V(0, 1, -1)));
  });
  await new Promise((r) => setTimeout(r, 200));
  await p.screenshot({ path: `${out}/gp_${kind}.jpg`, type: 'jpeg', quality: 85 });
  await p.close();
}
console.log('errors', errs.slice(0, 3));
await b.close();
