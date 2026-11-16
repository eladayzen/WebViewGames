// The saw rig's deploy, posed: freeze the game, set the deploy progress to fixed points and
// shoot the van from behind at three-quarters, so each stage (deck sliding out, blade swinging
// up, locked) can be checked. Also prints the on-screen and back-door roundel state.
//   node tools/saw-deploy.mjs [port] [outDir]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));
await p.evaluate(() => { const g = window.__game; g.startBuff('raph'); g.startGadget('saws'); });
await new Promise((r) => setTimeout(r, 1200));
console.log(await p.evaluate(() => `turtle ring on: ${document.getElementById('buff').classList.contains('on')}  gadget ring on: ${document.getElementById('gadget').classList.contains('on')}`));
await p.screenshot({ path: `${out}/sd_hud.jpg`, type: 'jpeg', quality: 85 });
let i = 0;
for (const x of [0.2, 0.5, 0.7, 1]) {
  await p.evaluate((x) => {
    const g = window.__game; g.G.paused = true; document.querySelector('.lil-gui')?.remove();
    g.saws.ext = x; g.updateSaws(1e-6);
    const car = g.player; car.group.updateMatrixWorld(true);
    const V = car.group.position.constructor;
    g.camera.position.copy(car.group.localToWorld(new V(5.5, 3.2, 9)));
    g.camera.lookAt(car.group.localToWorld(new V(0, 0.8, 0)));
  }, x);
  await new Promise((r) => setTimeout(r, 200));
  await p.screenshot({ path: `${out}/sd_${i++}.jpg`, type: 'jpeg', quality: 85 });
}
console.log('errors', errs.slice(0, 3));
await b.close();
