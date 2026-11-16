// Side views of the wheel covers: freeze the game, park the camera beside the wagon and beside
// the nearest Foot car, two shots each with the wheels a quarter-turn apart.
//   node tools/wheel-view.mjs [port] [outDir] [player,enemy,truck]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
let i = 0;
for (const who of (process.argv[4] || 'player,enemy').split(',')) {
  for (const turn of [0, Math.PI / 2]) {
    await p.evaluate((who, turn) => {
      const g = window.__game; g.G.paused = true; document.querySelector('.lil-gui')?.remove();
      const car = who === 'player' ? g.player : g.enemies.filter((e) => e.active && e.alive && (who !== 'truck' || e.kind === 'truck')).sort((a, b) => Math.abs(a.s - g.player.s) - Math.abs(b.s - g.player.s))[0];
      for (const w of car.wheels) w.g.rotation.x += turn;
      car.group.updateMatrixWorld(true);
      const c = car.group.localToWorld(new car.group.position.constructor(car.W * 2.2, 1.2, 0));
      const t = car.group.localToWorld(new car.group.position.constructor(0, 0.8, 0));
      g.camera.position.copy(c); g.camera.lookAt(t);
    }, who, turn);
    await new Promise((r) => setTimeout(r, 200));
    await p.screenshot({ path: `${out}/wv_${i++}.jpg`, type: 'jpeg', quality: 85 });
  }
}
console.log('errors', errs.slice(0, 3));
await b.close();
